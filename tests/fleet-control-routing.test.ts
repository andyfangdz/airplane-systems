/** Physical engine-control sheaths: separate from fuel/oil/electrical flow paths. */
import { Box3, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CAT as SR20 } from "@/aircraft/sr20/parts";
import { CAT as C172 } from "@/aircraft/c172s/parts";
import { CAT as C182 } from "@/aircraft/c182t/parts";
import { CAT as DA40 } from "@/aircraft/da40/parts";
import { CAT as M20C } from "@/aircraft/m20c/parts";
import { CONTROL_ROUTES as R20 } from "@/aircraft/sr20/parts/control-routing";
import { CONTROL_ROUTES as R172 } from "@/aircraft/c172s/parts/control-routing";
import { CONTROL_ROUTES as R40 } from "@/aircraft/da40/parts/control-routing";
import { CONTROL_ROUTES as RMC } from "@/aircraft/m20c/parts/control-routing";
import { edgeCrossing, inside, tris } from "./mesh-clearance";
import { firstSurfaceSample, worldGeometry } from "./placement-helpers";
import { FUSE } from "@/aircraft/sr20/geometry";

const fleet = [
  { cat: SR20, parts: R20.map((r) => r.spec) },
  { cat: C172, parts: R172.map((r) => r.spec) },
  { cat: C182, parts: C182.parts.filter((p) => p.name === "Throttle cable" || p.name === "Mixture cable") },
  { cat: DA40, parts: R40.map((r) => r.spec) },
  { cat: M20C, parts: RMC.map((r) => r.spec) },
];
describe.each(fleet)("$cat.prefix mechanical control routing", ({ cat, parts }) => {
  it("keeps complete sheaths and ferrules clear of the crankcase, sump and hot muffler", () => {
    const obstacles = cat.parts.filter(
      (p) => /crankcase|oil sump|engine block|muffler/i.test(p.name ?? "") && !p.parent,
    );
    expect(obstacles.length).toBeGreaterThan(0);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    for (const cable of parts) {
      const g = cable.geo();
      const cableTris = tris(g, new Matrix4());
      for (const part of obstacles) {
        const other = worldGeometry({ ...part, geo: () => part.geo().clone() });
        other.computeBoundingBox();
        const mesh = tris(other, new Matrix4());
        const hit = firstSurfaceSample(g, (v) => inside(v, mesh, other.boundingBox!)) ?? edgeCrossing(cableTris, mesh);
        expect(hit, `${cable.name} intersects ${part.name}`).toBeUndefined();
        other.dispose();
      }
      g.dispose();
    }
  });
});

it("SR20 console/firewall sheaths stay inside the curved fuselage", () => {
  for (const { spec } of R20) {
    const g = spec.geo();
    expect(
      firstSurfaceSample(g, (v) => !FUSE.inside(v, -0.0001)),
      spec.name,
    ).toBeUndefined();
    g.dispose();
  }
});

it("rounded routes retain their declared end housings", () => {
  for (const { spec, points } of [...R20, ...R172, ...R40, ...RMC]) {
    const g = spec.geo();
    g.computeBoundingBox();
    for (const p of [points[0], points.at(-1)!]) {
      expect(
        g
          .boundingBox!.clone()
          .expandByScalar(1e-6)
          .containsPoint(new Vector3(...p)),
        spec.name,
      ).toBe(true);
      // Ferrules terminate exactly at the declared endpoint, not short of it after bend rounding.
      const endpoint = new Box3().setFromCenterAndSize(new Vector3(...p), new Vector3(0.008, 0.008, 0.008));
      expect(
        firstSurfaceSample(g, (v) => endpoint.containsPoint(v)),
        spec.name,
      ).toBeDefined();
    }
  }
});
