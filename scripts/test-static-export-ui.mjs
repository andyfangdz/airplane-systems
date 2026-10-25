/**
 * The deployed static site switches airplanes: each airplane is its own exported route, so a switch fetches that
 * route's files through infra/cloudfront/view-rewrite.js. Opens the root, picks a system, switches to two other
 * airplanes and goes back, with no failed request or page error on the way.
 *
 *   STATIC_EXPORT=1 npm run build && STATIC_EXPORT=1 npx playwright test scripts/test-static-export-ui.mjs
 *
 * (playwright.config.mjs then serves out/ with scripts/serve-export.mjs; without STATIC_EXPORT it runs against
 * `next start`, which must behave the same.)
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "@playwright/test";

const current = (page) => page.locator(".fleet-current-name");

async function shows(page, name, path) {
  await page.waitForFunction(
    ([name, path]) => document.querySelector(".fleet-current-name")?.textContent === name && location.pathname === path,
    [name, path],
  );
  await page.waitForSelector("canvas");
  assert.equal(await page.locator(".loader-failed:visible").count(), 0, `${name} loaded`);
}

async function pick(page, name) {
  await page.getByRole("button", { name: /^Switch (airplane|simulation)/ }).click();
  await page
    .getByRole("dialog", { name: "Choose an airplane, engine or component" })
    .getByRole("group", { name: "Airplanes" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

test("the static site switches between airplanes and back", async ({ page, context, baseURL }) => {
  await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
  await context.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  const failed = [];
  const errors = [];
  page.on("response", (r) => {
    if (r.url().startsWith(baseURL) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  // a prefetch the page cancels (closing the picker) aborts; anything else that fails to load counts
  page.on("requestfailed", (r) => {
    const reason = r.failure()?.errorText;
    if (r.url().startsWith(baseURL) && reason !== "net::ERR_ABORTED") failed.push(`${reason} ${r.url()}`);
  });
  page.on("pageerror", (e) => errors.push(e.message));

  // a fresh visitor's root opens the default airplane
  await page.goto("/");
  await shows(page, "SR20 G6", "/sr20/overview");

  // a deep link, then another system on the same route
  await page.goto("/c172s/electrical");
  await shows(page, "C172S Skyhawk", "/c172s/electrical");
  await page.getByRole("navigation", { name: "Systems" }).getByRole("button", { name: /^Fuel/ }).click();
  await page.waitForFunction(() => location.pathname === "/c172s/fuel");

  // switches fetch each airplane's own route files
  await pick(page, "DA40 XLS");
  await shows(page, "DA40 XLS", "/da40/overview");
  await pick(page, "M20C Ranger");
  await shows(page, "M20C Ranger", "/m20c/overview");

  // back returns to the previous airplane
  await page.goBack();
  await shows(page, "DA40 XLS", "/da40/overview");
  assert.equal(await current(page).count(), 1);

  assert.deepEqual(failed, [], "every request the site made succeeded");
  assert.deepEqual(errors, [], "no page errors");
});

// This smoke exercises the downloaded, sealed artifact through the same local edge rewrite and cache classes.
test("the static release serves its declared immutable assets", async ({ baseURL }) => {
  test.skip(process.env.STATIC_EXPORT !== "1", "Release cache semantics belong to the static host");
  const { stdout } = await promisify(execFile)(process.execPath, ["scripts/smoke.mjs", baseURL]);
  assert.equal(JSON.parse(stdout).ok, true);
});
