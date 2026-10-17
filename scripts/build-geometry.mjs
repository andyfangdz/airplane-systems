#!/usr/bin/env node
/** Compile source definitions, static geometry and runtime bindings; recovery is a separate on-demand bundle. */
import { mkdir, readFile, writeFile, rename, access, readdir, unlink } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, relative, resolve } from "node:path";
import { build, createServer } from "vite";
import ts from "typescript";
import { digest, specializeSource } from "./geometry/specialize.mjs";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/geometry");
const generated = resolve(root, ".geometry-runtime");
const server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, watch: null, ws: false },
  optimizeDeps: { noDiscovery: true },
});
try {
  await compile();
} finally {
  await server.close();
}

async function compile() {
  const { AIRCRAFT_IDS: ids } = await server.ssrLoadModule("/lib/systems.ts");
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(
    ids.map((id) => resolve(root, `aircraft/${id}/parts/index.ts`)),
    parsed.options,
  );
  const sourceFiles = program
    .getSourceFiles()
    .filter((file) => file.fileName.startsWith(root) && !file.fileName.includes("/node_modules/"));
  const sourceMap = new Map(sourceFiles.map((file) => [resolve(file.fileName), file]));
  const compilerFiles = [
    "scripts/build-geometry.mjs",
    "scripts/geometry/specialize.mjs",
    "scripts/geometry/runtime-loader.cjs",
    "lib/mesh/encode.ts",
    "lib/mesh/format.ts",
    "lib/mesh/scene-manifest.ts",
    "authoring/scene-manifest.ts",
    "package-lock.json",
  ];
  const compilerKey = digest(
    JSON.stringify([
      process.version,
      ...(await Promise.all(compilerFiles.map(async (path) => [path, await readFile(resolve(root, path), "utf8")]))),
    ]),
  );
  const inputs = Object.fromEntries([
    ...sourceFiles.map((file) => [relative(root, file.fileName), digest(file.text)]),
    ...(await Promise.all(
      [...compilerFiles, "tsconfig.json", "authoring/geometry-recovery.worker.ts"].map(async (path) => [
        path,
        digest(await readFile(resolve(root, path))),
      ]),
    )),
  ]);
  const exists = async (path) =>
    access(path).then(
      () => true,
      () => false,
    );
  const previous = await readFile(resolve(generated, "cache.json"), "utf8").then(JSON.parse, () => ({}));
  const cache = { aircraft: {} };

  // Follow actual TypeScript imports before construction. A hit avoids mesh construction and encoding.
  function definitionDigest(entry) {
    const files = new Map();
    const visit = (path) => {
      const file = sourceMap.get(path);
      if (!file || files.has(path)) return;
      files.set(path, file.text);
      for (const imported of ts.preProcessFile(file.text).importedFiles) {
        const module = ts.resolveModuleName(imported.fileName, path, parsed.options, ts.sys).resolvedModule;
        if (module) visit(resolve(module.resolvedFileName));
      }
    };
    visit(entry);
    return digest(
      compilerKey +
        [...files]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([path, text]) => `${relative(root, path)}\0${text}`)
          .join("\0"),
    );
  }

  await mkdir(output, { recursive: true });
  await mkdir(generated, { recursive: true });
  const specialized = {};
  let factories = 0;
  for (const file of sourceFiles) {
    const result = specializeSource(program, file);
    if (!result) continue;
    const path = `sources/${relative(root, file.fileName)}.js`;
    await mkdir(dirname(resolve(generated, path)), { recursive: true });
    await writeFile(resolve(generated, path), result.code);
    specialized[relative(root, file.fileName).replaceAll("\\", "/")] = { path, sourceDigest: result.sourceDigest };
    factories += result.changes;
  }
  await writeFile(resolve(generated, "sources.json"), JSON.stringify(specialized));
  console.log(`Runtime specialization: ${factories} authoring factories in ${Object.keys(specialized).length} modules`);

  // Execute the exact specialized modules before publishing assets. Unit tests of authored modules cannot catch
  // erased forwarding arguments or registration-time dependencies introduced by a compiler transform.
  const runtimeServer = await createServer({
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [
      {
        name: "compiled-catalogue-verification",
        enforce: "pre",
        async load(id) {
          const path = relative(root, id.split("?")[0]).replaceAll("\\", "/");
          const entry = specialized[path];
          return entry ? readFile(resolve(generated, entry.path), "utf8") : null;
        },
      },
    ],
  });
  const presentation = (cat) =>
    JSON.stringify(
      Object.fromEntries(
        ["shells", "surfaces", "parts"].map((kind) => [kind, cat[kind].map(({ geo: _, ...record }) => record)]),
      ),
      (_key, value) => (typeof value === "function" ? "<runtime-binding>" : value),
    );
  const geometryState = (geometry) => {
    const arrayState = (attribute) => ({
      itemSize: attribute.itemSize,
      normalized: attribute.normalized,
      type: attribute.array.constructor.name,
      bytes: digest(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)),
    });
    return JSON.stringify({
      type: geometry.type,
      attributes: Object.fromEntries(
        Object.entries(geometry.attributes).map(([name, attribute]) => [name, arrayState(attribute)]),
      ),
      index: geometry.index ? arrayState(geometry.index) : null,
      groups: geometry.groups,
    });
  };
  let dynamicCount = 0;
  try {
    for (const id of ids) {
      const { CAT: authored } = await server.ssrLoadModule(`/aircraft/${id}/parts/index.ts`);
      const { CAT: runtime } = await runtimeServer.ssrLoadModule(`/aircraft/${id}/parts/index.ts`);
      if (presentation(authored) !== presentation(runtime))
        throw new Error(`${id}: specialized catalogue presentation or runtime bindings differ from authoring`);
      for (const part of runtime.parts.filter((part) => part.dynamicGeo)) {
        const original = authored.byId(part.id).geo();
        const specialized = part.geo();
        if (geometryState(original) !== geometryState(specialized))
          throw new Error(`${part.id}: specialized dynamic geometry differs from authoring`);
        original.dispose();
        specialized.dispose();
        dynamicCount++;
      }
    }
    console.log(
      `Runtime registration: ${ids.length} specialized catalogues and ${dynamicCount} dynamic geometries match authoring`,
    );
  } finally {
    await runtimeServer.close();
  }

  const assets = {},
    aircraft = {};
  const { encodeMeshes } = await server.ssrLoadModule("/lib/mesh/encode.ts");
  const { geometryEntries } = await server.ssrLoadModule("/lib/mesh/prebuilt.ts");
  const { compileSceneManifest } = await server.ssrLoadModule("/authoring/scene-manifest.ts");
  for (const id of ids) {
    const hash = definitionDigest(resolve(root, `aircraft/${id}/parts/index.ts`));
    const cached = previous.aircraft?.[id];
    if (
      cached?.definitionDigest === hash &&
      (await exists(resolve(root, `public${cached.geometry}`))) &&
      (await exists(resolve(root, `public${cached.scene}`)))
    ) {
      assets[id] = cached.geometry;
      aircraft[id] = cache.aircraft[id] = cached;
      console.log(`${id}: cached compiled definition`);
      continue;
    }
    const start = performance.now();
    const { CAT } = await server.ssrLoadModule(`/aircraft/${id}/parts/index.ts`);
    const entries = geometryEntries(CAT).map(({ key, spec }) => ({ key, geometry: spec.geo() }));
    const gzip = gzipSync(await encodeMeshes(id, entries));
    const name = `${id}-${digest(gzip).slice(0, 20)}.bin.gz`;
    const path = `/geometry/${name}`;
    const scene = compileSceneManifest(CAT, hash, path, new Map(entries.map(({ key, geometry }) => [key, geometry])));
    const json = JSON.stringify(scene);
    const sceneName = `${id}-${digest(json).slice(0, 20)}.scene.json`;
    await writeFile(resolve(output, name), gzip);
    await writeFile(resolve(output, sceneName), json);
    assets[id] = path;
    aircraft[id] = cache.aircraft[id] = { geometry: path, scene: `/geometry/${sceneName}`, definitionDigest: hash };
    for (const { geometry } of entries) geometry.dispose();
    console.log(
      `${id}: ${entries.length} meshes, ${(gzip.length / 1048576).toFixed(2)} MiB, ${((performance.now() - start) / 1000).toFixed(1)} s`,
    );
  }

  const recoveryEntry = resolve(generated, "recovery-entry.mjs");
  const recoverySource = `import { installRecoveryWorker } from "@/authoring/geometry-recovery.worker";
installRecoveryWorker({${ids.map((id) => `${JSON.stringify(id)}: () => import(${JSON.stringify(`@/aircraft/${id}/parts`)})`).join(",")}});
`;
  await writeFile(recoveryEntry, recoverySource);
  const recoveryKey = digest(
    compilerKey +
      JSON.stringify(aircraft) +
      recoverySource +
      (await readFile(resolve(root, "authoring/geometry-recovery.worker.ts"))),
  );
  let recovery;
  if (
    previous.recoveryKey === recoveryKey &&
    previous.recoveryFiles?.length &&
    (await Promise.all(previous.recoveryFiles.map((path) => exists(resolve(output, path))))).every(Boolean)
  ) {
    recovery = previous.recovery;
    cache.recoveryFiles = previous.recoveryFiles;
    console.log("Authoring recovery: cached");
  } else {
    const bundle = await build({
      configFile: false,
      root,
      publicDir: false,
      logLevel: "warn",
      resolve: { alias: { "@": root } },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        target: "es2022",
        write: false,
        minify: true,
        outDir: output,
        // Library mode leaves native dynamic imports intact; browser preload helpers require document/window.
        lib: { entry: recoveryEntry, formats: ["es"] },
        rollupOptions: {
          input: recoveryEntry,
          output: {
            format: "es",
            hashCharacters: "hex",
            entryFileNames: "recovery-[hash:20].js",
            chunkFileNames: "recovery-[hash:20].js",
          },
          onwarn(warning, fallback) {
            if (warning.code !== "MODULE_LEVEL_DIRECTIVE") fallback(warning);
          },
        },
      },
    });
    const chunks = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((item) => item.output);
    cache.recoveryFiles = chunks.map((chunk) => chunk.fileName);
    for (const chunk of chunks)
      await writeFile(resolve(output, chunk.fileName), chunk.type === "chunk" ? chunk.code : chunk.source);
    recovery = `/geometry/${chunks.find((chunk) => chunk.type === "chunk" && chunk.isEntry).fileName}`;
  }
  cache.recovery = recovery;
  cache.recoveryKey = recoveryKey;
  // Publish only after every compiler output and recovery dependency exists.
  for (const [name, value] of Object.entries({
    "manifest.json": assets,
    "runtime.json": { version: 1, recovery, aircraft },
  })) {
    await writeFile(resolve(output, `${name}.tmp`), JSON.stringify(value, null, 2) + "\n");
    await rename(resolve(output, `${name}.tmp`), resolve(output, name));
  }
  await writeFile(resolve(generated, "cache.json"), JSON.stringify(cache, null, 2));
  await writeFile(resolve(generated, "inputs.json"), JSON.stringify(inputs));
  // The release contains one complete asset graph. The CDN retains previous immutable release assets separately.
  const retained = new Set([
    ...Object.values(aircraft).flatMap(({ geometry, scene }) => [geometry.slice(10), scene.slice(10)]),
    ...cache.recoveryFiles,
  ]);
  for (const name of await readdir(output))
    if (/^[a-z0-9-]+-[a-f0-9]{20}\.(?:bin\.gz|scene\.json|js)$/.test(name) && !retained.has(name))
      await unlink(resolve(output, name));
}
