/**
 * The carburetor simulation (/components/carburetor) against how the FAA's AMT Handbook—Powerplant (FAA-H-8083-32B,
 * Chapter 2) and the MA-4-5 overhaul instructions describe a float carburetor working, read from the O-360-A1D's
 * running engine model.
 */
import { describe, expect, test } from "vitest";
import { COMPONENT_IDS, componentById } from "@/engines/components";
import { MA45, pumpStep, readCarb, type Pump } from "@/engines/components/carburetor/carburetor";
import { noFailures, step } from "@/engines/model/engine";
import { SCENARIOS, type Setup } from "@/engines/model/scenarios";
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
    // a full stroke delivers the engine model's accelerating charge (all but the spring's last fraction of travel)
    expect(s.fuel).toBeLessThanOrEqual(carb.accelLb);
    expect(s.fuel).toBeGreaterThan(0.98 * carb.accelLb);
  });

  test("opening slowly gives a weaker stream than snapping the throttle open", () => {
    expect(stroke(0, 1, 8).peak).toBeLessThan(stroke(0, 1, 0).peak / 3);
  });

  test("closing the throttle lifts the plunger and squirts nothing", () => {
    expect(stroke(1, 0, 0).fuel).toBe(0);
  });
});
