import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { workerSource } from "../scripts/build-offline.mjs";
import { immutable } from "../scripts/release-manifest.mjs";

// Keep this source-reading test in Vitest's changed-file dependency graph without evaluating the worker as a module.
import.meta.glob("../scripts/offline-worker.js");

const ORIGIN = "https://airplane.test";
const PREFIX = "airplane-systems-offline-";
type Status = {
  type: "OFFLINE_STATUS";
  version: string;
  state: string;
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  error?: string;
  code?: string;
};
type Mode = "server" | "export";
const absolute = (input: Request | string | URL) =>
  new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url, ORIGIN).href;

type Asset = [url: string, body: string, contentType: string];
type Release = { version?: string; edit?: (url: string, body: string) => string; extra?: Asset[] };

function fixture(
  mode: Mode = "server",
  { version = "test-v2", edit = (_url, body) => body, extra = [] }: Release = {},
) {
  const base = `/_next/static/offline/${version}`;
  const assets: [string, string, string][] = (
    [
      [`${base}/pages/index.html`, "<html><body>Home HTML</body></html>", "text/html; charset=utf-8"],
      [`${base}/pages/index.rsc`, '0:["Home flight"]', "text/x-component"],
      [`${base}/pages/index-tree.rsc`, '0:["Home tree"]', "text/x-component"],
      [`${base}/pages/foo.html`, "<html><body>Foo HTML</body></html>", "text/html; charset=utf-8"],
      [`${base}/pages/foo.rsc`, '0:["Foo flight"]', "text/x-component"],
      [`${base}/pages/foo-tree.rsc`, '0:["Foo tree"]', "text/x-component"],
      [`${base}/meta/icon.svg`, '<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml"],
      ["/_next/static/test/chunk.js", "globalThis.offlineChunk = true;", "application/javascript"],
      ["/_next/static/test/style.css", "body { color: navy; }", "text/css"],
      ["/geometry/runtime.json", '{"recovery":"/geometry/recovery.bin.gz"}', "application/json"],
      ...extra,
    ] as Asset[]
  ).map(([url, body, contentType]) => [url, edit(url, body), contentType]);
  const bodies = new Map(assets.map(([url, body, contentType]) => [url, { body, contentType }]));
  const files = assets.map(([url, body, contentType]) => ({
    url,
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
    contentType,
    immutable: immutable(url.slice(1)),
  }));
  const manifest = {
    schema: 1 as const,
    version,
    buildId: "test-build",
    mode,
    total: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
    routes: {
      "/": { html: files[0].url, rsc: files[1].url, segments: { "/_tree": files[2].url } },
      "/foo": { html: files[3].url, rsc: files[4].url, segments: { "/_tree": files[5].url } },
    },
    aliases: {
      "/icon.svg": files[6].url,
      "/foo.txt": files[4].url,
      "/foo/__next._tree.txt": files[5].url,
    },
  };
  return { manifest, bodies };
}

class MemoryCache {
  readonly entries = new Map<string, Response>();
  constructor(private readonly quotaPaths: Set<string>) {}

  async match(input: Request | string, options: CacheQueryOptions = {}) {
    if (input instanceof Request && input.method !== "GET" && !options.ignoreMethod) return undefined;
    const url = new URL(absolute(input));
    for (const [key, response] of this.entries) {
      const stored = new URL(key);
      if (options.ignoreSearch) stored.search = url.search = "";
      if (stored.href === url.href) return response.clone();
    }
    return undefined;
  }

  async put(input: Request | string, response: Response) {
    const url = absolute(input);
    if (this.quotaPaths.has(new URL(url).pathname)) throw new DOMException("Storage is full", "QuotaExceededError");
    this.entries.set(url, response.clone());
  }

  async delete(input: Request | string) {
    return this.entries.delete(absolute(input));
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

class MemoryCaches {
  readonly caches = new Map<string, MemoryCache>();
  readonly quotaPaths = new Set<string>();

  async open(name: string) {
    let cache = this.caches.get(name);
    if (!cache) this.caches.set(name, (cache = new MemoryCache(this.quotaPaths)));
    return cache;
  }

  async match(input: Request | string, options: MultiCacheQueryOptions = {}) {
    for (const [name, cache] of this.caches) {
      if (options.cacheName && options.cacheName !== name) continue;
      const result = await cache.match(input, options);
      if (result) return result;
    }
    return undefined;
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name: string) {
    return this.caches.delete(name);
  }

  async has(name: string) {
    return this.caches.has(name);
  }
}

type WorkerEvent = {
  waitUntil: (promise: Promise<unknown>) => void;
  data?: { type: string };
  request?: Request;
  source?: { postMessage: (message: Status) => void };
  ports?: { postMessage: (message: Status) => void }[];
  respondWith?: (response: Response | Promise<Response>) => void;
};

function worker(mode: Mode = "server", caches = new MemoryCaches(), release: Release = {}) {
  const { manifest, bodies } = fixture(mode, release);
  // The deployed site: the pack's files, and the live answers to the routes its snapshots stand in for.
  const site = new Map(bodies);
  for (const path of [...Object.keys(manifest.routes), ...Object.keys(manifest.aliases)])
    site.set(path, { body: `Live ${path}`, contentType: "text/plain; charset=utf-8" });
  const listeners = new Map<string, ((event: WorkerEvent) => void)[]>();
  const broadcasts: Status[] = [];
  const requests: Request[] = [];
  const failedPaths = new Set<string>();
  const corruptedPaths = new Set<string>();
  const serverErrorPaths = new Set<string>();
  // Requests to a stalled path wait, unanswered, until the network answers it.
  const stalled = new Map<string, PromiseWithResolvers<void>>();
  const stall = (path: string) => stalled.set(path, Promise.withResolvers());
  const answer = (path: string) => {
    stalled.get(path)?.resolve();
    stalled.delete(path);
  };
  // The ids of the open pages. One page is open unless a test closes it.
  const pages = new Set(["page"]);
  const lifecycle = { skipped: 0, claimed: 0 };
  const network = async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(typeof input === "string" || input instanceof URL ? absolute(input) : input, init);
    requests.push(request);
    const path = new URL(request.url).pathname;
    await stalled.get(path)?.promise;
    if (failedPaths.has(path)) throw new TypeError("Network interrupted");
    if (serverErrorPaths.has(path)) return new Response("Bad gateway", { status: 502 });
    const asset = site.get(path);
    if (!asset) return new Response("Not found", { status: 404 });
    // Keep the same byte count: a length check alone must not accept a corrupted response.
    return new Response(corruptedPaths.has(path) ? `!${asset.body.slice(1)}` : asset.body, {
      headers: { "content-type": asset.contentType, "content-length": String(Buffer.byteLength(asset.body)) },
    });
  };
  const clients = {
    matchAll: async () =>
      [...pages].map((id) => ({ id, postMessage: (message: Status) => broadcasts.push(structuredClone(message)) })),
    claim: async () => void lifecycle.claimed++,
  };
  const scope = {
    addEventListener(type: string, listener: (event: WorkerEvent) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    location: new URL(`${ORIGIN}/sw.js`),
    registration: { scope: `${ORIGIN}/` },
    skipWaiting: async () => void lifecycle.skipped++,
    clients,
    caches,
    fetch: network,
    crypto: webcrypto,
  };
  const source = readFileSync(new URL("../scripts/offline-worker.js", import.meta.url), "utf8");
  runInNewContext(workerSource(source, manifest), {
    ...scope,
    self: scope,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    DOMException,
    console,
    // Looked up on each call, so a test's fake timers also run the worker's.
    setTimeout: (handler: () => void, delay?: number) => setTimeout(handler, delay),
    clearTimeout: (timer?: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  });

  async function dispatch(type: string, fields: Omit<WorkerEvent, "waitUntil"> = {}) {
    const pending: Promise<unknown>[] = [];
    const event: WorkerEvent = { ...fields, waitUntil: (promise) => void pending.push(Promise.resolve(promise)) };
    for (const listener of listeners.get(type) ?? []) listener(event);
    const results: PromiseSettledResult<unknown>[] = [];
    for (let completed = 0; completed < pending.length;) {
      const batch = pending.slice(completed);
      completed = pending.length;
      results.push(...(await Promise.allSettled(batch)));
    }
    return results;
  }

  async function message(type: "GET_OFFLINE_STATUS" | "DOWNLOAD_OFFLINE"): Promise<Status> {
    const replies: Status[] = [];
    const sender = { postMessage: (status: Status) => replies.push(structuredClone(status)) };
    await dispatch("message", { data: { type }, source: sender, ports: [sender] });
    if (type === "DOWNLOAD_OFFLINE") return message("GET_OFFLINE_STATUS");
    expect(replies.length, `${type} must reply to the requesting page`).toBeGreaterThan(0);
    return replies.at(-1)!;
  }

  async function request(path: string, init: RequestInit = {}, navigation = false) {
    const incoming = new Request(new URL(path, ORIGIN), init);
    // Node disallows constructing navigate-mode Requests; this is the browser-provided, read-only mode value.
    if (navigation) Object.defineProperty(incoming, "mode", { value: "navigate" });
    let response: Promise<Response> | undefined;
    await dispatch("fetch", {
      request: incoming,
      respondWith: (value) => {
        expect(response, "a fetch event can only be intercepted once").toBeUndefined();
        response = Promise.resolve(value);
      },
    });
    return response;
  }

  return {
    manifest,
    bodies,
    site,
    caches,
    broadcasts,
    requests,
    failedPaths,
    corruptedPaths,
    serverErrorPaths,
    stall,
    answer,
    pages,
    lifecycle,
    dispatch,
    message,
    request,
  };
}

describe("offline service worker", () => {
  it("reports ready only after installing every verified file, then takes over at once", async () => {
    const w = worker();
    expect((await w.message("GET_OFFLINE_STATUS")).state).not.toBe("ready");
    expect(w.requests).toHaveLength(0);
    await w.dispatch("install");
    expect(await w.message("GET_OFFLINE_STATUS")).toMatchObject({
      type: "OFFLINE_STATUS",
      version: w.manifest.version,
      state: "ready",
      completed: w.manifest.total,
      total: w.manifest.total,
      bytes: w.manifest.totalBytes,
      totalBytes: w.manifest.totalBytes,
    });
    expect(w.broadcasts.some((status) => status.state === "downloading")).toBe(true);
    expect(w.broadcasts.some((status) => status.state === "ready")).toBe(true);
    const cache = await w.caches.open(`${PREFIX}${w.manifest.version}`);
    for (const file of w.manifest.files)
      expect(await (await cache.match(file.url))?.text()).toBe(w.bodies.get(file.url)!.body);
    // Open pages load from the network, so the complete pack need not wait for them to close.
    expect(w.lifecycle).toEqual({ skipped: 1, claimed: 0 });
    await w.dispatch("activate");
    expect(w.lifecycle).toEqual({ skipped: 1, claimed: 1 });
    const restarted = worker("server", w.caches);
    expect((await restarted.message("GET_OFFLINE_STATUS")).state).toBe("ready");
    restarted.failedPaths.add("/");
    const tree = await restarted.request("/?_rsc=restart", {
      headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/_tree" },
    });
    expect(tree?.headers.get("x-nextjs-postponed")).toBe("2");
    expect(await tree?.text()).toBe(w.bodies.get(w.manifest.routes["/"].segments["/_tree"])!.body);
  });

  it.each(["interrupted", "wrong hash", "quota"] as const)(
    "keeps the previous download through a %s failure and retries safely",
    async (failure) => {
      const caches = new MemoryCaches();
      const old = await caches.open(`${PREFIX}previous`);
      await old.put("/old-build.js", new Response("old build"));
      await (await caches.open("unrelated-app-cache")).put("/other", new Response("other application"));
      const w = worker("server", caches);
      const failed = w.manifest.files[3].url;
      if (failure === "interrupted") w.failedPaths.add(failed);
      if (failure === "wrong hash") w.corruptedPaths.add(failed);
      if (failure === "quota") caches.quotaPaths.add(failed);
      const installation = await w.dispatch("install");
      expect(
        installation.some((result) => result.status === "rejected"),
        "an incomplete update must fail installation",
      ).toBe(true);
      expect(await w.message("GET_OFFLINE_STATUS")).toMatchObject({
        state: "error",
        code: failure === "quota" ? "quota" : failure === "wrong hash" ? "integrity" : "network",
      });
      expect(w.broadcasts.some((status) => status.state === "error")).toBe(true);
      expect(await (await old.match("/old-build.js"))?.text()).toBe("old build");
      expect(await caches.keys()).toContain(`${PREFIX}previous`);
      expect(w.lifecycle).toEqual({ skipped: 0, claimed: 0 });
      w.failedPaths.clear();
      w.corruptedPaths.clear();
      caches.quotaPaths.clear();
      expect((await w.message("DOWNLOAD_OFFLINE")).state).toBe("ready");
      expect(await caches.keys(), "old downloads survive until the new worker activates").toContain(
        `${PREFIX}previous`,
      );
      await w.dispatch("activate");
      // The page open during the update runs the earlier build: its pack stays until that page has gone.
      expect(await caches.keys()).toContain(`${PREFIX}previous`);
      w.pages.clear();
      w.pages.add("reloaded page");
      await w.message("GET_OFFLINE_STATUS");
      expect(await caches.keys()).not.toContain(`${PREFIX}previous`);
      expect(await caches.keys()).toContain("unrelated-app-cache");
      expect(await caches.keys()).toContain(`${PREFIX}${w.manifest.version}`);
      expect(w.lifecycle).toEqual({ skipped: 0, claimed: 1 });
    },
  );

  it.each(["server", "export"] as const)(
    "serves the live site online, and distinct saved HTML, RSC, segment, HEAD and static responses offline in %s mode",
    async (mode) => {
      const w = worker(mode);
      await w.dispatch("install");
      // A newer deployment changed a file whose URL carries no content hash.
      w.site.set("/geometry/runtime.json", {
        body: '{"recovery":"/geometry/newer.bin.gz"}',
        contentType: "application/json",
      });
      const segmentFiles = new Set(Object.values(w.manifest.routes).flatMap((route) => Object.values(route.segments)));
      const cases: { path: string; headers: HeadersInit; file: string; navigation?: boolean }[] = [
        {
          path: "/?walk=preflight",
          headers: { accept: "text/html" },
          file: w.manifest.routes["/"].html,
          navigation: true,
        },
        {
          path: "/foo?walk=preflight",
          headers: { accept: "text/html" },
          file: w.manifest.routes["/foo"].html,
          navigation: true,
        },
        { path: "/foo?_rsc=first", headers: { RSC: "1" }, file: w.manifest.routes["/foo"].rsc },
        {
          path: "/foo?_rsc=second",
          headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/_tree" },
          file: w.manifest.routes["/foo"].segments["/_tree"],
        },
        { path: "/_next/static/test/chunk.js", headers: {}, file: "/_next/static/test/chunk.js" },
        { path: "/icon.svg", headers: {}, file: w.manifest.aliases["/icon.svg"] },
        { path: "/geometry/runtime.json", headers: {}, file: "/geometry/runtime.json" },
        ...(mode === "export"
          ? [
              { path: "/foo.txt?_rsc=third", headers: {}, file: w.manifest.aliases["/foo.txt"] },
              { path: "/foo/__next._tree.txt", headers: {}, file: w.manifest.aliases["/foo/__next._tree.txt"] },
            ]
          : []),
      ];
      for (const route of cases) {
        const path = new URL(route.path, ORIGIN).pathname;
        const expected = w.bodies.get(route.file)!;
        // Online, only content-addressed files skip the network: their saved bytes are already the latest.
        const hashed = path === route.file && w.manifest.files.some((file) => file.url === path && file.immutable);
        w.requests.length = 0;
        const online = await w.request(route.path, { headers: route.headers }, route.navigation);
        expect(await online?.text(), `online ${route.path}`).toBe(hashed ? expected.body : w.site.get(path)!.body);
        expect(w.requests, `online ${route.path}`).toHaveLength(hashed ? 0 : 1);
        // Offline, the saved pack answers every known request.
        w.failedPaths.add(path);
        for (const method of ["GET", "HEAD"]) {
          const response = await w.request(route.path, { method, headers: route.headers }, route.navigation);
          expect(response, `${method} ${route.path}`).toBeDefined();
          expect(response!.status).toBe(200);
          expect(response!.headers.get("content-type")).toBe(expected.contentType);
          expect(response!.headers.get("x-nextjs-postponed")).toBe(segmentFiles.has(route.file) ? "2" : null);
          expect(await response!.text()).toBe(method === "HEAD" ? "" : expected.body);
        }
        w.failedPaths.delete(path);
      }
    },
  );

  it("falls back to the saved copy when the server fails, but never hides a live answer", async () => {
    const w = worker();
    await w.dispatch("install");
    const page = w.manifest.routes["/foo"].html;
    w.serverErrorPaths.add("/foo");
    expect(await (await w.request("/foo", {}, true))?.text()).toBe(w.bodies.get(page)!.body);
    w.serverErrorPaths.clear();
    // A page the latest release removed stays removed while the site can be reached.
    w.site.delete("/foo");
    expect((await w.request("/foo", {}, true))?.status).toBe(404);
    // Without a saved copy, the server's own error reaches the page.
    w.serverErrorPaths.add("/foo");
    await (await w.caches.open(`${PREFIX}${w.manifest.version}`)).delete(page);
    expect((await w.request("/foo", {}, true))?.status).toBe(502);
  });

  it("downloads only the files a new release changed, copying the rest from the previous pack", async () => {
    const caches = new MemoryCaches();
    const previous = worker("server", caches, { version: "test-v1" });
    await previous.dispatch("install");
    await previous.dispatch("activate");
    const next = worker("server", caches, {
      edit: (url, body) => (url.endsWith("/pages/foo.html") ? body.replace("Foo", "Updated foo") : body),
    });
    await next.dispatch("install");
    expect(next.requests.map((request) => new URL(request.url).pathname)).toEqual([next.manifest.routes["/foo"].html]);
    expect(await next.message("GET_OFFLINE_STATUS")).toMatchObject({ state: "ready", bytes: next.manifest.totalBytes });
    expect(next.lifecycle.skipped).toBe(1);
    const cache = await caches.open(`${PREFIX}${next.manifest.version}`);
    for (const file of next.manifest.files)
      expect(await (await cache.match(file.url))?.text(), file.url).toBe(next.bodies.get(file.url)!.body);
    // Copied snapshots keep the response headers the worker restores for this release's routes.
    next.failedPaths.add("/");
    const tree = await next.request("/", { headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/_tree" } });
    expect(tree?.headers.get("x-nextjs-postponed")).toBe("2");
    // With no page open, nothing runs the earlier build, so its pack goes as this one takes over.
    next.pages.clear();
    await next.dispatch("activate");
    expect(await caches.keys()).toEqual([`${PREFIX}${next.manifest.version}`]);
  });

  it("keeps an earlier build's content-hashed files for a page still running it, until that page has gone", async () => {
    const caches = new MemoryCaches();
    const lazy = "/_next/static/test/earlier-lazy.js";
    const previous = worker("server", caches, {
      version: "test-v1",
      extra: [[lazy, "globalThis.earlierLazy = true;", "application/javascript"]],
    });
    await previous.dispatch("install");
    await previous.dispatch("activate");
    // The page loaded the earlier build. The next release, which dropped that chunk, takes over while it is open.
    const next = worker("server", caches);
    await next.dispatch("install");
    await next.dispatch("activate");
    expect(next.manifest.files.map((file) => file.url)).not.toContain(lazy);
    expect(await caches.keys()).toContain(`${PREFIX}test-v1`);
    // Offline, the page can still load the earlier build's lazy chunk.
    next.failedPaths.add(lazy);
    expect(await (await next.request(lazy))?.text()).toBe("globalThis.earlierLazy = true;");
    expect((await next.request(lazy, { method: "HEAD" }))?.status).toBe(200);
    await next.message("GET_OFFLINE_STATUS");
    expect(await caches.keys(), "kept while the page is open").toContain(`${PREFIX}test-v1`);
    // Reloaded, the page runs the new build and the earlier pack goes.
    next.pages.delete("page");
    next.pages.add("reloaded page");
    await next.message("GET_OFFLINE_STATUS");
    expect(await caches.keys()).toEqual([`${PREFIX}${next.manifest.version}`]);
    await expect(next.request(lazy)).rejects.toThrow("Network interrupted");
  });

  it("never deletes a newer release's pack while it downloads", async () => {
    const caches = new MemoryCaches();
    const first = worker("server", caches, { version: "test-v1" });
    await first.dispatch("install");
    await first.dispatch("activate");
    const active = worker("server", caches);
    await active.dispatch("install");
    await active.dispatch("activate");
    // The page open during that update reloads, so the first release's pack can go.
    active.pages.delete("page");
    active.pages.add("reloaded page");
    // A newer release starts downloading; its changed page is still on its way.
    const next = worker("server", caches, {
      version: "test-v3",
      edit: (url, body) => (url.endsWith("/pages/foo.html") ? body.replace("Foo", "Newer foo") : body),
    });
    const changed = next.manifest.routes["/foo"].html;
    next.stall(changed);
    const installing = next.dispatch("install");
    await vi.waitFor(() => expect(next.requests.map((request) => new URL(request.url).pathname)).toContain(changed));
    // Meanwhile a page loads and asks the active worker for its status, which cleans up.
    await active.message("GET_OFFLINE_STATUS");
    expect(await caches.keys()).toEqual([`${PREFIX}test-v2`, `${PREFIX}test-v3`]);
    next.answer(changed);
    await installing;
    expect(await next.message("GET_OFFLINE_STATUS")).toMatchObject({ state: "ready", bytes: next.manifest.totalBytes });
    const cache = await caches.open(`${PREFIX}test-v3`);
    for (const file of next.manifest.files)
      expect(await (await cache.match(file.url))?.text(), file.url).toBe(next.bodies.get(file.url)!.body);
    // Taking over with no page open, the newer release prunes the one it replaced.
    next.pages.clear();
    await next.dispatch("activate");
    expect(await caches.keys()).toEqual([`${PREFIX}test-v3`]);
  });

  it("waits for a stalled network until its deadline, then serves the saved copy", async () => {
    const w = worker();
    await w.dispatch("install");
    const page = w.manifest.routes["/foo"].html;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      w.stall("/foo");
      let saved: Response | undefined;
      const fallback = w.request("/foo", {}, true).then((response) => (saved = response));
      await vi.advanceTimersByTimeAsync(4_999);
      expect(saved, "the network has five seconds to answer").toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(await (await fallback)?.text()).toBe(w.bodies.get(page)!.body);
      // Without a saved copy, the page waits for the network's answer however long it takes.
      await (await w.caches.open(`${PREFIX}${w.manifest.version}`)).delete(page);
      let live: Response | undefined;
      const latest = w.request("/foo", {}, true).then((response) => (live = response));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(live).toBeUndefined();
      w.answer("/foo");
      expect(await (await latest)?.text()).toBe("Live /foo");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not save unknown routes, analytics, third-party traffic, unsupported RSC segments or POST", async () => {
    const w = worker();
    await w.dispatch("install");
    w.requests.length = 0;
    for (const path of ["/missing", "/missing.js", "/_vercel/insights/script.js", "https://analytics.example/collect"])
      expect(await w.request(path)).toBeUndefined();
    expect(await w.request("/foo", { method: "POST", body: "operation" })).toBeUndefined();
    expect(
      await w.request("/foo?_rsc=unknown", { headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/missing" } }),
    ).toBeUndefined();
    expect(w.requests).toHaveLength(0);
    // A content-hashed file in no saved pack goes to the network unchanged.
    expect((await w.request("/_next/static/new-build.js"))?.status).toBe(404);
    expect(w.requests.map((request) => request.url)).toEqual([`${ORIGIN}/_next/static/new-build.js`]);
  });

  it("answers status queries through the message port and falls back to the sending client", async () => {
    const w = worker();
    await w.dispatch("install");
    const portMessages: Status[] = [],
      clientMessages: Status[] = [];
    const source = { postMessage: (status: Status) => void clientMessages.push(structuredClone(status)) };
    await w.dispatch("message", {
      data: { type: "GET_OFFLINE_STATUS" },
      ports: [{ postMessage: (status) => void portMessages.push(structuredClone(status)) }],
      source,
    });
    expect(portMessages).toHaveLength(1);
    expect(portMessages[0].state).toBe("ready");
    expect(clientMessages).toHaveLength(0);
    await w.dispatch("message", { data: { type: "GET_OFFLINE_STATUS" }, source });
    expect(clientMessages).toHaveLength(1);
    expect(clientMessages[0].state).toBe("ready");
  });

  it("reuses verified cached files on retry while replacing same-size cached corruption", async () => {
    const w = worker();
    await w.dispatch("install");
    const path = "/_next/static/test/chunk.js";
    const asset = w.bodies.get(path)!;
    const cache = await w.caches.open(`${PREFIX}${w.manifest.version}`);
    await cache.put(path, new Response(`!${asset.body.slice(1)}`, { headers: { "content-type": asset.contentType } }));
    w.requests.length = 0;
    expect((await w.message("DOWNLOAD_OFFLINE")).state).toBe("ready");
    expect(w.requests.map((request) => new URL(request.url).pathname)).toEqual([path]);
    expect(await (await cache.match(path))?.text()).toBe(asset.body);
  });

  it("revokes readiness when a cached file disappears and never substitutes HTML for a missing script", async () => {
    const w = worker();
    await w.dispatch("install");
    const path = "/_next/static/test/chunk.js";
    const cache = await w.caches.open(`${PREFIX}${w.manifest.version}`);
    await cache.delete(path);
    expect((await w.message("GET_OFFLINE_STATUS")).state).not.toBe("ready");
    w.failedPaths.add(path);
    const response = await w.request(path).catch(() => undefined);
    if (response) {
      expect(response.headers.get("content-type")).not.toContain("text/html");
      expect(await response.text()).not.toContain("<html");
    }
    w.failedPaths.clear();
    expect((await w.message("DOWNLOAD_OFFLINE")).state).toBe("ready");
    const repaired = await w.caches.open(`${PREFIX}${w.manifest.version}`);
    expect(await (await repaired.match(path))?.text()).toBe(w.bodies.get(path)!.body);
  });
});
