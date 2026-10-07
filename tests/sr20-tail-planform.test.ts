/**
 * SR20 horizontal stabilizer and elevator planform against the drawing: AMM 13773-002 Rev 7 Fig 6-00-2 Airplane Principal
 * Dimensions (PDF p. 119; SR22/SR22T, scaled from its FS/BL ticks) and Fig 55-20-2 Detail A (PDF p. 2246, the full-chord
 * elevator tip). The SR20 POH 11934-005 Fig 1-1 plan view (p. 1-4) shows the same shape. Stations in inches.
 */
import { describe, expect, it } from "vitest";
import { EF, HZ, SSPAN, sC, sLE } from "@/aircraft/sr20/geometry";

const FS = (x: number) => (5.15 - x) / 0.0254;
const z = (bl: number) => bl * 0.0254;
const le = (bl: number) => FS(sLE(z(bl)));
const te = (bl: number) => FS(sLE(z(bl)) - sC(z(bl)));
const hinge = (bl: number) => FS(sLE(z(bl)) - EF * sC(z(bl)));
const within = (v: number, want: number, tol: number) =>
  expect(Math.abs(v - want), `${v.toFixed(2)} vs ${want}`).toBeLessThanOrEqual(tol);

/** Plan outline of the tip, (BL, FS): the leading edge from the elevator tip joint out to the tip, then across to the TE. */
const tipOutline = () => {
  const pts: [number, number][] = [];
  for (let bl = HZ / 0.0254; bl < SSPAN / 0.0254; bl += 0.01) pts.push([bl, le(bl)]);
  const tip = SSPAN / 0.0254;
  pts.push([tip, le(tip)], [tip, te(tip)]);
  return pts;
};
/** Normal distance (in) from a drawn point to the model's tip outline. */
const distToTip = (bl: number, fs: number) => {
  const o = tipOutline();
  let d = Infinity;
  for (let i = 1; i < o.length; i++) {
    const [ax, ay] = o[i - 1],
      [bx, by] = o[i],
      l2 = (bx - ax) ** 2 + (by - ay) ** 2,
      t = l2 ? Math.max(0, Math.min(1, ((bl - ax) * (bx - ax) + (fs - ay) * (by - ay)) / l2)) : 0;
    d = Math.min(d, Math.hypot(bl - ax - t * (bx - ax), fs - ay - t * (by - ay)));
  }
  return d;
};

describe("SR20 horizontal stabilizer planform (AMM Fig 6-00-2)", () => {
  it("leading edge sweeps slightly back: FS 294.5 at BL 10 to 301.3 at BL 70", () => {
    within(le(10), 294.5, 1);
    within(le(70), 301.3, 1);
  });

  it("trailing edge sweeps slightly forward: FS 324.3 at BL 10 to 321.3 at BL 70", () => {
    within(te(10), 324.3, 1);
    within(te(70), 321.3, 1);
    expect(te(70)).toBeLessThan(te(10));
  });

  it("tip at BL 77.3", () => within(SSPAN / 0.0254, 77.3, 1));
});

describe("SR20 elevator (AMM Fig 6-00-2, Fig 55-20-2)", () => {
  it("hinges on a straight, unswept line at FS 315.2", () => {
    for (const bl of [0, 36, 72]) within(hinge(bl), 315.2, 0.5);
  });

  it("chord is 9.1 in at BL 10 and 6.1 in at BL 70", () => {
    within(te(10) - hinge(10), 9.1, 0.6);
    within(te(70) - hinge(70), 6.1, 0.6);
  });

  it("is full chord outboard of the tip joint at BL 72, with a rounded leading corner and a square trailing corner", () => {
    within(HZ / 0.0254, 72, 0.5);
    within(le(74), 303.2, 1.5);
    within(le(75), 305.2, 1.5);
    // the steep part of the curve: normal distance from the drawn point to the outline
    expect(distToTip(76, 309.9)).toBeLessThanOrEqual(1);
    expect(distToTip(77, 318.1)).toBeLessThanOrEqual(1);
    within(te(SSPAN / 0.0254), 321.2, 1);
  });
});
