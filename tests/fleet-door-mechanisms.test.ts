/** Functional geometry checks, independent of mesh density. Aircraft operating sources are in the part notes. */
import "@/aircraft/da40/parts";
import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import * as SR20 from "@/aircraft/sr20/geometry";
import * as C172 from "@/aircraft/c172s/geometry";
import * as C182 from "@/aircraft/c182t/geometry";
import * as M20C from "@/aircraft/m20c/geometry";
import { CAT as sr20 } from "@/aircraft/sr20/parts";
import { CAT as c172 } from "@/aircraft/c172s/parts";
import { CAT as c182 } from "@/aircraft/c182t/parts";
import { CAT as m20c } from "@/aircraft/m20c/parts";
import { DOOR_STRUTS, DOOR_POSE as sr20Pose } from "@/aircraft/sr20/parts/door-motion";
import { REAR_STRUT, DOOR_POSE as da40Pose, BRAKE_RODS } from "@/aircraft/da40/parts/mechanisms";
import { useSR20 } from "@/aircraft/sr20/store";
import { useDA40 } from "@/aircraft/da40/store";
import { cabinLit } from "@/aircraft/sr20/model";
import { doorMatrix } from "@/lib/doors";
import { fuselageNormal } from "@/lib/fuselage-openings";
import type { PartSpec } from "@/lib/catalogue";

const fleet = [
  { id: "sr20", geo: SR20, cat: sr20 },
  { id: "c172s", geo: C172, cat: c172 },
  { id: "c182t", geo: C182, cat: c182 },
  { id: "m20c", geo: M20C, cat: m20c },
];
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const meshOf = (part: PartSpec) => {
  const mesh = new THREE.Mesh(part.geo(), material);
  if (part.pos) mesh.position.fromArray(part.pos);
  if (part.rot) mesh.rotation.set(...part.rot);
  if (part.scale) mesh.scale.fromArray(part.scale);
  return mesh;
};

describe.each(fleet)("$id hinged assemblies", ({ geo, cat }) => {
  it("uses a real opening in the registered hull, filled by the closed assembly and cleared when opened", () => {
    const fixed = new THREE.Mesh(cat.shells.find((s) => s.name === "Fuselage")!.geo(), material);
    const position = fixed.geometry.getAttribute("position");
    expect((fixed.geometry.index?.count ?? position.count) / 3).toBeLessThan(100_000);
    let tailFaces = 0;
    const index = fixed.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) =>
        new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
      );
      if ([a, b, c].every((v) => Math.abs(v.x - geo.FUSE.xTail) < 1e-6)) {
        expect(b.sub(a).cross(c.sub(a)).x).toBeLessThan(0);
        tailFaces++;
      }
    }
    expect(tailFaces).toBeGreaterThan(0);
    for (const x of geo.FUSE.stations)
      for (const q of [-1, 1]) expect(geo.DOOR_SKIN.point(new THREE.Vector2(x, q), 1).z).toBe(0);
    for (const door of geo.DOORS) {
      const center = door.outline.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(door.outline.length);
      const point = geo.DOOR_SKIN.point(center, door.side),
        normal = fuselageNormal(geo.FUSE, point);
      const ray = new THREE.Raycaster(point.clone().addScaledVector(normal, 0.05), normal.clone().negate(), 0, 0.075);
      // A child window's opening is in the door panel, not the main fuselage.
      if (!door.parent) expect(ray.intersectObject(fixed), `${door.key}: fixed skin blocks aperture`).toHaveLength(0);
      const descendants = new Set([door.key]);
      geo.DOORS.filter((d) => d.parent === door.key).forEach((d) => descendants.add(d.key));
      const parts = cat.parts.filter((p) => p.fairing && p.parent && descendants.has(p.parent.slice(5)));
      const meshes = parts.map(meshOf);
      meshes.forEach((m) => m.updateMatrixWorld(true));
      expect(ray.intersectObjects(meshes).length, `${door.key}: closed aperture coverage`).toBeGreaterThan(0);
      for (const mesh of meshes) {
        mesh.matrixAutoUpdate = false;
        mesh.matrix.premultiply(doorMatrix(door, 1));
        mesh.updateMatrixWorld(true);
      }
      expect(ray.intersectObjects(meshes), `${door.key}: opened assembly still occludes aperture`).toHaveLength(0);
      meshes.forEach((m) => m.geometry.dispose());
    }
    fixed.geometry.dispose();
  }, 30_000);

  it("keeps panel/glass vertices, edge midpoints and face centres within 0.75 mm of the analytic skin", () => {
    let worst = 0;
    for (const spec of cat.parts.filter((p) => p.fairing && p.parent?.startsWith("door:"))) {
      const g = spec.geo(),
        p = g.getAttribute("position"),
        index = g.index;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const tri = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j));
        const samples = [
          ...tri,
          ...tri.map((a, j) => a.clone().lerp(tri[(j + 1) % 3], 0.5)),
          tri[0].clone().add(tri[1]).add(tri[2]).divideScalar(3),
        ];
        for (const point of samples) {
          const normal = fuselageNormal(geo.FUSE, point);
          let low = -0.01,
            high = 0.01;
          for (let n = 0; n < 14; n++) {
            const mid = (low + high) / 2;
            if (geo.FUSE.inside(point.clone().addScaledVector(normal, mid))) low = mid;
            else high = mid;
          }
          worst = Math.max(worst, Math.abs((low + high) / 2));
        }
      }
      g.dispose();
    }
    expect(worst).toBeLessThan(0.00075);
  }, 30_000);
});

afterEach(() => {
  Object.assign(sr20Pose, { L: 0, R: 0, bag: 0 });
  da40Pose.rear = 0;
});
it("keeps every strut attachment connected, its barrel rigid, and its rod inside the available stroke throughout opening", () => {
  for (const [index, strut] of [...DOOR_STRUTS, REAR_STRUT].entries()) {
    const meshes = strut.members.map(meshOf);
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      if (index < 2) sr20Pose[index ? "R" : "L"] = fraction;
      else da40Pose.rear = fraction;
      meshes.forEach((mesh, i) => {
        strut.members[i].anim!(mesh, 0);
        mesh.updateMatrixWorld(true);
      });
      const ends = meshes.map((m) => [-0.5, 0.5].map((y) => new THREE.Vector3(0, y, 0).applyMatrix4(m.matrixWorld)));
      const anchors = strut.ends(fraction);
      expect(ends[0][0].distanceTo(anchors.fixed)).toBeLessThan(1e-8);
      expect(ends[0][1].distanceTo(ends[1][0])).toBeLessThan(1e-8);
      expect(ends[1][1].distanceTo(anchors.moving)).toBeLessThan(1e-8);
      expect(ends[0][0].distanceTo(ends[0][1])).toBeCloseTo(strut.bodyLength, 8);
      expect(meshes[1].scale.y).toBeGreaterThan(0);
      expect(meshes[1].scale.y).toBeLessThan(strut.bodyLength);
    }
    meshes.forEach((m) => m.geometry.dispose());
  }
});

it("operates both DA40 masters on the commanded wheel circuit without holding the pistons down with the parking valve", () => {
  const saved = useDA40.getState();
  try {
    const meshes = BRAKE_RODS.map(meshOf);
    for (const diff of [-1, 0, 1]) {
      saved.update((s) => {
        s.gear.diff = diff;
        s.gear.park = true;
      });
      BRAKE_RODS.forEach((p, i) => {
        p.anim!(meshes[i], 0);
        const stroke = p.pos![1] - meshes[i].position.y;
        expect(stroke).toBeCloseTo((i % 2 ? diff > 0 : diff < 0) ? 0.018 : 0, 8);
      });
    }
    meshes.forEach((m) => m.geometry.dispose());
  } finally {
    useDA40.setState(saved);
  }
});

it("uses either SR20 door to trigger convenience lighting", () => {
  const saved = useSR20.getState();
  try {
    for (const right of [false, true]) {
      saved.update((s) => {
        s.lights.cabin = "AUTO";
        s.lights.unlocked = false;
        s.lights.door = !right;
        s.lights.doorR = right;
      });
      const { s, E } = useSR20.getState();
      expect(cabinLit(s, E).dome).toBe(true);
    }
  } finally {
    useSR20.setState(saved);
  }
});
