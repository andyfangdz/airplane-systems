/**
 * NAV III control wheel (172S and 182T): the "ram's horn" wheel, drawn in the wheel group's frame — origin on the column
 * axis at the hub, x forward, y up, z right — so the group turns it about x for roll. A square hub pad covers the end of
 * the column; from each side of it an arm runs outboard to a rounded corner, and the grip rises from there back inboard
 * to a squared end cap. The pilot's left cap and grip carry the autopilot and trim switches.
 *
 * The POH gives no dimensions: proportions are scaled from photos of the NAV III panel (G1000 display bezels for scale),
 * about 13 in across the corners and 5½ in from the corner to the top of the cap.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeos, roundEnds, sweepGeo } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";

/** Outer corner and end cap of the right horn (z mirrored for the left); the grip leans inboard between them. */
const CORNER = { y: -0.025, z: 0.158 },
  CAP = { y: 0.112, z: 0.104 };
/** The grips rake slightly aft, toward the pilot. */
const RAKE = -0.014;
/** Inboard lean of each grip from vertical (rad). */
const LEAN = Math.atan2(CORNER.z - CAP.z, CAP.y - CORNER.y);
const HUB = { w: 0.112, h: 0.096, d: 0.046, x: -0.004 };
const CAP_SIZE = { d: 0.034, l: 0.03, w: 0.036 };

/** Horn centreline, hub to cap, for side s (−1 left, +1 right). */
const horn = (s: number): Vec3[] => [
  [0.004, -0.004, s * 0.03],
  [0.002, -0.02, s * 0.09],
  [0, -0.03, s * 0.135],
  [-0.001, -0.016, s * 0.158],
  [RAKE * 0.3, 0.025, s * 0.148],
  [RAKE * 0.7, 0.07, s * 0.126],
  [RAKE, CAP.y - 0.006, s * (CAP.z + 0.003)],
];
/** Arm: flattened fore-aft; grip: rounder and fuller in the middle, where the hand closes. */
const hornR = (t: number): [number, number] => {
  const g = THREE.MathUtils.smoothstep(t, 0.35, 0.55),
    mid = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.5) / 0.5, 0, 1)) * 0.002;
  const e = roundEnds(t, 0, 0.04);
  return [(0.011 + 0.005 * g + mid) * e, (0.014 + 0.002 * g + mid) * e];
};

/** Rotation about x that stands a cap-aligned part along side s's grip. */
export const capRot = (s: number): Vec3 => [-s * LEAN, 0, 0];
/**
 * A point in side s's end-cap frame → wheel frame: u fore-aft (+ forward), v along the grip (+ out of the cap's end face),
 * w across it (+ toward the right wing). `onCap(s, 0, CAP_END, 0)` is the middle of the end face.
 */
export function onCap(s: number, u: number, v: number, w: number): Vec3 {
  const a = -s * LEAN,
    c = Math.cos(a),
    sn = Math.sin(a);
  return [RAKE + u, CAP.y + v * c - w * sn, s * CAP.z + v * sn + w * c];
}
/** End face of the cap, as `v` in `onCap`. */
export const CAP_END = CAP_SIZE.l / 2;
/** Pilot-facing (aft) side of side s's grip, a fraction f of the way from the corner to the cap. */
export function gripAft(s: number, f: number): Vec3 {
  const q = 0.25 + 0.6 * f;
  return [RAKE * q - 0.017, CORNER.y + (CAP.y - CORNER.y) * q, s * (CORNER.z + (CAP.z - CORNER.z) * q - 0.004)];
}
/** Middle of the hub pad's lower surface. */
export const HUB_LOW: Vec3 = [HUB.x, -HUB.h / 2, 0];

/** Hub pad, both horns and their end caps, as one mesh. */
export function controlWheelGeo() {
  const hub = new RoundedBoxGeometry(HUB.d, HUB.h, HUB.w, 3, 0.014);
  hub.translate(HUB.x, 0, 0);
  const parts: THREE.BufferGeometry[] = [hub];
  [-1, 1].forEach((s) => {
    parts.push(sweepGeo(horn(s), hornR));
    const cap = new RoundedBoxGeometry(CAP_SIZE.d, CAP_SIZE.l, CAP_SIZE.w, 2, 0.008);
    cap.rotateX(capRot(s)[0]);
    cap.translate(...onCap(s, 0, 0, 0));
    parts.push(cap);
  });
  return mergeGeos(parts);
}

/** Round emblem plate on the aft face of the hub. */
export function wheelEmblemGeo() {
  const g = new THREE.CylinderGeometry(0.02, 0.02, 0.004, 28);
  g.rotateZ(Math.PI / 2);
  g.translate(HUB.x - HUB.d / 2 - 0.001, -0.01, 0);
  return g;
}
