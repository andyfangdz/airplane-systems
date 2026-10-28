import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOffline, type OfflineAdapterContext } from "../scripts/build-offline.mjs";
import { IMMUTABLE_PATH } from "../scripts/release-manifest.mjs";

const { sourceOverrides } = vi.hoisted(() => ({ sourceOverrides: new Map<string, string>() }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) => {
      for (const [suffix, value] of sourceOverrides)
        if (String(args[0]).endsWith(suffix)) return Promise.resolve(args[1] === "utf8" ? value : Buffer.from(value));
      return actual.readFile(...args);
    },
  };
});

// The build reads this template; keep source-based changed-test discovery connected to it.
import.meta.glob("../scripts/offline-worker.js");
const roots: string[] = [];
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const put = async (root: string, path: string, contents: string) => {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
};
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "airplane-offline-"));
  roots.push(root);
  await put(root, "aircraft/views.json", JSON.stringify([{ id: "plane", systems: ["fuel"] }]));
  await put(root, ".next/BUILD_ID", "fixture-build");
  const routes: Record<string, object> = {};
  for (const route of ["/", "/plane", "/plane/fuel", "/engines/demo", "/components/demo", "/login"]) {
    const key = route === "/" ? "index" : route.slice(1);
    routes[route] = { routeType: "page", initialRevalidateSeconds: false };
    await put(root, `.next/server/app/${key}.html`, `<!doctype html><title>${route}</title>`);
    await put(root, `.next/server/app/${key}.rsc`, `full:${route}`);
    const segments = ["/_tree", "/_full", "/!KGZsZWV0KQ/__PAGE__"];
    await put(root, `.next/server/app/${key}.meta`, JSON.stringify({ segmentPaths: segments }));
    for (const segment of segments)
      await put(root, `.next/server/app/${key}.segments${segment}.segment.rsc`, `${route}:${segment}`);
  }
  for (const [route, body] of [
    ["/icon.svg", "<svg/>"],
    ["/manifest.webmanifest", '{"name":"Study"}'],
  ]) {
    routes[route] = { routeType: "route", initialRevalidateSeconds: false };
    await put(root, `.next/server/app${route}.body`, body);
  }
  await put(root, ".next/prerender-manifest.json", JSON.stringify({ routes }));
  await put(root, ".next/static/chunks/app.js", "console.log('study');");
  await put(root, ".next/static/chunks/app.js.map", "private source map");
  await put(root, ".next/static/media/local.woff2", "local font");
  await put(root, "public/geometry/manifest.json", '{"plane":"/geometry/plane-buffer.bin.gz"}');
  await put(root, "public/geometry/plane-buffer.bin.gz", "compiled geometry");
  await put(root, "public/geometry/plane-scene.json", "compiled presentation");
  await put(root, "public/geometry/recovery-worker.js", "geometry recovery");
  await put(
    root,
    "public/geometry/runtime.json",
    JSON.stringify({
      recovery: "/geometry/recovery-worker.js",
      aircraft: { plane: { geometry: "/geometry/plane-buffer.bin.gz", scene: "/geometry/plane-scene.json" } },
    }),
  );
  await put(root, "public/icons/icon-192.png", "icon");
  await put(root, "public/login.html", "protected document");
  return root;
}
/** Adapter URLs map to hashed source-owned files, not the old server/app hierarchy. */
async function adapterFixture() {
  const root = await fixture();
  const sourceCache = join(root, ".next/source-route-cache");
  const legacy = new Map<string, string>();
  const context: OfflineAdapterContext = {
    distDir: join(root, ".next"),
    buildId: "fixture-build",
    routing: { rsc: { prefetchSegmentDirSuffix: ".segments", prefetchSegmentSuffix: ".segment.rsc" } },
    outputs: { prerenders: [], staticFiles: [] },
  };
  const relocate = async (pathname: string, source: string) => {
    const body = await readFile(join(root, source), "utf8");
    legacy.set(source, body);
    const relative = `.next/source-route-cache/${hash(Buffer.from(pathname)).slice(0, 20)}/(source-group)/response.payload`;
    await put(root, relative, body);
    return join(root, relative);
  };
  const prerender = async (pathname: string, source: string, routeType: "page" | "route" = "page") => {
    context.outputs.prerenders.push({
      pathname,
      ...(pathname.endsWith(".rsc") ? {} : { routeType, response: "complete" as const, compute: "static" as const }),
      config: { renderingMode: "STATIC" },
      fallback: { filePath: await relocate(pathname, source), initialRevalidate: false },
    });
  };
  for (const route of ["/", "/plane", "/plane/fuel", "/engines/demo", "/components/demo", "/login"]) {
    const key = route === "/" ? "index" : route.slice(1);
    await prerender(route, `.next/server/app/${key}.html`);
    await prerender(`/${key}.rsc`, `.next/server/app/${key}.rsc`);
    const metaPath = `.next/server/app/${key}.meta`;
    const meta = await readFile(join(root, metaPath), "utf8");
    legacy.set(metaPath, meta);
    for (const segment of JSON.parse(meta).segmentPaths as string[])
      await prerender(
        `/${key}.segments${segment}.segment.rsc`,
        `.next/server/app/${key}.segments${segment}.segment.rsc`,
      );
  }
  await prerender("/manifest.webmanifest", ".next/server/app/manifest.webmanifest.body", "route");
  const icon = await relocate("/icon.svg", ".next/server/app/icon.svg.body");
  context.outputs.staticFiles.push({
    type: "STATIC_FILE",
    id: "/icon.svg",
    pathname: "/icon.svg",
    filePath: icon,
    immutableHash: undefined,
  });
  for (const path of ["chunks/app.js", "media/local.woff2"])
    context.outputs.staticFiles.push({
      type: "STATIC_FILE",
      id: `/_next/static/${path}`,
      pathname: `/_next/static/${path}`,
      filePath: join(root, ".next/static", path),
      immutableHash: hash(await readFile(join(root, ".next/static", path))),
    });
  await rm(join(root, ".next/server/app"), { recursive: true });
  return {
    root,
    context,
    sourceCache,
    restoreLegacy: () => Promise.all([...legacy].map(([path, contents]) => put(root, path, contents))),
  };
}

afterEach(async () => {
  sourceOverrides.clear();
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("production offline pack", () => {
  it("contains every study route, full/segment RSC, lazy chunk, font, icon and geometry with exact digests", async () => {
    const root = await fixture();
    const manifest = await buildOffline(root);
    expect(Object.keys(manifest.routes).sort()).toEqual([
      "/",
      "/components/demo",
      "/engines/demo",
      "/plane",
      "/plane/fuel",
    ]);
    expect(manifest.version).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files.some((file) => file.url.endsWith("app.js.map") || file.url.includes("login"))).toBe(false);
    expect(manifest.files.map((file) => file.url)).toEqual(
      expect.arrayContaining([
        "/_next/static/chunks/app.js",
        "/_next/static/media/local.woff2",
        "/geometry/plane-buffer.bin.gz",
        "/icons/icon-192.png",
      ]),
    );
    expect(manifest.aliases["/plane/fuel.txt"]).toBe(manifest.routes["/plane/fuel"].rsc);
    expect(manifest.routes["/plane/fuel"].html).toMatch(/\.html\.bin$/);
    expect(manifest.routes["/plane/fuel"].rsc).toMatch(/\.rsc\.bin$/);
    expect(manifest.files.find((file) => file.url === manifest.routes["/plane/fuel"].html)?.contentType).toBe(
      "text/html; charset=utf-8",
    );
    expect(manifest.aliases["/plane/fuel/__next._tree.txt"]).toBe(manifest.routes["/plane/fuel"].segments["/_tree"]);
    expect(manifest.aliases["/__next.!KGZsZWV0KQ.__PAGE__.txt"]).toBe(
      manifest.routes["/"].segments["/!KGZsZWV0KQ/__PAGE__"],
    );
    expect(manifest.aliases["/manifest.webmanifest"]).toMatch(/\/metadata\/manifest\.webmanifest$/);
    for (const file of manifest.files) {
      const path = file.url.startsWith("/_next/static/") ? `.next/static/${file.url.slice(14)}` : `public${file.url}`;
      const bytes = await readFile(join(root, path));
      expect(file.bytes).toBe(bytes.length);
      expect(file.sha256).toBe(hash(bytes));
    }
    expect(manifest.total).toBe(manifest.files.length);
    expect(manifest.totalBytes).toBe(manifest.files.reduce((sum, file) => sum + file.bytes, 0));
    const worker = await readFile(join(root, "public/sw.js"), "utf8");
    expect(worker).toContain(manifest.version);
    expect(worker).not.toContain("__OFFLINE_MANIFEST__");
    expect(worker).not.toContain("__IMMUTABLE_PATH__");
  });

  it("rebuilds deterministically without recursively packing old snapshots, and versions changed content", async () => {
    const root = await fixture();
    const initial = await buildOffline(root);
    const again = await buildOffline(root);
    expect(again).toEqual(initial);
    await put(root, ".next/server/app/plane/fuel.rsc", "updated full payload");
    const changed = await buildOffline(root);
    expect(changed.version).not.toBe(initial.version);
    expect(changed.total).toBe(initial.total);
    await expect(readFile(join(root, initial.routes["/"].html.replace("/_next/", ".next/")))).rejects.toThrow();
  });

  it("publishes identical snapshot bytes and worker metadata into the static export", async () => {
    const root = await fixture();
    const manifest = await buildOffline(root, { staticExport: true });
    expect(manifest.mode).toBe("export");
    expect(await readFile(join(root, "out/sw.js"), "utf8")).toBe(await readFile(join(root, "public/sw.js"), "utf8"));
    expect(JSON.parse(await readFile(join(root, "out/offline-manifest.json"), "utf8"))).toEqual(manifest);
    for (const file of manifest.files.filter((entry) => entry.url.startsWith("/_next/static/offline/")))
      expect(hash(await readFile(join(root, "out", file.url)))).toBe(file.sha256);
  });

  it.each([".next/server/app/plane/fuel.rsc", "public/geometry", "public/geometry/plane-buffer.bin.gz"])(
    "fails when required output is missing: %s",
    async (path) => {
      const root = await fixture();
      await rm(join(root, path), { recursive: true, force: true });
      await expect(buildOffline(root)).rejects.toThrow();
      await expect(readFile(join(root, "public/sw.js"))).rejects.toThrow();
    },
  );

  it("refuses dynamic or redirected study routes instead of reporting a complete pack", async () => {
    const root = await fixture();
    const path = join(root, ".next/prerender-manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.routes["/plane/fuel"].initialStatus = 307;
    await writeFile(path, JSON.stringify(manifest));
    await expect(buildOffline(root)).rejects.toThrow("not fully prerendered: /plane/fuel");
  });
});

describe("Next adapter offline publication", () => {
  it("uses virtual keys for moved route files and publishes hashed snapshots plus revalidating entry points", async () => {
    const { root, context } = await adapterFixture();
    vi.stubEnv("STATIC_EXPORT", "1"); // The server adapter context is authoritative over an unrelated shell setting.
    const original = [...context.outputs.staticFiles];
    const staleSnapshot = "/_next/static/offline/previous/pages/index.html.bin";
    for (const pathname of ["/sw.js", "/offline-manifest.json", staleSnapshot])
      context.outputs.staticFiles.push({
        type: "STATIC_FILE",
        id: pathname,
        pathname,
        filePath: join(root, "stale-output"),
        immutableHash: "stale",
      });
    const manifest = await buildOffline(root, { adapterContext: context });
    expect(manifest.mode).toBe("server");
    expect(Object.keys(manifest.routes)).toEqual(["/", "/components/demo", "/engines/demo", "/plane", "/plane/fuel"]);
    expect(manifest.files.some((file) => file.url.includes("login"))).toBe(false);
    const published = new Map(context.outputs.staticFiles.map((output) => [output.pathname, output]));
    expect(published.size).toBe(context.outputs.staticFiles.length);
    expect(published.has(staleSnapshot)).toBe(false);
    for (const previous of original) expect(published.get(previous.pathname)).toEqual(previous);
    for (const file of manifest.files.filter((file) => file.url.startsWith("/_next/static/offline/"))) {
      const output = published.get(file.url)!;
      expect(output).toMatchObject({ type: "STATIC_FILE", pathname: file.url });
      // Preserve SHA-256 verification without registering that digest as a platform-specific immutable hash.
      expect(output.immutableHash).toBeUndefined();
      expect(hash(await readFile(output.filePath))).toBe(file.sha256);
    }
    for (const [url, expected] of [
      [manifest.routes["/"].html, "<!doctype html><title>/</title>"],
      [manifest.routes["/plane"].rsc, "full:/plane"],
      [manifest.routes["/plane"].segments["/_tree"], "/plane:/_tree"],
      [manifest.aliases["/icon.svg"], "<svg/>"],
      [manifest.aliases["/manifest.webmanifest"], '{"name":"Study"}'],
    ])
      expect(await readFile(published.get(url)!.filePath, "utf8")).toBe(expected);
    for (const path of ["/sw.js", "/offline-manifest.json"]) {
      const output = published.get(path)!;
      expect(output.type).toBe("STATIC_FILE");
      expect(output.immutableHash).toBeUndefined();
      expect(await readFile(output.filePath, "utf8")).toBe(await readFile(join(root, "public", path), "utf8"));
    }
  });

  it("validates a sealed pack without rewriting it after its source route cache disappears", async () => {
    const { root, context, sourceCache } = await adapterFixture();
    const initial = await buildOffline(root, { adapterContext: context });
    const paths = context.outputs.staticFiles
      .filter(
        (output) =>
          output.pathname.startsWith("/_next/static/offline/") ||
          ["/sw.js", "/offline-manifest.json"].includes(output.pathname),
      )
      .map((output) => output.filePath);
    const states = () =>
      Promise.all(
        paths.map(async (path) => ({
          path,
          sha256: hash(await readFile(path)),
          modified: (await stat(path, { bigint: true })).mtimeNs,
        })),
      );
    const before = await states();
    await rm(sourceCache, { recursive: true });
    expect(await buildOffline(root)).toEqual(initial);
    expect(await states()).toEqual(before);
  });

  it.each([
    "geometry",
    "chunk",
    "new chunk",
    "prerender",
    "worker template",
    "generator template",
    "snapshot",
    "worker output",
    "manifest build ID",
    "content-hash rule",
  ] as const)("rejects same-build %s drift after adapter publication", async (changed) => {
    const { root, context } = await adapterFixture();
    const initial = await buildOffline(root, { adapterContext: context });
    if (changed === "geometry") await put(root, "public/geometry/plane-buffer.bin.gz", "changed geometry");
    if (changed === "chunk") await put(root, ".next/static/chunks/app.js", "changed chunk");
    if (changed === "new chunk") await put(root, ".next/static/chunks/late.js", "late chunk");
    if (changed === "prerender") {
      const path = join(root, ".next/prerender-manifest.json");
      const routes = JSON.parse(await readFile(path, "utf8"));
      routes.routes["/plane"].initialStatus = 307;
      await writeFile(path, JSON.stringify(routes));
    }
    if (changed === "worker template" || changed === "generator template") {
      const name = changed === "worker template" ? "offline-worker.js" : "build-offline.mjs";
      const original = await readFile(new URL(`../scripts/${name}`, import.meta.url), "utf8");
      sourceOverrides.set(`/scripts/${name}`, `${original}\n// changed after adapter publication\n`);
    }
    if (changed === "snapshot")
      await writeFile(join(root, initial.routes["/"].html.replace("/_next/", ".next/")), "changed HTML snapshot");
    if (changed === "worker output") await put(root, "public/sw.js", "changed worker");
    if (changed === "manifest build ID")
      await put(root, "public/offline-manifest.json", JSON.stringify({ ...initial, buildId: "different-build" }));
    if (changed === "content-hash rule") {
      // The sealed pack was built under a different rule for which paths are content-hashed.
      const path = join(root, ".next/offline-adapter.json");
      const receipt = JSON.parse(await readFile(path, "utf8"));
      expect(receipt.inputs.immutablePath).toBe(String(IMMUTABLE_PATH));
      receipt.inputs.immutablePath = "/^_next\\/static\\//";
      await writeFile(path, JSON.stringify(receipt));
    }
    await expect(buildOffline(root)).rejects.toThrow(/Offline adapter pack (?:inputs )?changed after publication/);
  });

  it.each([false, true])("refuses to change a sealed build's export mode from %s", async (staticExport) => {
    const { root, context, restoreLegacy } = await adapterFixture();
    await restoreLegacy(); // Both modes have valid inputs, so the receipt must prevent regeneration itself.
    context.config = staticExport ? { output: "export" } : {};
    await buildOffline(root, { adapterContext: context });
    const paths = context.outputs.staticFiles.map((output) => output.filePath);
    const states = () =>
      Promise.all(
        paths.map(async (path) => ({
          sha256: hash(await readFile(path)),
          modified: (await stat(path, { bigint: true })).mtimeNs,
        })),
      );
    const before = await states();
    await expect(buildOffline(root, { staticExport: !staticExport })).rejects.toThrow(
      "Offline adapter pack mode changed after publication",
    );
    expect(await states()).toEqual(before);
  });

  it("generates a fresh pack for a new BUILD_ID after Next emits new prerenders", async () => {
    const { root, context, restoreLegacy } = await adapterFixture();
    const initial = await buildOffline(root, { adapterContext: context });
    await restoreLegacy();
    await put(root, ".next/BUILD_ID", "next-fixture-build");
    await put(root, ".next/server/app/plane.rsc", "next-build full payload");
    const next = await buildOffline(root);
    expect(next.buildId).toBe("next-fixture-build");
    expect(next.version).not.toBe(initial.version);
    expect(await readFile(join(root, next.routes["/plane"].rsc.replace("/_next/", ".next/")), "utf8")).toBe(
      "next-build full payload",
    );
  });

  it.each([
    { pathname: "/plane.rsc", reason: "revalidating RSC", patch: { fallback: { initialRevalidate: 60 } } },
    {
      pathname: "/plane.segments/_tree.segment.rsc",
      reason: "partial tree",
      patch: { config: { renderingMode: "PARTIALLY_STATIC" } },
    },
    {
      pathname: "/plane.segments/_full.segment.rsc",
      reason: "postponed segment",
      patch: { fallback: { postponedState: "pending" } },
    },
    { pathname: "/plane/fuel.rsc", reason: "redirected RSC", patch: { fallback: { initialStatus: 307 } } },
    { pathname: "/components/demo.rsc", reason: "initial-only RSC", patch: { response: "initial" } },
    { pathname: "/engines/demo.rsc", reason: "blocking computation", patch: { compute: "blocking" } },
  ])("rejects $reason even when the primary page is static", async ({ pathname, patch }) => {
    const { root, context } = await adapterFixture();
    const output = context.outputs.prerenders.find((entry) => entry.pathname === pathname)!;
    const { fallback, ...other } = patch;
    if (fallback) Object.assign(output.fallback!, fallback);
    Object.assign(output, other);
    await expect(buildOffline(root, { adapterContext: context })).rejects.toThrow(
      `Offline adapter route is not fully prerendered: ${pathname}`,
    );
    await expect(readFile(join(root, "public/sw.js"))).rejects.toThrow();
  });

  it.each(["snapshot", "worker"])(
    "publishes export adapter files into out and rejects changed exported %s bytes",
    async (changed) => {
      const { root, context, restoreLegacy } = await adapterFixture();
      await restoreLegacy(); // Next's export adapter retains the static export's conventional prerenders.
      context.config = { output: "export" };
      vi.stubEnv("STATIC_EXPORT", "0");
      const manifest = await buildOffline(root, { adapterContext: context });
      expect(manifest.mode).toBe("export");
      const generated = context.outputs.staticFiles.filter(
        (output) =>
          output.pathname.startsWith("/_next/static/offline/") ||
          ["/sw.js", "/offline-manifest.json"].includes(output.pathname),
      );
      expect(generated.length).toBeGreaterThan(2);
      for (const output of generated) expect(output.filePath.startsWith(join(root, "out") + "/")).toBe(true);
      await rm(join(root, ".next/server/app"), { recursive: true });
      expect(await buildOffline(root, { staticExport: true })).toEqual(manifest);
      const output = generated.find(
        (entry) => entry.pathname === (changed === "snapshot" ? manifest.routes["/"].html : "/sw.js"),
      )!;
      await writeFile(output.filePath, "changed exported bytes");
      await expect(buildOffline(root, { staticExport: true })).rejects.toThrow(/changed after publication/);
    },
  );
});
