import { describe, expect, it } from "vitest";
import { brakeAmount } from "@/lib/anims";
import {
  advanceElectricalTime,
  annunciations,
  BAT_AH,
  hornLevel,
  initialSim,
  setBrakePedals,
  setBrakeValve,
  solve,
  stallSpeed,
} from "@/aircraft/da40/model";
import { createDA40Simulation } from "@/aircraft/da40/simulation";
import { powerFrac, runningFlow } from "@/aircraft/da40/step";
import { rampState } from "@/aircraft/da40/walk";

const runtime = createDA40Simulation;
type Runtime = ReturnType<typeof runtime>;
const advance = (r: Runtime, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) r.step(0.05);
};
const electricalMinutes = (r: Runtime, minutes: number) =>
  r.store.getState().update((s) => advanceElectricalTime(s, solve(s, r.store.getState().E), minutes * 60));

describe("DA40 electrical source history (AFMS §3.7.2)", () => {
  it("shedding preserves remaining charge and cannot revive an exhausted battery", () => {
    const early = runtime();
    early.store.getState().update((s) => {
      s.elec.fail.alt = true;
    });
    const late = early.fork();
    electricalMinutes(early, 5);
    const charge = early.store.getState().s.elec.usedAh;
    early.store.getState().update((s) => {
      s.elec.essBus = true;
    });
    expect(early.store.getState().s.elec.usedAh).toBe(charge);
    electricalMinutes(early, 13);
    electricalMinutes(late, 18);
    late.store.getState().update((s) => {
      s.elec.essBus = true;
    });
    expect(early.store.getState().E.ess).toBeGreaterThan(0);
    expect(late.store.getState().E).toMatchObject({ batDead: true, ess: 0, main: 0 });
    late.store.getState().update((s) => {
      s.elec.ext = true;
    });
    electricalMinutes(late, 1);
    expect(late.store.getState().s.elec.usedAh).toBeCloseTo(BAT_AH - 0.1);
  });

  it("the standby pack supplies 90 minutes from switch-on with the floodlight, pausing while off", () => {
    const r = runtime(),
      state = r.store.getState;
    state().update((s) => {
      s.elec.fail.alt = true;
      s.lights.flood = 1;
    });
    electricalMinutes(r, 95);
    state().update((s) => {
      s.elec.emerg = true;
    });
    expect(state().E).toMatchObject({ ess: 0, stbyAtt: true, floodPwr: true });
    electricalMinutes(r, 30);
    state().update((s) => {
      s.elec.emerg = false;
    });
    electricalMinutes(r, 30);
    state().update((s) => {
      s.elec.emerg = true;
    });
    electricalMinutes(r, 59);
    expect(state().E.stbyAtt).toBe(true);
    electricalMinutes(r, 1);
    expect(state().E).toMatchObject({ stbyAtt: false, floodPwr: false });
  });

  it("restores a saved slider-era failure using its then-current load and active emergency switch", () => {
    const r = runtime();
    r.store.getState().update((s) => {
      s.elec.fail.alt = s.elec.emerg = true;
    });
    const load = r.store.getState().E.batLoad;
    const old = JSON.parse(r.serialize());
    delete old.s.elec.usedAh;
    delete old.s.elec.emergencyMinutes;
    delete old.s.gear.held;
    delete old.live.pending;
    old.s.elec.tBat = 5;
    r.restoreSerialized(JSON.stringify(old));
    expect(r.store.getState().s.elec.usedAh).toBeCloseTo((load * 5) / 60);
    expect(r.store.getState().s.elec.emergencyMinutes).toBe(5);
    advance(r, 1);
    expect(r.store.getState().s.elec.usedAh).toBeGreaterThan((load * 5) / 60);
    old.s.elec.fail.alt = false;
    old.s.elec.tBat = 120;
    r.restoreSerialized(JSON.stringify(old));
    expect(r.store.getState().E).toMatchObject({ altOn: false, batDead: true, main: 0 });
  });

  it("restores the active aircraft and its fractional charge and fuel usage after a walk fork", () => {
    const r = runtime();
    r.store.getState().update((s) => {
      s.elec.fail.alt = s.elec.emerg = true;
    });
    advance(r, 1.35);
    const saved = r.serialize(),
      walk = r.fork();
    walk.store.getState().update((s) => Object.assign(s, rampState(s)));
    advance(walk, 5);
    expect(r.serialize()).toBe(saved);
    const restored = runtime();
    restored.restoreSerialized(saved);
    for (const a of [r, restored]) advance(a, 1);
    expect(restored.checkpoint()).toEqual(r.checkpoint());
    expect(r.store.getState().s.elec.usedAh).toBeGreaterThan(0);
    expect(r.store.getState().s.elec.emergencyMinutes).toBeCloseTo(2 / 60, 6);
  });
});

it("only unintended starter engagement is warned, with a live GEA / GIA path (AFMS Rev. 7 p. 20)", () => {
  const r = runtime(),
    state = r.store.getState;
  r.dispatch({ type: "scenario", name: "ramp" });
  const warns = () =>
    annunciations(state().s, state().E, r.live).some(([level, msg]) => level === "w" && msg === "STARTER ENGD");
  state().update((s) => {
    s.elec.bat = true;
    s.eng.key = "START";
  });
  r.live.startTimer = 1;
  advance(r, 0.5);
  expect(state().E.starterOn).toBe(true);
  expect(warns()).toBe(false);
  advance(r, 1);
  expect(state().E.starterOn).toBe(false);
  expect(warns()).toBe(false);
  r.dispatch({ type: "scenario", name: "cruise" });
  state().update((s) => {
    s.eng.fail.starterStuck = true;
  });
  expect(warns()).toBe(true);
  state().update((s) => {
    s.cb["ENG INST"] = true;
  });
  expect(warns()).toBe(false);
  state().update((s) => {
    s.cb = { "GPS/NAV 1": true, "GPS/NAV 2": true };
  });
  expect(warns()).toBe(false);
});

it("debits indicated delivered flow only from the selected tank and relights on the other tank (AFM 3.2.4, 7.10)", () => {
  const r = runtime(),
    state = r.store.getState;
  state().update((s) => {
    s.fuel.qL = 0.02;
  });
  let gallons = 0;
  for (let i = 0; i < 40; i++) {
    r.step(0.05);
    gallons += (r.live.ff * 0.05) / 3600;
  }
  expect(state().s.fuel.qL).toBeCloseTo(0.02 - gallons, 9);
  expect(state().s.fuel.qR).toBe(20);
  advance(r, 10);
  expect(state().s.fuel.qL).toBe(0);
  expect(state().s.eng.running).toBe(false);
  state().update((s) => {
    s.fuel.sel = "R";
  });
  advance(r, 4);
  expect(state().s.eng.running).toBe(true);
  expect(state().s.fuel.qR).toBeLessThan(20);
  state().update((s) => {
    s.eng.mix = 0;
  });
  const remaining = state().s.fuel.qR;
  advance(r, 4);
  expect(state().s.fuel.qR).toBe(remaining);
});

it("meters boost priming and stops delivery when both pump paths fail (AFM 7.10)", () => {
  const r = runtime(),
    state = r.store.getState;
  r.dispatch({ type: "scenario", name: "ramp" });
  state().update((s) => {
    s.elec.bat = true;
    s.fuel.sel = "R";
    s.fuel.pump = true;
    s.eng.mix = 1;
  });
  advance(r, 2);
  expect(state().s.fuel.qL).toBe(21);
  expect(state().s.fuel.qR).toBeLessThan(20);
  state().update((s) => {
    s.eng.fail.mechPump = true;
    s.cb["FUEL PUMP"] = true;
  });
  const remaining = state().s.fuel.qR;
  advance(r, 3);
  expect(state().s.fuel.qR).toBe(remaining);
});

it("burn across 19 gal starts the 30-second pointer migration and holds at 16 (AFMS Rev. 7 p. 60)", () => {
  const r = runtime();
  r.store.getState().update((s) => {
    s.fuel.qL = 19.001;
  });
  advance(r, 1);
  expect(r.live.gaugeL).toBeGreaterThan(18.9);
  advance(r, 15);
  expect(r.live.gaugeL).toBeCloseTo(17.5, 1);
  advance(r, 16);
  expect(r.live.gaugeL).toBe(16);
  expect(r.store.getState().s.fuel.qL).toBeGreaterThan(18);
  expect(r.live.gaugeR).toBe(20);
});

it("retains each positive pedal stroke behind the closed parking valve (AFM 7-13/14)", () => {
  const gear = structuredClone(initialSim.gear);
  setBrakeValve(gear, true);
  expect(gear.held).toEqual({ L: 0, R: 0 });
  setBrakePedals(gear, -0.3);
  setBrakePedals(gear, 0);
  setBrakePedals(gear, -0.3);
  expect(brakeAmount(gear, "L")).toBe(0.6);
  expect(brakeAmount(gear, "R")).toBe(0);
  setBrakePedals(gear, 0.4);
  setBrakePedals(gear, 0);
  expect(gear.held).toEqual({ L: 0.6, R: 0.4 });
  setBrakeValve(gear, false);
  expect(gear.held).toEqual({ L: 0, R: 0 });
});

it("a stopped flap actuator leaves the horn and stall speed at the achieved angle (AFM 5-8, 7-54)", () => {
  const r = runtime(),
    state = r.store.getState;
  state().update((s) => {
    s.stall.ias = 62;
    s.flaps.cmd = 2;
    s.cb.FLAPS = true;
  });
  advance(r, 3);
  expect(stallSpeed(r.live.flapAng)).toBe(53);
  const initial = hornLevel(state().s, r.live);
  expect(initial).toBeGreaterThan(0);
  state().update((s) => {
    delete s.cb.FLAPS;
  });
  advance(r, 1);
  state().update((s) => {
    s.cb.FLAPS = true;
  });
  advance(r, 5);
  expect(r.live.flapAng).toBeCloseTo(7);
  expect(stallSpeed(r.live.flapAng)).toBeCloseTo(52.65);
  expect(hornLevel(state().s, r.live)).toBeLessThan(initial);
});

it.each([
  [22.7, 1800, 0, 15, 0.45],
  [21.2, 2400, 0, 15, 0.55],
  [22.3, 2400, 4000, 7, 0.65],
  [24.1, 2400, 5000, 5, 0.75],
])("M1A chart at %s inHg / %s RPM reproduces the AFM 5-5/6 cruise setting", (map, rpm, alt, oat, fraction) => {
  expect(Math.abs(powerFrac(map, rpm, alt, oat) - fraction)).toBeLessThan(0.025);
});

it.each([
  [0.75, 2450, 0.8, 11],
  [0.65, 2350, 0.55, 8.5],
])("retains the M1A published %s cruise fuel flow (Lycoming 60297-36 p. 18)", (power, rpm, mix, gph) => {
  expect(Math.abs(runningFlow(power, rpm, mix) - gph)).toBeLessThan(0.4);
});

it("changing only governor RPM changes available power and flight response", () => {
  const low = runtime(),
    high = low.fork();
  low.store.getState().update((s) => {
    s.eng.rpmLever = 0;
  });
  high.store.getState().update((s) => {
    s.eng.rpmLever = 1;
  });
  for (const r of [low, high]) advance(r, 60);
  expect(high.live.fs.power).toBeGreaterThan(low.live.fs.power);
  expect(high.live.fs.ias).toBeGreaterThan(low.live.fs.ias + 5);
});
