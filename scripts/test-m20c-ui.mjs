#!/usr/bin/env node
/** M20C interaction regressions. Run after npm run build, or pass an existing server URL. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(import.meta.dirname, "..");
const port = 4100 + Math.floor(Math.random() * 800);
const base = process.argv[2] || `http://localhost:${port}`;
let server, browser;
try {
  if (!process.argv[2]) {
    server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    server.stdout.on("data", (d) => (log = (log + d).slice(-8000)));
    server.stderr.on("data", (d) => (log = (log + d).slice(-8000)));
    let ready = false;
    for (let i = 0; i < 120; i++) {
      assert.equal(server.exitCode, null, `Server exited: ${log}`);
      try {
        ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {}
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, `Server did not start: ${log}`);
  }
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const phone of [false, true]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
    const page = await context.newPage();
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
    const waitReadout = async (name, value) => {
      await page.waitForFunction(
        ([name, value]) =>
          [...document.querySelectorAll(".ro")].some(
            (row) => row.querySelector("span")?.textContent === name && row.querySelector("b")?.textContent === value,
          ),
        [name, value],
      );
    };
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
    console.log(
      `${phone ? "Touch / phone" : "Pointer + keyboard / desktop"}: gear, flaps and electrical checks passed`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
