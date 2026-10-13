/** An open cabin entrance must not expose a harness routed through the doorway.
 * Access volumes are conservative drawing checks, not certified clearance dimensions. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import * as S from "@/aircraft/sr20/geometry";
import * as C from "@/aircraft/c172s/geometry";
import * as T from "@/aircraft/c182t/geometry";
import { CAT as sc } from "@/aircraft/sr20/parts";
import { CAT as cc } from "@/aircraft/c172s/parts";
import { CAT as tc } from "@/aircraft/c182t/parts";
import { FLOWS as sf } from "@/aircraft/sr20/flows";
import { FLOWS as cf } from "@/aircraft/c172s/flows";
import { FLOWS as tf } from "@/aircraft/c182t/flows";
import { curveOf } from "@/lib/geometry";
import { specGeo } from "@/lib/catalogue";
import { inPolygon } from "@/lib/skin-patch";
import { fuselageNormal } from "@/lib/fuselage-openings";
const fleet = [
  { id: "sr20", geo: S, cat: sc, flows: sf, floor: -0.51 },
  { id: "c172s", geo: C, cat: cc, flows: cf, floor: C.Y(29.5) },
  { id: "c182t", geo: T, cat: tc, flows: tf, floor: T.Y(29.5) },
];
const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
describe.each(fleet)("$id finished cabin", ({ geo, cat, flows, floor }) => {
  it("keeps fixed system tubes out of the open entrance above the floor", () => {
    const failures = new Set<string>();
    const doors = geo.DOORS.filter((d) => d.key === "L" || d.key === "R");
    for (const f of flows.filter((f) => f.tube !== false)) {
      const curve = curveOf(f.pts, f.tension ?? 0.3);
      for (let i = 0; i <= 400; i++) {
        const p = curve.getPoint(i / 400);
        if (p.y - (f.r ?? 0.012) <= floor) continue;
        const q = geo.DOOR_SKIN.parameter(p);
        for (const door of doors) {
          if (Math.sign(p.z) !== door.side || !inPolygon(q, door.outline)) continue;
          const edge = Math.abs(geo.DOOR_SKIN.point(q, door.side).z);
          // Exclude the wing outside the opening, include the inboard post/trim space.
          if (Math.abs(p.z) < edge + 0.02 && Math.abs(p.z) > edge - 0.16) failures.add(f.key);
        }
      }
    }
    expect([...failures]).toEqual([]);
  }, 30_000);
  it("has an opaque floor and fixed lining that leaves the open door apertures clear", () => {
    const floorSpec = cat.parts.find((p) => p.name === "Cabin floor covering")!;
    expect(floorSpec.fairing).toBe(true); // inspect the hidden runs in X-ray
    const deck = new THREE.Mesh(specGeo(floorSpec), mat);
    const linings = cat.parts
      .filter((p) => p.name === "Fixed cabin lining")
      .map((p) => new THREE.Mesh(specGeo(p), mat));
    expect(linings).toHaveLength(2);
    const jamb = cat.parts.find((p) => p.name === "Door jamb trim")!;
    expect(jamb.parent).toBeUndefined();
    linings.push(new THREE.Mesh(specGeo(jamb), mat));
    for (const door of geo.DOORS.filter((d) => d.key === "L" || d.key === "R")) {
      const c = door.outline.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(door.outline.length);
      const p = geo.DOOR_SKIN.point(c, door.side),
        n = fuselageNormal(geo.FUSE, p);
      const entry = new THREE.Raycaster(p.clone().addScaledVector(n, 0.02), n.clone().negate(), 0, 0.22);
      expect(entry.intersectObjects(linings)).toHaveLength(0);
      // A person looking down through the doorway sees the floor before its wiring volume.
      const eye = new THREE.Vector3(p.x, floor + 0.3, door.side * 0.2);
      const ray = new THREE.Raycaster(eye, new THREE.Vector3(0, -1, 0), 0, 0.5);
      const hit = ray.intersectObject(deck)[0];
      expect(hit).toBeDefined();
      expect(hit.point.y).toBeCloseTo(floor, 5);
    }
  }, 30_000);
});
