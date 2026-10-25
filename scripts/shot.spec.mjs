import { test, expect, errors } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { shot } from "../playwright.shots.config.mjs";
import { shotFilename, shotQuery } from "./shot-camera.mjs";
const { out, theme, wait, compare, tolerance, phone, solid, noLabels, views, cameras } = shot;

for (const { v, camera } of views.flatMap((v) => cameras.map((camera) => ({ v, camera })))) {
  test(camera ? `${v} (${camera})` : v, async ({ page, context, baseURL: base }, info) => {
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem("tourDone", "1");
        localStorage.setItem("sr20theme", theme);
      } catch {}
    }, theme);
    mkdirSync(out, { recursive: true });
    // Deployment analytics are unrelated to rendering a local study view.
    await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
    page.on("console", (m) => {
      if (
        (m.type() === "error" || m.type() === "warning") &&
        !/THREE\.Clock: This module has been deprecated/.test(m.text())
      )
        console.log(`  [${m.type()}] ${m.text()}`);
    });
    const pageErrors = [];
    page.on("pageerror", (e) => {
      pageErrors.push(e.message);
      console.log(`  [pageerror] ${e.message}`);
    });
    const query = shotQuery("", camera);
    await page.goto(`${base}/${v}${query ? "?" + query : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas, [data-pitot-static]", { timeout: 60000 });
    // A progressive scene can show its cabin while hundreds of other parts are still absent.
    // Finish the build through the same control available to the user before taking review evidence.
    await page.waitForFunction(
      () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
      null,
      { timeout: 120000 },
    );
    const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
    if (await addAll.isVisible()) {
      try {
        await addAll.click({ timeout: 5000 });
      } catch (error) {
        // The build can finish between visibility and click. Only that completed-build race is harmless.
        if (
          !(error instanceof errors.TimeoutError) ||
          (await page.locator("[data-building]").count()) ||
          (await addAll.isVisible())
        )
          throw error;
      }
    }
    await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev-mode badge
    await page.evaluate(
      async ([solid, noLabels]) => {
        const turnOff = (label) => {
          const b = [...document.querySelectorAll(".toolbar .tb")].find((b) => b.textContent === label);
          if (b?.getAttribute("aria-pressed") === "true") b.click();
        };
        if (solid) turnOff("X-ray");
        if (noLabels) turnOff("Labels");
      },
      [solid, noLabels],
    );
    await page.waitForTimeout(wait);

    const name = shotFilename(v, phone, camera);
    const file = join(out, name);
    const png = await page.screenshot({ fullPage: phone, timeout: 120_000 });
    expect(pageErrors, "No application runtime errors").toEqual([]);
    writeFileSync(file, png);
    if (!compare) return;
    if (!existsSync(join(resolve(compare), name))) {
      console.log(`No reference ${name}`);
      return;
    }
    try {
      expect(png).toMatchSnapshot(name, { maxDiffPixelRatio: tolerance / 100 });
    } catch (error) {
      const diff = info.attachments.find((a) => a.name.endsWith("-diff.png"));
      if (diff?.path) copyFileSync(diff.path, file.replace(/\.png$/, ".diff.png"));
      throw error;
    }
  });
}
