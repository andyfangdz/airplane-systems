import { afterEach, expect, it, vi } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { getRewrittenUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../next.config";
import { VIEW_PATHS } from "@/aircraft/metas";

const artifacts = vi.hoisted(
  () =>
    new Map([
      ["public/geometry/runtime.json", "{}"],
      ["public/geometry/manifest.json", "{}"],
      [".geometry-runtime/inputs.json", "{}"],
    ]),
);
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    existsSync: (path: string) => artifacts.has(path) || fs.existsSync(path),
    readFileSync: (path: string, ...args: unknown[]) => artifacts.get(path) ?? fs.readFileSync(path, ...(args as [])),
  };
});

// Next.js phase configuration and route testing: https://nextjs.org/docs/app/api-reference/config/next-config-js
// On Next.js upgrades, verify this documented experimental testing API remains compatible with the pinned version.
afterEach(() => {
  vi.unstubAllEnvs();
});

it("serves every view from its own airplane route, with no rewrite, in development and a default build", async () => {
  vi.stubEnv("STATIC_EXPORT", "");
  for (const phase of [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD]) {
    const config = nextConfig(phase);
    expect(config.output).toBeUndefined();
    expect(config.rewrites).toBeUndefined();
    for (const path of [...VIEW_PATHS, "/sr22t/electrical?fiki=0", "/sr22t/bogus", "/nope"]) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://example.com${path}`,
        nextConfig: config,
      });
      expect(getRewrittenUrl(response), path).toBeNull();
    }
  }
});

it("exports production files when STATIC_EXPORT=1", () => {
  vi.stubEnv("STATIC_EXPORT", "1");
  const config = nextConfig(PHASE_PRODUCTION_BUILD);
  expect(config.output).toBe("export");
  expect(config.rewrites).toBeUndefined();
  expect(config.env?.NEXT_PUBLIC_STATIC_EXPORT).toBe("1");
});

it("keeps development a server even when STATIC_EXPORT=1", () => {
  vi.stubEnv("STATIC_EXPORT", "1");
  const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
  expect(config.output).toBeUndefined();
});

it("rejects a changed compiler input even when that helper is absent from the emitted runtime graph", () => {
  artifacts.set(".geometry-runtime/inputs.json", JSON.stringify({ "lib/geometry.ts": "stale-digest" }));
  try {
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).toThrow("Compiled aircraft input changed: lib/geometry.ts");
    expect(() => nextConfig(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  } finally {
    artifacts.set(".geometry-runtime/inputs.json", "{}");
  }
});
