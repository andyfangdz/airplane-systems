# Static releases on S3 + CloudFront

The same static artifact tested by CI is promoted to production. Deployment never installs dependencies or rebuilds
source. Browser jobs reuse one server build and one static build; geometry is compiled once for both.

## Create or update infrastructure

Create a reviewed CloudFormation change set from `../aws/site.json`, passing the account's `AllowedAccountId`.
The template creates a private S3 bucket, Origin Access Control, short HTML caching, immutable asset caching,
HTTPS redirects, security headers and the route rewrite function. It creates no IAM deployment role or custom domain.
Deploy with your own AWS CLI credentials.

The distribution has two origins to the same bucket. `site-assets` always addresses the bucket root and serves
`/_next/static/*` (including `/offline/<sha256>/` snapshots beneath that prefix) and hashed `/geometry/*-????????????????????.*` assets. The default `site-bucket` origin addresses one complete release
beneath `releases/<source-commit>-<manifest-sha256>/`. The edge function maps view URLs to exported HTML and preserves
real 404s. Its LIVE bytes must equal the selected source commit before promotion proceeds.

**Before every infrastructure update**, read the active `site-bucket` origin path from CloudFront and pass its final
segment as `ActiveReleaseId` in the change set. The deployment tool owns release activation; CloudFormation owns the
rest of the distribution. Omitting the active ID on an update can reset the origin to its bootstrap root. Empty is
only for the initial stack, before any release has been promoted. Review the change set before executing it.

## Promote a successful CI release

1. Select a successful **push to main** CI run. The `release` job runs only after the complete check, offline deploy
   suite, all discovered Playwright suites and static artifact tests pass. Download `release-<commit>` from that run
   into a local directory. Do not use the intermediate `*-under-test` artifacts.
2. Copy the manifest SHA256 from that run's release-job summary. Supply that independently recorded digest; do not
   derive the expected value from the downloaded manifest you are about to verify.
3. Promote it:

   ```bash
   DEPLOY_AWS_ACCOUNT=<12-digit-account> DEPLOY_AWS_REGION=<region> npm run deploy:aws -- \
     --artifact <downloaded-directory> --manifest-sha256 <CI-summary-digest>
   ```

The normal mode freshly fetches `origin/main` and requires the artifact to match its current tip. If main advanced,
select its successful release or explicitly use `--rollback-to <release-commit>`. That option accepts only a commit
on main's first-parent history and requires the running deployment script to match current main.

The sealed `release-manifest.json` records the source commit, tree, clean/dirty status, lockfile digest, Node/npm
versions, platform, architecture, and every served file's checksum, byte count, content type and cache class. The
promoter snapshots the downloaded directory into private scratch space, then verifies the snapshot against the
independent digest and selected source, including its exact Node/npm pins. Unexpected files, unsafe paths, symlinks,
altered bytes, misnamed content-addressed geometry, missing geometry and dirty source builds are rejected. Checksums
establish byte integrity; the successful CI run is the evidence of test completion.

Source/account safeguards remain: expected AWS account, explicit main fetch, history-override rejection, byte-exact
source export, rollback ancestry, and the distribution's associated LIVE route function. Local working changes only
warn; they are not deployed. The deploy script emits one JSON outcome and cleans up its scratch directory on exit.

## Publication and rollback

The upload order is shared immutable JavaScript/fonts/styles, shared immutable geometry and offline snapshots, then all short-cache files
under the new release prefix. All uploads must finish before activation. The tool captures the distribution's ETag and
checks its immutable origin/cache rules before uploading. A conditional CloudFront update switches only the default
origin path, refusing if another promotion or distribution update completed during these uploads. The tool waits for
propagation, invalidates caches, and runs the selected source's smoke against the live site and expected manifest
digest. The smoke checks route/404/HTTPS behavior and each manifest-listed immutable asset's MIME, cache policy and
checksum, including geometry that HTML script discovery cannot see.

This is a complete origin release switch, not a globally instantaneous transaction: CloudFront propagates configuration
to edges, and existing browser caches can retain prior pages. Shared immutable paths keep previous page assets usable.
If activation or smoke fails, inspect the JSON step and distribution; do not assume it rolled itself back. Re-promote
an earlier successful artifact with the earlier commit's `--rollback-to` and manifest digest. No rebuild occurs.

Hashed assets and versioned offline snapshots carry `public, max-age=31536000, immutable`; JSON scene assets are served as JSON and explicit gzip
geometry as binary bytes (without `Content-Encoding`, because the decoder owns decompression). Mutable manifests,
HTML and RSC files carry `public, max-age=60`, with the default CDN policy bounded to 0–300 seconds. The PWA entry
points `/sw.js`, `/manifest.webmanifest` and `/offline-manifest.json` instead carry `no-cache` with explicit JavaScript,
web app manifest and JSON MIME types. The default policy's zero minimum TTL respects this revalidation requirement.
Offline HTML/RSC snapshots download as `.bin` bytes; the worker restores their HTML or `text/x-component` response
type when serving a study route. Exported `.txt` navigation payloads keep their plain-text MIME type on the network.

The worker is served directly at `/sw.js`, so registration with scope `/` needs no `Service-Worker-Allowed` override.
PWA files and icons pass through the route function unchanged. Static hosting does not execute Next.js `headers()`;
these upload metadata and CloudFront rules provide the deployed headers. Offline snapshots reuse the existing
`/_next/static/*` immutable behavior, so no new infrastructure behavior is required. The smoke verifies the served
worker and manifest MIME types, cache policy and checksums as well as all immutable snapshots.

## Retention

CI retains deployable artifacts for 90 days. Download/archive any release that must remain available for rollback
longer than that. Production publication never deletes objects. The bucket's noncurrent-version expiration is not
garbage collection for unique hashed keys.

Before introducing cleanup, inventory release manifests, identify the active release and explicitly retained rollback
releases, and compute their referenced immutable assets. Add a grace period for cached/open pages, produce a dry-run
candidate list, and review it before deleting anything. A release directory is collectible only when it is inactive,
not retained for rollback and older than the grace period; an immutable asset is collectible only when no retained
manifest references it. Retain the complete `/_next/static/offline/<sha256>/` inventory with its corresponding build; an installed
worker may still need that version after a newer release activates. No automated remote cleanup is included.

## Local verification

`npm run test:deploy` runs subprocess fixtures with stub AWS commands and no external writes. Unit tests cover manifest
integrity, source identity, delivery policy and activation preconditions. CI serves the static export through
`scripts/serve-export.mjs`, applying the same rewrite and cache classes; its static Playwright project also runs smoke.

For a local static build: `STATIC_EXPORT=1 npm run build`, `npm run release:seal`, then
`STATIC_EXPORT=1 npx playwright test scripts/test-static-export-ui.mjs --project=desktop`. Local dirty builds can be
inspected and tested; the promoter refuses to publish them.
