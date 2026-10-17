/**
 * The parts a progressive build adds first for the walk-around (walkFirst, used by the SR22T's build priority): before the
 * walk begins, every part of its starting station's items for the equipment fitted, and none of an item that isn't. With
 * FIKI fitted, station 1's stall warning items use the lift transducer instead of the pneumatic inlet. Resuming saved
 * progress builds the saved item's station first, not station 1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/aircraft";
import { initialSim } from "@/aircraft/sr22t/model";
import { useSR22T } from "@/aircraft/sr22t/store";
import { walk } from "@/aircraft/sr22t/walk";
import { walkController, walkFirst } from "@/aircraft/sr22t/walk-store";
import { useView } from "@/lib/view";
import { patched } from "./helpers";
import { type FleetWalkProgress as Progress } from "@/lib/fleet-walk";
const { saveProgress, walkSteps } = walk;
const {
  begin: beginWalk,
  close: closeWalk,
  open: openWalk,
  reset: resetWalk,
  resume: resumeWalk,
  session: walkNow,
} = walkController;
const useWalk = walkController.store;

const INLET = "Stall warning inlet",
  TRANSDUCER = "Stall warning lift transducer";

/** The airplane with or without FIKI, as the walk-around finds it. */
function fitted(fiki: boolean) {
  const s = patched(initialSim, { equip: { fiki } });
  useSR22T.setState({ s, E: useSR22T.getState().E });
  useSR22T.getState().update(() => {});
  return s;
}

beforeEach(() => {
  useView.setState({ ac: "sr22t", sys: "overview", walking: false, spot: null });
});
afterEach(() => closeWalk());

describe("walk-around parts built first", () => {
  for (const fiki of [true, false])
    it(`are station 1's items' parts for the equipment fitted (FIKI ${fiki ? "fitted" : "not fitted"})`, () => {
      const s = fitted(fiki);
      openWalk(1);
      const active = walkSteps(s)
        .filter((x) => x.station.n === 1)
        .flatMap((x) => x.item.parts);
      expect([...walkFirst()].sort()).toEqual([...new Set(active)].sort());
      expect(walkFirst().has(fiki ? TRANSDUCER : INLET)).toBe(true);
      expect(walkFirst().has(fiki ? INLET : TRANSDUCER)).toBe(false);
    });

  it("are the shown item's parts once the walk shows one, and none once it is closed", () => {
    fitted(true);
    openWalk(1);
    useView.setState({ spot: { names: [TRANSDUCER], side: 0 } }); // what the walk-around panel sets for 1o
    expect([...walkFirst()]).toEqual([TRANSDUCER]);
    closeWalk();
    expect(walkFirst().size).toBe(0);
  });
});

/** Station n's parts for the airplane's configured walk steps. */
const stationParts = (s: ReturnType<typeof fitted>, n: number) =>
  [
    ...new Set(
      walkSteps(s)
        .filter((x) => x.station.n === n)
        .flatMap((x) => x.item.parts),
    ),
  ].sort();
const progress = (at: string, done = false): Progress => ({ v: 1, at, marks: { "1a": "ok" }, ms: 60_000, done });

describe("walk-around parts built first, with saved progress", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    closeWalk();
    vi.unstubAllGlobals();
  });

  it("are the saved station's parts while it offers to resume, and the walk resumes at the saved item", () => {
    const s = fitted(true);
    saveProgress(progress("9c"));
    openWalk();
    expect(useWalk.getState().phase).toBe("resume");
    expect([...walkFirst()].sort()).toEqual(stationParts(s, 9));
    expect(walkFirst().has("Required documents")).toBe(false); // station 1 only
    resumeWalk();
    expect(walkNow().steps[useWalk.getState().at].item.id).toBe("9c");
  });

  it("are station 1's again after Start over, and a fresh walk begins at station 1", () => {
    const s = fitted(true);
    saveProgress(progress("9c"));
    openWalk();
    resetWalk();
    expect([...walkFirst()].sort()).toEqual(stationParts(s, 1));
    beginWalk();
    expect(walkNow().steps[useWalk.getState().at].station.n).toBe(1);
  });

  it("are station 1's for a finished walk or a saved item the equipment fitted doesn't have", () => {
    const s = fitted(false);
    saveProgress(progress("9c", true));
    openWalk();
    expect(useWalk.getState().phase).toBe("intro");
    expect([...walkFirst()].sort()).toEqual(stationParts(s, 1));
    closeWalk();
    saveProgress(progress("no-such-item"));
    openWalk();
    expect(useWalk.getState().phase).toBe("intro");
    expect([...walkFirst()].sort()).toEqual(stationParts(s, 1));
  });

  it("are the deep-linked station's, not the saved one's (?walk=n)", () => {
    const s = fitted(true);
    saveProgress(progress("9c"));
    openWalk(5);
    expect(useWalk.getState().phase).toBe("intro");
    expect([...walkFirst()].sort()).toEqual(stationParts(s, 5));
  });
});
