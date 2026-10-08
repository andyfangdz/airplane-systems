/**
 * SR20 POH 11934-005 Fig 1-1 (p. 1-4): length 26.0 ft, height 8.9 ft.
 * Longitudinal proportions retain the previous SR22/SR22T AMM 13773-002 Fig 6-00-2 fit.
 * Its WL values are only normalized sampling stations here, NOT SR20 vertical dimensions.
 * Vertical calibration and every moving attachment now use the SR20 height.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FIN, FIN_TOP, GROUND_Y, HH, fC, fLE, hingeX, finHeight } from "@/aircraft/sr20/geometry";
import { CAT } from "@/aircraft/sr20/parts/catalogue";
import "@/aircraft/sr20/parts";

const FS = (x: number) => (5.15 - x) / 0.0254;
const WL = (h: number) => 100 + (((h + 0.18) * (1.534 + 0.18)) / (FIN_TOP + 0.18) - 0.18 + 0.13) / 0.0254;
const h = (wl: number) => finHeight((wl - 100) * 0.0254 - 0.13);
const te = (wl: number) => FS(fLE(h(wl)) - fC(h(wl)));
const hinge = (wl: number) => FS(hingeX(h(wl)));
const within = (v: number, want: number, tol: number) =>
  expect(Math.abs(v - want), `${v.toFixed(2)} vs ${want}`).toBeLessThanOrEqual(tol);

/** Normal distance (in) from a drawn point (FS, WL) to the model's trailing-edge outline in side view. */
const distToTE = (fs: number, wl: number) => {
  let d = Infinity;
  for (let i = 1; i < FIN.length; i++) {
    const [ax, ay] = [FS(FIN[i - 1][2]), WL(FIN[i - 1][0])],
      [bx, by] = [FS(FIN[i][2]), WL(FIN[i][0])],
      t = Math.max(0, Math.min(1, ((fs - ax) * (bx - ax) + (wl - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    d = Math.min(d, Math.hypot(fs - ax - t * (bx - ax), wl - ay - t * (by - ay)));
  }
  return d;
};

describe("SR20 fin height and retained longitudinal rudder proportions", () => {
  it("rudder trailing edge runs FS 339.3 at WL 110 to 348.4 at WL 162", () => {
    within(te(110), 339.3, 1);
    within(te(130), 342.8, 1);
    within(te(150), 346.2, 1);
    within(te(162), 348.4, 1);
    // the steep lower end, where it meets the tailcone: normal distance to the outline
    expect(distToTE(334.2, 98)).toBeLessThanOrEqual(1.5);
  });

  it("height 8.9 ft and retained aft station (SR20 POH Fig 1-1)", () => {
    expect(Math.max(...FIN.map((r) => r[0])) - GROUND_Y).toBeCloseTo(8.9 * 0.3048, 5);
    within(FS(Math.min(...FIN.map((r) => r[2]))), 350.2, 0.5);
  });

  it("keeps the NAV antenna at the resized fin top", () => {
    const antenna = CAT.parts.find((p) => p.name === "NAV antenna")!;
    const geo = antenna.geo().translate(...antenna.pos!);
    geo.computeBoundingBox();
    expect(geo.boundingBox!.min.y - FIN_TOP).toBeGreaterThanOrEqual(-0.005);
    expect(geo.boundingBox!.max.y - FIN_TOP).toBeLessThan(0.025);
    geo.dispose();
  });

  it("rudder hinges on the split line, FS 320.7 at WL 98 to 339.3 at WL 155, giving a 12.3 in chord at WL 126", () => {
    within(hinge(98), 320.7, 1);
    within(hinge(155), 339.3, 1);
    within(te(126) - hinge(126), 12.3, 0.75);
  });
});

describe("SR20 rudder horn (AMM Fig 6-00-2, Fig 55-40-1)", () => {
  it("the fixed fin ends at the remapped horn joint", () => {
    expect(HH).toBeLessThan(FIN_TOP);
    const fin = CAT.shells.find((s) => s.name === "Vertical stabilizer")!.geo();
    fin.computeBoundingBox();
    expect(fin.boundingBox!.max.y).toBeLessThanOrEqual(HH + 1e-6);
  });

  it("above the joint the rudder is the full chord, with its own leading edge", () => {
    const spec = CAT.surfaces.find((s) => s.key === "rudder")!,
      pos = spec.geo().attributes.position,
      p = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).add(new THREE.Vector3(...spec.pivot));
      if (p.y < HH + 0.01) continue;
      n++;
      expect(p.x, `h ${p.y.toFixed(3)}`).toBeLessThanOrEqual(fLE(p.y) + 1e-6);
      expect(p.x, `h ${p.y.toFixed(3)}`).toBeGreaterThanOrEqual(fLE(p.y) - fC(p.y) - 1e-6);
    }
    expect(n).toBeGreaterThan(0);
    // the forward-most point of each section above the joint is the fin's leading edge, not a step at part chord
    const top = [1.42, 1.47].map(finHeight).map((hh) => {
      let fwd = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).add(new THREE.Vector3(...spec.pivot));
        if (Math.abs(p.y - hh) < 1e-6) fwd = Math.max(fwd, p.x);
      }
      return fwd - fLE(hh);
    });
    for (const d of top) expect(Math.abs(d)).toBeLessThan(0.01);
  });
});
