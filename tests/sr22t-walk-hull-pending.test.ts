/**
 * The walk-around's item framing while the page's worker still builds the fuselage skin: it must not build the hull
 * a second time on the main thread, and once the worker's hull is in it frames each item exactly as a main-thread build.
 * Items 2a and 11a (first items of their stations) step back from the airplane, so they need its outline.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BufferGeometry } from "three";

type Walk = typeof import("@/aircraft/sr22t/walk");
const ITEMS = ["2a", "11a"];

/** A fresh module graph: the hull cache, the worker build and the clearance outline are all per page. */
async function page() {
  vi.resetModules();
  const [walk, parts, geometry, worker, walkaround, catalogue] = await Promise.all([
    import("@/aircraft/sr22t/walk"),
    import("@/aircraft/sr22t/parts"),
    import("@/aircraft/sr22t/geometry"),
    import("@/aircraft/sr22t/fuselage-geo"),
    import("@/aircraft/sr22t/walkaround"),
    import("@/lib/catalogue"),
  ]);
  const step = (id: string) => {
    const station = walkaround.WALK.find((s) => s.items.some((i) => i.id === id))!;
    return { station, item: station.items.find((i) => i.id === id)! };
  };
  const hull = parts.CAT.shells.find((s) => catalogue.factoryOf(s) === geometry.fuselageGeo)!;
  return { walk: walk as Walk, worker, step, hull, fuselageGeo: geometry.fuselageGeo, specGeo: catalogue.specGeo };
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

// reference values only (no page state): the poses a main-thread build gives (no worker), and the worker's reply
let expected: Record<string, unknown>;
let referenceReply: ReturnType<typeof message>;
beforeAll(async () => {
  const ref = await page();
  expected = Object.fromEntries(ITEMS.map((id) => [id, ref.walk.stepPose(ref.step(id))]));
  referenceReply = message(ref.fuselageGeo());
}, 60_000);

// each test: a fresh page whose worker (a stand-in posting the reference arrays) answers only when told
let pending: Awaited<ReturnType<typeof page>>;
let built: Promise<unknown>;
let answer: (data?: unknown) => void;
let reply: ReturnType<typeof message>;
let geo: ReturnType<typeof vi.spyOn>;
let stopped: boolean[];
beforeEach(async () => {
  pending = await page();
  reply = {
    ...referenceReply,
    attributes: referenceReply.attributes.map((a) => ({ ...a, array: a.array.slice() })),
  };
  stopped = [];
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror = null;
      private readonly me = stopped.push(false) - 1;
      constructor() {
        answer = (data = reply) => this.onmessage?.({ data });
      }
      terminate() {
        stopped[this.me] = true;
      }
    },
  );
  built = pending.worker.fuselageInWorker(); // the airplane's prepare, at boot
  geo = vi.spyOn(pending.hull, "geo");
}, 60_000);
afterEach(async () => {
  // a worker this test left unanswered: settle it (its fallback timer cleared, the stand-in terminated) before moving on
  if (stopped.includes(false)) {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answer({ error: "the test is over" });
    await built;
    warn.mockRestore();
  }
  geo.mockRestore();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("walk-around framing while the worker builds the fuselage", () => {
  it("keeps the station's view and never builds the hull on the main thread meanwhile", () => {
    const { walk, step } = pending;
    for (const id of ITEMS) {
      expect(walk.stepPose(step(id)), `${id} while the worker builds`).toEqual(step(id).station.cam);
      expect(expected[id], `${id}'s own framing differs from the station view`).not.toEqual(step(id).station.cam);
    }
    expect(geo).not.toHaveBeenCalled();
  });

  it("frames each item exactly as a main-thread build once the worker's hull is in, without building it again", async () => {
    const { walk, step } = pending;
    answer();
    await built;
    for (const id of ITEMS) expect(walk.stepPose(step(id)), `${id} once the hull is in`).toEqual(expected[id]);
    expect(geo).not.toHaveBeenCalled();
    // the scene's fuselage is the worker's geometry (its own arrays), not one built here; the worker is done
    const position = pending.specGeo(pending.hull).attributes.position.array;
    expect(position === reply.attributes.find((a) => a.name === "position")!.array).toBe(true);
    expect(stopped).toEqual([true]);
  });
});
