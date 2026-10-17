#!/usr/bin/env node
/**
 * Diagnostic production measurements on one software renderer at a time.
 * UI_BASE_URL=http://127.0.0.1:4100 node scripts/measure-rendering.mjs .shots/render.json [/<aircraft>/<system> ...]
 * Counts and transfer sizes are reproducible; timings depend on the host and must not be presented as device benchmarks.
 * Page resource timings exclude geometry fetched inside a worker. Keep that limitation when comparing downloads.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import { softwareGL } from "./software-gl.mjs";
const base = process.env.UI_BASE_URL || "http://127.0.0.1:4100";
const output = process.argv[2] || ".shots/render-metrics.json";
const routes = process.argv.slice(3);
if (!routes.length) routes.push("/sr22t/engine", "/c172s/engine", "/sr20/electrical");
await mkdir(dirname(output), { recursive: true });
const browser = await chromium.launch({ args: softwareGL });
const rows = [];
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      localStorage.setItem("tourDone", "1");
      const probe = (window.__renderProbe = {
        scene: null,
        renderer: null,
        samples: [],
        measuring: false,
        previous: 0,
      });
      const dev = new EventTarget();
      dev.addEventListener("observe", (event) => {
        const object = event.detail;
        if (object?.isScene) probe.scene = object;
        if (!object?.isWebGLRenderer) return;
        probe.renderer = object;
        const original = object.render.bind(object);
        object.render = (scene, camera) => {
          const now = performance.now();
          const result = original(scene, camera);
          if (probe.measuring && probe.samples.length < 90) {
            const info = object.info;
            probe.samples.push({
              interval: probe.previous ? now - probe.previous : 0,
              renderMs: performance.now() - now,
              calls: info.render.calls,
              triangles: info.render.triangles,
              points: info.render.points,
            });
            probe.previous = now;
          }
          probe.scene = scene;
          return result;
        };
      });
      window.__THREE_DEVTOOLS__ = dev;
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/_vercel/**", (r) => r.abort());
    const navigationStarted = Date.now();
    await page.goto(base + route, { timeout: 120000, waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        window.__renderProbe?.renderer &&
        window.__renderProbe.scene?.getObjectByName("aircraft-model")?.children.length &&
        !document.querySelector("[data-building]"),
      null,
      { timeout: 180000 },
    );
    const readyMs = Date.now() - navigationStarted;
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__renderProbe.measuring = true;
    });
    await page.waitForFunction(() => window.__renderProbe.samples.length >= 60, null, { timeout: 120000 });
    const data = await page.evaluate(() => {
      const probe = window.__renderProbe;
      probe.measuring = false;
      const model = probe.scene.getObjectByName("aircraft-model");
      const state = model?.__r3f?.root?.getState();
      const resources = performance.getEntriesByType("resource");
      const sizes = (entries) => ({
        requests: entries.length,
        transfer: entries.reduce((n, e) => n + e.transferSize, 0),
        encoded: entries.reduce((n, e) => n + e.encodedBodySize, 0),
        decoded: entries.reduce((n, e) => n + e.decodedBodySize, 0),
      });
      let meshes = 0,
        pointObjects = 0,
        visiblePointObjects = 0;
      model.traverse((o) => {
        if (o.isMesh) meshes++;
        if (o.isPoints) {
          pointObjects++;
          if (o.visible) visiblePointObjects++;
        }
      });
      return {
        samples: probe.samples.slice(1),
        subscribers: state?.internal?.subscribers?.length ?? null,
        meshes,
        pointObjects,
        visiblePointObjects,
        memory: { ...probe.renderer.info.memory },
        programs: probe.renderer.info.programs?.length,
        resources: {
          all: sizes(resources),
          javascript: sizes(resources.filter((e) => new URL(e.name).pathname.endsWith(".js"))),
          geometry: sizes(resources.filter((e) => e.name.includes("/geometry/"))),
        },
      };
    });
    const stats = (key) => {
      const values = data.samples.map((s) => s[key]).sort((a, b) => a - b);
      return {
        median: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        min: values[0],
        max: values.at(-1),
      };
    };
    const row = {
      route,
      readyMs,
      frames: data.samples.length,
      frameIntervalMs: stats("interval"),
      renderMs: stats("renderMs"),
      drawCalls: stats("calls"),
      triangles: stats("triangles"),
      points: stats("points"),
      ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== "samples")),
      errors,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
    await writeFile(
      output,
      JSON.stringify({ base, viewport: [1440, 900], softwareGL, measuredAt: new Date().toISOString(), rows }, null, 2) +
        "\n",
    );
    await context.close();
  }
} finally {
  await browser.close();
}
