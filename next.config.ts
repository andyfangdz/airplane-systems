import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { existsSync, readFileSync } from "node:fs";

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
  const env =
    phase !== PHASE_DEVELOPMENT_SERVER && existsSync(manifest)
      ? { NEXT_PUBLIC_GEOMETRY_ASSETS: readFileSync(manifest, "utf8").trim() }
      : {};
  if (phase !== PHASE_DEVELOPMENT_SERVER && process.env.STATIC_EXPORT === "1") {
    // NEXT_PUBLIC_STATIC_EXPORT drops Vercel Analytics from the export (lib/staticExport.ts)
    return { ...sharedConfig, output: "export", env: { ...env, NEXT_PUBLIC_STATIC_EXPORT: "1" } };
  }
  return { ...sharedConfig, env };
}
