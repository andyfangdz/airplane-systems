/**
 * The carburetor simulation (/components/carburetor) against how the FAA's AMT Handbook—Powerplant (FAA-H-8083-32B,
 * Chapter 2) and the MA-4-5 overhaul instructions describe a float carburetor working, read from the O-360-A1D's
 * running engine model.
 */
import { describe, expect, test } from "vitest";
import { COMPONENT_IDS, componentById } from "@/engines/components";
import {
  MA45,
  PRIMER_IDLE,
  primerStep,
  primerStroke,
  pumpStep,
  readCarb,
  runPrimer,
  type Primer,
  type Pump,
} from "@/engines/components/carburetor/carburetor";
import { defaultControls, defaultEnvironment, initialState, noFailures, step } from "@/engines/model/engine";
import { SCENARIOS, type Setup } from "@/engines/model/scenarios";
import { carbFuelFlow } from "@/engines/model/carburetor";
import { ratedAirLbH } from "@/engines/model/engine";
import { INHG_PA } from "@/engines/model/atmosphere";
import { O360 } from "@/engines/o360/spec";

const S = O360;
const carb = S.fuelSystem.kind === "carburetor" ? S.fuelSystem : null!;
const run = (id: string): Setup => SCENARIOS.find((x) => x.id === id)!.run(S);
const read = (x: Setup) => readCarb(S, x.s, x.c);

describe("the carburetor page", () => {
  test("is listed as a component with its own page", () => {
    expect(COMPONENT_IDS).toContain("carburetor");
    expect(componentById("carburetor")?.sub).toMatch(/MA-4-5/);
  });

  test("quotes the overhaul instructions' float setting and tests (OI ¶2-27 y, ¶3-2, ¶3-3)", () => {
    expect(MA45.floatSetting.value).toBe("13/64 in");
    expect(MA45.floatValveTest.value).toMatch(/0\.4 psi .* 6\.0 psi/);
    expect(MA45.pumpTube.value).toBe("A 11/64 in, B 1/4 in");
  });
});

describe("main metering and idling systems (FAA-H-8083-32B pp. 2-10–2-12)", () => {
  test("at idle the throttle is nearly closed and the idle jet carries the engine", () => {
    const r = read(run("idle"));
    expect(r.idle).toBeGreaterThan(1);
    expect(r.idle).toBeGreaterThan(r.main);
    expect(r.mainShare).toBeLessThan(1);
    expect(r.vacuum).toBeGreaterThan(0.5);
  });

  test("in cruise the main nozzle meters all the fuel, in step with the air", () => {
    const x = run("cruise75");
    const r = read(x);
    expect(r.mainShare).toBe(1);
    expect(r.idle).toBe(0);
    expect(r.main).toBeCloseTo(x.s.fuel, 6);
    // a fuel-air ratio in the range a running engine burns (best power about 1:12)
    expect(1 / r.far).toBeGreaterThan(10);
    expect(1 / r.far).toBeLessThan(17);
  });

  test("idle cut-off stops all fuel (OM p. 1-2)", () => {
    const x = run("idle");
    x.c.mixture = 0;
    for (let i = 0; i < 40; i++) step(S, x.s, x.c, x.env, noFailures(S), 0.05);
    const r = read(x);
    expect(r.main + r.idle).toBe(0);
  });

  test("an intake leak bypasses the carburetor: the displayed circuit split uses only bore air (AMT p. 2-12)", () => {
    const x = run("idle");
    const f = noFailures(S);
    f.intakeLeak[0] = 1;
    for (let t = 0; t < 8; t += 1 / 120) step(S, x.s, x.c, x.env, f, 1 / 120);
    const r = read(x);
    expect(x.s.air).toBeGreaterThan(r.air);
    expect(r.air).toBe(x.s.meteredAir);
    const rho = (x.s.inletInHg * INHG_PA) / (287.05 * (x.s.inletC + 273.15));
    const flow = carbFuelFlow(S, carb, r.air, ratedAirLbH(S), x.c.mixture, rho, x.s.map, x.s.inletInHg, x.s.ice);
    expect(r.main / r.idle).toBeCloseTo(flow.main / flow.idle, 9);
    expect(r.main + r.idle).toBeCloseTo(x.s.fuel, 9);
  });
});

describe("float chamber (FAA-H-8083-32B p. 2-10)", () => {
  test("running, the float valve sits partly open, just enough to keep the level constant", () => {
    const r = read(run("cruise75"));
    expect(r.inflow).toBe(true);
    expect(r.bowl).toBeGreaterThan(0.95);
    expect(r.needle).toBeGreaterThan(0.05);
    expect(r.needle).toBeLessThan(1);
  });

  test("with no fuel pressure the bowl runs dry, the float drops and opens the valve, and the engine stops", () => {
    const x = run("cruise75");
    const f = { ...noFailures(S), fuelPump: true };
    x.c.boost = false;
    for (let i = 0; i < 1200 && x.s.bowl > 0; i++) step(S, x.s, x.c, x.env, f, 0.05);
    for (let i = 0; i < 200; i++) step(S, x.s, x.c, x.env, f, 0.05);
    const r = read(x);
    expect(r.inflow).toBe(false);
    expect(r.bowl).toBeLessThan(0.01);
    expect(r.needle).toBeGreaterThan(0.99);
    expect(x.s.running).toBe(false);
  });
});

describe("accelerating pump (FAA-H-8083-32B p. 2-13; OI ¶3-3 b)", () => {
  const stroke = (from: number, to: number, seconds: number) => {
    let p: Pump = { plunger: from, squirt: 0 },
      fuel = 0,
      peak = 0;
    const dt = 1 / 120;
    for (let t = 0; t < seconds + 3; t += dt) {
      const throttle = from + (to - from) * Math.min(1, t / Math.max(seconds, 1e-9));
      p = pumpStep(carb, p, throttle, dt);
      fuel += (p.squirt / 3600) * dt;
      peak = Math.max(peak, p.squirt);
    }
    return { fuel, peak, plunger: p.plunger };
  };

  test("closing then fully opening the throttle gives a stream that dies away as the plunger bottoms", () => {
    const s = stroke(0, 1, 0);
    expect(s.peak).toBeGreaterThan(0);
    expect(s.plunger).toBeGreaterThan(0.99);
    // Swept volume is an upper bound: some displacement leaks back even during a rapid spring-driven stroke.
    expect(s.fuel).toBeLessThanOrEqual(carb.accelLb);
    expect(s.fuel).toBeGreaterThan(0.5 * carb.accelLb);
  });

  test("opening slowly gives a weaker stream than snapping the throttle open", () => {
    expect(stroke(0, 1, 8).peak).toBeLessThan(stroke(0, 1, 0).peak / 3);
  });

  test("a slow stroke returns fuel to the float chamber and delivers less TOTAL fuel (AMT p. 2-13)", () => {
    expect(stroke(0, 1, 8).fuel).toBeLessThan(stroke(0, 1, 0).fuel / 5);
  });

  test("the integrated engine withdraws the animated discharge from the bowl and puts it in the ports", () => {
    const env = defaultEnvironment(),
      s = initialState(S, env),
      f = noFailures(S);
    const c = { ...defaultControls(), throttle: 1 };
    const before = s.bowl;
    let discharged = 0,
      drained = 0;
    const dt = 1 / 120;
    for (let t = 0; t < 3; t += dt) {
      drained += s.cyl.reduce((sum, cy) => sum + (cy.puddle / 120) * dt, 0);
      step(S, s, c, env, f, dt);
      discharged += (s.accelerator!.squirt / 3600) * dt;
    }
    expect(discharged).toBeGreaterThan(0);
    expect(before - s.bowl).toBeCloseTo(discharged, 12);
    expect(s.cyl.reduce((sum, cy) => sum + cy.puddle, 0) + drained).toBeCloseTo(discharged, 12);
  });

  test("closing the throttle lifts the plunger and squirts nothing", () => {
    expect(stroke(1, 0, 0).fuel).toBe(0);
  });

  test("with the float chamber empty the plunger still moves but has no fuel to discharge", () => {
    const p = pumpStep(carb, { plunger: 0, squirt: 0 }, 1, 1 / 60, 0);
    expect(p.plunger).toBeGreaterThan(0);
    expect(p.squirt).toBe(0);
  });
});

describe("primer (OM pp. 1-3, 3-1; FAA-H-8083-25B p. 7-25)", () => {
  const strokes = (p: Primer, seconds: number) => {
    let fired = 0,
      maxKnob = 0,
      early = false;
    for (let t = 0; t < seconds; t += 1 / 60) {
      const r = primerStep(p, 1 / 60);
      if (r.fire) {
        fired++;
        // fuel goes in only as the plunger is pushed, after the knob has been pulled out
        early ||= maxKnob < 0.99;
      }
      p = r.primer;
      maxKnob = Math.max(maxKnob, p.knob);
    }
    return { fired, p, pulledFirst: !early };
  };

  test("the documented priming is offered: a primer on the carbureted engine, 1 to 3 strokes", () => {
    expect(MA45.primer.src).toBe("OM p. 1-3");
    expect(MA45.priming.value).toMatch(/1 to 3 strokes/);
  });

  test("one press pulls the knob out, then pushes it in and sends one stroke of fuel; the knob ends in", () => {
    const r = strokes(primerStroke(PRIMER_IDLE), 5);
    expect(r.fired).toBe(1);
    expect(r.pulledFirst).toBe(true);
    expect(r.p.t).toBe(-1);
    expect(r.p.knob).toBe(0);
  });

  test("three presses make three strokes, one after another", () => {
    let p = primerStroke(PRIMER_IDLE);
    p = primerStroke(primerStroke(p));
    expect(strokes(p, 10).fired).toBe(3);
  });

  test("pressing Prime puts no fuel in until the plunger is pushed, then one charge per stroke into every cylinder", () => {
    const x = run("cold");
    const puddles = () => x.s.cyl.map((c) => c.puddle);
    const before = puddles();
    let p = primerStroke(primerStroke(PRIMER_IDLE));
    // pulling the knob out only fills the barrel
    for (let t = 0; t < 0.5; t += 1 / 60) p = runPrimer(S, x.s, p, 1 / 60);
    expect(puddles()).toEqual(before);
    for (let t = 0; t < 6; t += 1 / 60) p = runPrimer(S, x.s, p, 1 / 60);
    puddles().forEach((v, i) => expect(v - before[i]).toBeCloseTo(2 * carb.primeLb, 9));
  });
});
