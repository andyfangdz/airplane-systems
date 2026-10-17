import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The scripts these spawn. Listing them to Vite (never loading them) makes them dependencies, so `vitest --changed`
// reruns this file when they change.
import.meta.glob(["../scripts/activate-release.mjs", "../scripts/release-manifest.mjs", "../scripts/smoke.mjs"]);

// Node resolves a main module's import.meta.url through symbolic links but leaves process.argv[1] as typed, so an
// entry check comparing the two must not skip the script when it runs from a linked path (macOS links /tmp and
// /var/folders, where deploy-aws.sh stages its source tree). Each case's arguments make the script fail loudly.
describe("release script entry points", () => {
  it.each([
    [
      "activate-release.mjs",
      (scratch: string) => [join(scratch, "distribution.json"), "bogus"],
      1,
      "Invalid release identifier",
    ],
    ["release-manifest.mjs", () => [], 1, "Usage: release-manifest.mjs seal|verify"],
    ["smoke.mjs", () => [], 2, "usage: npm run smoke"],
  ])("%s runs when invoked directly or through a symlink", (name, args, status, message) => {
    const root = resolve(import.meta.dirname, "..");
    const scratch = mkdtempSync(join(tmpdir(), "release-entry-test-"));
    try {
      const link = join(scratch, "linked-worktree");
      symlinkSync(root, link, "dir");
      writeFileSync(join(scratch, "distribution.json"), "{}");
      for (const script of [join(root, "scripts", name), join(link, "scripts", name)]) {
        const result = spawnSync(process.execPath, [script, ...args(scratch)], { encoding: "utf8" });
        expect(result.error).toBeUndefined();
        expect(result.status, script).toBe(status);
        expect(result.stderr, script).toContain(message);
      }
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });
});
