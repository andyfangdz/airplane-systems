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

/** A horizontal gesture on the line must not bubble through the portal to item navigation. */
export async function assertCurrentCheckSwipeStaysOnItem(page) {
  const item = await page.locator(".walk-id").innerText();
  await page.locator(".walk-current").evaluate((row) => {
    const touch = (x) => new Touch({ identifier: 1, target: row, clientX: x, clientY: 100 });
    row.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(180)] }));
    row.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [touch(60)] }));
  });
  assert.equal(await page.locator(".walk-id").innerText(), item, "reading a long check must not change items");
}
