import * as THREE from "three";

export type Vec3 = [number, number, number];

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const D2R = Math.PI / 180;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A Vector3 as a tuple. */
export const toVec3 = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Accepts either a tuple or a Vector3 and returns a fresh Vector3. */
export const toV = (p: Vec3 | THREE.Vector3) => (Array.isArray(p) ? V(p[0], p[1], p[2]) : p.clone());

/** Where circle (c, r1) meets circle (e, r2) in a plane — the solution nearer (nx, ny). */
export function circleMeet(
  cx: number,
  cy: number,
  r1: number,
  ex: number,
  ey: number,
  r2: number,
  nx: number,
  ny: number,
): [number, number] {
  const dx = ex - cx,
    dy = ey - cy,
    d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const bx = cx + (a * dx) / d,
    by = cy + (a * dy) / d;
  const p: [number, number] = [bx - (h * dy) / d, by + (h * dx) / d],
    q: [number, number] = [bx + (h * dy) / d, by - (h * dx) / d];
  return Math.hypot(p[0] - nx, p[1] - ny) <= Math.hypot(q[0] - nx, q[1] - ny) ? p : q;
}

/** Bisection root of a monotonic f on [lo, hi]. */
export function bisect(f: (x: number) => number, lo: number, hi: number) {
  let flo = f(lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2,
      fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}
