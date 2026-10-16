/**
 * The propeller governor component simulation against what the FAA's powerplant handbook (FAA-H-8083-32B, chapter 7)
 * and the SR20's documents describe.
 */
import { describe, expect, it } from "vitest";
import { GOVERNOR as G } from "@/engines/components/governor/spec";
import {
  defaultControls,
  initialState,
  noFailures,
  run,
  setRpm,
  springSet,
  step,
  type Controls,
  type Failures,
  type Hub,
} from "@/engines/components/governor/model";

const lever = (rpm: number) => (rpm - G.propeller.governorMinRpm) / (G.engine.ratedRpm - G.propeller.governorMinRpm);

/** Speeder spring force with the pilot valve centred, N. */
const centred = (c: Controls) => G.model.springRate * springSet(G, c.lever);

/** Cruise: 140 kt, 80 % throttle, 2,450 rpm (the IO-390's 75 % cruise rpm, IOM Table A-1). */
function cruise(hub: Hub, f: Failures = noFailures()) {
  const c: Controls = { lever: lever(2450), throttle: 0.8, kt: 140 };
  const s = run(G, initialState(G, hub, c), c, hub, f, 40);
  return { s, c, f };
}

/** Run, returning the highest and lowest rpm on the way. */
function span(hub: Hub, x: ReturnType<typeof cruise>, seconds: number) {
  let hi = 0,
    lo = Infinity;
  for (let t = 0; t < seconds; t += 0.05) {
    step(G, x.s, x.c, hub, x.f, 0.05);
    hi = Math.max(hi, x.s.rpm);
    lo = Math.min(lo, x.s.rpm);
  }
  return { hi, lo };
}

describe.each(["high", "low"] as Hub[])("governor with an oil-to-%s-pitch hub", (hub) => {
  it("holds the set rpm on speed, the pilot valve metering only the leakage (FAA-H-8083-32B p. 7-11)", () => {
    const { s } = cruise(hub);
    expect(Math.abs(s.rpm - 2450)).toBeLessThan(15);
    expect(s.mode).toBe("on");
    expect(Math.abs(s.flow)).toBeLessThan(0.01);
  });

  it("on an overspeed the flyweights raise the pilot valve and the blades go to a higher angle (Figure 7-18)", () => {
    const x = cruise(hub);
    const beta = x.s.beta;
    x.c.kt = 175; // a dive
    step(G, x.s, x.c, hub, x.f, 3);
    expect(x.s.x).toBeGreaterThan(0);
    // the flyweights out-pull the spring as the lever set it, so they raise the valve until it compresses further
    expect(x.s.flyweightN).toBeGreaterThan(centred(x.c));
    const { hi } = span(hub, x, 20);
    expect(x.s.beta).toBeGreaterThan(beta + 2);
    expect(hi).toBeLessThan(2450 + 200);
    expect(Math.abs(x.s.rpm - 2450)).toBeLessThan(15);
  });

  it("on an underspeed the speeder spring lowers the valve and the blades go to a lower angle (Figure 7-17)", () => {
    const x = cruise(hub);
    const beta = x.s.beta;
    x.c.kt = 100; // nose up into a climb
    step(G, x.s, x.c, hub, x.f, 3);
    expect(x.s.x).toBeLessThan(0);
    expect(x.s.flyweightN).toBeLessThan(centred(x.c));
    span(hub, x, 20);
    expect(x.s.beta).toBeLessThan(beta - 2);
    expect(Math.abs(x.s.rpm - 2450)).toBeLessThan(15);
  });

  it("the propeller control sets the rpm through the speeder spring's compression (p. 7-11)", () => {
    const x = cruise(hub);
    x.c.lever = 1;
    span(hub, x, 20);
    expect(x.s.setRpm).toBe(2700);
    expect(Math.abs(x.s.rpm - 2700)).toBeLessThan(15);
    expect(x.s.springN).toBeGreaterThan(G.model.flyweightN * (2450 / 2700) ** 2);
  });

  it("the gear pump's boosted oil is held at the relief valve's 275 psi while the port is closed (Figure 7-16)", () => {
    const { s } = cruise(hub);
    expect(s.pumpPsi).toBe(G.handbook.reliefPsi.value);
    expect(s.relief).toBe(true);
  });

  it("full throttle standing still governs at the IO-390's rated 2,700 rpm (IOM Table A-1)", () => {
    const c = defaultControls();
    const s = run(G, initialState(G, hub, c), c, hub, noFailures(), 20);
    expect(Math.abs(s.rpm - 2700)).toBeLessThan(15);
    expect(s.beta).toBeGreaterThan(G.propeller.fineDeg);
  });

  it("with the throttle back the governor runs out of pitch: the blades rest on the low-pitch stop, underspeed", () => {
    const c: Controls = { lever: 1, throttle: 0.05, kt: 70 };
    const s = run(G, initialState(G, hub, c), c, hub, noFailures(), 30);
    expect(s.beta).toBeCloseTo(G.propeller.fineDeg, 1);
    expect(s.rpm).toBeLessThan(2600);
    expect(s.mode).toBe("under");
  });

  it("a broken speeder spring lets the flyweights lift the valve: the governor drives the blades to high pitch", () => {
    const x = cruise(hub);
    x.f.brokenSpring = true;
    span(hub, x, 20);
    expect(x.s.mode).toBe("over");
    expect(x.s.beta).toBeCloseTo(G.propeller.coarseDeg, 0);
    expect(x.s.rpm).toBeLessThan(2200);
  });

  it("a sticking pilot valve lets the rpm hunt around the set speed", () => {
    const steady = cruise(hub);
    const sticky = cruise(hub, { ...noFailures(), stickyValve: true });
    for (const x of [steady, sticky]) {
      x.c.kt = 160;
      span(hub, x, 20);
    }
    const a = span(hub, steady, 20),
      b = span(hub, sticky, 20);
    expect(a.hi - a.lo).toBeLessThan(15);
    expect(b.hi - b.lo).toBeGreaterThan(30);
  });
});

describe("a worn gear pump: the governor is slow wherever the pump's oil does the work", () => {
  it("oil drives the Hartzell hub to high pitch, so a burst of power overspeeds further before it is caught", () => {
    const peak = (f: Failures) => {
      const c: Controls = { lever: lever(2450), throttle: 0.4, kt: 120 };
      const s = run(G, initialState(G, "high", c), c, "high", f, 40);
      c.throttle = 1;
      let hi = 0;
      for (let t = 0; t < 20; t += 0.05) {
        step(G, s, c, "high", f, 0.05);
        hi = Math.max(hi, s.rpm);
      }
      return { hi, s };
    };
    const a = peak(noFailures()),
      b = peak({ ...noFailures(), wornPump: true });
    expect(b.hi).toBeGreaterThan(a.hi + 100);
    expect(Math.abs(b.s.rpm - 2450)).toBeLessThan(15);
  });

  it("oil drives a counterweighted hub to low pitch, so it is slow to bring the rpm up to a new setting", () => {
    const rise = (f: Failures) => {
      const c: Controls = { lever: lever(2450), throttle: 0.8, kt: 140 };
      const s = run(G, initialState(G, "low", c), c, "low", f, 40);
      c.lever = 1;
      for (let t = 0; t < 20; t += 0.05) {
        step(G, s, c, "low", f, 0.05);
        if (s.rpm > 2690) return t;
      }
      return Infinity;
    };
    expect(rise({ ...noFailures(), wornPump: true })).toBeGreaterThan(3 * rise(noFailures()));
  });
});

describe("a relief valve stuck open: the governor can't boost the engine's oil", () => {
  it("the Hartzell hub can't be held at high pitch against its spring: the blades go to low pitch and the rpm runs away", () => {
    const { s } = cruise("high", { ...noFailures(), reliefStuck: true });
    expect(s.pumpPsi).toBeLessThan(G.handbook.reliefPsi.value);
    expect(s.beta).toBeCloseTo(G.propeller.fineDeg, 1);
    expect(s.rpm).toBeGreaterThan(G.engine.ratedRpm);
  });

  it("a counterweighted hub still governs, its counterweights needing no oil to go to high pitch", () => {
    const { s } = cruise("low", { ...noFailures(), reliefStuck: true });
    expect(s.pumpPsi).toBeLessThan(G.handbook.reliefPsi.value);
    expect(Math.abs(s.rpm - 2450)).toBeLessThan(25);
  });
});

it("with the blades on the high-pitch stop the piston takes only the leakage: the rest of the pump's oil opens the relief valve", () => {
  const x = cruise("high");
  x.f.brokenSpring = true;
  span("high", x, 20);
  expect(x.s.beta).toBeCloseTo(G.propeller.coarseDeg, 0);
  expect(x.s.relief).toBe(true);
  expect(x.s.pumpPsi).toBe(G.handbook.reliefPsi.value);
  expect(x.s.hubPsi).toBe(G.handbook.reliefPsi.value);
});

it("a step of no time leaves the state as it was, even with the piston on its stop", () => {
  const x = cruise("high");
  x.f.brokenSpring = true;
  span("high", x, 20);
  const before = { ...x.s, hist: undefined };
  step(G, x.s, x.c, "high", x.f, 0);
  expect({ ...x.s, hist: undefined }).toEqual(before);
  expect(Number.isFinite(x.s.beta) && Number.isFinite(x.s.rpm)).toBe(true);
});

describe("losing the governor's oil", () => {
  it("the SR20's Hartzell hub goes to low pitch: oil drives it to high pitch, its spring and the blades' twisting moment back (SR20 AMM 61-10 p. 1)", () => {
    const x = cruise("high");
    x.f.oilLoss = true;
    span("high", x, 20);
    expect(x.s.beta).toBeCloseTo(G.propeller.fineDeg, 1);
    expect(x.s.rpm).toBeGreaterThan(G.engine.ratedRpm);
  });

  it("a counterweighted hub goes to high pitch and the rpm falls (FAA-H-8083-32B p. 7-11)", () => {
    const x = cruise("low");
    x.f.oilLoss = true;
    span("low", x, 30);
    expect(x.s.beta).toBeGreaterThan(38);
    expect(x.s.rpm).toBeLessThan(2300);
  });
});

it("the propeller control spans the IO-390 simulation's governing range", () => {
  expect(setRpm(G, 0)).toBe(G.propeller.governorMinRpm);
  expect(setRpm(G, 1)).toBe(G.engine.ratedRpm);
});
