import { afterEach, describe, expect, it } from "vitest";
import { advanceSimulation } from "@/lib/simulationClock";
import { gearDown, live } from "@/aircraft/m20c/model";
import { scenarioCruise, useM20C } from "@/aircraft/m20c/store";
import { simTick } from "@/aircraft/m20c/tick";

describe("simulation elapsed time", () => {
  it.each([60, 20, 5])("preserves three seconds of elapsed time at %i frames per second", (fps) => {
    let simulated = 0;
    for (let frame = 0; frame < fps * 3; frame++) advanceSimulation(1 / fps, (dt) => (simulated += dt));
    expect(simulated).toBeCloseTo(3, 12);
  });

  it.each([1 / 60, 1 / 30, 0.05])("preserves the single-step behavior for a %f-second frame", (elapsed) => {
    const steps: number[] = [];
    advanceSimulation(elapsed, (dt) => steps.push(dt));
    expect(steps).toEqual([elapsed]);
  });

  it.each([0.051, 0.11, 0.2, 0.999, 1, 8, Number.MAX_VALUE])(
    "bounds integration steps and catch-up for a %f-second frame",
    (elapsed) => {
      const steps: number[] = [];
      advanceSimulation(elapsed, (dt) => steps.push(dt));
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(20);
      expect(steps.every((dt) => dt > 0 && dt <= 0.05)).toBe(true);
      expect(steps.reduce((total, dt) => total + dt, 0)).toBeCloseTo(Math.min(elapsed, 1), 12);
    },
  );

  it("resumes normally after a background pause without accumulating an unbounded backlog", () => {
    let simulated = 0;
    for (const elapsed of [30, 0.02, 0.018, 0.2]) advanceSimulation(elapsed, (dt) => (simulated += dt));
    expect(simulated).toBeCloseTo(1.238, 12);
  });

  it.each([0, -0.01, NaN, Infinity, -Infinity])("ignores invalid or nonpositive elapsed time: %s", (elapsed) => {
    const steps: number[] = [];
    advanceSimulation(elapsed, (dt) => steps.push(dt));
    expect(steps).toEqual([]);
  });
});

describe("M20C manual gear through the shared clock", () => {
  afterEach(scenarioCruise);

  // Gear travel's 1.3 seconds is the illustrative animation rate, not an Owner's Manual performance figure.
  it.each([60, 20, 5])("preserves gear travel time at %i frames per second", (fps) => {
    scenarioCruise();
    useM20C.getState().update((s) => {
      s.gear.lever = "DOWN";
    });
    for (let frame = 0; frame < fps; frame++) advanceSimulation(1 / fps, simTick);
    expect(live.gearFrac).toBeCloseTo(1 - 1 / 1.3, 10);
    expect(gearDown()).toBe(false);
    for (let frame = 0; frame < fps * 0.4; frame++) advanceSimulation(1 / fps, simTick);
    expect(live.gearFrac).toBe(0);
    expect(gearDown()).toBe(true);
  });
});
