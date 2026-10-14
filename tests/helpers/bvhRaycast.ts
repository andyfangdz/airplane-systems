import type * as THREE from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";

// As in faceCandidates.ts: `indirect` works at runtime but is missing from 0.8.3's MeshBVHOptions typings.
const BVH_OPTIONS = { indirect: true, setBoundingBox: true };

/**
 * The same mesh, raycast through a BVH built on first use: Raycaster returns the same sorted hits as a full triangle
 * scan. `indirect` leaves the geometry's index order untouched for callers that walk its triangles.
 */
export const bvhRaycast = <T extends THREE.Mesh>(mesh: T) => {
  mesh.geometry.boundsTree ??= new MeshBVH(mesh.geometry, BVH_OPTIONS);
  mesh.raycast = acceleratedRaycast;
  return mesh;
};
