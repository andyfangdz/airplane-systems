#!/usr/bin/env node
/** Seal and verify a static release. The manifest digest is recorded separately by CI and supplied at promotion. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

export const MANIFEST = "release-manifest.json";
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const immutable = (path) =>
  path.startsWith("_next/static/") || /^geometry\/[a-z0-9-]+-[a-f0-9]{20}\.(?:bin\.gz|scene\.json|js)$/.test(path);
export const cacheControl = (path) => (immutable(path) ? "public, max-age=31536000, immutable" : "public, max-age=60");
export const contentType = (path) =>
  ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".glb": "model/gltf-binary",
  })[extname(path)] ?? "application/octet-stream";

async function files(root, directory = "") {
  const result = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (path === MANIFEST) continue;
    if (entry.isSymbolicLink()) throw new Error(`Release contains a symbolic link: ${path}`);
    if (entry.isDirectory()) result.push(...(await files(root, path)));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`Release contains a non-regular file: ${path}`);
  }
  return result.sort();
}

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

async function sourceToolchain(repository) {
  const nodeVersion = (await readFile(join(repository, ".node-version"), "utf8")).trim();
  const pkg = JSON.parse(await readFile(join(repository, "package.json"), "utf8"));
  const npmVersion = /^npm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? "")?.[1];
  // Exact build pins are separate from the supported majors advertised to managed hosts.
  const matchesEngine = (engine, version) => engine === version || engine === `${version.split(".")[0]}.x`;
  if (
    !/^\d+\.\d+\.\d+$/.test(nodeVersion) ||
    !npmVersion ||
    !matchesEngine(pkg.engines?.node, nodeVersion) ||
    !matchesEngine(pkg.engines?.npm, npmVersion)
  )
    throw new Error("Source must pin exact Node and npm versions compatible with engines");
  return { nodeVersion: `v${nodeVersion}`, npmVersion };
}

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validPath = (value) =>
  typeof value === "string" &&
  !/[\\\x00-\x1f\x7f%?#]/.test(value) &&
  value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

function validateManifest(manifest) {
  if (!object(manifest) || manifest.version !== 1 || !Array.isArray(manifest.files))
    throw new Error("Unsupported release manifest");
  if (
    !object(manifest.source) ||
    !/^[a-f0-9]{40}$/.test(manifest.source.commit ?? "") ||
    !/^[a-f0-9]{40}$/.test(manifest.source.tree ?? "") ||
    typeof manifest.source.dirty !== "boolean" ||
    !hash(manifest.source.lockSha256)
  )
    throw new Error("Invalid release source identity");
  if (
    !object(manifest.toolchain) ||
    !/^v\d+\.\d+\.\d+$/.test(manifest.toolchain.node ?? "") ||
    !/^\d+\.\d+\.\d+$/.test(manifest.toolchain.npm ?? "") ||
    !manifest.toolchain.platform ||
    !manifest.toolchain.arch
  )
    throw new Error("Release must record its exact toolchain");
  for (const file of manifest.files)
    if (
      !object(file) ||
      !validPath(file.path) ||
      file.path === MANIFEST ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !hash(file.sha256)
    )
      throw new Error("Invalid release file entry");
}

export async function seal(directory, repository = resolve(import.meta.dirname, "..")) {
  const root = resolve(directory);
  const { nodeVersion, npmVersion } = await sourceToolchain(repository);
  const npm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  if (process.version !== nodeVersion || npm !== npmVersion)
    throw new Error(`Build toolchain must match source pins: Node ${nodeVersion}, npm ${npmVersion}`);
  const paths = await files(root);
  for (const path of ["index.html", "404.html", "geometry/manifest.json"]) {
    if (!paths.includes(path)) throw new Error(`Static release missing ${path}`);
  }
  const manifest = {
    version: 1,
    source: {
      commit: git(repository, "rev-parse", "HEAD"),
      tree: git(repository, "rev-parse", "HEAD^{tree}"),
      dirty: git(repository, "status", "--porcelain", "--untracked-files=normal") !== "",
      lockSha256: digest(await readFile(join(repository, "package-lock.json"))),
    },
    toolchain: {
      node: process.version,
      npm,
      platform: process.platform,
      arch: process.arch,
    },
    files: await Promise.all(
      paths.map(async (path) => {
        const bytes = await readFile(join(root, path));
        return {
          path,
          bytes: bytes.length,
          sha256: digest(bytes),
          cache: immutable(path) ? "immutable" : "short",
          contentType: contentType(path),
        };
      }),
    ),
  };
  validateManifest(manifest);
  const bytes = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(join(root, `${MANIFEST}.tmp`), bytes);
  await rename(join(root, `${MANIFEST}.tmp`), join(root, MANIFEST));
  return { manifest, sha256: digest(bytes) };
}

export async function verify(
  directory,
  { sha256, commit, tree, lockSha256, nodeVersion, npmVersion, clean = false } = {},
) {
  const root = resolve(directory);
  if (!(await lstat(join(root, MANIFEST))).isFile()) throw new Error("Release manifest must be a regular file");
  const bytes = await readFile(join(root, MANIFEST));
  if (sha256 && digest(bytes) !== sha256) throw new Error("Release manifest SHA256 mismatch");
  const manifest = JSON.parse(bytes);
  validateManifest(manifest);
  for (const [key, expected] of Object.entries({ commit, tree, lockSha256 }))
    if (expected && manifest.source?.[key] !== expected) throw new Error(`Release source ${key} mismatch`);
  if (clean && manifest.source?.dirty !== false) throw new Error("Refusing a release built from a dirty source tree");
  if (nodeVersion && manifest.toolchain.node !== nodeVersion) throw new Error("Release Node toolchain mismatch");
  if (npmVersion && manifest.toolchain.npm !== npmVersion) throw new Error("Release npm toolchain mismatch");
  const actual = await files(root);
  for (const path of ["index.html", "404.html", "geometry/manifest.json"])
    if (!actual.includes(path)) throw new Error(`Static release missing ${path}`);
  const expected = manifest.files.map((file) => file.path);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Release file inventory mismatch");
  for (const file of manifest.files) {
    const data = await readFile(join(root, file.path));
    if (data.length !== file.bytes || digest(data) !== file.sha256)
      throw new Error(`Release checksum mismatch: ${file.path}`);
    if (file.cache !== (immutable(file.path) ? "immutable" : "short") || file.contentType !== contentType(file.path))
      throw new Error(`Release delivery policy mismatch: ${file.path}`);
    const geometryHash = /^geometry\/[a-z0-9-]+-([a-f0-9]{20})\.(?:bin\.gz|scene\.json)$/.exec(file.path)?.[1];
    if (geometryHash && geometryHash !== file.sha256.slice(0, 20))
      throw new Error(`Geometry content address mismatch: ${file.path}`);
    if (
      file.path.startsWith("geometry/") &&
      !immutable(file.path) &&
      !["geometry/manifest.json", "geometry/runtime.json"].includes(file.path)
    )
      throw new Error(`Unexpected geometry asset path: ${file.path}`);
  }
  const geometry = JSON.parse(await readFile(join(root, "geometry/manifest.json"), "utf8"));
  if (!object(geometry) || !Object.keys(geometry).length) throw new Error("Invalid geometry inventory");
  for (const path of Object.values(geometry)) {
    if (
      typeof path !== "string" ||
      !/^\/geometry\/[a-z0-9-]+-[a-f0-9]{20}\.bin\.gz$/.test(path) ||
      !actual.includes(path.slice(1))
    )
      throw new Error(`Geometry manifest references a missing or unhashed asset: ${path}`);
  }
  if (actual.includes("geometry/runtime.json")) {
    const runtime = JSON.parse(await readFile(join(root, "geometry/runtime.json"), "utf8"));
    if (!object(runtime) || !object(runtime.aircraft) || !Object.values(runtime.aircraft).every(object))
      throw new Error("Invalid runtime inventory");
    const references = [
      runtime.recovery,
      ...Object.values(runtime.aircraft ?? {}).flatMap((entry) => [entry.geometry, entry.scene]),
    ];
    if (
      runtime.version !== 1 ||
      Object.keys(runtime.aircraft ?? {})
        .sort()
        .join() !== Object.keys(geometry).sort().join()
    )
      throw new Error("Runtime and geometry aircraft inventories disagree");
    for (const path of references)
      if (
        typeof path !== "string" ||
        !path.startsWith("/geometry/") ||
        !immutable(path.slice(1)) ||
        !actual.includes(path.slice(1))
      )
        throw new Error(`Runtime manifest references a missing or unhashed asset: ${path}`);
    for (const [id, entry] of Object.entries(runtime.aircraft))
      if (entry.geometry !== geometry[id]) throw new Error(`Runtime and geometry assets disagree: ${id}`);
  }
  return { manifest, sha256: digest(bytes) };
}

async function main() {
  const [command, directory, sha256, commit, tree, lockSha256] = process.argv.slice(2);
  if (!directory || !["seal", "verify"].includes(command))
    throw new Error("Usage: release-manifest.mjs seal|verify <directory> [manifest-sha256 commit tree lock-sha256]");
  const result =
    command === "seal"
      ? await seal(directory)
      : await verify(directory, {
          sha256,
          commit,
          tree,
          lockSha256,
          clean: Boolean(commit),
          ...(commit ? await sourceToolchain(resolve(import.meta.dirname, "..")) : {}),
        });
  console.log(
    JSON.stringify({
      sha256: result.sha256,
      commit: result.manifest.source.commit,
      files: result.manifest.files.length,
    }),
  );
}
if (import.meta.main)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
