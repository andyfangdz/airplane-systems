import { expect, it } from "vitest";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { gap, solid } from "./sr22t-tks-horn-clearance";

// Installed BVH supports indirect indexing; its older declarations omit it.
const BVH_OPTIONS = { indirect: true, setBoundingBox: true };

it.each([false, true])(
  "TKS nearest-distance oracle preserves brute clearance with grouped=%s source roots",
  (grouped) => {
    const source = grouped
      ? new THREE.BoxGeometry(0.02, 0.02, 0.02).translate(0.9, 0, 0)
      : new THREE.PlaneGeometry(0.02, 0.02).rotateY(Math.PI / 2).translate(0.9, 0, 0);
    // BoxGeometry has 12 triangles overall but six groups, each with a leaf root.
    const a = solid(source);
    // Exercise material-group roots explicitly: the library's direct builder
    // keeps separate roots, whereas its indirect builder merges group ranges.
    if (grouped) a.bvh = new MeshBVH(a.g);
    const b = solid(new THREE.SphereGeometry(0.05, 32, 16).translate(1, 0, 0));
    const primer = new THREE.SphereGeometry(0.05, 32, 16).translate(1.3, 0, 0);
    try {
      const brute = a.bvh.closestPointToGeometry(b.g, new THREE.Matrix4())!.distance;
      expect(brute).toBeGreaterThan(0);
      // Leave the library's shared OBB near the sphere's far side, as in the
      // three-mesh-bvh 0.8.3 repro. A leaf root must not prune using this unrelated box.
      new MeshBVH(primer, BVH_OPTIONS).closestPointToGeometry(b.g, new THREE.Matrix4());
      expect(gap(a, b)).toBe(brute);
      expect(b.g.boundsTree).toBeUndefined();
    } finally {
      a.g.dispose();
      b.g.dispose();
      primer.dispose();
    }
  },
);
