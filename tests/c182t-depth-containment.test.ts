import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/c182t/parts";
import { SYSTEM_DEPTH_PARTS } from "@/aircraft/c182t/parts/systems-depth";
import { SYSTEM_DEPTH_FLOWS } from "@/aircraft/c182t/systems-depth-flow";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
import { curveOf } from "@/lib/geometry";
import { toV } from "@/lib/math";
void CAT;
describe("C182T added internal hardware and complete rendered routes", () => {
  for (const p of SYSTEM_DEPTH_PARTS.filter((p) => !p.ext))
    it(p.name ?? p.id, () => {
      const g = p.geo(),
        a = g.getAttribute("position"),
        m = new THREE.Matrix4().compose(
          toV(p.pos ?? [0, 0, 0]),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
          toV(p.scale ?? [1, 1, 1]),
        );
      const bad: string[] = [];
      for (let i = 0; i < a.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m);
        if (!insideFleetAirframe("c182t", v, -0.0001))
          bad.push(
            v
              .toArray()
              .map((n) => n.toFixed(5))
              .join(","),
          );
      }
      g.dispose();
      expect(bad.slice(0, 3)).toEqual([]);
    });
  for (const f of SYSTEM_DEPTH_FLOWS)
    it(f.key, () => {
      const c = curveOf(f.pts, f.tension ?? 0.3),
        r = f.r ?? 0.012,
        g = new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 28)), r, 6, false),
        a = g.getAttribute("position"),
        bad: string[] = [];
      for (let i = 0; i < a.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(a, i);
        if (!insideFleetAirframe("c182t", v, -0.0001))
          bad.push(
            v
              .toArray()
              .map((n) => n.toFixed(5))
              .join(","),
          );
      }
      g.dispose();
      expect(bad.slice(0, 3)).toEqual([]);
    });
});
