#!/usr/bin/env node
/** Publish one complete, content-verified offline study pack from the exact Next production output. */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export async function buildOffline(root = repository, { staticExport = process.env.STATIC_EXPORT === "1" } = {}) {
  const app = join(root, ".next/server/app");
  const publicRoot = join(root, "public");
  const prerender = JSON.parse(await readFile(join(root, ".next/prerender-manifest.json"), "utf8"));
  const buildId = (await readFile(join(root, ".next/BUILD_ID"), "utf8")).trim();
  const source = await readFile(join(repository, "scripts/offline-worker.js"), "utf8");
  const views = JSON.parse(await readFile(join(root, "aircraft/views.json"), "utf8"));
  const expected = [
    "/",
    ...views.flatMap(({ id, systems }) => [`/${id}`, ...systems.map((system) => `/${id}/${system}`)]),
  ];
  const study = new Set(expected);
  for (const route of Object.keys(prerender.routes))
    if (/^\/(engines|components)\/[a-z0-9-]+$/.test(route)) study.add(route);
  for (const route of study) {
    const entry = prerender.routes[route];
    if (!entry || entry.routeType !== "page" || entry.initialStatus >= 300 || entry.initialRevalidateSeconds !== false)
      throw new Error(`Offline study route is not fully prerendered: ${route}`);
  }

  const inventory = new Map();
  const snapshots = [];
  const routes = {};
  const aliases = {};
  const prefix = "/_next/static/offline/__VERSION__";
  async function add(url, path, type = contentType(url)) {
    if (!safePath(url)) throw new Error(`Invalid offline URL: ${url}`);
    if (inventory.has(url)) throw new Error(`Duplicate offline URL: ${url}`);
    const bytes = await readFile(path);
    inventory.set(url, { url, bytes: bytes.length, sha256: digest(bytes), contentType: type });
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
  for (const route of [...study].sort()) {
    const key = route === "/" ? "index" : route.slice(1);
    const meta = JSON.parse(await readFile(join(app, `${key}.meta`), "utf8"));
    if (meta.postponed || meta.status >= 300)
      throw new Error(`Offline route has a dynamic or error response: ${route}`);
    const html = await snapshot(join(app, `${key}.html`), `pages/${key}.html`);
    const rsc = await snapshot(join(app, `${key}.rsc`), `pages/${key}.rsc`);
    const segments = {};
    for (const segment of meta.segmentPaths ?? []) {
      if (!safePath(segment)) throw new Error(`Invalid offline RSC segment: ${segment}`);
      const path = `${key}.segments${segment}.segment.rsc`;
      segments[segment] = await snapshot(join(app, path), `pages/${path}`);
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
    aliases[route] = await snapshot(join(app, `${key}.body`), `metadata/${key}`, contentType(route));
  }
  for (const path of await files(join(root, ".next/static")))
    if (!path.endsWith(".map")) await add(`/_next/static/${path}`, join(root, ".next/static", path));
  for (const path of await files(publicRoot)) {
    // Only assets used by the public study app, never an unrelated HTML/login document or a source map.
    if (
      !/^(?:geometry|icons|fonts)\//.test(path) &&
      !/^(?:icon[^/]*|apple[^/]*|favicon\.ico|manifest\.webmanifest)$/.test(path)
    )
      continue;
    if (!path.endsWith(".map")) await add(`/${path}`, join(publicRoot, path));
  }
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
  const payloads = [join(root, ".next/static"), ...(staticExport ? [join(root, "out/_next/static")] : [])];
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
    await writeFile(join(output, "sw.js"), source.replace("__OFFLINE_MANIFEST__", JSON.stringify(manifest)));
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildOffline();
  console.log(
    `Offline pack: ${manifest.total} files, ${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MiB, ${manifest.version}`,
  );
}
