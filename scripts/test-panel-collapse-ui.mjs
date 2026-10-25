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

test("tablet navigation preserves model width and selecting a system keeps the controls available", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Tablet layout is checked with a desktop browser viewport");
  await page.setViewportSize({ width: 900, height: 800 });
  const stage = await page.locator(".stage").boundingBox();
  expect(stage.width).toBeGreaterThanOrEqual(550);
  await page
    .locator(".syslist")
    .getByRole("button", { name: /Electrical/ })
    .click();
  await expect(page.locator(".panel h2")).toHaveText("Electrical");
  await page.screenshot({ path: ".shots/tablet-study-navigation.png" });
});

test("phone reading space keeps the model visible and restores its previous size", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Reading space is a phone layout option");
  const height = (await page.locator(".stage").boundingBox()).height;
  const reading = page.getByRole("button", { name: "More reading space", exact: true });
  await page.screenshot({ path: ".shots/phone-study-before-reading.png" });
  await reading.tap();
  const compactHeight = (await page.locator(".stage").boundingBox()).height;
  expect(compactHeight).toBeLessThan(height - 50);
  expect(compactHeight).toBeGreaterThanOrEqual(210);
  await expect(page.locator("canvas")).toBeVisible();
  // The responsive canvas buffer and camera fit follow ResizeObserver, after the CSS box has resized.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".shots/phone-study-reading.png" });
  await page.getByRole("button", { name: "Expand model", exact: true }).tap();
  expect((await page.locator(".stage").boundingBox()).height).toBeCloseTo(height, 0);
  await page.screenshot({ path: ".shots/phone-study-navigation.png" });
});

test("skip to controls opens a collapsed panel and moves keyboard focus", async ({ page }) => {
  await page.getByRole("button", { name: "Hide details panel", exact: true }).click();
  const skip = page.getByRole("link", { name: "Skip to system controls" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#details-panel")).toBeVisible();
  await expect(page.locator("#details-panel")).toBeFocused();
});

test("phone circuit breakers keep touch-sized hit areas", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch sizes apply to coarse pointers");
  await page
    .locator(".syslist")
    .getByRole("button", { name: /Electrical/ })
    .click();
  await expect(page.locator(".bus button.chip").first()).toBeAttached();
  const sizes = await page.locator(".bus button.chip").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(sizes.length).toBeGreaterThan(10);
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
});
