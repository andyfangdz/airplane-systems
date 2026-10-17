#!/usr/bin/env node
/**
 * Smoke test of a deployed site, from outside: the root and the main views each return their own static HTML page, the
 * hashed assets they reference load with an immutable cache header, /sr22t/ redirects, and unknown paths (including an
 * unknown system) 404 with the 404.html body.
 *
 *   npm run smoke -- https://dxxxx.cloudfront.net
 *   npm run smoke -- http://127.0.0.1:3000          (the HTTP-to-HTTPS check is recorded as skipped)
 *
 * Prints one JSON object on stdout: { "base", "ok", "checks": [{ "url", "expect", "status", "ok" }] } (a skipped check
 * has "skipped": true and status null). Failing checks are also listed on stderr. Exit 0 when every check passes, 1 when
 * any fails, 2 on bad usage. No redirect is followed. Node built-ins only.
 */
import { createHash } from "node:crypto";
import { immutable } from "./release-manifest.mjs";

/** Views that must serve their own page (the airplane's route, not the root's HTML): path → its tab title. */
export const VIEW_PAGES = { "/sr22t": "SR22T G6 Systems", "/sr22t/electrical": "SR22T G6 Systems" };
/** Paths that must 404 with the 404.html body. */
export const MISSING_PATHS = ["/nope", "/sr22t/bogus", "/sr22t/electrical/extra"];
/** The cache-control directives the HTML must carry (a short cache, so a deploy shows within a minute). */
export const HTML_CACHE = ["public", "max-age=60"];
const TIMEOUT_MS = 15000;

/** The /_next/static/ URLs referenced by src or href attributes in an HTML string, in order, without duplicates. */
export function assetUrls(html) {
  const urls = [...html.matchAll(/\s(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  return [...new Set(urls)];
}

const directives = (value) =>
  (value ?? "")
    .toLowerCase()
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

/**
 * Checks one response against one expectation. `check.expect` may hold: status, contentType (prefix), bodyIncludes,
 * bodyEquals, cacheControl (the exact directive set, any order), cacheIncludes (one directive), location (exact) and
 * locationEndsWith. `response` is { status, headers: { <lower-case name>: value }, body }. Returns { ok, problems }.
 */
export function evaluate(check, response) {
  const e = check.expect;
  const h = response.headers;
  const problems = [];
  if (e.sha256 !== undefined && response.sha256 !== e.sha256)
    problems.push(`sha256 ${response.sha256}, want ${e.sha256}`);
  if (e.status !== undefined && response.status !== e.status)
    problems.push(`status ${response.status}, want ${e.status}`);
  if (e.contentType !== undefined && !(h["content-type"] ?? "").toLowerCase().startsWith(e.contentType))
    problems.push(`content-type "${h["content-type"] ?? ""}", want ${e.contentType}`);
  if (e.bodyIncludes !== undefined && !(response.body ?? "").includes(e.bodyIncludes))
    problems.push(`body lacks "${e.bodyIncludes}"`);
  if (e.bodyEquals !== undefined && response.body !== e.bodyEquals)
    problems.push(`body differs from ${e.bodyEqualsName ?? "the expected body"}`);
  if (e.cacheControl !== undefined) {
    const got = directives(h["cache-control"]);
    const want = e.cacheControl.map((d) => d.toLowerCase());
    if (got.length !== want.length || !want.every((d) => got.includes(d)))
      problems.push(`cache-control "${h["cache-control"] ?? ""}", want "${e.cacheControl.join(", ")}"`);
  }
  if (e.cacheIncludes !== undefined && !directives(h["cache-control"]).includes(e.cacheIncludes))
    problems.push(`cache-control "${h["cache-control"] ?? ""}" lacks ${e.cacheIncludes}`);
  if (e.location !== undefined && h.location !== e.location)
    problems.push(`location "${h.location ?? ""}", want ${e.location}`);
  if (e.locationEndsWith !== undefined && !(h.location ?? "").endsWith(e.locationEndsWith))
    problems.push(`location "${h.location ?? ""}", want …${e.locationEndsWith}`);
  return { ok: problems.length === 0, problems };
}

/** The stdout summary: ok only when every check passed (skipped checks count as passed). */
export function summarize(base, results) {
  const checks = results.map((r) => ({
    url: r.url,
    expect: r.label,
    status: r.status,
    ok: r.ok,
    ...(r.skipped ? { skipped: true } : {}),
  }));
  return { base, ok: checks.every((c) => c.ok), checks };
}

/** The base URL without a trailing slash, or null when it is not an http(s) URL. */
export function parseBase(arg) {
  if (!arg) return null;
  let url;
  try {
    url = new URL(arg);
  } catch (err) {
    if (err instanceof TypeError) return null;
    throw err;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.href.replace(/\/+$/, "");
}

/** GET without following redirects; a network failure or timeout becomes { status: null, error }. */
async function get(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const headers = Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      headers,
      body: bytes.toString("utf8"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (err) {
    if (err instanceof TypeError || err?.name === "TimeoutError" || err?.name === "AbortError")
      return { status: null, headers: {}, body: null, error: err.cause?.message ?? err.message };
    throw err;
  }
}

async function run(base, manifestSha256) {
  const results = [];
  const record = async (url, label, expect, response) => {
    const res = response ?? (await get(url));
    const { ok, problems } = res.status === null ? { ok: false, problems: [res.error] } : evaluate({ expect }, res);
    results.push({ url, label, status: res.status, ok, problems });
    return res;
  };

  const rootUrl = `${base}/`;
  const root = await record(rootUrl, "200 text/html, body contains /_next/static/", {
    status: 200,
    contentType: "text/html",
    bodyIncludes: "/_next/static/",
  });
  await record(rootUrl, `cache-control: ${HTML_CACHE.join(", ")}`, { cacheControl: HTML_CACHE }, root);
  const pages = [root];
  for (const [path, title] of Object.entries(VIEW_PAGES))
    pages.push(
      await record(`${base}${path}`, `200 text/html, body contains <title>${title}</title>`, {
        status: 200,
        contentType: "text/html",
        bodyIncludes: `<title>${title}</title>`,
      }),
    );
  for (const asset of new Set(pages.flatMap((page) => assetUrls(page.body ?? "")))) {
    const extension = new URL(asset, rootUrl).pathname.split(".").at(-1);
    // Match the MIME types assigned by deploy-aws.sh TYPED_ASSETS.
    const contentType = { js: "text/javascript", css: "text/css", woff2: "font/woff2" }[extension];
    await record(
      new URL(asset, rootUrl).href,
      `200${contentType ? ` ${contentType}` : ""}, cache-control contains immutable`,
      {
        status: 200,
        cacheIncludes: "immutable",
        ...(contentType ? { contentType } : {}),
      },
    );
  }
  const release = await record(`${base}/release-manifest.json`, "200 release manifest with expected checksum", {
    status: 200,
    contentType: "application/json",
    ...(manifestSha256 ? { sha256: manifestSha256 } : {}),
  });
  if (release.status === 200) {
    let manifest;
    try {
      manifest = JSON.parse(release.body);
    } catch {
      /* The explicit schema failure below is actionable. */
    }
    if (manifest?.version !== 1 || !Array.isArray(manifest.files)) {
      results.push({
        url: `${base}/release-manifest.json`,
        label: "valid release manifest",
        status: 200,
        ok: false,
        problems: ["invalid release manifest"],
      });
    } else {
      // These include every aircraft's production geometry, which HTML script/link discovery cannot see.
      for (const file of manifest.files.filter((file) => typeof file.path === "string" && immutable(file.path)))
        await record(`${base}/${file.path}`, "200 immutable asset with release checksum", {
          status: 200,
          contentType: file.contentType,
          cacheIncludes: "immutable",
          sha256: file.sha256,
        });
    }
  }
  await record(`${base}/sr22t/`, "308, location ends /sr22t", { status: 308, locationEndsWith: "/sr22t" });

  const notFound = await get(`${base}/404.html`);
  const notFoundBody = notFound.status === 200 ? notFound.body : `<GET /404.html returned ${notFound.status}>`;
  for (const path of MISSING_PATHS)
    await record(`${base}${path}`, "404 text/html, body equals /404.html", {
      status: 404,
      contentType: "text/html",
      bodyEquals: notFoundBody,
      bodyEqualsName: "/404.html",
    });

  const host = new URL(base).host;
  const httpLabel = `301, location https://${host}/`;
  if (base.startsWith("https://"))
    await record(`http://${host}/`, httpLabel, { status: 301, location: `https://${host}/` });
  else results.push({ url: `http://${host}/`, label: httpLabel, status: null, ok: true, skipped: true, problems: [] });
  return results;
}

async function main() {
  const base = parseBase(process.argv[2]);
  if (!base) {
    console.error("usage: npm run smoke -- <base-url>   (e.g. https://dxxxx.cloudfront.net)");
    process.exitCode = 2;
    return;
  }
  const results = await run(base, process.argv[3]);
  const summary = summarize(base, results);
  console.log(JSON.stringify(summary, null, 2));
  for (const r of results.filter((r) => !r.ok)) console.error(`FAIL ${r.url} (${r.label}): ${r.problems.join("; ")}`);
  // exitCode, not exit(): stdout to a pipe is asynchronous on macOS, and exit() could cut the JSON short.
  process.exitCode = summary.ok ? 0 : 1;
}

if (import.meta.main) await main();
