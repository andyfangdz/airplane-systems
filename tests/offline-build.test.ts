import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOffline } from "../scripts/build-offline.mjs";

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
afterEach(async () => {
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
