import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Catalogue, PartSpec } from "@/lib/catalogue";
import { plainDoorInterior } from "@/lib/doors";
import { box, cyl, mergeGeos, tubeGeo } from "@/lib/geometry";
import { finishMat, skinMat } from "@/lib/materials";
import { toVec3, V } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { entryProgress } from "../entry-study";
import { doorFrame, doorSeal, doorSkin, paintHull } from "../exterior-skin";
import { FUSE } from "../geometry";

const systems: SysId[] = ["cabin", "airframe"];
const xCenter = 8.265;
const hinge = FUSE.onSkin(xCenter, -0.855, -1, 1);
const axis = V(1, 0, 0);
const openAngle = -2.39;
const atOpen = (p: THREE.Vector3) => p.clone().sub(hinge).applyAxisAngle(axis, openAngle).add(hinge);
const fromOpen = (p: THREE.Vector3) => p.clone().sub(hinge).applyAxisAngle(axis, -openAngle).add(hinge);
const moveWithDoor = (mesh: THREE.Mesh) => {
  mesh.rotation.x = openAngle * entryProgress();
};

let paintedDoor: THREE.MeshStandardMaterial | undefined;
const enamel = () => (paintedDoor ??= plainDoorInterior(skinMat(paintHull).clone()));

// The visible stair tray on Dassault's rollout photograph has a curved back, molded
// white cheeks and individual tread inserts. Build its upper run in the deployed
// pose so each tread is level, then return all geometry to its hinged bind pose.
const stepCount = 6;
const sill = V(xCenter, -0.74, hinge.z + 0.035);
const foot = atOpen(FUSE.onSkin(xCenter, 0.9, -1, 1));
const riser = (sill.y - foot.y - 0.055) / stepCount;
const stairHeadZ = sill.z - 0.12;
const going = (stairHeadZ - foot.z + 0.03) / stepCount;
function tread(index: number) {
  return V(xCenter, sill.y - riser * index, stairHeadZ - going * (index - 0.5));
}

function stairCheek(x: number) {
  const leading = new THREE.Shape();
  // Extrude the Y/Z cross-section along X. Plane u is minus Z and v is Y.
  leading.moveTo(-stairHeadZ, sill.y - 0.018);
  for (let i = 1; i <= stepCount; i++) {
    const step = tread(i);
    leading.lineTo(-step.z - going / 2, step.y - 0.014);
    leading.lineTo(-step.z + going / 2, step.y - 0.014);
  }
  // The concave underside follows the same curved fuselage panel that carries it.
  for (let i = 24; i >= 0; i--) {
    const y = -0.84 + (1.74 * i) / 24;
    const outer = atOpen(FUSE.onSkin(x, y, -1, 1));
    leading.lineTo(-outer.z, outer.y + 0.011);
  }
  leading.closePath();
  return new THREE.ExtrudeGeometry(leading, { depth: 0.043, bevelEnabled: false })
    .rotateY(Math.PI / 2)
    .translate(x - 0.0215, 0, 0);
}

export function addEntry(cat: Catalogue) {
  function moving(geo: () => THREE.BufferGeometry, deployed: boolean, options: Omit<PartSpec, "geo" | "sys">) {
    cat.part(
      () => {
        const g = geo().translate(-hinge.x, -hinge.y, -hinge.z);
        return deployed ? g.rotateX(-openAngle) : g;
      },
      systems,
      { ...options, pos: toVec3(hinge), anim: moveWithDoor, ext: true },
    );
  }

  moving(doorSkin, false, {
    id: "exterior.entry-door",
    name: "Entry door",
    note: "The port passenger door folds down from the sill and carries its own boarding stairs. An electrical lifting system assists the door.",
    pin: true,
    fairing: true,
    color: "#d1d5d6",
    solidMaterial: enamel,
  });
  moving(
    () =>
      tubeGeo(
        [FUSE.onSkin(8.45, -0.24, -1, 1.005), FUSE.onSkin(8.4, -0.25, -1, 1.013), FUSE.onSkin(8.31, -0.25, -1, 1.013)],
        0.012,
      ),
    false,
    { id: "exterior.door-latch", color: "#7e8687", solidMaterial: () => finishMat.polished },
  );

  cat.part(doorFrame, systems, {
    id: "entry.door-jamb",
    name: "Door frame",
    note: "The recessed jamb follows the curved cabin skin around the opening.",
    ext: true,
    solidColor: "#c2c6c6",
  });
  cat.part(doorSeal, systems, { id: "entry.door-seal", ext: true, solidColor: "#454c50" });
  cat.part(
    () =>
      mergeGeos([
        box(0.74, 0.037, 0.19).translate(xCenter, sill.y - 0.018, sill.z + 0.071),
        ...[-0.27, 0.27].map((dx) => cyl(0.023, 0.13, "x").translate(hinge.x + dx, hinge.y, hinge.z + 0.047)),
      ]),
    systems,
    { id: "entry.sill", name: "Entry threshold", ext: true, solidMaterial: () => finishMat.polished },
  );

  const steps = Array.from({ length: stepCount }, (_, i) => tread(i + 1));
  moving(
    () => {
      const tray = mergeGeos([
        stairCheek(xCenter - 0.314),
        stairCheek(xCenter + 0.314),
        box(0.635, 0.026, sill.z - stairHeadZ + 0.016).translate(xCenter, sill.y - 0.018, (sill.z + stairHeadZ) / 2),
        ...steps.flatMap((p) => [
          new RoundedBoxGeometry(0.64, 0.036, going + 0.005, 1, 0.009).translate(p.x, p.y - 0.02, p.z),
          box(0.625, riser - 0.024, 0.028).translate(p.x, p.y + riser / 2 - 0.005, p.z + going / 2),
        ]),
      ]);
      // Trim the hidden corners of the risers to the shallow curved door tray.
      // At the top and bottom of the skin a rectangular riser would poke through.
      const vertices = tray.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) {
        const p = fromOpen(new THREE.Vector3().fromBufferAttribute(vertices, i));
        const inner = FUSE.onSkin(p.x, p.y, -1, 1).z + 0.008;
        if (p.z >= inner) continue;
        p.z = inner;
        const q = atOpen(p);
        vertices.setXYZ(i, q.x, q.y, q.z);
      }
      tray.computeVertexNormals();
      return tray;
    },
    true,
    {
      id: "entry.airstair",
      name: "Integral airstair",
      pin: true,
      note: "Six steps are built into the inside face of the door. The molded stair sides follow the curvature of the outer skin.",
      color: "#dbdcda",
      solidColor: "#e0e0db",
    },
  );
  moving(
    () =>
      mergeGeos(
        steps.map((p) =>
          new RoundedBoxGeometry(0.588, 0.013, going - 0.022, 1, 0.004).translate(p.x, p.y + 0.004, p.z),
        ),
      ),
    true,
    { id: "entry.tread-inserts", name: "Stair treads", solidColor: "#505458" },
  );
  moving(
    () => mergeGeos(steps.map((p) => box(0.61, 0.016, 0.025).translate(p.x, p.y + 0.003, p.z - going / 2 + 0.006))),
    true,
    { id: "entry.tread-nosings", solidMaterial: () => finishMat.polished },
  );

  // A slim stay on the forward side links the jamb to the stair tray. The
  // aft handrail carries a wider grip above the flight of steps. The source
  // photograph constrains their deployed silhouette, not the internal rigging.
  for (const [key, x, yFixed, step, radius] of [
    ["forward-stay", xCenter + 0.328, -0.43, 5, 0.0085],
    ["aft-handrail", xCenter - 0.324, -0.08, 5, 0.019],
  ] as const) {
    const fixed = FUSE.onSkin(x, yFixed, -1, 1);
    fixed.z += 0.123;
    const stepEnd = tread(step);
    stepEnd.x = x;
    stepEnd.y += 0.027;
    const movingEnd = fromOpen(stepEnd).sub(hinge);
    const reach = new THREE.Vector3();
    function span(fraction: number) {
      return reach
        .copy(movingEnd)
        .applyAxisAngle(axis, openAngle * fraction)
        .add(hinge)
        .sub(fixed);
    }
    for (const [segment, a, b, r] of [
      ["upper", 0, 0.53, radius * 1.43],
      ["lower", 0.53, 1, radius],
    ] as const) {
      const closed = span(0);
      cat.part(() => cyl(r, 1, "y", 12).translate(0, 0.5, 0), systems, {
        id: "entry.telescoping-rail",
        instance: [key, segment],
        name: key === "aft-handrail" ? "Boarding handrail" : "Door stay",
        note:
          key === "aft-handrail" ? "The boarding handrail runs along the aft side of the deployed stairs." : undefined,
        ext: true,
        solidMaterial: () => finishMat.polished,
        pos: toVec3(fixed.clone().addScaledVector(closed, a)),
        rot: [Math.atan2(closed.z, closed.y), 0, 0],
        scale: [1, closed.length() * (b - a), 1],
        anim: (mesh) => {
          const d = span(entryProgress());
          mesh.position.copy(fixed).addScaledVector(d, a);
          mesh.rotation.x = Math.atan2(d.z, d.y);
          mesh.scale.y = d.length() * (b - a);
        },
      });
    }
  }
}
