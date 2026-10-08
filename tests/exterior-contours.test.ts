/** Photo comparisons are documented in aircraft/GEOMETRY_AUDIT.md.
 * These checks guard geometry consistency, not measurements inferred from photos. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cowlOpeningGeo, pantGeo } from "@/lib/geometry";
import { AF as skyhawk } from "@/aircraft/c172s/geometry";
import { AF as skylane } from "@/aircraft/c182t/geometry";
import { AIL } from "@/aircraft/da40/geometry";
import { CAT as diamondParts } from "@/aircraft/da40/parts";
import { CAT as skylaneParts } from "@/aircraft/c182t/parts";

describe.each([skyhawk, skylane])("Cessna local cross sections", (af) => {
  it("keeps skin queries and section rings consistent through cowl/cabin/tail transitions", () => {
    for (const station of [-33, -6, 10, 25, 60, 110, 145, 220]) {
      const x = af.X(station);
      for (const p of af.FUSE.ring(x, 1, 48)) {
        const skin = af.onSkin(x, p.y, p.z < 0 ? -1 : 1, 1);
        expect(skin.z).toBeCloseTo(p.z, 4);
        expect(af.inFus(p, -1e-5)).toBe(true);
        if (Math.abs(p.z) > 0.001 && p.y > af.fus(x).cy) {
          const theta = af.FUSE.thetaAt(x, p.y);
          const projected = af.FUSE.ring(x, 1, 1, theta, theta, false)[0];
          expect(projected.y).toBeCloseTo(p.y, 5);
        }
      }
    }
  });
  it("projects inlet lips onto the nose and leaves their throats open", () => {
    const f = af.FUSE;
    for (const side of [-1, 1]) {
      for (const lip of [false, true]) {
        const g = cowlOpeningGeo(f.frontX, af.Y(53.3), side * 0.275, 0.245, 0.185, 3.2, lip);
        const p = g.attributes.position,
          n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const x = f.frontX(p.getY(i), p.getZ(i));
          if (lip) {
            expect(p.getX(i)).toBeCloseTo(x + 0.006, 5);
            expect(n.getX(i)).toBeGreaterThanOrEqual(0);
          } else {
            expect(Math.min(Math.abs(p.getX(i) - x - 0.003), Math.abs(p.getX(i) - x + 0.077))).toBeLessThan(1e-5);
          }
          expect(f.inside(new THREE.Vector3(x - 0.002, p.getY(i), p.getZ(i)))).toBe(true);
          expect(f.inside(new THREE.Vector3(x + 0.002, p.getY(i), p.getZ(i)))).toBe(false);
        }
        g.dispose();
      }
    }
  });
});

it("leaves the lower tire visible under composite fairings", () => {
  for (const [length, radius] of [
    [0.92, 0.19],
    [0.95, 0.2],
    [0.7, 0.17],
  ]) {
    const g = pantGeo(length, radius);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(length, 5);
    expect(b.min.y).toBeGreaterThan(-radius * 0.7);
    expect(b.max.y).toBeCloseTo(radius, 3);
    expect(Array.from(g.attributes.normal.array).every(Number.isFinite)).toBe(true);
    g.dispose();
  }
});

it("closes the DA40 fixed-skin/aileron seam on both wings", () => {
  const cat = diamondParts;
  for (const [side, label, key] of [
    [1, "Right", "ailR"],
    [-1, "Left", "ailL"],
  ] as const) {
    const wing = cat.shells.find((s) => s.name === `${label} wing`)!.geo();
    const spec = cat.surfaces.find((s) => s.key === key)!;
    const aileron = spec.geo().translate(...spec.pivot);
    const edge = (g: THREE.BufferGeometry, min: boolean) => {
      const p = g.attributes.position;
      const xs = Array.from({ length: p.count }, (_, i) => i)
        .filter((i) => Math.abs(p.getZ(i) - side * AIL.z0) < 1e-5)
        .map((i) => p.getX(i));
      expect(xs.length).toBeGreaterThan(0);
      return min ? Math.min(...xs) : Math.max(...xs);
    };
    expect(edge(wing, true)).toBeCloseTo(edge(aileron, false), 5);
    wing.dispose();
    aileron.dispose();
  }
});

it("keeps C182 engine heads and upper baffles inside the solid cowl", () => {
  const cat = skylaneParts;
  const parts = cat.parts.filter(
    (p) => p.name?.startsWith("Cylinder head") || p.name === "Cylinder baffles" || p.name?.startsWith("Spark plug"),
  );
  expect(parts).toHaveLength(19);
  for (const part of parts) {
    const g = part.geo(),
      pos = g.attributes.position;
    const offset = new THREE.Vector3(...part.pos!);
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).add(offset);
      expect(skylane.inFus(p, -0.002), `${part.name}: ${p.toArray()}`).toBe(true);
    }
    g.dispose();
  }
});
