/**
 * DA40 flight-control mechanisms (AFM 7.3). The AFM has no routing figure; it says:
 *  - "The ailerons, elevator and wing flaps are operated through control rods, while the rudder is controlled
 *    by cable." Seats are removable "to facilitate the maintenance and inspection of the underlying controls".
 *  - Elevator: steel push rods; two bellcrank bearings next to the lower rudder hinge; the elevator horn and its
 *    push-rod connection at the upper end of the rudder (T-tail).
 *  - Ailerons: steel push rod with a rod-end bearing to an aluminium control horn (3 screws) on each aileron.
 *  - Rudder: steel cables to bolts on the rudder's lower bracket.
 *  - Elevator trim: tab on the elevator moved by a Bowden cable from the black trim wheel in the centre console.
 *  - Flaps: electric actuator; a torsion tube in the fuselage joins the left and right flaps.
 * Positions of the intermediate bellcranks, the flap actuator and the GFC 700 servos are not in the documents
 * and are placed plausibly (servos at the KAP 140 servo arms of AFM 6.5: trim 2.21 m, roll 3.06 m, pitch 3.93 m).
 */
import * as THREE from "three";
import { D2R, V, type Vec3 } from "@/lib/math";
import { ELEV_HINGE_X, FLAP, SY, fs, hingeX, wingP } from "./geometry";

/* ---------- control sticks (one in front of each seat) ---------- */
export const STICK = { x: fs(2.02), y: -0.6, z: 0.28, len: 0.5, pitchMax: 16 * D2R, rollMax: 14 * D2R, arm: 0.085 };
/** Rudder pedals (pilot −0.38/−0.18, co-pilot +0.18/+0.38). Left pedals move aft when the right pedals go forward. */
export const PEDALS = { x: fs(1.52), y: -0.5, z: [-0.38, -0.18, 0.18, 0.38], travel: 0.06 };

/* ---------- elevator chain ---------- */
const E_IDLE: Vec3 = [fs(3.55), -0.58, 0];  // idler bellcrank under the rear seats (inference)
const E_FIN: Vec3 = [fs(7.2), -0.4, 0];     // bellcrank at the fin base, next to the lower rudder hinge (AFM 7.3)
const E_ARM = 0.09;
/** Elevator horn on the hinge line at the top of the rudder; arm points forward-down into the fin. */
export const ELEV_HORN = { c: [ELEV_HINGE_X, SY, 0] as Vec3, dir: [0.6, -0.8], len: 0.12 };

/* ---------- aileron chain ---------- */
const A_FWD: Vec3 = [fs(2.1), -0.68, 0];    // central bellcrank under the stick bases (vertical pivot)
const A_AFT: Vec3 = [fs(3.05), -0.64, 0];   // aft bellcrank, splits to the two wing push rods
const A_ARM = 0.08;
const A_WB = 3.98, A_HORN = 4.04;           // wing bellcrank and aileron horn span stations
const wb = (s: number) => wingP(s * A_WB, 0.56, 0);

/* ---------- rudder ---------- */
export const RUD_HORN = { h: -0.47, half: 0.085 };
const rudPivot = (): Vec3 => [hingeX(RUD_HORN.h), RUD_HORN.h, 0];

/* ---------- trim ---------- */
export const TRIM_WHEEL = { c: [fs(2.18), -0.36, 0.07] as Vec3, r: 0.07 };
/** Elevator trim tab: left inboard elevator trailing edge (side assumed), nose up +12° / nose down −39° (TCDS). */
export const TAB = { z0: -0.15, z1: -0.55, chord: 0.07 };

/* ---------- flaps ---------- */
export const FLAP_TUBE = { x: fs(3.17), y: -0.57, half: 0.52, arm: 0.06 };
export const FLAP_ACT: Vec3 = [fs(3.08), -0.5, 0.14];
const flapHornZ = 1.28;

/* ---------- servos (GFC 700 GSA; positions approximate) ---------- */
export const SERVO = {
  pitch: [fs(3.93), -0.6, 0.1] as Vec3,
  roll: [fs(3.06), -0.6, 0.18] as Vec3,
  trim: [fs(2.21), -0.6, 0.15] as Vec3,
};

/** Surface deflections (deg) from normalised inputs — TCDS limits for the long-range-tank / 1,200 kg airplane. */
export function deflections(pitch: number, roll: number, yaw: number) {
  return {
    /** Elevator TE up (+): up 18°, down 16° (MÄM 40-227 rigging). */
    elev: pitch > 0 ? pitch * 18 : pitch * 16,
    /** Aileron TE up (+), differential: up 20°, down 13°. */
    ailR: roll > 0 ? roll * 20 : roll * 13,
    ailL: roll < 0 ? -roll * 20 : -roll * 13,
    /** Rudder TE right (+): left 24°, right 26° (long-range tank). */
    rud: yaw > 0 ? yaw * 26 : yaw * 24,
  };
}

export interface RigPose { a: number; b: number; pedal: number; elev: number; ailR: number; ailL: number; rud: number; trimRot: number; flapTube: number }

/** Mechanism pose from the effective stick/pedal positions, trim (−1..1) and flap angle (deg). */
export function rigPose(c: { pitch: number; roll: number; yaw: number }, trim: number, flapAng: number): RigPose {
  const d = deflections(c.pitch, c.roll, c.yaw);
  return {
    a: c.pitch * STICK.pitchMax, b: c.roll * STICK.rollMax, pedal: c.yaw * PEDALS.travel,
    elev: d.elev * D2R, ailR: d.ailR * D2R, ailL: d.ailL * D2R, rud: d.rud * D2R,
    trimRot: -trim * 2.6, flapTube: flapAng * 0.8 * D2R,
  };
}

const add = (p: Vec3, x: number, y: number, z: number) => V(p[0] + x, p[1] + y, p[2] + z);

/** End points of every moving rod / link, in airplane coordinates. */
export function linkPoints(p: RigPose) {
  const out: Record<string, [THREE.Vector3, THREE.Vector3]> = {};
  const sa = Math.sin(p.a), ca = Math.cos(p.a), sb = Math.sin(p.b);
  // elevator: lever on the stick torque tube → idler → fin-base bellcrank → vertical rod → elevator horn
  const lev = V(STICK.x + E_ARM * sa, STICK.y - E_ARM * ca, 0);
  const idl = add(E_IDLE, E_ARM * sa, -E_ARM * ca, 0);
  const finIn = add(E_FIN, E_ARM * sa, -E_ARM * ca, 0);
  const finOut = add(E_FIN, -E_ARM * ca, -E_ARM * sa, 0);
  const e = -p.elev, h = ELEV_HORN;
  const hx = h.dir[0] * Math.cos(e) - h.dir[1] * Math.sin(e), hy = h.dir[0] * Math.sin(e) + h.dir[1] * Math.cos(e);
  const horn = V(h.c[0] + hx * h.len, h.c[1] + hy * h.len, 0);
  out.elev1 = [lev, idl];
  out.elev2 = [idl, finIn];
  out.elev3 = [finOut, horn];
  // pitch servo arm → push rod (servo at FS 3.93)
  const ps = SERVO.pitch, tRod = (ps[0] - idl.x) / (finIn.x - idl.x);
  out.pServo = [V(ps[0], ps[1] - 0.05, ps[2] - 0.03), idl.clone().lerp(finIn, tRod)];
  // ailerons: stick lower arms → lateral link → central bellcrank → aft push rod → aft bellcrank → wing rods → wing bellcranks → horns
  // stick lower arm: inner roll (x) then outer pitch (z) rotation of (0, −A_ARM, 0)
  const cb = Math.cos(p.b);
  const armTip = (side: number) => V(STICK.x + A_ARM * cb * sa, STICK.y - A_ARM * cb * ca, side * STICK.z - A_ARM * sb);
  out.ailLat = [armTip(-1), armTip(1)];
  const fwdArm = V(A_FWD[0] + A_ARM * sb, A_FWD[1], A_ARM * Math.cos(p.b));
  const aftIn = V(A_AFT[0] + A_ARM * sb, A_AFT[1], A_ARM * Math.cos(p.b));
  out.ailAft = [fwdArm, aftIn];
  const aftOut = V(A_AFT[0] - A_ARM * Math.cos(p.b), A_AFT[1], A_ARM * sb);
  const rs = SERVO.roll, tA = (rs[0] - fwdArm.x) / (aftIn.x - fwdArm.x);
  out.rServo = [V(rs[0], rs[1] - 0.04, rs[2] - 0.04), fwdArm.clone().lerp(aftIn, tA)];
  [-1, 1].forEach((s) => {
    const k = s > 0 ? "R" : "L", piv = wb(s), dz = A_ARM * sb;
    const psi = -Math.asin(Math.max(-1, Math.min(1, dz / 0.06)));
    const inTip = V(piv.x + 0.06 * Math.cos(psi), piv.y, piv.z - 0.06 * Math.sin(psi));
    const outTip = V(piv.x + s * 0.06 * Math.sin(psi), piv.y, piv.z + s * 0.06 * Math.cos(psi));
    out["ailW" + k] = [aftOut, inTip];
    // horn hangs below the aileron hinge and turns with the surface (TE up = horn tip aft)
    const up = s > 0 ? p.ailR : p.ailL, hz = wingP(s * A_HORN, 0.8, -1);
    out["ailH" + k] = [outTip, V(hz.x - 0.05 * Math.sin(up), hz.y - 0.05 * Math.cos(up), hz.z)];
  });
  // rudder pedal bars (left pedals move aft when the right pedals move forward)
  out.pedBarL = [V(PEDALS.x - p.pedal, -0.62, -0.38), V(PEDALS.x - p.pedal, -0.62, 0.18)];
  out.pedBarR = [V(PEDALS.x + p.pedal, -0.66, -0.18), V(PEDALS.x + p.pedal, -0.66, 0.38)];
  // flaps: torsion-tube arms → push rods → flap horns
  const tt = p.flapTube, ft = FLAP_TUBE;
  [-1, 1].forEach((s) => {
    const arm = V(ft.x + ft.arm * Math.sin(tt), ft.y - ft.arm * Math.cos(tt), s * ft.half);
    const hz = wingP(s * flapHornZ, FLAP.hinge, -1), fa = flapAngOf(p);
    out["flapRod" + (s > 0 ? "R" : "L")] = [arm, V(hz.x + 0.05 * Math.sin(fa), hz.y - 0.05 * Math.cos(fa), hz.z)];
  });
  out.flapAct = [V(FLAP_ACT[0] + 0.12, FLAP_ACT[1], FLAP_ACT[2]), V(ft.x + ft.arm * Math.sin(tt), ft.y - ft.arm * Math.cos(tt), FLAP_ACT[2])];
  return out;
}
const flapAngOf = (p: RigPose) => p.flapTube / 0.8;

/** Rudder horn (lateral bar at the bottom of the rudder) pivot, for the scene group. */
export const rudHornPivot = rudPivot;
/** Fixed bellcrank pivots for the scene. */
export const PIVOTS = { eIdle: E_IDLE, eFin: E_FIN, aFwd: A_FWD, aAft: A_AFT, wbR: () => wb(1), wbL: () => wb(-1) };
export const ARMS = { e: E_ARM, a: A_ARM };

/* ---------- cable and Bowden-cable runs (static paths; particles show motion) ---------- */
export interface CableDef { key: string; name: string; note: string; pts: Vec3[] }
const hp = rudPivot();
export const CABLES: CableDef[] = [
  { key: "rudL", name: "Rudder cable (left)", note: "Steel cable from the left pedals aft under the floor and through the tail boom to the bolt on the rudder's lower bracket (AFM 7.3). Push the left pedal and this cable pulls the rudder left.",
    pts: [[PEDALS.x - 0.04, -0.62, -0.1], [fs(1.7), -0.66, -0.1], [fs(3.0), -0.65, -0.1], [fs(4.4), -0.56, -0.1], [fs(5.6), -0.47, -0.09], [fs(6.9), -0.45, -0.085], [hp[0] + 0.02, hp[1], -RUD_HORN.half]] },
  { key: "rudR", name: "Rudder cable (right)", note: "Steel cable from the right pedals to the other bolt on the rudder's lower bracket. The two cables form a loop through the rudder bracket; the rudder stops are in the lower bearing bracket.",
    pts: [[PEDALS.x - 0.04, -0.66, 0.1], [fs(1.7), -0.66, 0.1], [fs(3.0), -0.65, 0.1], [fs(4.4), -0.56, 0.1], [fs(5.6), -0.47, 0.09], [fs(6.9), -0.45, 0.085], [hp[0] + 0.02, hp[1], RUD_HORN.half]] },
  { key: "trim", name: "Elevator trim Bowden cable", note: "Bowden cable from the trim wheel in the centre console to the trim tab on the elevator (AFM 7.3). The GFC 700 trim servo also drives it, so the wheel turns during autotrim and manual electric trim.",
    pts: [[TRIM_WHEEL.c[0], TRIM_WHEEL.c[1] - 0.07, TRIM_WHEEL.c[2]], [fs(2.24), -0.62, 0.05], [fs(3.4), -0.64, 0.04], [fs(4.6), -0.52, 0.03], [fs(5.9), -0.34, 0.03], [fs(6.9), -0.3, 0.03], [fs(7.1), 0.2, 0.02], [fs(7.45), 0.66, -0.04], [ELEV_HINGE_X + 0.06, SY - 0.01, (TAB.z0 + TAB.z1) / 2]] },
];
