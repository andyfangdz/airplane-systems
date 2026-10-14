import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

// The Playwright shot config and scripts these spawn, and the source files the config reads. Listing them to Vite (never
// loading them) makes them dependencies, so `vitest --changed` reruns this file when they change.
import.meta.glob([
  "../playwright.shots.config.mjs",
  "../scripts/shot*.mjs",
  "../lib/systems.ts",
  "../aircraft/*/systems.ts",
]);

describe("shot script entry point", () => {
  it("enumerates each requested camera once through the Playwright config", () => {
    const root = resolve(import.meta.dirname, "..");
    const result = spawnSync(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.shots.config.mjs", "--list"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, SHOT_ARGS: JSON.stringify(["sr20/overview", "--cam", "top,side,top"]) },
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("sr20/overview (top)");
    expect(result.stdout).toContain("sr20/overview (side)");
    expect(result.stdout).toContain("Total: 2 tests");
  }, 30_000);
  it("validates arguments when invoked directly or through a symlink", () => {
    const root = resolve(import.meta.dirname, "..");
    mkdirSync(join(root, ".shots"), { recursive: true });
    const scratch = mkdtempSync(join(root, ".shots", "entry-test-"));
    try {
      const link = join(scratch, "linked-worktree");
      symlinkSync(root, link, "dir");
      for (const script of [join(root, "scripts/shot.mjs"), join(link, "scripts/shot.mjs")]) {
        const result = spawnSync(process.execPath, [script, "--cam", "bogus"], { encoding: "utf8" });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("--cam requires a comma-separated list");
      }
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });
});
