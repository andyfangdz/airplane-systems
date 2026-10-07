/**
 * DA40 XLS electrical system (AMM-E Fig. 2-3, GFC 700 configuration; AFM §7, G1000/GFC 700 AFMS 190-00492-10) and the
 * G1000 annunciations (`aircraft/da40/model.ts`). Battery → BATT 70 A → ESSENTIAL; alternator → ALT 70 A → MAIN; the two
 * are joined by the tie relay (opened by ESS. BUS ON) and a MAIN → ESS bypass diode; MAIN → AV BUSS → MAIN AVIONICS.
 *
 * Whether the alternator is excited (it can only come on line while MAIN is live from the battery, then keeps its own
 * field) comes from the previous solution, as the store passes it; `E()` solves after the initial state, alternator on line.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { annunciations, initialSim, live, solve, type Sim } from "@/aircraft/da40/model";
import { patched, type Patch } from "./helpers";

const sim = (p: Patch<Sim> = {}) => patched(initialSim, p);
const E0 = solve(initialSim);
const E = (p: Patch<Sim> = {}) => solve(sim(p), E0);
const ann = (p: Patch<Sim> = {}) => annunciations(sim(p), E(p)).map(([, t]) => t);
const ALT_FAIL: Patch<Sim> = { elec: { fail: { alt: true } } };

const live0 = structuredClone(live);
beforeEach(() => void Object.assign(live, structuredClone(live0)));

describe("DA40 electrical solve", () => {
  it("normal: alternator on line, all three buses at the regulated 28 V, battery charging, no annunciations", () => {
    const e = E();
    expect(e.altOn && e.altFeed && e.tieClosed && e.batCharging).toBe(true);
    expect([e.ess, e.main, e.av]).toEqual([28, 28, 28]);
    expect(e.batLoad).toBe(0);
    expect(ann()).toEqual([]);
  });

  it("an alternator already on line keeps its own field through MAIN with the BAT switch off", () => {
    const e = E({ elec: { bat: false } });
    expect(e.altOn && e.essAlt).toBe(true);
    expect(e.ess).toBeGreaterThan(0);
  });

  it("a stopped alternator cannot come on line without the battery: its field is fed from MAIN", () => {
    const off = solve(sim({ eng: { running: false }, elec: { bat: false } }), E0); // shut down: the field collapses
    expect(solve(sim({ elec: { bat: false } }), off).altOn).toBe(false); // restarted (e.g. hand-propped) with BAT off
    expect(solve(sim(), off).altOn).toBe(true); // BAT on: MAIN is live, the field is excited
  });

  it("is pure: the same state and previous solution always give the same result", () => {
    const s = sim({ elec: { bat: false } });
    const before = solve(s, E0);
    solve(sim({ eng: { running: false }, elec: { bat: false } }), E0); // an unrelated solve in between
    expect(solve(s, E0)).toEqual(before);
  });

  it("alternator failure: ALTERNATOR warning, the battery carries ESSENTIAL and MAIN through the tie relay", () => {
    const e = E(ALT_FAIL);
    expect(e.altOn).toBe(false);
    expect(e.amps).toBe(0);
    expect(e.ess).toBeGreaterThan(24);
    expect(e.main).toBe(e.ess);
    expect(e.batLoad).toBeGreaterThan(0);
    expect(ann(ALT_FAIL)).toContain("ALTERNATOR");
  });

  it("on battery the voltage falls with time: LOW VOLTS below 24 V, then the flat battery drops every bus", () => {
    const at = (tBat: number) => ({ ...ALT_FAIL, elec: { ...ALT_FAIL.elec, tBat } });
    const endurance = E(ALT_FAIL).endurance;
    expect(E(at(endurance * 0.2)).volts).toBeGreaterThan(24);
    expect(ann(at(endurance * 0.6))).toContain("LOW VOLTS");
    const flat = E(at(endurance + 1));
    expect(flat.batDead).toBe(true);
    expect([flat.ess, flat.main, flat.av]).toEqual([0, 0, 0]);
  });

  it("ESS. BUS ON opens the tie relay: on battery only ESSENTIAL stays up, so the battery lasts longer", () => {
    const shed: Patch<Sim> = { elec: { fail: { alt: true }, essBus: true } };
    const e = E(shed);
    expect(e.tieClosed).toBe(false);
    expect(e.ess).toBeGreaterThan(0);
    expect(e.main + e.av).toBe(0);
    expect(e.pfd && e.com1 && e.gia1).toBe(true);
    expect(e.mfd || e.com2).toBe(false);
    expect(e.endurance).toBeGreaterThan(E(ALT_FAIL).endurance);
  });

  it("ESS. BUS ON with a working alternator: ESSENTIAL is still fed from MAIN through the bypass diode", () => {
    const e = E({ elec: { essBus: true } });
    expect(e.tieClosed).toBe(false);
    expect(e.essAlt).toBe(true);
    expect(e.ess).toBeGreaterThan(0);
    expect(e.ess).toBeLessThan(e.main); // one diode drop
  });

  it("the tie relay needs MSTR CNTRL power to open", () => {
    expect(E({ elec: { essBus: true }, cb: { "MSTR CNTRL": true } }).tieClosed).toBe(true);
  });

  it("AVIONIC MASTER switches MAIN AVIONICS: GPS/NAV 2, COM 2 and the AFCS go, essential-bus equipment stays", () => {
    const e = E({ elec: { avMaster: false } });
    expect(e.av).toBe(0);
    expect(e.gia2 || e.com2 || e.afcsPwr).toBe(false);
    expect(e.pfd && e.mfd && e.gia1 && e.com1).toBe(true);
  });

  it("AFMS smoke procedure (BATT and ESS TIE pulled) leaves ESSENTIAL dead but restores MAIN and avionics (AFMS p. 30)", () => {
    const e = E({ cb: { BATT: true, "ESS TIE": true } });
    expect(e.ess).toBe(0);
    expect(e.main).toBeGreaterThan(0);
    expect(e.av).toBeGreaterThan(0);
    expect(e.pfd).toBe(false);
    expect(e.mfd).toBe(true);
  });

  it("HORIZON EMERGENCY: the emergency battery runs the standby attitude with everything else dead, for 1 h 30 min (AFM 7.11)", () => {
    const dark: Patch<Sim> = { eng: { running: false }, elec: { bat: false, alt: false } };
    expect(E(dark).stbyAtt).toBe(false);
    expect(E({ ...dark, elec: { ...dark.elec, emerg: true } })).toMatchObject({
      stbyAtt: true,
      floodPwr: true,
      ess: 0,
    });
    expect(E({ ...dark, elec: { ...dark.elec, emerg: true, tBat: 91 } }).stbyAtt).toBe(false);
  });

  it("external power feeds the relay-box bus bar: buses live with the BAT switch off and the engine stopped", () => {
    const e = E({ eng: { running: false }, elec: { bat: false, alt: false, ext: true } });
    expect(e.ess).toBe(28);
    expect(e.main).toBe(28);
    expect(e.batCharging).toBe(false);
  });
});

describe("DA40 annunciations", () => {
  it("DOOR OPEN with the canopy in the cooling gap; PITOT OFF caution with the heat switched off", () => {
    expect(ann({ doors: { canopy: "GAP" } })).toContain("DOOR OPEN");
    expect(ann({ pitot: { heat: false } })).toContain("PITOT OFF");
    expect(ann({ cb: { PITOT: true } })).toContain("PITOT FAIL");
  });

  it("engine warnings come from the GEA 71 sensors: none with the ENG INST breaker out", () => {
    live.oilP = 20;
    expect(ann()).toContain("OIL PRES LO");
    expect(ann({ cb: { "ENG INST": true } })).not.toContain("OIL PRES LO");
  });

  it("L / R FUEL LOW cautions below 3 gal", () => {
    expect(annunciations(sim({ fuel: { qL: 2 } }), E())).toContainEqual(["c", "L FUEL LOW"]);
  });

  it("fan advisories when the CDU FAN / AV FAN breakers are out", () => {
    expect(ann({ cb: { "CDU FAN": true } })).toEqual(expect.arrayContaining(["PFD FAN FAIL", "MFD FAN FAIL"]));
    expect(ann({ cb: { "AV FAN": true } })).toContain("GIA FAN FAIL");
  });
});
