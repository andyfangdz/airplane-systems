import { defineConfig, devices } from "@playwright/test";
import { softwareGL } from "./scripts/software-gl.mjs";

const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:4100";
const launchOptions = { args: softwareGL };
const phoneTests = /test-(m20c|fleet-depth|sr20-walkaround|walkaround|door-mechanisms|tour|aircraft-session)-ui\.mjs/;
const fleetTests = /test-fleet-ui\.mjs/;

export default defineConfig({
  testDir: "./scripts",
  testMatch: /test-.*-ui\.mjs/,
  // Software WebGL and timing measurements need an uncontended renderer.
  workers: 1,
  // Shard individual cases while keeping software WebGL and camera measurements serial on each runner.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A case can exercise a complete study walk; keep time for slower CI rendering.
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    baseURL,
    reducedMotion: "reduce",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    screenshot: "only-on-failure",
    // Continuous screenshot capture perturbs software WebGL and camera timing.
    trace: { mode: "retain-on-failure", screenshots: false },
  },
  webServer: process.env.UI_BASE_URL
    ? undefined
    : {
        // STATIC_EXPORT=1: the export in out/, served as CloudFront serves it; otherwise the Next server
        command:
          process.env.STATIC_EXPORT === "1"
            ? "node scripts/serve-export.mjs 4100"
            : "npm run start -- --hostname 127.0.0.1 --port 4100",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: false,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
      },
  projects: [
    {
      name: "desktop",
      testIgnore: fleetTests,
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: "phone",
      testMatch: phoneTests,
      // Preserve the original study-walk contexts; only the picker used device emulation/DPR.
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions,
      },
    },
    ...[
      ["chromium", 1440, 900, "light"],
      ["chromium", 980, 800, "dark"],
      ["chromium", 390, 844, "light"],
      ["chromium", 320, 640, "dark"],
      ["webkit", 390, 844, "light"],
      ["webkit", 320, 640, "dark"],
    ].map(([browserName, width, height, theme]) => ({
      name: `fleet-${browserName}-${width}`,
      testMatch: fleetTests,
      metadata: { theme },
      use: {
        ...(width < 860 ? devices[browserName === "webkit" ? "iPhone 13" : "Pixel 7"] : {}),
        browserName,
        viewport: { width, height },
        ...(browserName === "chromium" ? { launchOptions } : {}),
      },
    })),
  ],
});
