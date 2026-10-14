#!/usr/bin/env node
/**
 * Screenshots of the app, so a change can be checked by eye (or by an agent) without opening a browser.
 *
 *   npm run shot -- sr20/fuel            one view
 *   npm run shot -- c172s                every system of one airplane
 *   npm run shot -- all                  every view of every airplane
 *   npm run shot -- all --out .shots/after --compare .shots/before    and report which views changed
 *
 * Options: --out <dir> (default .shots), --theme light|dark, --phone (390×844, full page), --solid (X-ray off),
 * --cam top|side|front|below|iso (comma-separated presets; PNGs suffixed with the preset),
 * --no-labels, --url <base> (use a running server instead of starting `next dev`), --wait <ms> (settle time, default 2500),
 * --compare <dir> (diff against same-named PNGs there; exits 1 when any view differs by more than --tolerance percent, default
 * 0.5, and writes <view>.diff.png with the differing pixels in red). Views with the engine running differ a little between
 * runs anyway: the propeller, strobes, spark plugs and flow particles keep moving.
 *
 * Console errors and warnings from the page are printed, so label-list mismatches and runtime errors show up here too.
 * Uses Playwright Test and its image matcher (`npx playwright install chromium`).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url)),
    "test",
    "--config=playwright.shots.config.mjs",
  ],
  { stdio: "inherit", env: { ...process.env, SHOT_ARGS: JSON.stringify(process.argv.slice(2)) } },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
