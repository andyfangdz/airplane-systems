/**
 * The engine pages in a browser: the IO-390 and the TSIO-550-K at desktop (1280×800) and phone (390×844) sizes, the
 * phone also dark. Each case opens its own context, collects page errors from before the first navigation and checks
 * none happened before the context closes. The TSIO-550-K's controls follow the SR22T POH (13772-007): a factory-set
 * governor, a three-position fuel pump and START on both magnetos (7-32, 7-37, 7-39, 7-41). Monitor shots go to
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
      const trigger = page.getByRole("button", { name: `Switch Airplanes, current engine ${engine.name}` });
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
      const otherTrigger = page.getByRole("button", { name: `Switch Airplanes, current engine ${engine.other}` });
      await otherTrigger.waitFor();
      await otherTrigger.click();
      await engines.getByRole("link", { name: new RegExp(engine.name) }).click();
      await page.waitForURL(`**/engines/${engine.id}`);
      await trigger.waitFor();

      assert.deepEqual(errors, []);
      await context.close();
    });
