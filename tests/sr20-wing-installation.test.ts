import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/sr20/parts";
import { FUEL_PITOT_DEPTH_FLOWS } from "@/aircraft/sr20/fuel-pitot-depth-flow";
import { FLOAT_ARM, fuelHeight, wingFuelVolume } from "@/aircraft/sr20/wing-installation";
import { wC, wLE, wingP } from "@/aircraft/sr20/geometry";
import { curveOf } from "@/lib/geometry";
import { useSR20 } from "@/aircraft/sr20/store";
import { toV, V } from "@/lib/math";
import { insideSR20Airframe } from "./sr20-airframe-helpers";
import { partBounds, worldGeometry, firstSurfaceSample } from "./placement-helpers";

const named = (name: string) => CAT.parts.filter((p) => p.name === name);
const sideOf = (side: number, name: string) =>
  named(name).filter((p) => Math.sign(partBounds(p).getCenter(V(0, 0, 0)).z) === side);

it("one open C-section crosses the cabin, while both rear webs end at their own attachment (POH 7-5–6)", () => {
  const [spar] = named("Main spar");
  expect(named("Main spar")).toHaveLength(1);
  const mesh = new THREE.Mesh(worldGeometry(spar), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  // At the carry-through centre, vertical rays meet both flanges, miss the open side beyond them,
  // and a fore/aft ray meets only the web at mid-height.
  const at = wingP(0.35, 0.265);
  expect(new THREE.Raycaster(V(at.x, 0, 0), V(0, -1, 0)).intersectObject(mesh).length).toBeGreaterThanOrEqual(4);
  expect(new THREE.Raycaster(V(wingP(0.35, 0.2).x, 0, 0), V(0, -1, 0)).intersectObject(mesh)).toHaveLength(0);
  const web = new THREE.Raycaster(V(0, at.y, 0), V(1, 0, 0)).intersectObject(mesh);
  expect(web.length).toBeGreaterThanOrEqual(2);
  expect(web.at(-1)!.distance - web[0].distance).toBeLessThan(0.025);
  mesh.geometry.dispose();
  mesh.material.dispose();
  for (const side of [-1, 1]) {
    const main = partBounds(spar);
    const rear = partBounds(sideOf(side, "Aft shear web")[0]);
    expect(rear.min.z * rear.max.z).toBeGreaterThan(0);
    const attachments = sideOf(side, "Wing attach point").sort((a, b) => a.pos![0] - b.pos![0]);
    expect(attachments).toHaveLength(2);
    expect(rear.intersectsBox(partBounds(attachments[0]))).toBe(true);
    expect(main.intersectsBox(partBounds(attachments[1]))).toBe(true);
  }
});

describe.each([-1, 1])("SR20 wet wing on side %i", (side) => {
  it("closes the tank at both sender ribs and places each service cover over its own bay (AMM Figs 6-00-7 and 28-10-3)", () => {
    const volume = wingFuelVolume(side);
    volume.computeBoundingBox();
    const ends = [volume.boundingBox!.min.z, volume.boundingBox!.max.z].map(Math.abs).sort((a, b) => a - b);
    volume.dispose();
    const [inner, outer] = ["Inboard fuel rib", "Outboard fuel rib"].map((name) => partBounds(sideOf(side, name)[0]));
    const midSpan = (bounds: THREE.Box3) => Math.abs(bounds.getCenter(V(0, 0, 0)).z);
    expect(ends[0]).toBeCloseTo(midSpan(inner));
    expect(ends[1]).toBeCloseTo(midSpan(outer));
    for (const strainer of sideOf(side, "Tank outlet strainer"))
      expect(inner.containsPoint(toV(strainer.pos!))).toBe(true);
    const ribs = [inner, ...sideOf(side, "Fuel baffle rib").map((p) => partBounds(p)), outer]
      .map(midSpan)
      .sort((a, b) => a - b);
    const covers = sideOf(side, "Fuel tank access cover")
      .map((p) => partBounds(p))
      .sort((a, b) => midSpan(a) - midSpan(b));
    expect(covers).toHaveLength(3);
    covers.forEach((b, i) => {
      const edges = [Math.abs(b.min.z), Math.abs(b.max.z)];
      expect(Math.min(...edges)).toBeGreaterThan(ribs[i]);
      expect(Math.max(...edges)).toBeLessThan(ribs[i + 1]);
    });
    for (const [cover, drain] of [
      [covers[0], "Tank drain"],
      [partBounds(sideOf(side, "Collector access cover")[0]), "Collector drain"],
    ] as const)
      expect(cover.containsPoint(toV(sideOf(side, drain)[0].pos!))).toBe(true);
  });

  it("leaves passages through the baffles and screened outlets in the sealed inboard rib (AMM 28-10 p. 1)", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const rib of [...sideOf(side, "Inboard fuel rib"), ...sideOf(side, "Fuel baffle rib")]) {
      const mesh = new THREE.Mesh(worldGeometry(rib), material);
      const z = partBounds(rib).getCenter(V(0, 0, 0)).z;
      const hits = (chord: number, height = 0) => {
        const start = wingP(z, chord).lerp(wingP(z, chord, Math.sign(height)), Math.abs(height));
        start.z -= 0.03;
        return new THREE.Raycaster(start, V(0, 0, 1), 0, 0.06).intersectObject(mesh).length;
      };
      if (rib.name === "Inboard fuel rib") {
        expect(hits(0.37)).toBe(0);
        expect(hits(0.53)).toBe(0);
        expect(hits(0.45)).toBeGreaterThan(0);
      } else {
        expect(hits(0.45, -0.2)).toBe(0);
        expect(hits(0.34, -0.82)).toBe(0);
        expect(hits(0.32)).toBeGreaterThan(0);
      }
      mesh.geometry.dispose();
    }
    material.dispose();
  });

  it("moves the two floats with their own tank, reaching the inboard stop first (POH 7-41–44, AMM Fig 28-40-2)", () => {
    const arms = sideOf(side, "Fuel sender float arm").sort((a, b) => Math.abs(a.pos![2]) - Math.abs(b.pos![2]));
    expect(arms).toHaveLength(2);
    const tab = sideOf(side, "Reduced-fuel tab")[0];
    expect(fuelHeight(13 / 28)).toBeCloseTo(tab.pos![1], 6);
    const { qL, qR } = useSR20.getState().s.fuel;
    const update = useSR20.getState().update;
    try {
      const gallons = [0, 3, 7, 13, 20, 24, 28];
      const samples = gallons.map((gal) => {
        update((s) => {
          s.fuel.qL = side < 0 ? gal : 28 - gal;
          s.fuel.qR = side > 0 ? gal : 28 - gal;
        });
        return arms.map((p, i) => {
          const mesh = new THREE.Mesh(p.geo());
          mesh.position.copy(toV(p.pos!));
          p.anim!(mesh, 0);
          mesh.updateMatrix();
          const g = mesh.geometry.applyMatrix4(mesh.matrix);
          expect(firstSurfaceSample(g, (v) => !insideSR20Airframe(v))).toBeUndefined();
          const y = V(0, 0, (i === 0 ? side : -side) * FLOAT_ARM).applyMatrix4(mesh.matrix).y;
          g.dispose();
          return y;
        });
      });
      for (const i of [0, 1]) {
        const heights = samples.map((s) => s[i]);
        expect(heights).toEqual([...heights].sort((a, b) => a - b));
        expect(heights.at(-1)! - heights[0]).toBeGreaterThan(0.05);
        expect(heights.some((v, j) => Math.abs(v - fuelHeight(gallons[j] / 28)) < 1e-6)).toBe(true);
      }
      expect(samples[1][0]).toBeGreaterThan(samples[0][0]);
      expect(samples[1][1]).toBeCloseTo(samples[0][1], 6);
      expect(samples[3][0]).toBeCloseTo(samples.at(-1)![0], 6);
    } finally {
      update((s) => Object.assign(s.fuel, { qL, qR }));
    }
  });
});

it("keeps the pitot, OAT and stall-warning runs outside the sealed wet bays (AMM 28-10 p. 1, Fig 57-10-5)", () => {
  for (const key of ["pitot", "oat1", "oat2", "stall"]) {
    const flow = FUEL_PITOT_DEPTH_FLOWS.find((f) => f.key === key)!;
    const curve = curveOf(flow.pts, flow.tension ?? 0.3);
    const radius = flow.r!;
    for (const p of curve.getSpacedPoints(600)) {
      if (Math.abs(p.z) < 61 * 0.0254 - radius || Math.abs(p.z) > 140 * 0.0254 + radius) continue;
      const chord = (wLE(p.z) - p.x) / wC(p.z);
      expect(chord + radius / wC(p.z) < 0.3 || chord - radius / wC(p.z) > 0.6, key).toBe(true);
    }
  }
});
