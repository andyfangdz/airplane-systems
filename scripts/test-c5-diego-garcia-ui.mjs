import { test, expect } from "@playwright/test";

/**
 * A stand-in for YouTube's IFrame API: a player whose clock runs while it plays, so the replay can be checked to follow
 * the video without the network. It records what the page asks of it in window.__yt.
 */
const FAKE_API = `
window.__yt = { calls: [], player: null };
window.YT = {
  Player: class {
    constructor(el, opts) {
      this.opts = opts;
      this.time = opts.playerVars.start || 0;
      this.state = -1;
      const frame = document.createElement("iframe");
      frame.title = "Fake YouTube player";
      el.replaceWith(frame);
      this.frame = frame;
      window.__yt.player = this;
      setTimeout(() => opts.events.onReady({ target: this }), 50);
    }
    now() {
      return this.state === 1 ? this.time + (performance.now() - this.since) / 1000 : this.time;
    }
    set(state) {
      this.time = this.now();
      this.since = performance.now();
      this.state = state;
      this.opts.events.onStateChange({ data: state, target: this });
    }
    playVideo() { window.__yt.calls.push("play"); this.set(1); }
    pauseVideo() { window.__yt.calls.push("pause"); this.set(2); }
    seekTo(t) { window.__yt.calls.push("seek " + Math.round(t)); this.time = t; this.since = performance.now(); if (this.state !== 1) this.set(1); }
    getCurrentTime() { return this.now(); }
    getPlayerState() { return this.state; }
    destroy() { this.frame.remove(); }
  },
};
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
`;

for (const [name, viewport] of Object.entries({
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
})) {
  test(`C-5 Diego Garcia replay: the airplane, the instruments and the cockpit audio in step, ${name}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.__c5Scene = { scene: null, frames: 0 };
      const devtools = new EventTarget();
      devtools.addEventListener("observe", ({ detail: renderer }) => {
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene, camera) => {
          window.__c5Scene.scene = scene;
          window.__c5Scene.frames++;
          return render(scene, camera);
        };
      });
      window.__THREE_DEVTOOLS__ = devtools;
    });
    // nothing reaches YouTube: the API is the stand-in, and anything else from there is refused
    await context.route(/youtube(-nocookie)?\.com|ytimg\.com/, (route) =>
      route.request().url() === "https://www.youtube.com/iframe_api"
        ? route.fulfill({ contentType: "text/javascript", body: FAKE_API })
        : route.abort(),
    );
    // nor Google's 3D tiles: without them the sea stands in for the island
    await context.route(/tile\.googleapis\.com|gstatic\.com/, (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/fdr/c5-diego-garcia`);
    await expect(page.getByRole("heading", { name: "What happened" })).toBeVisible();

    // the airplane and the world are drawn
    await page.waitForFunction(() => window.__c5Scene.frames > 5);
    const meshes = await page.evaluate(() => {
      let n = 0;
      window.__c5Scene.scene.traverse((o) => (n += o.isMesh ? 1 : 0));
      return n;
    });
    expect(meshes).toBeGreaterThan(40);

    const mon = page.locator(".c5-mon");
    const time = mon.locator(".c5-time").first();
    const seconds = async () => {
      const [m, s] = (await time.innerText()).split(":");
      return Number(m) * 60 + Number(s);
    };
    const big = (k) => mon.locator(".c5-big > div").nth(k).locator("b");
    const ann = (label) => mon.locator(".c5-ann > div").filter({ hasText: label }).locator("b");
    await expect(time).toHaveText("0:00");
    await expect(mon.getByText("Title cards: the data starts at 0:07")).toBeVisible();

    // the page's own clock: play runs the replay, pause holds it
    const play = mon.getByRole("button", { name: "Play" });
    await play.click();
    await expect(time).not.toHaveText("0:00", { timeout: 10_000 });
    await mon.getByRole("button", { name: "Pause" }).click();
    await expect(play).toBeVisible();
    const held = await time.innerText();
    await page.waitForTimeout(1500);
    await expect(time).toHaveText(held);

    // a moment on the timeline: the gear handle comes down
    await page.getByRole("button", { name: /Gear handle down/ }).click();
    await expect(time).toHaveText("0:26");
    await expect(ann("GEAR HDL")).toHaveText("DOWN");
    await expect(ann("RET")).toHaveText("NO LOCK");
    await expect(mon.getByText("Stick shaker disabled")).toBeVisible();

    // a line of the recording: the caption shows it, and the airplane is below the cloud
    await page.getByRole("button", { name: /GPWS: Terrain\. Terrain\./ }).click();
    await expect(page.locator(".c5-caption")).toHaveText("GPWS: Terrain. Terrain.");
    await expect(mon.getByText("Below the cloud")).toBeVisible();
    expect(Number((await big(1).innerText()).replace(/,/g, ""))).toBeLessThan(1500);

    // the top: the airspeed at the animation's floor, the slats locked neither way
    await page.getByRole("button", { name: /Highest point/ }).click();
    await expect(big(0)).toHaveText("≤50");
    await expect(ann("EXT")).toHaveText("NO LOCK");

    // the video (the stand-in): loaded, it takes the replay's place; played, its clock is the replay's
    await page.getByRole("button", { name: "Load the video with the cockpit audio" }).click();
    await expect(page.locator(".c5-frame iframe")).toBeAttached();
    await expect(page.getByRole("button", { name: "Load the video with the cockpit audio" })).toHaveCount(0);
    await expect(time).toHaveText("1:44");
    await mon.getByRole("button", { name: "Play" }).click();
    await expect.poll(() => page.evaluate(() => window.__yt.calls.slice(0, 2))).toEqual(["seek 104", "play"]);
    await expect(mon.getByRole("button", { name: "Pause" })).toBeVisible();
    // a running clock: any reading from 1:46 on, since a slow software-GL frame can carry a check past one second
    await expect.poll(seconds, { timeout: 10_000 }).toBeGreaterThanOrEqual(106);
    // seeking the page seeks the video, and the replay follows the player
    await page.getByRole("button", { name: /Out of the cloud/ }).click();
    await expect.poll(() => page.evaluate(() => window.__yt.calls.at(-1))).toMatch(/^seek 13[56]$/);
    await page.evaluate(() => Object.assign(window.__yt.player, { time: 150, since: performance.now() }));
    await expect(time).toHaveText(/2:3[01]/);
    await mon.getByRole("button", { name: "Pause" }).click();
    await expect.poll(() => page.evaluate(() => window.__yt.calls.at(-1))).toBe("pause");

    // where a Maps key was built in, the island can be turned off and on; refused, the sea stays
    const terrain = page.getByRole("button", { name: "Terrain", exact: true });
    if (await terrain.count()) {
      await terrain.click();
      await expect(terrain).toHaveAttribute("aria-pressed", "false");
      await terrain.click();
      await expect(terrain).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.locator(".c5-credit")).toHaveCount(0);

    // labels name the parts
    const labels = page.getByRole("button", { name: "Labels", exact: true });
    await expect(page.locator(".eng-label").filter({ hasText: "Slats" })).toHaveCount(1);
    await labels.click();
    await expect(page.locator(".eng-label")).toHaveCount(0);

    // the picker lists the replay under Flight data, at the end of its list, and opens on it in view
    await page.getByRole("button", { name: "Choose a model, current replay C-5 stall, Diego Garcia" }).click();
    const replays = page.getByRole("group", { name: "Flight data" });
    const shown = replays.getByRole("button", { pressed: true });
    await expect(shown).toBeFocused();
    await expect(shown).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Escape");
    await expect(replays).toBeHidden();

    expect(errors).toEqual([]);
    await context.close();
  });
}
