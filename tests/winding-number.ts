import * as THREE from "three";

export type Tri = readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3];

/**
 * Generalized winding number of a triangle soup about `p` (Jacobson et al. 2013): the summed signed solid angle of
 * every triangle over 4π. It is 1 inside a closed outward-wound mesh and 0 outside, with no ray, so shared edges and
 * vertices cannot be counted twice. It degrades gracefully where parity breaks:
 * - concatenated overlapping components add up (2 in the overlap) and a shared internal face cancels;
 * - an uncapped tube reads close to 1 along its interior, away from the open ends;
 * - a single open plate never exceeds ½ on either side.
 * Mirrored (negative-scale) parts reverse the winding, so callers compare the magnitude.
 */
export const windingNumber = ({ x, y, z }: THREE.Vector3, mesh: readonly Tri[]) => {
  let sum = 0;
  // Scalar arithmetic: this loop visits every triangle for every query point.
  for (const [a, b, c] of mesh) {
    const ax = a.x - x,
      ay = a.y - y,
      az = a.z - z,
      bx = b.x - x,
      by = b.y - y,
      bz = b.z - z,
      cx = c.x - x,
      cy = c.y - y,
      cz = c.z - z;
    const la = Math.sqrt(ax * ax + ay * ay + az * az),
      lb = Math.sqrt(bx * bx + by * by + bz * bz),
      lc = Math.sqrt(cx * cx + cy * cy + cz * cz);
    // Van Oosterom & Strackee's solid angle of one triangle
    const num = ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    const den =
      la * lb * lc +
      (ax * bx + ay * by + az * bz) * lc +
      (ax * cx + ay * cy + az * cz) * lb +
      (bx * cx + by * cy + bz * cz) * la;
    sum += 2 * Math.atan2(num, den);
  }
  return sum / (4 * Math.PI);
};

/** Inside the solid volume a mesh bounds. The ½ threshold excludes the near side of a single open plate. */
export const insideSolid = (p: THREE.Vector3, mesh: readonly Tri[]) => Math.abs(windingNumber(p, mesh)) > 0.5 + 1e-6;
