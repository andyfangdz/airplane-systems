/**
 * The "Start from" scenarios on each airplane's General panel: after one runs, the store's solved electrical picture `E`
 * matches it, whichever scenario ran before. (The SR20 store has no such scenarios, only the CAPS demo.)
 */
import { describe, expect, it } from "vitest";
import * as c172 from "@/aircraft/c172s/store";
import * as c182 from "@/aircraft/c182t/store";
import * as da40 from "@/aircraft/da40/store";
import { live as live182 } from "@/aircraft/c182t/model";
import type { Nav3Solution } from "@/aircraft/cessna/electrical";

type NavE = Nav3Solution & { pfd: boolean; mfd: boolean };
type Scenario = "coldDark" | "runUp" | "cruise";
const ORDER: Scenario[] = ["coldDark", "runUp", "cruise"];

/** Run `to` after `from`, so a scenario is checked from every starting point. */
const pairs = <K extends string>(keys: K[]) => keys.flatMap((from) => keys.map((to) => [from, to] as const));

const cessnas = [
  ["C172S", c172.useC172, { coldDark: c172.scenarioColdDark, runUp: c172.scenarioRunUp, cruise: c172.scenarioCruise }],
  ["C182T", c182.useC182, { coldDark: c182.scenarioColdDark, runUp: c182.scenarioRunUp, cruise: c182.scenarioCruise }],
] as const;

describe.each(cessnas)("%s", (_, store, run) => {
  const E = () => store.getState().E as NavE;
  const s = () => store.getState().s;

  it.each(pairs(ORDER))("%s → %s leaves the electrical system as the scenario describes", (from, to) => {
    run[from]();
    run[to]();
    if (to === "coldDark") {
      // everything off, STBY BATT off: not a single bus powered (POH 4-11 / 4-13 "before starting engine")
      expect(s().eng.running).toBe(false);
      expect(Object.values(E().v).every((v) => v === 0)).toBe(true);
      expect(E().altOn || E().stbyOnline || E().pfd || E().mfd).toBe(false);
    } else {
      // after the start checklist: alternator on line, both displays powered, no voltage alert
      expect(s().eng.running).toBe(true);
      expect(s().ground).toBe(to === "runUp");
      expect(E().altOn).toBe(true);
      expect(E().node).toBeGreaterThan(24.5);
      expect(E().mBatt).toBeGreaterThanOrEqual(0);
      expect(E().pfd && E().mfd).toBe(true);
      expect(E().lowVolts || E().highVolts).toBe(false);
    }
  });
});

describe("C182T scenarios and the KAP 140", () => {
  it("run-up power-cycles the KAP 140 so it runs its preflight test; cruise leaves it tested and disengaged", () => {
    c182.scenarioCruise();
    c182.scenarioRunUp();
    expect(live182.kap.powered).toBe(false); // the next tick powers it up into PFT
    c182.scenarioCruise();
    expect(live182.kap).toMatchObject({ powered: true, ready: true, ap: false });
  });
});

describe("DA40", () => {
  const E = () => da40.useDA40.getState().E;
  const run = { ramp: da40.scenarioRamp, cruise: da40.scenarioCruise };

  it.each(pairs(["ramp", "cruise"] as const))(
    "%s → %s leaves the electrical system as the scenario describes",
    (from, to) => {
      run[from]();
      run[to]();
      if (to === "ramp") {
        // cold and dark (AFMS p. 37-38): master, avionics master and ESS BUS off
        expect([E().ess, E().main, E().av]).toEqual([0, 0, 0]);
        expect(E().altOn || E().pfd || E().mfd).toBe(false);
      } else {
        expect(E().altOn).toBe(true);
        expect([E().ess, E().main, E().av]).toEqual([28, 28, 28]);
        expect(E().pfd && E().mfd && E().afcsPwr).toBe(true);
      }
    },
  );
});
