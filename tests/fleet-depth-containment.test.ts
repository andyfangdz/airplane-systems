/** Whole physical envelopes, including moving-group origins and rendered tube radii.
 * These assert drawing consistency with the schematic skins, not surveyed maintenance clearances.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT as C172 } from "@/aircraft/c172s/parts";
import { CAT as C182 } from "@/aircraft/c182t/parts";
import { CAT as DA40 } from "@/aircraft/da40/parts";
import { CAT as M20C } from "@/aircraft/m20c/parts";
import { FLOWS as C172_FLOWS } from "@/aircraft/c172s/flows";
import { FLOWS as C182_FLOWS } from "@/aircraft/c182t/flows";
import { FLOWS as DA40_FLOWS } from "@/aircraft/da40/flows";
import { FLOWS as M20C_FLOWS } from "@/aircraft/m20c/flows";
import { AIRFRAME_PORTS as C172_PORTS } from "@/aircraft/c172s/airframe-ports";
import { AIRFRAME_PORTS as C182_PORTS } from "@/aircraft/c182t/airframe-ports";
import { AIRFRAME_PORTS as DA40_PORTS } from "@/aircraft/da40/airframe-ports";
import { AIRFRAME_PORTS as M20C_PORTS } from "@/aircraft/m20c/airframe-ports";
import { groupMatrix as c172Parent } from "@/aircraft/c172s/walk";
import { groupMatrix as c182Parent } from "@/aircraft/c182t/walk";
import { groupMatrix as da40Parent } from "@/aircraft/da40/walk";
import { groupMatrix as m20cParent } from "@/aircraft/m20c/walk";
import { curveOf } from "@/lib/geometry";
import { toV } from "@/lib/math";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
import { worldGeometry, firstSurfaceSample } from "./placement-helpers";

const fleet = [
  { id: "c172s", cat: C172, flows: C172_FLOWS, ports: C172_PORTS, parent: c172Parent },
  { id: "c182t", cat: C182, flows: C182_FLOWS, ports: C182_PORTS, parent: c182Parent },
  { id: "da40", cat: DA40, flows: DA40_FLOWS, ports: DA40_PORTS, parent: da40Parent },
  { id: "m20c", cat: M20C, flows: M20C_FLOWS, ports: M20C_PORTS, parent: m20cParent },
] as const;
const location = (p: THREE.Vector3) =>
  p
    .toArray()
    .map((v) => v.toFixed(4))
    .join(", ");

describe.each(fleet)("$id complete airframe containment", ({ id, cat, flows, ports, parent }) => {
  // A tenth of a millimetre absorbs Float32/interpolation noise, not visible protrusions.
  const contained = (p: THREE.Vector3) => insideFleetAirframe(id, p, -0.0001);

  it("keeps every internal catalogue mesh inside the skin in its neutral ground pose", () => {
    const failures: string[] = [];
    for (const part of cat.parts.filter((p) => !p.ext)) {
      // A geometry factory may retain its mesh: never transform or dispose its original in the audit.
      const g = worldGeometry(
        { ...part, geo: () => part.geo().clone() },
        part.parent ? parent(part.parent) : undefined,
      );
      try {
        const outside = firstSurfaceSample(g, (p) => !contained(p));
        if (outside) failures.push(`${part.name ?? part.id}: ${location(outside)}`);
      } finally {
        g.dispose();
      }
    }
    expect(failures, "Internal mesh vertices, edges or faces outside the modeled skin").toEqual([]);
  });

  it("keeps complete internal curves and tube walls inside, apart from named physical port stubs", () => {
    const failures: string[] = [];
    for (const flow of flows.filter((f) => !f.ext)) {
      const inside = (p: THREE.Vector3) =>
        contained(p) || (ports[flow.key] ?? []).some((port) => p.distanceTo(toV(port.point)) <= port.reach);
      const curve = curveOf(flow.pts, flow.tension ?? 0.3);
      const centreOutside = curve.getPoints(600).find((p) => !inside(p));
      if (centreOutside) failures.push(`${flow.key} centerline: ${location(centreOutside)}`);
      if (flow.tube === false) continue;
      const g = new THREE.TubeGeometry(
        curve,
        Math.max(24, Math.round(curve.getLength() * 28)),
        flow.r ?? 0.012,
        6,
        false,
      );
      try {
        const outside = firstSurfaceSample(g, (p) => !inside(p));
        if (outside) failures.push(`${flow.key} tube wall: ${location(outside)}`);
      } finally {
        g.dispose();
      }
    }
    expect(failures, "Internal pipes/wires outside the modeled skin").toEqual([]);
  });

  it("names real routes for every bounded exterior-port transition", () => {
    const keys = new Set(flows.map((f) => f.key));
    expect(keys.size).toBe(flows.length);
    for (const [key, apertures] of Object.entries(ports)) {
      expect(keys.has(key), key).toBe(true);
      for (const port of apertures) {
        expect(port.point.every(Number.isFinite), key).toBe(true);
        expect(port.reach, key).toBeGreaterThan(0);
        expect(Number.isFinite(port.reach), key).toBe(true);
      }
    }
  });
});
