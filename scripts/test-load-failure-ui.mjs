/**
 * A page whose code fails to download says so and offers Retry, instead of loading for good: on the first load (the page
 * never hydrates; app/layout.tsx's inline script marks it) and on a switch to another airplane's route
 * (app/(fleet)/error.tsx). Retry loads the page again, keeping its path and query. Run after npm run build.
 */
import assert from "node:assert/strict";
import { test } from "@playwright/test";

const failed = (page) => page.locator(".loader-failed:visible");

test("a failed download shows didn't load and Retry, which loads the page again", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // first load: one of the page's own chunks fails, so it never hydrates
  const html = await (await page.request.get(`${baseURL}/c172s/electrical`)).text();
  const chunks = [...html.matchAll(/<script src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]);
  assert.ok(chunks.length > 2, "the page loads its chunks with script tags");
  const victim = chunks.at(-1);
  let block = (path) => path === victim;
  await page.route("**/_next/static/chunks/**", (route) =>
    block(new URL(route.request().url()).pathname) ? route.abort() : route.continue(),
  );
  await page.goto(`${baseURL}/c172s/electrical?cam=top`);
  await failed(page).waitFor();
  assert.match(await failed(page).innerText(), /C172S Skyhawk didn't load\. Check the connection and try again\./);
  assert.equal(await page.locator(".loader .spinner:visible").count(), 0, "the spinner gives way to the message");
  block = () => false;
  await failed(page).getByRole("button", { name: "Retry" }).click();
  await page.waitForSelector("canvas");
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, "/c172s/electrical?cam=top");
  assert.equal(await failed(page).count(), 0);

  // a switch: the other airplane's route chunks fail
  await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120_000 });
  const loaded = new Set(
    await page.evaluate(() => performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname)),
  );
  block = (path) => !loaded.has(path);
  await page.getByRole("button", { name: /^Switch Airplanes/ }).click();
  await page.getByRole("button", { name: /DA40 XLS/ }).click();
  const alert = page.getByRole("alert").filter({ has: failed(page) });
  await alert.waitFor();
  assert.match(await alert.innerText(), /DA40 XLS didn't load\. Check the connection and try again\./);
  block = () => false;
  await alert.getByRole("button", { name: "Retry" }).click();
  await page.waitForFunction(() => document.querySelector(".fleet-current-name")?.textContent === "DA40 XLS");
  await page.waitForSelector("canvas");
  assert.equal(new URL(page.url()).pathname.split("/")[1], "da40");
  assert.equal(await failed(page).count(), 0);
  // the failed chunk surfaces as an error the page reports, nothing else
  assert.ok(
    errors.every((e) => /chunk/i.test(e)),
    JSON.stringify(errors),
  );
});
