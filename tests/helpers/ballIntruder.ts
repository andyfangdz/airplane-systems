import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { windingNumberOf } from "../winding-number";

/**
 * For a placed, non-indexed world-space geometry: whether a ball of radius `r` at a point reaches the solid, i.e. its
 * nearest triangle is closer than `r` (a BVH query), or the point is inside (generalised winding number above ¾, which
 * overlapping merged pieces and either winding order keep; an open plate never reaches it). The solid lies within its
 * own bounding box, so the winding sum, which visits every triangle, runs only for points inside that box.
 * The geometry gains a BVH index and must stay unchanged while this is used.
 */
export const ballIntruder = (g: THREE.BufferGeometry) => {
  const xyz = g.getAttribute("position").array;
  const bvh = new MeshBVH(g),
    nearest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  const world = new THREE.Box3().setFromBufferAttribute(g.getAttribute("position") as THREE.BufferAttribute);
  // Stops at the first triangle nearer than r and skips nodes farther than r (a non-null result can still be farther).
  const intrudes = (p: THREE.Vector3, r: number) =>
    (bvh.closestPointToPoint(p, nearest, r, r)?.distance ?? Infinity) < r ||
    (world.containsPoint(p) && Math.abs(windingNumberOf(p, xyz)) > 0.75);
  return { world, intrudes };
};
