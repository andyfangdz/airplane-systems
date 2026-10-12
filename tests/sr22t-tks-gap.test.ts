import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { ExtendedTriangle, MeshBVH } from "three-mesh-bvh";
import { gap, solid } from "./sr22t-tks-horn-clearance";

// Installed BVH supports indirect indexing; its older declarations omit it.
const BVH_OPTIONS = { indirect: true, setBoundingBox: true };
const triangles = (g: THREE.BufferGeometry) => {
  const position = g.getAttribute("position"),
    index = g.index!,
    out: ExtendedTriangle[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const t = new ExtendedTriangle();
    t.a.fromBufferAttribute(position, index.getX(i));
    t.b.fromBufferAttribute(position, index.getX(i + 1));
    t.c.fromBufferAttribute(position, index.getX(i + 2));
    t.needsUpdate = true;
    out.push(t);
  }
  return out;
};

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

it("TKS nearest-distance oracle takes the dual-BVH path for internal source roots and matches brute clearance", () => {
  // A sphere source has hundreds of triangles: every root is an internal node, so gap() hands over the target's BVH.
  const a = solid(new THREE.SphereGeometry(0.03, 32, 16).translate(0.9, 0, 0));
  const b = solid(new THREE.SphereGeometry(0.05, 16, 8).translate(1, 0.02, 0.01));
  const primer = new THREE.SphereGeometry(0.05, 32, 16).translate(1.3, 0, 0);
  const previous = new MeshBVH(b.g, BVH_OPTIONS);
  try {
    // Brute reference: no boundsTree on the target, so every target triangle is visited.
    const brute = a.bvh.closestPointToGeometry(b.g, new THREE.Matrix4())!.distance;
    expect(brute).toBeGreaterThan(0);
    // Independent of any BVH: the minimum over every source/target triangle pair.
    const targets = triangles(b.g);
    let pairs = Infinity;
    for (const s of triangles(a.g)) for (const t of targets) pairs = Math.min(pairs, s.distanceToTriangle(t));
    expect(brute).toBe(pairs);
    new MeshBVH(primer, BVH_OPTIONS).closestPointToGeometry(b.g, new THREE.Matrix4());
    b.g.boundsTree = previous;
    // The library casts the target's BVH only on the dual-tree path.
    const dual = vi.spyOn(b.bvh, "shapecast");
    expect(gap(a, b)).toBe(brute);
    expect(dual).toHaveBeenCalled();
    expect(b.g.boundsTree).toBe(previous);
  } finally {
    a.g.dispose();
    b.g.dispose();
    primer.dispose();
  }
});
