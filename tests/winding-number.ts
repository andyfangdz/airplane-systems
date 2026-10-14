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
  for (const [a, b, c] of mesh)
    sum += solidAngle(a.x - x, a.y - y, a.z - z, b.x - x, b.y - y, b.z - z, c.x - x, c.y - y, c.z - z);
  return sum / (4 * Math.PI);
};

/** `windingNumber` over a flat non-indexed position array (x, y, z per corner, three corners per triangle). */
export const windingNumberOf = ({ x, y, z }: THREE.Vector3, xyz: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < xyz.length; i += 9)
    sum += solidAngle(
      xyz[i] - x,
      xyz[i + 1] - y,
      xyz[i + 2] - z,
      xyz[i + 3] - x,
      xyz[i + 4] - y,
      xyz[i + 5] - z,
      xyz[i + 6] - x,
      xyz[i + 7] - y,
      xyz[i + 8] - z,
    );
  return sum / (4 * Math.PI);
};

/**
 * Van Oosterom & Strackee's signed solid angle of the triangle (a, b, c) seen from the origin. Scalar arithmetic with
 * Math.sqrt (not Vector3 or Math.hypot): this runs for every triangle and every query point.
 */
function solidAngle(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
) {
  const la = Math.sqrt(ax * ax + ay * ay + az * az),
    lb = Math.sqrt(bx * bx + by * by + bz * bz),
    lc = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const num = ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  const den =
    la * lb * lc +
    (ax * bx + ay * by + az * bz) * lc +
    (ax * cx + ay * cy + az * cz) * lb +
    (bx * cx + by * cy + bz * cz) * la;
  return 2 * Math.atan2(num, den);
}

/** Each mesh's corners as one flat array, built on its first query: the same values, read without object hops. */
const flat = new WeakMap<readonly Tri[], Float64Array>();
const flatOf = (mesh: readonly Tri[]) => {
  let xyz = flat.get(mesh);
  if (!xyz) {
    xyz = new Float64Array(mesh.length * 9);
    mesh.forEach(([a, b, c], i) => xyz!.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], i * 9));
    flat.set(mesh, xyz);
  }
  return xyz;
};

/**
 * Inside the solid volume a mesh bounds. The ½ threshold excludes the near side of a single open plate.
 * Treat the mesh and its vertices as immutable once queried: the flat copy is cached per mesh array.
 */
export const insideSolid = (p: THREE.Vector3, mesh: readonly Tri[]) =>
  Math.abs(windingNumberOf(p, flatOf(mesh))) > 0.5 + 1e-6;
