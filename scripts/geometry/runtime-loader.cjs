/** Next/Turbopack loader: compiler output must match this exact source input. */
const { readFileSync } = require("node:fs");
const { relative, resolve } = require("node:path");
const { createHash } = require("node:crypto");

module.exports = function geometryRuntimeLoader(source) {
  const { root } = this.getOptions();
  const path = relative(root, this.resourcePath).replaceAll("\\", "/");
  const manifestPath = resolve(root, ".geometry-runtime/sources.json");
  this.addDependency(manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entry = manifest[path];
  if (!entry) return source;
  const hash = createHash("sha256").update(source).digest("hex");
  if (hash !== entry.sourceDigest)
    throw new Error(`Geometry compiler output is stale for ${path}; run npm run geometry:build`);
  const outputPath = resolve(root, ".geometry-runtime", entry.path);
  this.addDependency(outputPath);
  return readFileSync(outputPath, "utf8");
};
