// The npm override vendor/robust-in-sphere feeds cdt2d's Delaunay flips (lib/skin-patch.ts), which read only the sign of
// the 2-D in-circle test. A wrong sign or tie would silently change skin triangles, so pin it against exact arithmetic.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type P = [number, number];
const inCircle: (a: P, b: P, c: P, d: P) => number = createRequire(import.meta.url)("robust-in-sphere")[4];

/** A double as an exact m·2^e with BigInt m. */
const exact = (x: number): [bigint, number] => {
  if (x === 0) return [0n, 0];
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0),
    biased = (hi >>> 20) & 0x7ff;
  const fraction = (BigInt(hi & 0xfffff) << 32n) | BigInt(view.getUint32(4));
  const m = biased ? fraction | (1n << 52n) : fraction;
  return [hi >>> 31 ? -m : m, (biased || 1) - 1075];
};
/** Sign of Shewchuk's in-circle determinant, evaluated exactly: positive when d is inside the circle through a, b, c
 * taken counter-clockwise, zero when the four points are cocircular. */
const exactSign = (...pts: P[]) => {
  const parts = pts.flat().map(exact),
    e0 = Math.min(...parts.map(([, e]) => e));
  const [ax, ay, bx, by, cx, cy, dx, dy] = parts.map(([m, e]) => m << BigInt(e - e0));
  const [adx, ady, bdx, bdy, cdx, cdy] = [ax - dx, ay - dy, bx - dx, by - dy, cx - dx, cy - dy];
  const det =
    (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) +
    (bdx * bdx + bdy * bdy) * (cdx * ady - adx * cdy) +
    (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
  return det > 0n ? 1 : det < 0n ? -1 : 0;
};
const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const nextUp = (x: number, steps = 1) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigInt64(0, view.getBigInt64(0) + BigInt(x >= 0 ? steps : -steps));
  return view.getFloat64(0);
};
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("robust-in-sphere override (2-D in-circle)", () => {
  it("agrees with exact arithmetic for general positions, at small and large scales", () => {
    for (const scale of [1e-6, 1, 1e6])
      for (let i = 0; i < 2000; i++) {
        const pts = Array.from({ length: 4 }, () => [(random() - 0.5) * scale, (random() - 0.5) * scale] as P);
        expect(sign(inCircle(pts[0], pts[1], pts[2], pts[3]))).toBe(exactSign(...pts));
      }
  });

  it("returns exactly zero for cocircular grid points, as cdt2d's interior seeds produce", () => {
    // skin-patch seeds a 0.06 grid; every rectangle's corners are cocircular
    const g = (i: number, j: number): P => [0.3 + i * 0.06, -0.2 + j * 0.06];
    let ties = 0;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        for (const [w, h] of [
          [1, 1],
          [2, 1],
          [1, 3],
        ]) {
          const quad: P[] = [g(i, j), g(i + w, j), g(i + w, j + h), g(i, j + h)];
          const expected = exactSign(...quad);
          ties += +(expected === 0);
          expect(sign(inCircle(quad[0], quad[1], quad[2], quad[3]))).toBe(expected);
        }
    // decimal grid steps are inexact in binary, so only some rectangles stay exactly cocircular; those must stay ties
    expect(ties).toBeGreaterThan(0);
    const unit: P[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(inCircle(unit[0], unit[1], unit[2], unit[3])).toBe(0);
  });

  it("decides nearly cocircular points one ulp either side of the circle", () => {
    const a: P = [0, 0],
      b: P = [1, 0],
      c: P = [1, 1];
    for (const steps of [1, 2, 1000]) {
      for (const d of [
        [nextUp(0, steps), 1],
        [-nextUp(0, steps), 1],
        [0, nextUp(1, steps)],
        [0, nextUp(1, -steps)],
      ] as P[]) {
        const expected = exactSign(a, b, c, d);
        expect(expected).not.toBe(0);
        expect(sign(inCircle(a, b, c, d))).toBe(expected);
      }
    }
  });

  it("flips sign with the orientation of a, b, c", () => {
    for (let i = 0; i < 500; i++) {
      const [a, b, c, d] = Array.from({ length: 4 }, () => [random(), random()] as P);
      expect(sign(inCircle(a, c, b, d))).toBe(-sign(inCircle(a, b, c, d)));
      expect(sign(inCircle(a, c, b, d))).toBe(exactSign(a, c, b, d));
    }
  });

  it("refuses the dimensions cdt2d never asks for", () => {
    const sphere = createRequire(import.meta.url)("robust-in-sphere");
    expect(sphere).toHaveLength(5);
    for (const n of [0, 1, 2, 3]) expect(() => sphere[n]()).toThrow(/only the 2-D test/);
  });
});
