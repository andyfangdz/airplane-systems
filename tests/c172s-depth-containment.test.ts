import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { groupMatrix } from "@/aircraft/c172s/walk";
import { CAT } from "@/aircraft/c172s/parts";
import { FLOWS } from "@/aircraft/c172s/flows";
import { AIRFRAME_PORTS } from "@/aircraft/c172s/airframe-ports";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
import { curveOf } from "@/lib/geometry";
import { points, worldGeometry, partBounds, namedPart } from "./placement-helpers";
import { toV } from "@/lib/math";
/** Checks every rendered vertex, including curve overshoot/tube walls, against the actual curved skin union. */
describe("C172S complete fixed hardware and rendered route containment", () => {
  for (const p of CAT.parts.filter((p) => !p.ext))
    it(p.name ?? p.id, () => {
      const g = worldGeometry(p, p.parent ? groupMatrix(p.parent) : undefined),
        bad = points(g).filter((v) => !insideFleetAirframe("c172s", v, -0.0001));
      g.dispose();
      expect(bad.slice(0, 3).map((v) => v.toArray().map((n) => +n.toFixed(5)))).toEqual([]);
    });
  for (const f of FLOWS.filter((f) => !f.ext))
    it(f.key, () => {
      const c = curveOf(f.pts, f.tension ?? 0.3),
        g = new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 28)), f.r ?? 0.012, 6, false);
      const ports = AIRFRAME_PORTS[f.key] ?? [],
        bad = points(g).filter(
          (v) => !insideFleetAirframe("c172s", v, -0.0001) && !ports.some((p) => v.distanceTo(toV(p.point)) <= p.reach),
        );
      g.dispose();
      expect(bad.slice(0, 3).map((v) => v.toArray().map((n) => +n.toFixed(5)))).toEqual([]);
    });
  it("routes fuel quantity harnesses clear of both display faces and the pilot-side instrument corridor", () => {
    const displays = ["PFD — GDU 1040", "MFD — GDU 1040"].map((name) => partBounds(namedPart(CAT, name)));
    for (const key of ["fuelQtyL", "fuelQtyR"]) {
      const f = FLOWS.find((f) => f.key === key)!,
        curve = curveOf(f.pts, f.tension ?? 0.3),
        g = new THREE.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 28)), f.r ?? 0.012, 6, false);
      const obstructs = points(g).filter((v) =>
        displays.some((b) => v.x < b.max.x && v.y >= b.min.y && v.y <= b.max.y && v.z >= b.min.z && v.z <= b.max.z),
      );
      g.dispose();
      expect(
        obstructs.slice(0, 3).map((v) => v.toArray()),
        key,
      ).toEqual([]);
    }
  });
});
