/** Physical skin checks: actual neutral shell union, including tube walls and local service openings.
 * Approximate installation shapes are still required to fit the study model. */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/m20c/parts";
import { FLOWS } from "@/aircraft/m20c/flows";
import { AIRFRAME_PORTS } from "@/aircraft/m20c/airframe-ports";
import { insideFleetAirframe } from "./fleet-airframe-helpers";
import { worldGeometry } from "./placement-helpers";
import { curveOf } from "@/lib/geometry";
describe("M20C serial680194 internal installations", () => {
  it("contains complete fixed hardware envelopes in the actual curved skins", () => {
    const failures: string[] = [];
    for (const part of CAT.parts.filter((p) => !p.ext && !p.parent)) {
      const g = worldGeometry(part);
      try {
        const positions = g.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i);
          if (!insideFleetAirframe("m20c", p, -0.0001)) {
            failures.push(`${part.name ?? part.id}: ${p.toArray()}`);
            break;
          }
        }
      } finally {
        g.dispose();
      }
    }
    expect(failures).toEqual([]);
  });
  it("contains all internal route centerlines and rendered tube radius, allowing only named opening throats", () => {
    const failures: string[] = [];
    for (const f of FLOWS.filter((f) => !f.ext)) {
      const curve = curveOf(f.pts, f.tension ?? 0.3),
        ports = AIRFRAME_PORTS[f.key] ?? [];
      const allowed = (p: THREE.Vector3) =>
        insideFleetAirframe("m20c", p, -0.0001) ||
        ports.some((port) => p.distanceTo(new THREE.Vector3(...port.point)) <= port.reach);
      const samples = curve.getPoints(600);
      if (f.tube !== false) {
        const g = new THREE.TubeGeometry(
          curve,
          Math.max(24, Math.floor(curve.getLength() * 28)),
          f.r ?? 0.012,
          6,
          false,
        );
        try {
          const v = g.getAttribute("position");
          for (let i = 0; i < v.count; i++) samples.push(new THREE.Vector3().fromBufferAttribute(v, i));
        } finally {
          g.dispose();
        }
      }
      const p = samples.find((p) => !allowed(p));
      if (p) failures.push(`${f.key}: ${p.toArray()}`);
    }
    expect(failures).toEqual([]);
  });
});
