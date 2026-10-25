import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { seal, verify, cacheControl, contentType } from "../scripts/release-manifest.mjs";
import { activation } from "../scripts/activate-release.mjs";
import type { ReleaseManifest } from "../scripts/release-manifest.mjs";

let root: string;
let out: string;
const npm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "release-test-"));
  out = join(root, "out");
  await mkdir(join(out, "geometry"), { recursive: true });
  await writeFile(join(root, ".gitignore"), "out/\n");
  await writeFile(join(root, "package-lock.json"), "{}\n");
  await writeFile(join(root, ".node-version"), process.version.slice(1) + "\n");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      engines: { node: `${process.versions.node.split(".")[0]}.x`, npm: `${npm.split(".")[0]}.x` },
      packageManager: `npm@${npm}`,
    }),
  );
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture");
  await writeFile(join(out, "index.html"), "index");
  await writeFile(join(out, "404.html"), "404");
  const geometry = `sr20-${createHash("sha256").update("compressed fixture").digest("hex").slice(0, 20)}.bin.gz`;
  await writeFile(join(out, "geometry", geometry), "compressed fixture");
  await writeFile(join(out, "geometry", "manifest.json"), JSON.stringify({ sr20: `/geometry/${geometry}` }));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function alterManifest(edit: (manifest: ReleaseManifest) => void) {
  const manifest = JSON.parse(await readFile(join(out, "release-manifest.json"), "utf8"));
  edit(manifest);
  await writeFile(join(out, "release-manifest.json"), JSON.stringify(manifest));
}

it("seals source/toolchain and exact delivery bytes; the digest is independently verifiable", async () => {
  const sealed = await seal(out, root);
  expect(sealed.manifest.source.dirty).toBe(false);
  expect(sealed.manifest.toolchain.node).toBe(process.version);
  const bytes = await readFile(join(out, "release-manifest.json"));
  expect(sealed.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(await verify(out, { sha256: sealed.sha256, commit: sealed.manifest.source.commit, clean: true })).toEqual(
    sealed,
  );
  expect(cacheControl(`geometry/sr20-${"a".repeat(20)}.bin.gz`)).toContain("immutable");
  expect(cacheControl("geometry/manifest.json")).toBe("public, max-age=60");
  expect(cacheControl(`geometry/sr20-${"a".repeat(20)}.scene.json`)).toContain("immutable");
  expect(cacheControl(`geometry/recovery-${"a".repeat(20)}.js`)).toContain("immutable");
  expect(cacheControl("geometry/runtime.json")).toBe("public, max-age=60");
});

it("refuses changed bytes, added files, altered manifests and mismatched source identity", async () => {
  const sealed = await seal(out, root);
  await expect(verify(out, { commit: "0".repeat(40) })).rejects.toThrow("source commit mismatch");
  await expect(verify(out, { tree: "0".repeat(40) })).rejects.toThrow("source tree mismatch");
  await expect(verify(out, { lockSha256: "0".repeat(64) })).rejects.toThrow("source lockSha256 mismatch");
  await expect(verify(out, { sha256: "0".repeat(64) })).rejects.toThrow("manifest SHA256 mismatch");
  await writeFile(join(out, "index.html"), "tampered");
  await expect(verify(out, { sha256: sealed.sha256 })).rejects.toThrow("checksum mismatch");
  await writeFile(join(out, "index.html"), "index");
  await writeFile(join(out, "surprise.js"), "extra");
  await expect(verify(out)).rejects.toThrow("inventory mismatch");
});

it("seals mutable PWA entry points and retained offline snapshots with their exact delivery policy", async () => {
  const snapshot = `_next/static/offline/${"a".repeat(64)}/sr20.rsc`;
  await mkdir(join(out, "_next/static/offline", "a".repeat(64)), { recursive: true });
  for (const path of ["sw.js", "manifest.webmanifest", "offline-manifest.json", snapshot])
    await writeFile(join(out, path), "fixture");
  const sealed = await seal(out, root);
  expect(await verify(out)).toEqual(sealed);
  for (const path of ["sw.js", "manifest.webmanifest", "offline-manifest.json"]) {
    expect(cacheControl(path)).toBe("no-cache");
    expect(sealed.manifest.files.find((file) => file.path === path)?.cache).toBe("revalidate");
  }
  expect(contentType("sw.js")).toBe("text/javascript");
  expect(contentType("manifest.webmanifest")).toBe("application/manifest+json");
  expect(contentType(snapshot)).toBe("text/x-component");
  expect(cacheControl(snapshot)).toBe("public, max-age=31536000, immutable");
  await alterManifest((manifest) => {
    manifest.files.find((file) => file.path === "sw.js")!.cache = "short";
  });
  await expect(verify(out)).rejects.toThrow("delivery policy mismatch: sw.js");
});

it.each([
  "../secret",
  "/etc/passwd",
  "geometry/../../secret",
  "geometry\\secret",
  "geometry/%2e%2e/secret",
  "x?y",
  "x#y",
  "x\n",
])("rejects hostile manifest path %j before reading referenced files", async (path) => {
  await seal(out, root);
  await alterManifest((manifest) => {
    manifest.files[0].path = path;
  });
  await expect(verify(out)).rejects.toThrow("Invalid release file entry");
});

it("rejects malformed, duplicate, missing and incorrectly classified manifest entries", async () => {
  await seal(out, root);
  await alterManifest((manifest) => {
    manifest.files.push(manifest.files[0]);
  });
  await expect(verify(out)).rejects.toThrow("inventory mismatch");
  await seal(out, root);
  await alterManifest((manifest) => {
    manifest.files[0].cache = "immutable";
  });
  await expect(verify(out)).rejects.toThrow("delivery policy mismatch");
  await seal(out, root);
  await alterManifest((manifest) => {
    manifest.files = manifest.files.filter((file) => file.path !== "index.html");
  });
  await rm(join(out, "index.html"));
  await expect(verify(out)).rejects.toThrow("Static release missing index.html");
  await writeFile(join(out, "release-manifest.json"), "null");
  await expect(verify(out)).rejects.toThrow("Unsupported release manifest");
});

it("rejects a manifest symlink and any symbolic link added after sealing", async () => {
  await seal(out, root);
  await symlink(join(root, "package-lock.json"), join(out, "escape"));
  await expect(verify(out)).rejects.toThrow("symbolic link");
  await rm(join(out, "escape"));
  await rm(join(out, "release-manifest.json"));
  await symlink(join(root, "package-lock.json"), join(out, "release-manifest.json"));
  await expect(verify(out)).rejects.toThrow("manifest must be a regular file");
});

it("enforces the selected source's exact build toolchain", async () => {
  await seal(out, root);
  await expect(verify(out, { nodeVersion: "v0.0.0" })).rejects.toThrow("Node toolchain mismatch");
  await expect(verify(out, { npmVersion: "0.0.0" })).rejects.toThrow("npm toolchain mismatch");
  await writeFile(join(root, ".node-version"), "0.0.0\n");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ engines: { node: "0.0.0", npm }, packageManager: `npm@${npm}` }),
  );
  await expect(seal(out, root)).rejects.toThrow("Build toolchain must match source pins");
});

it("enforces the exact npm pin even when engines allow its major", async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const [major, minor, patch] = npm.split(".");
  pkg.packageManager = `npm@${major}.${minor}.${Number(patch) + 1}`;
  await writeFile(join(root, "package.json"), JSON.stringify(pkg));
  await expect(seal(out, root)).rejects.toThrow("Build toolchain must match source pins");
});

it.each(["node", "npm"])("rejects an incompatible %s engine declaration", async (engine) => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  pkg.engines[engine] = "0.x";
  await writeFile(join(root, "package.json"), JSON.stringify(pkg));
  await expect(seal(out, root)).rejects.toThrow("compatible with engines");
});

it.each(["npm@11.x", "npm@latest", "pnpm@11.19.1", ""])("rejects a non-exact npm pin %j", async (packageManager) => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  pkg.packageManager = packageManager;
  await writeFile(join(root, "package.json"), JSON.stringify(pkg));
  await expect(seal(out, root)).rejects.toThrow("Source must pin exact Node and npm versions");
});

it("rejects geometry filenames that disagree with their bytes or CloudFront routing", async () => {
  const badName = `sr20-${"0".repeat(20)}.bin.gz`;
  await writeFile(join(out, "geometry", badName), "misnamed");
  await seal(out, root);
  await expect(verify(out)).rejects.toThrow("Geometry content address mismatch");
  await rm(join(out, "geometry", badName));
  await writeFile(join(out, "geometry", `wrong-${"x".repeat(20)}.js`), "wrong");
  await seal(out, root);
  await expect(verify(out)).rejects.toThrow("Unexpected geometry asset path");
});

it("refuses dirty source promotion, missing geometry and symlinks", async () => {
  await writeFile(join(root, "package-lock.json"), "changed");
  await seal(out, root);
  await expect(verify(out, { clean: true })).rejects.toThrow("dirty source");
  await writeFile(
    join(out, "geometry", "manifest.json"),
    JSON.stringify({ sr20: `/geometry/sr20-${"b".repeat(20)}.bin.gz` }),
  );
  await seal(out, root);
  await expect(verify(out)).rejects.toThrow("missing or unhashed");
  await symlink(join(root, "package-lock.json"), join(out, "escape"));
  await expect(seal(out, root)).rejects.toThrow("symbolic link");
});

it("rejects a runtime manifest that references a missing recovery bundle", async () => {
  const geometry = JSON.parse(await readFile(join(out, "geometry/manifest.json"), "utf8"));
  await writeFile(
    join(out, "geometry/runtime.json"),
    JSON.stringify({
      version: 1,
      recovery: `/geometry/recovery-${"b".repeat(20)}.js`,
      aircraft: { sr20: { geometry: geometry.sr20, scene: `/geometry/sr20-${"a".repeat(20)}.scene.json` } },
    }),
  );
  await seal(out, root);
  await expect(verify(out)).rejects.toThrow("Runtime manifest references a missing");
});

it("activates one complete release conditionally without moving immutable asset origins", () => {
  const input = {
    ETag: "previous",
    DistributionConfig: {
      Origins: {
        Items: [
          { Id: "site-bucket", DomainName: "bucket" },
          { Id: "site-assets", DomainName: "bucket" },
        ],
      },
      DefaultCacheBehavior: { TargetOriginId: "site-bucket" },
      CacheBehaviors: {
        Items: ["/_next/static/*", "/geometry/*-????????????????????.*"].map((PathPattern) => ({
          PathPattern,
          TargetOriginId: "site-assets",
          CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
        })),
      },
    },
  };
  const release = `${"a".repeat(40)}-${"b".repeat(64)}`;
  const result = activation(input, release);
  expect(result.etag).toBe("previous");
  expect(result.config.Origins.Items[0].OriginPath).toBe(`/releases/${release}`);
  expect(result.config.Origins.Items[1]).not.toHaveProperty("OriginPath");
  expect(input.DistributionConfig.Origins.Items[0]).not.toHaveProperty("OriginPath");
  const shadowed = structuredClone(input);
  shadowed.DistributionConfig.CacheBehaviors.Items.unshift({
    PathPattern: "/geometry/*",
    TargetOriginId: "site-bucket",
    CachePolicyId: "short",
  });
  expect(() => activation(shadowed, release)).toThrow("Unexpected cache behavior inventory");
  const shortCache = structuredClone(input);
  shortCache.DistributionConfig.CacheBehaviors.Items[1].CachePolicyId = "short";
  expect(() => activation(shortCache, release)).toThrow("Missing immutable asset origin behavior");
  input.DistributionConfig.CacheBehaviors.Items.pop();
  expect(() => activation(input, release)).toThrow("Missing immutable asset origin");
  expect(() => activation(input, "../../other")).toThrow("Invalid release identifier");
});
