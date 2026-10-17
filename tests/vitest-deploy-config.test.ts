// vitest: isolate
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";
import type { ViteUserConfig } from "vitest/config";

import.meta.glob(["../vitest.deploy.config.mts", "../vitest.config.mts"]);

describe("opt-in deployment test configuration", () => {
  it("selects only deployment tests without inherited projects overriding selection", async () => {
    const env = { command: "serve" as const, mode: "test" };
    const deploy = (await loadConfigFromFile(env, "vitest.deploy.config.mts"))!.config as ViteUserConfig;
    const defaults = (await loadConfigFromFile(env, "vitest.config.mts"))!.config as ViteUserConfig;
    expect(deploy.test?.projects).toBeUndefined();
    expect(deploy.test?.include).toEqual(["tests/deploy-aws*.test.ts"]);
    expect(deploy.test?.exclude).not.toContain("tests/deploy-aws*.test.ts");
    for (const project of defaults.test?.projects ?? []) {
      expect(project).toMatchObject({ test: { exclude: expect.arrayContaining(["tests/deploy-aws*.test.ts"]) } });
    }
    expect(defaults.test?.projects?.length).toBeGreaterThan(0);
    const files = execFileSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "list", "--config", "vitest.deploy.config.mts", "--filesOnly"],
      { encoding: "utf8", timeout: 30_000 },
    )
      .trim()
      .split("\n")
      .map((file) => file.trim());
    const expected = readdirSync("tests")
      .filter((file) => /^deploy-aws.*\.test\.ts$/.test(file))
      .map((file) => `tests/${file}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(files.map((file) => file.replace(`${process.cwd()}/`, "")).sort()).toEqual(expected.sort());
  }, 60_000);
});
