#!/usr/bin/env node
/** Prepare an optimistic CloudFront origin switch. Uploads complete before this configuration is applied. */
import { readFile, writeFile } from "node:fs/promises";

export function activation(distribution, release) {
  if (!/^[a-f0-9]{40}-[a-f0-9]{64}$/.test(release)) throw new Error("Invalid release identifier");
  if (!distribution.ETag || !distribution.DistributionConfig)
    throw new Error("Distribution response needs ETag and configuration");
  const config = structuredClone(distribution.DistributionConfig);
  const origin = config.Origins?.Items?.find((item) => item.Id === "site-bucket");
  const assets = config.Origins?.Items?.find((item) => item.Id === "site-assets");
  if (!origin || !assets || assets.OriginPath || origin.DomainName !== assets.DomainName)
    throw new Error(
      "Apply the release-aware CloudFormation template first (separate site-bucket and root site-assets origins)",
    );
  if (config.DefaultCacheBehavior?.TargetOriginId !== "site-bucket") throw new Error("Unexpected default origin");
  for (const path of ["/_next/static/*", "/geometry/*-????????????????????.*"])
    if (
      !config.CacheBehaviors?.Items?.some(
        (item) =>
          item.PathPattern === path &&
          item.TargetOriginId === "site-assets" &&
          item.CachePolicyId === "658327ea-f89d-4fab-a63d-7e88639e58f6",
      )
    )
      throw new Error(`Missing immutable asset origin behavior: ${path}`);
  // An earlier broad rule could shadow a correct-looking immutable rule; require the reviewed template inventory.
  if (config.CacheBehaviors.Items.length !== 2) throw new Error("Unexpected cache behavior inventory");
  origin.OriginPath = `/releases/${release}`;
  return { etag: distribution.ETag, config };
}

if (import.meta.main) {
  try {
    const [source, release, destination] = process.argv.slice(2);
    const { etag, config } = activation(JSON.parse(await readFile(source, "utf8")), release);
    await writeFile(destination, JSON.stringify(config));
    console.log(etag);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
