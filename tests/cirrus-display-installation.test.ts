/** Independent POH expectations: SR20 11934-005 Fig 7-11; SR22T 13772-007 Fig 7-11 / 7-74 / 7-95. */
import { describe, expect, it } from "vitest";
import { displayBreakers } from "@/aircraft/cirrus/display-feeds";
import { quantity } from "@/lib/installation";
import { BREAKERS as SR20 } from "@/aircraft/sr20/electrical-installation";
import { DISPLAY_BREAKERS as SR22T, DISPLAY_INSTALLATION } from "@/aircraft/sr22t/electrical-installation";
import { initialSim, solve, busTable } from "@/aircraft/sr22t/model";
import { AVIONICS_DEPTH_FLOWS, avionicsDepthRates } from "@/aircraft/sr22t/avionics-depth-flow";
import { patched } from "./helpers";

describe("matched Cirrus G6 display circuits", () => {
  it("retains two independent 5 A inputs per display with installation-owned provenance", () => {
    const expected = {
      pfdA: "ess1",
      pfdB: "main2",
      mfdA: "main3",
      mfdB: "main1",
      standbyA: "ess1",
      standbyB: "main1",
    } as const;
    for (const [id, bus] of Object.entries(expected)) {
      for (const breakers of [SR20, SR22T])
        expect(breakers[id as keyof typeof expected]).toMatchObject({ bus, rating: { value: 5, unit: "A" } });
    }
    expect(SR20.pfdA.rating.source.locator).not.toBe(SR22T.pfdA.rating.source.locator);
    expect(DISPLAY_INSTALLATION.documents.poh.title).toBe("SR22T POH 13772-007");
    expect(DISPLAY_INSTALLATION.connectionIds).toHaveLength(6);
  });
  it("keeps SR22T PFD operating on one feed while the pulled feed's visual path stops", () => {
    const s = patched(initialSim, { cb: { "PFD A": true } });
    const e = solve(s);
    expect(e.pfd).toBe(true);
    expect(avionicsDepthRates(s, e)).toMatchObject({ pfdFeedA: 0, pfdFeedB: 1 });
    expect(solve(patched(s, { cb: { "PFD B": true } })).pfd).toBe(false);
    const rows = busTable(s.equip).flatMap(([bus, , , rows]) => rows.map(([label, amps]) => ({ bus, label, amps })));
    expect(rows).toContainEqual({ bus: "main2", label: "PFD B", amps: 5 });
    for (const flow of AVIONICS_DEPTH_FLOWS.filter((flow) => flow.connection))
      expect(DISPLAY_INSTALLATION.connections[flow.connection!]).toBeDefined();
  });
  it("does not overwrite a documented installation rating with a family default", () => {
    const selected = quantity(7.5, "A", { document: "supplement", locator: "test fixture" });
    const breakers = displayBreakers({ document: "base", locator: "test fixture" }, { pfdA: selected });
    expect(breakers.pfdA.rating).toBe(selected);
    expect(breakers.pfdB.rating.value).toBe(5);
  });
});
