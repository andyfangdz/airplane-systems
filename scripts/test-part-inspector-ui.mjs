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
    // Replays share the inspector and keep 44px targets at both widths.
    await page.goto("/fdr/c5-diego-garcia");
    const summary = inspector.locator("summary");
    const search = inspector.getByRole("searchbox");
    const fuselage = inspector.getByRole("button", { name: "Fuselage", exact: true });
    await summary.click();
    await search.fill("Fuselage");
    await fuselage.click();
    for (const control of [summary, search, fuselage, inspector.getByRole("button", { name: "Clear selected part" })]) {
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
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
      // Two taps on the same physical group enter the study directly from the installed engine.
      // A single tap above must have left the installed camera in place.
      await expect(page.getByRole("combobox", { name: "Study view" })).toHaveValue("exterior");
      if (phone) {
        // Queue both taps on the same connection. Waiting for a rendered frame between releases can turn them
        // into two single taps on the software renderer.
        const touch = await context.newCDPSession(page);
        const point = [{ x: hit.x, y: hit.y }];
        await Promise.all(
          ["touchStart", "touchEnd", "touchStart", "touchEnd"].map((type) =>
            touch.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchStart" ? point : [] }),
          ),
        );
        await touch.detach();
      } else await page.mouse.dblclick(hit.x, hit.y);
      await expect(page.getByRole("button", { name: "Part groups", exact: true })).toBeVisible();
      if (phone) await page.getByRole("button", { name: "Engine controls" }).tap();
      await expect(page.getByRole("combobox", { name: "Focus a part group" })).not.toHaveValue("");
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
  const study = page.getByRole("combobox", { name: "Study view" });
  await expect(study).toHaveValue("exterior");
  const inspector = page.getByRole("region", { name: "Part inspector" });
  await inspector.locator("summary").click();
  await inspector.getByRole("searchbox").fill("14G22050");
  await inspector.getByRole("button", { name: "Top compression ring, cylinder 1", exact: true }).click();
  const selected = inspector.getByRole("heading", { name: "Top compression ring, cylinder 1" });
  await study.selectOption("assemblies");
  const assemble = page.getByRole("button", { name: "Assemble engine", exact: true });
  await expect(assemble).toBeVisible();
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
  const focus = page.getByRole("combobox", { name: "Focus a part group" });
  await focus.selectOption("cylinder-1");
  await expect(screws).toHaveCount(8);
  const separate = page.getByRole("button", { name: "Blow up group", exact: true });
  await separate.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Assemble group", exact: true }).click();
  await page.getByRole("button", { name: "Part groups", exact: true }).click();
  await expect(screws).toHaveCount(32);
  await assemble.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await inspector.getByRole("searchbox").fill("14G22050");
  await inspector.getByRole("button", { name: "Top compression ring, cylinder 1", exact: true }).click();
  await study.selectOption("assemblies");
  await study.selectOption("cycle");
  await expect(assemble).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Power cycle focus" })).toHaveValue("system");
  await expect(selected).toBeVisible();
  await page.goto("/engines/o360");
  await expect(page.getByRole("combobox", { name: "Study view" })).toBeVisible();
  await expect(study.locator('option[value="assemblies"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("isolated accessories reassemble independently and a crankshaft can be paired with either bank", async ({
  page,
  context,
}) => {
  await observeStageCamera(context);
  await page.goto("/engines/io390");
  const button = (name) => page.getByRole("button", { name, exact: true });
  const select = (name) => page.getByRole("combobox", { name, exact: true });
  const groups = select("Focus a part group"),
    components = select("Focus a component");
  await select("Study view").selectOption("assemblies");
  await groups.selectOption("drives");
  await waitForStageCamera(page);
  const label = await page
    .locator(".eng-label")
    .filter({ hasText: /^ALT 1$/ })
    .boundingBox();
  // Hit the model itself, just as a learner does. Its label is anchored beside the housing.
  let hit;
  for (const [dx, dy] of [
    [0, 0],
    [-9, 0],
    [9, 0],
    [0, -12],
    [0, 12],
    [-20, -12],
    [20, -12],
  ]) {
    const x = Math.round(label.x + label.width / 2 + dx),
      y = Math.round(label.y + label.height / 2 + dy);
    await page.mouse.move(x, y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (
      await page
        .locator(".eng-tip b")
        .filter({ hasText: /^ALT 1(?: pulley)?$/ })
        .isVisible()
    ) {
      hit = { x, y };
      break;
    }
  }
  expect(hit, "the ALT 1 housing or pulley can be picked").toBeTruthy();
  await page.mouse.dblclick(hit.x, hit.y);
  await expect(components).toHaveValue("alternator-1");
  await button("Blow up component").click();
  await button("Assemble component").click();
  await components.selectOption("alternator-2");
  const inspector = page.getByRole("region", { name: "Part inspector" });
  await inspector.locator("summary").click();
  await inspector.getByRole("searchbox").fill("Rotor field winding");
  await expect(inspector.getByRole("button", { name: "Rotor field winding, ALT 2", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Rotor field winding, ALT 1", exact: true })).toHaveCount(0);
  await button("Accessory drives").click();
  await groups.selectOption("shafts");
  const idlerPin = page.locator(".eng-label").filter({ hasText: /^Timing idler$/ });
  const idler = inspector.getByRole("button", { name: "Left crankshaft idler gear", exact: true });
  await inspector.getByRole("searchbox").fill("crankshaft idler");
  await expect(idler).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Right crankshaft idler gear", exact: true })).toHaveCount(0);
  await button("Blow up group").click();
  await button("Show with cylinders").click();
  await expect(select("Study view")).toHaveValue("cycle");
  const pair = select("Power cycle focus");
  await expect(pair).toHaveValue("all");
  await expect(idler).toBeVisible();
  await pair.selectOption("2");
  await expect(idlerPin).toBeVisible();
  await expect(idler).toBeVisible();
  const crank = page.getByRole("slider", { name: "Crankshaft angle" });
  await crank.fill("210");
  await expect(crank).toHaveAttribute("aria-valuetext", "210 degrees");
  await button("Follow engine").click();
  await expect(crank).toHaveValue("0");
  await pair.selectOption("3");
  await inspector.getByRole("searchbox").fill("Piston, cylinder");
  await expect(inspector.getByRole("button", { name: "Piston, cylinder 3", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Piston, cylinder 2", exact: true })).toHaveCount(0);
  await crank.fill("268");
  await pair.selectOption("all");
  await expect(crank).toHaveValue("268");
  await expect(inspector.getByRole("button", { name: /^Piston, cylinder \d+$/ })).toHaveCount(4);
  await pair.selectOption("1");
  await expect(crank).toHaveValue("268");
  await expect(inspector.getByRole("button", { name: /^Piston, cylinder \d+$/ })).toHaveCount(1);
  await button("Crankshaft and camshaft").click();
  await expect(button("Assemble group")).toBeVisible();
  const study = select("Study view");
  await expect(study).toHaveValue("assemblies");
  await study.selectOption("cycle");
  await expect(pair).toHaveValue("system");
  await pair.selectOption("all");
  await expect(inspector.getByRole("button", { name: /^Piston, cylinder \d+$/ })).toHaveCount(4);
  await button("Whole power cycle").click();
  await expect(pair).toHaveValue("system");
  await expect(crank).toBeHidden();
  await pair.selectOption("4");
  await study.selectOption("fuel");
  await expect(study).toHaveValue("fuel");
  await expect(idlerPin).toHaveCount(0);
  await expect(crank).toBeHidden();
  await expect(groups).toBeHidden();
  await expect(inspector.getByRole("button", { name: /^Piston, cylinder \d+$/ })).toHaveCount(0);
});
