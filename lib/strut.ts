import * as THREE from "three";
import type { Catalogue, PartSpec } from "./catalogue";
import { cyl, sph } from "./geometry";
import type { SysId } from "./systems";
import { toVec3 } from "./math";

const UP = new THREE.Vector3(0, 1, 0);
export function spanPose(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).lerp(b, 0.5);
  const direction = b.clone().sub(a);
  mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}

/** Fixed-length barrel and sliding rod between two actual attachments. No geometry is rebuilt per frame.
 * Dimensions remain illustrative; the caller supplies the documented mechanism and aircraft-specific anchors. */
export function telescopingStrut(
  cat: Catalogue,
  {
    id,
    name,
    note,
    sys,
    ends,
    fraction,
    replace,
  }: {
    id: string;
    name: string;
    note: string;
    sys: SysId[];
    ends: (fraction: number) => { fixed: THREE.Vector3; moving: THREE.Vector3 };
    fraction: () => number;
    replace?: PartSpec;
  },
) {
  const rest = ends(0),
    bodyLength = rest.fixed.distanceTo(rest.moving) * 0.93;
  const section = (rod: boolean, f: number) => {
    const { fixed, moving } = ends(f);
    const shoulder = fixed.clone().addScaledVector(moving.clone().sub(fixed).normalize(), bodyLength);
    return rod ? [shoulder, moving] : [fixed, shoulder];
  };
  const members = [false, true].map((rod) => {
    const [a, b] = section(rod, 0),
      pose = new THREE.Object3D();
    spanPose(pose, a, b);
    const geo = () => cyl(rod ? 0.0045 : 0.009, 1, "y", 16);
    const opts = {
      name: rod ? `${name} piston rod` : name,
      note,
      color: rod ? "#D6DEE3" : "#697881",
      pos: toVec3(pose.position),
      rot: [pose.rotation.x, pose.rotation.y, pose.rotation.z] as [number, number, number],
      scale: toVec3(pose.scale),
      pin: false,
      anim: (mesh: THREE.Mesh) => {
        const [a, b] = section(rod, fraction());
        spanPose(mesh, a, b);
      },
    };
    if (!rod && replace) {
      Object.assign(replace, opts, { geo, sys, pin: replace.pin });
      return replace;
    }
    return cat.part(geo, sys, { id: "lib.strut.part.001", instance: [id, rod], ...opts });
  });
  for (const key of ["fixed", "moving"] as const)
    cat.part(() => sph(0.011), sys, {
      id: "lib.strut.part.002",
      instance: [id, key],
      name: `${name} ${key} ball joint`,
      note,
      pos: toVec3(rest[key]),
      color: "#85939C",
      anim: (mesh) => {
        mesh.position.copy(ends(fraction())[key]);
      },
    });
  return { members, bodyLength, ends };
}
