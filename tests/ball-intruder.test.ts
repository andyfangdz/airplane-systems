// Unit tests of the avionics path-clearance oracle (tests/helpers/ballIntruder.ts); they pin the oracle, not aircraft geometry.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { mergeGeos } from "@/lib/geometry";
import { ballIntruder } from "./helpers/ballIntruder";
import { windingNumber, type Tri } from "./winding-number";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const placed = (g: THREE.BufferGeometry, m = new THREE.Matrix4()) => (g.index ? g.toNonIndexed() : g).applyMatrix4(m);

describe("ball intrusion into a placed mesh", () => {
  it("reaches the surface only when the nearest triangle is closer than r (strict at the boundary)", () => {
    const { intrudes } = ballIntruder(placed(new THREE.BoxGeometry(1, 1, 1)));
    expect(intrudes(V(0.55, 0, 0), 0.1)).toBe(true);
    expect(intrudes(V(0.55, 0, 0), 0.04)).toBe(false);
    // 0.25 from the +x face: exactly r stays clear, anything more reaches it
    expect(intrudes(V(0.75, 0, 0), 0.25)).toBe(false);
    expect(intrudes(V(0.75, 0, 0), 0.25 + 1e-9)).toBe(true);
    // nearest is a corner, not a face
    expect(intrudes(V(0.6, 0.6, 0.6), Math.sqrt(0.03) + 1e-9)).toBe(true);
    expect(intrudes(V(0.6, 0.6, 0.6), Math.sqrt(0.03) - 1e-9)).toBe(false);
  });

  it("counts a point deep inside a closed solid even when every face is farther than r", () => {
    const { intrudes } = ballIntruder(placed(new THREE.BoxGeometry(1, 1, 1)));
    expect(intrudes(V(0, 0, 0), 0.01)).toBe(true);
    expect(intrudes(V(0.3, -0.2, 0.1), 0.01)).toBe(true);
    expect(intrudes(V(1.5, 0, 0), 0.01)).toBe(false);
  });

  it("keeps the inside branch for mirrored parts and overlapping merged pieces", () => {
    const mirrored = ballIntruder(placed(new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4().makeScale(-1, 1, 1)));
    expect(mirrored.intrudes(V(0, 0, 0), 0.01)).toBe(true);
    const merged = ballIntruder(
      placed(mergeGeos([new THREE.BoxGeometry(1, 1, 1), new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0)])),
    );
    expect(merged.intrudes(V(0.25, 0, 0), 0.01)).toBe(true); // in both pieces
    expect(merged.intrudes(V(0.9, 0, 0), 0.01)).toBe(true); // in the second only
  });

  it("never treats an open plate as a volume: only its surface distance counts", () => {
    const { intrudes } = ballIntruder(placed(new THREE.PlaneGeometry(1, 1)));
    expect(intrudes(V(0, 0, 0.001), 0.0005)).toBe(false);
    expect(intrudes(V(0, 0, 0.001), 0.002)).toBe(true);
    expect(intrudes(V(0.2, -0.1, -0.3), 0.29)).toBe(false);
  });

  it("matches a brute-force scan of every triangle for random points and radii", () => {
    const g = placed(new THREE.TorusKnotGeometry(0.4, 0.12, 64, 12));
    const pos = g.getAttribute("position");
    const tris: Tri[] = Array.from({ length: pos.count / 3 }, (_, i) => [
      new THREE.Vector3().fromBufferAttribute(pos, 3 * i),
      new THREE.Vector3().fromBufferAttribute(pos, 3 * i + 1),
      new THREE.Vector3().fromBufferAttribute(pos, 3 * i + 2),
    ]);
    const { intrudes, world } = ballIntruder(g);
    const box = world.clone().expandByScalar(0.1),
      size = box.getSize(new THREE.Vector3()),
      q = new THREE.Vector3();
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let hits = 0,
      inside = 0;
    for (let i = 0; i < 1500; i++) {
      const p = V(box.min.x + random() * size.x, box.min.y + random() * size.y, box.min.z + random() * size.z),
        r = 0.002 + random() * 0.08;
      let d = Infinity;
      for (const [a, b, c] of tris)
        d = Math.min(d, new THREE.Triangle(a, b, c).closestPointToPoint(p, q).distanceTo(p));
      const within = Math.abs(windingNumber(p, tris)) > 0.75;
      const expected = d < r || within;
      hits += +expected;
      inside += +(within && d >= r);
      expect(intrudes(p, r), `${p.toArray()} r=${r}`).toBe(expected);
    }
    // both branches were exercised, as were clear points
    expect(hits).toBeGreaterThan(50);
    expect(inside).toBeGreaterThan(10);
    expect(hits).toBeLessThan(1450);
  });
});
