/** Geometry consistency, not real-aircraft rigging dimensions. Sources and
 * approximation limits: aircraft/GEOMETRY_AUDIT.md, M20C follow-up. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GROUND_Y, inFus } from "@/aircraft/m20c/geometry";
import { CAT } from "@/aircraft/m20c/parts";
import { MG, mainAngle } from "@/aircraft/m20c/placement";
import { namedPart, partBounds, points, worldGeometry } from "./placement-helpers";

const doors = CAT.parts.filter((p) => p.name === "Main gear door");
const matrix = (fraction: number, side: number) =>
  new THREE.Matrix4()
    .makeRotationX(mainAngle(fraction, side))
    .setPosition(MG.trunnion[0], MG.trunnion[1], side * MG.trunnion[2]);

describe("M20C main door clearance (S&MM §5-11; qualitative photo fit)", () => {
  it("exposes the lower tyre when down and clears the ground through the full gear cycle", () => {
    expect(doors).toHaveLength(2);
    for (const door of doors) {
      const side = door.parent === "mainR" ? 1 : -1;
      expect(door.parent).toBe(side > 0 ? "mainR" : "mainL");
      const down = partBounds(door, matrix(0, side));
      // Guard the visible lower half of the tyre, not an invented POH dimension.
      expect(down.min.y).toBeGreaterThan(MG.y - MG.r / 2);
      expect(down.min.y).toBeLessThan(MG.y);
      for (let i = 0; i <= 40; i++) {
        expect(partBounds(door, matrix(i / 40, side)).min.y).toBeGreaterThan(GROUND_Y + 0.02);
      }
    }
  });

  it("keeps both doors outside their tyres throughout retraction", () => {
    for (const door of doors) {
      const side = door.parent === "mainR" ? 1 : -1;
      const tyre = namedPart(CAT, side > 0 ? "Right main wheel" : "Left main wheel");
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const parent = matrix(fraction, side);
        const centre = new THREE.Vector3(...tyre.pos!).applyMatrix4(parent);
        const axle = new THREE.Vector3(0, 0, side).transformDirection(parent);
        const geometry = worldGeometry(door, parent);
        try {
          // Every panel vertex lies beyond the tyre's outer sidewall plane;
          // consequently its faces cannot cut through the tyre either.
          for (const p of points(geometry)) expect(p.sub(centre).dot(axle)).toBeGreaterThan(MG.width / 2);
        } finally {
          geometry.dispose();
        }
      }
    }
  });
});

it("joins the fixed entry step to both the fuselage and tread in cabin and airframe views", () => {
  const [tread, support] = CAT.parts.filter((p) => p.name === "Entry step");
  expect(support).toBeDefined();
  expect(support.sys).toEqual(tread.sys);
  for (const p of [tread, support]) {
    expect(p.parent).toBeUndefined();
    expect(p.anim).toBeUndefined(); // 1968 Ranger fixed step; no gear/vacuum retraction
  }
  const geometry = worldGeometry(support);
  try {
    const vertices = points(geometry);
    expect(vertices.some((p) => inFus(p))).toBe(true);
    const treadBounds = partBounds(tread);
    expect(vertices.some((p) => treadBounds.containsPoint(p))).toBe(true);
    expect(Math.min(...vertices.map((p) => p.y))).toBeGreaterThan(GROUND_Y);
  } finally {
    geometry.dispose();
  }
});
