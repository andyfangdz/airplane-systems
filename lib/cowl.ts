/** Actual inlet apertures, cut through the nose skin rather than painted opaque patches. */
import * as THREE from "three";

export interface CowlInlet {
  y: number;
  z: number;
  width: number;
  height: number;
  exponent: number;
  /** Restrict the cut to the nose; never punch the same projection through the cabin/tail. */
  minX: number;
}

export function inletContour(inlet: CowlInlet) {
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * 2 * Math.PI;
    return [
      inlet.y + 0.45 * inlet.height * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** (2 / inlet.exponent),
      inlet.z + 0.45 * inlet.width * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** (2 / inlet.exponent),
    ];
  });
}

/** Subtract convex inlet prisms from triangles. Interpolate all attributes at cut edges,
 * preserving smooth normals, paint UVs and winding. No opacity/sorting or picking workaround. */
export function cutCowlInlets(source: THREE.BufferGeometry, inlets: CowlInlet[]) {
  return inletGeometry(source, inlets, false);
}

/** Retain the exact skin removed by an aperture, e.g. for a conformal moving door.
 * Additional planes keep their negative half-space. The source is disposed as with the cutter. */
export function inletSkins(source: THREE.BufferGeometry, inlets: CowlInlet[], planes: THREE.Plane[] = []) {
  return inletGeometry(source, inlets, true, planes);
}

/** Exact rectangular apertures. Their rim does not grow when the surrounding mesh is coarsened. */
export function cutBoxes(source: THREE.BufferGeometry, boxes: THREE.Box3[]) {
  return inletGeometry(source, [], false, [], boxes).setIndex(null);
}

function inletGeometry(
  source: THREE.BufferGeometry,
  inlets: CowlInlet[],
  retain: boolean,
  extraPlanes: THREE.Plane[] = [],
  boxes: THREE.Box3[] = [],
) {
  const attrs = Object.entries(source.attributes);
  const sizes = attrs.map(([, attr]) => attr.itemSize);
  const offsets = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  const pOffset = offsets[attrs.findIndex(([name]) => name === "position")];
  const normalIndex = attrs.findIndex(([name]) => name === "normal");
  type Vertex = number[];
  const vertex = (i: number): Vertex =>
    attrs.flatMap(([, attr]) => Array.from({ length: attr.itemSize }, (_, k) => attr.getComponent(i, k)));
  const output = attrs.map(() => [] as number[]);
  const cutters = inlets.map((inlet) => {
    const contour = inletContour(inlet);
    const planes = [(v: Vertex) => inlet.minX - v[pOffset]];
    contour.forEach(([y, z], i) => {
      const [yy, zz] = contour[(i + 1) % contour.length];
      // The contour is clockwise in y/z; interior lies to the right of each edge.
      planes.push((v) => (yy - y) * (v[pOffset + 2] - z) - (zz - z) * (v[pOffset + 1] - y));
    });
    planes.push(
      ...extraPlanes.map(
        (plane) => (v: Vertex) =>
          plane.normal.x * v[pOffset] +
          plane.normal.y * v[pOffset + 1] +
          plane.normal.z * v[pOffset + 2] +
          plane.constant,
      ),
    );
    return { inlet, planes };
  });
  for (const box of boxes) {
    const min = box.min.toArray(),
      max = box.max.toArray();
    cutters.push({
      inlet: {
        minX: min[0],
        y: (min[1] + max[1]) / 2,
        z: (min[2] + max[2]) / 2,
        height: max[1] - min[1],
        width: max[2] - min[2],
        exponent: 2,
      },
      planes: [0, 1, 2].flatMap((axis) => [
        (v: Vertex) => min[axis] - v[pOffset + axis],
        (v: Vertex) => v[pOffset + axis] - max[axis],
      ]),
    });
  }
  const emit = (poly: Vertex[]) => {
    for (let i = 1; i + 1 < poly.length; i++) {
      const tri = [poly[0], poly[i], poly[i + 1]];
      const a = new THREE.Vector3().fromArray(tri[0], pOffset);
      const b = new THREE.Vector3().fromArray(tri[1], pOffset).sub(a);
      const c = new THREE.Vector3().fromArray(tri[2], pOffset).sub(a);
      if (b.cross(c).lengthSq() < 1e-20) continue;
      for (const v of tri) attrs.forEach((_, k) => output[k].push(...v.slice(offsets[k], offsets[k] + sizes[k])));
    }
  };
  const count = source.index?.count ?? source.attributes.position.count;
  for (let i = 0; i < count; i += 3) {
    let polygons = [Array.from({ length: 3 }, (_, j) => vertex(source.index ? source.index.getX(i + j) : i + j))];
    for (const { inlet, planes } of cutters) {
      const remaining: Vertex[][] = [];
      for (const poly of polygons) {
        if (
          poly.every((v) => v[pOffset] < inlet.minX) ||
          poly.every((v) => v[pOffset + 1] < inlet.y - inlet.height / 2) ||
          poly.every((v) => v[pOffset + 1] > inlet.y + inlet.height / 2) ||
          poly.every((v) => v[pOffset + 2] < inlet.z - inlet.width / 2) ||
          poly.every((v) => v[pOffset + 2] > inlet.z + inlet.width / 2)
        ) {
          remaining.push(poly);
          continue;
        }
        let inside = poly;
        for (const distance of planes) {
          if (!inside.length) break;
          const next: Vertex[] = [],
            outside: Vertex[] = [];
          inside.forEach((a, j) => {
            const b = inside[(j + 1) % inside.length],
              da = distance(a),
              db = distance(b);
            // A point exactly on the plane belongs to both clipped polygons.
            if (da <= 0) next.push(a);
            if (da >= 0) outside.push(a);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
              const t = da / (da - db),
                intersection = a.map((v, k) => v + t * (b[k] - v));
              if (boxes.length && normalIndex >= 0) {
                const o = offsets[normalIndex],
                  length = Math.hypot(...intersection.slice(o, o + 3));
                if (length) for (let k = o; k < o + 3; k++) intersection[k] /= length;
              }
              next.push(intersection);
              outside.push(intersection);
            }
          });
          if (outside.length >= 3) remaining.push(outside);
          inside = next;
        }
        // Retained skin uses the same triangle intersections as the surrounding aperture.
        if (retain && inside.length >= 3) emit(inside);
      }
      polygons = remaining;
    }
    if (!retain) polygons.forEach(emit);
  }
  const g = new THREE.BufferGeometry();
  attrs.forEach(([name], i) => g.setAttribute(name, new THREE.Float32BufferAttribute(output[i], sizes[i])));
  g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  if (g.attributes.normal && !boxes.length) g.normalizeNormals();
  source.dispose();
  return g;
}
