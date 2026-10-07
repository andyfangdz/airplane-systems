/**
 * SR20 G6 electrical system (POH 7-49 – 7-53, Figure 7-10) and its CAS / lighting logic (`aircraft/sr20/model.ts`).
 * Two alternators and two batteries feed diode-ORed distribution buses in the MCU; the CB-panel buses hang off those.
 */
import { describe, expect, it } from "vitest";
import { cabinLit, casMessages, extLit, initialSim, solve, type Sim } from "@/aircraft/sr20/model";
import * as THREE from "three";
import { AB, FUSE, FW, WIN } from "@/aircraft/sr20/geometry";
import { HARNESS, fwdStrap } from "@/aircraft/sr20/parts/caps";
import { patched, type Patch } from "./helpers";

const sim = (p: Patch<Sim> = {}) => patched(initialSim, p);
const E = (p: Patch<Sim> = {}) => solve(sim(p));
const cas = (p: Patch<Sim> = {}) => casMessages(sim(p), E(p));
const texts = (p: Patch<Sim> = {}) => cas(p).map(([, t]) => t);
const lights = (p: Patch<Sim>) => ({ ext: extLit(sim(p), E(p)), cabin: cabinLit(sim(p), E(p)) });

const ALT1_FAIL: Patch<Sim> = { elec: { fail: { alt1: true } } };
const DUAL_ALT_FAIL = (tBat: number): Patch<Sim> => ({ elec: { fail: { alt1: true, alt2: true }, tBat } });

describe("SR20 electrical solve", () => {
  it("normal: both alternators on line, every bus powered, both batteries charging, no CAS", () => {
    const e = E();
    expect(e.alt1 && e.alt2).toBe(true);
    const buses = ["mdb1", "mdb2", "edb", "ess1", "ess2", "main1", "main2", "main3", "nonEss", "avx"] as const;
    for (const bus of buses) expect(e[bus], bus).toBeGreaterThan(24.5);
    expect(e.conv).toBeGreaterThan(0);
    expect(e.bat1Charging && e.bat2Charging).toBe(true);
    expect(e.pfd && e.mfd && e.stby).toBe(true);
    expect(cas()).toEqual([]);
  });

  it("ALT 1's field needs BAT 1 on; ALT 2 keeps MDB 2 and the essential buses up", () => {
    const p: Patch<Sim> = { elec: { bat1: false } },
      e = E(p);
    expect(e.alt1).toBe(false);
    expect(e.alt2).toBe(true);
    expect(e.mdb1).toBe(0);
    expect(e.ess1).toBeGreaterThan(24.5);
    // the MFD is dual-fed: MFD A on MAIN BUS 3 (MDB 1) is dead, MFD B on MAIN BUS 1 (MDB 2) keeps it lit
    expect(e.main3).toBe(0);
    expect(e.mfd).toBe(true);
    expect(cas(p)).toEqual(
      expect.arrayContaining([
        ["c", "M BUS 1"],
        ["c", "ALT 1"],
      ]),
    );
  });

  it("diodes pass MDB 1 → MDB 2 only: ALT 2 never back-feeds MDB 1", () => {
    const e = E(ALT1_FAIL);
    expect(e.mdb1).toBeGreaterThan(0); // BAT 1 alone
    expect(e.mdb2).toBeGreaterThan(e.mdb1); // ALT 2, not pulled down to battery voltage
    expect(e.b1).toBeLessThan(0); // BAT 1 discharging
    expect(texts(ALT1_FAIL)).toEqual(expect.arrayContaining(["ALT 1", "M BUS 1"]));
    // ALT 2 failed instead: MDB 2 is fed from MDB 1 through the diode (one diode drop lower)
    const e2 = E({ elec: { fail: { alt2: true } } });
    expect(e2.mdb2).toBeGreaterThan(0);
    expect(e2.mdb2).toBeLessThan(e2.mdb1);
  });

  it("ALT 1 failure: BAT 1 carries MDB 1 for about 30 min (training-deck rule of thumb)", () => {
    const at = (tBat: number) => E({ elec: { fail: { alt1: true }, tBat } });
    expect(at(29).bat1ok).toBe(true);
    expect(at(30).bat1Dead).toBe(true);
    expect(at(30).mdb1).toBe(0);
    expect(at(30).conv).toBe(0); // the convenience bus hangs straight off BAT 1
    expect(at(30).ess1).toBeGreaterThan(24.5); // ALT 2 still carries the essential buses
  });

  it("dual alternator failure: BAT 1 lasts ~15 min, then BAT 2 alone keeps ESS BUS 1 and 2 alive until ~60 min", () => {
    expect(E(DUAL_ALT_FAIL(14)).bat1ok).toBe(true);
    const e = E(DUAL_ALT_FAIL(20));
    expect(e.bat1Dead).toBe(true);
    expect(e.mdb1 + e.mdb2).toBe(0);
    // BAT 2 joins ESS BUS 1 and back-feeds the Ess Dist Bus and ESS BUS 2 through ESSENTIAL POWER (POH 7-52)
    expect(e.ess1).toBeGreaterThan(0);
    expect(e.ess2).toBeGreaterThan(0);
    expect(e.bat2Supplying).toBe(true);
    expect(e.pfd && e.stby && e.stallPwr && e.eisPwr).toBe(true);
    expect(e.mfd).toBe(false);
    expect(texts(DUAL_ALT_FAIL(20))).toEqual(
      expect.arrayContaining(["ESS BUS", "M BUS 1", "M BUS 2", "ALT 1", "ALT 2"]),
    );
    const dead = E(DUAL_ALT_FAIL(60));
    expect(dead.bat2Dead).toBe(true);
    expect(dead.ess1 + dead.ess2 + dead.edb).toBe(0);
    expect(dead.pfd).toBe(false);
  });

  it("battery time keeps counting with the engine stopped: stopping it does not revive a flat BAT 1", () => {
    expect(E({ eng: { running: false }, elec: { tBat: 15 } }).bat1Dead).toBe(true);
  });

  it("with ESSENTIAL POWER pulled, BAT 2 still feeds ESS BUS 1 but no longer ESS BUS 2", () => {
    const e = E({ ...DUAL_ALT_FAIL(20), cb: { "ESSENTIAL POWER": true } });
    expect(e.ess1).toBeGreaterThan(0);
    expect(e.ess2).toBe(0);
    expect(e.stallPwr).toBe(false);
  });

  it("pulled breakers remove individual loads; dual-fed units need both breakers out", () => {
    expect(E({ cb: { "PFD A": true } }).pfd).toBe(true);
    expect(E({ cb: { "PFD A": true, "PFD B": true } }).pfd).toBe(false);
    expect(E({ cb: { FLAPS: true } }).flapsPwr).toBe(false);
    expect(E({ cb: { AVIONICS: true } }).avx).toBe(0);
    expect(E({ cb: { "ALT 1": true } }).alt1).toBe(false);
  });
});

describe("SR20 CAS messages", () => {
  it("AVIONICS OFF when the AVIONICS switch is off (POH 3A-14), and the avionics bus drops", () => {
    expect(E({ elec: { avionics: false } }).avx).toBe(0);
    expect(cas({ elec: { avionics: false } })).toContainEqual(["c", "AVIONICS OFF"]);
  });

  it("PFD FAN FAIL / MFD FAN FAIL advisories when a lit display's cooling fan loses power (POH 3A-15)", () => {
    expect(cas({ cb: { "AVIONICS FAN 2": true } })).toContainEqual(["a", "PFD FAN FAIL"]);
    expect(cas({ cb: { "AVIONICS FAN 1": true } })).toContainEqual(["a", "MFD FAN FAIL"]);
  });

  it("FUEL LOW LEFT below 1 gal; FUEL LOW TOTAL caution at 10 gal or less, warning below 7 (POH 3-24, 3-25, 3A-10)", () => {
    expect(cas({ fuel: { qL: 0.5 } })).toContainEqual(["w", "FUEL LOW LEFT"]);
    expect(cas({ fuel: { qL: 5, qR: 5 } })).toContainEqual(["c", "FUEL LOW TOTAL"]);
    expect(cas({ fuel: { qL: 3, qR: 3 } })).toContainEqual(["w", "FUEL LOW TOTAL"]);
  });

  it("FUEL IMBALANCE advisory above 5.5, caution above 7.5, warning above 9.5 gal (POH 3-25, 3A-10, 3A-11)", () => {
    const level = (diff: number) =>
      cas({ fuel: { qL: 15 + diff, qR: 15 } }).find(([, t]) => t === "FUEL IMBALANCE")?.[0];
    expect(level(5)).toBeUndefined();
    expect(level(6)).toBe("a");
    expect(level(8)).toBe("c");
    expect(level(10)).toBe("w");
  });

  it("STALL needs the stall-warning breaker; PITOT HEAT FAIL / REQD follow the heater and the switch", () => {
    expect(texts({ stall: { aoa: 15 } })).toContain("STALL");
    expect(texts({ stall: { aoa: 15 }, cb: { "STALL WARNING": true } })).not.toContain("STALL");
    expect(texts({ pitot: { heaterFail: true } })).toContain("PITOT HEAT FAIL");
    expect(texts({ pitot: { heat: false, oat: 2 } })).toContain("PITOT HEAT REQD");
  });
});

describe("SR20 lights", () => {
  it("exterior lights need both the bolster switch and bus / breaker power", () => {
    expect(lights({}).ext).toMatchObject({ nav: true, strobe: true, land: false });
    expect(lights({ cb: { "NAV LIGHTS": true } }).ext.nav).toBe(false);
    expect(lights({ lights: { land: true } }).ext.land).toBe(true);
    // the landing light is on MAIN BUS 3 (Main Dist Bus 1): out with BAT 1 off, which also takes ALT 1
    expect(lights({ lights: { land: true }, elec: { bat1: false } }).ext.land).toBe(false);
  });

  it("cabin lights: AUTO lights them when a door opens, ON lights dome and foot; OFF or no CONV power lights nothing", () => {
    expect(lights({}).cabin).toEqual({ dome: false, foot: false, step: false, bag: false });
    expect(lights({ lights: { door: true } }).cabin).toMatchObject({ dome: true, foot: true, step: true });
    expect(lights({ lights: { cabin: "ON" } }).cabin).toMatchObject({ dome: true, foot: true, step: false });
    expect(lights({ lights: { cabin: "OFF", door: true } }).cabin.dome).toBe(false);
    expect(lights({ lights: { cabin: "ON" }, cb: { "CONV LIGHTS": true } }).cabin.dome).toBe(false);
  });
});

describe("SR20 CAPS harness (POH 7-94)", () => {
  it("is three-point: both forward straps end at the firewall, the aft strap at the aft baggage bulkhead", () => {
    expect(HARNESS.fwdL[0]).toBe(FW);
    expect(HARNESS.fwdR[0]).toBe(FW);
    expect(HARNESS.aft[0]).toBe(AB);
    expect(HARNESS.fwdL[2]).toBeCloseTo(-HARNESS.fwdR[2]);
    expect(fwdStrap(1).at(-1)).toEqual(HARNESS.fwdR);
  });

  it("forward straps run just under the fuselage skin from the canister to the firewall", () => {
    for (const s of [-1, 1]) {
      // the first point is inside the canister; the rest follow the skin
      const skin = fwdStrap(s)
        .slice(1)
        .map((p) => new THREE.Vector3(...p));
      for (const p of skin) {
        expect(FUSE.inside(p), `inside at x ${p.x.toFixed(2)}`).toBe(true);
        expect(FUSE.inside(p, 0.03), `within 3 cm of the skin at x ${p.x.toFixed(2)}`).toBe(false);
        expect(Math.sign(p.z)).toBe(s);
      }
    }
  });

  it("forward straps pass below the cabin windows", () => {
    const win = [...WIN.front, ...WIN.rear],
      xs = win.map(([x]) => x),
      sill = Math.min(...win.map(([, y]) => y));
    for (const [x, y] of fwdStrap(1))
      if (x >= Math.min(...xs) && x <= Math.max(...xs)) expect(y + 0.012, `x ${x.toFixed(2)}`).toBeLessThan(sill);
  });
});
