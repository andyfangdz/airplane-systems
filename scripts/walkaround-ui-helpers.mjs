import assert from "node:assert/strict";

export async function openStationMap(page) {
  const map = page.locator(".walk-map-section");
  if (!(await map.evaluate((element) => element.open))) await map.locator("summary").click();
}

/** Check before clicking: Playwright would otherwise scroll a hidden check into view. */
export async function assertCurrentCheckVisible(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visible = await page.evaluate(() => {
    const title = document.querySelector(".walk-line").getBoundingClientRect();
    const standard = document.querySelector(".walk-std").getBoundingClientRect();
    const actions = document.querySelector(".walk-item > .walk-actions").getBoundingClientRect();
    return title.top >= 0 && standard.bottom <= actions.top && actions.bottom <= innerHeight + 1;
  });
  assert.ok(visible, "the current check, expected result, and navigation are visible without manual scrolling");
}
