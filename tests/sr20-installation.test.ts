/** Independent expected relationships: SR20 POH 11934-005, Figures 7-10/7-11/7-17 and pp. 7-49–7-79. */
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/sr20/parts";
import {
  ELECTRICAL_INSTALLATION,
  ELECTRICAL_FACTS,
  BREAKERS,
  DISTRIBUTION_DIAGRAM,
  connectionPowered,
} from "@/aircraft/sr20/electrical-installation";
import {
  ELECTRICAL_AVIONICS_DEPTH_FLOWS as flows,
  electricalAvionicsDepthRates,
  OPTIONAL_ADAHRS2_FLOW_KEYS,
} from "@/aircraft/sr20/electrical-avionics-depth-flow";
import { initialSim, solve } from "@/aircraft/sr20/model";
import { walk } from "@/aircraft/sr20/walk";
import { patched } from "./helpers";

describe("SR20 installation projections", () => {
  it("gives the PFD independent 5 A ESS1 and MAIN2 inputs (POH 7-75)", () => {
    expect(BREAKERS.pfdA).toMatchObject({ label: "PFD A", bus: "ess1", rating: { value: 5, unit: "A" } });
    expect(BREAKERS.pfdB).toMatchObject({ label: "PFD B", bus: "main2", rating: { value: 5, unit: "A" } });
    const s = patched(initialSim, { cb: { "PFD A": true } }),
      E = solve(s);
    expect(E.pfd).toBe(true);
    expect(connectionPowered("pfdFeedA", E, s.cb)).toBe(false);
    expect(electricalAvionicsDepthRates(s, E).pfdFeedA).toBe(0);
    expect(electricalAvionicsDepthRates(s, E).pfdFeedB).toBe(1);
  });
  it("uses the installation ancestry for both the solver and the single-line diagram (POH 7-51)", () => {
    expect(DISTRIBUTION_DIAGRAM.mdb1).toEqual(["MAIN BUS 3", "A/C BUS 1", "A/C BUS 2"]);
    expect(DISTRIBUTION_DIAGRAM.mdb2).toEqual(["MAIN BUS 1", "MAIN BUS 2", "NON ESS BUS"]);
    const s = patched(initialSim, { elec: { bat1: false, alt1: false } }),
      E = solve(s);
    expect(E.main3).toBe(0);
    expect(E.main2).toBeGreaterThan(0);
  });
  it("retains the ALT2 fuse disagreement without changing the selected POH-text value", () => {
    expect(ELECTRICAL_FACTS.alt2Fuse.value).toBe(80);
    expect(ELECTRICAL_FACTS.alt2Fuse.alternatives?.map((a) => a.value)).toEqual([60, 60]);
    expect(ELECTRICAL_FACTS.alt2Fuse.decision).toBeTruthy();
  });
  it("resolves every bound mesh and flow to an installation entity", () => {
    const bound = CAT.parts.filter((p) => p.equipment);
    expect(bound.length).toBeGreaterThan(10);
    for (const part of bound) expect(ELECTRICAL_INSTALLATION.equipment[part.equipment!], part.id).toBeDefined();
    const connected = flows.filter((f) => f.connection);
    expect(connected.length).toBeGreaterThan(15);
    for (const flow of connected) expect(ELECTRICAL_INSTALLATION.connections[flow.connection!], flow.key).toBeDefined();
  });
  it("derives the complete second-ADAHRS data-path option from equipment endpoints", () => {
    expect([...OPTIONAL_ADAHRS2_FLOW_KEYS].sort()).toEqual(["adahrs2Gia1", "adahrs2Gia2", "adahrs2Mfd", "magData2"]);
  });
  it("binds the preflight PFD check to its identity, independent of its label", () => {
    const step = walk.stepOf("1d")!;
    expect(step.item.parts).toEqual(["sr20/avionics.pfd"]);
    expect(walk.stepSpot(step)).toEqual({ names: [], ids: ["sr20/avionics.pfd"], side: 0 });
    expect(walk.inCatalogue("sr20/avionics.pfd")).toBe(true);
  });
});
