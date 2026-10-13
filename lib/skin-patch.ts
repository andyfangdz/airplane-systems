import * as THREE from "three";
import cdt2d from "cdt2d";

export const inPolygon = (p: THREE.Vector2, polygon: readonly THREE.Vector2[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** Triangulate an unwrapped skin with real apertures. Per-axis spacing lets a short nose
 * transition use fine fore/aft steps without a millimetre grid around its circumference.
 * Spacing is a rendering choice, not an aircraft measurement or a continuous error bound.
 * Analytic normals and caller-provided UVs remain independent of tessellation. */
export function curvedSkinPatch({
  outline,
  holes = [],
  side,
  point,
  parameter,
  normal,
  uv,
  parameterStep = (a, b) => a.distanceToSquared(b) / 0.06 ** 2,
  splitX = [],
  tolerance = 0.0004,
}: {
  outline: THREE.Vector2[];
  holes?: THREE.Vector2[][];
  side: number;
  point: (p: THREE.Vector2) => THREE.Vector3;
  parameter: (p: THREE.Vector3) => THREE.Vector2;
  normal: (p: THREE.Vector3) => THREE.Vector3;
  uv: (p: THREE.Vector3) => readonly [number, number];
  parameterStep?: (a: THREE.Vector2, b: THREE.Vector2) => number;
  splitX?: readonly number[];
  /** Sampled chord-to-surface tolerance in metres, not a continuous error bound. */
  tolerance?: number;
}) {
  // Interior seeds keep aperture vertices from producing long, skinny fans across the
  // whole fuselage. CDT retains every boundary segment and uses well-shaped interior faces.
  const points: number[][] = [],
    edges: number[][] = [];
  for (const loop of [outline, ...holes]) {
    const first = points.length;
    const segment = (a: THREE.Vector2, b: THREE.Vector2, depth = 0) => {
      if (depth < 20 && parameterStep(a, b) > 1 + 1e-10) {
        const mid = a.clone().lerp(b, 0.5);
        segment(a, mid, depth + 1);
        segment(mid, b, depth + 1);
      } else points.push([a.x, a.y]);
    };
    for (let i = 0; i < loop.length; i++) segment(loop[i], loop[(i + 1) % loop.length]);
    for (let i = first; i < points.length; i++) edges.push([i, i + 1 === points.length ? first : i + 1]);
  }
  const minX = Math.min(...outline.map((p) => p.x)),
    maxX = Math.max(...outline.map((p) => p.x));
  const minY = Math.min(...outline.map((p) => p.y)),
    maxY = Math.max(...outline.map((p) => p.y));
  const nearEdge = (p: THREE.Vector2) =>
    edges.some(([ai, bi]) => {
      const a = points[ai],
        b = points[bi],
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
      return (p.x - a[0] - t * dx) ** 2 + (p.y - a[1] - t * dy) ** 2 < 1e-10;
    });
  for (let x = minX + 0.06; x < maxX; x += 0.06)
    for (let y = minY + 0.06; y < maxY; y += 0.06) {
      const p = new THREE.Vector2(x, y);
      if (inPolygon(p, outline) && !holes.some((hole) => inPolygon(p, hole)) && !nearEdge(p)) points.push([x, y]);
    }
  const cells = cdt2d(points, edges, { exterior: false });
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [];
  const cache = new Map<number, Map<number, { p: THREE.Vector3; n?: THREE.Vector3 }>>();
  const corner = (v: THREE.Vector2) => {
    let row = cache.get(v.x);
    if (!row) cache.set(v.x, (row = new Map()));
    let c = row.get(v.y);
    if (!c) row.set(v.y, (c = { p: point(v) }));
    return c;
  };
  const emit = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth = 0) => {
    const vertices = [a, b, c];
    // Preserve loft station creases exactly instead of letting a chord bridge a concave station.
    const low = Math.min(a.x, b.x, c.x),
      high = Math.max(a.x, b.x, c.x);
    const planes = splitX.filter((x) => x > low + 1e-8 && x < high - 1e-8);
    if (planes.length && depth < 26) {
      const x = planes.reduce((best, v) =>
        Math.abs(v - (low + high) / 2) < Math.abs(best - (low + high) / 2) ? v : best,
      );
      const edge = vertices.findIndex((v, i) => (v.x - x) * (vertices[(i + 1) % 3].x - x) < -1e-16);
      if (edge >= 0) {
        const u = vertices[edge],
          v = vertices[(edge + 1) % 3],
          other = vertices[(edge + 2) % 3];
        const mid = u.clone().lerp(v, (x - u.x) / (v.x - u.x));
        mid.x = x;
        emit(u, mid, other, depth + 1);
        emit(mid, v, other, depth + 1);
        return;
      }
    }
    const scores = vertices.map((v, i) => parameterStep(v, vertices[(i + 1) % 3]));
    if (depth < 26 && Math.max(...scores) > 1 + 1e-10) {
      const edge = scores.indexOf(Math.max(...scores)),
        next = (edge + 1) % 3,
        other = (edge + 2) % 3;
      const mid = vertices[edge].clone().lerp(vertices[next], 0.5);
      emit(vertices[edge], mid, vertices[other], depth + 1);
      emit(mid, vertices[next], vertices[other], depth + 1);
      return;
    }
    const mapped = vertices.map((v) => {
      const p = corner(v).p;
      return new THREE.Vector3(Math.fround(p.x), Math.fround(p.y), Math.fround(p.z));
    });
    const center = mapped[0].clone().add(mapped[1]).add(mapped[2]).divideScalar(3);
    const mids = vertices.map((v, i) => v.clone().lerp(vertices[(i + 1) % 3], 0.5));
    const errors = mids.map((v, i) => corner(v).p.distanceToSquared(mapped[i].clone().lerp(mapped[(i + 1) % 3], 0.5)));
    const centerError = point(a.clone().add(b).add(c).divideScalar(3)).distanceToSquared(center);
    if (depth < 26 && Math.max(...errors, centerError) > tolerance ** 2) {
      const edge =
        Math.max(...errors) > tolerance ** 2
          ? errors.indexOf(Math.max(...errors))
          : scores.indexOf(Math.max(...scores));
      emit(vertices[edge], mids[edge], vertices[(edge + 2) % 3], depth + 1);
      emit(mids[edge], vertices[(edge + 1) % 3], vertices[(edge + 2) % 3], depth + 1);
      return;
    }
    const inHole = holes.some((hole) => inPolygon(parameter(center), hole));
    // A curved chord may bow into an aperture despite its parameter triangle being outside.
    // Keep the SR22T's sub-millimetre edge refinement instead of masking whole coarse triangles.
    if (inHole) {
      if (depth < 26 && Math.max(a.distanceToSquared(b), b.distanceToSquared(c), c.distanceToSquared(a)) > 0.001 ** 2) {
        emit(a, mids[0], mids[2], depth + 1);
        emit(mids[0], b, mids[1], depth + 1);
        emit(mids[2], mids[1], c, depth + 1);
        emit(mids[0], mids[1], mids[2], depth + 1);
      }
      return;
    }
    const f = mapped;
    if (f[1].clone().sub(f[0]).cross(f[2].clone().sub(f[0])).lengthSq() < 1e-20) return;
    for (const v of side > 0 ? vertices : [...vertices].reverse()) {
      const at = corner(v),
        p = at.p;
      at.n ??= normal(p);
      positions.push(p.x, p.y, p.z);
      normals.push(at.n.x, at.n.y, at.n.z);
      uvs.push(...uv(p));
    }
  };
  for (const cell of cells) {
    const [a, b, c] = cell.map((i) => new THREE.Vector2(...(points[i] as [number, number])));
    // CDT returns counter-clockwise faces; keep the caller's outward skin winding.
    emit(a, b, c);
  }
  return new THREE.BufferGeometry()
    .setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
    .setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}
