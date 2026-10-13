/** The fixed post houses its runs in POH Fig 7-1; trim must hide them in a solid cabin view. */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT as c172 } from "@/aircraft/c172s/parts";
import { CAT as c182 } from "@/aircraft/c182t/parts";
import { CABLES as rig172 } from "@/aircraft/c172s/rig";
import { CABLES as rig182 } from "@/aircraft/c182t/rig";
import { FLOWS } from "@/aircraft/c172s/flows";
import { X, Y } from "@/aircraft/c172s/geometry";
import { curveOf } from "@/lib/geometry";
import { toV } from "@/lib/math";
import { partBounds } from "./placement-helpers";

const material = new THREE.MeshBasicMaterial(); // front faces only, as rendered in solid mode
const rayTo = (point: THREE.Vector3) =>
  new THREE.Raycaster(
    new THREE.Vector3(point.x, point.y, 0),
    new THREE.Vector3(0, 0, Math.sign(point.z)),
    0,
    Math.abs(point.z) - 0.006,
  );
describe.each([
  { id: "c172s", cat: c172, rig: rig172 },
  { id: "c182t", cat: c182, rig: rig182 },
])("$id finished forward posts", ({ cat, rig }) => {
  it("covers the actual straight aileron cables with outward-facing trim on both sides", () => {
    const specs = cat.parts.filter((p) => p.name === "Forward door post");
    const meshes = specs.map((p) => new THREE.Mesh(p.geo().clone(), material));
    expect(specs.every((p) => p.fairing)).toBe(true);
    try {
      for (const cable of rig.filter((c) => c.key === "ailL" || c.key === "ailR")) {
        const low = toV(cable.pts[2]),
          high = toV(cable.pts[3]);
        for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
          const point = low.clone().lerp(high, t);
          expect(rayTo(point).intersectObjects(meshes).length, `${cable.name} @ ${t}`).toBeGreaterThan(0);
        }
      }
    } finally {
      meshes.forEach((m) => m.geometry.dispose());
    }
  });
});
it("C172 fuel feeds are behind the post finish, not merely inside the fuselage skin", () => {
  const meshes = c172.parts
    .filter((p) => p.name === "Forward door post")
    .map((p) => new THREE.Mesh(p.geo().clone(), material));
  let count = 0;
  try {
    for (const f of FLOWS.filter((f) => /tank supply line$/.test(f.name ?? ""))) {
      for (const point of curveOf(f.pts, f.tension ?? 0.3).getPoints(600)) {
        if (point.x < X(29.2) || point.x > X(25.5) || point.y < Y(40) || point.y > Y(68)) continue;
        count++;
        expect(rayTo(point).intersectObjects(meshes).length, f.name).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(30);
  } finally {
    meshes.forEach((m) => m.geometry.dispose());
  }
});
it("C172 pressure distribution junctions sit behind the instrument panel", () => {
  const panel = partBounds(c172.parts.find((p) => p.name === "Instrument panel")!);
  for (const name of ["Pitot pressure distribution tee", "Static pressure distribution tee"])
    expect(partBounds(c172.parts.find((p) => p.name === name)!).min.x).toBeGreaterThan(panel.max.x);
});

import * as C172 from "@/aircraft/c172s/geometry";
import * as C182 from "@/aircraft/c182t/geometry";
import { fuselageNormal } from "@/lib/fuselage-openings";
it.each([
  { id: "c172s", cat: c172, geo: C172 },
  { id: "c182t", cat: c182, geo: C182 },
])("$id leaves the side and roof portions of the rear glazing uncovered", ({ cat, geo }) => {
  const meshes = cat.parts
    .filter((p) => p.name === "Fixed cabin lining")
    .map((p) => new THREE.Mesh(p.geo().clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  try {
    for (const side of [-1, 1]) {
      const samples = [geo.WIN.rearSide, geo.WIN.rearWrap].map((poly) => {
        const center = poly
          .reduce((p, [fs, h]) => p.add(new THREE.Vector2(fs, h)), new THREE.Vector2())
          .divideScalar(poly.length);
        return geo.FUSE.onSkin(geo.X(center.x), geo.Y(center.y), side, 1);
      });
      for (const fs of [105, 113, 118]) {
        const roof = geo.WIN.rearRoof;
        const i = roof.findIndex((p) => p[0] > fs);
        const [a, b] = [roof[i - 1], roof[i]];
        const h = a[1] + ((b[1] - a[1]) * (fs - a[0])) / (b[0] - a[0]);
        const q = geo.DOOR_SKIN.parameter(geo.FUSE.onSkin(geo.X(fs), geo.Y(h), side, 1));
        q.y = (q.y + 1) / 2;
        samples.push(geo.DOOR_SKIN.point(q, side));
      }
      for (const p of samples) {
        const n = fuselageNormal(geo.FUSE, p);
        const ray = new THREE.Raycaster(p.clone().addScaledVector(n, 0.02), n.negate(), 0, 0.25);
        expect(ray.intersectObjects(meshes)).toHaveLength(0);
      }
    }
  } finally {
    meshes.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
    });
  }
});
