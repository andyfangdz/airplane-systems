/** Rendered NAV III signal tubes must not cross the whole-panel camera's actual display cones. */
import { describe, expect, it } from "vitest";
import { Vector3, TubeGeometry } from "three";
import { CAT } from "@/aircraft/c182t/parts";
import { FLOWS } from "@/aircraft/c182t/flows";
import { DEPTH as D } from "@/aircraft/c182t/depth-anchors";
import { SYSTEM_DEPTH_FLOWS } from "@/aircraft/c182t/systems-depth-flow";
import { SYS } from "@/aircraft/c182t/systems";
import { P3 } from "@/aircraft/c182t/parts/catalogue";
import { NAV3_BL } from "@/aircraft/cessna/faceplate";
import { curveOf } from "@/lib/geometry";
import { namedPart, points } from "./placement-helpers";

// Exact front planes used by SCREENS in Airplane.tsx, including the pneumatic standby instruments.
const faces = [
  { name: "PFD", center: P3(18.82, NAV3_BL.pfd, 61.9), width: 0.211, height: 0.158 },
  { name: "MFD", center: P3(18.82, NAV3_BL.mfd, 61.9), width: 0.211, height: 0.158 },
  { name: "Standby ASI", center: P3(18.15, -3.6, 54.4), width: 0.08, height: 0.08 },
  { name: "Standby altimeter", center: P3(18.15, 4.8, 54.4), width: 0.08, height: 0.08 },
];
const eye = new Vector3(...SYS.find((s) => s.id === "avionics")!.cam[0]);
/** A point is an occluder if it lies between the camera and a point on a real screen plane. */
function obstructs(v: Vector3, face: (typeof faces)[number]) {
  if (v.x <= eye.x || v.x >= face.center[0]) return false;
  const t = (face.center[0] - eye.x) / (v.x - eye.x),
    y = eye.y + (v.y - eye.y) * t,
    z = eye.z + (v.z - eye.z) * t;
  return Math.abs(y - face.center[1]) <= face.height / 2 && Math.abs(z - face.center[2]) <= face.width / 2;
}

describe("C182T instrument visibility and source attachment", () => {
  it("uses the existing NAV III hardware's lateral stations and separate rear connectors", () => {
    for (const [anchor, name] of [
      [D.adc, "GDC 74A air data computer"],
      [D.gdl, "GDL 69A data link"],
      [D.pfd, "PFD — GDU 1040"],
      [D.mfd, "MFD — GDU 1040"],
      [D.audio, "GMA 1347 audio panel"],
    ] as const) {
      const at = namedPart(CAT, name).pos!;
      expect(anchor[2], name).toBe(at[2]);
    }
    expect(D.pfd[0]).toBeGreaterThan(faces[0].center[0]);
    expect(D.mfd[0]).toBeGreaterThan(faces[1].center[0]);
    expect(SYSTEM_DEPTH_FLOWS.find((f) => f.key === "depthOatAdc")!.pts.at(-1)).toEqual(D.adc);
    expect(SYSTEM_DEPTH_FLOWS.find((f) => f.key === "depthSpeaker")!.pts[0]).toEqual(D.audio);
    expect(SYSTEM_DEPTH_FLOWS.find((f) => f.key === "depthSpeaker")!.pts.at(-1)).toEqual(
      namedPart(CAT, "Cabin audio speaker").pos,
    );
  });

  it("keeps all rendered avionics tube walls, triangle centres and edge midpoints clear of the panel view", () => {
    const bad: string[] = [];
    for (const f of FLOWS.filter((f) => f.sys.includes("avionics") && f.tube !== false)) {
      const c = curveOf(f.pts, f.tension ?? 0.3),
        g = new TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 28)), f.r ?? 0.012, 6, false),
        vertices = points(g),
        samples = [...vertices];
      // Check the actual rendered triangles, not only route knots or tube centreline.
      const ids = g.index?.array ?? vertices.map((_, i) => i);
      for (let i = 0; i < ids.length; i += 3) {
        const a = vertices[ids[i]],
          b = vertices[ids[i + 1]],
          d = vertices[ids[i + 2]];
        samples.push(
          a
            .clone()
            .add(b)
            .add(d)
            .multiplyScalar(1 / 3),
          a.clone().add(b).multiplyScalar(0.5),
          b.clone().add(d).multiplyScalar(0.5),
          d.clone().add(a).multiplyScalar(0.5),
        );
      }
      for (const face of faces) {
        const blocked = samples.find((v) => obstructs(v, face));
        if (blocked)
          bad.push(
            `${f.key} blocks ${face.name}: ${blocked
              .toArray()
              .map((v) => v.toFixed(4))
              .join(", ")}`,
          );
      }
      g.dispose();
    }
    expect(bad).toEqual([]);
  });
});
