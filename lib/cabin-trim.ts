/** Cabin finishes separate the occupied cabin from systems behind trim. All offsets are illustrative. */
import * as THREE from "three";
import type { Catalogue } from "./catalogue";
import type { StudyDoor, DoorSkin } from "./doors";
import { fuselageNormal } from "./fuselage-openings";
import type { fuselage } from "./geometry";
import { mats } from "./materials";
import { curvedSkinPatch } from "./skin-patch";

type Fuse = ReturnType<typeof fuselage>;

/** A level floor following the actual cabin section, including the outboard threshold. */
export function cabinFloor(fuse: Fuse, aft: number, front: number, y: number) {
  const positions: number[] = [];
  const n = Math.ceil((front - aft) / 0.04);
  for (let i = 0; i < n; i++) {
    const a = aft + ((front - aft) * i) / n,
      b = aft + ((front - aft) * (i + 1)) / n;
    const za = Math.abs(fuse.onSkin(a, y, 1, 1).z) - 0.008;
    const zb = Math.abs(fuse.onSkin(b, y, 1, 1).z) - 0.008;
    positions.push(a, y, -za, a, y, za, b, y, zb, a, y, -za, b, y, zb, b, y, -zb);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function registerCabinTrim(
  cat: Catalogue,
  fuse: Fuse,
  skin: DoorSkin,
  options: {
    aft: number;
    front: number;
    floor?: number;
    doors: StudyDoor[];
    windows?: { side: number; outline: THREE.Vector2[] }[];
    note: string;
  },
) {
  const finish = mats("#8C8880").on.clone();
  finish.side = THREE.DoubleSide;
  const common = {
    fairing: true,
    color: "#8C8880",
    solidMaterial: () => finish,
    note: options.note + " Trim thickness, clearance and floor height are illustrative, not installation dimensions.",
  };
  if (options.floor !== undefined)
    cat.part(() => cabinFloor(fuse, options.aft, options.front, options.floor!), ["cabin", "airframe"], {
      ...common,
      name: "Cabin floor covering",
      color: "#514F4B",
      solidMaterial: () => mats("#514F4B").on,
    });
  const outline = [
    new THREE.Vector2(options.aft, -1),
    new THREE.Vector2(options.front, -1),
    new THREE.Vector2(options.front, 1),
    new THREE.Vector2(options.aft, 1),
  ];
  const liningPoint = (p: THREE.Vector2, side: number) => {
    const v = skin.point(p, side),
      cy = fuse.fus(p.x).cy;
    return v.set(v.x, cy + (v.y - cy) * 0.9, v.z * 0.9);
  };
  // Close the reveal between the exterior and the inset lining. Without these
  // return faces an oblique view into an open door sees into the post's wiring cavity.
  cat.part(
    () => {
      const positions: number[] = [];
      for (const door of options.doors.filter((d) => !d.parent)) {
        const strip = (a: THREE.Vector2, b: THREE.Vector2, depth = 0) => {
          const outerA = skin.point(a, door.side),
            outerB = skin.point(b, door.side);
          // A straight border chord can bridge a concave station or curved roof.
          // Refine it until the return face stays inside the unchanged analytic skin.
          if (depth < 16 && !fuse.inside(outerA.clone().add(outerB).multiplyScalar(0.5), -0.00003)) {
            const mid = a.clone().lerp(b, 0.5);
            strip(a, mid, depth + 1);
            strip(mid, b, depth + 1);
            return;
          }
          const innerA = liningPoint(a, door.side),
            innerB = liningPoint(b, door.side);
          for (const p of [outerA, outerB, innerB, outerA, innerB, innerA]) positions.push(p.x, p.y, p.z);
        };
        for (let i = 0; i < door.outline.length; i++) {
          const a = door.outline[i],
            b = door.outline[(i + 1) % door.outline.length];
          const cuts = fuse.stations
            .filter((x) => x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x))
            .map((x) => a.clone().lerp(b, (x - a.x) / (b.x - a.x)))
            .sort((p, q) => (p.x - q.x) * Math.sign(b.x - a.x));
          const points = [a, ...cuts, b];
          for (let j = 1; j < points.length; j++) strip(points[j - 1], points[j]);
        }
      }
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      return g;
    },
    ["cabin", "airframe"],
    { ...common, name: "Door jamb trim" },
  );
  for (const side of [-1, 1]) {
    const holes = [...options.doors.filter((d) => !d.parent), ...(options.windows ?? [])]
      .filter((d) => d.side === side)
      .map((d) => d.outline);
    cat.part(
      () =>
        curvedSkinPatch({
          outline,
          holes,
          side,
          point: (p) => liningPoint(p, side),
          // Parameterization belongs to the source skin: refinement must not re-project the inset point.
          parameter: (p) => {
            const cy = fuse.fus(p.x).cy;
            return skin.parameter(new THREE.Vector3(p.x, cy + (p.y - cy) / 0.9, p.z / 0.9));
          },
          normal: (p) => fuselageNormal(fuse, p),
          uv: (p) => [p.x, p.y],
          splitX: fuse.stations,
          tolerance: 0.002,
        }),
      ["cabin", "airframe"],
      { ...common, name: "Fixed cabin lining" },
    );
  }
}
