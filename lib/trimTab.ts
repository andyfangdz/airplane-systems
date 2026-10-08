/** Matching elevator cutout and trim tab, sharing the airfoil and the swept trailing-edge hinge. */
import type * as THREE from "three";
import { loft, type Ring } from "./geometry";
import { V, toVec3 } from "./math";

export function trailingEdgeTab({
  z0,
  z1,
  chord,
  y,
  leadingEdge,
  sectionChord,
  section,
}: {
  z0: number;
  z1: number;
  /** Approximate tab chord in metres; the parent airfoil supplies the thickness and trailing edge. */
  chord: number;
  y: number;
  leadingEdge: (z: number) => number;
  sectionChord: (z: number) => number;
  section: (z: number, from: number, to: number) => Ring;
}) {
  const hinge = (z: number) => V(leadingEdge(z) - sectionChord(z) + chord, y, z);
  const center = hinge((z0 + z1) / 2);
  const axis = hinge(z1).sub(hinge(z0)).normalize();
  const cut = (z: number) => 1 - chord / sectionChord(z);
  const gap = 0.006; // illustrative hinge/end clearance, including skin thickness at full travel; not a maintenance dimension

  /** Two rings at each tab end close the step in the skin without bridging across the cutout. */
  const notch = (stations: number[], from: (z: number) => number): Ring[] =>
    [...new Set([...stations, z0, z1])]
      .sort((a, b) => a - b)
      .flatMap((z) => {
        const full = () => section(z, from(z), 1);
        const short = () => section(z, from(z), cut(z));
        return z === z0 ? [full(), short()] : z === z1 ? [short(), full()] : [z > z0 && z < z1 ? short() : full()];
      });

  const geo = () => {
    const g = loft([z0 + gap, (z0 + z1) / 2, z1 - gap].map((z) => section(z, cut(z) + gap / sectionChord(z), 1)));
    return g.translate(-center.x, -center.y, -center.z);
  };
  /** Point on the moving tab in neutral-elevator coordinates (e.g. a horn's rod attachment). */
  const point = (offset: THREE.Vector3, angle: number) => offset.clone().applyAxisAngle(axis, angle).add(center);
  return { z0, z1, chord, pivot: toVec3(center), axis: toVec3(axis), geo, notch, point };
}
