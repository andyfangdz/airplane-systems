import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import { loadConfigFromFile } from "vite";
import type { ViteUserConfig } from "vitest/config";
import sharedTests from "./setup/shared-tests.json" with { type: "json" };

import.meta.glob("../vitest.config.mts");

it("isolates all unlisted tests and shares only the explicit immutable-suite allowlist", async () => {
  const config = (await loadConfigFromFile({ command: "serve", mode: "test" }, "vitest.config.mts"))!
    .config as ViteUserConfig;
  const projects = config.test!.projects! as {
    test: { name: string; include: string[]; exclude: string[]; isolate: boolean };
  }[];
  const isolated = projects.find((project) => project.test.name === "isolated")!.test;
  const shared = projects.find((project) => project.test.name === "shared")!.test;
  expect(isolated.include).toEqual(["tests/**/*.test.ts"]);
  expect(isolated.isolate).toBe(true);
  expect(shared.include).toEqual(sharedTests);
  expect(shared.isolate).toBe(false);
  expect(isolated.exclude).toEqual(expect.arrayContaining(sharedTests));
  expect(isolated.exclude).not.toContain("tests/future-stateful.test.ts");
  expect(sharedTests).not.toContain("tests/future-stateful.test.ts");
  expect(config.test!.setupFiles).toEqual(["tests/setup/geometry-cache.ts"]);
  expect(config.test!.forceRerunTriggers).toContain("**/tests/setup/shared-tests.json");
});

it("keeps the shared-suite contract sorted, unique and limited to existing test files", () => {
  expect(sharedTests).toEqual([...new Set(sharedTests)].sort());
  for (const file of sharedTests) {
    expect(file.endsWith(".test.ts"), file).toBe(true);
    expect(existsSync(file), file).toBe(true);
  }
});
