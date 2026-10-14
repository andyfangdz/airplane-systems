import assert from "node:assert/strict";
import { test, expect } from "@playwright/test";

test("M20C gear, flaps and electrical controls", async ({ page, context, baseURL: base, isMobile: phone }) => {
  await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Analytics has no bearing on these controls and need not contact a deployment.
  await page.route("**/_vercel/**", (route) => route.abort());
  await page.goto(`${base}/m20c/gear`);
  await page.waitForSelector("canvas");
  const readout = (name) =>
    page
      .locator(".ro")
      .filter({ has: page.getByText(name, { exact: true }) })
      .locator("b");
  const waitReadout = (name, value) => expect(readout(name)).toHaveText(value);
  const up = page.getByRole("button", { name: "Hold to unlatch and retract — GEAR UP", exact: true });
  const down = page.getByRole("button", { name: "Swing to the panel — GEAR DOWN", exact: true });
  await down.click();
  await waitReadout("Gear", "DOWN & LOCKED");
  await up.click(); // A short press must not retract the gear.
  assert.equal(await readout("Handle").innerText(), "Down-lock socket");
  assert.equal(await up.getAttribute("aria-pressed"), "false");

  await up.scrollIntoViewIfNeeded();
  if (phone) {
    const session = await context.newCDPSession(page);
    const box = await up.boundingBox();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await waitReadout("Handle", "Up-lock socket (floor)");
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    const box = await up.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await waitReadout("Handle", "Up-lock socket (floor)");
    await page.mouse.up();
  }
  await waitReadout("Gear", "UP");
  assert.equal(await up.getAttribute("aria-pressed"), "false");

  if (!phone) {
    await down.click();
    await waitReadout("Gear", "DOWN & LOCKED");
    await up.focus();
    await page.keyboard.down("Space");
    await page.keyboard.press("Tab"); // Losing focus cancels an incomplete hold.
    await page.keyboard.up("Space");
    assert.equal(await readout("Handle").innerText(), "Down-lock socket");
    assert.equal(await up.getAttribute("aria-pressed"), "false");
    await up.focus();
    await page.keyboard.down("Space");
    await waitReadout("Handle", "Up-lock socket (floor)");
    await page.keyboard.up("Space");
    await waitReadout("Gear", "UP");
  }

  // Navigate within the app so the aircraft's state is preserved.
  await page
    .getByRole("navigation", { name: "Systems" })
    .getByRole("button", { name: /Wing flaps/ })
    .click();
  await page.getByRole("button", { name: "Two strokes (take-off)", exact: true }).click();
  await waitReadout("Setting", "TAKE-OFF (15°)");
  await page.getByRole("button", { name: "UP — release", exact: true }).click();
  await waitReadout("Setting", "UP");

  await page
    .getByRole("navigation", { name: "Systems" })
    .getByRole("button", { name: /Electrical/ })
    .click();
  const com = page.getByRole("button", { name: "NAV/COM 1 5", exact: true });
  await com.click();
  await waitReadout("NAV/COM 1 · 2", "OFF · ON");
  await com.click();
  await waitReadout("NAV/COM 1 · 2", "ON · ON");
  const xpdr = page.getByRole("button", { name: "XPDR 5", exact: true });
  await xpdr.click();
  await waitReadout("Transponder", "OFF");
  await xpdr.click();
  await waitReadout("Transponder", "ON");
  await page.getByRole("button", { name: "MASTER", exact: true }).click();
  await waitReadout("Bus", "0.0 V");
  await waitReadout("NAV/COM 1 · 2", "OFF · OFF");
  await waitReadout("Transponder", "OFF");
  assert.deepEqual(errors, [], "No application runtime errors");
  console.log(`${phone ? "Touch / phone" : "Pointer + keyboard / desktop"}: gear, flaps and electrical checks passed`);
});
