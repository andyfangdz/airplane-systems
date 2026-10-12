/** Newly detailed wheel hardware follows preserved folding datums throughout manual gear travel.
 * MAN106 §§5-2–14 / IPC205 Figs22–25; schematic clearance, not maintenance rigging dimensions. */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/m20c/parts";
import { CABIN, MG, NG, NOSE_WELL, mainAngle, noseAngle } from "@/aircraft/m20c/placement";
import { worldGeometry } from "./placement-helpers";
import { DEPTH_QUIET } from "@/aircraft/m20c/depth-labels";
import type { SysId } from "@/lib/systems";

describe("M20C added mechanism clearances and locator labels", () => {
  it("keeps wheel calipers, fittings and folding hoses outside occupied cabin at all gear positions", () => {
    const names = new Set([
      "Brake caliper",
      "Brake pad",
      "Brake bleeder screw",
      "Main axle retaining nut",
      "Brake wheel flexible hose",
      "Main gear drag brace",
      "Main shock-disc retaining collar",
    ]);
    const parts = CAT.parts.filter((p) => names.has(p.name ?? ""));
    expect(parts.length).toBe(14);
    for (const frac of [0, 0.25, 0.5, 0.75, 1])
      for (const part of parts) {
        const side = part.parent === "mainL" ? -1 : 1;
        const parent = new THREE.Matrix4()
          .makeTranslation(MG.trunnion[0], MG.trunnion[1], side * MG.trunnion[2])
          .multiply(new THREE.Matrix4().makeRotationX(mainAngle(frac, side)));
        const g = worldGeometry(part, parent);
        try {
          const pos = g.getAttribute("position");
          for (let i = 0; i < pos.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(pos, i);
            const occupied = p.x > -0.45 && p.x < 1.85 && Math.abs(p.z) < 0.5 && p.y > CABIN.floor;
            expect(occupied, `${part.name} at gear${frac}: ${p.toArray()}`).toBe(false);
          }
        } finally {
          g.dispose();
        }
      }
  });
  it("keeps the added nose steering bolt on the moving nose group across retraction", () => {
    const part = CAT.parts.find((p) => p.name === "Nose gear steering pivot bolt")!;
    expect(part.parent).toBe("nose");
    for (const frac of [0, 0.5, 1]) {
      const parent = new THREE.Matrix4()
        .makeTranslation(...NG.top)
        .multiply(new THREE.Matrix4().makeRotationZ(noseAngle(frac)));
      const g = worldGeometry(part, parent);
      try {
        g.computeBoundingBox();
        expect(g.boundingBox!.max.y).toBeLessThan(NOSE_WELL.roof);
        expect(g.boundingBox!.min.x).toBeGreaterThan(NOSE_WELL.x0);
        expect(g.boundingBox!.max.x).toBeLessThan(NOSE_WELL.x1);
        expect(g.boundingBox!.min.z).toBeGreaterThan(-NOSE_WELL.halfWidth);
        expect(g.boundingBox!.max.z).toBeLessThan(NOSE_WELL.halfWidth);
      } finally {
        g.dispose();
      }
    }
  });
  it("keeps every quiet detail in its system's tap-to-locate catalogue", () => {
    for (const [sys, names] of Object.entries(DEPTH_QUIET)) {
      const pinned = new Set(CAT.pinned(sys as SysId).map((p) => p.name));
      expect(
        names.filter((name) => !pinned.has(name)),
        sys,
      ).toEqual([]);
    }
  });
});
