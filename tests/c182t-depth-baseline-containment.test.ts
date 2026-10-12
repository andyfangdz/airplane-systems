import * as THREE from "three";
import { expect, it } from "vitest";
import { CAT } from "@/aircraft/c182t/parts";
import { FLOWS } from "@/aircraft/c182t/flows";
import { AIRFRAME_PORTS } from "@/aircraft/c182t/airframe-ports";
import { curveOf } from "@/lib/geometry";
import { toV } from "@/lib/math";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
it("baseline non-parented internal meshes remain inside skins", () => {
  const bad: string[] = [];
  for (const p of CAT.parts.filter((p) => !p.parent && !p.ext)) {
    const g = p.geo(),
      a = g.getAttribute("position"),
      m = new THREE.Matrix4().compose(
        toV(p.pos ?? [0, 0, 0]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
        toV(p.scale ?? [1, 1, 1]),
      );
    for (let i = 0; i < a.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m);
      if (!insideFleetAirframe("c182t", v, -0.0001)) {
        bad.push(`${p.name}:${v.toArray().map((x) => x.toFixed(4))}`);
        break;
      }
    }
    g.dispose();
  }
  expect(bad).toEqual([]);
});
for (const f of FLOWS.filter((f) => !f.ext))
  it(`complete ${f.key} route remains internal except named aperture`, () => {
    const c = curveOf(f.pts, f.tension ?? 0.3),
      r = f.tube === false ? 0 : (f.r ?? 0.012);
    const g = new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 28)), r, 6, false),
      a = g.getAttribute("position"),
      bad: string[] = [];
    for (let i = 0; i < a.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(a, i);
      if (
        !insideFleetAirframe("c182t", v, -0.0001) &&
        !(AIRFRAME_PORTS[f.key] ?? []).some((p) => v.distanceTo(toV(p.point)) <= p.reach)
      )
        bad.push(
          v
            .toArray()
            .map((x) => x.toFixed(5))
            .join(","),
        );
    }
    g.dispose();
    expect(bad.slice(0, 3)).toEqual([]);
  });
