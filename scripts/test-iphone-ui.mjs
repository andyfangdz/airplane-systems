import { test, expect } from "@playwright/test";

const portrait = { width: 390, height: 844 };
const landscapes = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
];

// Safari 27.1's documented iPhone Duo CSS bounds with browser chrome expanded (svh) and collapsed (lvh):
// https://webkit.org/blog/18486/webkit-features-for-safari-27-1/
// This exercises responsive bounds in WebKit, not Duo hardware, its user agent, or experimental posture APIs.
const duoSizes = [
  {
    chrome: "expanded",
    outerHeight: 580,
    outerLandscapeHeight: 368,
    innerHeight: 867,
    innerLandscapeHeight: 585,
    splitHeight: 571,
  },
  {
    chrome: "collapsed",
    outerHeight: 618,
    outerLandscapeHeight: 406,
    innerHeight: 902,
    innerLandscapeHeight: 620,
    splitHeight: 609,
  },
];

test("iPhone cylinder header taps activate once even without a compatibility click", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 382, height: 580 });
  await page.goto("/c172s/overview");
  await page.locator(".stage canvas").waitFor();
  await boundedCanvas(page);
  await page.getByRole("button", { name: "Switch to dark mode" }).tap();
  await expect(page.locator(".tb-theme")).toHaveAccessibleName("Switch to light mode");
  await page.getByRole("button", { name: "Switch to light mode" }).tap();
  await expect(page.locator(".tb-theme")).toHaveAccessibleName("Switch to dark mode");
  await page.getByRole("button", { name: /^Choose a model/ }).tap();
  await page.getByRole("link", { name: /Piston cylinder/ }).tap();
  await page.waitForURL("**/components/piston-cylinder");
  await page.locator(".eng-view canvas").waitFor();
  await boundedCanvas(page);
  const picker = page.getByRole("button", { name: /^Choose a model/ });
  const menu = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
  const theme = page.locator(".tb-theme");
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await page.evaluate(() => {
    window.__headerClicks = 0;
    window.__dropCompatibilityClick = false;
    document.addEventListener(
      "click",
      (event) => {
        if (!event.target.closest?.(".fleet-trigger, .tb-theme")) return;
        // Reproduce the reported highlight-without-activation outcome while retaining the real touch sequence.
        if (window.__dropCompatibilityClick && event.isTrusted) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        window.__headerClicks++;
      },
      true,
    );
  });
  for (const paused of [false, true]) {
    if (paused) await pause.tap();
    await expect(pause).toHaveAttribute("aria-pressed", String(paused));
    for (const drop of [false, true]) {
      await page.evaluate((drop) => {
        window.__dropCompatibilityClick = drop;
        window.__headerClicks = 0;
      }, drop);
      const icon = await theme.locator("svg").boundingBox();
      await page.touchscreen.tap(icon.x + icon.width / 2, icon.y + icon.height / 2);
      await expect(theme).toHaveAccessibleName("Switch to light mode");
      await theme.tap();
      await expect(theme).toHaveAccessibleName("Switch to dark mode");
      const label = await picker.locator(".fleet-current-name").boundingBox();
      await page.touchscreen.tap(label.x + label.width / 2, label.y + label.height / 2);
      await expect(menu).toBeVisible();
      // Allow a delayed native click time to arrive: a double activation would close the list again.
      await page.waitForTimeout(400);
      await expect(menu).toBeVisible();
      expect(await page.evaluate(() => window.__headerClicks)).toBe(3);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    }
  }
  await page.evaluate(() => (window.__dropCompatibilityClick = false));
  await picker.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await theme.focus();
  await page.keyboard.press("Space");
  await expect(theme).toHaveAccessibleName("Switch to light mode");
  await page.keyboard.press("Space");
  await expect(theme).toHaveAccessibleName("Switch to dark mode");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: info.outputPath("cylinder-header-touch.png") });
  expect(errors).toEqual([]);
});

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem("tourDone", "1");
    localStorage.setItem("sr20theme", "light");
    const probe = (window.__iphoneScene = { frames: 0, triangles: 0 });
    const devtools = new EventTarget();
    devtools.addEventListener("observe", ({ detail: renderer }) => {
      if (!renderer?.isWebGLRenderer) return;
      const render = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        const result = render(scene, camera);
        probe.triangles = renderer.info.render.triangles;
        probe.frames++;
        return result;
      };
    });
    window.__THREE_DEVTOOLS__ = devtools;
  });
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
});

async function boundedCanvas(page) {
  // The device has DPR 3. Check the real backing buffer after ResizeObserver and the rendering policy settle.
  await expect
    .poll(() =>
      page
        .locator(".stage canvas")
        .first()
        .evaluate((canvas) => {
          const box = canvas.getBoundingClientRect();
          return (
            box.width > 100 &&
            box.height > 100 &&
            canvas.width >= box.width - 1 &&
            canvas.height >= box.height - 1 &&
            canvas.width <= box.width * 1.5 + 1 &&
            canvas.height <= box.height * 1.5 + 1
          );
        }),
    )
    .toBe(true);
  // Resizing clears the drawing buffer. Inspect a real rendered scene, not the correctly sized but empty canvas.
  const frame = await page.evaluate(() => window.__iphoneScene.frames);
  await page.waitForFunction(
    (previous) => window.__iphoneScene.frames >= previous + 2 && window.__iphoneScene.triangles > 0,
    frame,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function expectStudyLayout(page, viewport, shell = ".app") {
  const split = viewport.width >= 640;
  await expect(page.locator(shell)).toHaveCSS("display", split ? "grid" : "flex");
  const stage = await page.locator(".stage").boundingBox();
  const panel = await page.locator(".panel").boundingBox();
  if (split) {
    // Assert real placement: a grid can still put the controls below the model.
    expect(panel.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
    expect(panel.y).toBeLessThan(stage.y + stage.height);
    expect(stage.width).toBeGreaterThanOrEqual(300);
    expect(panel.width).toBeGreaterThanOrEqual(260);
    expect((await page.locator(shell).boundingBox()).height).toBeLessThanOrEqual(viewport.height);
  } else {
    expect(panel.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  }
}

test("iPhone standalone top edge stays opaque without moving or blocking study controls", async ({ page }, info) => {
  const outer = { width: 382, height: 580 };
  await page.setViewportSize(outer);
  await page.goto("/c172s/electrical");
  await boundedCanvas(page);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const edge = page.locator(".app-top-edge");
  await expect(edge).toBeHidden();
  const geometry = () =>
    page
      .locator(".rail, .stage canvas")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  const before = await geometry();
  // Activate the actual application rule. Playwright cannot reproduce the native iOS status-bar blur or
  // standalone container; this checks only our DOM/CSS response to the standalone media condition.
  const activateStandalone = () =>
    page.evaluate(() => {
      let count = 0;
      const visit = (rules) => {
        for (const rule of rules) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes("display-mode: standalone")) {
            rule.media.mediaText = "all";
            count++;
          }
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) visit(sheet.cssRules);
      return count;
    });
  expect(await activateStandalone()).toBeGreaterThan(0);
  await expect(edge).toBeVisible();
  expect(await geometry()).toEqual(before);
  const pinnedEdge = () =>
    expect
      .poll(() =>
        edge.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return (
            box.top === 0 &&
            box.left === 0 &&
            box.width === innerWidth &&
            box.height >= 12 &&
            style.position === "fixed" &&
            style.pointerEvents === "none" &&
            style.opacity === "1" &&
            style.backgroundColor.startsWith("rgb(") &&
            style.backgroundColor === getComputedStyle(document.querySelector(".panel")).backgroundColor
          );
        }),
      )
      .toBe(true);
  await pinnedEdge();
  const light = await edge.evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.getByRole("button", { name: "Switch to dark mode" }).tap();
  await pinnedEdge();
  await expect(edge).not.toHaveCSS("background-color", light);
  await page.getByRole("button", { name: "Hide systems panel", exact: true }).tap();
  await expect(page.locator(".app")).toHaveClass(/systems-collapsed/);
  await page.evaluate(() => scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await pinnedEdge();
  await page.screenshot({ path: info.outputPath("standalone-aircraft-collapsed-outer.png") });

  await page.setViewportSize({ width: 669, height: 867 });
  await pinnedEdge();
  await page.getByRole("button", { name: "Show systems panel", exact: true }).tap();
  await page.getByRole("button", { name: "Switch to light mode" }).tap();
  await expect(edge).toHaveCSS("background-color", light);
  await pinnedEdge();
  await page.getByRole("button", { name: /^Choose a model/ }).tap();
  const menu = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
  await menu.getByRole("link", { name: /Piston cylinder/ }).tap();
  await page.waitForURL("**/components/piston-cylinder");
  await page.locator(".eng-view canvas").waitFor();
  await activateStandalone(); // The component route can load its own stylesheet after the aircraft rule was activated.
  for (const viewport of [{ width: 669, height: 867 }, { width: 951, height: 585 }, outer]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    await expectStudyLayout(page, viewport, ".eng-app");
    await boundedCanvas(page);
    await pinnedEdge();
    expect(
      await page.locator(".eng-brand .fleet-trigger, .eng-brand .tb-theme").evaluateAll((buttons) => {
        const bottom = document.querySelector(".app-top-edge").getBoundingClientRect().bottom;
        return buttons.length === 2 && buttons.every((button) => button.getBoundingClientRect().top >= bottom);
      }),
    ).toBe(true);
    if (viewport.width === 669) await page.screenshot({ path: info.outputPath("standalone-cylinder-inner.png") });
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).tap();
  await pinnedEdge();
  await page.getByRole("button", { name: /^Choose a model/ }).tap();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.evaluate(() => scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await pinnedEdge();
});

test("iPhone expanded scenes fill the bottom safe area while readouts stay clear", async ({ page }, info) => {
  const screens = [
    { width: 669, height: 867 },
    { width: 951, height: 585 },
  ];
  for (const model of [
    { route: "/c172s/electrical", shell: ".app", readout: ".stage-foot .cas", name: "aircraft" },
    { route: "/components/piston-cylinder", shell: ".eng-app", readout: ".eng-mon", name: "cylinder" },
  ]) {
    await page.setViewportSize(screens[0]);
    await page.goto(model.route);
    await page.locator(".stage canvas").waitFor();
    // WebKit emulation has zero hardware insets. Use the app's actual safe-area token, not replacement layout CSS.
    await page.evaluate(() => document.documentElement.style.setProperty("--safe-area-bottom", "34px"));
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page.locator(model.shell)).toHaveCSS("padding-bottom", "34px");
    const canvas = await page.locator(".stage canvas").elementHandle();
    const preserved = async () =>
      expect(
        await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".stage canvas")),
      ).toBe(true);
    for (const viewport of screens) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => scrollTo(0, 0));
      await expectStudyLayout(page, viewport, model.shell);
      const filled = async () => {
        await boundedCanvas(page);
        await expect
          .poll(() => canvas.evaluate((node) => Math.abs(node.getBoundingClientRect().bottom - innerHeight)))
          .toBeLessThanOrEqual(1);
        const readout = await page.locator(model.readout).boundingBox();
        expect(readout.height).toBeGreaterThan(0);
        expect(readout.y + readout.height).toBeLessThanOrEqual(viewport.height - 34);
        await preserved();
      };
      await filled();
      if (model.name === "aircraft") {
        await page.getByRole("button", { name: "Hide details panel", exact: true }).tap();
        await filled();
        if (viewport.width === 669)
          await page.screenshot({ path: info.outputPath("bottom-safe-aircraft-expanded.png") });
        await page.getByRole("button", { name: "Show details panel", exact: true }).tap();
      } else if (viewport.width === 669)
        await page.screenshot({ path: info.outputPath("bottom-safe-cylinder-expanded.png") });
    }
    const narrow = { width: 382, height: 580 };
    await page.setViewportSize(narrow);
    await page.evaluate(() => scrollTo(0, 0));
    await expectStudyLayout(page, narrow, model.shell);
    await boundedCanvas(page);
    await preserved();
    const scene = await page.locator(".stage canvas").boundingBox();
    const readout = await page.locator(model.name === "aircraft" ? ".stage-under .cas" : model.readout).boundingBox();
    const panel = await page.locator(".panel").boundingBox();
    expect(readout.y).toBeGreaterThanOrEqual(scene.y + scene.height - 1);
    expect(panel.y).toBeGreaterThanOrEqual(readout.y + readout.height - 1);
  }
});

test("iPhone aircraft rotation preserves a usable scene and reachable collapsed controls", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/c172s/overview");
  await page.locator(".stage canvas").waitFor();
  await page.waitForFunction(
    () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
    null,
    { timeout: 120_000 },
  );
  const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
  if (await addAll.isVisible()) await addAll.tap();
  await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120_000 });
  const canvas = await page.locator(".stage canvas").elementHandle();

  for (const viewport of [portrait, ...landscapes, portrait]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    await expectStudyLayout(page, viewport);
    await boundedCanvas(page);
    expect(await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".stage canvas"))).toBe(
      true,
    );
    if (viewport.width === 932) {
      // Device emulation reports zero safe-area env values. Supply the shell padding used by a notched iPhone.
      const safeArea = await page.addStyleTag({ content: ".app { padding: 0 47px 21px !important; }" });
      await page.getByRole("button", { name: /^Choose a model/ }).tap();
      const picker = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
      await expect(picker).toBeVisible();
      await expect
        .poll(() =>
          picker.evaluate((menu) => {
            const box = menu.getBoundingClientRect();
            return box.left >= 47 && box.right <= innerWidth - 47 && box.top >= 0 && box.bottom <= innerHeight - 21;
          }),
        )
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await safeArea.evaluate((style) => style.remove());
    }
    const labels = page.getByRole("button", { name: "Labels", exact: true });
    expect((await labels.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const reset = await page.getByRole("button", { name: "Reset view", exact: true }).boundingBox();
    expect(reset.width).toBeGreaterThanOrEqual(44);
    expect(reset.height).toBeGreaterThanOrEqual(44);
    await labels.tap();
    await expect(labels).toHaveAttribute("aria-pressed", "false");
    await labels.tap();
    await expect(labels).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Hide details panel", exact: true }).tap();
    await page.evaluate(() => scrollTo(0, 0));
    await boundedCanvas(page);
    const show = page.getByRole("button", { name: "Show details panel", exact: true });
    await expect
      .poll(() =>
        show.evaluate((button) => {
          const box = button.getBoundingClientRect();
          return (
            box.top >= 0 &&
            box.bottom <= innerHeight &&
            button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
          );
        }),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath(`aircraft-${viewport.width}-collapsed.png`) });
    await show.tap();
    await expect(page.locator("#details-panel")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

for (const route of ["engines/io390", "components/pitot-static"]) {
  test(`iPhone ${route}: controls remain reachable after portrait and landscape rotation`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${route}`);
    await page.locator(".eng-view canvas").waitFor();
    await page.locator(".part-inspector").waitFor();
    const canvas = await page.locator(".eng-view canvas").elementHandle();
    for (const viewport of [
      portrait,
      ...landscapes,
      { width: 594, height: 368 },
      { width: 951, height: 585 },
      { width: 951, height: 500 },
      { width: 669, height: 867 },
      { width: 669, height: 902 },
      portrait,
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => scrollTo(0, 0));
      const expanded = viewport.width >= 640;
      await expectStudyLayout(page, viewport, ".eng-app");
      await boundedCanvas(page);
      expect(
        await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".eng-view canvas")),
      ).toBe(true);
      if (expanded) {
        await expect(page.locator(".eng-stage")).not.toHaveCSS("position", "sticky");
        expect((await page.locator(".eng-app").boundingBox()).height).toBeLessThanOrEqual(viewport.height);
      } else if (viewport.height < 560) {
        await expect(page.locator(".eng-stage")).not.toHaveCSS("position", "sticky");
        await page.evaluate(() => scrollBy(0, 300));
        expect((await page.locator(".eng-stage").boundingBox()).y).toBeLessThan(0);
      } else {
        await expect(page.locator(".eng-stage")).toHaveCSS("position", "sticky");
      }
      const inspector = page.locator(".part-inspector details");
      if (!(await inspector.evaluate((details) => details.open))) await inspector.locator("summary").tap();
      const search = page.getByRole("searchbox", { name: "Find a part" });
      expect(await search.evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
      await search.fill("no such aircraft part");
      await expect(page.locator(".part-empty")).toBeVisible();
      await search.fill("");
      const part = page.locator(".part-index button").first();
      const name = await part.innerText();
      await part.tap();
      await expect(page.locator(".part-explanation h3")).toHaveText(name);
      await page.screenshot({ path: info.outputPath(`inspector-${viewport.width}.png`) });
    }
    expect(errors).toEqual([]);
  });
}

test("iPhone Duo screen transitions preserve the aircraft session and controls", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 382, height: duoSizes[0].outerHeight });
  await page.goto("/c172s/electrical");
  await page.locator(".stage canvas").waitFor();
  await page.waitForFunction(
    () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
    null,
    { timeout: 120_000 },
  );
  const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
  if (await addAll.isVisible()) await addAll.tap();
  await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120_000 });
  const canvas = await page.locator(".stage canvas").elementHandle();
  const xray = page.getByRole("button", { name: "X-ray", exact: true });
  await xray.tap();
  await expect(xray).toHaveAttribute("aria-pressed", "false");
  const battery = page.getByRole("button", { name: "BAT", exact: true });
  await battery.tap();
  const batteryState = await battery.getAttribute("aria-pressed");
  const route = page.url();

  for (const size of duoSizes) {
    const screens = [
      { name: "outer", width: 382, height: size.outerHeight },
      { name: "inner-landscape", width: 951, height: size.innerLandscapeHeight },
      { name: "inner-short-window", width: 951, height: 500 },
      { name: "inner-portrait", width: 669, height: size.innerHeight },
      { name: "split-view", width: 385, height: size.splitHeight },
      { name: "outer-landscape", width: 594, height: size.outerLandscapeHeight },
      { name: "outer-return", width: 382, height: size.outerHeight },
    ];
    for (const { name, width, height } of screens) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      await expectStudyLayout(page, { width, height });
      await boundedCanvas(page);
      expect(
        await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".stage canvas")),
      ).toBe(true);
      expect(page.url()).toBe(route);
      const selected = page.locator('.syslist button[aria-current="true"]');
      await expect(selected.locator(".nm")).toHaveText("Electrical");
      await expect
        .poll(() =>
          selected.evaluate((button) => {
            const chip = button.getBoundingClientRect();
            const strip = button.closest(".syslist").getBoundingClientRect();
            return chip.left >= strip.left - 1 && chip.right <= strip.right + 1;
          }),
        )
        .toBe(true);
      await expect(xray).toHaveAttribute("aria-pressed", "false");
      await expect(battery).toHaveAttribute("aria-pressed", batteryState);

      // A real tap verifies the resized toolbar remains reachable, while resetting only the camera.
      const reset = page.getByRole("button", { name: "Reset view", exact: true });
      await reset.tap();
      const box = await reset.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await boundedCanvas(page);
      if (size.chrome === "expanded") await page.screenshot({ path: info.outputPath(`duo-${name}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

const componentControls = [
  { id: "piston-cylinder", control: "#piston-ignition-top" },
  { id: "carburetor", control: "#f-filter", checkbox: true },
  { id: "fuel-injector", control: "#f-pump", checkbox: true },
  { id: "surefly", control: "#sf-stage-time" },
  { id: "governor", control: "#gov-f-stickyValve", checkbox: true },
  { id: "pitot-static", control: "#ps-avionics-g1000" },
];

async function componentToggleLayout(page) {
  const toggle = page.locator(".eng-view .model-size-toggle");
  await expect(toggle).toHaveAttribute("aria-controls", "component-model-view");
  await expect
    .poll(() =>
      toggle.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const view = button.closest(".eng-view").getBoundingClientRect();
        return (
          box.width >= 44 &&
          box.height >= 44 &&
          box.left >= view.left &&
          box.right <= view.right &&
          box.top >= view.top &&
          box.bottom <= view.bottom &&
          button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        );
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const button = document.querySelector(".model-size-toggle").getBoundingClientRect();
        const overlaps = (box) =>
          box.left < button.right && box.right > button.left && box.top < button.bottom && box.bottom > button.top;
        return [...document.querySelectorAll(".eng-label, .inj-legend")]
          .filter((el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width)
          .filter((el) => overlaps(el.getBoundingClientRect()))
          .map((el) => el.textContent);
      }),
    )
    .toEqual([]);
  const stage = await page.locator(".eng-stage").boundingBox();
  const foot = await page.locator(".eng-foot").boundingBox();
  expect(foot.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  expect(foot.height).toBeGreaterThan(0);
}

async function pinnedPitotInstruments(page) {
  await page.evaluate(() => scrollTo(0, 500));
  await expect(page.locator(".eng-stage")).toHaveCSS("position", "sticky");
  await expect(page.locator(".eng-foot")).toHaveCSS("position", "sticky");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document.querySelector(".eng-stage").getBoundingClientRect();
        const monitor = document.querySelector(".eng-foot").getBoundingClientRect();
        return Math.abs(stage.top) <= 1 && Math.abs(monitor.top - stage.bottom) <= 1;
      }),
    )
    .toBe(true);
  await componentToggleLayout(page);
  await page.evaluate(() => scrollTo(0, 0));
}

for (const { id, control, checkbox } of componentControls) {
  test(`iPhone component ${id}: model collapse preserves study controls and clear overlays`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const outer = { width: 382, height: 580 };
    await page.setViewportSize(outer);
    await page.goto(`/components/${id}`);
    await page.locator(".eng-view canvas").waitFor();
    await boundedCanvas(page);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const intro = page.getByRole("button", { name: "About this model" });
    await expect(intro).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".component-intro .lead")).toBeHidden();
    await intro.tap();
    await expect(page.locator(".component-intro .lead")).toBeVisible();
    await intro.tap();
    await expect(page.locator(".component-intro .lead")).toBeHidden();
    const inspect = page.locator(".part-inspector summary");
    if (await inspect.count()) {
      const aboutBox = await intro.boundingBox();
      const inspectBox = await inspect.boundingBox();
      expect(Math.abs(inspectBox.y - aboutBox.y)).toBeLessThanOrEqual(1);
      expect(inspectBox.x + inspectBox.width).toBeLessThanOrEqual(aboutBox.x + 1);
      await inspect.tap();
      await expect(page.getByRole("searchbox", { name: "Find a part" })).toBeVisible();
      await inspect.tap();
    }
    const footWidth = (await page.locator(".eng-foot").boundingBox()).width;
    expect(footWidth).toBeGreaterThanOrEqual(outer.width - 1);
    const footPadding = await page.locator(".eng-foot").evaluate((node) => {
      const style = getComputedStyle(node);
      return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    });
    expect((await page.locator(".eng-mon").boundingBox()).width).toBeGreaterThanOrEqual(footWidth - footPadding - 1);
    const canvas = await page.locator(".eng-view canvas").elementHandle();
    const selected = page.locator(control);
    if (checkbox) await selected.check();
    else await selected.tap();
    const preserved = async () => {
      if (checkbox) await expect(selected).toBeChecked();
      else await expect(selected).toHaveAttribute("aria-pressed", "true");
      expect(
        await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".eng-view canvas")),
      ).toBe(true);
    };
    await page.evaluate(() => scrollTo(0, 0));
    await boundedCanvas(page);
    const expanded = (await page.locator(".eng-stage").boundingBox()).height;
    const toggle = page.locator(".model-size-toggle");
    await expect(toggle).toHaveAccessibleName("Collapse model");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await componentToggleLayout(page);
    await page.screenshot({ path: `.shots/component-collapse/${id}-before.png` });
    if (id === "pitot-static") await pinnedPitotInstruments(page);

    await toggle.tap();
    await expect(toggle).toHaveAccessibleName("Expand model");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await page.locator(".eng-stage").boundingBox()).height).toBeLessThan(expanded - 20);
    await boundedCanvas(page);
    await preserved();
    await componentToggleLayout(page);
    await page.screenshot({ path: `.shots/component-collapse/${id}-collapsed.png` });
    if (id === "pitot-static") await pinnedPitotInstruments(page);

    if (id === "piston-cylinder") {
      // Opening the inner display keeps the compact preference without applying a phone-only height to its grid.
      for (const viewport of [{ width: 594, height: 368 }, { width: 669, height: 867 }, outer]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => scrollTo(0, 0));
        await expectStudyLayout(page, viewport, ".eng-app");
        await boundedCanvas(page);
        await preserved();
        if (viewport.width >= 640) {
          await expect(toggle).toBeHidden();
          await expect(intro).toBeHidden();
          await expect(page.locator(".component-intro .lead")).toBeVisible();
          expect((await page.locator(".eng-stage").boundingBox()).height).toBeGreaterThan(500);
        } else {
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await componentToggleLayout(page);
          if (viewport.width === 594) {
            const compact = (await page.locator(".eng-stage").boundingBox()).height;
            await toggle.tap();
            await expect
              .poll(async () => (await page.locator(".eng-stage").boundingBox()).height)
              .toBeGreaterThan(compact + 20);
            await toggle.tap();
            await expect(toggle).toHaveAttribute("aria-expanded", "false");
            await boundedCanvas(page);
          }
        }
        await page.screenshot({ path: `.shots/component-collapse/${id}-${viewport.width}-compact.png` });
      }
    }

    await toggle.tap();
    await expect(toggle).toHaveAccessibleName("Collapse model");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await page.locator(".eng-stage").boundingBox()).height).toBe(expanded);
    await boundedCanvas(page);
    await preserved();
    await componentToggleLayout(page);
    await page.screenshot({ path: `.shots/component-collapse/${id}-after.png` });
    expect(errors).toEqual([]);
  });
}

test("iPhone safe-area picker survives unfolding and keeps internal navigation in one document", async ({
  page,
  context,
}, info) => {
  // WebKit can exercise viewport bounds and SPA navigation; it cannot emulate the installed iOS app container.
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()) && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 382, height: 580 });
  await page.goto("/components/piston-cylinder");
  await page.locator(".eng-view canvas").waitFor();
  await boundedCanvas(page);
  await page.locator("#piston-ignition-top").tap();
  await page.evaluate(() => {
    scrollTo(0, 0);
    window.__navigationDocument = "preserved";
  });
  // Emulation reports zero hardware safe insets. Apply the same padding that the shell receives on a device.
  await page.addStyleTag({
    content: ".app, .eng-app { padding: 47px 47px 34px !important; } nextjs-portal { display: none !important; }",
  });
  const picker = page.getByRole("button", { name: /^Choose a model/ });
  const menu = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
  await picker.tap();
  for (const viewport of [
    { width: 382, height: 580 },
    { width: 669, height: 867 },
    { width: 951, height: 585 },
    { width: 382, height: 580 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(menu).toBeVisible();
    await expect
      .poll(() =>
        menu.evaluate((panel) => {
          const box = panel.getBoundingClientRect();
          return (
            box.width > 100 &&
            box.height > 44 &&
            box.left >= 59 &&
            box.right <= innerWidth - 59 + 1 &&
            box.top >= 59 &&
            box.bottom <= innerHeight - 46 + 1
          );
        }),
      )
      .toBe(true);
    await expect(picker).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#piston-ignition-top")).toHaveAttribute("aria-pressed", "true");
    if (viewport.width === 669) await page.screenshot({ path: info.outputPath("inner-safe-area-picker.png") });
  }
  await menu.getByRole("link", { name: /Propeller governor/ }).tap();
  await page.waitForURL("**/components/governor");
  await page.locator(".eng-view canvas").waitFor();
  expect(await page.evaluate(() => window.__navigationDocument)).toBe("preserved");
  await page.getByRole("button", { name: "Switch to dark mode" }).tap();
  await expect
    .poll(() =>
      page
        .locator('meta[name="theme-color"]')
        .evaluateAll(
          (metas) =>
            metas.length === 2 &&
            metas.every((meta) => meta.media === (meta.content === "#111a21" ? "all" : "not all")) &&
            metas.some((meta) => meta.content === "#111a21"),
        ),
    )
    .toBe(true);

  await page.evaluate(() => localStorage.setItem("sys:c172s", "fuel"));
  await page.getByRole("button", { name: /^Choose a model/ }).tap();
  await menu.getByRole("group", { name: "Airplanes", exact: true }).getByRole("link", { name: /172S/ }).tap();
  await page.waitForURL("**/c172s/fuel");
  await page.locator(".stage canvas").waitFor();
  expect(await page.evaluate(() => window.__navigationDocument)).toBe("preserved");
  const canvas = await page.locator(".stage canvas").elementHandle();
  await page.locator(".syslist button").filter({ hasText: "Electrical" }).tap();
  await page.waitForURL("**/c172s/electrical");
  expect(await canvas.evaluate((node) => node.isConnected && node === document.querySelector(".stage canvas"))).toBe(
    true,
  );
  expect(await page.evaluate(() => window.__navigationDocument)).toBe("preserved");
  expect(context.pages()).toHaveLength(1);
  expect(errors).toEqual([]);
});
