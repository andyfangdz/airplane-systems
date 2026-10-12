import assert from "node:assert/strict";

/** Check before clicking: Playwright would otherwise scroll a hidden check into view. */
export async function assertCurrentCheckVisible(page) {
  await page.waitForSelector(".stage .walk-scene .walk-actions");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visible = await page.evaluate(() => {
    const scene = document.querySelector(".stage").getBoundingClientRect();
    const title = document.querySelector(".walk-scene .walk-line").getBoundingClientRect();
    const standard = document.querySelector(".walk-scene .walk-std").getBoundingClientRect();
    const actions = document.querySelector(".walk-scene .walk-actions").getBoundingClientRect();
    return (
      scene.top >= 0 &&
      title.top >= scene.top &&
      Math.abs(title.top - standard.top) < 8 &&
      standard.bottom <= actions.top &&
      actions.bottom <= Math.min(scene.bottom, innerHeight) &&
      actions.left >= 0 &&
      actions.right <= innerWidth
    );
  });
  assert.ok(visible, "the single-line check and navigation fit in the scene without manual scrolling");
  assert.ok(await page.locator(".walk-map").isVisible(), "the station map stays expanded");
}
