#!/usr/bin/env node
/** Airplane chooser regressions. Run after npm run build, or pass an existing server URL. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { join, resolve } from "node:path";
import { chromium, webkit, devices } from "playwright-core";

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
  mkdirSync(join(root, ".shots"), { recursive: true });
  for (const [engine, width, height, theme] of [
    [chromium, 1440, 900, "light"],
    [chromium, 980, 800, "dark"],
    [chromium, 390, 844, "light"],
    [chromium, 320, 640, "dark"],
    [webkit, 390, 844, "light"],
    [webkit, 320, 640, "dark"],
  ]) {
    if (browser?.browserType() !== engine) {
      await browser?.close();
      browser = await engine.launch(
        engine === chromium ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } : {},
      );
    }
    const touch = width < 860;
    const device = touch ? devices[engine === webkit ? "iPhone 13" : "Pixel 7"] : {};
    const context = await browser.newContext({ ...device, viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript((theme) => {
      localStorage.setItem("tourDone", "1");
      localStorage.setItem("sr20theme", theme);
    }, theme);
    const page = await context.newPage();
    const activate = (locator) => (touch ? locator.tap() : locator.click());
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto(`${base}/sr20/electrical`);
    const trigger = page.getByRole("button", { name: /^Switch Airplanes/ });
    await trigger.waitFor();
    assert.ok(
      await trigger.getByText("Switch Airplanes", { exact: true }).isVisible(),
      "The control explicitly names the switching action",
    );
    const dialog = page.getByRole("dialog", { name: "Choose an airplane" });
    const choices = dialog.getByRole("group", { name: "Airplanes" }).getByRole("button");
    const waitForClosed = async () => {
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => document.querySelector(".fleet-trigger")?.getAttribute("aria-expanded") === "false",
      );
    };
    if (touch) await activate(trigger);
    else {
      await trigger.focus();
      await page.keyboard.press("Enter");
    }
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
    await page.screenshot({ path: join(root, `.shots/fleet-${engine.name()}-${width}-${theme}.png`) });

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
      await activate(trigger);
      await activate(dialog.getByRole("button", { pressed: true }));
      await waitForClosed();
      assert.equal(await page.locator(".app.walking").count(), 1, "Re-selecting SR20 preserves its walk-around");
    }
    await activate(trigger);
    await activate(dialog.getByRole("button", { name: /M20C Ranger/ }));
    await waitForClosed();
    await page.waitForURL("**/m20c/overview");
    assert.match(await page.locator(".brand h1").innerText(), /M20C Ranger/);
    assert.equal(await page.evaluate(() => localStorage.getItem("fleetAc")), "m20c");
    assert.equal(await page.locator(".app.walking").count(), 0, "Switching airplanes exits the previous walk-around");
    await activate(trigger);
    assert.match(await dialog.getByRole("button", { pressed: true }).innerText(), /M20C Ranger/);
    await page.keyboard.press("Escape");
    await waitForClosed();
    assert.ok(await trigger.evaluate((el) => el === document.activeElement));
    await activate(trigger);
    if (touch) await page.touchscreen.tap(width - 2, height - 2);
    else await page.mouse.click(width - 2, height - 2);
    await waitForClosed();
    await activate(trigger);
    await activate(trigger);
    await waitForClosed();
    await activate(trigger);
    await page.keyboard.press("End");
    await page.keyboard.press("Tab");
    await waitForClosed();
    if (touch) {
      // Linux WebKit focuses tapped buttons; Safari may instead blur the old option with relatedTarget=null.
      // Exercise that browser focus sequence during a real tap, before the synthesized click is delivered.
      await page.evaluate(() => {
        document.addEventListener(
          "mousedown",
          function blurWithoutReplacement(event) {
            if (!event.target.closest?.(".fleet-option")) return;
            document.removeEventListener("mousedown", blurWithoutReplacement, true);
            event.preventDefault();
            document.activeElement?.blur();
          },
          true,
        );
      });
      await activate(trigger);
      await activate(dialog.getByRole("button", { name: /SR20 G6/ }));
      await waitForClosed();
      await page.waitForURL("**/sr20/overview", { timeout: 5000 });
      assert.equal(
        await page.evaluate(() => localStorage.getItem("fleetAc")),
        "sr20",
        "A blur before click must not cancel a touch selection",
      );
      await activate(trigger);
      await activate(dialog.getByRole("button", { name: /M20C Ranger/ }));
      await waitForClosed();
      await page.waitForURL("**/m20c/overview");
    }
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".fleet-current-name")?.textContent === "M20C Ranger");
    assert.deepEqual(errors, []);
    console.log(
      `${engine.name()} ${width}×${height} ${theme} ${touch ? "touch" : "mouse"}: selection, walk-around, persistence, keyboard, dismissal and compact layout passed`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}
