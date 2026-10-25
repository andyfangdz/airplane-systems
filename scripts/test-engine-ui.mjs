/**
 * The engine pages in a browser: the IO-390 and the TSIO-550-K at desktop (1280×800) and phone (390×844) sizes, the
 * phone also dark. Each case opens its own context, collects page errors from before the first navigation and checks
 * none happened before the context closes. The TSIO-550-K's controls follow the SR22T POH (13772-007): a factory-set
 * governor, a three-position fuel pump and START on both magnetos (7-32, 7-37, 7-39, 7-41). Its failure cases do too:
 * a wastegate seized closed raises the MAN PRESSURE warning and the relief valve surges (3-29, 3-30); a misadjusted
 * controller holds the MAN PRESSURE caution with warm oil (3-29, 3A-9). Monitor, flag-row and Failures shots go to
 * .shots/engine-ui/.
 *
 * Run after npm run build, or set UI_BASE_URL for an existing server.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "@playwright/test";

const shots = join(resolve(import.meta.dirname, ".."), ".shots", "engine-ui");

const ENGINES = [
  { id: "io390", name: "IO-390", cylinders: 4, turbo: false, other: "TSIO-550-K" },
  { id: "tsio550k", name: "TSIO-550-K", cylinders: 6, turbo: true, other: "IO-390" },
];
const VIEWS = [
  { id: "desktop", viewport: { width: 1280, height: 800 }, theme: "light", phone: false },
  { id: "phone", viewport: { width: 390, height: 844 }, theme: "light", phone: true },
  { id: "phone-dark", viewport: { width: 390, height: 844 }, theme: "dark", phone: true },
];

/** The monitor's tiles, label → shown value. */
const tiles = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll(".mon-big > div, .mon-small > div")].map((d) => [
        d.querySelector("span")?.textContent,
        d.querySelector("b")?.textContent,
      ]),
    ),
  );
const num = (text) => Number(String(text).replace(/,/g, ""));
/** The flag rows: class (warn, caut, adv) and text. */
const flagRows = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".eng-flags li")].map((li) => [li.className, li.textContent]));
const isMan = ([, text]) => text.startsWith("MAN PRESSURE:");
const isRelief = ([cls, text]) => cls === "adv" && text.startsWith("Overboost relief valve open");

/** Poll `read` every 250 ms until `ok` holds; the last value, or a failure naming `what` after `ms`. */
async function until(what, read, ok, ms) {
  const end = Date.now() + ms;
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await delay(250);
  } while (Date.now() < end);
  throw new Error(`${what} not within ${ms / 1000} s; last ${JSON.stringify(last)}`);
}

/** Freeze the simulation (the toolbar's Pause), run `fn`, then let it run again. */
async function paused(page, fn) {
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await pause.click();
  await page.waitForFunction(
    () => document.querySelector('button[title="Freeze the simulation"]')?.getAttribute("aria-pressed") === "true",
  );
  // let the last snapshot of the frozen engine reach the flags
  await delay(400);
  try {
    return await fn();
  } finally {
    await pause.click();
  }
}

/** The Failures section, from its heading to the cylinder table. */
async function failuresShot(page, file, phone) {
  // the desktop panel scrolls inside the window: make the window tall enough to hold the whole section
  const size = page.viewportSize();
  if (!phone) await page.setViewportSize({ width: size.width, height: 1400 });
  await page.evaluate(() =>
    [...document.querySelectorAll("h3")].find((h) => h.textContent === "Failures").scrollIntoView({ block: "start" }),
  );
  const clip = await page.evaluate((phone) => {
    const h = [...document.querySelectorAll("h3")].find((x) => x.textContent === "Failures").getBoundingClientRect();
    const t = document.querySelector("table.eng-fail").getBoundingClientRect();
    const x = Math.max(0, Math.min(h.left, t.left) - 8);
    return {
      x,
      y: Math.max(0, h.top - 8) + (phone ? scrollY : 0),
      width: Math.min(innerWidth - x, Math.max(h.right, t.right) - x + 8),
      height: t.bottom - h.top + 16,
    };
  }, phone);
  await page.screenshot({ path: file, clip, fullPage: phone });
  if (!phone) await page.setViewportSize(size);
}

/** Wait for a "Start from" setup to apply: its "Setting up" line gone and the engine at speed. */
async function startFrom(page, label, minRpm) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await until(
    `${label} set up`,
    async () => ({
      loading: await page.getByText(/^Setting up /).count(),
      rpm: num((await tiles(page)).RPM),
    }),
    (x) => x.loading === 0 && x.rpm > minRpm,
    60_000,
  );
}

for (const engine of ENGINES)
  for (const view of VIEWS)
    test(`${engine.name} engine page, ${view.id}`, async ({ browser, baseURL: base }) => {
      mkdirSync(shots, { recursive: true });
      const shot = (name) => join(shots, `${engine.id}-${view.id}-${name}.png`);
      const context = await browser.newContext({
        viewport: view.viewport,
        isMobile: view.phone,
        hasTouch: view.phone,
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("tourDone", "1");
        localStorage.setItem("sr20theme", theme);
      }, view.theme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));

      // ---- load: the page title, the picker names the engine, its description shows, no sideways scroll
      await page.goto(`${base}/engines/${engine.id}`);
      const trigger = page.getByRole("button", { name: `Switch simulation, current engine ${engine.name}` });
      await trigger.waitFor();
      await page.locator("canvas").first().waitFor();
      // two title sources on the engine page (metadata, and EngineApp's own): read the elements, not document.title
      const titles = await page.locator("title").evaluateAll((all) => all.map((t) => t.textContent));
      const own = `${engine.name} engine · Airplane Systems`;
      assert.ok(titles.includes(own), `${titles}`);
      assert.deepEqual(
        titles.filter((t) => t !== own && !t.endsWith(" engine simulation")),
        [],
        `${titles}`,
      );
      assert.ok((await page.locator(".lead").innerText()).length > 20, "the panel shows the engine's description");
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok((await overflow()) <= 0, `no horizontal scroll at ${view.viewport.width} px`);
      // the -K's wider Failures table also fits the narrowest phone
      if (engine.turbo && view.id === "phone") {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.waitForFunction(() => innerWidth === 320);
        assert.ok((await overflow()) <= 0, "no horizontal scroll at 320 px");
        await page.setViewportSize(view.viewport);
      }

      // ---- monitor: an EGT/CHT pair per cylinder, a TIT bar per turbocharger (POH 7-35)
      assert.equal(await page.locator(".mon-cyl:not(.mon-tit)").count(), engine.cylinders);
      assert.equal(await page.locator(".mon-tit").count(), engine.turbo ? 2 : 0);

      // ---- controls: the -K has a factory-set governor and a three-position pump (POH 7-32, 7-39, 7-41)
      if (engine.turbo) {
        assert.equal(await page.locator("#prop").count(), 0);
        assert.equal(await page.locator("#boost").count(), 0);
        for (const v of ["OFF", "BOOST", "HIGH"]) assert.equal(await page.locator(`#pump-${v}`).count(), 1, v);
        const governor = page.locator(".ro", { has: page.getByText("Governor (factory set)", { exact: true }) });
        assert.equal(await governor.locator("b").innerText(), "2,500 rpm");
      } else {
        assert.equal(await page.locator("#prop").count(), 1);
        assert.equal(await page.locator("#boost").count(), 1);
      }
      // hold START: the starter turns the engine; letting go returns the switch to BOTH (POH 7-37)
      const start = page.locator(".eng-start");
      await start.focus();
      await page.keyboard.down("Space");
      await until(
        "cranking",
        async () => num((await tiles(page)).RPM),
        (rpm) => rpm > 50,
        10_000,
      );
      await page.keyboard.up("Space");
      await page.waitForFunction(() => document.querySelector("#mags-BOTH")?.getAttribute("aria-pressed") === "true");
      assert.equal(await start.getAttribute("data-down"), "false");

      // ---- Start from → Takeoff: the model's takeoff on the tiles (-K: 2,500 rpm and 36.0 in.Hg, POH 4-17)
      await startFrom(page, "Takeoff", 2000);
      await delay(2000);
      const t = await tiles(page);
      if (engine.turbo) {
        assert.ok(Math.abs(num(t.MAP) - 36.0) <= 0.3, `takeoff MAP ${t.MAP}`);
        assert.ok(Math.abs(num(t.RPM) - 2500) <= 30, `takeoff rpm ${t.RPM}`);
        assert.ok(num(t.Deck) > num(t.MAP), `deck ${t.Deck} above MAP ${t.MAP}`);
      } else assert.ok(Math.abs(num(t.RPM) - 2700) <= 30, `takeoff rpm ${t.RPM}`);

      // ---- the Failures section
      const turboHeading = page.locator("h4.eng-sub");
      if (engine.turbo) {
        assert.equal(await turboHeading.innerText(), "Turbo system");
        assert.equal(await page.locator('[id^="f-wg-"], [id^="f-turbo-"], [id^="f-ic-"], [id^="f-tit-"]').count(), 9);
        assert.equal(await page.locator("#f-misadjust, #f-ind-leak, #f-exh-leak, #f-oil-leak").count(), 4);
        assert.equal(
          await page.locator("#f-filter").locator("xpath=..").innerText(),
          "Induction filter blocked (ice or debris)",
        );
      } else {
        assert.equal(await turboHeading.count(), 0);
        assert.equal(await page.locator("#f-filter").locator("xpath=..").innerText(), "Air filter blocked");
      }

      if (engine.turbo) {
        // ---- wastegate seized closed at full power: MAN PRESSURE warning, the relief valve surging (POH 3-29, 3-30)
        await page.locator("#f-wg-closed").check();
        const seen = new Set();
        await until(
          "MAN PRESSURE warning and the relief flag",
          async () => {
            for (const r of await flagRows(page)) {
              if (isMan(r)) seen.add(`man ${r[0]}`);
              if (isRelief(r)) seen.add("relief");
            }
            return [...seen];
          },
          (s) => s.includes("man warn") && s.includes("relief"),
          30_000,
        );
        assert.equal(await page.locator(".eng-flags .hd").innerText(), "Study flags, not the airplane's CAS");
        // frozen frames for the shots: the warning row, and the relief row beside it when the surge coincides. The
        // valve opens in short pulses, so the freezes are staggered by fixed steps rather than chasing a seen frame.
        const warn = (x) => x.some((r) => isMan(r) && r[0] === "warn");
        let warned = false,
          both = false;
        for (let i = 0; i < 30 && !both; i++) {
          await delay(150 + ((i * 173) % 600));
          await paused(page, async () => {
            const frozen = await flagRows(page);
            if (!warn(frozen) || (warned && !frozen.some(isRelief))) return;
            warned = true;
            both = frozen.some(isRelief);
            await page.locator(".eng-flags").screenshot({ path: shot("flags-man-pressure-warning") });
            await failuresShot(page, shot("failures-wastegate-closed"), view.phone);
          });
        }
        assert.ok(warned, "no frozen frame with the MAN PRESSURE warning");
        if (!both) console.warn(`${engine.id} ${view.id}: the warning shot has no relief row (the valve pulses)`);
        await page.locator("#f-wg-closed").uncheck();
        await until(
          "MAN PRESSURE cleared",
          () => flagRows(page),
          (x) => !x.some(isMan),
          10_000,
        );

        // ---- controller misadjusted: the MAN PRESSURE caution with warm oil, never the warning (POH 3-29, 3A-9)
        await page.locator("#f-misadjust").check();
        await until(
          "MAN PRESSURE caution",
          () => flagRows(page),
          (x) => x.some((r) => isMan(r) && r[0] === "caut"),
          20_000,
        );
        const end = Date.now() + 10_000;
        while (Date.now() < end) {
          const r = await flagRows(page);
          assert.ok(!r.some((x) => isMan(x) && x[0] === "warn"), `misadjust warning: ${JSON.stringify(r)}`);
          await delay(250);
        }
        await paused(page, async () => {
          const frozen = await flagRows(page);
          assert.ok(
            frozen.some((r) => isMan(r) && r[0] === "caut"),
            JSON.stringify(frozen),
          );
          await page.locator(".eng-flags").screenshot({ path: shot("flags-man-pressure-caution") });
        });
        await page.locator("#f-misadjust").uncheck();
        await until(
          "MAN PRESSURE cleared",
          () => flagRows(page),
          (x) => !x.some(isMan),
          10_000,
        );
      }

      // ---- theme: the saved theme applies, the toolbar switch flips it and back
      const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
      assert.equal(await theme(), view.theme);
      const other = view.theme === "dark" ? "light" : "dark";
      await page.locator(".tb-theme").click();
      await page.waitForFunction((t) => document.documentElement.dataset.theme === t, other);
      await page.locator(".tb-theme").click();
      await page.waitForFunction((t) => document.documentElement.dataset.theme === t, view.theme);
      await page.locator(".eng-foot").screenshot({ path: shot("monitor") });

      // ---- picker round trip: to the other engine and back
      const dialog = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
      const engines = dialog.getByRole("group", { name: "Engines" });
      await trigger.click();
      await engines.getByRole("link", { name: new RegExp(engine.other) }).click();
      const otherTrigger = page.getByRole("button", { name: `Switch simulation, current engine ${engine.other}` });
      await otherTrigger.waitFor();
      await otherTrigger.click();
      await engines.getByRole("link", { name: new RegExp(engine.name) }).click();
      await page.waitForURL(`**/engines/${engine.id}`);
      await trigger.waitFor();

      assert.deepEqual(errors, []);
      await context.close();
    });
