#!/usr/bin/env node
/** Production mesh download/decode and procedural fallback, including animation-owned geometry. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, errors as playwrightErrors } from "playwright-core";
const port = 4100 + Math.floor(Math.random() * 800);
const base = process.argv[2] || `http://localhost:${port}`;
const ids = ["sr20", "sr22t", "c172s", "c182t", "da40", "m20c"];
let server, browser;
try {
  if (!process.argv[2]) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "",
      ready = false;
    server.stdout.on("data", (d) => {
      log = (log + d).slice(-8000);
    });
    server.stderr.on("data", (d) => {
      log = (log + d).slice(-8000);
    });
    for (let i = 0; i < 120; i++) {
      assert.equal(server.exitCode, null, log);
      try {
        ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {}
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, `Production server did not start: ${log}`);
  }
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const id of ids) {
    let downloadedNames, downloadedBaked;
    for (const mode of id === "sr22t" ? ["prebuilt", "delayed", "fallback"] : ["prebuilt", "fallback"]) {
      const fallback = mode === "fallback";
      const context = await browser.newContext({ viewport: { width: 640, height: 480 }, reducedMotion: "reduce" });
      await context.route("**/_vercel/**", (r) => r.fulfill({ status: 204, body: "" }));
      // Worker requests must be intercepted at context scope, not page scope.
      if (fallback) await context.route("**/geometry/*.bin.gz", (r) => r.fulfill({ status: 503, body: "unavailable" }));
      if (mode === "delayed")
        await context.route("**/geometry/*.bin.gz", async (r) => {
          await delay(3000);
          await r.continue();
        });
      await context.addInitScript(() => {
        localStorage.setItem("tourDone", "1");
        window.__geometry = { scene: null, frames: 0, workers: [] };
        const dev = new EventTarget();
        dev.addEventListener("observe", ({ detail: o }) => {
          if (o?.isWebGLRenderer) {
            const render = o.render.bind(o);
            o.render = (...args) => {
              window.__geometry.scene = args[0];
              window.__geometry.frames++;
              return render(...args);
            };
          }
        });
        window.__THREE_DEVTOOLS__ = dev;
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            this.record = { start: performance.now(), meshes: 0, terminated: false };
            window.__geometry.workers.push(this.record);
            this.addEventListener("message", ({ data }) => {
              if (data?.meshes) {
                this.record.meshes = data.meshes.length;
                this.record.ms = performance.now() - this.record.start;
              }
            });
          }
          terminate() {
            this.record.terminated = true;
            super.terminate();
          }
        };
      });
      const page = await context.newPage();
      const errors = [],
        warnings = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "warning") warnings.push(m.text());
      });
      await page.goto(`${base}/${id}/engine`);
      await page.waitForFunction(
        () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
        null,
        { timeout: 120_000 },
      );
      const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
      if (await addAll.isVisible()) {
        try {
          await addAll.click({ timeout: 5000 });
        } catch (error) {
          if (!(error instanceof playwrightErrors.TimeoutError) || (await page.locator("[data-building]").count()))
            throw error;
        }
      }
      await page.waitForFunction(
        () =>
          window.__geometry.scene?.children.length &&
          window.__geometry.frames > 1 &&
          !document.querySelector("[data-building]"),
        null,
        { timeout: 120_000 },
      );
      const frame = await page.evaluate(() => window.__geometry.frames);
      await page.waitForFunction((f) => window.__geometry.frames >= f + 3, frame, { timeout: 120_000 });
      const result = await page.evaluate(() => {
        const state = window.__geometry,
          names = [];
        let baked = 0;
        state.scene.traverse((o) => {
          if (!o.isMesh) return;
          if ("unindexedSource" in o.geometry.userData) baked++;
          if (o.userData.pick?.name) names.push(o.userData.pick.name);
        });
        return { names: names.sort(), baked, workers: state.workers };
      });
      assert.deepEqual(errors, [], `${id}: runtime errors`);
      assert.ok(result.names.length > 200, `${id}: complete model`);
      assert.ok(
        result.workers.every((w) => w.terminated),
        `${id}: workers released`,
      );
      if (fallback) {
        assert.equal(result.baked, 0, `${id}: source fallback`);
        assert.ok(
          warnings.some((m) => m.includes("Prebuilt geometry unavailable")),
          `${id}: failed asset was exercised`,
        );
        assert.deepEqual(result.names, downloadedNames, `${id}: fallback keeps the same equipment`);
      } else {
        assert.ok(result.baked > 200, `${id}: production asset must actually be used`);
        assert.ok(
          result.workers.some((w) => w.meshes > 200),
          `${id}: decoded in worker`,
        );
        assert.ok(!warnings.some((m) => /Prebuilt geometry|Geometry worker/.test(m)), `${id}: unexpected fallback`);
        if (mode === "delayed") {
          assert.deepEqual(result.names, downloadedNames, `${id}: delayed asset keeps the same equipment`);
          assert.equal(result.baked, downloadedBaked, `${id}: delayed asset uses every eligible rendered mesh`);
        } else {
          downloadedNames = result.names;
          downloadedBaked = result.baked;
        }
      }
      console.log(
        `${id} ${mode}: ${result.names.length} named meshes, ${result.baked} prebuilt; ${JSON.stringify(result.workers.map(({ meshes, ms, terminated }) => ({ meshes, ms: Math.round(ms || 0), terminated })))}`,
      );
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server?.kill();
}
