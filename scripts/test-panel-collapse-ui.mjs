import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Exercise taps and clipping in the real layout; hidden content alone does not prove a panel is usable.
test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto(`${baseURL}/c172s/overview`);
  await page.waitForSelector("canvas");
  await page.waitForFunction(
    () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
    null,
    { timeout: 120_000 },
  );
  const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
  if (await addAll.isVisible()) await addAll.click();
  await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120_000 });
  mkdirSync(".shots", { recursive: true });
});

test("reopening systems reveals a system selected while the rail was hidden", async ({ page, isMobile }) => {
  const activate = (button) => (isMobile ? button.tap() : button.click());
  await activate(page.getByRole("button", { name: "Hide systems panel", exact: true }));
  const lastSystem = page.locator(".overview-grid button").last();
  const name = await lastSystem.locator("b").innerText();
  await activate(lastSystem);
  await activate(page.getByRole("button", { name: "Show systems panel", exact: true }));
  const selected = page.locator('.syslist button[aria-current="true"]');
  await expect(selected.locator(".nm")).toHaveText(name);
  await expect
    .poll(
      () =>
        selected.evaluate((button) => {
          const b = button.getBoundingClientRect(),
            list = button.closest("ul").getBoundingClientRect();
          return b.left >= list.left && b.right <= list.right && b.top >= list.top && b.bottom <= list.bottom;
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  await page.screenshot({ path: `.shots/review-selected-system-${isMobile ? "phone" : "desktop"}.png` });
});

test("active phone preflight keeps the details opener and check navigation reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The sticky scene and bottom details panel are specific to phones");
  await page.getByRole("button", { name: "Preflight", exact: true }).tap();
  await page.getByRole("button", { name: "Begin study walk", exact: true }).tap();
  await page.locator(".walk-scene .walk-actions").waitFor();
  await page.getByRole("button", { name: "Hide details panel", exact: true }).tap();
  await expect(page.locator("#details-panel")).toBeHidden();
  assert.equal((await page.locator(".panel").boundingBox()).height, 0, "No empty panel bar remains");
  const show = page.getByRole("button", { name: "Show details panel", exact: true });
  await expect
    .poll(
      () =>
        show.evaluate((button) => {
          const box = button.getBoundingClientRect();
          return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  const current = await page.locator(".walk-scene .walk-id").innerText();
  await page.locator(".walk-scene").getByRole("button", { name: "Next item", exact: true }).tap();
  await expect(page.locator(".walk-scene .walk-id")).not.toHaveText(current);
  await page.screenshot({ path: ".shots/review-preflight-details-collapsed.png" });
  await show.tap();
  await expect(page.locator("#details-panel")).toBeVisible();
  await page.locator(".walk-x").tap();
  await expect(page.locator(".walk")).toHaveCount(0);
});
