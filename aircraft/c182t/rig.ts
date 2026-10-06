/**
 * C182T flight-control rig (POH Figure 7-1 Sheets 1 and 2, drawings B6398/B6399) built with the shared Cessna rig builder.
 * Stations in inches [FS, BL, h above ground]. From the POH: copilot control wheel FS 26.0 and pedals FS 6.8 (POH 6-22); KAP 140
 * servos (equipment list 22-01-S, POH 6-20): KS 271C roll servo FS 52.0, KS-270C pitch servo FS 158.8, KS-272C pitch trim servo
 * FS 176.4. Pulley positions are scaled from Figure 7-1 (the POH gives none). Surface travel is from TCDS 3A13 Rev 66 (the POH gives
 * none): ailerons up 20° / down 15°, elevator up 28° / down 21°, rudder ±24° (parallel to WL 0), elevator tab up 24° / down 15°.
 *
 * Two 182-specific items the shared builder doesn't draw are added here: the elevator cables end at a bellcrank in the aft tailcone,
 * "just forward of and below the horizontal stabilizer", with a push-pull tube up to the elevator arm and a downspring beside it
 * (Fig 7-1 Sheet 2; downsprings POH 7-6); and the horizontally mounted rudder trim wheel, which biases the rudder bars through a
 * bungee (POH 7-7, Fig 7-1 Sheet 1).
 */
import * as THREE from "three";
import { cessnaRig, type RigSpec, type Travel } from "../cessna/rig";
import { V, type Vec3 } from "@/lib/math";
import { AF, X, Y, Z } from "./geometry";

export const RIG_SPEC: RigSpec = {
  yoke: { fs: 26, bl: 14, h: 56.5, travel: 3.5, colFs: 10.5, crossH: 50 },
  // pulley centres high enough that the lower ("down") strand, 1.6 in below each, keeps ≥ 1.5 in inside the belly skin
  elev: { crank: [16, 0, 25.6], arm: 2.2, pulleys: [[24, 1.5, 25.5], [95, 1.5, 27.5], [165, 1.5, 36]], hornArm: 2.3 },
  ail: { lower: [13, 17.5, 29.5], postFs: 29.6, postBl: 18.6, postLow: 29.5, postHigh: 75.5, root: [32, 19.2, 79.6], crankBl: 106, crankC: 0.66, balanceC: 0.6 },
  rud: { barFs: 3, barH: 29.5, half: 17.5, armBl: 6, pulleys: [[30, 6, 24.2], [140, 5, 32], [215, 2.5, 40.4]], hornArm: 3.2, hornH: 49, pedalTravel: 2.8 },
  // the vertical elevator trim wheel stands ≈ 1 in proud of the pedestal's left face (POH 7-7, Fig 7-2 item 30)
  trim: { wheel: [22, -3.4, 36.5], r: 4.5, pulleys: [[22, -2.5, 24.4], [95, -2.5, 25.6], [165, -2.5, 34.2], [222, -3, 42.6]], actuator: [233, 10, 46.4], tabBl: 16 },
  steer: { fs: -3, h: 30.5, half: 3 },
  // the tail servos sit on the cables above the tailcone floor, near the centreline (the rounded belly is narrow there)
  servo: { roll: [52, 4, 79.2], pitch: [158.8, 2.5, 37.5], trim: [176.4, -2.5, 40.5] },
};
export const TRAVEL: Travel = { ailUp: 20, ailDn: 15, elUp: 28, elDn: 21, rud: 24, tabUp: 24, tabDn: 15 };
export const RIG = cessnaRig(AF, RIG_SPEC, TRAVEL);
export const { P: PULLEYS, C: CABLES } = RIG;

/* ---------- aft elevator bellcrank, push-pull tube and downspring ---------- */
const IN = 0.0254;
/** Aft elevator bellcrank pivot (in the tailcone just forward of and below the stabilizer), arm length, push-rod arm. */
export const AFT_CRANK = { c: [X(229), Y(43.5), 0] as Vec3, arm: 2.4 * IN, rod: 3.4 * IN };
// the up / down cables end at the aft bellcrank's upper / lower arms instead of the elevator horn (Fig 7-1 Sheet 2)
(["elUp", "elDn"] as const).forEach((k) => {
  const c = RIG.cable(k), up = k === "elUp" ? 1 : -1;
  c.pts[c.pts.length - 1] = [AFT_CRANK.c[0] + 0.02, AFT_CRANK.c[1] + up * AFT_CRANK.arm, 0.03 * up];
  c.note = up > 0
    ? "From the forward elevator bellcrank under the floor, over the pulleys under the cabin and through the tailcone, to the upper arm of the elevator bellcrank in the aft tailcone. Pulling the wheel aft tensions it: trailing edge up (POH Fig. 7-1 Sheet 2)."
    : "The other half of the elevator loop, to the lower arm of the aft elevator bellcrank. The KAP 140 KS-270C pitch servo (FS 158.8) clamps onto this cable run.";
});
// the shared notes name the GFC 700; this airplane has the KAP 140 servos on the same cables
RIG.cable("ailBal").note = "Joins the two aileron bellcranks across the cabin top so one aileron goes up as the other goes down. The KAP 140 KS 271C roll servo (FS 52.0) drives the aileron system here.";
RIG.cable("trim").note = "Trim wheel → under the floor → aft through the tailcone → trim tab actuator in the horizontal stabilizer. The KAP 140 KS-272C pitch trim servo (FS 176.4) drives the same cable, so the wheel turns under autotrim and manual electric trim (Supplement 3).";

/** Aft bellcrank rotation (rad) for the effective pitch input; the push rod pushes the elevator horn below the hinge. */
export const aftCrankAngle = (pitch: number) => -pitch * 0.42;

const rot = (p: THREE.Vector3, piv: THREE.Vector3, axis: THREE.Vector3, a: number) => p.clone().sub(piv).applyAxisAngle(axis, a).add(piv);
/** Elevator push-pull tube from the aft bellcrank's upper rod arm to the elevator arm under the hinge; downspring to the tailcone floor. */
export function aftLinks(pitch: number, elevAngle: number, elevPivot: Vec3, elevAxis: Vec3) {
  const c = V(...AFT_CRANK.c), a = aftCrankAngle(pitch);
  const armTip = rot(V(c.x, c.y + AFT_CRANK.rod, 0.035), c, V(0, 0, 1), a);
  const hinge = AF.sLE(0) - 0.58 * AF.sC(0);
  const hornBase = rot(V(hinge + 0.02, AF.SY - 0.07, 0.035), V(...elevPivot), V(...elevAxis), elevAngle);
  const springTop = rot(V(c.x - 0.06, c.y - 0.03, -0.035), c, V(0, 0, 1), a);
  return {
    elevPush: [armTip, hornBase] as [THREE.Vector3, THREE.Vector3],
    downspring: [springTop, V(X(205), Y(38.6), -0.035)] as [THREE.Vector3, THREE.Vector3],
  };
}

/* ---------- rudder trim: horizontal wheel on the pedestal, shaft down to the rudder-bar bungee ---------- */
/** Horizontal rudder trim wheel low on the pedestal, its rim through the aft face (Fig 7-2 item 25); the shaft runs down from it. */
export const RUD_TRIM = { wheel: [X(25.6), Y(28.8), Z(0)] as Vec3, r: 2.6 * IN, bias: 0.22, shaftTop: 28.8, shaftBot: 25.5 };
/** Rudder trim bungee: from the base of the trim shaft to the rudder bar arm (moves with the pedals and the trim setting). */
export function rudTrimLinks(pedal: number, rudTrim: number) {
  const base = V(RUD_TRIM.wheel[0], Y(RUD_TRIM.shaftBot), RUD_TRIM.wheel[2] + rudTrim * 0.02);
  const bar = V(X(RIG_SPEC.rud.barFs) + 0.03 - pedal * 0.5, Y(RIG_SPEC.rud.barH) - 0.01, Z(RIG_SPEC.rud.armBl) * 0.4);
  return { rudTrimBungee: [base, bar] as [THREE.Vector3, THREE.Vector3] };
}
