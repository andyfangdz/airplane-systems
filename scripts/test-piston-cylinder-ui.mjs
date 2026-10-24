import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

for (const [name, viewport] of Object.entries({
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
})) {
  test(`piston cylinder controls and cutaway, ${name}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport });
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
    await expect(page.locator(".piston-label")).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(".shots/piston-cylinder", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.shots/piston-cylinder/${name}.png`, fullPage: true });
    expect(errors).toEqual([]);
    await context.close();
  });
}
