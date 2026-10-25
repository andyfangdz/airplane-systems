/* Build template. scripts/build-offline.mjs embeds the inventory from the exact production output. */
const OFFLINE_MANIFEST = __OFFLINE_MANIFEST__;
const CACHE_PREFIX = "airplane-systems-offline-";
const CACHE_NAME = `${CACHE_PREFIX}${OFFLINE_MANIFEST.version}`;
const READY_KEY = new URL(`/_offline-ready/${OFFLINE_MANIFEST.version}`, self.location.origin).href;
const FILES = new Map(OFFLINE_MANIFEST.files.map((file) => [file.url, file]));
const SEGMENTS = new Set(Object.values(OFFLINE_MANIFEST.routes).flatMap((route) => Object.values(route.segments)));
let download = null;
let status = {
  type: "OFFLINE_STATUS",
  version: OFFLINE_MANIFEST.version,
  state: "downloading",
  completed: 0,
  total: OFFLINE_MANIFEST.total,
  bytes: 0,
  totalBytes: OFFLINE_MANIFEST.totalBytes,
};

async function broadcast() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) client.postMessage(status);
}

async function completeCache(cache) {
  if (!(await cache.match(READY_KEY))) return false;
  const keys = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  return OFFLINE_MANIFEST.files.every((file) => keys.has(file.url));
}

async function currentStatus() {
  if (download) return status;
  try {
    const cache = await caches.open(CACHE_NAME);
    if (await completeCache(cache)) {
      status = {
        ...status,
        state: "ready",
        completed: status.total,
        bytes: status.totalBytes,
        error: undefined,
        code: undefined,
      };
    } else if (status.state !== "error") {
      status = {
        ...status,
        state: "error",
        code: "incomplete",
        error: "The offline download is incomplete. Connect to the internet and retry.",
      };
    }
  } catch {
    status = { ...status, state: "error", code: "storage", error: "Offline storage is unavailable." };
  }
  return status;
}

async function checkedBytes(response, file) {
  if (!response.ok || response.redirected || response.type === "opaque") throw new Error("Download unavailable");
  const bytes = await response.arrayBuffer();
  const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.byteLength !== file.bytes || sha256 !== file.sha256) {
    const error = new Error("The downloaded files do not match this app version. Reconnect and retry.");
    error.code = "integrity";
    throw error;
  }
  return bytes;
}

function responseFor(bytes, file) {
  // Construct a fresh response: snapshot URLs must not become a navigation's base URL or canonical RSC URL.
  // There is no Vary to ignore; HTML, full RSC and each prefetch segment have distinct manifest entries.
  return new Response(bytes, {
    headers: {
      "content-type": file.contentType,
      ...(file.contentType === "text/x-component" ? { "x-nextjs-prerender": "1" } : {}),
      // Next 16 distinguishes its per-segment prefetch protocol from a full-route Flight response.
      ...(SEGMENTS.has(file.url) ? { "x-nextjs-postponed": "2" } : {}),
    },
  });
}

async function downloadPack() {
  if (download) return download;
  download = (async () => {
    status = { ...status, state: "downloading", completed: 0, bytes: 0, error: undefined, code: undefined };
    await broadcast();
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(READY_KEY);
    let cursor = 0;
    let failure;
    const worker = async () => {
      while (!failure && cursor < OFFLINE_MANIFEST.files.length) {
        const file = OFFLINE_MANIFEST.files[cursor++];
        try {
          // A terminated download can reuse only files that still pass this release's content digest.
          const cached = await cache.match(file.url);
          let bytes = cached ? await checkedBytes(cached, file).catch(() => null) : null;
          if (!bytes) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120_000);
            try {
              bytes = await checkedBytes(
                await fetch(new URL(file.url, self.location.origin), {
                  cache: "no-store",
                  credentials: "same-origin",
                  redirect: "error",
                  signal: controller.signal,
                }),
                file,
              );
            } finally {
              clearTimeout(timeout);
            }
            await cache.put(file.url, responseFor(bytes, file));
          }
          status.completed++;
          status.bytes += file.bytes;
          await broadcast();
        } catch (error) {
          failure = error;
        }
      }
    };
    // Keep download/decompression memory bounded on iPhone, including the largest aircraft buffers.
    await Promise.all([worker(), worker()]);
    if (failure) throw failure;
    await cache.put(READY_KEY, new Response(OFFLINE_MANIFEST.version));
    if (!(await completeCache(cache))) throw new Error("Offline storage did not retain the complete download");
    status = { ...status, state: "ready" };
    await broadcast();
  })()
    .catch(async (error) => {
      const quota = error.name === "QuotaExceededError";
      status = {
        ...status,
        state: "error",
        code: quota ? "quota" : typeof error.code === "string" ? error.code : "network",
        error: quota
          ? "Not enough storage for offline use. Free some space and retry."
          : error.code === "integrity"
            ? error.message
            : "Offline download interrupted. Connect to the internet and retry.",
      };
      await broadcast();
      throw error;
    })
    .finally(() => {
      download = null;
    });
  return download;
}

self.addEventListener("install", (event) => {
  // Installation is atomic: a failed update leaves the previous active worker and its verified pack untouched.
  // Never skipWaiting: already-open study sessions keep their matching HTML, RSC and chunks until they close.
  event.waitUntil(downloadPack());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (await completeCache(cache)) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
        );
      }
      await self.clients.claim();
      await currentStatus();
      await broadcast();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_OFFLINE_STATUS") {
    event.waitUntil(
      currentStatus().then((message) => {
        if (event.ports?.[0]) event.ports[0].postMessage(message);
        else event.source?.postMessage(message);
      }),
    );
  } else if (event.data?.type === "DOWNLOAD_OFFLINE") {
    // Repairs an evicted active pack. Initial failed installs are retried with registration.update().
    event.waitUntil(downloadPack().catch(() => {}));
  }
});

function fileFor(request, url) {
  const routePath = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : "/";
  const route = OFFLINE_MANIFEST.routes[routePath];
  if (route) {
    if (request.headers.get("rsc") === "1") {
      const segment = request.headers.get("next-router-segment-prefetch");
      return segment ? route.segments[segment] : route.rsc;
    }
    return route.html;
  }
  return OFFLINE_MANIFEST.aliases[url.pathname] ?? (FILES.has(url.pathname) ? url.pathname : undefined);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const key = fileFor(request, url);
  if (!key || !FILES.has(key)) return; // No third-party, analytics, API or unknown-document caching.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(key);
      if (cached) {
        if (request.method === "HEAD") return new Response(null, { status: cached.status, headers: cached.headers });
        return cached;
      }
      // A missing script never receives HTML. Known resources may recover online, but only a complete verified
      // download can restore the ready status after browser storage eviction.
      event.waitUntil(currentStatus().then(broadcast));
      return fetch(request);
    })(),
  );
});
