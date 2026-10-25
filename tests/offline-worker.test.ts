import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

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

function fixture(mode: Mode = "server", version = "test-v2") {
  const base = `/_next/static/offline/${version}`;
  const assets: [string, string, string][] = [
    [`${base}/pages/index.html`, "<html><body>Home HTML</body></html>", "text/html; charset=utf-8"],
    [`${base}/pages/index.rsc`, '0:["Home flight"]', "text/x-component"],
    [`${base}/pages/index-tree.rsc`, '0:["Home tree"]', "text/x-component"],
    [`${base}/pages/foo.html`, "<html><body>Foo HTML</body></html>", "text/html; charset=utf-8"],
    [`${base}/pages/foo.rsc`, '0:["Foo flight"]', "text/x-component"],
    [`${base}/pages/foo-tree.rsc`, '0:["Foo tree"]', "text/x-component"],
    [`${base}/meta/icon.svg`, '<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml"],
    ["/_next/static/test/chunk.js", "globalThis.offlineChunk = true;", "application/javascript"],
    ["/_next/static/test/style.css", "body { color: navy; }", "text/css"],
  ];
  const bodies = new Map(assets.map(([url, body, contentType]) => [url, { body, contentType }]));
  const files = assets.map(([url, body, contentType]) => ({
    url,
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
    contentType,
  }));
  const manifest = {
    schema: 1,
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

function worker(mode: Mode = "server", caches = new MemoryCaches()) {
  const { manifest, bodies } = fixture(mode);
  const listeners = new Map<string, ((event: WorkerEvent) => void)[]>();
  const broadcasts: Status[] = [];
  const requests: Request[] = [];
  const failedPaths = new Set<string>();
  const corruptedPaths = new Set<string>();
  const lifecycle = { skipped: 0, claimed: 0 };
  const network = async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(typeof input === "string" || input instanceof URL ? absolute(input) : input, init);
    requests.push(request);
    const path = new URL(request.url).pathname;
    if (failedPaths.has(path)) throw new TypeError("Network interrupted");
    const asset = bodies.get(path);
    if (!asset) return new Response("Network-only response", { status: 404 });
    // Keep the same byte count: a length check alone must not accept a corrupted response.
    return new Response(corruptedPaths.has(path) ? `!${asset.body.slice(1)}` : asset.body, {
      headers: { "content-type": asset.contentType, "content-length": String(Buffer.byteLength(asset.body)) },
    });
  };
  const clients = {
    matchAll: async () => [{ postMessage: (message: Status) => broadcasts.push(structuredClone(message)) }],
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
  runInNewContext(source.replace("__OFFLINE_MANIFEST__", JSON.stringify(manifest)), {
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
    setTimeout,
    clearTimeout,
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
    caches,
    broadcasts,
    requests,
    failedPaths,
    corruptedPaths,
    lifecycle,
    dispatch,
    message,
    request,
  };
}

describe("offline service worker", () => {
  it("reports ready only after installing every verified file, and never forces an update into an open page", async () => {
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
    expect(w.lifecycle).toEqual({ skipped: 0, claimed: 0 });
    await w.dispatch("activate");
    expect(w.lifecycle).toEqual({ skipped: 0, claimed: 1 });
    const restarted = worker("server", w.caches);
    expect((await restarted.message("GET_OFFLINE_STATUS")).state).toBe("ready");
    const tree = await restarted.request("/?_rsc=restart", {
      headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/_tree" },
    });
    expect(tree?.headers.get("x-nextjs-postponed")).toBe("2");
    expect(restarted.requests).toHaveLength(0);
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
      expect(await caches.keys()).not.toContain(`${PREFIX}previous`);
      expect(await caches.keys()).toContain("unrelated-app-cache");
      expect(await caches.keys()).toContain(`${PREFIX}${w.manifest.version}`);
      expect(w.lifecycle).toEqual({ skipped: 0, claimed: 1 });
    },
  );

  it.each(["server", "export"] as const)(
    "serves distinct HTML, RSC, segment, HEAD and static responses in %s mode",
    async (mode) => {
      const w = worker(mode);
      await w.dispatch("install");
      w.requests.length = 0;
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
        ...(mode === "export"
          ? [
              { path: "/foo.txt?_rsc=third", headers: {}, file: w.manifest.aliases["/foo.txt"] },
              { path: "/foo/__next._tree.txt", headers: {}, file: w.manifest.aliases["/foo/__next._tree.txt"] },
            ]
          : []),
      ];
      for (const route of cases) {
        const expected = w.bodies.get(route.file)!;
        for (const method of ["GET", "HEAD"]) {
          const response = await w.request(route.path, { method, headers: route.headers }, route.navigation);
          expect(response, `${method} ${route.path}`).toBeDefined();
          expect(response!.status).toBe(200);
          expect(response!.headers.get("content-type")).toBe(expected.contentType);
          expect(response!.headers.get("x-nextjs-postponed")).toBe(segmentFiles.has(route.file) ? "2" : null);
          expect(await response!.text()).toBe(method === "HEAD" ? "" : expected.body);
        }
      }
      expect(w.requests, "known cached requests must work without a network fetch").toHaveLength(0);
    },
  );

  it("does not intercept unknown routes, analytics, third-party traffic, unsupported RSC segments or POST", async () => {
    const w = worker();
    await w.dispatch("install");
    w.requests.length = 0;
    for (const path of [
      "/missing",
      "/missing.js",
      "/_next/static/new-build.js",
      "/_vercel/insights/script.js",
      "https://analytics.example/collect",
    ])
      expect(await w.request(path)).toBeUndefined();
    expect(await w.request("/foo", { method: "POST", body: "operation" })).toBeUndefined();
    expect(
      await w.request("/foo?_rsc=unknown", { headers: { RSC: "1", "Next-Router-Segment-Prefetch": "/missing" } }),
    ).toBeUndefined();
    expect(w.requests).toHaveLength(0);
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
