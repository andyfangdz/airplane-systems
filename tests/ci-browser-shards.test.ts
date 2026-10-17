import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverTests,
  planShards,
  testKey,
  type BrowserTest,
  type DiscoveryReport,
} from "../scripts/ci-browser-shards.mjs";

// Discovery reads these files in another process; retain dependency tracking for test:changed.
import.meta.glob(["../playwright.config.mjs", "../scripts/test-*-ui.mjs", "../scripts/ci-browser-durations.json"]);

const browsers = { desktop: "chromium", phone: "webkit" };
const report = (): DiscoveryReport => ({
  config: { rootDir: "/repo/scripts" },
  suites: [
    {
      title: "test-example-ui.mjs",
      specs: [{ title: "top-level", file: "test-example-ui.mjs", tests: [{ projectName: "desktop" }] }],
      suites: [
        {
          title: "camera restoration",
          specs: [
            {
              title: "retains orbit",
              file: "test-example-ui.mjs",
              tests: [{ projectName: "desktop" }, { projectName: "phone" }],
            },
          ],
        },
      ],
    },
  ],
});
const browserTest = (title: string, browser = "chromium"): BrowserTest => ({
  project: "desktop",
  file: "scripts/test-example-ui.mjs",
  titlePath: [title],
  browser,
  selector: `[desktop] › test-example-ui.mjs › ${title}`,
});

describe("browser shard discovery and selection", () => {
  it("preserves project and nested describe identities without using source line numbers", () => {
    const tests = discoverTests(report(), browsers, "/repo");
    expect(tests.map((test) => test.selector)).toEqual([
      "[desktop] › test-example-ui.mjs › top-level",
      "[desktop] › test-example-ui.mjs › camera restoration › retains orbit",
      "[phone] › test-example-ui.mjs › camera restoration › retains orbit",
    ]);
    expect(tests.map((test) => test.file)).toEqual(Array(3).fill("scripts/test-example-ui.mjs"));
    expect(new Set(tests.map(testKey)).size).toBe(3);
  });

  it("fails discovery errors, empty suites, unknown browsers and duplicate identities", () => {
    expect(() => discoverTests({ ...report(), errors: ["syntax error"] }, browsers, "/repo")).toThrow(
      "discovery failed",
    );
    expect(() => discoverTests({ ...report(), suites: [] }, browsers, "/repo")).toThrow("no tests");
    expect(() => discoverTests(report(), {}, "/repo")).toThrow("unsupported browser");
    const duplicate = report();
    duplicate.suites.push(duplicate.suites[0]);
    expect(() => discoverTests(duplicate, browsers, "/repo")).toThrow("Duplicate discovered test");
  });

  it.each([" leading space", "trailing space ", "contains › delimiter", "two\nlines"])(
    "rejects a title that Playwright cannot select exactly: %j",
    (title) => {
      const invalid = report();
      invalid.suites[0].specs![0].title = title;
      expect(() => discoverTests(invalid, browsers, "/repo")).toThrow("Cannot represent test identity");
    },
  );
});

describe("duration-based browser sharding", () => {
  it("balances long cases first and includes unknown cases exactly once", () => {
    const tests = [browserTest("long"), browserTest("medium"), browserTest("short"), browserTest("new", "webkit")];
    const durations = [
      { ...tests[0], seconds: 100 },
      { ...tests[1], seconds: 70 },
      { ...tests[2], seconds: 20 },
      { ...browserTest("deleted test"), seconds: 500 },
    ];
    const plan = planShards(tests, durations, 2);
    expect(plan.shards.map((shard) => shard.estimatedDurationMs)).toEqual([120_000, 130_000]);
    expect(plan.unknownTestCount).toBe(1);
    expect(plan.shards[1].browsers).toEqual(["chromium", "webkit"]);
    expect(plan.shards.flatMap((shard) => shard.tests.map(testKey)).sort()).toEqual(tests.map(testKey).sort());
    expect(planShards([...tests].reverse(), durations, 2)).toEqual(plan);
  });

  it("does not confuse titles containing the old timing-key delimiter", () => {
    const a = browserTest("one::two");
    const b = { ...browserTest("two"), file: "scripts/test-example-ui.mjs::one" };
    const plan = planShards([a, b], [{ ...a, seconds: 10 }], 2);
    expect(plan.unknownTestCount).toBe(1);
    expect(plan.shards.map((shard) => shard.estimatedDurationMs)).toEqual([60_000, 10_000]);
  });

  it("rejects duplicate cases or timings and invalid scheduling inputs", () => {
    const test = browserTest("case");
    expect(() => planShards([test, test], [], 1)).toThrow("Duplicate discovered test");
    expect(() =>
      planShards(
        [test],
        [
          { ...test, seconds: 1 },
          { ...test, seconds: 2 },
        ],
        1,
      ),
    ).toThrow("Duplicate recorded");
    for (const count of [0, 1.5, 2, NaN]) expect(() => planShards([test], [], count)).toThrow("Shard count");
    expect(() => planShards([test], [{ ...test, seconds: -1 }], 1)).toThrow("Invalid recorded duration");
    expect(() => planShards([test], [], 1, 0)).toThrow("Invalid fallback duration");
  });
});

it("round-trips all real discovered cases through Playwright's exact test-list selector", () => {
  const directory = mkdtempSync(join(tmpdir(), "browser-shards-"));
  const list = (extra: string[] = []): DiscoveryReport =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ["node_modules/playwright/cli.js", "test", "--list", "--reporter=json", ...extra],
        {
          cwd: resolve(import.meta.dirname, ".."),
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
          env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: "", PLAYWRIGHT_JSON_OUTPUT_NAME: "" },
        },
      ),
    );
  try {
    const discovery = list();
    // Browser choice is irrelevant to selector coverage; projects come from the real report.
    const projects = new Set<string>();
    const collect = (suite: DiscoveryReport["suites"][number]) => {
      for (const spec of suite.specs ?? []) for (const test of spec.tests) projects.add(test.projectName);
      for (const child of suite.suites ?? []) collect(child);
    };
    discovery.suites.forEach(collect);
    const projectBrowsers = Object.fromEntries([...projects].map((project) => [project, "chromium"]));
    const tests = discoverTests(discovery, projectBrowsers);
    const durations = JSON.parse(
      readFileSync(new URL("../scripts/ci-browser-durations.json", import.meta.url), "utf8"),
    );
    const plan = planShards(tests, durations.tests, 16);
    const assigned = plan.shards.flatMap((shard) => shard.tests);
    expect(assigned.map(testKey).sort()).toEqual(tests.map(testKey).sort());
    const path = join(directory, "all-tests.txt");
    writeFileSync(path, assigned.map((test) => test.selector).join("\n") + "\n");
    const selected = discoverTests(list(["--test-list", path]), projectBrowsers);
    expect(selected.map(testKey).sort()).toEqual(tests.map(testKey).sort());
    // Also prove that selecting a single identity does not accidentally include other projects or siblings.
    const nested = tests.find((test) => test.titlePath.length > 1)!;
    expect(nested).toBeDefined();
    writeFileSync(path, nested.selector + "\n");
    expect(discoverTests(list(["--test-list", path]), projectBrowsers).map(testKey)).toEqual([testKey(nested)]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
