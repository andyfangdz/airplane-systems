/**
 * The walk-around's framing retry once the page's worker has built the fuselage skin (aircraft/sr22t/walk-frame.ts): only
 * an item whose framing waited for it is framed again, once, and only if the camera hasn't moved since. 2a steps back
 * from the airplane (it needs the clearance outline, so it waits); 9g+ is seen from its own eye (it never waits).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BufferGeometry } from "three";

/** A fresh module graph: the hull cache, the worker build, the camera requests and the pending retry are all per page. */
async function page() {
  vi.resetModules();
  const [frame, walk, parts, geometry, worker, walkaround, registry, view] = await Promise.all([
    import("@/aircraft/sr22t/walk-frame"),
    import("@/aircraft/sr22t/walk"),
    import("@/aircraft/sr22t/parts"),
    import("@/aircraft/sr22t/geometry"),
    import("@/aircraft/sr22t/fuselage-geo"),
    import("@/aircraft/sr22t/walkaround"),
    import("@/lib/registry"),
    import("@/lib/view"),
  ]);
  const step = (id: string) => {
    const station = walkaround.WALK.find((s) => s.items.some((i) => i.id === id))!;
    return { station, item: station.items.find((i) => i.id === id)! };
  };
  return {
    frame,
    walk,
    worker,
    step,
    fuselageGeo: geometry.fuselageGeo,
    parts,
    view: registry.view,
    useView: view.useView,
  };
}

/** What fuselage.worker.ts posts for a geometry. */
const message = (g: BufferGeometry) => ({
  attributes: Object.entries(g.attributes).map(([name, a]) => ({
    name,
    array: a.array.slice(),
    itemSize: a.itemSize,
    normalized: a.normalized,
  })),
  index: g.index?.array.slice() ?? null,
  groups: g.groups,
});

// reference values only (no page state): 2a's framing with the hull there, and the worker's reply
let framed2a: { p: number[]; t: number[] };
let referenceReply: ReturnType<typeof message>;
beforeAll(async () => {
  const ref = await page();
  framed2a = ref.walk.stepPose(ref.step("2a"));
  referenceReply = message(ref.fuselageGeo());
}, 60_000);

// each test: a fresh page whose worker (a stand-in posting the reference arrays) answers only when told
let pg: Awaited<ReturnType<typeof page>>;
let built: Promise<unknown>;
let answer: () => void;
let flights: { p: number[]; t: number[] }[];
beforeEach(async () => {
  pg = await page();
  const reply = {
    ...referenceReply,
    attributes: referenceReply.attributes.map((a) => ({ ...a, array: a.array.slice() })),
  };
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror = null;
      constructor() {
        answer = () => this.onmessage?.({ data: reply });
      }
      terminate() {}
    },
  );
  built = pg.worker.fuselageInWorker(); // the airplane's prepare, at boot
  flights = [];
  pg.useView.subscribe((s, was) => {
    if (s.cam && s.cam !== was.cam) flights.push({ p: s.cam.p, t: s.cam.t });
  });
}, 60_000);
afterEach(async () => {
  answer();
  await built;
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** The worker answers and the page's fuselage settles. */
async function settle() {
  answer();
  await built;
  expect(pg.worker.useFuselage.getState().settled).toBe(true);
}

describe("walk-around framing when the worker's fuselage arrives", () => {
  it("frames an item that waited for the hull once, as it frames with the hull there", async () => {
    const a = pg.step("2a");
    pg.frame.frameStep(a);
    expect(flights).toEqual([a.station.cam]);
    await settle();
    expect(flights).toEqual([a.station.cam, framed2a]);
    expect(framed2a).not.toEqual(a.station.cam);
  });

  it("leaves the camera alone on settle for an item that didn't wait", async () => {
    const g = pg.step("9g+");
    pg.frame.frameStep(g);
    expect(flights).toEqual([pg.walk.stepPose(g)]);
    await settle();
    expect(flights).toHaveLength(1);
  });

  it("doesn't re-frame once the walk has moved on (another item, the intro screen or the walk-around closed)", async () => {
    pg.frame.frameStep(pg.step("2a"));
    pg.frame.cancelFrame();
    await settle();
    expect(flights).toHaveLength(1);
  });

  it("keeps a camera move the user made while the hull was being built", async () => {
    pg.frame.frameStep(pg.step("2a"));
    pg.view.moves++; // what the scene's orbit controls record when the user drags, zooms or pinches
    await settle();
    expect(flights).toHaveLength(1);
  });

  it("keeps another camera request made meanwhile (tap to locate, a system view)", async () => {
    pg.frame.frameStep(pg.step("2a"));
    pg.useView.getState().flyTo([1, 2, 3], [0, 0, 0]);
    await settle();
    expect(flights).toEqual([pg.step("2a").station.cam, { p: [1, 2, 3], t: [0, 0, 0] }]);
  });
});
