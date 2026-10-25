import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const sharedConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  // three ships ESM examples; let Next transpile it for the browser bundle
  transpilePackages: ["three"],
};

/**
 * Every view is a page of its own: each airplane's route (app/(fleet)/<id>/[[...sys]]) prerenders /<id> and
 * /<id>/<system>, and any other path 404s. `STATIC_EXPORT=1 next build` writes them to out/ for a plain file host
 * (scripts/deploy-aws.sh), which maps each view path to its .html file (infra/cloudfront/view-rewrite.js).
 */
export default function nextConfig(phase: string): NextConfig {
  // A build embeds exact hashed asset URLs. Dev deliberately uses factories for immediate geometry edits.
  const manifest = "public/geometry/manifest.json";
  const runtime = "public/geometry/runtime.json";
  const compiled = phase !== PHASE_DEVELOPMENT_SERVER;
  if (compiled) {
    const inputs = ".geometry-runtime/inputs.json";
    if (!existsSync(runtime) || !existsSync(manifest) || !existsSync(inputs))
      throw new Error("Compiled aircraft artifacts are missing. Run npm run geometry:build before build:site.");
    const digests = JSON.parse(readFileSync(inputs, "utf8")) as Record<string, string>;
    for (const [path, expected] of Object.entries(digests)) {
      if (!existsSync(path) || createHash("sha256").update(readFileSync(path)).digest("hex") !== expected)
        throw new Error(`Compiled aircraft input changed: ${path}. Run npm run geometry:build before build:site.`);
    }
  }
  const env =
    phase !== PHASE_DEVELOPMENT_SERVER && existsSync(manifest)
      ? {
          NEXT_PUBLIC_GEOMETRY_ASSETS: readFileSync(manifest, "utf8").trim(),
          ...(compiled ? { NEXT_PUBLIC_GEOMETRY_RUNTIME: readFileSync(runtime, "utf8").trim() } : {}),
        }
      : {};
  const compiler = compiled
    ? {
        turbopack: {
          rules: {
            "*.{ts,tsx}": {
              condition: { not: "foreign" as const },
              loaders: [{ loader: "./scripts/geometry/runtime-loader.cjs", options: { root: resolve(".") } }],
            },
          },
        },
      }
    : {};
  if (phase !== PHASE_DEVELOPMENT_SERVER && process.env.STATIC_EXPORT === "1") {
    // NEXT_PUBLIC_STATIC_EXPORT drops Vercel Analytics from the export (lib/staticExport.ts)
    return { ...sharedConfig, ...compiler, output: "export", env: { ...env, NEXT_PUBLIC_STATIC_EXPORT: "1" } };
  }
  return {
    ...sharedConfig,
    ...compiler,
    env,
    async headers() {
      return [
        {
          source: "/sw.js",
          headers: [
            { key: "Content-Type", value: "text/javascript; charset=utf-8" },
            { key: "Cache-Control", value: "no-cache" },
            { key: "Service-Worker-Allowed", value: "/" },
            { key: "X-Content-Type-Options", value: "nosniff" },
          ],
        },
        ...["/manifest.webmanifest", "/offline-manifest.json"].map((source) => ({
          source,
          headers: [{ key: "Cache-Control", value: "no-cache" }],
        })),
      ];
    },
  };
}
