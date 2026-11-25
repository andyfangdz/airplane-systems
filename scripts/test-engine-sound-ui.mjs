import { expect, test } from "@playwright/test";

test("IO-390 audio follows warm idle, pause and shutdown", async ({ page }) => {
  // Tap the real output before it reaches the speakers, including in headless Chromium.
  await page.addInitScript(() => {
    const connect = AudioWorkletNode.prototype.connect;
    AudioWorkletNode.prototype.connect = function (destination, ...args) {
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser();
        connect.call(this, analyser);
        window.engineOutput = analyser;
      }
      return connect.call(this, destination, ...args);
    };
  });
  await page.goto("/engines/io390");
  const sound = page.getByRole("checkbox", { name: "Engine sound" });
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  const peak = () =>
    page.evaluate(() => {
      const analyser = window.engineOutput;
      if (!analyser) return null;
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return samples.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
    });
  await expect(sound).not.toBeChecked();
  await page.getByRole("button", { name: "Warm idle", exact: true }).click();
  expect(await peak()).toBeNull();
  await sound.check();
  await expect.poll(peak).toBeGreaterThan(0.03);
  await pause.click();
  await expect.poll(peak).toBe(0);
  await pause.click();
  await expect.poll(peak).toBeGreaterThan(0.03);
  await page.getByRole("button", { name: "Cold and stopped", exact: true }).click();
  await expect.poll(peak).toBe(0);
  await sound.uncheck();
  await expect.poll(() => page.evaluate(() => window.engineOutput.context.state)).toBe("closed");
});
