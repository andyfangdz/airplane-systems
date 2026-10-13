/**
 * SR22T flap actuator station: "A linear actuator, located under the baggage floor, drives a torque tube interconnect
 * between the left and right flaps" (AMM 13773-002 Rev 7 27-50 p. 1, PDF p. 1050). Its rod end bolts to the torque tube
 * coupler, reached through CF4C, and its aft end is pinned to a bracket on the fuselage skin, reached through CF5
 * (27-50 p. 2, PDF p. 1051; Fig 27-50-2 Detail A, PDF p. 1060; Fig 6-00-6 PDF p. 123). The baggage floor runs FS 186 –
 * 222 (POH 13772-007 Fig 1-2, 1-5: 36 in, ending at FS 222).
 */
// precheck: passes-on-base the clearance case guards the new station against its new neighbours (on base the actuator was far from them); the other cases fail on base
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { pulleyGeo } from "@/lib/geometry";
import type { PartSpec } from "@/lib/catalogue";
import { CAT } from "@/aircraft/sr22t/parts";
import { FT } from "@/aircraft/sr22t/parts/cabin";
import { AFT_GANG, FLOOR_HOLES, PULLEYS, fsX } from "@/aircraft/sr22t/rig";

const boxOf = (p: PartSpec) => {
  const g = p.geo();
  const m = new THREE.Mesh(g);
  m.position.set(...(p.pos ?? [0, 0, 0]));
  if (p.rot) m.rotation.set(...p.rot);
  m.updateMatrixWorld();
  const b = new THREE.Box3().setFromObject(m, true);
  g.dispose();
  return b;
};
const only = (name: string) => {
  const found = CAT.parts.filter((p) => p.name === name && !p.parent);
  expect(found, `one fixed part named "${name}"`).toHaveLength(1);
  return boxOf(found[0]);
};
/** Gap between two boxes (0 when they touch or overlap). */
const gap = (a: THREE.Box3, b: THREE.Box3) =>
  Math.hypot(...(["x", "y", "z"] as const).map((k) => Math.max(0, a.min[k] - b.max[k], b.min[k] - a.max[k])));

describe("SR22T flap actuator under the baggage floor (AMM 27-50 p. 1, PDF p. 1050)", () => {
  const act = () => only("Flap actuator");

  it("the actuator body is centred under the baggage floor, between FS 186 and FS 222 (POH Fig 1-2)", () => {
    const c = act().getCenter(new THREE.Vector3());
    expect(c.x).toBeLessThan(fsX(186));
    expect(c.x).toBeGreaterThan(fsX(222));
  });

  it("runs fore-and-aft, below the torque tube", () => {
    const b = act(),
      s = b.getSize(new THREE.Vector3());
    expect(s.x).toBeGreaterThan(3 * Math.max(s.y, s.z));
    expect(b.max.y).toBeLessThan(FT.y);
  });

  it("its forward (rod) end is within 3 cm of the torque tube coupler, and the coupler is on the tube (Fig 27-50-2 item 18)", () => {
    const b = act(),
      coupler = only("Flap torque tube coupler"),
      rodEnd = new THREE.Vector3(b.max.x, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    expect(coupler.distanceToPoint(rodEnd)).toBeLessThan(0.03);
    expect(coupler.containsPoint(new THREE.Vector3(FT.x, FT.y, rodEnd.z))).toBe(true);
    expect(gap(coupler, only("Flap torque tube"))).toBe(0);
  });

  it("its aft end is over CF5 and on the skin bracket (27-50 PDF p. 1051; Fig 27-50-2 item 7)", () => {
    const b = act(),
      cf5 = FLOOR_HOLES.CF5;
    expect(b.min.x).toBeGreaterThan(cf5.x - cf5.hx);
    expect(b.min.x).toBeLessThan(cf5.x + cf5.hx);
    const bracket = only("Flap actuator bracket");
    expect(gap(bracket, b)).toBe(0);
    expect(bracket.min.x).toBeLessThan(b.min.x + 0.06);
  });

  it("clears the rudder/elevator pulley gang, the marker beacon sled and the A/C condenser by at least 10 mm", () => {
    const b = act();
    const gang = Object.values(PULLEYS)
      .filter((d) => d.c[0] === AFT_GANG.x && d.c[1] === AFT_GANG.y)
      .map((d) => {
        const g = pulleyGeo(d.r, d.axis, d.double, d.gap).translate(...d.c);
        g.computeBoundingBox();
        return g.boundingBox!;
      });
    expect(gang.length).toBeGreaterThan(0);
    for (const [name, other] of [
      ...gang.map((g) => ["Rudder/elevator pulley gang", g] as const),
      ["Rudder/elevator pulley gang bracket", only("Rudder/elevator pulley gang bracket")] as const,
      ["Marker beacon antenna", only("Marker beacon antenna")] as const,
      ["A/C condenser", only("A/C condenser")] as const,
    ])
      expect(gap(b, other), name).toBeGreaterThanOrEqual(0.01);
  });
});
