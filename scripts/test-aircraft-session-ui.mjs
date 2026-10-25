/** Route ownership regressions: run against the integrated production build, including its real Next navigation. */
import assert from "node:assert/strict";
import { test, expect } from "@playwright/test";

test.use({ trace: "off" }); // Camera settling must not depend on trace screenshot overhead.

function observeSession() {
  localStorage.setItem("tourDone", "1");
  const state = (window.__aircraftSession = {
    documentId: crypto.randomUUID(),
    camera: null,
    aircraft: false,
    frames: 0,
  });
  const devtools = new EventTarget();
  devtools.addEventListener("observe", ({ detail: renderer }) => {
    if (!renderer?.isWebGLRenderer) return;
    const render = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      state.camera = camera;
      state.aircraft = !!scene.getObjectByName("aircraft-model");
      state.frames++;
      return render(scene, camera);
    };
  });
  window.__THREE_DEVTOOLS__ = devtools;
}

async function ready(page) {
  await page.waitForFunction(
    () => window.__aircraftSession?.aircraft && !document.querySelector("[data-building]"),
    null,
    { timeout: 120_000 },
  );
}

async function cameraPose(page) {
  await ready(page);
  await page.waitForTimeout(1200); // A requested flight lasts one second.
  const read = async () => {
    const frame = await page.evaluate(() => window.__aircraftSession.frames);
    await page.waitForFunction((before) => window.__aircraftSession.frames >= before + 2, frame);
    return page.evaluate(() => {
      const camera = window.__aircraftSession.camera;
      camera.updateMatrixWorld();
      return [...camera.position.toArray(), ...camera.getWorldDirection(camera.position.clone()).toArray()];
    });
  };
  let previous = await read();
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.waitForTimeout(100);
    const current = await read();
    if (current.every((value, index) => Math.abs(value - previous[index]) < 1e-6)) return current;
    previous = current;
  }
  throw new Error("Aircraft session camera did not settle");
}

const picker = (page) => page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
async function chooseAircraft(page, name) {
  await page.getByRole("button", { name: /^Switch (airplane|simulation)/ }).click();
  await picker(page).getByRole("group", { name: "Airplanes" }).getByText(name, { exact: true }).click();
}
async function chooseDestination(page, group, path) {
  await page.getByRole("button", { name: /^Switch (airplane|simulation)/ }).click();
  await picker(page).getByRole("group", { name: group }).locator(`a[href="${path}"]`).click();
}
async function chooseSystem(page, name) {
  await page
    .locator(".syslist")
    .getByRole("button", { name: new RegExp(`^${name}(?:\\s|$)`) })
    .click();
}
async function beginWalk(page) {
  await page.locator(".toolbar").getByRole("button", { name: "Preflight", exact: true }).click();
  await page.getByRole("button", { name: "Begin study walk", exact: true }).click();
  await expect(page.locator(".walk-id")).toBeVisible();
}
async function exitWalk(page) {
  await page.locator(".walk-x").click();
  await expect(page.locator(".walk")).toHaveCount(0);
}
function sameCamera(actual, expected, message) {
  assert.ok(
    actual.every((value, index) => Math.abs(value - expected[index]) < 1e-3),
    `${message}: ${JSON.stringify({ actual, expected })}`,
  );
}

for (const [group, destination] of [
  ["Engines", "/engines/o360"],
  ["Components", "/components/carburetor"],
]) {
  test(`walk departure to ${destination} restores the aircraft and offers resume on return`, async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await context.addInitScript(observeSession);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}${destination}`);
    const documentId = await page.evaluate(() => window.__aircraftSession.documentId);
    await chooseAircraft(page, "C172S Skyhawk");
    await page.waitForURL("**/c172s/overview");
    await chooseSystem(page, "Fuel");
    await page.waitForURL("**/c172s/fuel");
    await ready(page);
    await page.locator("#pump").check();
    const before = await cameraPose(page);

    await beginWalk(page);
    const reviewed = await page.locator(".walk-id").innerText();
    await page.getByRole("button", { name: "✓ Reviewed", exact: true }).click();
    await expect(page.locator(".walk-id")).not.toHaveText(reviewed);
    const resumeAt = await page.locator(".walk-id").innerText();
    assert.equal(new URL(page.url()).pathname, "/c172s/fuel", "Walk highlighting does not navigate");

    // The phone hides its rail during study; browser Back is its real route-exit path.
    if (isMobile) await page.goBack();
    else await chooseDestination(page, group, destination);
    await page.waitForURL(`**${destination}`);
    await expect(page.locator(".eng-app")).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("c172s-walkaround")));
    assert.equal(saved.at, resumeAt);
    assert.equal(saved.marks[reviewed], "ok");

    if (isMobile) await page.goForward();
    else await chooseAircraft(page, "C172S Skyhawk");
    await page.waitForURL("**/c172s/fuel");
    await expect(page.getByRole("heading", { name: "Resume C172S study walk?", exact: true })).toBeVisible();
    await expect(page.locator(".walk-id")).toHaveCount(0);
    assert.equal(
      await page.evaluate(() => window.__aircraftSession.documentId),
      documentId,
      "The regression exercises client navigation and retained runtime state, not full document reloads",
    );
    await exitWalk(page);
    await expect(page.locator("#pump")).toBeChecked();
    await expect(page.locator('.syslist button[aria-current="true"] .nm')).toHaveText("Fuel");
    assert.equal(new URL(page.url()).pathname, "/c172s/fuel");
    sameCamera(await cameraPose(page), before, "Return restores this route's fuel camera, not the old walk camera");

    await page.locator(".toolbar").getByRole("button", { name: "Preflight", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.locator(".walk-id")).toHaveText(resumeAt);
    if (isMobile) await exitWalk(page);
    // A rail choice ends temporary study without replacing the mounted aircraft session.
    await chooseSystem(page, "Electrical");
    await expect(page.locator(".walk")).toHaveCount(0);
    await page.waitForURL("**/c172s/electrical");
    await expect(page.locator('.syslist button[aria-current="true"] .nm')).toHaveText("Electrical");
    assert.deepEqual(errors, []);
  });
}

test("an automatically resumed walk restores its own aircraft camera after a different aircraft", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addInitScript(observeSession);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/c182t/overview`);
  const expected = await cameraPose(page);
  await beginWalk(page);
  await page.getByRole("button", { name: "Next item", exact: true }).click();
  await exitWalk(page);
  await chooseAircraft(page, "C172S Skyhawk");
  await page.waitForURL("**/c172s/overview");
  await chooseSystem(page, "Electrical");
  const otherAircraft = await cameraPose(page);
  assert.ok(otherAircraft.some((value, index) => Math.abs(value - expected[index]) > 0.1));
  await chooseAircraft(page, "C182T Skylane");
  await page.waitForURL("**/c182t/overview");
  await expect(page.getByRole("heading", { name: "Resume C182T study walk?", exact: true })).toBeVisible();
  await exitWalk(page);
  sameCamera(await cameraPose(page), expected, "The old aircraft's camera must not become the walk restore pose");
  await expect(page.locator('.syslist button[aria-current="true"] .nm')).toHaveText("Overview");
  assert.equal(new URL(page.url()).pathname, "/c182t/overview");
  assert.deepEqual(errors, []);
});
