import { describe, expect, it } from "vitest";
import { createSimulationClock } from "@/lib/simulationClock";

describe("owned simulation clock", () => {
  it("produces the same nonlinear trajectory under different rendering cadences", () => {
    const run = (fps: number) => {
      let speed = 2400;
      let pressure = 70;
      const clock = createSimulationClock((dt) => {
        speed += (0 - speed) * dt * 1.2;
        pressure += (speed / 40 - pressure) * dt * 2;
      });
      for (let i = 0; i < fps * 3; i++) clock.advance(1 / fps);
      return { speed, pressure, time: clock.time, steps: clock.checkpoint().steps };
    };
    expect(run(5)).toEqual(run(60));
    expect(run(20)).toEqual(run(144));
  });

  it("retains the fractional step through a checkpoint and resumes exactly", () => {
    const first: number[] = [];
    const a = createSimulationClock((dt) => first.push(dt));
    a.advance(0.011);
    const saved = a.checkpoint();
    const second: number[] = [];
    const b = createSimulationClock((dt) => second.push(dt));
    b.restore(saved);
    first.length = 0;
    for (const elapsed of [0.002, 0.031, 0.2, 0.04]) {
      a.advance(elapsed);
      b.advance(elapsed);
    }
    expect(second).toEqual(first);
    expect(b.checkpoint()).toEqual(a.checkpoint());
    expect(saved.steps).toBe(1);
  });

  it("bounds background catch-up without sharing a remainder between instances", () => {
    const tick = () => {};
    const a = createSimulationClock(tick);
    const b = createSimulationClock(tick);
    a.advance(30);
    expect(a.time).toBe(1);
    expect(b.time).toBe(0);
    a.advance(1 / 60);
    expect(a.checkpoint().steps).toBe(122);
    a.reset();
    expect(a.checkpoint()).toEqual({ remainder: 0, steps: 0 });
  });

  it("rejects invalid checkpoints and ignores invalid elapsed time", () => {
    const clock = createSimulationClock(() => {
      throw new Error("must not step");
    });
    for (const elapsed of [0, -1, NaN, Infinity]) clock.advance(elapsed);
    expect(clock.time).toBe(0);
    expect(() => clock.restore({ remainder: 1, steps: 0 })).toThrow("Invalid");
    expect(() => clock.restore({ remainder: 0, steps: -1 })).toThrow("Invalid");
  });
});
