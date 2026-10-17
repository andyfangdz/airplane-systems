/** A slow catalogue download must not race the SR22T's progressive geometry builders. */
import type { ReactElement } from "react";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import type { BuiltMesh } from "@/lib/mesh/format";

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => [value, () => {}],
  useRef: (current: unknown) => ({ current }),
  useMemo: (create: () => unknown) => create(),
  useCallback: (callback: unknown) => callback,
  useEffect: (setup: () => void | (() => void)) => {
    const cleanup = setup();
    if (cleanup) lifecycle.cleanups.push(cleanup);
  },
}));
vi.mock("@/lib/materials", async (original) => ({
  ...(await original<typeof import("@/lib/materials")>()),
  skinMat: () => new THREE.MeshStandardMaterial(),
}));
vi.mock("@/lib/build", async (original) => ({
  ...(await original<typeof import("@/lib/build")>()),
  nextFrame: () => new Promise<void>((done) => setTimeout(done, 16)),
}));

afterEach(() => {
  lifecycle.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it.each(["mounted", "unmounted", "replaced"])(
  "awaits delayed assets without calling eligible factories (%s)",
  async (lifetime) => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_GEOMETRY_ASSETS", '{"sr22t":"/geometry/sr22t-test.bin.gz"}');
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    let reply: ((event: { data: { meshes: BuiltMesh[] } }) => void) | undefined;
    const terminate = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        set onmessage(fn: typeof reply) {
          reply = fn;
        }
        terminate = terminate;
        postMessage() {}
      },
    );
    const { CAT } = await import("@/aircraft/sr22t/parts");
    const { geometryEntries } = await import("@/lib/mesh/prebuilt");
    const { isFuselage } = await import("@/aircraft/sr22t/fuselage-geo");
    const { SceneModel } = await import("@/aircraft/sr22t/Airplane");
    const { Precompile } = await import("@/components/scene/Precompile");
    const { useBuild, setBuild } = await import("@/lib/build");
    const { useView } = await import("@/lib/view");
    useView.setState({ session: { aircraft: "sr22t", token: Symbol("test") } });
    const entries = geometryEntries(CAT);
    // Preserve the hull factory identity used by isFuselage; all other eligible factories are guarded.
    const factories = entries.filter(({ spec }) => !isFuselage(spec)).map(({ spec }) => vi.spyOn(spec, "geo"));
    const rendered = SceneModel() as ReactElement<{ children: ReactElement[] }>;
    const precompile = rendered.props.children.find((child) => child?.type === Precompile)!;
    const run = (precompile.props as { onStarted: (compiled: Promise<void>) => Promise<void> }).onStarted(
      Promise.resolve(),
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(reply).toBeTypeOf("function");
    for (const factory of factories) expect(factory).not.toHaveBeenCalled();
    expect(useBuild.getState().stage).toBe("airframe");
    if (lifetime === "unmounted") lifecycle.cleanups.splice(0).forEach((cleanup) => cleanup());
    if (lifetime === "replaced") {
      // Layout disposal/replacement happens before old passive cleanup: the old run must not publish into this owner.
      useView.setState({ session: { aircraft: "c172s", token: Symbol("replacement") } });
      setBuild("code");
    }
    reply!({
      data: {
        meshes: entries.map(({ key }) => ({
          key,
          attributes: [
            { name: "position", array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3, normalized: false },
          ],
          index: null,
          groups: [],
          unindexedSource: false,
        })),
      },
    });
    await vi.runAllTimersAsync();
    await run;
    for (const factory of factories) expect(factory).not.toHaveBeenCalled();
    expect(terminate).toHaveBeenCalledOnce();
    expect(useBuild.getState().stage).toBe(
      lifetime === "replaced" ? "code" : lifetime === "unmounted" ? "airframe" : "ready",
    );
  },
  15_000,
);
