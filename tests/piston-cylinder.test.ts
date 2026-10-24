import { describe, expect, test } from "vitest";
import {
  advanceAngle,
  cylinderAt,
  geometry,
  rodLength,
  createCylinderBench,
  benchValves,
  combustionEvent,
} from "@/engines/components/piston-cylinder/model";

describe("IO-390 cylinder geometry — IOM Table A-1, pp. 51–52", () => {
  test("dead centres reproduce the published stroke and compression ratio", () => {
    const tdc = cylinderAt(0),
      bdc = cylinderAt(180);
    expect(tdc.travelMm).toBeCloseTo(0, 8);
    expect(bdc.travelMm).toBeCloseTo(geometry.strokeIn * 25.4, 8);
    expect(bdc.volumeCc / tdc.volumeCc).toBeCloseTo(geometry.compressionRatio, 8);
  });
  test("connecting rod stays its assumed length throughout both revolutions", () => {
    for (let angle = 0; angle < 720; angle += 3) {
      const x = cylinderAt(angle);
      expect(Math.hypot(x.pinX, x.pistonY - x.pinY)).toBeCloseTo(rodLength, 10);
    }
  });
});

test("four strokes repeat after two revolutions, with illustrative valve overlap at exhaust TDC", () => {
  expect([90, 270, 450, 630].map((a) => cylinderAt(a).stroke)).toEqual(["power", "exhaust", "intake", "compression"]);
  expect(cylinderAt(720)).toEqual(cylinderAt(0));
  const overlap = cylinderAt(360).valves;
  expect(overlap.intake).toBeGreaterThan(0);
  expect(overlap.exhaust).toBeGreaterThan(0);
  expect(cylinderAt(630).valves).toEqual({ intake: 0, exhaust: 0 });
  expect(cylinderAt(700).spark).toBe(true);
  expect(cylinderAt(680).spark).toBe(false);
});

test("playback wraps smoothly and elapsed-time partition does not change motion", () => {
  expect(advanceAngle(719, 1 / 60, 10)).toBe(0);
  expect(advanceAngle(10, 0, 10)).toBe(10);
  expect(advanceAngle(10, -1, 10)).toBe(10);
  expect(advanceAngle(advanceAngle(0, 0.04, 10), 0.06, 10)).toBeCloseTo(advanceAngle(0, 0.1, 10));
});

// Fault severity and deposit rates are illustrative (component SOURCES.md), not maintenance limits.

const runBench = (bench: ReturnType<typeof createCylinderBench>, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) bench.advance(0.1);
};
test("fuel cut-off and failed ignition stop work while the driven shaft keeps turning", () => {
  const b = createCylinderBench();
  b.set({ phi: 0 });
  expect(b.s.fuelGph).toBe(0);
  expect(b.s.work).toBe(0);
  expect(b.s.sparks).toEqual([true, true]);
  runBench(b, 10);
  expect(b.s.angle).not.toBe(0);
  expect(b.s.egt).toBeLessThan(1100);
  expect(b.s.cht).toBeLessThan(300);
  expect((1100 - b.s.egt) / (1100 - 59)).toBeGreaterThan(0.4);
  expect((300 - b.s.cht) / (300 - 59)).toBeLessThan(0.1);
  b.scenario("normal");
  b.set({ ignition: "off" });
  expect(b.s.fuelGph).toBeGreaterThan(0);
  expect(b.s.sparks).toEqual([false, false]);
  expect(b.s.work).toBe(0);
  b.set({ rpm: 0 });
  const angle = b.s.angle;
  runBench(b, 1);
  expect(b.s.angle).toBe(angle);
  expect(b.s.fuelGph).toBe(0);
});
test("single-plug operation reduces work and raises settled EGT at unchanged conditions", () => {
  const healthy = createCylinderBench(),
    failed = createCylinderBench();
  failed.scenario("single");
  runBench(healthy, 30);
  runBench(failed, 30);
  expect(failed.s.work).toBeLessThan(healthy.s.work);
  expect(failed.s.egt).toBeGreaterThan(healthy.s.egt);
  failed.set({ ignition: "top" });
  expect(failed.s.work).toBe(0);
  failed.set({ ignition: "bottom" });
  expect(failed.s.work).toBeGreaterThan(0);
});
test("rich idle progressively fouls plugs; leaning preserves deposits and service restores ignition", () => {
  const b = createCylinderBench();
  b.scenario("rich");
  runBench(b, 8);
  expect(b.s.deposits[1]).toBeGreaterThanOrEqual(0.8);
  expect(b.s.sparks[1]).toBe(false);
  b.set({ phi: 1.15 });
  const deposits = [...b.s.deposits];
  runBench(b, 3);
  expect(b.s.deposits).toEqual(deposits);
  b.service();
  expect(b.s.sparks).toEqual([true, true]);
  expect(b.s.deposits).toEqual([0, 0]);
});
test("stuck valves override lift at every phase and remove useful combustion until repaired", () => {
  const b = createCylinderBench();
  for (const valve of ["intake", "exhaust"] as const) {
    for (const fault of ["open", "closed"] as const) {
      b.scenario("normal");
      b.set({ [valve]: fault });
      for (let angle = 0; angle < 720; angle += 30)
        expect(benchValves(angle, b.c)[valve]).toBe(fault === "open" ? 0.55 : 0);
      expect(b.s.work).toBe(0);
      b.set({ [valve]: "free" });
      expect(b.s.work).toBeGreaterThan(0);
    }
  }
});
test("simulation clock makes faults and temperatures independent of render cadence and playback speed", () => {
  const a = createCylinderBench(),
    b = createCylinderBench();
  a.scenario("rich");
  b.scenario("rich");
  b.set({ playback: 30 });
  for (let i = 0; i < 600; i++) a.advance(1 / 60);
  for (let i = 0; i < 100; i++) b.advance(0.1);
  expect(a.s.cht).toBeCloseTo(b.s.cht, 9);
  expect(a.s.egt).toBeCloseTo(b.s.egt, 9);
  expect(a.s.deposits).toEqual(b.s.deposits);
  b.scenario("normal");
  expect(b.s.deposits).toEqual([0, 0]);
  expect(b.c.intake).toBe("free");
  expect(b.s.seconds).toBe(0);
});

describe("FAA Powerplant Handbook pp. 10-29–10-30 — distinct abnormal combustion mechanisms", () => {
  test("detonation follows spark; reducing charge or enriching suppresses the imposed severe case", () => {
    const b = createCylinderBench();
    b.scenario("detonation");
    expect(b.s.abnormal).toBe("detonation");
    expect(combustionEvent(b.s, b.c, 20)).toBe("detonation");
    expect(combustionEvent(b.s, b.c, 680)).toBe("none");
    b.set({ ignition: "off" });
    expect(b.s.abnormal).toBe("none");
    b.scenario("detonation");
    b.set({ load: 0.5 });
    expect(b.s.abnormal).toBe("none");
    b.scenario("detonation");
    b.set({ phi: 1.4 });
    expect(b.s.abnormal).toBe("none");
  });
  test("pre-ignition precedes the spark and persists without plugs while fuel remains", () => {
    const b = createCylinderBench();
    b.scenario("preignition");
    expect(cylinderAt(670).spark).toBe(false);
    expect(combustionEvent(b.s, b.c, 670)).toBe("preignition");
    expect(combustionEvent(b.s, b.c, 20)).toBe("none");
    b.set({ ignition: "off" });
    expect(b.s.sparks).toEqual([false, false]);
    expect(b.s.firing).toBe(true);
    runBench(b, 10);
    expect(b.s.cht).toBeGreaterThan(465);
    b.set({ phi: 0 });
    expect(b.s.abnormal).toBe("none");
    expect(b.s.firing).toBe(false);
  });
  test("lean backfire occurs at the open intake, and enrichment clears it", () => {
    const b = createCylinderBench();
    b.scenario("backfire");
    expect(combustionEvent(b.s, b.c, 360)).toBe("backfire");
    expect(benchValves(360, b.c).intake).toBeGreaterThan(0);
    expect(combustionEvent(b.s, b.c, 180)).toBe("none");
    b.set({ phi: 1.1 });
    expect(b.s.abnormal).toBe("none");
    b.scenario("backfire");
    b.set({ intake: "closed" });
    expect(combustionEvent(b.s, b.c, 360)).toBe("none");
  });
  test("stopping the shaft, cutting fuel or resetting clears all active abnormal combustion", () => {
    for (const id of ["detonation", "preignition", "backfire"] as const) {
      const b = createCylinderBench();
      for (const patch of [{ rpm: 0 }, { phi: 0 }]) {
        b.scenario(id);
        b.set(patch);
        expect(b.s.abnormal).toBe("none");
        expect(b.s.work).toBe(0);
      }
      b.scenario(id);
      b.scenario("normal");
      expect(b.c.combustionFault).toBe("none");
      expect(b.s.abnormal).toBe("none");
    }
  });
});
