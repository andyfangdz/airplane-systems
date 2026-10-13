import * as THREE from "three";
import { expect, it } from "vitest";
import { curvedSkinPatch, inPolygon } from "@/lib/skin-patch";
import { cutBoxes } from "@/lib/cowl";

it("triangulates a curved aperture with outward faces, finite attributes and a sampled curvature bound", () => {
  const outline = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hole = [
    [-0.3, -0.3],
    [0.3, -0.3],
    [0.3, 0.3],
    [-0.3, 0.3],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const parameter = (p: THREE.Vector3) => new THREE.Vector2(p.x, Math.atan2(p.y, p.z));
  const g = curvedSkinPatch({
    outline,
    holes: [hole],
    side: 1,
    point: (p) => new THREE.Vector3(p.x, Math.sin(p.y), Math.cos(p.y)),
    parameter,
    normal: (p) => new THREE.Vector3(0, p.y, p.z).normalize(),
    uv: (p) => [p.x, p.y],
  });
  const p = g.getAttribute("position");
  expect(p.count / 3).toBeLessThan(20_000);
  for (const a of Object.values(g.attributes)) expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
  for (let i = 0; i < p.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, i + j));
    const centre = a.clone().add(b).add(c).divideScalar(3),
      face = b.clone().sub(a).cross(c.clone().sub(a));
    expect(face.dot(new THREE.Vector3(0, centre.y, centre.z))).toBeGreaterThan(0);
    expect(inPolygon(parameter(centre), hole)).toBe(false);
    for (const v of [centre, a.clone().lerp(b, 0.5), b.clone().lerp(c, 0.5), c.clone().lerp(a, 0.5)])
      expect(Math.abs(Math.hypot(v.y, v.z) - 1)).toBeLessThan(0.000401);
  }
  g.dispose();
});

it("keeps a rectangular aperture identical on coarse and dense skin and interpolates its paint UVs", () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-0.3, -0.1, -0.2), new THREE.Vector3(0.3, 0.1, 0.2));
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const segments of [1, 17]) {
    const g = cutBoxes(new THREE.PlaneGeometry(2, 2, segments, segments).rotateX(-Math.PI / 2), [bounds]);
    const p = g.getAttribute("position"),
      uv = g.getAttribute("uv"),
      tri = new THREE.Triangle();
    let area = 0;
    for (let i = 0; i < p.count; i += 3) {
      tri.a.fromBufferAttribute(p, i);
      tri.b.fromBufferAttribute(p, i + 1);
      tri.c.fromBufferAttribute(p, i + 2);
      area += tri.getArea();
    }
    expect(area).toBeCloseTo(4 - 0.6 * 0.4, 6);
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeCloseTo((p.getX(i) + 1) / 2, 6);
      expect(uv.getY(i)).toBeCloseTo((1 - p.getZ(i)) / 2, 6);
    }
    const mesh = new THREE.Mesh(g, material);
    for (const [x, z, open] of [
      [0, 0, true],
      [0.299, 0.199, true],
      [0.301, 0, false],
      [0, 0.201, false],
    ] as const) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh);
      expect(hits.length === 0).toBe(open);
    }
    g.dispose();
  }
  material.dispose();
});
