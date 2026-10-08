/**
 * M20C manual systems: 1965 Mark 21 OM pp. 3–10, 15–16, 21–23, 27;
 * 1974 Ranger OM 2-13 / Fig. 2-4 for the alternator installation.
 * RPM, endurance and transition times are illustrative model parameters.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  bladeAngle,
  gearDown,
  gearHorn,
  gearLights,
  gearUp,
  hornLevel,
  initialLive,
  initialSim,
  live,
  pcEngaged,
  solve,
  warnings,
  type Sim,
} from "@/aircraft/m20c/model";
import { pumpFlaps, primeThrottle, scenarioCruise, scenarioRamp, useM20C } from "@/aircraft/m20c/store";
import { simTick, START_HOLD } from "@/aircraft/m20c/tick";
import { patched, type Patch } from "./helpers";

const sim = (p: Patch<Sim> = {}) => patched(initialSim, p);
const E0 = solve(initialSim);
const E = (p: Patch<Sim> = {}) => solve(sim(p), E0);
const state = () => useM20C.getState();
const update = (p: Patch<Sim>) => state().update((d) => Object.assign(d, patched(d, p)));
const tick = (seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) simTick(1 / 60);
};

beforeEach(() => {
  Object.assign(live, initialLive());
  useM20C.setState({ s: sim(), E: solve(initialSim) });
});

describe("M20C alternator and single bus (Ranger 2-13, Fig. 2-4)", () => {
  it("powers the bus at regulated voltage and charges the battery", () => {
    expect(E()).toMatchObject({ genOn: true, bus: 14, batOk: true, batLoad: 0 });
    expect(E().amps).toBeGreaterThan(0);
  });

  it("keeps an excited alternator running after battery failure, but cannot excite it from a dead bus", () => {
    expect(E({ elec: { fail: { bat: true } } }).genOn).toBe(true);
    const off = E({ elec: { master: false } });
    expect(solve(sim({ elec: { fail: { bat: true } } }), off).genOn).toBe(false);
    expect(solve(sim(), off).genOn).toBe(true);
  });

  it("is pure and ignores unrelated solves and live RPM", () => {
    const s = sim({ elec: { fail: { bat: true } } });
    const before = solve(s, E0);
    solve(sim({ elec: { master: false } }));
    live.rpm = 0;
    expect(solve(s, E0)).toEqual(before);
  });

  it.each(["ALT", "ALT FIELD"])("loses alternator output through the %s breaker", (name) => {
    const e = E({ cb: { [name]: true } });
    expect(e.genOn).toBe(false);
    expect(e.bus).toBe(12.6);
    expect(e.amps).toBeLessThan(0);
  });

  it("load shedding extends illustrative battery endurance; exhaustion drops the bus", () => {
    const p: Patch<Sim> = { elec: { fail: { gen: true } } };
    const normal = E(p);
    expect(E({ elec: { fail: { gen: true }, radios: false } }).endurance).toBeGreaterThan(normal.endurance);
    expect(E({ elec: { fail: { gen: true }, tBat: normal.endurance + 1 } })).toMatchObject({
      batDead: true,
      bus: 0,
      gearWarn: false,
      stallWarn: false,
      com1: false,
      com2: false,
      xpdr: false,
    });
  });

  it.each([
    ["NAV/COM 1", "com1"],
    ["NAV/COM 2", "com2"],
    ["XPDR", "xpdr"],
  ] as const)("isolates %s without dropping the other radio loads", (breaker, load) => {
    const e = E({ cb: { [breaker]: true } });
    expect(e[load]).toBe(false);
    for (const other of ["com1", "com2", "xpdr"] as const) if (other !== load) expect(e[other]).toBe(true);
    expect(e.load).toBeLessThan(E0.load);
  });

  it("RADIO MASTER removes all radio loads", () => {
    expect(E({ cb: { "RADIO MASTER": true } })).toMatchObject({ com1: false, com2: false, xpdr: false });
  });

  it("tracks both RPM threshold crossings without another switch action", () => {
    update({ air: false, eng: { throttle: 0 } });
    tick(10);
    expect(live.rpm).toBeLessThan(700);
    expect(state().E).toMatchObject({ genOn: false, bus: 12.6 });
    update({ eng: { throttle: 0.5 } });
    tick(10);
    expect(live.rpm).toBeGreaterThan(1500);
    expect(state().E).toMatchObject({ genOn: true, bus: 14 });
  });
});

describe("M20C manual gear and hydraulic flaps (OM pp. 6, 9, 27)", () => {
  it("moves the gear without electrical power; warning lamps require the bus", () => {
    update({ elec: { master: false }, gear: { lever: "DOWN" } });
    tick(2);
    expect(gearDown()).toBe(true);
    expect(gearLights(state().s, state().E)).toEqual({ green: false, red: false });
    update({ elec: { master: true } });
    expect(gearLights(state().s, state().E)).toEqual({ green: true, red: false });
    update({ gear: { lever: "UP" } });
    tick(2);
    expect(gearUp()).toBe(true);
    expect(gearLights(state().s, state().E)).toEqual({ green: false, red: true });
  });

  it("warns at low manifold pressure with gear up, silenced by GEAR WARN or gear down", () => {
    live.map = 9;
    expect(gearHorn(initialSim, E0)).toBe(true);
    expect(gearHorn(initialSim, E({ cb: { "GEAR WARN": true } }))).toBe(false);
    live.gearFrac = 0;
    expect(gearHorn(initialSim, E0)).toBe(false);
  });

  it("requires DOWN to pump, reaches take-off in two strokes, caps at full, and bleeds back up", () => {
    pumpFlaps();
    expect(live.flapAng).toBe(0);
    update({ elec: { master: false }, flaps: { valve: "DOWN" } });
    pumpFlaps();
    pumpFlaps();
    expect(Math.abs(live.flapAng - 15)).toBeLessThanOrEqual(1); // TCDS take-off 15° ±1°
    for (let i = 0; i < 4; i++) pumpFlaps();
    expect(live.flapAng).toBe(33);
    tick(2);
    expect(live.flapAng).toBe(33);
    update({ flaps: { valve: "UP" } });
    tick(6);
    expect(live.flapAng).toBe(0);
  });

  it("stall warning needs power and changes with flap setting (OM Fig. 4, p. 23)", () => {
    const s = sim({ air: false, stall: { ias: 70 } });
    expect(hornLevel(s, E0)).toBeGreaterThan(0);
    live.flapAng = 33;
    expect(hornLevel(s, E0)).toBe(0);
    live.flapAng = 0;
    expect(hornLevel(s, E({ cb: { "STALL WARN": true } }))).toBe(0);
    expect(warnings(s, E({ elec: { master: false } }))).toEqual([]);
  });
});

describe("M20C engine, propeller and PC (OM pp. 2–3, 8, 15–16, 21–22)", () => {
  it("starts from the ramp after boost pressure, two priming strokes and START", () => {
    scenarioRamp();
    update({ elec: { master: true }, sw: { fuelPump: true }, eng: { throttle: 0.1 } });
    tick(2);
    primeThrottle();
    primeThrottle();
    live.startTimer = START_HOLD;
    update({ eng: { key: "START" } });
    tick(8);
    expect(state().s.eng).toMatchObject({ running: true, key: "BOTH", altSpinning: true });
    expect(state().E).toMatchObject({ starterOn: false, genOn: true });
    expect(live.rpm).toBeGreaterThan(700);
    // Magnetos and the engine-driven fuel pump do not need the electrical bus.
    update({ elec: { master: false } });
    tick(5);
    expect(state().s.eng.running).toBe(true);
    expect(state().E.bus).toBe(0);
  });

  it.each(["OFF", "L"] as const)("cannot prime from %s when that selector has no fuel", (sel) => {
    scenarioRamp();
    update({ elec: { master: true }, sw: { fuelPump: true }, fuel: { sel, qL: 0 } });
    primeThrottle();
    expect(live.prime).toBe(0);
  });

  it("stops after fuel starvation and relights when fuel returns while windmilling", () => {
    update({ fuel: { sel: "OFF" } });
    tick(5);
    expect(state().s.eng.running).toBe(false);
    update({ fuel: { sel: "R" } });
    tick(3);
    expect(state().s.eng.running).toBe(true);
  });

  it("idle cut-off stops combustion", () => {
    update({ eng: { mix: 0 } });
    tick(1);
    expect(state().s.eng.running).toBe(false);
  });

  it("full carb heat removes the simulated ice and restores RPM", () => {
    update({ eng: { fail: { carbIce: true } } });
    tick(25);
    const icedRpm = live.rpm;
    expect(live.carbIce).toBeGreaterThan(0.5);
    update({ eng: { carbHeat: 1 } });
    tick(15);
    expect(live.carbIce).toBe(0);
    expect(live.rpm).toBeGreaterThan(icedRpm);
  });

  it("loss of oil sends the non-counterweighted propeller to fine pitch (Ranger 1-4)", () => {
    live.oilP = 0;
    expect(bladeAngle(initialSim, 2450)).toBe(13);
  });

  it("PC disengages on cut-off or vacuum loss, independently of the master", () => {
    update({ elec: { master: false } });
    expect(pcEngaged(state().s)).toBe(true);
    update({ pc: { cutoff: true } });
    expect(pcEngaged(state().s)).toBe(false);
    update({ pc: { cutoff: false }, eng: { fail: { vacPump: true } } });
    tick(5);
    expect(live.vac).toBeLessThan(0.1);
    expect(pcEngaged(state().s)).toBe(false);
    expect(state().s.eng.running).toBe(true);
  });
});

describe("M20C scenarios", () => {
  it.each([scenarioCruise, scenarioRamp])("clears failures, animation and timers without refilling tanks", (run) => {
    update({ fuel: { qL: 6, qR: 12 }, cb: { ALT: true }, eng: { fail: { oilLeak: true } } });
    Object.assign(live, { startTimer: 3, crankT: 5, starve: 2.9, pumpAnim: 1, pcRoll: 0.3, pcYaw: 0.2 });
    run();
    expect(state().s.fuel).toMatchObject({ qL: 6, qR: 12 });
    expect(state().s.cb).toEqual({});
    expect(Object.values(state().s.eng.fail).some(Boolean)).toBe(false);
    expect(live).toMatchObject({ startTimer: 0, crankT: 0, starve: 0, pumpAnim: 0, pcRoll: 0, pcYaw: 0 });
    expect(state().E.genOn).toBe(run === scenarioCruise);
    expect(state().E.bus).toBe(run === scenarioCruise ? 14 : 0);
    if (run === scenarioRamp) expect(state().s.fuel.sel).toBe("R");
  });

  it("switches ramp → cruise → ramp without stale power or motion", () => {
    scenarioRamp();
    scenarioCruise();
    tick(1);
    expect(state().E.genOn).toBe(true);
    expect(live.fs.onGround).toBe(false);
    scenarioRamp();
    tick(1);
    expect(state().E.bus).toBe(0);
    expect(live.fs.onGround).toBe(true);
    expect(live.rpm).toBe(0);
    expect(live.trimRate).toBe(0);
  });
});
