import { afterEach, expect, it, vi } from "vitest";
import { BoxGeometry } from "three";
import { Catalogue, specGeo } from "@/lib/catalogue";
import { prepareGeometry } from "@/lib/mesh/prebuilt";
import { compileSceneManifest } from "@/authoring/scene-manifest";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each(["download", "json"])(
  "recovers after a stalled scene %s and allows retry after recovery fails",
  async (phase) => {
    vi.useFakeTimers();
    const cat = new Catalogue("test");
    const factory = vi.fn(() => {
      throw new Error("Compiled geometry must not execute authoring factories");
    });
    const part = cat.part(factory, ["engine"], { id: "tests.compiled-geometry-loading.timeout.001", name: "Box" });
    const geometry = new BoxGeometry();
    const meshes = [
      {
        key: part.id,
        procedural: true,
        unindexedSource: false,
        attributes: Object.entries(geometry.attributes).map(([name, a]) => ({
          name,
          array: a.array,
          itemSize: a.itemSize,
          normalized: a.normalized,
        })),
        index: geometry.index!.array,
        groups: geometry.groups,
      },
    ];
    const assets = { geometry: "/geometry/test.bin.gz", scene: "/geometry/test.scene.json", definitionDigest: "v1" };
    vi.stubEnv("NEXT_PUBLIC_GEOMETRY_ASSETS", JSON.stringify({ test: assets.geometry }));
    vi.stubEnv(
      "NEXT_PUBLIC_GEOMETRY_RUNTIME",
      JSON.stringify({
        version: 1,
        recovery: "/geometry/recovery.js",
        aircraft: { test: assets },
      }),
    );
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, init: RequestInit) => {
        expect(path).toBe(assets.scene);
        signals.push(init.signal as AbortSignal);
        const stalled = new Promise<never>(() => {});
        return phase === "download" ? stalled : Promise.resolve({ ok: true, json: () => stalled });
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const workers: { recovery: boolean; terminated: boolean }[] = [];
    let recoveryFailures = 1;
    vi.stubGlobal(
      "Worker",
      class {
        record: (typeof workers)[number];
        onmessage?: (event: { data: unknown }) => void;
        constructor(path: string | URL) {
          this.record = { recovery: String(path) === "/geometry/recovery.js", terminated: false };
          workers.push(this.record);
        }
        terminate() {
          this.record.terminated = true;
        }
        postMessage() {
          queueMicrotask(() =>
            this.onmessage?.({
              data: this.record.recovery && recoveryFailures-- > 0 ? { error: "offline" } : { meshes },
            }),
          );
        }
      },
    );
    const failed = expect(prepareGeometry(cat)).rejects.toThrow("recovery failed");
    await vi.advanceTimersByTimeAsync(15_000);
    await failed;
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    const retried = prepareGeometry(cat);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(retried).resolves.toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(workers.filter((worker) => worker.recovery)).toHaveLength(2);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(factory).not.toHaveBeenCalled();
    expect(specGeo(part).attributes.position.count).toBe(geometry.attributes.position.count);
  },
);

it("loads original authoring only after failure, releases workers and retries a failed recovery", async () => {
  const cat = new Catalogue("test");
  const geometry = new BoxGeometry();
  const factory = vi.fn(() => geometry);
  const part = cat.part(factory, ["engine"], { id: "tests.compiled-geometry-loading.test.box.001", name: "Box" });
  const assets = { geometry: "/geometry/test.bin.gz", scene: "/geometry/test.scene.json", definitionDigest: "v1" };
  const scene = compileSceneManifest(cat, "v1", assets.geometry);
  factory.mockClear();
  vi.stubEnv("NEXT_PUBLIC_GEOMETRY_ASSETS", JSON.stringify({ test: assets.geometry }));
  vi.stubEnv(
    "NEXT_PUBLIC_GEOMETRY_RUNTIME",
    JSON.stringify({ version: 1, recovery: "/geometry/recovery.js", aircraft: { test: assets } }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => scene })),
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const workers: { path: string; terminated: boolean }[] = [];
  let failures = 1;
  vi.stubGlobal(
    "Worker",
    class {
      record: (typeof workers)[number];
      onmessage?: (event: { data: unknown }) => void;
      constructor(path: string | URL) {
        this.record = { path: String(path), terminated: false };
        workers.push(this.record);
      }
      terminate() {
        this.record.terminated = true;
      }
      postMessage(data: { path?: string }) {
        queueMicrotask(() => {
          if (data.path || failures-- > 0) this.onmessage?.({ data: { error: "offline" } });
          else
            this.onmessage?.({
              data: {
                meshes: [
                  {
                    key: part.id,
                    procedural: true,
                    unindexedSource: false,
                    attributes: Object.entries(geometry.attributes).map(([name, a]) => ({
                      name,
                      array: a.array,
                      itemSize: a.itemSize,
                      normalized: a.normalized,
                    })),
                    index: geometry.index!.array,
                    groups: geometry.groups,
                  },
                ],
              },
            });
        });
      }
    },
  );
  await expect(prepareGeometry(cat)).rejects.toThrow("recovery failed");
  await expect(prepareGeometry(cat)).resolves.toBe(true);
  expect(workers.filter((worker) => worker.path === "/geometry/recovery.js")).toHaveLength(2);
  expect(workers.every((worker) => worker.terminated)).toBe(true);
  expect(factory).not.toHaveBeenCalled();
  expect(specGeo(part).attributes.position.count).toBe(geometry.attributes.position.count);
  expect(specGeo(part).userData).not.toHaveProperty("unindexedSource");
});
