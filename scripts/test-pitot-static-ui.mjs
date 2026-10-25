import { test, expect } from "@playwright/test";

for (const [name, viewport] of Object.entries({
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
})) {
  test(`pitot-static system: instruments, blockages and the alternate source, ${name}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.__psScene = { scene: null, frames: 0 };
      const devtools = new EventTarget();
      devtools.addEventListener("observe", ({ detail: renderer }) => {
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene, camera) => {
          window.__psScene.scene = scene;
          window.__psScene.frames++;
          return render(scene, camera);
        };
      });
      window.__THREE_DEVTOOLS__ = devtools;
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/components/pitot-static`);
    await expect(page.getByRole("heading", { name: "Flying and reading" })).toBeVisible();
    await expect(page.locator("canvas.ps-dial")).toHaveCount(3);
    // the scene renders: meshes for the system and live instrument faces
    await page.waitForFunction(() => window.__psScene.frames > 5);
    const meshes = await page.evaluate(() => {
      let n = 0;
      window.__psScene.scene.traverse((o) => (n += o.isMesh ? 1 : 0));
      return n;
    });
    expect(meshes).toBeGreaterThan(40);

    const gauge = (i) => page.locator(".ps-gauge").nth(i);
    const value = async (i) =>
      Number((await gauge(i).locator("b").innerText()).replace(/[^\d.−-]/g, "").replace("−", "-"));
    // cruise: 107 KCAS reads 110 KIAS (172S POH Figure 5-1 Sheet 1)
    await expect(gauge(0).locator("b")).toHaveText("110");

    // a blocked static port in a climb: altimeter frozen, VSI at zero, the airspeed falling
    await page.getByRole("button", { name: "Static port blocked, climb", exact: true }).click();
    await expect(page.locator(".ps-note")).toContainText("Static port blocked, climb");
    // set up at 4,000 ft: wait for the gauges to leave cruise
    await expect.poll(() => value(1)).toBeLessThan(4200);
    const frozen = await value(1);
    await expect
      .poll(async () => (await gauge(2).locator("small").innerText()).replace(/\s/g, ""))
      .toMatch(/actual\+[1-9]/);
    await page.waitForTimeout(4000);
    expect(Math.abs((await value(1)) - frozen)).toBeLessThan(5);
    expect(Math.abs(await value(2))).toBeLessThan(20);
    // the POH's answer: ALT STATIC AIR on, and the VSI and altimeter come back
    await page.locator("#ps-alts").check();
    await expect.poll(() => value(2), { timeout: 20_000 }).toBeGreaterThan(300);
    await expect.poll(() => value(1), { timeout: 20_000 }).toBeGreaterThan(frozen + 50);

    // a blocked ram inlet with the drain open: the airspeed falls to zero
    await page.getByRole("button", { name: "Ram inlet blocked", exact: true }).click();
    await expect.poll(() => value(0), { timeout: 40_000 }).toBeLessThan(5);

    // labels and their pressure tags
    const labels = page.getByRole("button", { name: "Labels", exact: true });
    await labels.click();
    await expect(page.locator(".eng-label")).toHaveCount(0);
    await labels.click();
    await expect(page.locator(".ps-tag")).toHaveCount(2);

    // the G1000: the PFD's air data and the standby instruments; an air data computer failure leaves the standby
    await page.getByRole("button", { name: "Cruise", exact: true }).click();
    await page.getByRole("button", { name: "G1000 (NAV III)", exact: true }).click();
    await expect(page.locator("canvas.ps-pfd")).toHaveCount(1);
    await expect(page.locator("canvas.ps-dial")).toHaveCount(2);
    await expect(gauge(0).locator("span")).toContainText("110");
    await expect(gauge(1).locator("b")).toHaveText("110");
    await page.getByRole("button", { name: "G1000: air data computer fails", exact: true }).click();
    await expect(gauge(0).locator("span")).toContainText("red X");
    await expect(gauge(1).locator("b")).toHaveText("110");
    // breaking the VSI glass needs a six-pack: the set-up switches back
    await page.getByRole("button", { name: "No alternate: break the VSI glass", exact: true }).click();
    await expect(page.locator("canvas.ps-dial")).toHaveCount(3);

    // the ramp leak test: the test set takes the altimeter up; it can't be sealed until it's there
    await page.getByRole("button", { name: "Static leak test", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Static system leak test" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seal and time 1 minute" })).toBeDisabled();
    await expect.poll(() => value(1), { timeout: 20_000 }).toBeGreaterThan(200);
    expect(await value(0)).toBe(0);
    // through a taped port the test set gets to its altitude and the instruments don't: sealed, there is no result
    await page.getByRole("button", { name: "Static leak test", exact: true }).click();
    await page.locator("#ps-f-portL").check();
    await page.locator("#ps-test-alt").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    const seal = page.getByRole("button", { name: "Seal and time 1 minute" });
    await expect(seal).toBeEnabled({ timeout: 20_000 });
    await seal.click();
    await expect(page.getByText("No test", { exact: true })).toBeVisible();
    await expect(page.getByText(/never indicated the test altitude/)).toBeVisible();

    expect(errors).toEqual([]);
    await context.close();
  });
}
