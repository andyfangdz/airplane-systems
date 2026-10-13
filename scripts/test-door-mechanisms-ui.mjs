#!/usr/bin/env node
/** Exercise controls -> rendered assemblies, including nested Cessna windows and repeatable return poses. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, errors as playwrightErrors } from "playwright-core";
const port = 4100 + Math.floor(Math.random() * 800);
const url = process.argv.slice(2).find((arg) => /^https?:/.test(arg));
const base = url || `http://localhost:${port}`;
const phone = process.argv.includes("--phone");
const shots = process.argv.includes("--shots");
const cases = [
  {
    id: "sr20",
    view: "doors",
    door: "Right cabin door",
    glass: "Right cabin door window",
    control: "Right cabin door open",
    bag: "Baggage door open",
    checked: true,
  },
  ...["c172s", "c182t"].map((id) => ({
    id,
    view: "cabin",
    door: "Right cabin door",
    glass: "Right door window",
    control: "Right cabin door open",
    bag: "Baggage door open",
    window: "Right door window open",
    checked: true,
  })),
  {
    id: "m20c",
    view: "cabin",
    door: "Cabin door panel",
    glass: "Cabin door panel window",
    control: "Cabin door closed and latched",
    bag: "Baggage door secure",
    checked: false,
  },
  {
    id: "da40",
    view: "cabin",
    door: "Rear passenger door (left)",
    control: "Rear door closed and locked",
    checked: false,
  },
];
let server, browser;
try {
  if (!url) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "",
      ready = false;
    server.stdout.on("data", (d) => {
      log = (log + d).slice(-8000);
    });
    server.stderr.on("data", (d) => {
      log = (log + d).slice(-8000);
    });
    for (let i = 0; i < 120; i++) {
      assert.equal(server.exitCode, null, log);
      try {
        ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {}
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, log);
  }
  if (shots) await mkdir(".shots/mechanisms", { recursive: true });
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const test of cases.filter(
    (c) => !process.env.DOOR_AIRCRAFT || process.env.DOOR_AIRCRAFT.split(",").includes(c.id),
  )) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1100, height: 800 },
      reducedMotion: "reduce",
    });
    await context.route("**/_vercel/**", (r) => r.fulfill({ status: 204, body: "" }));
    await context.addInitScript(() => {
      localStorage.setItem("tourDone", "1");
      window.__doors = { scene: null, frames: 0 };
      const dev = new EventTarget();
      dev.addEventListener("observe", ({ detail: o }) => {
        if (o?.isWebGLRenderer) {
          const render = o.render.bind(o);
          o.render = (...args) => {
            window.__doors.scene = args[0];
            window.__doors.frames++;
            return render(...args);
          };
        }
      });
      window.__THREE_DEVTOOLS__ = dev;
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/${test.id}/${test.view}`);
    await page.waitForFunction(
      () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
      null,
      { timeout: 120_000 },
    );
    const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
    if (await addAll.isVisible()) {
      try {
        await addAll.click({ timeout: 5000 });
      } catch (error) {
        if (!(error instanceof playwrightErrors.TimeoutError) || (await page.locator("[data-building]").count()))
          throw error;
      }
    }
    await page.waitForFunction(
      () => window.__doors.scene?.children.length && !document.querySelector("[data-building]"),
      null,
      { timeout: 120_000 },
    );
    if (test.id === "da40") {
      // AFM ground opening: the existing model deliberately limits an unlatched door in flight.
      await page
        .getByRole("navigation", { name: "Systems" })
        .getByRole("button", { name: /^Overview/ })
        .click();
      await page.getByRole("button", { name: /Cold & dark on the ramp/ }).click();
      await page
        .getByRole("navigation", { name: "Systems" })
        .getByRole("button", { name: /^Canopy, door & safety/ })
        .click();
    }
    await page.evaluate(() => {
      for (const label of ["X-ray", "Labels"]) {
        const b = [...document.querySelectorAll(".toolbar .tb")].find((b) => b.textContent === label);
        if (b?.getAttribute("aria-pressed") === "true") b.click();
      }
    });
    const pose = (name) =>
      page.evaluate((name) => {
        let result;
        window.__doors.scene.traverse((o) => {
          if (o.isMesh && o.userData.pick?.name === name) result = o.matrixWorld.elements.slice();
        });
        if (!result) throw new Error(`Missing rendered part: ${name}`);
        return result;
      }, name);
    const settle = async (name = test.door) => {
      let last = await pose(name),
        stable = 0;
      for (let i = 0; i < 120; i++) {
        const frame = await page.evaluate(() => window.__doors.frames);
        await page.waitForFunction((f) => window.__doors.frames > f, frame, { timeout: 120_000 });
        const next = await pose(name),
          delta = Math.max(...next.map((v, j) => Math.abs(v - last[j])));
        stable = delta < 1e-6 ? stable + 1 : 0;
        if (stable >= 3) return;
        last = next;
      }
      throw new Error(`${test.id}: door never settled`);
    };
    await settle();
    const bagClosed = test.bag && (await pose("Baggage door panel"));
    const closed = await pose(test.door),
      glassClosed = test.glass && (await pose(test.glass));
    const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const control = page.getByRole("checkbox", { name: test.control, exact: true });
    if (test.window) {
      await page.getByRole("checkbox", { name: test.window, exact: true }).check();
      await page.waitForFunction(
        ({ name, original }) => {
          let changed = false;
          window.__doors.scene.traverse((o) => {
            if (o.isMesh && o.userData.pick?.name === name)
              changed = o.matrixWorld.elements.some((v, i) => Math.abs(v - original[i]) > 0.1);
          });
          return changed;
        },
        { name: test.glass, original: glassClosed },
        { timeout: 120_000 },
      );
      assert.ok(delta(await pose(test.door), closed) < 1e-6, `${test.id}: window must operate independently`);
    }
    await control.setChecked(test.checked);
    await settle();
    const opened = await pose(test.door);
    assert.ok(delta(opened, closed) > 0.2, `${test.id}: panel must open`);
    if (test.glass) assert.ok(delta(await pose(test.glass), glassClosed) > 0.2, `${test.id}: glazing follows assembly`);
    if (test.bag) {
      await page.getByRole("checkbox", { name: test.bag, exact: true }).setChecked(test.checked);
      await settle("Baggage door panel");
      assert.ok(delta(await pose("Baggage door panel"), bagClosed) > 0.2, `${test.id}: baggage panel must open`);
    }
    if (shots) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.shots/mechanisms/${test.id}-open${phone ? "-phone" : ""}.png`,
        timeout: 120_000,
      });
    }
    if (test.bag) {
      await page.getByRole("checkbox", { name: test.bag, exact: true }).setChecked(!test.checked);
      await settle("Baggage door panel");
      assert.ok(delta(await pose("Baggage door panel"), bagClosed) < 1e-5, `${test.id}: baggage panel must return`);
    }
    if (test.window) await page.getByRole("checkbox", { name: test.window, exact: true }).uncheck();
    await control.setChecked(!test.checked);
    await settle();
    assert.ok(delta(await pose(test.door), closed) < 1e-5, `${test.id}: close restores initial pose`);
    if (test.glass)
      assert.ok(delta(await pose(test.glass), glassClosed) < 1e-5, `${test.id}: nested glazing restores initial pose`);
    await control.setChecked(test.checked);
    await settle();
    assert.ok(delta(await pose(test.door), opened) < 1e-5, `${test.id}: second opening does not accumulate transforms`);
    assert.deepEqual(errors, [], `${test.id}: runtime errors`);
    console.log(
      `${test.id}: open, close, reopen${test.window ? ", independent nested window" : ""} passed (${phone ? "phone" : "desktop"})`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}
