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
 * --no-labels, --url <base> (use a running server instead of starting `next dev`), --wait <ms> (settle time, default 2500),
 * --compare <dir> (diff against same-named PNGs there; exits 1 when any view differs by more than --tolerance percent, default 0.5).
 *
 * Console errors and warnings from the page are printed, so label-list mismatches and runtime errors show up here too.
 * Uses playwright-core with the Chromium from `npx playwright-core install chromium` (or PLAYWRIGHT_BROWSERS_PATH).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const ROOT = resolve(import.meta.dirname, "..");

const args = process.argv.slice(2);
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
const baseArg = opt("--url", "");
const wait = Number(opt("--wait", "2500"));
const compare = opt("--compare", "");
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

const views = args.flatMap((a) => {
  const [ac, sys] = a.replace(/^\/+/, "").split("/");
  if (ac === "all") return ids.flatMap((id) => systemsOf(id).map((s) => `${id}/${s}`));
  if (!ids.includes(ac)) throw new Error(`Unknown airplane "${ac}" (one of ${ids.join(", ")}, or "all")`);
  if (sys) {
    if (!systemsOf(ac).includes(sys))
      throw new Error(`${ac} has no system "${sys}" (it has ${systemsOf(ac).join(", ")})`);
    return [`${ac}/${sys}`];
  }
  return systemsOf(ac).map((s) => `${ac}/${s}`);
});

/** Start `next dev` on a spare port unless --url names a running server. */
async function server() {
  if (baseArg) return { base: baseArg.replace(/\/$/, ""), stop: () => {} };
  const port = 3100 + Math.floor(Math.random() * 800);
  const child = spawn(process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), "dev", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 240; i++) {
    if (child.exitCode !== null) throw new Error(`next dev exited:\n${log}`);
    try {
      if ((await fetch(base + "/")).ok) return { base, stop: () => child.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`next dev did not start:\n${log}`);
}

/** Percentage of pixels that differ noticeably between two PNGs (compared in the browser, so no image library is needed). */
async function diffPct(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 100;
      const px = (im) => {
        const c = new OffscreenCanvas(im.width, im.height),
          g = c.getContext("2d");
        g.drawImage(im, 0, 0);
        return g.getImageData(0, 0, im.width, im.height).data;
      };
      const da = px(ia),
        db = px(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4)
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) n++;
      return (100 * n) / (da.length / 4);
    },
    [a, b],
  );
}

const png = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");

const { base, stop } = await server();
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let changed = 0;
try {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce", // camera jumps to each view instead of flying
  });
  await ctx.addInitScript((theme) => {
    try {
      localStorage.setItem("tourDone", "1");
      localStorage.setItem("sr20theme", theme);
    } catch {}
  }, theme);
  mkdirSync(out, { recursive: true });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (
      (m.type() === "error" || m.type() === "warning") &&
      !/THREE\.Clock: This module has been deprecated/.test(m.text())
    )
      console.log(`  [${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  for (const v of views) {
    console.log(v);
    await page.goto(`${base}/${v}`);
    await page.waitForSelector("canvas", { timeout: 60000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev-mode badge
    await page.evaluate(
      async ([solid, noLabels]) => {
        const turnOff = (label) => {
          const b = [...document.querySelectorAll(".toolbar .tb")].find((b) => b.textContent === label);
          if (b?.getAttribute("aria-pressed") === "true") b.click();
        };
        if (solid) turnOff("X-ray");
        if (noLabels) turnOff("Labels");
      },
      [solid, noLabels],
    );
    await page.waitForTimeout(wait);
    const file = join(out, v.replace("/", "-") + (phone ? "-phone" : "") + ".png");
    writeFileSync(file, await page.screenshot({ fullPage: phone }));
    if (compare) {
      const ref = join(resolve(compare), file.slice(out.length + 1));
      if (!existsSync(ref)) console.log(`  no reference ${ref}`);
      else {
        const pct = await diffPct(page, png(ref), png(file));
        const bad = pct > tolerance;
        if (bad) changed++;
        console.log(`  ${bad ? "CHANGED" : "same"} (${pct.toFixed(2)}% of pixels differ)`);
      }
    }
  }
  console.log(
    `\n${views.length} screenshot(s) in ${out}` +
      (compare ? `; ${changed} differ from ${compare} by more than ${tolerance}%` : ""),
  );
} finally {
  await browser.close();
  stop();
}
process.exit(changed ? 1 : 0);
