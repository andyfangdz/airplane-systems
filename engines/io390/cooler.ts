// Cirrus SR20 AMM 12137-002, 79-20 Fig. 79-20-1. The two scenes have different engine stations.
// Locate the bracket on their actual diagonal weldment tube. Dimensions and clocking are illustrative.
import * as THREE from "three";
import { box, loft, mergeGeos, tubeGeo } from "@/lib/geometry";
import { type Vec3, V, toV } from "@/lib/math";

export function coolerMount(wall: Vec3, foot: Vec3) {
  const onTube = (t: number): Vec3 => toV(wall).lerp(toV(foot), t).toArray();
  const [x, y, z] = onTube(0.5);
  const center: Vec3 = [x, y, z - 0.091];
  const at = (dx: number, dy: number, dz: number): Vec3 => [center[0] + dx, center[1] + dy, center[2] + dz];
  return {
    center,
    pads: [onTube(0.34), onTube(0.66)],
    at,
    feed: at(-0.034, 0.067, -0.052),
    outlet: at(-0.034, 0.067, 0.052),
    inlet: at(-0.064, 0, 0),
  };
}
export type CoolerMount = ReturnType<typeof coolerMount>;

export function coolerDuctPath(m: CoolerMount, baffle: Vec3): Vec3[] {
  return [
    m.inlet,
    m.at(-0.08, 0, -0.004),
    m.at(-0.085, 0.027, -0.028),
    m.at(-0.073, 0.12, -0.024),
    m.at(0.01, 0.137, 0),
    [baffle[0] - 0.041, baffle[1] + 0.011, baffle[2]],
    baffle,
  ];
}
export function coolerCore() {
  const plates = Array.from({ length: 18 }, (_, i) => box(0.057, 0.0016, 0.106).translate(0, -0.048 + i * 0.0056, 0));
  const fins = Array.from({ length: 32 }, (_, i) => box(0.055, 0.096, 0.0007).translate(0, 0, (i - 15.5) * 0.0032));
  return mergeGeos([...plates, ...fins, ...[-1, 1].map((s) => box(0.059, 0.104, 0.014).translate(0, 0, s * 0.057))]);
}

export function coolerDiffuser() {
  const ring = (x: number, rect: boolean) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16,
        y = Math.cos(a),
        z = Math.sin(a);
      const scale = rect ? 1 / Math.max(Math.abs(y), Math.abs(z)) : 1;
      return V(x, y * scale * (rect ? 0.053 : 0.029), z * scale * (rect ? 0.065 : 0.029));
    });
  return loft([ring(-0.028, true), ring(-0.059, false), ring(-0.071, false)], { caps: false });
}
export function coolerBracket(m: CoolerMount) {
  const c = toV(m.center);
  return mergeGeos([
    box(0.064, 0.109, 0.003).translate(0, 0, 0.067),
    ...[-1, 1].map((s) => box(0.064, 0.003, 0.136).translate(0, s * 0.054, 0)),
    ...m.pads.map((p) => {
      const local = toV(p).sub(c);
      return tubeGeo(
        [local, V(Math.max(-0.026, Math.min(0.026, local.x)), Math.max(-0.047, Math.min(0.047, local.y)), 0.067)],
        0.008,
      );
    }),
  ]);
}
export function coolerElbow(side: number) {
  return tubeGeo(
    [
      V(0, 0.047, side * 0.052),
      V(0, 0.062, side * 0.052),
      V(-0.012, 0.067, side * 0.052),
      V(-0.034, 0.067, side * 0.052),
    ],
    0.006,
  );
}

// A drilled bulkhead normal to the fore-aft axis. Coordinate offsets are in the panel's y-z plane.
export function coolerBaffle(width: number, height: number, portY: number, portZ: number) {
  const w = width / 2,
    h = height / 2;
  const s = new THREE.Shape().moveTo(-w, -h).lineTo(w, -h).lineTo(w, h).lineTo(-w, h).closePath();
  s.holes.push(new THREE.Path().absarc(-portZ, portY, 0.029, 0, Math.PI * 2, true));
  return new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false, curveSegments: 24 })
    .translate(0, 0, -0.0015)
    .rotateY(Math.PI / 2);
}
