/** Production mesh download/decode and lazy authoring recovery, including animation-owned geometry. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, errors as playwrightErrors } from "@playwright/test";
import registry from "../aircraft/fleet.json" with { type: "json" };
function observeGeometry() {
  localStorage.setItem("tourDone", "1");
  window.__geometry = { scene: null, frames: 0, workers: [] };
  const dev = new EventTarget();
  dev.addEventListener("observe", ({ detail: o }) => {
    if (o?.isWebGLRenderer) {
      const render = o.render.bind(o);
      o.render = (...args) => {
        window.__geometry.scene = args[0];
        window.__geometry.camera = args[1];
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

for (const { id } of registry.aircraft) {
  test(`${id} prebuilt geometry and fallback`, async ({ browser, request, baseURL: base }) => {
    const runtime = await (await request.get(`${base}/geometry/runtime.json`)).json();
    const manifest = await (await request.get(base + runtime.aircraft[id].scene)).json();
    const compiled = manifest.entries.filter((entry) => entry.geometry === "compiled").length;
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
        const state = window.__geometry;
        const catalogueNames = [],
          overlays = [];
        let baked = 0;
        state.scene.traverse((o) => {
          if (!o.isMesh) return;
          if ("unindexedSource" in o.geometry.userData) baked++;
          const name = o.userData.pick?.name;
          if (name) (o.userData.cameraBounds ? catalogueNames : overlays).push(name);
        });
        return {
          names: [...catalogueNames, ...overlays].sort(),
          catalogueNames: catalogueNames.sort(),
          overlays: overlays.sort(),
          baked,
          workers: state.workers,
        };
      });
      assert.deepEqual(errors, [], `${id}: runtime errors`);
      if (id === "falcon6x") {
        // Every item in the illustrated installation is fitted and mounted.
        const named = manifest.entries
          .map((entry) => entry.metadata.name)
          .filter(Boolean)
          .sort();
        assert.deepEqual(result.catalogueNames, named, "Falcon shells, surfaces and installed equipment");
        assert.deepEqual(
          result.overlays,
          [
            "Captain primary display",
            "First officer primary display",
            "Upper multifunction display",
            "Lower multifunction display",
            "Left electronic flight bag",
            "Right electronic flight bag",
            "Standby flight display",
          ].sort(),
          "Falcon live display planes",
        );
        for (const name of [
          "Entry door",
          "Left PW812D",
          "Right PW812D",
          "High-pressure compressor",
          "Annular combustor",
          "Low-pressure turbine",
          "Passenger seating",
          "Aft divans",
          "EASy IV instrument panel",
          "FalconEye nose camera",
          "Flaperon",
        ])
          assert.ok(named.includes(name), name);
      } else assert.ok(result.names.length > 200, `${id}: complete model`);
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
        if (id === "falcon6x") assert.equal(result.baked, compiled, "Falcon renders each compiled mesh");
        else assert.ok(result.baked > 200, `${id}: production asset must actually be used`);
        assert.ok(
          result.workers.some((w) => w.meshes === compiled),
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

test("Falcon 6X study controls open the entry and frame the engine, cabin and nose camera", async ({
  context,
  page,
  baseURL,
}) => {
  await context.addInitScript(observeGeometry);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL + "/falcon6x/airframe");
  const xray = page.getByRole("button", { name: "X-ray", exact: true });
  const details = page.getByRole("complementary", { name: "System details" });
  const systems = page.getByRole("navigation", { name: "Systems" });

  async function inspect(control, view, target, maxDistance) {
    await details.getByRole("button", { name: control, exact: true }).click();
    await expect(xray).toHaveAttribute("aria-pressed", view === "xray" ? "true" : "false");
    // Test the framing in model coordinates so minor camera and viewport refinements are allowed.
    await page.waitForFunction(
      ({ target, maxDistance }) => {
        const { camera } = window.__geometry;
        if (!camera) return false;
        const offset = camera.position.clone().fromArray(target).sub(camera.position);
        const forward = camera.getWorldDirection(camera.position.clone());
        return offset.length() < maxDistance && offset.normalize().dot(forward) > 0.97;
      },
      { target, maxDistance },
      { timeout: 30_000 },
    );
  }
  const waitForAirstair = (open) =>
    page.waitForFunction(
      (open) => {
        if (document.querySelector("[data-building]")) return false;
        const atPose = new Set();
        window.__geometry.scene?.traverse((mesh) => {
          const name = mesh.userData.pick?.name;
          if (name !== "Entry door" && name !== "Integral airstair") return;
          // Track local up in world coordinates. Both parts tip past horizontal and return upright.
          const up = mesh.position.clone().set(0, 1, 0).transformDirection(mesh.matrixWorld);
          if (open ? up.y < -0.25 : up.y > 0.999) atPose.add(name);
        });
        return atPose.size === 2;
      },
      open,
      { timeout: 120_000 },
    );

  await waitForAirstair(false);
  await inspect("Open airstair", "solid", [8.25, -0.55, -1.15], 7);
  await waitForAirstair(true);
  await details.getByRole("button", { name: "Close airstair", exact: true }).click();
  await waitForAirstair(false);
  await systems.getByRole("button", { name: /^Engines/ }).click();
  await inspect("Inspect engine core", "xray", [-6.62, 0.56, 2.17], 8);
  await systems.getByRole("button", { name: /^Cabin/ }).click();
  await inspect("Look down the aisle", "solid", [-2.55, 0.1, 0], 11);
  await systems.getByRole("button", { name: /^Flight deck/ }).click();
  await inspect("Look at the nose camera", "solid", [11.46, 0.16, 0], 3.5);
  await inspect("Return to flight deck", "solid", [9.47, 0.075, 0], 5);
  expect(errors).toEqual([]);
});

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
