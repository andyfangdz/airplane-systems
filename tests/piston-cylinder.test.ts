import { describe, expect, test } from "vitest";
import { advanceAngle, cylinderAt, geometry, rodLength } from "@/engines/components/piston-cylinder/model";

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
