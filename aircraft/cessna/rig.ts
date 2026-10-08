/**
 * Cessna single-engine flight-control rig after POH Figure 7-1 (same drawing family in the 172S and 182T
 * NAV III handbooks): two control wheels on columns through the panel, a column interconnect, an elevator
 * bellcrank under the forward floor with an up/down cable pair to the elevator bellcrank (torque tube) in
 * the tailcone, aileron "direct" cables down to the lower forward cabin, up the forward door posts and out
 * each wing to a bellcrank that drives the aileron through a push-pull rod, with a balance cable across the
 * cabin top; rudder cables from the rudder bars to the rudder horn; elevator trim wheel → cable → actuator
 * in the stabilizer → push-pull rod → tab. Exact pulley stations are not in the POH: positions are scaled
 * from Figure 7-1 and the equipment-list arms (servos, pedals, control wheels). The autopilot (GFC 700 or KAP 140)
 * is only named in the notes, through `servo.names`.
 *
 * All stations are inches (FS aft of datum, BL right, h above ground) and converted with the airframe.
 */
import * as THREE from "three";
import type { Axis } from "@/lib/geometry";
import { D2R, V, type Vec3 } from "@/lib/math";
import { trailingEdgeTab } from "@/lib/trimTab";
import { IN, type CessnaAirframe } from "./airframe";

export { pulleyGeo } from "@/lib/geometry";

type Pt = [number, number, number]; // [FS, BL, h]

export interface RigSpec {
  /** Control wheel hub (neutral) and its fore/aft travel for full pitch (in); column tube front end FS. */
  yoke: { fs: number; bl: number; h: number; travel: number; colFs: number; crossH: number };
  /**
   * Elevator bellcrank under the forward floor (pivot), arm length; up/down cable pulley stations; elevator horn arm. `aftCrank`:
   * the cables end at a bellcrank in the aft tailcone (FS, h, arm) that drives the elevator through a push-pull tube (182)
   * instead of at the elevator horn.
   */
  elev: { crank: Pt; arm: number; pulleys: Pt[]; hornArm: number; aftCrank?: { fs: number; h: number; arm: number } };
  /** Aileron: lower forward cabin pulley, door-post bottom/top, wing root pulley; wing bellcrank BL; balance cable FS. */
  ail: {
    lower: Pt;
    postFs: number;
    postBl: number;
    postLow: number;
    postHigh: number;
    root: Pt;
    crankBl: number;
    crankC: number;
    balanceC: number;
  };
  /** Rudder bar (FS, h, half width) and arm BL; cable pulley stations; horn arm. */
  rud: {
    barFs: number;
    barH: number;
    half: number;
    armBl: number;
    pulleys: Pt[];
    hornArm: number;
    hornH: number;
    pedalTravel: number;
  };
  /** Trim wheel (pedestal), its radius; cable pulley stations; actuator and tab horn station (inches).
   * `tabChord` and `tabSpan` are the illustrative tab dimensions in scene metres. */
  trim: { wheel: Pt; r: number; pulleys: Pt[]; actuator: Pt; tabBl: number; tabChord: number; tabSpan: number };
  /** Nose-gear steering arm (FS, h) for the steering bungees. */
  steer: { fs: number; h: number; half: number };
  /** Autopilot servo stations, and their names for the cable notes (e.g. "GFC 700 roll servo (FS 59.5)"). */
  servo: { roll: Pt; pitch: Pt; trim: Pt; names: { roll: string; pitch: string; trim: string } };
}

/** Surface travel (deg). */
export interface Travel {
  ailUp: number;
  ailDn: number;
  elUp: number;
  elDn: number;
  rud: number;
  tabUp: number;
  tabDn: number;
}

export interface PulleyDef {
  c: Vec3;
  r: number;
  axis: Axis;
  double?: boolean;
  gap?: number;
  name: string;
  note: string;
  chan: "elevator" | "aileron" | "rudder" | "trim";
}
export interface CableDef {
  key: string;
  name: string;
  note: string;
  pts: Vec3[];
  chan: "elevator" | "aileron" | "rudder" | "trim";
}

/** Control positions −1…1 (pitch + = pull / nose up, roll + = right, yaw + = right pedal), trim −1 (ND)…1 (NU). */
export interface CtlIn {
  pitch: number;
  roll: number;
  yaw: number;
  trim: number;
}

export function cessnaRig(af: CessnaAirframe, R: RigSpec, T: Travel) {
  const { X, Y, Z, wingP } = af;
  const p3 = ([fs, bl, h]: Pt): Vec3 => [X(fs), Y(h), Z(bl)];
  const SV = R.servo.names;
  const wp = (bl: number, c: number): Vec3 => {
    const v = wingP(Z(bl), c, 0);
    return [v.x, v.y, v.z];
  };
  // Span/chord are illustrative; using one definition keeps the skin cutout, hinge, horn and rod aligned.
  const trimTab = trailingEdgeTab({
    z0: Z(R.trim.tabBl) - R.trim.tabSpan / 2,
    z1: Z(R.trim.tabBl) + R.trim.tabSpan / 2,
    chord: R.trim.tabChord,
    y: af.SY,
    leadingEdge: af.sLE,
    sectionChord: af.sC,
    section: af.stabSec,
  });

  /* ---------- surface angles (radians, in the sign convention of the hinge axes) ---------- */
  const deg = (v: number, pos: number, neg: number) => (v >= 0 ? v * pos : v * neg);
  function surfaceAngles(c: CtlIn, flapDeg: number) {
    // right roll: right aileron up (T.ailUp), left aileron down (T.ailDn) — Frise differential
    const ailR = -deg(c.roll, T.ailUp, T.ailDn) * D2R,
      ailL = -deg(c.roll, T.ailDn, T.ailUp) * D2R;
    const el = deg(c.pitch, T.elUp, T.elDn) * D2R;
    // trim nose-up → tab trailing edge down (forward wheel rotation = nose down, POH 7-7)
    const tab = deg(c.trim, T.tabDn, T.tabUp) * D2R;
    return {
      ailR,
      ailL,
      elevR: -el,
      elevL: el,
      rudder: c.yaw * T.rud * D2R,
      flapR: flapDeg * D2R,
      flapL: -flapDeg * D2R,
      tab,
    };
  }

  /* ---------- pulleys ---------- */
  const P: Record<string, PulleyDef> = {};
  const E = R.elev,
    A = R.ail,
    U = R.rud,
    TR = R.trim;
  E.pulleys.forEach(
    (q, i) =>
      (P["e" + i] = {
        c: p3(q),
        r: 1.6 * IN,
        axis: "z",
        double: true,
        gap: 0.03,
        chan: "elevator",
        name: i === 0 ? "Elevator cable pulleys (forward)" : "Elevator cable pulleys",
        note: "Double pulley carrying the elevator up and down cables aft under the floor and through the tailcone (POH Fig. 7-1).",
      }),
  );
  [-1, 1].forEach((s) => {
    const sd = s > 0 ? "R" : "L";
    P["al" + sd] = {
      c: p3([A.lower[0], s * A.lower[1], A.lower[2]]),
      r: 1.4 * IN,
      axis: "x",
      chan: "aileron",
      name: "Aileron cable pulley (lower forward cabin)",
      note: "Turns the direct cable from the control column outboard toward the forward door post.",
    };
    P["ap" + sd] = {
      c: p3([A.postFs, s * A.postBl, A.postLow]),
      r: 1.4 * IN,
      axis: "x",
      chan: "aileron",
      name: "Aileron door-post pulley",
      note: "At the base of the forward door post the aileron cable turns up toward the wing root (POH Fig. 7-1).",
    };
    P["at" + sd] = {
      c: p3([A.postFs, s * A.postBl, A.postHigh]),
      r: 1.4 * IN,
      axis: "x",
      chan: "aileron",
      name: "Aileron door-post pulley",
      note: "Top of the door post: the cable turns into the wing root.",
    };
    P["aw" + sd] = {
      c: wp(s * A.crankBl, A.crankC),
      r: 2.6 * IN,
      axis: "y",
      chan: "aileron",
      name: "Aileron bellcrank",
      note: "In the wing at the inboard end of the aileron: the direct and balance cables turn it, and a push-pull rod drives the aileron.",
    };
    P["ru" + sd] = {
      c: p3([U.pulleys[1][0], s * U.pulleys[1][1], U.pulleys[1][2]]),
      r: 1.3 * IN,
      axis: "x",
      chan: "rudder",
      name: "Rudder cable pulley",
      note: "Rudder cables run aft along the lower fuselage through fairleads and pulleys to the rudder horn (POH Fig. 7-1).",
    };
  });
  TR.pulleys.forEach(
    (q, i) =>
      (P["t" + i] = {
        c: p3(q),
        r: 1.3 * IN,
        axis: "z",
        chan: "trim",
        name: "Elevator trim cable pulley",
        note: "Carries the trim cable from the pedestal wheel aft to the actuator in the stabilizer.",
      }),
  );

  /* ---------- cables ---------- */
  const C: CableDef[] = [];
  const hinge = af.sLE(0) - 0.6 * af.sC(0); // elevator hinge x at the centreline
  const AC = E.aftCrank;
  // cable ends: the elevator horn, or the upper / lower arm of the aft bellcrank
  const end = (up: number): Vec3 =>
    AC
      ? [X(AC.fs) + 0.02, Y(AC.h) + up * AC.arm * IN, 0.03 * up]
      : [hinge + 0.02, af.SY + up * E.hornArm * IN, 0.02 * up];
  const crank = p3(E.crank),
    crankArm = E.arm * IN;
  const eLine = (up: number): Vec3[] => [
    [crank[0], crank[1] + up * crankArm, 0.03 * up],
    ...E.pulleys.map((q) => {
      const c = p3(q);
      return [c[0], c[1] + up * 1.6 * IN, 0.03 * up] as Vec3;
    }),
    end(up),
  ];
  const aftEnd = AC
    ? "elevator bellcrank in the aft tailcone, just forward of and below the stabilizer (POH Fig. 7-1 Sheet 2)"
    : "elevator bellcrank in the tailcone";
  C.push({
    key: "elUp",
    chan: "elevator",
    name: "Elevator cable (up)",
    note: `From the forward elevator bellcrank under the floor, over the pulleys and through the tailcone, to the upper arm of the ${aftEnd}. Pulling the wheel aft tensions it: trailing edge up.`,
    pts: eLine(1),
  });
  C.push({
    key: "elDn",
    chan: "elevator",
    name: "Elevator cable (down)",
    note: `The other half of the elevator loop, to the lower arm of the ${aftEnd}. The ${SV.pitch} clamps onto the elevator cables.`,
    pts: eLine(-1),
  });
  [-1, 1].forEach((s) => {
    const sd = s > 0 ? "R" : "L",
      aw = P["aw" + sd].c;
    const col: Vec3 = p3([R.yoke.colFs + 2, s * R.yoke.bl, R.yoke.h - 2]);
    C.push({
      key: "ail" + sd,
      chan: "aileron",
      name: `Aileron direct cable (${s > 0 ? "right" : "left"})`,
      note: "From the control column down to the lower forward cabin, up the forward door post and out the wing to the aileron bellcrank (POH Fig. 7-1).",
      pts: [
        col,
        P["al" + sd].c,
        P["ap" + sd].c,
        P["at" + sd].c,
        p3([A.root[0], s * A.root[1], A.root[2]]),
        wp(s * 40, 0.45),
        wp(s * 80, 0.5),
        [aw[0] + 0.06, aw[1], aw[2]],
      ],
    });
  });
  const bal = (s: number, bl: number) => wp(s * bl, A.balanceC);
  C.push({
    key: "ailBal",
    chan: "aileron",
    name: "Aileron balance cable",
    note: `Joins the two aileron bellcranks across the cabin top so one aileron goes up as the other goes down. The ${SV.roll} drives the aileron system.`,
    pts: [
      [P.awL.c[0] - 0.06, P.awL.c[1], P.awL.c[2]],
      bal(-1, 80),
      bal(-1, 30),
      [X(R.servo.roll[0]), Y(R.servo.roll[2]) + 0.03, Z(R.servo.roll[1])],
      bal(1, 30),
      bal(1, 80),
      [P.awR.c[0] - 0.06, P.awR.c[1], P.awR.c[2]],
    ],
  });
  const rHorn = (s: number): Vec3 => [af.hingeX(Y(U.hornH)) + 0.02, Y(U.hornH), s * U.hornArm * IN];
  [-1, 1].forEach((s) => {
    const sd = s > 0 ? "R" : "L";
    C.push({
      key: "rud" + sd,
      chan: "rudder",
      name: "Rudder cable",
      note: "From the rudder bar aft along the lower fuselage to the rudder horn at the bottom of the rudder (POH Fig. 7-1).",
      pts: [
        p3([U.barFs, s * U.armBl, U.barH - 2.5]),
        p3([U.pulleys[0][0], s * U.pulleys[0][1], U.pulleys[0][2]]),
        P["ru" + sd].c,
        p3([U.pulleys[2][0], s * U.pulleys[2][1], U.pulleys[2][2]]),
        rHorn(s),
      ],
    });
  });
  const wheel = p3(TR.wheel);
  C.push({
    key: "trim",
    chan: "trim",
    name: "Elevator trim cable",
    note: `Trim wheel → under the floor → aft through the tailcone → trim actuator in the horizontal stabilizer. The ${SV.trim} drives the same cable, so the wheel turns under autotrim and manual electric trim.`,
    pts: [
      [wheel[0], wheel[1] - TR.r * IN, wheel[2]],
      ...TR.pulleys.map(p3),
      [X(R.servo.trim[0]), Y(R.servo.trim[2]) + 0.03, Z(R.servo.trim[1])],
      p3(TR.actuator),
    ],
  });

  /* ---------- kinematics ---------- */
  const rot = (p: THREE.Vector3, piv: THREE.Vector3, axis: THREE.Vector3, a: number) =>
    p.clone().sub(piv).applyAxisAngle(axis, a).add(piv);
  function pose(c: CtlIn) {
    const sa = surfaceAngles(c, 0);
    const crankAng = c.pitch * 0.45; // bellcrank rotation for full pitch (rad)
    const ailCrank = -c.roll * 0.42; // wing bellcrank rotation (rad, about y)
    const eT = crankAng * crankArm,
      aT = ailCrank * 2.6 * IN,
      rT = c.yaw * U.pedalTravel * IN,
      tT = c.trim * 0.06;
    const pul: Record<string, number> = {};
    for (const k of Object.keys(P)) {
      const d = P[k],
        travel = d.chan === "elevator" ? eT : d.chan === "aileron" ? aT : d.chan === "rudder" ? rT : tT;
      pul[k] = k.startsWith("aw") ? (k === "awR" ? ailCrank : -ailCrank) : (travel / d.r) * (k.endsWith("L") ? -1 : 1);
    }
    return {
      yokeX: -c.pitch * R.yoke.travel * IN,
      wheel: c.roll * 0.75,
      crank: crankAng,
      pedal: c.yaw * U.pedalTravel * IN,
      trimWheel: c.trim * Math.PI * 3,
      sa,
      pulley: pul,
    };
  }
  type Pose = ReturnType<typeof pose>;

  /** Moving rods: elevator link, aileron push-pull rods, trim tab rod, steering bungees. */
  function links(
    c: CtlIn,
    p: Pose,
    steerDeg: number,
    pivots: { ailR: Vec3; ailL: Vec3; axR: Vec3; axL: Vec3; elevR: Vec3; axE: Vec3 },
  ) {
    const out: Record<string, [THREE.Vector3, THREE.Vector3]> = {};
    const cross = V(X(R.yoke.colFs) + p.yokeX, Y(R.yoke.crossH), 0);
    const cr = V(...crank);
    const tip = V(cr.x + Math.sin(p.crank) * crankArm * 1.6, cr.y + Math.cos(p.crank) * crankArm * 1.6, 0);
    out.elevLink = [cross, tip];
    [-1, 1].forEach((s) => {
      const sd = s > 0 ? "R" : "L",
        aw = V(...P["aw" + sd].c);
      const arm = rot(V(aw.x - 0.07, aw.y - 0.012, aw.z), aw, V(0, 1, 0), s > 0 ? p.pulley.awR : p.pulley.awL);
      const piv = V(...(s > 0 ? pivots.ailR : pivots.ailL)),
        ax = V(...(s > 0 ? pivots.axR : pivots.axL));
      const hornBase = V(aw.x - 0.16, aw.y - 0.035, aw.z);
      out["ailRod" + sd] = [arm, rot(hornBase, piv, ax, s > 0 ? p.sa.ailR : p.sa.ailL)];
    });
    // trim tab rod: actuator → horn on the tab (rides on the right elevator, then the tab hinge)
    const act = V(...p3(TR.actuator)),
      ep = V(...pivots.elevR),
      eax = V(...pivots.axE);
    const tabHorn = trimTab.point(V(-0.02, 0.045, 0), p.sa.tab);
    out.tabRod = [V(act.x - 0.06 - c.trim * 0.012, act.y + 0.01, act.z), rot(tabHorn, ep, eax, p.sa.elevR)];
    // steering bungees: rudder bar arms → nose gear steering arm (turns with the nosewheel)
    const sr = steerDeg * D2R;
    [-1, 1].forEach((s) => {
      const bar = V(X(U.barFs) + 0.03 - s * p.pedal * 0.5, Y(U.barH), Z(s * U.armBl));
      const st = V(X(R.steer.fs), Y(R.steer.h), 0),
        arm = V(st.x - 0.05, st.y, Z(s * R.steer.half));
      out["bungee" + (s > 0 ? "R" : "L")] = [bar, rot(arm, st, V(0, 1, 0), -sr)];
    });
    return out;
  }

  return { P, C, pose, links, surfaceAngles, trimTab, p3, cable: (k: string) => C.find((c) => c.key === k)! };
}
