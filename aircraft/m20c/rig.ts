/**
 * M20C flight-control mechanisms. The Owner's Manual (p. 8): "Push-pull tubes with self-aligning rod end bearings
 * actuate these control surfaces. The ailerons have a differential linkage (up travel greater than down travel)".
 * Trim (p. 9): "A small control wheel on the floor between the front seats actuates the adjustable stabilizer via a
 * gear reduction and torque tube linkage which actuates the empennage jack screw … The trim system also changes the
 * setting of the trim bungees connected to the elevator horns". PC (p. 8): pneumatic servos on the aileron and rudder
 * systems. The manual has no routing figure: the bellcrank positions below follow the Mooney service manual's general
 * arrangement (wheel shafts to a torque tube under the panel, elevator tube aft under the floor and through the tail
 * cone, aileron tubes spanwise behind the main spar, rudder tube down the right side) and are approximate.
 */
import * as THREE from "three";
import { D2R, V, clamp, lerp, type Vec3 } from "@/lib/math";
import { AIL, ELEV_HINGE_X, FIN_TOP, PANEL_X, RUD_BOT, SY, TAIL_PIVOT, hingeX, wingP } from "./geometry";
export { ELEV_HINGE_X } from "./geometry";

/* ---------- control wheels (dual) ---------- */
/** Wheel hub just aft of the panel, shaft running forward through it. */
export const WHEEL = {
  x: PANEL_X - 0.2,
  y: -0.03,
  z: 0.31,
  r: 0.13,
  shaft: 0.34,
  pitchTravel: 0.09,
  rollMax: 70 * D2R,
};
/** Rudder pedals (pilot's pair; the co-pilot's are removable). */
export const PEDALS = { x: 1.78, y: -0.46, z: [-0.42, -0.2, 0.2, 0.42], travel: 0.06 };

/* ---------- elevator chain ---------- */
/** Torque tube under the panel joining both wheel shafts; its lever drives the push-pull tube aft. */
export const E_TT: Vec3 = [1.62, -0.42, 0];
const E_IDLE: Vec3 = [-0.45, -0.64, 0]; // idler under the rear seat / baggage floor
export const E_TAIL: Vec3 = [-2.4, -0.33, 0]; // bellcrank at the tail-cone bulkhead, ahead of the empennage pivot
const E_ARM = 0.09;
/** Elevator horn at the hinge line (root), reaching down into the tail cone. */
export const ELEV_HORN = { c: [ELEV_HINGE_X, SY, 0] as Vec3, len: 0.11 };

/* ---------- aileron chain ---------- */
const A_FWD: Vec3 = [1.4, -0.6, 0]; // bellcrank under the floor below the wheels (vertical pivot)
const A_CTR: Vec3 = [0.88, -0.62, 0]; // centre bellcrank at the main spar carry-through, splits to the wing tubes
const A_ARM = 0.08;
const A_WB = AIL.z0 + 0.1,
  A_HORN = AIL.z0 + 0.16;
const wb = (s: number) => wingP(s * A_WB, 0.6, 0);

/* ---------- rudder chain ---------- */
const R_FWD: Vec3 = [1.62, -0.6, 0.12]; // pedal torque-tube lever
export const R_TAIL: Vec3 = [-2.5, -0.38, 0.0];
export const RUD_HORN = { h: -0.15, len: 0.1 };
const rudPivot = (): Vec3 => [hingeX(RUD_HORN.h), RUD_HORN.h, 0];
/** Nose-wheel steering rods from the pedal lever forward to the strut. */
export const NOSE_STEER: Vec3 = [2.28, -0.48, 0];

/* ---------- trim ---------- */
export const TRIM_WHEEL = { c: [0.85, -0.56, 0.0] as Vec3, r: 0.075 };
/** Jack screw bolted to the tail-cone bulkhead, driving the empennage up and down about its pivot. */
export const JACK: Vec3 = [-2.48, -0.5, 0];
/** Stabilizer travel about the pivot (TCDS 2A3, s/n to 690001): leading edge up 1–2½° (nose down), down ≈ 4½° (nose up). */
export const tailAngle = (trim: number) => (trim > 0 ? -trim * 4.5 : -trim * 2.0) * D2R;

/* ---------- PC servos (Brittain vacuum bellows on the push-pull tubes) ---------- */
/** Brittain BI-706 servo cans: one in the outer third of each wing on the aileron linkage, two in the tail cone on the rudder linkage. */
export const SERVO = {
  roll: [wingP(-3.4, 0.62, 0).x, wingP(-3.4, 0.62, 0).y - 0.02, -3.4] as Vec3,
  yaw: [-1.9, -0.42, 0.0] as Vec3,
};

/* ---------- gear ---------- */
/** Johnson bar pivot on the floor between the seats: handle up and forward in the down-lock socket under the panel; swung down and aft to the floor socket. */
export const JBAR = { pivot: [1.25, -0.66, 0.0] as Vec3, len: 0.62, downAng: 15 * D2R, upAng: 90 * D2R };
export const johnsonAngle = (fraction: number) => lerp(-JBAR.downAng, JBAR.upAng, clamp(fraction, 0, 1));
export const johnsonTip = (fraction: number) =>
  V(0, JBAR.len, 0)
    .applyAxisAngle(V(0, 0, 1), johnsonAngle(fraction))
    .add(V(...JBAR.pivot));
/** Flap pump handle: pivoted under the panel, lying aft at about seat-cushion height just right of the Johnson bar (which lies on the floor with the gear up); pumped up and down. */
export const FLAP_PUMP = { pivot: [1.5, -0.44, 0.075] as Vec3, len: 0.46 };

/** Surface deflections (deg) from normalised inputs — TCDS 2A3 (M20C to s/n 690001): ailerons up 12½–17° / down 8°, elevator up 24° / down 10½°, rudder 23–24° each way. */
export function deflections(pitch: number, roll: number, yaw: number) {
  return {
    elev: pitch > 0 ? pitch * 24 : pitch * 10.5,
    ailR: roll > 0 ? roll * 15 : roll * 8,
    ailL: roll < 0 ? -roll * 15 : -roll * 8,
    rud: yaw * 23.5,
  };
}

export interface RigPose {
  a: number;
  b: number;
  pedal: number;
  elev: number;
  ailR: number;
  ailL: number;
  rud: number;
  tail: number;
}

/** Mechanism pose from the effective wheel / pedal positions and the trim setting. */
export function rigPose(c: { pitch: number; roll: number; yaw: number }, trim: number): RigPose {
  const d = deflections(c.pitch, c.roll, c.yaw);
  return {
    a: -c.pitch * WHEEL.pitchTravel,
    b: c.roll * WHEEL.rollMax,
    pedal: c.yaw * PEDALS.travel,
    elev: d.elev * D2R,
    ailR: d.ailR * D2R,
    ailL: d.ailL * D2R,
    rud: d.rud * D2R,
    tail: tailAngle(trim),
  };
}

const add = (p: Vec3, x: number, y: number, z: number) => V(p[0] + x, p[1] + y, p[2] + z);
export const pitchCrankAngle = (p: RigPose) => (p.a / WHEEL.pitchTravel) * 0.5;
const rotate = (point: THREE.Vector3, pivot: THREE.Vector3, axis: THREE.Vector3, angle: number) =>
  point.clone().sub(pivot).applyAxisAngle(axis, angle).add(pivot);
/** A point in tail-group coordinates turned about the empennage pivot into airplane coordinates. */
export function tailPoint(p: Vec3, tail: number) {
  const dx = p[0] - TAIL_PIVOT[0],
    dy = p[1] - TAIL_PIVOT[1],
    c = Math.cos(tail),
    s = Math.sin(tail);
  return V(TAIL_PIVOT[0] + dx * c - dy * s, TAIL_PIVOT[1] + dx * s + dy * c, p[2]);
}

/** End points of every moving rod / link, in airplane coordinates. */
export function linkPoints(p: RigPose) {
  const out: Record<string, [THREE.Vector3, THREE.Vector3]> = {};
  // elevator: both wheel shafts slide fore-aft (a) → torque-tube lever → long tube under the floor → idler → tail bellcrank → horn
  const crank = pitchCrankAngle(p);
  const arm = (center: Vec3, x: number, y: number) =>
    add(center, x * Math.cos(crank) - y * Math.sin(crank), x * Math.sin(crank) + y * Math.cos(crank), 0);
  const lev = arm(E_TT, 0, -E_ARM);
  const idl = arm(E_IDLE, 0, -E_ARM);
  const tIn = arm(E_TAIL, 0, -E_ARM);
  const tOut = arm(E_TAIL, -E_ARM * 0.6, -E_ARM * 0.3);
  const e = -p.elev,
    h = ELEV_HORN;
  const horn = tailPoint([h.c[0] + h.len * Math.sin(e), h.c[1] - h.len * Math.cos(e), 0], p.tail);
  out.elev1 = [lev, idl];
  out.elev2 = [idl, tIn];
  out.elev3 = [tOut, horn];
  (["L", "R"] as const).forEach((sd) => {
    const z = sd === "L" ? -WHEEL.z : WHEEL.z;
    out["shaft" + sd] = [V(WHEEL.x + p.a, WHEEL.y, z), V(WHEEL.x + WHEEL.shaft + p.a, WHEEL.y, z)];
  });
  // ailerons: wheel rotation (b) → drop link → forward bellcrank → fore-aft tube → centre bellcrank → wing tubes → wing bellcranks → horns
  const sb = Math.sin(p.b * 0.35),
    cb = Math.cos(p.b * 0.35);
  out.ailDrop = [
    V(WHEEL.x + 0.12, WHEEL.y - 0.06, -WHEEL.z + 0.08 * Math.sin(p.b)),
    V(A_FWD[0], A_FWD[1], A_FWD[2] - A_ARM * cb - 0.02),
  ];
  const fwdArm = V(A_FWD[0] + A_ARM * sb, A_FWD[1], A_FWD[2] - A_ARM * cb);
  const ctrIn = V(A_CTR[0] + A_ARM * sb, A_CTR[1], A_CTR[2] - A_ARM * cb);
  out.ailAft = [fwdArm, ctrIn];
  [-1, 1].forEach((s) => {
    const key = s > 0 ? "R" : "L";
    const ctrOut = V(A_CTR[0] - s * A_ARM * cb * 0.6, A_CTR[1], A_CTR[2] + s * A_ARM * sb);
    const piv = wb(s),
      dz = A_ARM * sb;
    const psi = -Math.asin(Math.max(-1, Math.min(1, dz / 0.06)));
    const inTip = V(piv.x + 0.06 * Math.cos(psi), piv.y, piv.z - 0.06 * Math.sin(psi));
    const outTip = V(piv.x + s * 0.06 * Math.sin(psi), piv.y, piv.z + s * 0.06 * Math.cos(psi));
    out["ailW" + key] = [ctrOut, inTip];
    const up = s > 0 ? p.ailR : p.ailL,
      hz = wingP(s * A_HORN, AIL.hinge, -1);
    const pivot = wingP(s * AIL.z0, AIL.hinge, 0);
    const axis = wingP(s * AIL.z1, AIL.hinge, 0)
      .sub(pivot)
      .normalize();
    out["ailH" + key] = [outTip, rotate(hz.clone().add(V(0, -0.05, 0)), pivot, axis, s > 0 ? -up : up)];
  });
  // PC roll servo pushes on the left wing tube
  out.pcRoll = [V(SERVO.roll[0] - 0.05, SERVO.roll[1], SERVO.roll[2]), out.ailWL[0].clone().lerp(out.ailWL[1], 0.92)];
  // rudder: pedals → lever → tube aft down the right side → tail bellcrank → horn; nose-wheel steering rods forward
  const [zLo, zLi, zRi, zRo] = PEDALS.z;
  out.pedBarL = [V(PEDALS.x - p.pedal, -0.52, zLo), V(PEDALS.x - p.pedal, -0.52, zRi)];
  out.pedBarR = [V(PEDALS.x + p.pedal, -0.535, zLi), V(PEDALS.x + p.pedal, -0.535, zRo)];
  const rLev = V(R_FWD[0] - p.pedal, R_FWD[1], R_FWD[2]);
  const rIn = V(R_TAIL[0] - p.pedal, R_TAIL[1], R_TAIL[2] + 0.12);
  out.rud1 = [rLev, rIn];
  const rOut = V(R_TAIL[0] - 0.02, R_TAIL[1] - 0.02, R_TAIL[2] + RUD_HORN.len * Math.sin(p.rud) * 0.3 - p.pedal * 0.5);
  const rh = rudPivot();
  const rudOrigin = V(hingeX(RUD_BOT), RUD_BOT, 0);
  const rudAxis = V(hingeX(FIN_TOP), FIN_TOP, 0).sub(rudOrigin).normalize();
  const rudEnd = rotate(V(rh[0] - RUD_HORN.len, rh[1] - 0.03, 0), rudOrigin, rudAxis, p.rud);
  const hornR = tailPoint([rudEnd.x, rudEnd.y, rudEnd.z], p.tail);
  out.rud2 = [rOut, hornR];
  out.steer = [
    V(R_FWD[0] - p.pedal, R_FWD[1] - 0.02, R_FWD[2] + 0.1),
    V(NOSE_STEER[0], NOSE_STEER[1], NOSE_STEER[2] + 0.1 + p.pedal * 0.6),
  ];
  // PC yaw servo on the rudder tube
  out.pcYaw = [V(SERVO.yaw[0], SERVO.yaw[1] - 0.05, SERVO.yaw[2] + 0.1), rLev.clone().lerp(rIn, 0.86)];
  // trim: wheel → torque tube aft along the floor → jack screw at the tail-cone bulkhead → stabilizer front spar
  out.trimTube = [V(TRIM_WHEEL.c[0] - 0.08, -0.66, 0.0), V(JACK[0] + 0.05, JACK[1], 0)];
  out.jack = [V(JACK[0], JACK[1], 0), tailPoint([-2.62, -0.2, 0], p.tail)];
  return out;
}

export const rudHornPivot = rudPivot;
export const PIVOTS = {
  eIdle: E_IDLE,
  eTail: E_TAIL,
  aFwd: A_FWD,
  aCtr: A_CTR,
  wbR: () => wb(1),
  wbL: () => wb(-1),
  rFwd: R_FWD,
};
export const ARMS = { e: E_ARM, a: A_ARM };
