/** Persistent part notes: keyboard selection, hidden-group cleanup and model navigation. */
import { test, expect } from "@playwright/test";
import { observeStageCamera, waitForStageCamera } from "./stage-camera-probe.mjs";

for (const width of [1440, 390])
  test(`part inspector supports keyboard selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("tourDone", "1"));
    await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto("/engines/io390");
    const inspector = page.getByRole("region", { name: "Part inspector" });
    await inspector.locator("summary").click();
    await inspector.getByRole("searchbox", { name: "Find a part" }).fill("Oil filter");
    const filter = inspector.getByRole("button", { name: "Oil filter", exact: true });
    await filter.focus();
    await page.keyboard.press("Enter");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(inspector.getByRole("heading", { name: "Oil filter", exact: true })).toBeVisible();
    await expect(inspector.locator(".part-explanation p")).not.toBeEmpty();
    // Closing the index and moving the pointer away must not dismiss the selected source note.
    await inspector.locator("summary").click();
    await page.mouse.move(0, 0);
    await expect(inspector.getByRole("heading", { name: "Oil filter", exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Lubrication", exact: true }).uncheck();
    await expect(inspector.getByRole("heading", { name: "Oil filter", exact: true })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Lubrication", exact: true }).check();
    await inspector.locator("summary").click();
    await expect(filter).toBeVisible();
    await filter.focus();
    await page.keyboard.press("Enter");
    await page.goto("/components/governor");
    await expect(page.getByRole("heading", { name: "Oil filter", exact: true })).toHaveCount(0);
    const next = page.getByRole("region", { name: "Part inspector" });
    await next.locator("summary").click();
    await expect(next.getByRole("searchbox")).toHaveValue("");
    expect(errors).toEqual([]);
  });

for (const phone of [false, true])
  test(`selecting a mesh reveals its note without moving focus (${phone ? "phone" : "desktop"})`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: { width: phone ? 390 : 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "reduce",
    });
    await observeStageCamera(context);
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}/engines/io390`);
      await expect(page.locator(".part-inspector summary")).toBeVisible();
      if (phone) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      else
        await page.locator(".panel").evaluate((panel) => {
          panel.scrollTop = panel.scrollHeight;
        });
      await waitForStageCamera(page);
      const canvas = await page.locator("canvas").boundingBox();
      let hit;
      for (const [fx, fy] of [
        [0.5, 0.5],
        [0.4, 0.5],
        [0.6, 0.5],
        [0.35, 0.65],
        [0.65, 0.65],
        [0.5, 0.7],
        [0.35, 0.35],
        [0.65, 0.35],
      ]) {
        // Browser mouse and touch events can round a fractional CSS pixel differently at a fine mesh edge.
        const x = Math.round(canvas.x + canvas.width * fx);
        const y = Math.round(canvas.y + canvas.height * fy);
        await page.mouse.move(x, y);
        await page.waitForTimeout(100);
        const tip = page.locator(".eng-tip b");
        if (await tip.count()) {
          hit = { x, y, name: await tip.textContent() };
          break;
        }
      }
      expect(hit, "a visible named mesh can be picked").toBeTruthy();
      if (phone) await page.touchscreen.tap(hit.x, hit.y);
      else await page.mouse.click(hit.x, hit.y);
      const selected = page.locator(".part-explanation h3");
      await expect(selected).toHaveText(hit.name);
      await expect
        .poll(async () => {
          const r = await selected.boundingBox();
          const top = phone
            ? (await page.locator(".eng-stage").boundingBox()).height
            : (await page.locator(".panel").boundingBox()).y;
          return r.y >= top && r.y + r.height < 900;
        })
        .toBe(true);
      expect(
        await page.locator(".part-inspector").evaluate((element) => element.contains(document.activeElement)),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });

test("IO-390 catalog separation keeps a selected part and the study controls", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/THREE\.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text());
  });
  await page.goto("/engines/io390");
  const button = page.getByRole("button", { name: "Blow up", exact: true });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  const inspector = page.getByRole("region", { name: "Part inspector" });
  await inspector.locator("summary").click();
  await inspector.getByRole("searchbox").fill("14G22050");
  await inspector.getByRole("button", { name: "Top compression ring, cylinder 1", exact: true }).click();
  const selected = inspector.getByRole("heading", { name: "Top compression ring, cylinder 1" });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(selected).toBeVisible();
  await inspector.getByRole("searchbox").fill("STD-1925");
  const screws = inspector.getByRole("button", { name: /^Rocker cover screw/ });
  await expect(screws).toHaveCount(32);
  const first = inspector.getByRole("button", { name: "Rocker cover screw (1), cylinder 1", exact: true });
  const second = inspector.getByRole("button", { name: "Rocker cover screw (2), cylinder 1", exact: true });
  await first.click();
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(
    inspector.getByRole("heading", { name: "Rocker cover screw (2), cylinder 1", exact: true }),
  ).toBeVisible();
  const xray = page.getByRole("button", { name: "X-ray", exact: true });
  for (const pressed of ["true", "false"]) {
    await xray.click();
    await expect(xray).toHaveAttribute("aria-pressed", pressed);
    // Allow the renderer to compile and draw the new palette before switching again.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(second).toHaveAttribute("aria-pressed", "true");
  }
  await button.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await inspector.getByRole("searchbox").fill("14G22050");
  await inspector.getByRole("button", { name: "Top compression ring, cylinder 1", exact: true }).click();
  await button.click();
  await page.getByRole("combobox", { name: "Study view" }).selectOption("cycle");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(selected).toBeVisible();
  await page.goto("/engines/o360");
  await expect(page.getByRole("combobox", { name: "Study view" })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(errors).toEqual([]);
});
