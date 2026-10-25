import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`pitot-static controls, alternate recovery and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/components/pitot-static");
    await expect(page.getByRole("heading", { name: "Pitot-static system", exact: true })).toBeVisible();
    const altitude = page.getByLabel("Altimeter", { exact: true });
    await expect(altitude).toHaveText("5000");
    await page.getByLabel("Load scenario").selectOption({ label: "Static port blocked" });
    await page.getByLabel("Use alternate cabin static").check();
    await expect.poll(async () => Number(await altitude.textContent())).toBeGreaterThan(5000);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const frozen = await altitude.textContent();
    await page.getByLabel("Cabin pressure below ambient").fill("250");
    await page.waitForTimeout(250);
    await expect(altitude).toHaveText(frozen);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect.poll(async () => Number(await altitude.textContent())).toBeGreaterThan(Number(frozen));
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(altitude).toHaveText("5000");
    await expect(page.getByLabel("Use alternate cabin static")).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
