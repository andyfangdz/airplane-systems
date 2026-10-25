/**
 * One production install/download followed by a cold offline page and all three study-route kinds.
 * This verifies the web manifest, service worker and actual rendered scenes; it does not emulate iOS installation UI.
 * Run against next start or STATIC_EXPORT=1's static server. The default 600-second timeout includes the full pack.
 */
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { test as baseTest, expect } from "@playwright/test";

const test = baseTest.extend({
  studyHost: async ({ baseURL, browserName }, use) => {
    if (browserName !== "webkit") {
      await use({
        url: baseURL,
        disconnect: (context) => context.setOffline(true),
        online: false,
        label: "Working offline",
      });
      return;
    }
    // Playwright WebKit's offline emulation prevents even a minimal cached SW navigation. Shut down an isolated
    // real origin instead: the browser stays online, but every uncached request to the app must fail.
    const upstream = new URL(baseURL);
    const request = upstream.protocol === "https:" ? httpsRequest : httpRequest;
    const server = createServer((incoming, outgoing) => {
      const proxy = request(
        new URL(incoming.url, upstream),
        {
          method: incoming.method,
          headers: { ...incoming.headers, host: upstream.host },
        },
        (response) => {
          outgoing.writeHead(response.statusCode, response.headers);
          response.pipe(outgoing);
        },
      );
      proxy.on("error", () => outgoing.destroy());
      incoming.pipe(proxy);
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(Number(process.env.PWA_PROXY_PORT ?? 0), "127.0.0.1", resolve);
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    let stopped = false;
    const stop = async () => {
      if (stopped) return;
      stopped = true;
      const closed = new Promise((resolve) => server.close(resolve));
      server.closeAllConnections();
      await closed;
    };
    try {
      await use({
        url,
        online: true,
        label: "Available offline",
        disconnect: async () => {
          await stop();
          console.info("WebKit study pack cached; isolated app origin stopped.");
        },
      });
    } finally {
      await stop();
    }
  },
});

// Only this suite exercises the production worker; other suites must retain their network fault injection.
test.use({ serviceWorkers: "allow" });

const picker = (page) => page.getByRole("dialog", { name: "Choose an airplane, engine or component" });

async function openPicker(page) {
  await page.getByRole("button", { name: /^Choose a model/ }).click();
  await expect(picker(page)).toBeVisible();
  return picker(page);
}

async function rendered(page, path, name) {
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expect(page.locator(".fleet-current-name")).toHaveText(name);
  await expect(page.locator("[data-building]")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator(".loader-failed")).toHaveCount(0);
  const canvas = page.locator(".stage canvas, .eng-view canvas").first();
  await expect(canvas).toBeVisible();
  const frame = await canvas.evaluate((element) => window.__pwaScenes.get(element)?.frames ?? 0);
  await expect
    .poll(() =>
      canvas.evaluate((element, previous) => {
        const scene = window.__pwaScenes.get(element);
        return !!scene && scene.frames >= previous + 2 && scene.triangles > 100;
      }, frame),
    )
    .toBe(true);
}

async function offlineStatus(page) {
  return page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return { state: "uncontrolled" };
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        resolve({ state: "unresponsive" });
      }, 5_000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve({ ...data, scriptURL: worker.scriptURL });
      };
      worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
    });
  });
}

test("the installed study pack opens and renders unvisited models offline", async ({
  page,
  context,
  studyHost,
  browserName,
}, info) => {
  const baseURL = studyHost.url;
  await context.addInitScript(() => {
    // The replacement page starts at about:blank, where storage is unavailable until its first navigation.
    if (location.protocol === "http:" || location.protocol === "https:") {
      localStorage.setItem("tourDone", "1");
      localStorage.setItem("sr20theme", "light");
    }
    // Tie each probe to its actual canvas: a disposed airplane renderer cannot satisfy an engine/component check.
    const scenes = (window.__pwaScenes = new WeakMap());
    const devtools = new EventTarget();
    devtools.addEventListener("observe", ({ detail: renderer }) => {
      if (!renderer?.isWebGLRenderer) return;
      const probe = { frames: 0, triangles: 0 };
      scenes.set(renderer.domElement, probe);
      const render = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        const result = render(scene, camera);
        probe.frames++;
        probe.triangles = renderer.info.render.triangles;
        return result;
      };
    });
    window.__THREE_DEVTOOLS__ = devtools;
  });
  // Routing also disables the browser HTTP cache: the offline reopen must use the installed CacheStorage pack.
  const origin = new URL(baseURL).origin;
  const analyticsScriptPaths = new Set(["/_vercel/insights/script.js"]);
  await context.route(
    (url) => url.origin === origin && analyticsScriptPaths.has(url.pathname),
    (route) => route.fulfill({ status: 204, body: "" }),
  );
  const errors = [];
  const failures = [];
  const opened = [];
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("page", (next) => {
    opened.push(next);
    next.on("pageerror", (error) => errors.push(error.message));
    next.on("requestfailed", (request) => {
      const url = new URL(request.url());
      const reason = request.failure()?.errorText ?? "unknown failure";
      // WebKit may bypass routing for requests from a controlled page. Analytics is optional offline; study
      // resources must still load. Only the SDK's exact script paths, cancelled prefetches and update checks qualify.
      if (
        url.origin !== origin ||
        analyticsScriptPaths.has(url.pathname) ||
        url.pathname === "/sw.js" ||
        /abort|cancel/i.test(reason)
      )
        return;
      failures.push(`${reason} ${url.pathname}`);
    });
    next.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && !analyticsScriptPaths.has(url.pathname) && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
  });

  // Only this airplane is opened online. Engines, components and the second airplane are first used offline.
  await page.goto(new URL("/sr20/overview", baseURL).href);
  expect(
    await page.evaluate(() => window.isSecureContext && "serviceWorker" in navigator),
    "The production browser context must expose the service worker API",
  ).toBe(true);
  await rendered(page, "/sr20/overview", "SR20 G6");
  // The SDK identifies its own script with data-sdkn; Vercel can publish it at a deployment-specific path.
  // Record only those same-origin script paths while online, including when testing a hosted preview.
  for (const path of await page
    .locator('script[data-sdkn="@vercel/analytics"], script[data-sdkn^="@vercel/analytics/"]')
    .evaluateAll((scripts) =>
      scripts
        .map((script) => new URL(script.src))
        .filter((url) => url.origin === location.origin)
        .map((url) => url.pathname),
    ))
    analyticsScriptPaths.add(path);
  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifest returned ${response.status}`);
    return response.json();
  }, manifestURL);
  expect(manifest).toMatchObject({
    id: "/",
    scope: "/",
    start_url: "/",
    name: "Airplane Systems",
    short_name: "Airplane Systems",
    display: "standalone",
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) {
    expect(new URL(icon.src, baseURL).origin).toBe(new URL(baseURL).origin);
    expect(icon.type).toBe("image/png");
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(size).toBe(icon.sizes);
  }
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Airplane Systems");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");

  let ready;
  await expect
    .poll(
      async () => {
        ready = await offlineStatus(page);
        return ready.state;
      },
      {
        timeout: 300_000,
        intervals: [1_000],
        message: "The active worker must finish the complete verified study pack",
      },
    )
    .toBe("ready");
  expect(ready.type).toBe("OFFLINE_STATUS");
  expect(ready.version).toMatch(/^[a-f0-9]{64}$/);
  expect(new URL(ready.scriptURL).pathname).toBe("/sw.js");
  expect(ready.total).toBeGreaterThan(0);
  expect(ready.completed).toBe(ready.total);
  expect(ready.bytes).toBe(ready.totalBytes);
  expect(ready.totalBytes).toBeGreaterThan(0);
  const registration = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration("/"))?.scope);
  expect(registration).toBe(new URL("/", baseURL).href);
  const inventory = await page.evaluate(async () => (await fetch("/offline-manifest.json")).json());
  expect(inventory.version).toBe(ready.version);
  for (const route of ["/", "/c172s/overview", "/c172s/electrical", "/engines/o360", "/components/piston-cylinder"])
    expect(inventory.routes[route]).toBeTruthy();
  const font = inventory.files.find((file) => file.url.endsWith(".woff2"));
  expect(font).toBeTruthy();
  await expect((await openPicker(page)).getByText("Available offline", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await studyHost.disconnect(context);
  await page.close();
  let offline = await context.newPage();
  const reopened = [offline];
  const coldLaunch = async (path) => {
    // This Playwright WebKit build asserts natively on pushState → reload → goto, also with plain HTML online,
    // no React/WebGL and workers blocked. A fresh page preserves the real cold-launch coverage and CacheStorage.
    // Chromium additionally keeps exercising the original full-document navigation in the existing page.
    if (browserName === "webkit") {
      await offline.close();
      offline = await context.newPage();
      reopened.push(offline);
    }
    return offline.goto(new URL(path, baseURL).href);
  };
  const launch = await offline.goto(new URL("/", baseURL).href);
  expect(launch.fromServiceWorker()).toBe(true);
  expect(await offline.evaluate(() => navigator.onLine)).toBe(studyHost.online);
  await rendered(offline, "/sr20/overview", "SR20 G6");
  expect(await offlineStatus(offline)).toMatchObject({ state: "ready", version: ready.version });
  const fontBytes = await offline.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Offline font returned ${response.status}`);
    return (await response.arrayBuffer()).byteLength;
  }, font.url);
  expect(fontBytes).toBe(font.bytes);
  const faces = await offline.evaluate(async () => {
    const style = getComputedStyle(document.documentElement);
    return Promise.all(
      ["--font-body", "--font-disp", "--font-mono"].map(async (token) => {
        const family = style.getPropertyValue(token).split(",")[0].trim();
        const loaded = await document.fonts.load(`500 16px ${family}`, "Airplane Systems 0123");
        return { token, count: loaded.length, loaded: loaded.every((face) => face.status === "loaded") };
      }),
    );
  });
  for (const face of faces) {
    expect(face.count, `${face.token} uses its bundled face offline`).toBeGreaterThan(0);
    expect(face.loaded).toBe(true);
  }

  await (
    await openPicker(offline)
  )
    .getByRole("group", { name: "Airplanes" })
    .getByRole("button", { name: /C172S Skyhawk/ })
    .click();
  await rendered(offline, "/c172s/overview", "C172S Skyhawk");
  await offline
    .getByRole("navigation", { name: "Systems" })
    .getByRole("button", { name: /^Electrical/ })
    .click();
  await rendered(offline, "/c172s/electrical", "C172S Skyhawk");
  await (
    await openPicker(offline)
  )
    .getByRole("group", { name: "Engines" })
    .getByRole("link", { name: /^O-360/ })
    .click();
  await rendered(offline, "/engines/o360", "O-360");
  const pause = offline.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await offline.locator("#throttle").fill("0.42");
  await (await openPicker(offline)).getByRole("button", { pressed: true }).click();
  await expect(offline.locator("#throttle")).toHaveValue("0.42");

  await (
    await openPicker(offline)
  )
    .getByRole("group", { name: "Components" })
    .getByRole("link", { name: /^Piston cylinder/ })
    .click();
  await rendered(offline, "/components/piston-cylinder", "Piston cylinder");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await offline.getByRole("button", { name: "Reset to firing TDC", exact: true }).click();
  await expect(offline.locator("#piston-angle")).toHaveValue("0");
  await (await openPicker(offline)).getByRole("button", { pressed: true }).click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(offline.locator("#piston-angle")).toHaveValue("0");
  // A full document reload starts a new component bench, rather than promising session state across app restarts.
  expect((await offline.reload()).fromServiceWorker()).toBe(true);
  await rendered(offline, "/components/piston-cylinder", "Piston cylinder");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  expect((await coldLaunch("/c172s/electrical")).fromServiceWorker()).toBe(true);
  await rendered(offline, "/c172s/electrical", "C172S Skyhawk");
  expect((await coldLaunch("/")).fromServiceWorker()).toBe(true);
  await rendered(offline, "/c172s/electrical", "C172S Skyhawk");
  await expect((await openPicker(offline)).getByText(studyHost.label, { exact: true })).toBeVisible();
  await offline.setViewportSize({ width: 382, height: 580 });
  await picker(offline).getByText(studyHost.label, { exact: true }).scrollIntoViewIfNeeded();
  await offline.screenshot({ path: info.outputPath("offline-picker-narrow.png") });
  expect(opened).toEqual(reopened);
  expect(context.pages()).toEqual([offline]);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
