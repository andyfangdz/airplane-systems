/** Balance every discovered browser case using recorded CI durations; unknown cases still run. */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const posix = (path) => path.replaceAll("\\", "/");
export const testKey = ({ project, file, titlePath }) => JSON.stringify([project, file, ...titlePath]);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function selectorPart(value) {
  // Playwright's test-list parser trims and splits on this delimiter. Fail rather than silently omit a case.
  if (typeof value !== "string" || !value || value !== value.trim() || /[\r\n›]/.test(value))
    throw new Error(`Cannot represent test identity in a Playwright test list: ${JSON.stringify(value)}`);
  return value;
}

export function discoverTests(report, projectBrowsers, cwd = process.cwd()) {
  if (report.errors?.length) throw new Error(`Playwright discovery failed: ${JSON.stringify(report.errors)}`);
  if (!isAbsolute(report.config?.rootDir ?? "")) throw new Error("Missing Playwright discovery rootDir");
  const tests = [];
  const seen = new Set();
  function visit(suite, parents) {
    for (const spec of suite.specs ?? []) {
      const titlePath = [...parents, spec.title].map(selectorPart);
      const absoluteFile = resolve(report.config.rootDir, spec.file);
      const file = posix(relative(cwd, absoluteFile));
      const selectorFile = selectorPart(posix(relative(report.config.rootDir, absoluteFile)));
      if (/:\d+(?::\d+)?$/.test(selectorFile)) throw new Error(`Ambiguous test-list file: ${selectorFile}`);
      for (const test of spec.tests ?? []) {
        const project = selectorPart(test.projectName);
        const browser = projectBrowsers[project];
        if (!["chromium", "firefox", "webkit"].includes(browser))
          throw new Error(`Missing or unsupported browser for project ${project}`);
        const entry = {
          project,
          file,
          titlePath,
          browser,
          selector: [`[${project}]`, selectorFile, ...titlePath].join(" › "),
        };
        const key = testKey(entry);
        if (seen.has(key)) throw new Error(`Duplicate discovered test: ${key}`);
        seen.add(key);
        tests.push(entry);
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...parents, child.title]);
  }
  // The outer suite names are file names, not describe titles.
  for (const suite of report.suites ?? []) visit(suite, []);
  if (!tests.length) throw new Error("Playwright discovery returned no tests");
  return tests;
}

export function planShards(tests, durations, shardCount, fallbackSeconds = 60) {
  if (!Number.isSafeInteger(shardCount) || shardCount < 1 || shardCount > tests.length)
    throw new Error("Shard count must be a positive integer no greater than the discovered test count");
  if (!Number.isFinite(fallbackSeconds) || fallbackSeconds <= 0) throw new Error("Invalid fallback duration");
  const timings = new Map();
  for (const duration of durations) {
    if (!Number.isFinite(duration.seconds) || duration.seconds <= 0)
      throw new Error(`Invalid recorded duration: ${testKey(duration)}`);
    const key = testKey(duration);
    if (timings.has(key)) throw new Error(`Duplicate recorded duration: ${key}`);
    timings.set(key, duration.seconds);
  }
  const seen = new Set();
  const weighted = tests.map((test) => {
    const key = testKey(test);
    if (seen.has(key)) throw new Error(`Duplicate discovered test: ${key}`);
    seen.add(key);
    return {
      ...test,
      estimatedDurationMs: Math.round((timings.get(key) ?? fallbackSeconds) * 1000),
      recordedDuration: timings.has(key),
    };
  });
  // Longest-processing-time first, with stable identity/shard tie breaks. Timing data affects placement only.
  weighted.sort((a, b) => b.estimatedDurationMs - a.estimatedDurationMs || compare(testKey(a), testKey(b)));
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    shard: index + 1,
    estimatedDurationMs: 0,
    tests: [],
  }));
  for (const test of weighted) {
    const shard = shards.reduce((best, candidate) =>
      candidate.estimatedDurationMs < best.estimatedDurationMs ? candidate : best,
    );
    shard.tests.push(test);
    shard.estimatedDurationMs += test.estimatedDurationMs;
  }
  return {
    testCount: tests.length,
    unknownTestCount: weighted.filter((test) => !test.recordedDuration).length,
    fallbackSeconds,
    shards: shards.map((shard) => ({
      ...shard,
      testCount: shard.tests.length,
      browsers: [...new Set(shard.tests.map((test) => test.browser))].sort(),
      tests: shard.tests.sort((a, b) => compare(testKey(a), testKey(b))),
    })),
  };
}

function main() {
  const { values } = parseArgs({ options: { shards: { type: "string" }, output: { type: "string" } } });
  if (!values.shards || !values.output)
    throw new Error("Usage: node scripts/ci-browser-shards.mjs --shards <count> --output <directory>");
  const report = JSON.parse(
    execFileSync(process.execPath, ["node_modules/playwright/cli.js", "test", "--list", "--reporter=json"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: "", PLAYWRIGHT_JSON_OUTPUT_NAME: "" },
    }),
  );
  return import("../playwright.config.mjs").then(({ default: config }) => {
    const projectBrowsers = Object.fromEntries(
      config.projects.map((project) => [
        project.name,
        project.use?.browserName ?? config.use?.browserName ?? "chromium",
      ]),
    );
    const durations = JSON.parse(readFileSync(new URL("./ci-browser-durations.json", import.meta.url), "utf8"));
    const plan = planShards(discoverTests(report, projectBrowsers), durations.tests, Number(values.shards));
    mkdirSync(values.output, { recursive: true });
    writeFileSync(join(values.output, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
    for (const shard of plan.shards) {
      writeFileSync(
        join(values.output, `shard-${shard.shard}.txt`),
        shard.tests.map((test) => test.selector).join("\n") + "\n",
      );
      const { tests, ...metadata } = shard;
      writeFileSync(join(values.output, `shard-${shard.shard}.json`), JSON.stringify(metadata, null, 2) + "\n");
      console.log(
        `Shard ${shard.shard}: ${shard.testCount} tests, estimated ${(shard.estimatedDurationMs / 1000).toFixed(1)}s, ${shard.browsers.join("+")}`,
      );
    }
    console.log(
      `${plan.testCount} discovered tests assigned exactly once; ${plan.unknownTestCount} use the ${plan.fallbackSeconds}s fallback.`,
    );
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
