/** Airplane chooser regressions. Run after npm run build, or set UI_BASE_URL for an existing server. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");

/** Observe the rendered camera through three.js's devtools hook, as in test-load-ui.mjs. */
function hookCamera() {
  const state = (window.__fleetCamera = { camera: null, frames: 0 });
  const dev = new EventTarget();
  dev.addEventListener("observe", ({ detail: renderer }) => {
    if (!renderer?.isWebGLRenderer) return;
    const render = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      state.camera = camera;
      state.frames++;
      return render(scene, camera);
    };
  });
  window.__THREE_DEVTOOLS__ = dev;
}

async function settledCamera(page) {
  const read = async () => {
    const frame = await page.evaluate(() => window.__fleetCamera.frames);
    await page.waitForFunction((f) => window.__fleetCamera.frames >= f + 2, frame);
    return page.evaluate(() => {
      const camera = window.__fleetCamera.camera;
      return [...camera.position.toArray(), ...camera.quaternion.toArray()];
    });
  };
  let previous = await read();
  for (let i = 0; i < 120; i++) {
    await delay(250);
    const current = await read();
    if (current.every((v, k) => Math.abs(v - previous[k]) < 1e-5)) return current;
    previous = current;
  }
  throw new Error("Camera did not settle after orbiting");
}

test("fleet picker, keyboard, touch and camera preservation", async ({
  page,
  context,
  baseURL: base,
  viewport,
  browserName,
}, info) => {
  const { width, height } = viewport;
  const theme = info.project.metadata.theme || "light";
  const touch = width < 860;
  mkdirSync(join(root, ".shots"), { recursive: true });
  if (width === 1440) await context.addInitScript(hookCamera);
  await context.addInitScript((theme) => {
    localStorage.setItem("tourDone", "1");
    localStorage.setItem("sr20theme", theme);
  }, theme);
  const activate = (locator) => (touch ? locator.tap() : locator.click());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto(`${base}/sr20/electrical`);
  const trigger = page.getByRole("button", { name: /^Switch Airplanes/ });
  await trigger.waitFor();
  assert.ok(
    await trigger.getByText("Switch Airplanes", { exact: true }).isVisible(),
    "The control explicitly names the switching action",
  );
  const dialog = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
  const choices = dialog.getByRole("group", { name: "Airplanes" }).getByRole("button");
  const waitForClosed = async () => {
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.querySelector(".fleet-trigger")?.getAttribute("aria-expanded") === "false",
    );
  };
  if (touch) await activate(trigger);
  else {
    await trigger.focus();
    await page.keyboard.press("Enter");
  }
  await dialog.waitFor();
  assert.equal(await choices.count(), 6);
  const engines = dialog.getByRole("group", { name: "Engines" }).getByRole("link");
  assert.deepEqual(await engines.evaluateAll((links) => links.map((a) => a.getAttribute("href"))), [
    "/engines/io390",
    "/engines/o360",
  ]);
  const components = dialog.getByRole("group", { name: "Components" }).getByRole("link");
  assert.deepEqual(await components.evaluateAll((links) => links.map((a) => a.getAttribute("href"))), [
    "/components/carburetor",
    "/components/fuel-injector",
  ]);
  for (const link of await components.all()) assert.ok((await link.boundingBox()).height >= 44);
  for (const name of ["SR20 G6", "SR22T G6"])
    assert.match(await choices.filter({ hasText: name }).innerText(), /Walk-around/);
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  assert.equal(await dialog.getByRole("button", { pressed: true }).count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed")), "true");
  const box = await dialog.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
  assert.ok(
    box.width <= 352 && box.height <= 640,
    "The entire fleet, the engines and the components fit in a compact dropdown",
  );
  assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), "No horizontal scrolling");
  assert.ok((await trigger.boundingBox()).height >= 44, "Touch-sized trigger");
  assert.ok((await page.locator(".brand").boundingBox()).height < 140, "The picker adds no separate button row");
  for (const choice of await choices.all()) assert.ok((await choice.boundingBox()).height >= 44);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: join(root, `.shots/fleet-${browserName}-${width}-${theme}.png`) });

  await page.keyboard.press("ArrowDown");
  assert.ok(await choices.nth(1).evaluate((el) => el === document.activeElement));
  await page.keyboard.press("End");
  assert.ok(
    await components.last().evaluate((el) => el === document.activeElement),
    "The engines and then the components follow the airplanes",
  );
  for (let i = 0; i < (await components.count()) + 2; i++) await page.keyboard.press("ArrowUp");
  assert.ok(await choices.nth(5).evaluate((el) => el === document.activeElement));
  for (let i = 0; i < (await engines.count()) + (await components.count()) + 1; i++)
    await page.keyboard.press("ArrowDown");
  assert.ok(await choices.nth(0).evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await waitForClosed();
  assert.equal(new URL(page.url()).pathname, "/sr20/electrical", "Selecting the current plane preserves its system");
  assert.ok(await trigger.evaluate((el) => el === document.activeElement), "Focus returns to the trigger");

  if (width === 1440) {
    await page.waitForFunction(() => window.__fleetCamera.camera && !document.querySelector("[data-building]"));
    const defaultCamera = await settledCamera(page);
    const canvas = await page.locator("canvas").boundingBox();
    const x = canvas.x + canvas.width / 2,
      y = canvas.y + canvas.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 160, y + 60, { steps: 8 });
    await page.mouse.up();
    const orbitedCamera = await settledCamera(page);
    assert.ok(
      orbitedCamera.some((v, k) => Math.abs(v - defaultCamera[k]) > 0.1),
      "Dragging moves the camera away from its default view",
    );
    await activate(trigger);
    await activate(dialog.getByRole("button", { pressed: true }));
    await waitForClosed();
    const reselectedCamera = await settledCamera(page);
    assert.ok(
      reselectedCamera.every((v, k) => Math.abs(v - orbitedCamera[k]) < 1e-3),
      `Re-selecting the current airplane preserves the orbited camera: ${reselectedCamera} vs ${orbitedCamera}`,
    );
    await page.getByRole("button", { name: "Preflight", exact: true }).click();
    await page.locator(".app.walking").waitFor();
    await activate(trigger);
    await activate(dialog.getByRole("button", { pressed: true }));
    await waitForClosed();
    assert.equal(await page.locator(".app.walking").count(), 1, "Re-selecting SR20 preserves its walk-around");
  }
  await activate(trigger);
  await activate(dialog.getByRole("button", { name: /M20C Ranger/ }));
  await waitForClosed();
  await page.waitForURL("**/m20c/overview");
  assert.match(await page.locator(".brand h1").innerText(), /M20C Ranger/);
  assert.equal(await page.evaluate(() => localStorage.getItem("fleetAc")), "m20c");
  assert.equal(await page.locator(".app.walking").count(), 0, "Switching airplanes exits the previous walk-around");
  await activate(trigger);
  assert.match(await dialog.getByRole("button", { pressed: true }).innerText(), /M20C Ranger/);
  await page.keyboard.press("Escape");
  await waitForClosed();
  assert.ok(await trigger.evaluate((el) => el === document.activeElement));
  await activate(trigger);
  if (touch) await page.touchscreen.tap(width - 2, height - 2);
  else await page.mouse.click(width - 2, height - 2);
  await waitForClosed();
  await activate(trigger);
  await activate(trigger);
  await waitForClosed();
  await activate(trigger);
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await waitForClosed();
  if (touch) {
    // Linux WebKit focuses tapped buttons; Safari may instead blur the old option with relatedTarget=null.
    // Exercise that browser focus sequence during a real tap, before the synthesized click is delivered.
    await page.evaluate(() => {
      document.addEventListener(
        "mousedown",
        function blurWithoutReplacement(event) {
          if (!event.target.closest?.(".fleet-option")) return;
          document.removeEventListener("mousedown", blurWithoutReplacement, true);
          event.preventDefault();
          document.activeElement?.blur();
        },
        true,
      );
    });
    await activate(trigger);
    await activate(dialog.getByRole("button", { name: /SR20 G6/ }));
    await waitForClosed();
    await page.waitForURL("**/sr20/overview", { timeout: 5000 });
    assert.equal(
      await page.evaluate(() => localStorage.getItem("fleetAc")),
      "sr20",
      "A blur before click must not cancel a touch selection",
    );
    await activate(trigger);
    await activate(dialog.getByRole("button", { name: /M20C Ranger/ }));
    await waitForClosed();
    await page.waitForURL("**/m20c/overview");
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".fleet-current-name")?.textContent === "M20C Ranger");
  assert.deepEqual(errors, []);

  // the engines are picked the same way, and the engine page's picker leads back to an airplane
  await activate(trigger);
  await activate(engines.first());
  await page.waitForURL("**/engines/io390");
  const engineTrigger = page.getByRole("button", { name: /^Switch Airplanes, current engine IO-390/ });
  await engineTrigger.waitFor();
  await activate(engineTrigger);
  assert.match(await dialog.getByRole("button", { pressed: true }).innerText(), /IO-390/);
  await activate(dialog.getByRole("group", { name: "Airplanes" }).getByRole("link", { name: /C172S Skyhawk/ }));
  await page.waitForURL(/\/c172s/);
  await page.waitForFunction(() => document.querySelector(".fleet-current-name")?.textContent === "C172S Skyhawk");
  // and a component page the same way
  await activate(trigger);
  await activate(components.first());
  await page.waitForURL("**/components/carburetor");
  const componentTrigger = page.getByRole("button", { name: /^Switch Airplanes, current component Carburetor/ });
  await componentTrigger.waitFor();
  await activate(componentTrigger);
  assert.match(await dialog.getByRole("button", { pressed: true }).innerText(), /Carburetor/);
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    `${browserName} ${width}×${height} ${theme} ${touch ? "touch" : "mouse"}: selection, walk-around, persistence, keyboard, dismissal and compact layout passed`,
  );
});
