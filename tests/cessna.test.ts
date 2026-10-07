/**
 * Cessna NAV III (G1000) electrical system shared by the 172S and 182T (POH §7, Figure 7-7; `aircraft/cessna/electrical.ts`)
 * and each airplane's `solve` / `annunciations`. Thresholds from the POH: 28.0 V regulated, LOW VOLTS below 24.5 V,
 * HIGH VOLTS above 32.0 V, ACU over-voltage trip, standby battery takes the essential bus when M BUS is below 20 V.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FEEDER, nav3Init, solveNav3, stepNav3Soc, type Nav3Elec } from "@/aircraft/cessna/electrical";
import * as c172 from "@/aircraft/c172s/model";
import * as c182 from "@/aircraft/c182t/model";
import { patched, type Patch } from "./helpers";

type Sim172 = c172.Sim;
const sim = (p: Patch<Sim172> = {}) => patched(c172.initialSim, p);
const E = (p: Patch<Sim172> = {}, prev?: c172.Elec) => c172.solve(sim(p), prev);
const ann = (p: Patch<Sim172> = {}) => c172.annunciations(sim(p), E(p));
/** The network alone, with the 172S breakers and loads, at a given RPM. */
const nav3 = (e: Patch<Nav3Elec>, rpm = 2400, wasOn = false) =>
  solveNav3(patched(nav3Init(), e), c172.ELEC_CFG, c172.breakerLoads(c172.initialSim), rpm, wasOn);

const MASTER_OFF: Patch<Nav3Elec> = { bat: false, alt: false, avn1: false, avn2: false, stby: "OFF" };
const ALT_FAIL: Patch<Sim172> = { elec: { fail: { alt: true } } };
const OV: Patch<Sim172> = { elec: { fail: { ov: true } } };

const live172 = structuredClone(c172.live),
  live182 = structuredClone(c182.live);
beforeEach(() => {
  Object.assign(c172.live, structuredClone(live172));
  Object.assign(c182.live, structuredClone(live182));
});

describe("NAV III electrical network (solveNav3)", () => {
  it("master and standby battery off: every bus dead, nothing on line", () => {
    const N = nav3(MASTER_OFF, 0);
    expect(Object.values(N.v).every((v) => v === 0)).toBe(true);
    expect(N.altOn || N.stbyOnline).toBe(false);
  });

  it("normal: alternator regulates 28.0 V, the battery takes a charge, no voltage alert", () => {
    const N = nav3({});
    expect(N.altOn).toBe(true);
    expect(N.node).toBe(28);
    expect(N.v.E1 && N.v.E2 && N.v.ESS && N.v.AV1 && N.v.AV2).toBeGreaterThan(24.5);
    expect(N.mBatt).toBeGreaterThanOrEqual(0);
    expect(N.lowVolts || N.highVolts || N.acuTrip).toBe(false);
  });

  it("master on with the engine stopped: the battery sags under load and shows LOW VOLTS (POH 4-6)", () => {
    const N = nav3({}, 0);
    expect(N.altOn).toBe(false);
    expect(N.lowVolts).toBe(true);
    expect(N.mBatt).toBeLessThan(0);
  });

  it("at low RPM the alternator cannot carry the load, so LOW VOLTS comes on (POH 3-19)", () => {
    expect(nav3({}, 600).altOn).toBe(false);
    expect(nav3({}, 600).lowVolts).toBe(true);
  });

  it("standby battery: with M BUS below 20 V it takes the essential bus only (POH 3-17)", () => {
    const N = nav3({ socMain: 0, fail: { alt: true } });
    expect(N.stbyOnline).toBe(true);
    expect(N.v.ESS).toBeGreaterThan(20);
    expect(N.v.E1 + N.v.E2 + N.v.AV1 + N.v.AV2).toBe(0);
    expect(N.sBatt).toBeLessThan(0);
    expect(N.lowVolts).toBe(true); // the PFD on the standby battery still shows LOW VOLTS
    // a healthy main battery holds the bus above 20 V: the standby battery stays off line
    expect(nav3({ fail: { alt: true } }).stbyOnline).toBe(false);
    // and with STBY BATT OFF nothing takes over
    expect(nav3({ socMain: 0, stby: "OFF", fail: { alt: true } }).v.ESS).toBe(0);
  });

  it("feeder A out: BUS 2 and AVIONICS BUS 2 dead, the essential bus stays up through the BUS 1 diode", () => {
    const N = nav3({ cb: { [FEEDER.E2]: true } });
    expect(N.v.E2 + N.v.AV2).toBe(0);
    expect(N.v.ESS).toBeGreaterThan(24.5);
  });

  it("a failed main battery: the alternator self-excites above 1,500 RPM, and once on line holds at idle", () => {
    expect(nav3({ fail: { bat: true } }, 2400).altOn).toBe(true);
    expect(nav3({ fail: { bat: true } }, 1000).altOn).toBe(false);
    expect(nav3({ fail: { bat: true } }, 1000, true).altOn).toBe(true);
  });

  it("STBY BATT TEST lamp stays lit only for a healthy standby battery", () => {
    expect(nav3({ ...MASTER_OFF, stby: "TEST" }, 0).testLamp).toBe(true);
    expect(nav3({ ...MASTER_OFF, stby: "TEST", fail: { stby: true } }, 0).testLamp).toBe(false);
  });
});

describe("stepNav3Soc", () => {
  const e = nav3Init({ socMain: 0.5, socStby: 0.5 });
  it("discharging lowers the state of charge, charging raises it, and both stay within 0..1", () => {
    expect(stepNav3Soc(e, c172.ELEC_CFG, { mBatt: -10, sBatt: -1 }, 10).socMain).toBeLessThan(0.5);
    expect(stepNav3Soc(e, c172.ELEC_CFG, { mBatt: 5, sBatt: 0 }, 10).socMain).toBeGreaterThan(0.5);
    expect(stepNav3Soc(e, c172.ELEC_CFG, { mBatt: -100, sBatt: -100 }, 600)).toEqual({ socMain: 0, socStby: 0 });
  });

  it("a weak / cold standby battery runs down faster", () => {
    const weak = { ...e, fail: { ...e.fail, stby: true } };
    const drop = (x: Nav3Elec) => 0.5 - stepNav3Soc(x, c172.ELEC_CFG, { mBatt: 0, sBatt: -2 }, 5).socStby;
    expect(drop(weak)).toBeGreaterThan(drop(e));
  });
});

describe("C172S solve and annunciations", () => {
  it("alternator failure: LOW VOLTS warning and the main battery discharging", () => {
    expect(E(ALT_FAIL).mBatt).toBeLessThan(0);
    expect(ann(ALT_FAIL)).toContainEqual(["w", "LOW VOLTS"]);
  });

  it("over-voltage: the ACU trips; with its sensor failed, HIGH VOLTS instead (POH 7-56)", () => {
    expect(E(OV).acuTrip).toBe(true);
    const failed: Patch<Sim172> = { elec: { fail: { ov: true, ovSense: true } } };
    expect(E(failed).acuTrip).toBe(false);
    expect(ann(failed)).toContainEqual(["w", "HIGH VOLTS"]);
    // the trip opens ALT FIELD (tick.ts): alternator off line, no HIGH VOLTS
    const tripped = E({ elec: { fail: { ov: true }, cb: { "XF:ALT FIELD": true } } });
    expect(tripped.altOn || tripped.highVolts).toBe(false);
  });

  it("AVIONICS BUS 1 / BUS 2 switches: the PFD stays on the essential bus, the MFD goes with BUS 2", () => {
    expect(E({ elec: { avn2: false } })).toMatchObject({ mfd: false, pfd: true, xpdr: false, afcsPwr: false });
    expect(E({ elec: { avn1: false } })).toMatchObject({ pfd: true, mfd: true });
  });

  it("ground power with MASTER BAT on: buses live and the battery charging, engine stopped", () => {
    const e = E({ eng: { running: false, rpm: 0 }, elec: { ext: true, alt: false } });
    expect(e.node).toBe(28);
    expect(e.mBatt).toBeGreaterThan(0);
    expect(e.lowVolts).toBe(false);
    expect(e.starterPwr).toBe(true);
    // the ground power relay feeds the battery side of the battery relay: nothing without MASTER BAT
    expect(E({ eng: { running: false, rpm: 0 }, elec: { ext: true, bat: false, alt: false } }).node).toBe(0);
  });

  it("engine stopped: OIL PRESSURE and LOW VACUUM are shown, warnings first (POH 7-51)", () => {
    Object.assign(c172.live, { oilP: 0, vac: 0 });
    const a = ann({ eng: { running: false, rpm: 0 } });
    expect(a.map(([, t]) => t)).toEqual(expect.arrayContaining(["OIL PRESSURE", "LOW VOLTS", "LOW VACUUM"]));
    expect(a.findIndex(([l]) => l === "c")).toBeGreaterThan(a.findLastIndex(([l]) => l === "w"));
  });
});

describe("C182T solve and annunciations", () => {
  const s182 = (p: Patch<c182.Sim> = {}) => patched(c182.initialSim, p);
  const ann182 = (p: Patch<c182.Sim> = {}) => c182.annunciations(s182(p), c182.solve(s182(p))).map(([, t]) => t);

  it("normal cruise: alternator on line, no annunciations", () => {
    expect(c182.solve(s182()).altOn).toBe(true);
    expect(ann182()).toEqual([]);
  });

  it("the optional 95 A alternator carries more load at low RPM than the 60 A one", () => {
    const at = (altAmps: 60 | 95) => c182.solve(s182({ altAmps, eng: { rpm: 1000 }, pitot: { heat: true } })).altOn;
    expect([at(60), at(95)]).toEqual([false, true]);
  });

  it("KAP 140 pitch trim fault: red PITCH TRIM, powered through the WARN breaker (S3-6, S3-11)", () => {
    c182.live.kap = { ...c182.live.kap, fail: { trim: true } };
    expect(ann182()).toContain("PITCH TRIM");
    expect(ann182({ elec: { cb: { "XF:WARN": true } } })).not.toContain("PITCH TRIM");
  });

  it("alternator failure: LOW VOLTS", () => {
    expect(ann182({ elec: { fail: { alt: true } } })).toContain("LOW VOLTS");
  });
});
