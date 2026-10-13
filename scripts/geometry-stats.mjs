#!/usr/bin/env node
/** Audit the exact assets served by the current build. Counts measure cost, not modeling quality. */
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true },
});
try {
  const { decodeMeshes } = await server.ssrLoadModule("/lib/mesh/decode.ts");
  const manifest = JSON.parse(await readFile(resolve(root, "public/geometry/manifest.json"), "utf8"));
  const rows = [];
  for (const [aircraft, asset] of Object.entries(manifest)) {
    const gzip = await readFile(resolve(root, `public${asset}`)),
      bytes = gunzipSync(gzip);
    const meshes = await decodeMeshes(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      aircraft,
    );
    const triangles = (m) => (m.index?.length ?? m.attributes.find((a) => a.name === "position").array.length / 3) / 3;
    rows.push({
      aircraft,
      meshes: meshes.length,
      triangles: meshes.reduce((n, m) => n + triangles(m), 0),
      fuselageTriangles: meshes.filter((m) => m.key.includes("/Fuselage-")).reduce((n, m) => n + triangles(m), 0),
      decodedMiB: +(
        meshes.reduce(
          (n, m) => n + (m.index?.byteLength ?? 0) + m.attributes.reduce((s, a) => s + a.array.byteLength, 0),
          0,
        ) / 1048576
      ).toFixed(3),
      gzipMiB: +(gzip.byteLength / 1048576).toFixed(3),
      asset,
    });
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else console.table(rows.map(({ asset: _, ...row }) => row));
} finally {
  await server.close();
}
