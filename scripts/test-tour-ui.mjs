import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("tour follows targets, fits the viewport and remembers completion", async ({ page, context, isMobile }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/sr20/electrical");
  const card = page.locator(".tour-card");
  const heading = card.getByRole("heading");
  await expect(heading).toHaveText("Welcome aboard");
  const fits = async () => {
    await expect
      .poll(() =>
        card.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return r.left >= 11 && r.top >= 11 && r.right <= innerWidth - 11 && r.bottom <= innerHeight - 11;
        }),
      )
      .toBe(true);
  };
  const titles = [
    "Welcome aboard",
    "Pick an airplane",
    "Pick a system",
    "Explore the model",
    "Change the view",
    "Operate the systems",
    "Watch the alerts",
    "You're all set",
  ];
  await mkdir(".shots/tour", { recursive: true });
  for (let i = 0; i < titles.length; i++) {
    await expect(heading).toHaveText(titles[i]);
    await fits();
    if (i === 1) {
      // The nonmodal tour must still allow the picker underneath it to be used.
      await page.getByRole("button", { name: /^Switch Airplanes/ }).click();
      const picker = page.getByRole("dialog", { name: "Choose an airplane, engine or component" });
      await expect(picker).toBeVisible();
      await picker.getByRole("button", { pressed: true }).click();
      await expect(heading).toHaveText(titles[i]);
    }
    if (i === 5) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await fits();
      const original = page.viewportSize();
      await page.setViewportSize({ width: isMobile ? 320 : 980, height: 640 });
      await fits();
      await page.setViewportSize(original);
      await fits();
    }
    if (i === 6) {
      const previousAlerts = await page.locator(".cas").elementHandle();
      await page.getByRole("button", { name: /^Switch Airplanes/ }).click();
      await page
        .getByRole("dialog", { name: "Choose an airplane, engine or component" })
        .getByRole("button", { name: /^C172S/ })
        .click();
      await expect(heading).toHaveText(titles[i]);
      await expect.poll(() => previousAlerts.evaluate((element) => element.isConnected)).toBe(false);
      // Finish the tour's smooth scroll before checking the replacement target and capturing it.
      await page
        .locator(".cas")
        .evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await expect
        .poll(() =>
          page.locator(".tour-spot").evaluate((element) => {
            const spot = element.getBoundingClientRect();
            const alerts = document.querySelector(".cas").getBoundingClientRect();
            return (
              !element.hidden &&
              spot.width > 0 &&
              spot.height > 0 &&
              spot.left <= alerts.left &&
              spot.top <= alerts.top &&
              spot.right >= alerts.right &&
              spot.bottom >= alerts.bottom
            );
          }),
        )
        .toBe(true);
      await fits();
      await page.screenshot({
        path: `.shots/tour/${isMobile ? "phone" : "desktop"}-alerts-switched.png`,
        animations: "disabled",
      });
    }
    if ([1, 3, 5].includes(i))
      await page.screenshot({ path: `.shots/tour/${isMobile ? "phone" : "desktop"}-${i}.png` });
    await card
      .getByRole("button", { name: i === 0 ? "Show me around" : i === 7 ? "Start exploring" : "Next", exact: true })
      .click();
  }
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Show the welcome tour" })).toBeVisible();
  await expect(card).toHaveCount(0);
  const replay = page.getByRole("button", { name: "Show the welcome tour" });
  await replay.click();
  await expect(heading).toHaveText(titles[0]);
  await page.keyboard.press("ArrowRight");
  await expect(heading).toHaveText(titles[1]);
  await page.keyboard.press("ArrowLeft");
  await expect(heading).toHaveText(titles[0]);
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(replay).toBeFocused();
  expect(errors).toEqual([]);
});
