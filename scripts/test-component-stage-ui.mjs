import { test, expect } from "@playwright/test";

/** The actual projected labels must remain usable after initial framing, orbit, and responsive resize. */
const labelLayout = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector(".eng-view canvas"),
      stage = canvas.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const overlays =
      getComputedStyle(document.querySelector(".eng-app")).display === "grid"
        ? ".eng-app .toolbar, .eng-app .eng-foot, .inj-legend"
        : ".eng-app .toolbar, .inj-legend";
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
    await page.setViewportSize({ width: 390, height: 844 });
    await check(true);
    if (route === "engines/tsio550k") {
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
  await context.addInitScript(() => {
    window.__stageCameraProbe = { camera: null, stable: 0, previous: "" };
    const devtools = new EventTarget();
    devtools.addEventListener("observe", ({ detail: renderer }) => {
      if (!renderer?.isWebGLRenderer) return;
      const render = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        const probe = window.__stageCameraProbe;
        probe.camera = camera;
        const pose = [...camera.position.toArray(), ...camera.quaternion.toArray()].map((x) => x.toFixed(5)).join(",");
        probe.stable = probe.previous === pose ? probe.stable + 1 : 0;
        probe.previous = pose;
        return render(scene, camera);
      };
    });
    window.__THREE_DEVTOOLS__ = devtools;
  });
  await page.route("**/_vercel/**", (request) => request.fulfill({ status: 204, body: "" }));
  await page.goto(`${baseURL}/engines/tsio550k`);
  await page.waitForFunction(() => window.__stageCameraProbe.stable > 10);
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
  await page.waitForFunction(() => window.__stageCameraProbe.stable > 10);
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
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForFunction(() => window.__stageCameraProbe.stable > 10);
  const reset = await pose();
  expect(Math.max(...reset.map((v, i) => Math.abs(v - explored[i])))).toBeGreaterThan(0.05);
  // Reset uses the new caption height, not the original home frame.
  expect(Math.max(...reset.map((v, i) => Math.abs(v - home[i])))).toBeGreaterThan(0.01);
  await expect.poll(async () => (await labelLayout(page)).problems).toEqual([]);
});
