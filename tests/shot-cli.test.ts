import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// The Playwright shot config and scripts these spawn, and the source files the config reads. Listing them to Vite (never
// loading them) makes them dependencies, so `vitest --changed` reruns this file when they change.
import.meta.glob(["../playwright.shots.config.mjs", "../scripts/shot*.mjs", "../aircraft/views.json"]);

const root = resolve(import.meta.dirname, "..");
const artifacts = join(root, ".shots/test-results");
let temporary: string, references: string, alias: string;
beforeAll(() => {
  temporary = mkdtempSync(join(tmpdir(), "airplane-shot-cli-"));
  mkdirSync(artifacts, { recursive: true });
  references = mkdtempSync(join(artifacts, "saved-references-"));
  writeFileSync(join(references, "saved.png"), "saved reference");
  alias = join(temporary, "references-alias");
  symlinkSync(references, alias, "dir");
});
afterAll(() => {
  rmSync(references, { recursive: true, force: true });
  rmSync(temporary, { recursive: true, force: true });
});

function listViews(args: string[]) {
  return spawnSync(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.shots.config.mjs", "--list"],
    { cwd: root, encoding: "utf8", env: { ...process.env, SHOT_ARGS: JSON.stringify(args) } },
  );
}

it("rejects comparison references in runner artifacts before cleanup, including directory aliases", () => {
  for (const directory of [artifacts, references, alias]) {
    const result = listViews(["sr20/electrical", "--compare", directory]);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("--compare cannot use Playwright's artifact directory");
    expect(readFileSync(join(references, "saved.png"), "utf8")).toBe("saved reference");
  }
}, 30_000);

it("rejects saving screenshots beneath runner artifacts, including new paths below an alias", () => {
  for (const directory of [artifacts, join(alias, "new-screenshots")]) {
    const result = listViews(["sr20/electrical", "--out", directory]);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("--out cannot use Playwright's artifact directory");
  }
}, 30_000);

it("keeps overlapping view selections usable and allows sibling reference directories", () => {
  const result = listViews(["sr20/electrical", "sr20/electrical", "--compare", artifacts + "-backup"]);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain("Total: 1 test");
}, 30_000);

it("rejects output and reference aliases for the same directory", () => {
  const directory = join(temporary, "baseline");
  const baselineAlias = join(temporary, "baseline-alias");
  mkdirSync(directory);
  symlinkSync(directory, baselineAlias, "dir");
  const result = listViews(["sr20/electrical", "--out", directory, "--compare", baselineAlias]);
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain("different directories to preserve reference images");
}, 30_000);
