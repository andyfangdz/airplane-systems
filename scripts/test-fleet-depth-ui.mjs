#!/usr/bin/env node
/** Source-specific non-Cirrus preflight walks on desktop and phone.
 * Run after npm run build, or pass an existing server: npm run test:ui:depth -- http://localhost:3000 [screenshot-directory]
 */
import assert from "node:assert/strict";
import { assertCurrentCheckSwipeStaysOnItem, assertCurrentCheckVisible } from "./walkaround-ui-helpers.mjs";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";

const root = resolve(import.meta.dirname, "..");
let base = process.argv[2];
let server;
if (!base) {
  const port = 4800 + Math.floor(Math.random() * 700);
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (data) => (log = (log + data).slice(-8000)));
  server.stderr.on("data", (data) => (log = (log + data).slice(-8000)));
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      assert.equal(server.exitCode, null, `Server exited: ${log}`);
      try {
        ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {}
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, `Production server did not start: ${log}`);
  } catch (error) {
    server.kill();
    throw error;
  }
}
const out = resolve(process.argv[3] ?? ".shots/fleet-depth-preflight");
mkdirSync(out, { recursive: true });
const airplanes = [
  ["c172s", "C172S"],
  ["c182t", "C182T"],
  ["da40", "DA40"],
  ["m20c", "M20C"],
];
let browser;
try {
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const phone of [false, true]) {
    for (const [id, short] of airplanes) {
      const layout = phone ? "phone" : "desktop";
      const context = await browser.newContext({
        viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        isMobile: phone,
        hasTouch: phone,
        reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        localStorage.setItem("tourDone", "1");
        // Observe actual rendered geometry; a toolbar and empty canvas are not a loaded airplane.
        window.__fleetDepthMeshes = 0;
        const devtools = new EventTarget();
        devtools.addEventListener("observe", ({ detail }) => {
          if (!detail?.isWebGLRenderer) return;
          const render = detail.render.bind(detail);
          detail.render = (scene, camera) => {
            let meshes = 0;
            scene.traverse((object) => {
              if (object.isMesh && object.visible && object.userData.pick) meshes++;
            });
            window.__fleetDepthMeshes = meshes;
            return render(scene, camera);
          };
        });
        window.__THREE_DEVTOOLS__ = devtools;
      });
      const page = await context.newPage();
      const activate = (locator) => (phone ? locator.tap() : locator.click());
      page.setDefaultTimeout(90_000);
      page.setDefaultNavigationTimeout(90_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/_vercel/**", (route) => route.abort());
      const ready = () =>
        page.waitForFunction(
          () => window.__fleetDepthMeshes > 200 && !document.querySelector("[data-building]"),
          null,
          { timeout: 120_000 },
        );
      const itemId = () => page.locator(".walk-id").innerText();
      const changed = (old) =>
        page.waitForFunction((old) => document.querySelector(".walk-id")?.textContent !== old, old);
      const shot = async (name) => {
        await page.waitForTimeout(1600);
        const layoutFits = await page.evaluate((phone) => {
          const panel = document.querySelector(".panel");
          return phone
            ? document.documentElement.scrollWidth <= innerWidth + 1
            : !panel || panel.scrollWidth <= panel.clientWidth + 1;
        }, phone);
        assert.ok(layoutFits, `${id}/${layout}/${name}: walk controls fit without horizontal clipping`);
        await page.screenshot({ path: join(out, `${id}-${layout}-${name}.png`), fullPage: phone });
      };
      await page.goto(`${base}/${id}/fuel?walk=1`);
      await ready();
      await page.getByRole("button", { name: "Begin study walk", exact: true }).waitFor();
      assert.ok(!page.url().includes("walk="), "inspection deep link is consumed");
      await shot("intro");
      await page.getByRole("checkbox", { name: "Larger text", exact: true }).focus();
      await page.keyboard.press("Escape");
      await page.locator(".walk").waitFor({ state: "detached" });
      await activate(page.locator(".toolbar").getByRole("button", { name: "Preflight", exact: true }));
      await activate(page.getByRole("button", { name: "Begin study walk", exact: true }));
      await page.locator(".walk-id").waitFor();
      const first = await itemId();
      const total = Number(
        await page.getByRole("progressbar", { name: "Study position" }).getAttribute("aria-valuemax"),
      );
      assert.ok(total > 20, `${id} has its full inspection sequence`);
      const stations = page.getByRole("button", { name: /^Station \d+:/ });
      assert.ok((await stations.count()) >= 6, `${id} has source-specific inspection stations`);
      assert.match(await page.locator(".walk-card .walk-ref").getAttribute("href"), /^https:\/\//);
      if (phone) {
        assert.equal(await page.locator(".rail").isVisible(), false, "phone inspection preserves the scene");
        assert.ok((await page.locator(".stage").boundingBox()).height >= 0.55 * 844);
        await assertCurrentCheckVisible(page);
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await assertCurrentCheckVisible(page);
        await assertCurrentCheckSwipeStaysOnItem(page);
      }
      await activate(page.getByRole("button", { name: "✓ Reviewed", exact: true }));
      await changed(first);
      const second = await itemId();
      await activate(page.getByRole("button", { name: "Skip", exact: true }));
      await changed(second);
      if (phone) await assertCurrentCheckVisible(page);
      const saved = await itemId();
      await page.reload();
      await page.getByRole("heading", { name: `Resume ${short} study walk?`, exact: true }).waitFor();
      await activate(page.getByRole("button", { name: "Resume", exact: true }));
      await ready();
      assert.equal(await itemId(), saved, "saved progress resumes at the same item");
      await shot("resumed");

      // Station navigation and keyboard movement must preserve previously reviewed/skipped items.
      await activate(stations.last());
      const finalStation = await itemId();
      await activate(stations.first());
      assert.equal(await itemId(), first);
      if (phone) await assertCurrentCheckVisible(page);
      if (!phone) {
        await page.keyboard.press("ArrowRight");
        assert.equal(await itemId(), second);
        await page.keyboard.press("ArrowLeft");
        assert.equal(await itemId(), first);
      }
      await activate(page.getByRole("button", { name: "Next item", exact: true }));
      await changed(first);
      assert.match(await page.locator(".walk-mark").innerText(), /Skipped/);
      await activate(page.getByRole("button", { name: "Next item", exact: true }));
      assert.equal(await itemId(), saved);
      let reviewed = 2;
      let lastStationSeen = false;
      const captured = new Set();
      while (!(await page.getByRole("heading", { name: "Study walk complete", exact: true }).count())) {
        const current = await itemId();
        lastStationSeen ||= current === finalStation;
        assert.ok((await page.locator(".walk-std").innerText()).length > 0, `${current} has an inspection standard`);
        if (phone) {
          await assertCurrentCheckVisible(page);
          assert.equal(
            await page.locator(".walk-current").evaluate((row) => row.scrollLeft),
            0,
            "each item starts at the beginning of its line",
          );
        }
        const text = await page.locator(".walk-text").innerText();
        const special = /pitot.*heat|leading edge|wing tip|wingtip|propeller|landing gear/i.test(text);
        if (special && captured.size < 5 && !captured.has(text)) {
          captured.add(text);
          await shot(`target-${current}`);
        }
        if (phone) await page.locator(".walk-current").evaluate((row) => (row.scrollLeft = row.scrollWidth));
        await activate(page.getByRole("button", { name: "✓ Reviewed", exact: true }));
        await changed(current);
        reviewed++;
        assert.ok(reviewed <= total, "walk terminates at the source's last item");
      }
      assert.equal(reviewed, total);
      assert.ok(lastStationSeen);
      const summary = await page.locator(".walk-sum").innerText();
      assert.match(summary, new RegExp(`Reviewed\\s+${total - 1}\\b`));
      assert.match(summary, /Skipped\s+1\b/);
      assert.match(summary, /Unmarked\s+0\b/);
      await shot("complete");
      await activate(page.getByRole("button", { name: `Exit the ${short} study walk`, exact: true }));
      await page.locator(".walk").waitFor({ state: "detached" });
      assert.equal(await page.locator('.syslist button[aria-current="true"] .nm').innerText(), "Fuel");
      assert.equal(
        await page
          .locator(".toolbar")
          .getByRole("button", { name: "Preflight", exact: true })
          .getAttribute("aria-pressed"),
        "false",
      );
      await shot("restored");

      // The current compact fleet picker must be usable after a walk, including on phones.
      await activate(page.getByRole("button", { name: /^Switch Airplanes, current airplane/ }));
      const picker = page.getByRole("dialog", { name: "Choose an airplane" });
      await activate(picker.getByRole("button", { name: /^Cirrus SR20|^SR20 G6/ }));
      await page.reload();
      await ready();
      assert.equal(await page.locator(".walk").count(), 0);
      assert.equal(await page.locator(".walk-q").count(), 0, "progress is isolated between airplanes");
      assert.deepEqual(errors, [], `${id}/${layout} browser errors`);
      console.log(`${id}/${layout}: ${total} inspection items, resume, navigation, completion and restoration passed`);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server?.kill();
}
