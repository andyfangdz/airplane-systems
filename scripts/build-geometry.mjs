#!/usr/bin/env node
/** Bake the source catalogues. Hash-named, explicit gzip assets need no runtime server or special host configuration. */
import { createHash } from "node:crypto";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/geometry");
const server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true },
});
try {
  await mkdir(output, { recursive: true });
  const { encodeMeshes } = await server.ssrLoadModule("/lib/mesh/encode.ts");
  const { geometryEntries } = await server.ssrLoadModule("/lib/mesh/prebuilt.ts");
  const { AIRCRAFT_IDS } = await server.ssrLoadModule("/lib/systems.ts");
  const assets = {};
  for (const id of AIRCRAFT_IDS) {
    const start = performance.now();
    const { CAT } = await server.ssrLoadModule(`/aircraft/${id}/parts/index.ts`);
    const entries = geometryEntries(CAT).map(({ key, spec }) => ({ key, geometry: spec.geo() }));
    const encoded = await encodeMeshes(id, entries);
    const gzip = gzipSync(encoded);
    const hash = createHash("sha256").update(gzip).digest("hex").slice(0, 20);
    const name = `${id}-${hash}.bin.gz`;
    await writeFile(resolve(output, name), gzip);
    assets[id] = `/geometry/${name}`;
    for (const { geometry } of entries) geometry.dispose();
    console.log(
      `${id}: ${entries.length} meshes, ${(gzip.length / 1048576).toFixed(2)} MiB, ${((performance.now() - start) / 1000).toFixed(1)} s`,
    );
  }
  // Publish only after every aircraft succeeds. Old hashed assets can still serve an existing open page.
  await writeFile(resolve(output, "manifest.json.tmp"), JSON.stringify(assets, null, 2) + "\n");
  await rename(resolve(output, "manifest.json.tmp"), resolve(output, "manifest.json"));
} finally {
  await server.close();
}
