import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

for (const [name, viewport] of Object.entries({
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
})) {
  test(`piston cylinder controls and cutaway, ${name}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.__cylinderScene = { scene: null, frames: 0 };
      const devtools = new EventTarget();
      devtools.addEventListener("observe", ({ detail: renderer }) => {
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene, camera) => {
          window.__cylinderScene.scene = scene;
          window.__cylinderScene.frames++;
          return render(scene, camera);
        };
      });
      window.__THREE_DEVTOOLS__ = devtools;
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/components/piston-cylinder`);
    await expect(page.getByRole("heading", { name: "Inside the cylinder" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    const angle = page.locator("#piston-angle");
    await page.getByRole("button", { name: "Reset to firing TDC" }).click();
    await expect(angle).toHaveValue("0");
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(250);
    await expect(angle).toHaveValue("0");
    // Read the actual rendered scene, not the model or the angle readout.
    const poseAt = async (phase) => {
      await angle.fill(String(phase));
      const frame = await page.evaluate(() => window.__cylinderScene.frames);
      await page.waitForFunction((before) => window.__cylinderScene.frames >= before + 2, frame);
      return page.evaluate(() => {
        const scene = window.__cylinderScene.scene;
        scene.updateMatrixWorld(true);
        const part = (name) => scene.getObjectByName(`cylinder-${name}`);
        const piston = part("piston"),
          rod = part("rod"),
          crank = part("crank"),
          pin = part("crankpin");
        const length = rod.children[0].geometry.parameters.height;
        const upper = rod.localToWorld(rod.position.clone().set(0, length / 2, 0));
        const lower = rod.localToWorld(rod.position.clone().set(0, -length / 2, 0));
        const pistonPin = piston.getWorldPosition(piston.position.clone());
        const crankPin = pin.getWorldPosition(pin.position.clone());
        return {
          pistonY: pistonPin.y,
          rodAngle: rod.rotation.z,
          crankAngle: crank.rotation.z,
          upperGap: upper.distanceTo(pistonPin),
          lowerGap: lower.distanceTo(crankPin),
          rodLength: upper.distanceTo(lower),
          intake: part("intake").position.y,
          exhaust: part("exhaust").position.y,
        };
      });
    };
    const poses = [];
    for (const phase of [0, 90, 180, 270, 450]) {
      const pose = await poseAt(phase);
      expect(pose.upperGap).toBeLessThan(1e-8);
      expect(pose.lowerGap).toBeLessThan(1e-8);
      expect(pose.rodLength).toBeCloseTo(6.75 * 0.0254, 8); // documented illustrative rod length
      poses.push(pose);
    }
    expect(poses[0].pistonY - poses[2].pistonY).toBeCloseTo(4.375 * 0.0254, 8); // IOM Table A-1 stroke
    expect(poses[1].pistonY).toBeLessThan(poses[0].pistonY);
    expect(poses[1].rodAngle).toBeGreaterThan(0.1);
    expect(poses[3].rodAngle).toBeLessThan(-0.1);
    expect(poses[1].crankAngle).toBeCloseTo(-Math.PI / 2, 8);
    expect(poses[3].exhaust).toBeLessThan(-0.001);
    expect(poses[3].intake).toBeCloseTo(0, 8);
    expect(poses[4].intake).toBeLessThan(-0.001);
    expect(poses[4].exhaust).toBeCloseTo(0, 8);
    await page.getByRole("button", { name: "intake", exact: true }).click();
    await expect(angle).toHaveValue("450");
    await expect(page.locator(".piston-monitor strong")).toHaveText("intake");
    await angle.fill("630");
    await expect(page.locator(".piston-monitor strong")).toHaveText("compression");
    await pause.click();
    await expect.poll(async () => Number(await angle.inputValue())).not.toBe(630);
    await pause.click();
    await page.getByRole("button", { name: "Labels", exact: true }).click();
    await expect(page.locator(".piston-label")).toHaveCount(0);
    await page.getByRole("button", { name: "Labels", exact: true }).click();
    await expect(page.locator(".piston-label")).toHaveCount(8);
    await expect(page.getByText("Slow-motion teaching cycle", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Both plugs fouled", exact: true }).click();
    const reading = (label) =>
      page
        .locator(".ro")
        .filter({ has: page.locator("span", { hasText: new RegExp(`^${label}$`) }) })
        .locator("b");
    await expect(reading("Top plug")).toHaveText("Fouled");
    await expect(reading("Bottom plug")).toHaveText("Fouled");
    await expect(reading("Combustion")).toHaveText("No useful burn");
    await page.getByRole("button", { name: "Service plugs", exact: true }).click();
    await expect(reading("Combustion")).toHaveText("Burning");
    await page.getByRole("button", { name: "Exhaust stuck open", exact: true }).click();
    await expect(reading("Combustion")).toHaveText("No useful burn");
    await page.locator("#piston-exhaust-free").click();
    await expect(reading("Combustion")).toHaveText("Burning");
    await page.locator("#piston-mixture").fill("0");
    await expect(reading("Fuel / cylinder")).toHaveText("0.00 gph");
    await expect(reading("Combustion")).toHaveText("No useful burn");
    mkdirSync(".shots/piston-cylinder", { recursive: true });
    for (const [fault, phase, recovery] of [
      ["Detonation", "20", "charge"],
      ["Pre-ignition", "670", "fuel"],
      ["Intake backfire", "360", "mixture"],
    ]) {
      await page.getByRole("button", { name: fault, exact: true }).click();
      await pause.click();
      await angle.fill(phase);
      await expect(reading("Abnormal combustion")).toHaveText(fault);
      await expect(reading("Cycle event")).toHaveText(fault);
      await page.locator(".eng-view").screenshot({ path: `.shots/piston-cylinder/${name}-${recovery}.png` });
      if (recovery === "charge") await page.locator("#piston-load").fill("0.5");
      if (recovery === "fuel") {
        await page.locator("#piston-ignition-off").click();
        await expect(reading("Combustion")).toHaveText("Burning");
        await expect(reading("Abnormal combustion")).toHaveText(fault);
        await page.locator("#piston-mixture").fill("0");
      }
      if (recovery === "mixture") await page.locator("#piston-mixture").fill("1.1");
      await expect(reading("Abnormal combustion")).toHaveText("None");
    }
    await page.getByRole("button", { name: "Normal operation", exact: true }).click();
    await pause.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(".shots/piston-cylinder", { recursive: true });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector(".panel")?.scrollTo(0, 0);
    });
    await page.screenshot({ path: `.shots/piston-cylinder/${name}.png`, fullPage: true });
    expect(errors).toEqual([]);
    await context.close();
  });
}
