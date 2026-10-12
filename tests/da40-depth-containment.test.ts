import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/da40/parts";
import { FLOWS } from "@/aircraft/da40/flows";
import { AIRFRAME_PORTS } from "@/aircraft/da40/airframe-ports";
import { CANOPY_HINGE, DOOR_HINGE } from "@/aircraft/da40/parts/airframe";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
import { curveOf } from "@/lib/geometry";
import { toV } from "@/lib/math";

describe("DA40 full hardware and rendered tube-wall containment", () => {
  it("keeps every fixed internal mesh and closed door bolt within the real skin", () => {
    const bad: string[] = [];
    for (const p of CAT.parts.filter((p) => !p.ext && (!p.parent || p.parent === "canopy" || p.parent === "door"))) {
      const m = new THREE.Matrix4().compose(
        toV(p.pos ?? [0, 0, 0]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
        toV(p.scale ?? [1, 1, 1]),
      );
      if (p.parent)
        m.premultiply(new THREE.Matrix4().makeTranslation(...(p.parent === "canopy" ? CANOPY_HINGE : DOOR_HINGE)));
      const g = p.geo(),
        a = g.getAttribute("position");
      let first: THREE.Vector3 | undefined,
        count = 0;
      for (let i = 0; i < a.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m);
        if (!insideFleetAirframe("da40", v, -0.0001)) {
          first ??= v;
          count++;
        }
      }
      if (first)
        bad.push(
          `${p.name}: ${count}/${a.count} at ${first
            .toArray()
            .map((v) => v.toFixed(4))
            .join(",")}`,
        );
      g.dispose();
    }
    expect(bad).toEqual([]);
  });
  it("contains the complete curve and tube radius except named physical ports", () => {
    const bad: string[] = [];
    for (const f of FLOWS.filter((f) => !f.ext && f.tube !== false)) {
      const c = curveOf(f.pts, f.tension ?? 0.3),
        g = new THREE.TubeGeometry(c, Math.max(80, Math.ceil(c.getLength() * 60)), f.r ?? 0.012, 8, false),
        a = g.getAttribute("position");
      let first: THREE.Vector3 | undefined,
        count = 0;
      for (let i = 0; i < a.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(a, i);
        if (
          !insideFleetAirframe("da40", v, -0.0001) &&
          !(AIRFRAME_PORTS[f.key] ?? []).some((port) => v.distanceTo(toV(port.point)) <= port.reach)
        ) {
          first ??= v;
          count++;
        }
      }
      if (first)
        bad.push(
          `${f.key}: ${count}/${a.count} at ${first
            .toArray()
            .map((v) => v.toFixed(4))
            .join(",")}`,
        );
      g.dispose();
    }
    expect(bad).toEqual([]);
  });
});
