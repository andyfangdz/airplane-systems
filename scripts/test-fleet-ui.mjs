#!/usr/bin/env node
/** Airplane chooser regressions. Run after npm run build, or pass an existing server URL. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
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
  mkdirSync(join(root, ".shots"), { recursive: true });
  for (const [width, height, theme] of [
    [1440, 900, "light"],
    [980, 800, "dark"],
    [390, 844, "light"],
    [320, 640, "dark"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript((theme) => {
      localStorage.setItem("tourDone", "1");
      localStorage.setItem("sr20theme", theme);
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto(`${base}/sr20/electrical`);
    const trigger = page.getByRole("button", { name: /^Change airplane/ });
    const dialog = page.getByRole("dialog", { name: "Choose an airplane" });
    const choices = dialog.getByRole("group", { name: "Airplanes" }).getByRole("button");
    const waitForClosed = async () => {
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => document.querySelector(".fleet-trigger")?.getAttribute("aria-expanded") === "false",
      );
    };
    await trigger.focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor();
    assert.equal(await choices.count(), 6);
    for (const name of ["SR20 G6", "SR22T G6"])
      assert.match(await choices.filter({ hasText: name }).innerText(), /Walk-around/);
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await dialog.getByRole("button", { pressed: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed")), "true");
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
    assert.ok(box.width <= 352 && box.height <= 400, "The entire fleet fits in a compact dropdown");
    assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), "No horizontal scrolling");
    assert.ok((await trigger.boundingBox()).height >= 44, "Touch-sized trigger");
    assert.ok((await page.locator(".brand").boundingBox()).height < 140, "The picker adds no separate button row");
    for (const choice of await choices.all()) assert.ok((await choice.boundingBox()).height >= 44);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: join(root, `.shots/fleet-${width}-${theme}.png`) });

    await page.keyboard.press("ArrowDown");
    assert.ok(await choices.nth(1).evaluate((el) => el === document.activeElement));
    await page.keyboard.press("End");
    assert.ok(await choices.nth(5).evaluate((el) => el === document.activeElement));
    await page.keyboard.press("ArrowDown");
    assert.ok(await choices.nth(0).evaluate((el) => el === document.activeElement));
    await page.keyboard.press("ArrowUp");
    assert.ok(await choices.nth(5).evaluate((el) => el === document.activeElement));
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await waitForClosed();
    assert.equal(new URL(page.url()).pathname, "/sr20/electrical", "Selecting the current plane preserves its system");
    assert.ok(await trigger.evaluate((el) => el === document.activeElement), "Focus returns to the trigger");

    if (width === 1440) {
      await page.getByRole("button", { name: "Preflight", exact: true }).click();
      await page.locator(".app.walking").waitFor();
      await trigger.click();
      await dialog.getByRole("button", { pressed: true }).click();
      await waitForClosed();
      assert.equal(await page.locator(".app.walking").count(), 1, "Re-selecting SR20 preserves its walk-around");
    }
    await trigger.click();
    await dialog.getByRole("button", { name: /M20C Ranger/ }).click();
    await waitForClosed();
    await page.waitForURL("**/m20c/overview");
    assert.match(await page.locator(".brand h1").innerText(), /M20C Ranger/);
    assert.equal(await page.evaluate(() => localStorage.getItem("fleetAc")), "m20c");
    assert.equal(await page.locator(".app.walking").count(), 0, "Switching airplanes exits the previous walk-around");
    await trigger.click();
    assert.match(await dialog.getByRole("button", { pressed: true }).innerText(), /M20C Ranger/);
    await page.keyboard.press("Escape");
    await waitForClosed();
    assert.ok(await trigger.evaluate((el) => el === document.activeElement));
    await trigger.click();
    await page.mouse.click(width - 2, height - 2);
    await waitForClosed();
    await trigger.click();
    await trigger.click();
    await waitForClosed();
    await trigger.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Tab");
    await waitForClosed();
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".brand h1")?.textContent === "M20C Ranger");
    assert.deepEqual(errors, []);
    console.log(
      `${width}×${height} ${theme}: selection, walk-around, persistence, keyboard, dismissal and compact layout passed`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}
