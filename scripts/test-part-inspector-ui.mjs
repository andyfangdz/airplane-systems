/** Persistent part notes: keyboard selection, hidden-group cleanup and model navigation. */
import { test, expect } from "@playwright/test";

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
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}/engines/io390`);
      await expect(page.locator(".part-inspector summary")).toBeVisible();
      if (phone) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      else
        await page.locator(".panel").evaluate((panel) => {
          panel.scrollTop = panel.scrollHeight;
        });
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
        const x = canvas.x + canvas.width * fx;
        const y = canvas.y + canvas.height * fy;
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
