import { describe, expect, it, vi } from "vitest";
import type { NextAdapter } from "next";
import { createOfflineAdapter } from "../scripts/offline-adapter.mjs";

type BuildContext = Parameters<NonNullable<NextAdapter["onBuildComplete"]>>[0];
type Config = Parameters<NonNullable<NextAdapter["modifyConfig"]>>[0];
type ConfigContext = Parameters<NonNullable<NextAdapter["modifyConfig"]>>[1];

describe("hosting adapter offline handoff", () => {
  it("preserves platform configuration and keeps the offline hook installed", async () => {
    const modifyConfig = vi.fn(async (config: Config) => ({
      ...config,
      deploymentId: "platform-build",
      adapterPath: "/platform/adapter.mjs",
      experimental: { ...config.experimental, supportsImmutableAssets: true },
    }));
    const prepare = vi.fn();
    const adapter = createOfflineAdapter(async () => ({ name: "Platform", modifyConfig }), prepare);
    const config = { basePath: "", experimental: {} } as Config;
    const context = { phase: "phase-production-build", nextVersion: "16.4.2", projectDir: "/study" } as ConfigContext;
    const result = await adapter.modifyConfig!(config, context);
    expect(modifyConfig).toHaveBeenCalledWith(config, context);
    expect(result).toMatchObject({ deploymentId: "platform-build", experimental: { supportsImmutableAssets: true } });
    expect(result.adapterPath).toMatch(/\/scripts\/offline-adapter\.mjs$/);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("publishes generated assets before the platform reads its completed output inventory", async () => {
    const context = {
      projectDir: "/study",
      outputs: { staticFiles: [] },
      routing: { onMatch: [] },
    } as unknown as BuildContext;
    const file = {
      type: "STATIC_FILE" as BuildContext["outputs"]["staticFiles"][number]["type"],
      id: "/sw.js",
      pathname: "/sw.js",
      filePath: "/study/public/sw.js",
      immutableHash: undefined,
    };
    const order: string[] = [];
    const prepare = vi.fn(async (root: string, { adapterContext }: { adapterContext: BuildContext }) => {
      expect(root).toBe("/study");
      expect(adapterContext).toBe(context);
      adapterContext.outputs.staticFiles.push(file);
      order.push("offline");
    });
    const onBuildComplete = vi.fn(async (received: BuildContext) => {
      expect(received).toBe(context);
      expect(received.outputs.staticFiles).toEqual([file]);
      const [cache] = received.routing.onMatch;
      expect(new RegExp(cache.sourceRegex).test(`/_next/static/offline/${"a".repeat(64)}/pages/index.html.bin`)).toBe(
        true,
      );
      expect(new RegExp(cache.sourceRegex).test("/sw.js")).toBe(false);
      expect(cache.headers?.["cache-control"]).toBe("public,max-age=31536000,immutable");
      order.push("platform");
    });
    const adapter = createOfflineAdapter(async () => ({ name: "Platform", onBuildComplete }), prepare);
    await adapter.onBuildComplete!(context);
    expect(order).toEqual(["offline", "platform"]);
  });

  it("does not publish a deployment when offline preparation fails", async () => {
    const onBuildComplete = vi.fn();
    const prepare = vi.fn(async () => {
      throw new Error("Missing offline route");
    });
    const adapter = createOfflineAdapter(async () => ({ name: "Platform", onBuildComplete }), prepare);
    await expect(adapter.onBuildComplete!({ projectDir: "/study" } as BuildContext)).rejects.toThrow(
      "Missing offline route",
    );
    expect(onBuildComplete).not.toHaveBeenCalled();
  });
});
