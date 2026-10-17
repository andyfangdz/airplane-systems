/** Production mesh download/decode and lazy authoring recovery, including animation-owned geometry. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test, errors as playwrightErrors } from "@playwright/test";
function observeGeometry() {
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
}

const ids = ["sr20", "sr22t", "c172s", "c182t", "da40", "m20c"];
for (const id of ids) {
  test(`${id} prebuilt geometry and fallback`, async ({ browser, baseURL: base }) => {
    let downloadedNames, downloadedBaked;
    for (const mode of id === "sr22t" ? ["prebuilt", "delayed", "fallback"] : ["prebuilt", "fallback"]) {
      const fallback = mode === "fallback";
      const context = await browser.newContext({ viewport: { width: 640, height: 480 }, reducedMotion: "reduce" });
      const recoveryRequests = [];
      context.on("request", (request) => {
        if (/\/geometry\/recovery-[a-f0-9]+\.js(?:\?|$)/.test(request.url())) recoveryRequests.push(request.url());
      });
      await context.route("**/_vercel/**", (r) => r.fulfill({ status: 204, body: "" }));
      // Worker requests must be intercepted at context scope, not page scope.
      if (fallback) await context.route("**/geometry/*.bin.gz", (r) => r.fulfill({ status: 503, body: "unavailable" }));
      if (mode === "delayed")
        await context.route("**/geometry/*.bin.gz", async (r) => {
          await delay(3000);
          await r.continue();
        });
      await context.addInitScript(observeGeometry);
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
        assert.ok(recoveryRequests.length > 0, `${id}: failed asset loads the separate authoring worker`);
        assert.equal(result.baked, 0, `${id}: source fallback`);
        assert.ok(
          warnings.some((m) => m.includes("Prebuilt geometry unavailable")),
          `${id}: failed asset was exercised`,
        );
        assert.deepEqual(result.names, downloadedNames, `${id}: fallback keeps the same equipment`);
      } else {
        assert.deepEqual(recoveryRequests, [], `${id}: normal load does not request authoring code`);
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
  });
}

test("stalled scene manifest reaches authoring recovery", async ({ browser, baseURL: base }) => {
  const context = await browser.newContext({ viewport: { width: 640, height: 480 }, reducedMotion: "reduce" });
  try {
    await context.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
    // Leave the response pending: the asset deadline must abort this request and recover.
    await context.route("**/geometry/*.scene.json", () => {});
    await context.addInitScript(observeGeometry);
    const page = await context.newPage();
    const errors = [],
      warnings = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    const recovery = page.waitForRequest(
      (request) => /\/geometry\/recovery-[a-f0-9]+\.js(?:\?|$)/.test(request.url()),
      { timeout: 60_000 },
    );
    await page.goto(`${base}/sr20/engine`);
    await recovery;
    await page.waitForFunction(
      () =>
        window.__geometry.scene?.children.length &&
        window.__geometry.frames > 1 &&
        !document.querySelector("[data-building]"),
      null,
      { timeout: 120_000 },
    );
    const result = await page.evaluate(() => {
      let named = 0,
        baked = 0;
      window.__geometry.scene.traverse((object) => {
        if (!object.isMesh) return;
        if (object.userData.pick?.name) named++;
        if ("unindexedSource" in object.geometry.userData) baked++;
      });
      return { named, baked, workers: window.__geometry.workers };
    });
    assert.deepEqual(errors, [], "stalled manifest: no runtime errors");
    assert.ok(result.named > 200, "stalled manifest: recovery renders the complete model");
    assert.equal(result.baked, 0, "stalled manifest: original source recovery is used");
    assert.ok(
      result.workers.every((worker) => worker.terminated),
      "stalled manifest: workers released",
    );
    assert.ok(
      warnings.some((message) => message.includes("Prebuilt geometry unavailable") && message.includes("timeout")),
      "stalled manifest: deadline triggered recovery",
    );
    console.log(`stalled manifest recovered: ${result.named} named meshes; ${result.workers.length} workers released`);
  } finally {
    await context.close();
  }
});
