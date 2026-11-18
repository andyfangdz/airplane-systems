import { test, expect } from "@playwright/test";
import { observeStageCamera, waitForStageCamera } from "./stage-camera-probe.mjs";

/** The actual projected labels must remain usable after initial framing, orbit, and responsive resize. */
const labelLayout = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector(".eng-view canvas"),
      stage = canvas.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const overlays =
      getComputedStyle(document.querySelector(".eng-app")).display === "grid"
        ? ".eng-app .toolbar, .eng-app .eng-foot, .inj-legend, .eng-app .model-size-toggle"
        : ".eng-app .toolbar, .inj-legend, .eng-app .model-size-toggle";
    const obstacles = [...document.querySelectorAll(overlays)].map((el) => el.getBoundingClientRect());
    const labels = [...document.querySelectorAll(".eng-label")]
      .filter((el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width)
      .map((el) => ({ name: el.textContent, box: el.getBoundingClientRect() }));
    const problems = [];
    labels.forEach(({ name, box }, i) => {
      if (box.left < stage.left || box.right > stage.right || box.top < stage.top || box.bottom > stage.bottom)
        problems.push(`${name} is clipped`);
      if (obstacles.some((other) => overlaps(box, other))) problems.push(`${name} is under controls`);
      if (labels.slice(i + 1).some((other) => overlaps(box, other.box)))
        problems.push(`${name} overlaps another label`);
    });
    return { count: labels.length, problems };
  });

for (const route of ["engines/tsio550k", "components/governor", "components/pitot-static"]) {
  test(`${route}: clear labels on desktop and phone after orbit and reset`, async ({ page, context, baseURL }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(() => localStorage.setItem("sr20theme", "light"));
    await page.route("**/_vercel/**", (request) => request.fulfill({ status: 204, body: "" }));
    const checkScroll = route === "engines/tsio550k";
    if (checkScroll) await observeStageCamera(context);
    await page.goto(`${baseURL}/${route}`);
    await page.locator(".eng-view canvas").waitFor();
    const check = async (phone) => {
      await expect
        .poll(async () => {
          const layout = await labelLayout(page);
          return layout.count >= 2 && (!phone || layout.count <= 6) && layout.problems.length === 0;
        })
        .toBe(true);
    };
    await check(false);
    if (checkScroll) await waitForStageCamera(page);
    const desktopPose = checkScroll ? await page.evaluate(() => window.__stageCameraProbe.previous) : null;
    await page.setViewportSize({ width: 390, height: 844 });
    await check(true);
    if (checkScroll) {
      // Phone labels can appear a frame before the resized camera is fitted. Measure scrolling from that new pose.
      await page.waitForFunction((desktop) => window.__stageCameraProbe.previous !== desktop, desktopPose);
      await waitForStageCamera(page);
      const anchor = await page.evaluate(() => {
        const label = [...document.querySelectorAll(".eng-label")].find(
          (el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width,
        );
        const stage = document.querySelector(".eng-view canvas").getBoundingClientRect();
        return { name: label.textContent, y: label.getBoundingClientRect().top - stage.top };
      });
      await page.evaluate(() => scrollBy(0, 160));
      // The monitor now passes behind the sticky stage. It must not shrink or move the model as an overlay would.
      await page.waitForTimeout(500);
      const relativeTop = await page.evaluate((name) => {
        const label = [...document.querySelectorAll(".eng-label")].find((el) => el.textContent === name);
        return (
          label.getBoundingClientRect().top - document.querySelector(".eng-view canvas").getBoundingClientRect().top
        );
      }, anchor.name);
      expect(Math.abs(relativeTop - anchor.y)).toBeLessThan(1);
      await check(true);
      await page.evaluate(() => scrollTo(0, 0));
    }
    const canvas = await page.locator(".eng-view canvas").boundingBox();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 65, canvas.y + canvas.height / 2 + 20, { steps: 12 });
    await page.mouse.up();
    if (route.startsWith("engines/")) await page.getByRole("button", { name: "Engine controls" }).click();
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await check(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await check(false);
    expect(errors).toEqual([]);
  });
}

test("a live monitor caption preserves an explored camera, while Reset view fits the new overlay", async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await observeStageCamera(context);
  await page.route("**/_vercel/**", (request) => request.fulfill({ status: 204, body: "" }));
  await page.goto(`${baseURL}/engines/tsio550k`);
  await waitForStageCamera(page);
  const pose = () =>
    page.evaluate(() => {
      const camera = window.__stageCameraProbe.camera;
      return [...camera.position.toArray(), ...camera.quaternion.toArray()];
    });
  const home = await pose();
  const canvas = await page.locator(".eng-view canvas").boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 100, canvas.y + canvas.height / 2 + 30, { steps: 15 });
  await page.mouse.up();
  await waitForStageCamera(page);
  const explored = await pose();
  expect(Math.max(...home.map((v, i) => Math.abs(v - explored[i])))).toBeGreaterThan(0.05);
  const before = await page.locator(".eng-foot").boundingBox();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".eng-motion-state")).toHaveText("Simulation paused");
  const after = await page.locator(".eng-foot").boundingBox();
  expect(after.height).toBeGreaterThan(before.height + 10);
  // This exceeds the layout polling interval, proving that a real overlay resize does not reset the camera.
  await page.waitForTimeout(600);
  const withCaption = await pose();
  expect(Math.max(...explored.map((v, i) => Math.abs(v - withCaption[i])))).toBeLessThan(0.001);
  // A production event can return before the next rendered frame. Do not accept the old, already-stable pose.
  await page.evaluate(() => {
    window.__stageCameraProbe.stable = 0;
  });
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect
    .poll(async () => {
      const current = await pose();
      return Math.max(...current.map((v, i) => Math.abs(v - explored[i])));
    })
    .toBeGreaterThan(0.05);
  await waitForStageCamera(page);
  const reset = await pose();
  expect(Math.max(...reset.map((v, i) => Math.abs(v - explored[i])))).toBeGreaterThan(0.05);
  // Reset uses the new caption height, not the original home frame.
  expect(Math.max(...reset.map((v, i) => Math.abs(v - home[i])))).toBeGreaterThan(0.01);
  await expect.poll(async () => (await labelLayout(page)).problems).toEqual([]);
});

test("ignition keeps its focused framing through orbit and reset, then clears it in the overview", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await observeStageCamera(context);
  await page.goto("/engines/io390");
  await page.getByRole("button", { name: "Blow up", exact: true }).click();
  await page.getByRole("combobox", { name: "Focus a part group" }).selectOption("ignition");
  await page.waitForFunction(() => window.__stageCameraProbe.camera?.view?.enabled);
  await waitForStageCamera(page);
  const pose = () => page.evaluate(() => window.__stageCameraProbe.previous);
  const home = await pose();
  const canvas = await page.locator(".eng-view canvas").boundingBox();
  const orbit = async () => {
    const x = canvas.x + canvas.width / 2,
      y = canvas.y + canvas.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 20, { steps: 5 });
    await page.mouse.up();
  };
  await orbit();
  await expect.poll(pose).not.toBe(home);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(pose).toBe(home);
  await page.getByRole("button", { name: "Blow up group", exact: true }).click();
  await expect.poll(pose).not.toBe(home);
  await waitForStageCamera(page);
  expect(await page.evaluate(() => window.__stageCameraProbe.camera.view.enabled)).toBe(true);
  await page.getByRole("button", { name: "Part groups", exact: true }).click();
  await orbit();
  await page.waitForFunction(() => !window.__stageCameraProbe.camera.view.enabled);
});
