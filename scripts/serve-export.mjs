#!/usr/bin/env node
/**
 * Serves the static export (out/, from `STATIC_EXPORT=1 npm run build`) the way the CloudFront site does: every request
 * goes through infra/cloudfront/view-rewrite.js first, `/` serves index.html, and a missing file answers 404 with the
 * 404.html body (infra/aws/site.json). The browser tests use it to load the deployed files rather than `next start`.
 *
 *   node scripts/serve-export.mjs [port]      (default 4100; serves out/ next to this script's parent)
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { cacheControl } from "./release-manifest.mjs";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "out");
const rewrite = await readFile(join(root, "infra/cloudfront/view-rewrite.js"), "utf8");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".bin": "application/octet-stream",
  ".glb": "model/gltf-binary",
};

/** The viewer-request event CloudFront would hand the function for this URL, with its query in CloudFront's shape. */
function event(url) {
  const querystring = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key).map((value) => ({ value }));
    querystring[key] = values.length > 1 ? { value: values[0].value, multiValue: values } : values[0];
  }
  return { request: { uri: decodeURIComponent(url.pathname), querystring, method: "GET", headers: {}, cookies: {} } };
}

/** The export's file at a key, or null when there is none. */
async function file(uri) {
  const path = normalize(join(out, uri));
  if (path !== out && !path.startsWith(out + "/")) return null;
  try {
    return await readFile(path);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EISDIR") return null;
    throw err;
  }
}

const server = createServer(async (req, res) => {
  try {
    const result = runInNewContext(rewrite + "\nhandler(event);", { event: event(new URL(req.url, "http://x")) });
    if (result.statusCode) {
      res.writeHead(result.statusCode, { location: result.headers.location.value });
      return res.end();
    }
    const key = result.uri === "/" ? "/index.html" : result.uri;
    const body = await file(key);
    if (body) {
      res.writeHead(200, {
        "content-type": TYPES[extname(key)] ?? "application/octet-stream",
        "cache-control": cacheControl(key.slice(1)),
      });
      return res.end(body);
    }
    res.writeHead(404, { "content-type": TYPES[".html"] });
    res.end(await file("/404.html"));
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
});
server.listen(Number(process.argv[2] ?? 4100), "127.0.0.1");
