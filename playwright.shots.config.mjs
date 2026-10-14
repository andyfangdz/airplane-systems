import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseShotCameras } from "./scripts/shot-camera.mjs";
const ROOT = import.meta.dirname;
const { args, cameras } = parseShotCameras(JSON.parse(process.env.SHOT_ARGS || "[]"));
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};

const out = resolve(opt("--out", ".shots"));
const theme = opt("--theme", "light");
const baseArg = opt("--url", "").replace(/\/$/, "");
const wait = Number(opt("--wait", "2500"));
const compare = opt("--compare", "");
// Resolve existing ancestors too, so an uncreated directory beneath a symlink cannot bypass the guard.
const canonicalPath = (path) => {
  const absolute = resolve(path);
  return existsSync(absolute) ? realpathSync(absolute) : join(canonicalPath(dirname(absolute)), basename(absolute));
};
const outputDir = resolve(ROOT, ".shots/test-results");
const artifacts = canonicalPath(outputDir);
for (const [option, directory] of [
  ["--out", out],
  ["--compare", compare],
]) {
  if (!directory) continue;
  const canonical = canonicalPath(directory);
  if (canonical === artifacts || canonical.startsWith(artifacts.endsWith(sep) ? artifacts : artifacts + sep))
    throw new Error(`${option} cannot use Playwright's artifact directory or its descendants: ${outputDir}`);
}
if (compare && canonicalPath(out) === canonicalPath(compare))
  throw new Error("--out and --compare must use different directories to preserve reference images");
const tolerance = Number(opt("--tolerance", "0.5"));
const phone = flag("--phone");
const solid = flag("--solid");
const noLabels = flag("--no-labels");
if (!args.length) args.push("sr20/overview");

/** Airplane ids, and each airplane's system ids in rail order, read from the source. */
const ids = [
  ...readFileSync(join(ROOT, "lib/systems.ts"), "utf8")
    .match(/AIRCRAFT_IDS = \[([^\]]*)\]/)[1]
    .matchAll(/"(\w+)"/g),
].map((m) => m[1]);
const systemsOf = (ac) =>
  [...readFileSync(join(ROOT, `aircraft/${ac}/systems.ts`), "utf8").matchAll(/\bid: "(\w+)"/g)].map((m) => m[1]);

const views = [
  ...new Set(
    args.flatMap((a) => {
      const [ac, sys] = a.replace(/^\/+/, "").split("/");
      if (ac === "all") return ids.flatMap((id) => systemsOf(id).map((s) => `${id}/${s}`));
      if (!ids.includes(ac)) throw new Error(`Unknown airplane "${ac}" (one of ${ids.join(", ")}, or "all")`);
      if (sys) {
        if (!systemsOf(ac).includes(sys))
          throw new Error(`${ac} has no system "${sys}" (it has ${systemsOf(ac).join(", ")})`);
        return [`${ac}/${sys}`];
      }
      return systemsOf(ac).map((s) => `${ac}/${s}`);
    }),
  ),
];

export const shot = { out, theme, wait, compare, tolerance, phone, solid, noLabels, views, cameras };
export default defineConfig({
  testDir: "./scripts",
  testMatch: "shot.spec.mjs",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  outputDir,
  snapshotPathTemplate: `${resolve(compare || out)}/{arg}{ext}`,
  updateSnapshots: "none",
  use: {
    baseURL: baseArg || "http://127.0.0.1:3100",
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: baseArg
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        timeout: 120_000,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
        env: { NEXT_TELEMETRY_DISABLED: "1" },
      },
});
