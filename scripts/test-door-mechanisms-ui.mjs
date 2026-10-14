/** Exercise controls -> rendered assemblies, including nested Cessna windows and repeatable return poses. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test, errors as playwrightErrors } from "@playwright/test";
const shots = process.env.DOOR_SHOTS === "1";
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
for (const scenario of cases.filter(
  (c) => !process.env.DOOR_AIRCRAFT || process.env.DOOR_AIRCRAFT.split(",").includes(c.id),
)) {
  test(`${scenario.id} moving door assemblies`, async ({ page, context, baseURL: base, isMobile: phone }) => {
    if (shots) await mkdir(".shots/mechanisms", { recursive: true });
    if (!phone) await page.setViewportSize({ width: 1100, height: 800 });
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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/${scenario.id}/${scenario.view}`);
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
    if (scenario.id === "da40") {
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
    const settle = async (name = scenario.door) => {
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
      throw new Error(`${scenario.id}: door never settled`);
    };
    await settle();
    const bagClosed = scenario.bag && (await pose("Baggage door panel"));
    const closed = await pose(scenario.door),
      glassClosed = scenario.glass && (await pose(scenario.glass));
    const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const control = page.getByRole("checkbox", { name: scenario.control, exact: true });
    if (scenario.window) {
      await page.getByRole("checkbox", { name: scenario.window, exact: true }).check();
      await page.waitForFunction(
        ({ name, original }) => {
          let changed = false;
          window.__doors.scene.traverse((o) => {
            if (o.isMesh && o.userData.pick?.name === name)
              changed = o.matrixWorld.elements.some((v, i) => Math.abs(v - original[i]) > 0.1);
          });
          return changed;
        },
        { name: scenario.glass, original: glassClosed },
        { timeout: 120_000 },
      );
      assert.ok(delta(await pose(scenario.door), closed) < 1e-6, `${scenario.id}: window must operate independently`);
    }
    await control.setChecked(scenario.checked);
    await settle();
    const opened = await pose(scenario.door);
    assert.ok(delta(opened, closed) > 0.2, `${scenario.id}: panel must open`);
    if (scenario.glass)
      assert.ok(delta(await pose(scenario.glass), glassClosed) > 0.2, `${scenario.id}: glazing follows assembly`);
    if (scenario.bag) {
      await page.getByRole("checkbox", { name: scenario.bag, exact: true }).setChecked(scenario.checked);
      await settle("Baggage door panel");
      assert.ok(delta(await pose("Baggage door panel"), bagClosed) > 0.2, `${scenario.id}: baggage panel must open`);
    }
    if (shots) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.shots/mechanisms/${scenario.id}-open${phone ? "-phone" : ""}.png`,
        timeout: 120_000,
      });
    }
    if (scenario.bag) {
      await page.getByRole("checkbox", { name: scenario.bag, exact: true }).setChecked(!scenario.checked);
      await settle("Baggage door panel");
      assert.ok(delta(await pose("Baggage door panel"), bagClosed) < 1e-5, `${scenario.id}: baggage panel must return`);
    }
    if (scenario.window) await page.getByRole("checkbox", { name: scenario.window, exact: true }).uncheck();
    await control.setChecked(!scenario.checked);
    await settle();
    assert.ok(delta(await pose(scenario.door), closed) < 1e-5, `${scenario.id}: close restores initial pose`);
    if (scenario.glass)
      assert.ok(
        delta(await pose(scenario.glass), glassClosed) < 1e-5,
        `${scenario.id}: nested glazing restores initial pose`,
      );
    await control.setChecked(scenario.checked);
    await settle();
    assert.ok(
      delta(await pose(scenario.door), opened) < 1e-5,
      `${scenario.id}: second opening does not accumulate transforms`,
    );
    assert.deepEqual(errors, [], `${scenario.id}: runtime errors`);
    console.log(
      `${scenario.id}: open, close, reopen${scenario.window ? ", independent nested window" : ""} passed (${phone ? "phone" : "desktop"})`,
    );
  });
}
