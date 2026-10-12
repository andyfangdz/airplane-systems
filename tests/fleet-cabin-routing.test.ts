/** Occupied cabin space is independent of skin containment: a wire can be inside the fuselage and cross a seat. */
import { describe, expect, it } from "vitest";
import { Box3, Matrix4, TubeGeometry, Vector3 } from "three";
import { CAT as CAT172 } from "@/aircraft/c172s/parts";
import { CAT as CAT182 } from "@/aircraft/c182t/parts";
import { CAT as CATDA40 } from "@/aircraft/da40/parts";
import { CAT as CATM20C } from "@/aircraft/m20c/parts";
import { CAT as CATSR20 } from "@/aircraft/sr20/parts";
import { CAT as CATSR22T } from "@/aircraft/sr22t/parts";
import { FLOWS as C172 } from "@/aircraft/c172s/flows";
import { FLOWS as C182 } from "@/aircraft/c182t/flows";
import { FLOWS as DA40 } from "@/aircraft/da40/flows";
import { FLOWS as M20C } from "@/aircraft/m20c/flows";
import { FLOWS as SR20 } from "@/aircraft/sr20/flows";
import { FLOWS as SR22T } from "@/aircraft/sr22t/flows";
import { onSkin as skin172 } from "@/aircraft/c172s/geometry";
import { onSkin as skin182 } from "@/aircraft/c182t/geometry";
import { onSkin as skinDA40 } from "@/aircraft/da40/geometry";
import { onSkin as skinM20C } from "@/aircraft/m20c/geometry";
import { onSkin as skinSR20 } from "@/aircraft/sr20/geometry";
import { onSkin as skinSR22T } from "@/aircraft/sr22t/geometry";
import { MICROPHONE } from "@/aircraft/sr20/parts/avionics";
import { curveOf } from "@/lib/geometry";
import { firstSurfaceSample, worldGeometry } from "./placement-helpers";
import { edgeCrossing, inside, tris } from "./mesh-clearance";

// Conservative torso/head volumes within the scene's front/rear seats and panel boundaries.
// These are drawing consistency bounds, not certified installation or occupant dimensions.
const fleet = [
  {
    id: "c172s",
    skin: skin172,
    flows: C172,
    cat: CAT172,
    min: [0.15, -0.34, -0.38],
    max: [1.9, 0.6, 0.38],
    consoleX: 1.65,
    consoleZ: 0.07,
    consoleY: -0.15,
  },
  {
    id: "c182t",
    skin: skin182,
    flows: C182,
    cat: CAT182,
    min: [0.1, -0.4, -0.4],
    max: [1.9, 0.5, 0.4],
    consoleX: 1.65,
    consoleZ: 0.07,
    consoleY: -0.2,
  },
  {
    id: "da40",
    skin: skinDA40,
    flows: DA40,
    cat: CATDA40,
    min: [-0.65, -0.37, -0.4],
    max: [1.12, 0.32, 0.4],
    consoleX: 0.3,
    consoleZ: 0.085,
    consoleY: -0.15,
  },
  {
    id: "m20c",
    skin: skinM20C,
    flows: M20C,
    cat: CATM20C,
    min: [-0.45, -0.34, -0.4],
    max: [1.4, 0.32, 0.4],
    consoleX: 1.08,
    consoleZ: 0.1,
    consoleY: -0.12,
  },
  {
    id: "sr20",
    skin: skinSR20,
    flows: SR20,
    cat: CATSR20,
    min: [-0.1, -0.3, -0.43],
    max: [2.0, 0.34, 0.43],
    consoleX: 1.18,
    consoleZ: 0.13,
    consoleY: -0.27,
  },
  {
    id: "sr22t",
    skin: skinSR22T,
    flows: SR22T,
    cat: CATSR22T,
    min: [-0.1, -0.3, -0.43],
    max: [2.0, 0.34, 0.43],
    consoleX: 1.55,
    consoleZ: 0.15,
    consoleY: 0.05,
  },
] as const;

describe.each(fleet)("$id cabin wiring clearance", (aircraft) => {
  it("keeps complete power, signal and lighting tubes out of occupied cabin space", () => {
    const cabin = new Box3(new Vector3(...aircraft.min), new Vector3(...aircraft.max));
    const crosses = (p: Vector3) =>
      cabin.containsPoint(p) &&
      Math.abs(p.z) < Math.abs(aircraft.skin(p.x, p.y, 1, 1).z) - 0.04 &&
      !(p.x >= aircraft.consoleX && Math.abs(p.z) <= aircraft.consoleZ && p.y <= aircraft.consoleY);
    const bad: string[] = [];
    for (const f of aircraft.flows.filter(
      (f) => f.tube !== false && f.sys.some((s) => ["electrical", "avionics", "lighting"].includes(s)),
    )) {
      const curve = curveOf(f.pts, f.tension ?? 0.3);
      const geometry = new TubeGeometry(
        curve,
        Math.max(24, Math.round(curve.getLength() * 28)),
        f.r ?? 0.012,
        6,
        false,
      );
      // The microphone's short connector stub sits in its console-mounted housing.
      const occupied = (p: Vector3) =>
        crosses(p) &&
        !(aircraft.id === "sr20" && f.key === "microphoneAudio" && p.distanceTo(new Vector3(...MICROPHONE)) <= 0.035);
      const hit = curve.getPoints(600).find(occupied) ?? firstSurfaceSample(geometry, occupied);
      if (hit)
        bad.push(
          `${f.key}: ${hit
            .toArray()
            .map((v) => v.toFixed(3))
            .join(", ")}`,
        );
      geometry.dispose();
    }
    expect(bad).toEqual([]);
  });

  it("keeps physical pipes, wires and fixed remote hardware clear of actual seat cushions and backs", () => {
    const seats = aircraft.cat.parts.filter((p) =>
      /^(Pilot seat|Front passenger seat|Co-pilot seat|Rear seat(?: \([LR]\)| \(2\+1 bench\))?|Rear bench seat)$/.test(
        p.name ?? "",
      ),
    );
    expect(seats.length).toBeGreaterThanOrEqual(6);
    const meshes = seats.map((part) => {
      // Use a snapshot; a factory may retain a shared geometry used by the renderer.
      const geometry = worldGeometry({ ...part, geo: () => part.geo().clone() });
      geometry.computeBoundingBox();
      return { name: part.name!, geometry, triangles: tris(geometry, new Matrix4()), box: geometry.boundingBox! };
    });
    const bad: string[] = [];
    try {
      for (const f of aircraft.flows.filter((f) => f.tube !== false)) {
        const curve = curveOf(f.pts, f.tension ?? 0.3);
        const geometry = new TubeGeometry(
          curve,
          Math.max(24, Math.round(curve.getLength() * 28)),
          f.r ?? 0.012,
          6,
          false,
        );
        const candidates = curve.getPoints(600);
        for (const seat of meshes) {
          const enters = (p: Vector3) => inside(p, seat.triangles, seat.box);
          const hit = candidates.find(enters) ?? firstSurfaceSample(geometry, enters);
          if (hit)
            bad.push(
              `${f.key} enters ${seat.name}: ${hit
                .toArray()
                .map((v) => v.toFixed(3))
                .join(", ")}`,
            );
        }
        geometry.dispose();
      }
      const hardware = aircraft.cat.parts.filter(
        (p) =>
          !p.ext &&
          !p.parent &&
          /(?:GIA|GEA|GDC|GDL|GRS|GSU|ADAHRS|GTX|[Rr]elay|[Cc]ontactor|[Bb]us|[Ss]hunt|[Bb]attery|[Bb]reaker)/.test(
            p.name ?? "",
          ),
      );
      for (const part of hardware) {
        const geometry = worldGeometry({ ...part, geo: () => part.geo().clone() });
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const triangles = tris(geometry, new Matrix4());
        for (const seat of meshes) {
          if (!box.intersectsBox(seat.box)) continue;
          if (
            triangles.some((t) => t.some((p) => inside(p, seat.triangles, seat.box))) ||
            seat.triangles.some((t) => t.some((p) => inside(p, triangles, box))) ||
            edgeCrossing(triangles, seat.triangles)
          )
            bad.push(`${part.name} overlaps ${seat.name}`);
        }
        geometry.dispose();
      }
    } finally {
      meshes.forEach((m) => m.geometry.dispose());
    }
    expect(bad).toEqual([]);
  });
});
