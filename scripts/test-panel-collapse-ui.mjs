import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Exercise taps and clipping in the real layout; hidden content alone does not prove a panel is usable.
test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addInitScript(() => localStorage.setItem("tourDone", "1"));
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto(`${baseURL}/c172s/overview`);
  await page.waitForSelector("canvas");
  await page.waitForFunction(
    () => !document.querySelector("[data-building]") || document.querySelector(".loader-skip"),
    null,
    { timeout: 120_000 },
  );
  const addAll = page.getByRole("button", { name: "Add all the remaining parts now", exact: true });
  if (await addAll.isVisible()) await addAll.click();
  await page.waitForFunction(() => !document.querySelector("[data-building]"), null, { timeout: 120_000 });
  mkdirSync(".shots", { recursive: true });
});

test("reopening systems reveals a system selected while the rail was hidden", async ({ page, isMobile }) => {
  const activate = (button) => (isMobile ? button.tap() : button.click());
  await activate(page.getByRole("button", { name: "Hide systems panel", exact: true }));
  const lastSystem = page.locator(".overview-grid button").last();
  const name = await lastSystem.locator("b").innerText();
  await activate(lastSystem);
  await activate(page.getByRole("button", { name: "Show systems panel", exact: true }));
  const selected = page.locator('.syslist button[aria-current="true"]');
  await expect(selected.locator(".nm")).toHaveText(name);
  await expect
    .poll(
      () =>
        selected.evaluate((button) => {
          const b = button.getBoundingClientRect(),
            list = button.closest("ul").getBoundingClientRect();
          return b.left >= list.left && b.right <= list.right && b.top >= list.top && b.bottom <= list.bottom;
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  await page.screenshot({ path: `.shots/review-selected-system-${isMobile ? "phone" : "desktop"}.png` });
});

test("active phone preflight keeps the details opener and check navigation reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The sticky scene and bottom details panel are specific to phones");
  await page.getByRole("button", { name: "Hide systems panel", exact: true }).tap();
  await page.getByRole("button", { name: "Preflight", exact: true }).tap();
  await expect(page.locator(".rail")).toBeHidden();
  const stage = await page.locator(".stage").boundingBox();
  expect((await page.locator(".toolbar").boundingBox()).x).toBeCloseTo(stage.x + 12, 0);
  await page.getByRole("button", { name: "Begin study walk", exact: true }).tap();
  await page.locator(".walk-scene .walk-actions").waitFor();
  await page.getByRole("button", { name: "Hide details panel", exact: true }).tap();
  await expect(page.locator("#details-panel")).toBeHidden();
  assert.equal((await page.locator(".panel").boundingBox()).height, 0, "No empty panel bar remains");
  const show = page.getByRole("button", { name: "Show details panel", exact: true });
  await expect
    .poll(
      () =>
        show.evaluate((button) => {
          const box = button.getBoundingClientRect();
          return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  const current = await page.locator(".walk-scene .walk-id").innerText();
  await page.locator(".walk-scene").getByRole("button", { name: "Next item", exact: true }).tap();
  await expect(page.locator(".walk-scene .walk-id")).not.toHaveText(current);
  await page.screenshot({ path: ".shots/review-preflight-details-collapsed.png" });
  await show.tap();
  await expect(page.locator("#details-panel")).toBeVisible();
  await page.locator(".walk-x").tap();
  await expect(page.locator(".walk")).toHaveCount(0);
  await page.getByRole("button", { name: "Show systems panel", exact: true }).tap();
  await expect(page.locator(".syslist")).toBeVisible();
});

test("tablet navigation preserves model width and selecting a system keeps the controls available", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Tablet layout is checked with a desktop browser viewport");
  await page.setViewportSize({ width: 900, height: 800 });
  const stage = await page.locator(".stage").boundingBox();
  expect(stage.width).toBeGreaterThanOrEqual(550);
  await page
    .locator(".syslist")
    .getByRole("button", { name: /Electrical/ })
    .click();
  await expect(page.locator(".panel h2")).toHaveText("Electrical");
  await page.screenshot({ path: ".shots/tablet-study-navigation.png" });
});

test("Duo headers collapse without moving their button and give their height back to the scene", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Header hit areas are checked with touch input");
  const rail = page.locator(".rail");
  const picker = rail.getByRole("button", { name: /^Choose a model/ });
  const dialog = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
  const checkButtons = async (collapsed = false) => {
    const controls = await rail
      .locator(".fleet-trigger:visible, .rail-settings .tb:visible, .panel-toggle:visible")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return {
            label: button.getAttribute("aria-label") || button.textContent,
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            reachable: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
          };
        }),
      );
    expect(controls).toHaveLength(collapsed ? 1 : 4);
    for (const [index, control] of controls.entries()) {
      expect(control.width, control.label).toBeGreaterThanOrEqual(44);
      expect(control.height, control.label).toBeCloseTo(44, 0);
      expect(control.reachable, control.label).toBe(true);
      for (const other of controls.slice(index + 1)) {
        expect(
          control.x < other.right && control.right > other.x && control.y < other.bottom && control.bottom > other.y,
          `${control.label} overlaps ${other.label}`,
        ).toBe(false);
      }
    }
  };
  for (const viewport of [
    { width: 951, height: 620 },
    { width: 951, height: 500 },
    { width: 669, height: 867 },
    { width: 669, height: 902 },
    { width: 382, height: 580 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    await expect(picker).toContainText("C172S Skyhawk");
    await expect(picker.getByText("Choose a model", { exact: true })).toBeVisible();
    expect((await rail.boundingBox()).height).toBeLessThanOrEqual(viewport.width >= 640 ? 80 : 128);
    await checkButtons();
    await page
      .locator(".syslist")
      .getByRole("button", { name: /Electrical/ })
      .tap();
    for (const detailsCollapsed of [false, true]) {
      if (detailsCollapsed) {
        await page.getByRole("button", { name: "Hide details panel", exact: true }).tap();
        const opener = await page.getByRole("button", { name: "Show details panel", exact: true }).boundingBox();
        expect(opener.width).toBeGreaterThanOrEqual(44);
        expect(opener.height).toBeGreaterThanOrEqual(44);
      }
      await page.evaluate(() => scrollTo(0, 0));
      const headerHeight = (await rail.boundingBox()).height;
      const before = await page.locator(".stage").boundingBox();
      const hide = page.getByRole("button", { name: "Hide systems panel", exact: true });
      const toggleBefore = await hide.boundingBox();
      if (!detailsCollapsed && viewport.width >= 640) {
        const details = await page.locator(".panel").boundingBox();
        expect(details.x).toBeGreaterThanOrEqual(before.x + before.width - 1);
        expect(details.y).toBeCloseTo(before.y, 0);
      }
      if (!detailsCollapsed) await page.screenshot({ path: `.shots/duo-header-${viewport.width}-expanded.png` });
      await hide.tap();
      await expect(page.locator(".syslist")).toBeHidden();
      await expect(picker).toBeHidden();
      await expect(rail.locator(".rail-settings")).toBeHidden();
      expect((await rail.boundingBox()).height).toBe(0);
      await expect(rail.locator("button:visible")).toHaveCount(1);
      await checkButtons(true);
      const after = await page.locator(".stage").boundingBox();
      expect(before.y - after.y).toBeCloseTo(headerHeight, 0);
      if (viewport.width >= 640 || detailsCollapsed) expect(after.height - before.height).toBeCloseTo(headerHeight, 0);
      const show = page.getByRole("button", { name: "Show systems panel", exact: true });
      const opener = await show.boundingBox();
      expect(opener.x).toBeCloseTo(toggleBefore.x, 0);
      expect(opener.y).toBeCloseTo(toggleBefore.y, 0);
      const toolbar = await page.locator(".toolbar").boundingBox();
      expect(opener.x + opener.width).toBeLessThanOrEqual(toolbar.x);
      await page.screenshot({
        path: `.shots/duo-header-${viewport.width}-collapsed${detailsCollapsed ? "-details-hidden" : ""}.png`,
      });
      await show.tap();
      await expect(picker).toBeVisible();
      const restored = await hide.boundingBox();
      expect(restored.x).toBeCloseTo(toggleBefore.x, 0);
      expect(restored.y).toBeCloseTo(toggleBefore.y, 0);
      await checkButtons();
      await picker.tap();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { pressed: true }).tap();
      await expect(dialog).toBeHidden();
      const selected = page.locator('.syslist button[aria-current="true"]');
      await expect(selected.locator(".nm")).toHaveText("Electrical");
      await expect
        .poll(() =>
          selected.evaluate((button) => {
            const box = button.getBoundingClientRect();
            const strip = button.closest("ul").getBoundingClientRect();
            return box.left >= strip.left && box.right <= strip.right;
          }),
        )
        .toBe(true);
      if (detailsCollapsed) await page.getByRole("button", { name: "Show details panel", exact: true }).tap();
      await expect(page.locator(".panel h2")).toHaveText("Electrical");
    }
    if (viewport.width < 640) {
      await page.evaluate(() => scrollTo(0, 160));
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const hide = page.getByRole("button", { name: "Hide systems panel", exact: true });
      const before = await hide.boundingBox();
      await hide.tap();
      const show = page.getByRole("button", { name: "Show systems panel", exact: true });
      const collapsed = await show.boundingBox();
      expect(collapsed.x).toBeCloseTo(before.x, 0);
      expect(collapsed.y).toBeCloseTo(before.y, 0);
      await show.tap();
      const restored = await hide.boundingBox();
      expect(restored.x).toBeCloseTo(before.x, 0);
      expect(restored.y).toBeCloseTo(before.y, 0);
      await expect(picker).toBeInViewport();
    }
  }
});

test("outer Duo view actions fit without scrolling and model size stays separate from alerts", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Compact scene controls are checked with touch input");
  const toolbar = page.locator(".scene-toolbar");
  const cas = page.locator(".stage-under .cas");
  const reading = page.getByRole("button", { name: "Collapse model", exact: true });
  const checkModelControl = async () => {
    const stage = await page.locator(".stage").boundingBox();
    const row = await page.locator(".stage-under").boundingBox();
    const status = await cas.boundingBox();
    const action = await reading.boundingBox();
    expect(status.width).toBeGreaterThanOrEqual(row.width - 24);
    expect(status.x).toBeGreaterThanOrEqual(row.x);
    expect(status.x + status.width).toBeLessThanOrEqual(row.x + row.width);
    expect(action.width).toBeCloseTo(44, 0);
    expect(action.height).toBeCloseTo(44, 0);
    expect(action.x).toBeGreaterThanOrEqual(stage.x);
    expect(action.x + action.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(action.y).toBeGreaterThanOrEqual(stage.y);
    expect(action.y + action.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(action.y + action.height).toBeLessThanOrEqual(status.y);
    const bar = await toolbar.boundingBox();
    expect(action.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    await expect(reading).toHaveAttribute("aria-controls", "model-view");
    await expect(reading).toHaveAttribute("aria-expanded", "true");
    expect(await reading.innerText()).toBe("");
    expect(
      await reading.evaluate((button) => {
        const box = button.getBoundingClientRect();
        return (
          !!button.closest(".stage") &&
          button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        );
      }),
    ).toBe(true);
    await expect(page.locator(".stage-under button[aria-controls='model-view']")).toHaveCount(0);
    expect(
      await cas.evaluate((node) => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight),
    ).toBe(true);
    await expect(cas.locator("li").first()).toBeVisible();
  };
  for (const viewport of [
    { width: 382, height: 580 },
    { width: 382, height: 618 },
    { width: 594, height: 368 },
    { width: 594, height: 406 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByRole("button", { name: "Hide systems panel", exact: true }).tap();
      const controls = await toolbar.evaluate((bar) => {
        const bounds = bar.getBoundingClientRect();
        return {
          scrolls: bar.scrollWidth > bar.clientWidth,
          buttons: [...bar.querySelectorAll("button")].map((button) => {
            const box = button.getBoundingClientRect();
            return {
              name: button.getAttribute("aria-label"),
              width: box.width,
              height: box.height,
              inside:
                box.left >= Math.max(0, bounds.left) &&
                box.right <= Math.min(innerWidth, bounds.right) &&
                box.top >= Math.max(0, bounds.top) &&
                box.bottom <= Math.min(innerHeight, bounds.bottom),
              reachable: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
            };
          }),
        };
      });
      expect(controls.scrolls).toBe(false);
      expect(controls.buttons.map((button) => button.name)).toEqual([
        "Preflight",
        "X-ray",
        "Labels",
        "Auto-rotate",
        "Reset view",
      ]);
      for (const button of controls.buttons) {
        expect(button.width, button.name).toBeCloseTo(44, 0);
        expect(button.height, button.name).toBeCloseTo(44, 0);
        expect(button.inside, button.name).toBe(true);
        expect(button.reachable, button.name).toBe(true);
      }
      for (const name of ["Labels", "X-ray", "Auto-rotate"]) {
        const button = toolbar.getByRole("button", { name, exact: true });
        const initial = await button.getAttribute("aria-pressed");
        await button.tap();
        await expect(button).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
        await button.tap();
        await expect(button).toHaveAttribute("aria-pressed", initial);
      }
      await toolbar.getByRole("button", { name: "Reset view", exact: true }).tap();
      await checkModelControl();
      await page.screenshot({
        path: `.shots/duo-front-${viewport.width}x${viewport.height}${collapsed ? "-collapsed" : ""}.png`,
      });
    }
    await page.getByRole("button", { name: "Show systems panel", exact: true }).tap();
  }
  // Keep real warning text readable across the full alert row, not only the quiet "No alerts" state.
  await page
    .locator(".syslist")
    .getByRole("button", { name: /Electrical/ })
    .tap();
  const battery = page.getByRole("button", { name: "BAT", exact: true });
  if ((await battery.getAttribute("aria-pressed")) === "true") await battery.tap();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(cas).toContainText("LOW VOLTS");
  await checkModelControl();
});

test("phone reading space keeps the model visible and restores its previous size", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Reading space is a phone layout option");
  const height = (await page.locator(".stage").boundingBox()).height;
  const canvas = await page.locator("#model-view canvas").elementHandle();
  const reading = page.locator('.stage button[aria-controls="model-view"]');
  await expect(reading).toHaveAccessibleName("Collapse model");
  await expect(reading).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: ".shots/phone-study-before-reading.png" });
  await reading.tap();
  await expect(reading).toHaveAccessibleName("Expand model");
  await expect(reading).toHaveAttribute("aria-expanded", "false");
  const compactHeight = (await page.locator(".stage").boundingBox()).height;
  expect(compactHeight).toBeLessThan(height - 50);
  expect(compactHeight).toBeGreaterThanOrEqual(210);
  await expect(page.locator("canvas")).toBeVisible();
  // The responsive canvas buffer and camera fit follow ResizeObserver, after the CSS box has resized.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".shots/phone-study-reading.png" });
  await reading.tap();
  await expect(reading).toHaveAccessibleName("Collapse model");
  await expect(reading).toHaveAttribute("aria-expanded", "true");
  expect((await page.locator(".stage").boundingBox()).height).toBeCloseTo(height, 0);
  expect(
    await canvas.evaluate((node) => node.isConnected && node === document.querySelector("#model-view canvas")),
  ).toBe(true);
  await page.screenshot({ path: ".shots/phone-study-navigation.png" });
});

test("power-flow diagrams stay open and pinned while breaker controls remain reachable", async ({ page, isMobile }) => {
  const activate = (button) => (isMobile ? button.tap() : button.click());
  await activate(page.locator(".syslist").getByRole("button", { name: /Electrical/ }));
  const flow = page.locator(".power-flow");
  const diagram = flow.locator("svg.wiring");
  const region = flow.getByRole("region", { name: "Power distribution (Figure 7-7) diagram" });
  const breaker = page.locator(".bus button.chip").filter({ hasText: "STDBY BATT" });
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((svg) => !!svg.closest("details"))).toBe(false);
  await expect(region).toHaveAttribute("tabindex", "0");
  const original = await diagram.elementHandle();
  const scroll = (amount) =>
    page.evaluate((delta) => {
      const panel = document.querySelector(".panel");
      if (getComputedStyle(panel).overflowY === "auto") panel.scrollTop += delta;
      else window.scrollBy(0, delta);
    }, amount);
  const reachable = (button) =>
    button.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    });

  for (const viewport of isMobile
    ? [
        { width: 382, height: 580 },
        { width: 594, height: 368 },
      ]
    : [
        { width: 669, height: 867 },
        { width: 951, height: 500 },
      ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.querySelector(".panel").scrollTop = 0;
    });
    const inset = await flow.evaluate((node) => parseFloat(getComputedStyle(node).top));
    const origin = isMobile ? 0 : (await page.locator(".panel").boundingBox()).y;
    const pinnedTop = origin + inset;
    await scroll((await flow.boundingBox()).y - pinnedTop + 80);
    await expect.poll(async () => Math.abs((await flow.boundingBox()).y - pinnedTop)).toBeLessThanOrEqual(1);
    await scroll(120);
    expect((await flow.boundingBox()).y).toBeCloseTo(pinnedTop, 0);
    if (isMobile) expect((await page.locator(".stage").boundingBox()).y).toBeLessThan(0);
    const pinned = await flow.boundingBox();
    expect(viewport.height - pinned.y - pinned.height).toBeGreaterThanOrEqual(52);
    const svg = await diagram.boundingBox();
    expect(svg.height / svg.width).toBeCloseTo(394 / 340, 2);
    // The diagram stays readable at its natural aspect ratio; a short screen scrolls within its labeled region.
    await region.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    expect((await flow.boundingBox()).y).toBeCloseTo(pinnedTop, 0);
    await region.evaluate((node) => {
      node.scrollTop = 0;
    });
    await scroll((await breaker.boundingBox()).y - (pinned.y + pinned.height + 12));
    const control = await breaker.boundingBox();
    expect(control.y).toBeGreaterThanOrEqual(pinned.y + pinned.height);
    expect(control.y + control.height).toBeLessThanOrEqual(viewport.height);
    expect(await reachable(breaker)).toBe(true);
    for (const name of ["Hide systems panel", "Hide details panel"]) {
      const toggle = page.getByRole("button", { name, exact: true });
      if (isMobile && name === "Hide details panel") continue; // The phone details header scrolls above the diagram.
      expect(await reachable(toggle), name).toBe(true);
    }
    await activate(breaker);
    await expect(breaker).toHaveAttribute("aria-pressed", "true");
    await expect(diagram).toContainText("STDBY BATT ⏏ out");
    expect((await flow.boundingBox()).y).toBeCloseTo(pinnedTop, 0);
    await activate(breaker);
    await expect(breaker).toHaveAttribute("aria-pressed", "false");
    await expect(diagram).not.toContainText("STDBY BATT ⏏ out");
    await breaker.focus();
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const button = document.activeElement;
          const box = button.getBoundingClientRect();
          const sticky = document.querySelector(".power-flow").getBoundingClientRect();
          return (
            button.matches(".chip") &&
            box.top >= sticky.bottom &&
            box.bottom <= innerHeight &&
            button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
          );
        }),
      )
      .toBe(true);
    expect(await original.evaluate((svg) => svg.isConnected && svg === document.querySelector(".power-flow svg"))).toBe(
      true,
    );
    await page.screenshot({ path: `.shots/power-flow-${viewport.width}x${viewport.height}-pinned.png` });
    await scroll(-100_000);
    expect((await flow.boundingBox()).y).toBeGreaterThan(pinnedTop + 20);
    expect(await page.getByRole("button", { name: "BAT", exact: true }).getAttribute("aria-pressed")).toBe("true");
  }
});

test("skip to controls opens a collapsed panel and moves keyboard focus", async ({ page }) => {
  await page.getByRole("button", { name: "Hide details panel", exact: true }).click();
  const skip = page.getByRole("link", { name: "Skip to system controls" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#details-panel")).toBeVisible();
  await expect(page.locator("#details-panel")).toBeFocused();
});

test("phone circuit breakers keep touch-sized hit areas", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch sizes apply to coarse pointers");
  await page
    .locator(".syslist")
    .getByRole("button", { name: /Electrical/ })
    .click();
  await expect(page.locator(".bus button.chip").first()).toBeAttached();
  const sizes = await page.locator(".bus button.chip").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(sizes.length).toBeGreaterThan(10);
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
});
