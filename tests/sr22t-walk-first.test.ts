/**
 * The parts a progressive build adds first for the walk-around (walkFirst, used by the SR22T's build priority): before the
 * walk begins, every part of its starting station's items for the equipment fitted, and none of an item that isn't. With
 * FIKI fitted, station 1's stall warning items use the lift transducer instead of the pneumatic inlet.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@/aircraft";
import { initialSim } from "@/aircraft/sr22t/model";
import { useSR22T } from "@/aircraft/sr22t/store";
import { walkSteps } from "@/aircraft/sr22t/walk";
import { closeWalk, openWalk, walkFirst } from "@/aircraft/sr22t/walk-store";
import { useView } from "@/lib/view";
import { patched } from "./helpers";

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
