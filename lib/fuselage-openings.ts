import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { densify, type fuselage } from "./geometry";
import { curvedSkinPatch } from "./skin-patch";

type Fuselage = ReturnType<typeof fuselage>;

/** Smooth normal of the station-table surface, independent of the triangulation. */
export function fuselageNormal(fuse: Fuselage, p: THREE.Vector3) {
  const field = (x: number) => {
    const { hw, hh, cy, nTop, nBot, tumble } = fuse.section(x),
      py = (p.y - cy) / hh;
    const n = py >= 0 ? nTop : nBot,
      w = hw * (1 - tumble * Math.max(0, py));
    return Math.pow(Math.abs(p.z) / w, n) + Math.pow(Math.abs(py), n);
  };
  const { hw, hh, cy, nTop, nBot, tumble } = fuse.section(p.x),
    py = (p.y - cy) / hh;
  const n = py >= 0 ? nTop : nBot,
    w = hw * (1 - tumble * Math.max(0, py));
  const ny =
    (n * Math.sign(py) * Math.pow(Math.abs(py), n - 1)) / hh +
    (py > 0 ? (n * Math.pow(Math.abs(p.z) / w, n) * tumble) / (hh * (1 - tumble * py)) : 0);
  return new THREE.Vector3(
    (field(p.x + 0.0001) - field(p.x - 0.0001)) / 0.0002,
    ny,
    (n * Math.sign(p.z) * Math.pow(Math.abs(p.z) / w, n - 1)) / w,
  ).normalize();
}

/** The SR22T's arc-length skin parameterization, shared with the rest of the fleet.
 * Unlike side-projected y, q remains regular where a door wraps over a curved roof. */
export function fuselageOpenings(fuse: Fuselage) {
  const cache = new Map<number, { points: THREE.Vector3[]; lengths: number[]; total: number }>();
  const arc = (x: number) => {
    const key = Math.round(x * 1e6) / 1e6;
    let row = cache.get(key);
    if (!row) {
      const points = fuse.ring(key, 1, 240, -Math.PI / 2, Math.PI / 2, false),
        lengths = [0];
      // cos(π/2) is not exactly zero; fractional superellipse powers amplify that
      // residue into a gap between the port/starboard halves. Weld the shared seam.
      points[0].z = points.at(-1)!.z = 0;
      for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
      row = { points, lengths, total: lengths.at(-1)! };
      if (cache.size >= 8192) cache.delete(cache.keys().next().value!);
      cache.set(key, row);
    }
    return row;
  };
  const point = (p: THREE.Vector2, side: number) => {
    const { points, lengths, total } = arc(p.x),
      target = ((p.y + 1) * total) / 2;
    if (p.y <= -1 || p.y >= 1) {
      const end = points[p.y <= -1 ? 0 : points.length - 1];
      return new THREE.Vector3(p.x, end.y, 0);
    }
    let lo = 1,
      hi = lengths.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (lengths[m] < target) lo = m + 1;
      else hi = m;
    }
    const t = THREE.MathUtils.clamp((target - lengths[lo - 1]) / (lengths[lo] - lengths[lo - 1]), 0, 1);
    const v = points[lo - 1].clone().lerp(points[lo], t);
    return v.set(p.x, v.y, v.z * side);
  };
  const parameter = (p: THREE.Vector3) => {
    const { points, lengths, total } = arc(p.x);
    let lo = 0,
      hi = points.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (points[m].y < p.y) lo = m;
      else hi = m;
    }
    const t = THREE.MathUtils.clamp((p.y - points[lo].y) / (points[hi].y - points[lo].y), 0, 1);
    return new THREE.Vector2(p.x, (2 * THREE.MathUtils.lerp(lengths[lo], lengths[hi], t)) / total - 1);
  };
  const outline = (xy: number[][]) => densify(xy, 0.03).map(([x, y]) => parameter(fuse.onSkin(x, y, 1, 1)));
  const patch = (outline: THREE.Vector2[], holes: THREE.Vector2[][], side: number) =>
    curvedSkinPatch({
      outline,
      holes,
      side,
      point: (p) => point(p, side),
      parameter,
      splitX: fuse.stations,
      normal: (p) => fuselageNormal(fuse, p),
      uv: (p) => [p.x, p.y],
    });
  const hull = (holes: { side: number; outline: THREE.Vector2[] }[]) => {
    const rectangle = [
      new THREE.Vector2(fuse.xTail, -1),
      new THREE.Vector2(fuse.xNose, -1),
      new THREE.Vector2(fuse.xNose, 1),
      new THREE.Vector2(fuse.xTail, 1),
    ];
    const pieces = [-1, 1].map((side) =>
      patch(
        rectangle,
        holes.filter((h) => h.side === side).map((h) => h.outline),
        side,
      ),
    );
    for (const x of [fuse.xTail, fuse.xNose]) {
      const source = fuse.plate(x, 1),
        g = source.toNonIndexed();
      source.dispose();
      const a = g.getAttribute("position"),
        n = g.getAttribute("normal"),
        uv = new Float32Array(a.count * 2);
      // plate() faces forward; the tail closure must face aft as well as carry an aft normal.
      if (x === fuse.xTail)
        for (let i = 0; i < a.count; i += 3) {
          const first = new THREE.Vector3().fromBufferAttribute(a, i);
          a.setXYZ(i, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
          a.setXYZ(i + 2, first.x, first.y, first.z);
        }
      for (let i = 0; i < a.count; i++) {
        n.setXYZ(i, x === fuse.xTail ? -1 : 1, 0, 0);
        uv.set([a.getX(i), a.getY(i)], i * 2);
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      pieces.push(g);
    }
    const result = mergeGeometries(pieces)!;
    pieces.forEach((g) => g.dispose());
    cache.clear();
    return result;
  };
  return { point, parameter, outline, patch, hull, normal: (p: THREE.Vector3) => fuselageNormal(fuse, p) };
}

/** Parallel inset in the unwrapped skin, used for a visible door-to-jamb clearance.
 * Convex door outlines only; clearance is illustrative unless an aircraft cites a measured value. */
export function insetOutline(poly: THREE.Vector2[], distance = 0.0022) {
  const winding = THREE.ShapeUtils.isClockWise(poly) ? -1 : 1;
  return poly.map((p, i) => {
    const a = p
      .clone()
      .sub(poly[(i + poly.length - 1) % poly.length])
      .normalize();
    const b = poly[(i + 1) % poly.length].clone().sub(p).normalize();
    const na = new THREE.Vector2(a.y, -a.x).multiplyScalar(winding),
      nb = new THREE.Vector2(b.y, -b.x).multiplyScalar(winding);
    const bisector = na.add(nb);
    return p
      .clone()
      .addScaledVector(bisector, -distance / bisector.dot(new THREE.Vector2(a.y, -a.x).multiplyScalar(winding)));
  });
}
