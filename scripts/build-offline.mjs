#!/usr/bin/env node
/** Publish one complete, content-verified offline study pack from the exact Next production output. */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IMMUTABLE_PATH, immutable } from "./release-manifest.mjs";

const repository = resolve(import.meta.dirname, "..");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const generated = (path) => path === "sw.js" || path === "offline-manifest.json" || path.startsWith("offline/");
const contentType = (path) =>
  ({
    ".html": "text/html; charset=utf-8",
    ".rsc": "text/x-component",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".wasm": "application/wasm",
    ".glb": "model/gltf-binary",
  })[extname(path)] ?? "application/octet-stream";

async function files(root, directory = "") {
  const entries = await readdir(join(root, directory), { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT" && !directory) return [];
    throw error;
  });
  const result = [];
  for (const entry of entries) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (generated(path)) continue;
    if (entry.isSymbolicLink()) throw new Error(`Offline pack contains a symbolic link: ${path}`);
    if (entry.isDirectory()) result.push(...(await files(root, path)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

const safePath = (path) =>
  path.startsWith("/") &&
  !/[\\?#%\x00-\x1f\x7f]/.test(path) &&
  !path.split("/").some((segment) => segment === "." || segment === "..");

const publicAsset = (path) =>
  !path.endsWith(".map") &&
  (/^(?:geometry|icons|fonts)\//.test(path) ||
    /^(?:icon[^/]*|apple[^/]*|favicon\.ico|manifest\.webmanifest)$/.test(path));
const generatedOutput = (pathname) =>
  pathname === "/sw.js" || pathname === "/offline-manifest.json" || pathname.startsWith("/_next/static/offline/");

async function readReceipt(path) {
  return JSON.parse(
    await readFile(path, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "null";
      throw error;
    }),
  );
}

/** The deployed worker: its template with this release's inventory and the content-hashed path pattern. */
export const workerSource = (template, manifest) =>
  template
    .replace("__OFFLINE_MANIFEST__", () => JSON.stringify(manifest))
    .replace("__IMMUTABLE_PATH__", () => String(IMMUTABLE_PATH));

export async function buildOffline(
  root = repository,
  {
    adapterContext,
    staticExport = adapterContext ? adapterContext.config?.output === "export" : process.env.STATIC_EXPORT === "1",
  } = {},
) {
  const distDir = adapterContext?.distDir ?? join(root, ".next");
  const app = join(distDir, "server/app");
  const publicRoot = join(root, "public");
  const prerenderBytes = await readFile(join(distDir, "prerender-manifest.json"));
  const prerender = JSON.parse(prerenderBytes);
  const buildId = adapterContext?.buildId ?? (await readFile(join(distDir, "BUILD_ID"), "utf8")).trim();
  const source = await readFile(join(repository, "scripts/offline-worker.js"), "utf8");
  const viewBytes = await readFile(join(root, "aircraft/views.json"));
  const views = JSON.parse(viewBytes);
  const staticPaths = (await files(join(distDir, "static"))).filter((path) => !path.endsWith(".map"));
  const publicPaths = (await files(publicRoot)).filter(publicAsset);
  const inputs = {
    generator: digest(await readFile(fileURLToPath(import.meta.url))),
    worker: digest(source),
    // Built into the worker and each file's entry: which files it serves from the pack without asking the network.
    immutablePath: String(IMMUTABLE_PATH),
    views: digest(viewBytes),
    prerender: digest(prerenderBytes),
    staticPaths,
    publicPaths,
  };
  const receiptPath = join(distDir, "offline-adapter.json");
  const receipt = !adapterContext && (await readReceipt(receiptPath));
  if (receipt && receipt.buildId === buildId) {
    // The platform has already consumed the adapter output inventory. A post-build command may verify it,
    // but must never silently publish a new worker/version after those outputs have been sealed.
    if (receipt.staticExport !== staticExport)
      throw new Error("Offline adapter pack mode changed after publication. Run a new Next build.");
    if (receipt.schema !== 1 || JSON.stringify(receipt.inputs) !== JSON.stringify(inputs))
      throw new Error("Offline adapter pack inputs changed after publication. Run a new Next build.");
    for (const file of receipt.files) {
      const bytes = await readFile(file.path);
      if (bytes.length !== file.bytes || digest(bytes) !== file.sha256)
        throw new Error(`Offline adapter pack changed after publication: ${file.path}`);
    }
    return JSON.parse(await readFile(join(publicRoot, "offline-manifest.json"), "utf8"));
  }
  const expected = [
    "/",
    ...views.flatMap(({ id, systems }) => [`/${id}`, ...systems.map((system) => `/${id}/${system}`)]),
  ];
  const study = new Set(expected);
  for (const route of Object.keys(prerender.routes))
    if (/^\/(engines|components|fdr)\/[a-z0-9-]+$/.test(route)) study.add(route);
  for (const route of study) {
    const entry = prerender.routes[route];
    if (!entry || entry.routeType !== "page" || entry.initialStatus >= 300 || entry.initialRevalidateSeconds !== false)
      throw new Error(`Offline study route is not fully prerendered: ${route}`);
  }

  const inventory = new Map();
  const inventoryPaths = new Map();
  const snapshots = [];
  const routes = {};
  const aliases = {};
  const prefix = "/_next/static/offline/__VERSION__";
  async function add(url, path, type = contentType(url)) {
    if (!safePath(url)) throw new Error(`Invalid offline URL: ${url}`);
    if (inventory.has(url)) throw new Error(`Duplicate offline URL: ${url}`);
    const bytes = await readFile(path);
    // The worker serves content-addressed files from the pack and asks the network for everything else first.
    inventory.set(url, {
      url,
      bytes: bytes.length,
      sha256: digest(bytes),
      contentType: type,
      immutable: immutable(url.slice(1)),
    });
    inventoryPaths.set(url, path);
    return url;
  }
  async function snapshot(path, target, type = contentType(target)) {
    // Serve downloads as opaque bytes so a preview host cannot inject its toolbar into an HTML snapshot.
    // The worker restores the original response MIME only when serving the study route.
    const stored = /\.(?:html|rsc)$/.test(target) ? `${target}.bin` : target;
    const url = await add(`${prefix}/${stored}`, path, type);
    snapshots.push({ path, target: stored });
    return url;
  }
  const adapterPrerenders = new Map();
  for (const output of adapterContext?.outputs.prerenders ?? []) {
    if (adapterPrerenders.has(output.pathname)) throw new Error(`Duplicate adapter prerender: ${output.pathname}`);
    adapterPrerenders.set(output.pathname, output);
  }
  const adapterStatic = new Map((adapterContext?.outputs.staticFiles ?? []).map((output) => [output.pathname, output]));
  function prerenderFile(pathname, page = false) {
    const output = adapterPrerenders.get(pathname);
    const fallback = output?.fallback;
    if (
      !fallback?.filePath ||
      fallback.postponedState ||
      fallback.initialStatus >= 300 ||
      fallback.initialRevalidate !== false ||
      output.config?.renderingMode === "PARTIALLY_STATIC" ||
      (page && output.routeType !== "page") ||
      (output.response !== undefined && output.response !== "complete") ||
      (output.compute !== undefined && output.compute !== "static")
    )
      throw new Error(`Offline adapter route is not fully prerendered: ${pathname}`);
    return fallback.filePath;
  }
  for (const route of [...study].sort()) {
    const key = route === "/" ? "index" : route.slice(1);
    let htmlPath;
    let rscPath;
    const segmentFiles = new Map();
    if (adapterContext && !staticExport) {
      // An adapter build owns route-cache paths, including source route groups and parallel slots.
      // Only the public adapter inventory knows their physical locations; never reconstruct those paths.
      htmlPath = prerenderFile(route, true);
      rscPath = prerenderFile(prerender.routes[route].dataRoute ?? `/${key}.rsc`);
      const directory = `/${key}${adapterContext.routing?.rsc?.prefetchSegmentDirSuffix ?? ".segments"}`;
      const suffix = adapterContext.routing?.rsc?.prefetchSegmentSuffix ?? ".segment.rsc";
      for (const pathname of adapterPrerenders.keys())
        if (pathname.startsWith(`${directory}/`) && pathname.endsWith(suffix))
          segmentFiles.set(pathname.slice(directory.length, -suffix.length), prerenderFile(pathname));
    } else {
      const meta = JSON.parse(await readFile(join(app, `${key}.meta`), "utf8"));
      if (meta.postponed || meta.status >= 300)
        throw new Error(`Offline route has a dynamic or error response: ${route}`);
      htmlPath = join(app, `${key}.html`);
      rscPath = join(app, `${key}.rsc`);
      for (const segment of meta.segmentPaths ?? [])
        segmentFiles.set(segment, join(app, `${key}.segments${segment}.segment.rsc`));
    }
    const html = await snapshot(htmlPath, `pages/${key}.html`);
    const rsc = await snapshot(rscPath, `pages/${key}.rsc`);
    const segments = {};
    for (const [segment, filePath] of [...segmentFiles].sort(([a], [b]) => a.localeCompare(b))) {
      if (!safePath(segment)) throw new Error(`Invalid offline RSC segment: ${segment}`);
      const path = `${key}.segments${segment}.segment.rsc`;
      segments[segment] = await snapshot(filePath, `pages/${path}`);
      // Next's export client encodes segment requests as files, while next start uses the RSC request headers.
      aliases[`${route === "/" ? "" : route}/__next${segment.replaceAll("/", ".")}.txt`] = segments[segment];
    }
    routes[route] = { html, rsc, segments };
    aliases[route === "/" ? "/index.txt" : `${route}.txt`] = rsc;
    aliases[route === "/" ? "/index.html" : `${route}.html`] = html;
  }
  for (const [route, entry] of Object.entries(prerender.routes)) {
    if (entry.routeType !== "route" || !/^\/(?:manifest\.webmanifest|(?:apple-)?icon(?:[.-][a-z0-9]+)*)$/.test(route))
      continue;
    const key = route.slice(1);
    const filePath =
      adapterContext && !staticExport
        ? (adapterStatic.get(route)?.filePath ?? prerenderFile(route))
        : join(app, `${key}.body`);
    aliases[route] = await snapshot(filePath, `metadata/${key}`, contentType(route));
  }
  for (const path of staticPaths)
    await add(
      `/_next/static/${path}`,
      adapterStatic.get(`/_next/static/${path}`)?.filePath ?? join(distDir, "static", path),
    );
  // Only assets used by the public study app, never an unrelated HTML/login document or a source map.
  for (const path of publicPaths) await add(`/${path}`, join(publicRoot, path));
  const geometry = JSON.parse(await readFile(join(publicRoot, "geometry/manifest.json"), "utf8"));
  const runtime = JSON.parse(await readFile(join(publicRoot, "geometry/runtime.json"), "utf8"));
  const requiredGeometry = [
    runtime.recovery,
    ...views.flatMap(({ id }) => [geometry[id], runtime.aircraft?.[id]?.geometry, runtime.aircraft?.[id]?.scene]),
  ];
  if (requiredGeometry.some((url) => typeof url !== "string" || !url.startsWith("/geometry/") || !inventory.has(url)))
    throw new Error("Offline aircraft geometry is incomplete. Run npm run geometry:build first.");

  const ordered = [...inventory.values()].sort((a, b) => a.url.localeCompare(b.url));
  const version = digest(
    JSON.stringify({ buildId, staticExport, files: ordered, routes, aliases, worker: digest(source) }),
  );
  const replaceVersion = (value) => JSON.parse(JSON.stringify(value).replaceAll("__VERSION__", version));
  const manifest = replaceVersion({
    schema: 1,
    version,
    buildId,
    mode: staticExport ? "export" : "server",
    total: ordered.length,
    totalBytes: ordered.reduce((sum, file) => sum + file.bytes, 0),
    files: ordered,
    routes,
    aliases,
  });
  // Remove a prior local build's generated payloads, including those Next copied into a subsequent static export.
  const payloads = [join(distDir, "static"), ...(staticExport ? [join(root, "out/_next/static")] : [])];
  for (const output of payloads) {
    await rm(join(output, "offline"), { recursive: true, force: true });
    for (const { path, target } of snapshots) {
      const destination = join(output, "offline", version, target);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(path, destination);
    }
  }
  for (const output of [publicRoot, ...(staticExport ? [join(root, "out")] : [])]) {
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "offline-manifest.json"), JSON.stringify(manifest) + "\n");
    await writeFile(join(output, "sw.js"), workerSource(source, manifest));
  }
  if (adapterContext) {
    const outputs = adapterContext.outputs.staticFiles;
    // Next may have inventoried generated public files from an earlier build. Replace those stale entries.
    outputs.splice(0, outputs.length, ...outputs.filter((output) => !generatedOutput(output.pathname)));
    for (const file of manifest.files.filter((file) => file.url.startsWith("/_next/static/offline/"))) {
      outputs.push({
        type: "STATIC_FILE",
        id: file.url,
        pathname: file.url,
        filePath: join(staticExport ? join(root, "out/_next/static") : join(distDir, "static"), file.url.slice(14)),
        // immutableHash opts into the platform's bundler hash protocol, not our SHA-256 integrity format.
        // Publish these versioned files normally; the adapter's explicit cache rule makes them immutable.
        immutableHash: undefined,
      });
    }
    for (const pathname of ["/sw.js", "/offline-manifest.json"])
      outputs.push({
        type: "STATIC_FILE",
        id: pathname,
        pathname,
        filePath: join(staticExport ? join(root, "out") : publicRoot, pathname),
        immutableHash: undefined,
      });
    const published = [];
    for (const file of manifest.files) {
      const path = file.url.startsWith("/_next/static/offline/")
        ? join(distDir, "static", file.url.slice(14))
        : inventoryPaths.get(file.url);
      published.push({ path, bytes: file.bytes, sha256: file.sha256 });
    }
    for (const pathname of ["sw.js", "offline-manifest.json"]) {
      const path = join(publicRoot, pathname);
      const bytes = await readFile(path);
      published.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    }
    if (staticExport)
      for (const output of outputs.filter((output) => generatedOutput(output.pathname))) {
        const bytes = await readFile(output.filePath);
        published.push({ path: output.filePath, bytes: bytes.length, sha256: digest(bytes) });
      }
    await writeFile(receiptPath, JSON.stringify({ schema: 1, buildId, staticExport, inputs, files: published }) + "\n");
  } else await rm(receiptPath, { force: true });
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildOffline();
  console.log(
    `Offline pack: ${manifest.total} files, ${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MiB, ${manifest.version}`,
  );
}
