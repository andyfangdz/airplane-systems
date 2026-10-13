import * as THREE from "three";
import type { Catalogue, PartSpec } from "./catalogue";
import { tubeGeo } from "./geometry";
import { fuselageOpenings, insetOutline } from "./fuselage-openings";
import type { Vec3 } from "./math";
import { mats, skinMat } from "./materials";
import type { SysId } from "./systems";
import { useView } from "./view";

export interface StudyDoor {
  key: string;
  name: string;
  side: number;
  outline: THREE.Vector2[];
  window?: THREE.Vector2[];
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
  angle: number;
  note: string;
  parent?: string;
  glazing?: boolean;
  windowKey?: string;
  /** Reuse an aircraft's existing seal instead of registering a second one. */
  edgeSeal?: boolean;
}
export type DoorSkin = ReturnType<typeof fuselageOpenings>;

export function studyDoor(
  skin: DoorSkin,
  spec: Omit<StudyDoor, "outline" | "window" | "pivot" | "axis"> & {
    outline: number[][];
    window?: number[][];
    hinge: [THREE.Vector3, THREE.Vector3];
  },
): StudyDoor {
  return {
    ...spec,
    outline: skin.outline(spec.outline),
    window: spec.window && skin.outline(spec.window),
    pivot: spec.hinge[0],
    axis: spec.hinge[1].clone().sub(spec.hinge[0]).normalize(),
  };
}

/** All vertices retain aircraft coordinates. T(pivot) R T(-pivot) then moves the entire assembly,
 * including existing world-coordinate hardware and its local animations, around the same hinge. */
export function doorMatrix(door: StudyDoor, fraction: number, target = new THREE.Matrix4()) {
  target.makeRotationAxis(door.axis, fraction * door.angle);
  const p = door.pivot,
    rotated = p.clone().applyMatrix4(target);
  return target.setPosition(p.clone().sub(rotated));
}
export const doorPoint = (door: StudyDoor, point: THREE.Vector3, fraction: number) =>
  point.clone().applyMatrix4(doorMatrix(door, fraction));

/** Exterior paint is not mirrored onto the cabin trim. Shared with the SR22T door treatment. */
export function plainDoorInterior(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor = vec4(diffuse, opacity);",
    );
  };
  material.customProgramCacheKey = () => "plain-door-interior";
  return material;
}

/** Panels, real window apertures, glazing and an inboard edge seal are ordinary catalogue geometry:
 * they go through the same prebuilt encoder/worker/fallback pipeline as every other system. */
export function registerDoorPanels(
  cat: Catalogue,
  doors: StudyDoor[],
  skin: DoorSkin,
  systems: SysId[],
  paint: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
  texture: () => THREE.Texture,
) {
  let material: THREE.MeshStandardMaterial | undefined;
  const glass = mats("#354C5A").on.clone();
  glass.side = THREE.DoubleSide;
  for (const door of doors) {
    const edge = insetOutline(door.outline);
    const add = (name: string, geo: () => THREE.BufferGeometry, glazing = false) =>
      cat.part(geo, systems, {
        // Exterior skin is checked against the surface itself, not the envelope for internal equipment.
        name,
        note: door.note,
        parent: `door:${door.key}`,
        pin: true,
        fairing: true,
        ext: true,
        color: glazing ? "#354C5A" : "#F3F5F6",
        anim: (mesh) => {
          const view = useView.getState();
          if (!view.xray && view.focus !== name)
            mesh.material = glazing ? glass : (material ??= plainDoorInterior(skinMat(texture).clone()));
        },
      });
    add(door.name, () => paint(skin.patch(edge, door.window ? [door.window] : [], door.side)), door.glazing);
    if (door.window && !door.windowKey) add(`${door.name} window`, () => skin.patch(door.window!, [], door.side), true);
    if (door.edgeSeal === false) continue;
    cat.part(
      () => {
        const points = edge.map((p) => {
          const v = skin.point(p, door.side);
          v.addScaledVector(skin.normal(v), -0.007);
          return v.toArray() as Vec3;
        });
        return tubeGeo([...points, points[0]], 0.003, 0);
      },
      systems,
      {
        name: `${door.name} edge seal`,
        note: `${door.note} Seal profile and edge clearance illustrative.`,
        parent: `door:${door.key}`,
        color: "#454C50",
      },
    );
  }
}

/** Explicit attachment selection. Wrong names/counts fail at registration instead of leaving orphaned hardware. */
export function attachDoorParts(cat: Catalogue, name: string, keys: string[]) {
  const parts = cat.parts.filter((p) => p.name === name);
  if (parts.length !== keys.length)
    throw new Error(`${cat.prefix}: ${name}: expected ${keys.length} door parts, got ${parts.length}`);
  parts.forEach((p, i) => {
    p.parent = `door:${keys[i]}`;
  });
  return parts;
}

/** Absolute local handle/latch pose, chained with existing material animation. */
export function doorHardwareMotion(
  parts: PartSpec[],
  open: (index: number) => boolean,
  axis: "x" | "y" | "z",
  angle: number,
) {
  parts.forEach((p, i) => {
    const previous = p.anim,
      base = p.rot?.[axis === "x" ? 0 : axis === "y" ? 1 : 2] ?? 0;
    p.anim = (mesh, time) => {
      previous?.(mesh, time);
      mesh.rotation[axis] = base + (open(i) ? angle : 0);
    };
    p.note += " Handle/latch travel is an illustrative operating pose, not a rigging dimension.";
  });
}
