import type { NextConfig } from "next";
import { AIRCRAFT_IDS } from "./lib/systems";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three ships ESM examples; let Next transpile it for the browser bundle
  transpilePackages: ["three"],
  // every view is the one static page: /c172s and /c172s/electrical serve it, and App reads the view from the path
  // (other paths, including unknown airplanes, 404)
  async rewrites() {
    return [{ source: `/:ac(${AIRCRAFT_IDS.join("|")})/:sys?`, destination: "/" }];
  },
};

export default nextConfig;
