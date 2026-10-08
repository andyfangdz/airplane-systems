import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { loft } from "@/lib/geometry";
import { sidePaintUV } from "@/lib/livery";
import { FLEET } from "@/aircraft";
import { LIVERY_REGISTRATION } from "@/aircraft/liveries";
import { initialSim as skylane } from "@/aircraft/c182t/model";

const box = { x0: -5, x1: 5, y0: -2, y1: 3 };

/** The side rings and end caps must enclose the same solid, for either station order. */
describe("closed loft lighting and culling", () => {
  it.each([1, -1])("points every face outward when the loft runs in direction %s", (direction) => {
    const rings = [-1, 1].map((x) =>
      Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return new THREE.Vector3(x * direction, Math.sin(a), Math.cos(a));
      }),
    );
    const g = loft(rings),
      p = g.attributes.position,
      n = g.attributes.normal,
      ix = g.index!;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < ix.count; i += 3) {
      a.fromBufferAttribute(p, ix.getX(i));
      b.fromBufferAttribute(p, ix.getX(i + 1));
      c.fromBufferAttribute(p, ix.getX(i + 2));
      const center = a.clone().add(b).add(c).divideScalar(3);
      const normal = b.sub(a).cross(c.sub(a)).normalize();
      expect(normal.dot(center)).toBeGreaterThan(0.9);
    }
    // Cap centres and their duplicated rims have flat normals, not smoothed side normals.
    for (let i = 48; i < p.count; i++) {
      expect(Math.abs(n.getX(i))).toBeCloseTo(1);
      expect(n.getY(i)).toBeCloseTo(0);
      expect(n.getZ(i)).toBeCloseTo(0);
    }
    g.dispose();
  });
});

it("unwraps lettering in opposite directions on port/starboard without blending across atlas halves", () => {
  const source = new THREE.BoxGeometry(4, 2, 1);
  const g = sidePaintUV(source, box),
    p = g.attributes.position,
    uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    const right = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2) >= 0;
    for (let j = i; j < i + 3; j++) {
      const u = (p.getX(j) - box.x0) / (box.x1 - box.x0);
      expect(uv.getX(j)).toBeCloseTo(right ? u / 2 : 1 - u / 2);
      expect(uv.getX(j) >= 0.5).toBe(!right);
    }
  }
  g.dispose();
});

describe.each(FLEET)("$id exterior geometry", (def) => {
  it("has finite positions, normals and UVs on painted shells and moving surfaces", () => {
    for (const spec of [...def.labels!.cat.shells, ...def.labels!.cat.surfaces]) {
      const g = spec.geo();
      for (const name of ["position", "normal", ...(spec.skin ? ["uv"] : [])]) {
        const a = g.getAttribute(name);
        expect(a, `${def.id}: ${spec.name} ${name}`).toBeDefined();
        expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      }
      g.dispose();
    }
  });
  it("keeps the fin's paint on its hinged rudder", () => {
    const fin = def.labels!.cat.shells.find((s) => s.name === "Vertical stabilizer")!;
    const rudder = def.labels!.cat.surfaces.find((s) => s.key === "rudder")!;
    expect(fin.skin).toBeTypeOf("function");
    expect(rudder.skin).toBe(fin.skin);
  });
});

it("uses the requested registrations and the photographed N8050J wheel configuration", () => {
  expect(LIVERY_REGISTRATION).toEqual({ sr20: "N800KP", c172s: "N6189Q", c182t: "N8050J", da40: "N949KC" });
  expect(skylane.gear.fairings).toBe(false);
});
