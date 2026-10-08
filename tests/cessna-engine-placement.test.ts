import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { tubeGeo } from "@/lib/geometry";
import { CAT as C172, CYLS as CYLS172, INTAKES as INTAKES172, NOZZLES as NOZZLES172 } from "@/aircraft/c172s/parts";
import { CAT as C182, CYLS as CYLS182, INTAKES as INTAKES182, NOZZLES as NOZZLES182 } from "@/aircraft/c182t/parts";
import { FLOWS as F172 } from "@/aircraft/c172s/flows";
import { FLOWS as F182 } from "@/aircraft/c182t/flows";
import { AF as A172 } from "@/aircraft/c172s/geometry";
import { AF as A182 } from "@/aircraft/c182t/geometry";
import { namedPart, partBounds, points, worldGeometry } from "./placement-helpers";

function crossesBox(geometry: THREE.BufferGeometry, box: THREE.Box3) {
  const vertices = points(geometry);
  const index = geometry.getIndex();
  const count = index?.count ?? vertices.length;
  const triangle = new THREE.Triangle();
  const vertex = (i: number) => vertices[index ? index.getX(i) : i];
  for (let i = 0; i < count; i += 3) {
    triangle.set(vertex(i), vertex(i + 1), vertex(i + 2));
    if (box.intersectsTriangle(triangle)) return true;
  }
  return false;
}

// These test the consistency of the illustrative installation, not certified component dimensions.
describe.each([
  ["C172S", C172, A172, CYLS172, INTAKES172, NOZZLES172, F172, "Lycoming IO-360-L2A", -27.5, -11],
  ["C182T", C182, A182, CYLS182, INTAKES182, NOZZLES182, F182, "Lycoming IO-540-AB1A5", -35.2, -11.4],
] as const)(
  "%s engine installation",
  (_id, cat, airframe, cylinders, intakes, nozzles, flows, engineName, filterArm, coolerArm) => {
    it("retains equipment-list filter and cooler arms (POH Section 6)", () => {
      expect(namedPart(cat, "Induction air filter").pos![0]).toBeCloseTo(airframe.X(filterArm), 8);
      expect(namedPart(cat, "Oil cooler").pos![0]).toBeCloseTo(airframe.X(coolerArm), 8);
    });

    it("mounts the sump beneath the crankcase without clipping the filter or servo", () => {
      const sump = partBounds(namedPart(cat, "Oil sump"));
      const engine = partBounds(namedPart(cat, engineName));
      expect(Math.abs(sump.max.y - engine.min.y)).toBeLessThan(0.005);
      for (const name of ["Induction air filter", "Fuel/air control unit (servo)"]) {
        expect(sump.intersectsBox(partBounds(namedPart(cat, name))), name).toBe(false);
      }
    });

    it("fits the cooler and starter inside the cowl and clear of the crankcase and spark plugs", () => {
      const obstacles = cat.parts.filter((p) => p.name === engineName || p.name?.startsWith("Spark plug —"));
      for (const name of ["Oil cooler", "Starter"]) {
        const part = namedPart(cat, name);
        const mesh = worldGeometry(part);
        expect(
          points(mesh).every((p) => airframe.inFus(p, 0.002)),
          name,
        ).toBe(true);
        for (const other of obstacles) {
          expect(partBounds(part).intersectsBox(partBounds(other)), `${name} / ${other.name}`).toBe(false);
        }
        mesh.dispose();
      }
    });

    it("connects injector fittings to their own heads without burying the spark plugs", () => {
      const fittings = cat.parts.filter((p) => p.name === "Fuel injector nozzle");
      expect(fittings).toHaveLength(cylinders.length);
      fittings.forEach((fitting, i) => {
        const n = cylinders[i].n;
        const bounds = partBounds(fitting);
        expect(bounds.intersectsBox(partBounds(namedPart(cat, `Cylinder head ${n}`)))).toBe(true);
        for (const level of ["upper", "lower"]) {
          expect(bounds.intersectsBox(partBounds(namedPart(cat, `Spark plug — cyl ${n} ${level}`)))).toBe(false);
        }
        expect(fitting.pos).toEqual(nozzles[i]);
        const line = flows.find((f) => f.key === `inj${n}`)!;
        expect(line.pts.at(-1)).toEqual(fitting.pos);
        const mesh = tubeGeo(line.pts, line.r!);
        expect(
          points(mesh).every((p) => airframe.inFus(p, 0.002)),
          `injector line ${n}`,
        ).toBe(true);
        mesh.dispose();
      });
    });

    it("routes intake tubes clear of the sump, filter, exhaust and alternator with matching air particles", () => {
      const obstacles = cat.parts.filter((p) =>
        ["Oil sump", "Induction air filter", "Muffler", "Muffler heater shroud", "Alternator — 28 V, 60 A"].includes(
          p.name ?? "",
        ),
      );
      const runners = cat.parts.filter((p) => p.name === "Intake tube" || p.name === "Intake manifold tube");
      expect(runners).toHaveLength(cylinders.length);
      runners.forEach((part, i) => {
        const mesh = worldGeometry(part);
        for (const other of obstacles) {
          const bounds = partBounds(other);
          const label = `intake ${cylinders[i].n} / ${other.name}`;
          if (other.name?.startsWith("Muffler")) {
            // The pipes pass the round shroud corners; an AABB alone falsely reports contact there.
            const center = bounds.getCenter(new THREE.Vector3());
            const axis = _id === "C172S" ? "z" : "x";
            const radial = axis === "z" ? "x" : "z";
            const radius = (bounds.max.y - bounds.min.y) / 2;
            expect(
              points(mesh).every(
                (p) =>
                  p[axis] < bounds.min[axis] ||
                  p[axis] > bounds.max[axis] ||
                  Math.hypot(p.y - center.y, p[radial] - center[radial]) > radius + 0.001,
              ),
              label,
            ).toBe(true);
          } else {
            expect(crossesBox(mesh, bounds), label).toBe(false);
          }
        }
        expect(points(mesh).every((p) => airframe.inFus(p, 0.002))).toBe(true);
        expect(flows.find((f) => f.key === `man${cylinders[i].n}`)!.pts).toEqual(intakes[i]);
        mesh.dispose();
      });
    });
  },
);

it("leaves an opening in the C172S bank-top baffles for the flow divider", () => {
  const mesh = worldGeometry(namedPart(C172, "Cylinder baffles"));
  expect(crossesBox(mesh, partBounds(namedPart(C172, "Fuel distribution unit (flow divider)")))).toBe(false);
  mesh.dispose();
});

it("keeps the C182T aft-doorpost manifolds within the wing root or cabin skin (POH Fig. 7-6)", () => {
  const manifolds = C182.parts.filter((p) => p.name === "Fuel manifold (aft door post)");
  expect(manifolds).toHaveLength(2);
  for (const part of manifolds) {
    const mesh = worldGeometry(part);
    for (const p of points(mesh)) {
      if (A182.inFus(p, 0.002)) continue;
      const c = (A182.wLE(p.z) - p.x) / A182.wC(p.z);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(A182.wingP(p.z, c, -1).y - 0.002);
      expect(p.y).toBeLessThanOrEqual(A182.wingP(p.z, c, 1).y + 0.002);
    }
    mesh.dispose();
  }
});
