/** Power/data paths must leave the actual glass-display view unobstructed. */
import { describe, expect, it } from "vitest";
import { Vector3, TubeGeometry } from "three";
import { FLOWS as C172 } from "@/aircraft/c172s/flows";
import { FLOWS as C182 } from "@/aircraft/c182t/flows";
import { FLOWS as DA40 } from "@/aircraft/da40/flows";
import { FLOWS as SR20 } from "@/aircraft/sr20/flows";
import { FLOWS as SR22T } from "@/aircraft/sr22t/flows";
import { SYS as S172 } from "@/aircraft/c172s/systems";
import { SYS as S182 } from "@/aircraft/c182t/systems";
import { SYS as SDA40 } from "@/aircraft/da40/systems";
import { SYS as SSR20 } from "@/aircraft/sr20/systems";
import { SYS as SSR22T } from "@/aircraft/sr22t/systems";
import { P3 as P172 } from "@/aircraft/c172s/parts/catalogue";
import { P3 as P182 } from "@/aircraft/c182t/parts/catalogue";
import { DISPLAY_X, STBY_X } from "@/aircraft/da40/parts/avionics";
import { NAV3_BL } from "@/aircraft/cessna/faceplate";
import { curveOf } from "@/lib/geometry";
import { firstSurfaceSample } from "./placement-helpers";

// Screen planes and dimensions are the ones rendered by each Airplane.tsx SCREENS definition.
const fleet = [
  { id: "c172s", flows: C172, systems: S172, faces: [P172(18.62, NAV3_BL.pfd, 61.5), P172(18.62, NAV3_BL.mfd, 61.5)] },
  { id: "c182t", flows: C182, systems: S182, faces: [P182(18.82, NAV3_BL.pfd, 61.9), P182(18.82, NAV3_BL.mfd, 61.9)] },
  {
    id: "da40",
    flows: DA40,
    systems: SDA40,
    faces: [
      [DISPLAY_X, -0.03, -0.26],
      [DISPLAY_X, -0.03, 0.13],
    ],
  },
  {
    id: "sr20",
    flows: SR20,
    systems: SSR20,
    faces: [
      [2.275, 0.1, -0.24],
      [2.275, 0.1, 0.053],
    ],
  },
  {
    id: "sr22t",
    flows: SR22T,
    systems: SSR22T,
    faces: [
      [2.275, 0.1, -0.24],
      [2.275, 0.1, 0.053],
    ],
  },
] as const;
const face = (center: readonly number[], width: number, height: number) => ({ center, width, height });
const standby = {
  c172s: [-3.6, 0.6, 4.8].map((bl) => face(P172(17.95, bl, 52.6), 0.08, 0.08)),
  c182t: [-3.6, 0.6, 4.8].map((bl) => face(P182(18.15, bl, 54.4), 0.08, 0.08)),
  da40: [-0.107, -0.008, 0.089].map((z) => face([STBY_X - 0.0095, 0.15, z], 0.08, 0.08)),
  sr20: [face([2.175, -0.07, -0.245], 0.14, 0.06)],
  sr22t: [face([2.175, -0.07, -0.245], 0.14, 0.06)],
};

describe.each(fleet)("$id instrument visibility", ({ id, flows, systems, faces }) => {
  it("keeps rendered tubes clear of glass and standby instrument sightlines", () => {
    const eye = new Vector3(...systems.find((s) => s.id === "avionics")!.cam[0]);
    const screenFaces = [...faces.map((p) => face(p, 0.211, 0.158)), ...standby[id]];
    const obstructs = (v: Vector3) =>
      screenFaces.some(({ center, width, height }) => {
        if (v.x <= eye.x || v.x >= center[0]) return false;
        const scale = (center[0] - eye.x) / (v.x - eye.x);
        return (
          Math.abs(eye.y + (v.y - eye.y) * scale - center[1]) <= height / 2 &&
          Math.abs(eye.z + (v.z - eye.z) * scale - center[2]) <= width / 2
        );
      });
    const bad: string[] = [];
    for (const f of flows.filter((f) => f.tube !== false)) {
      const curve = curveOf(f.pts, f.tension ?? 0.3);
      const mesh = new TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 28)), f.r ?? 0.012, 6, false);
      const hit = curve.getPoints(600).find(obstructs) ?? firstSurfaceSample(mesh, obstructs);
      if (hit)
        bad.push(
          `${f.key}: ${hit
            .toArray()
            .map((v) => v.toFixed(3))
            .join(", ")}`,
        );
      mesh.dispose();
    }
    expect(bad).toEqual([]);
  });
});
