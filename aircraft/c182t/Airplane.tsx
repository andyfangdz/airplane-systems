"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { ControlSurfaces } from "@/components/scene/ControlSurface";
import { Flows } from "@/components/scene/Flows";
import { LightFX, type BeamSpec, type GlowSpec } from "@/components/scene/LightFX";
import { Links, type LinkSpec } from "@/components/scene/Links";
import { Parts, Shells } from "@/components/scene/Part";
import { Screens, type ScreenSpec } from "@/components/scene/Screens";
import { Tanks, type TankSpec } from "@/components/scene/Tanks";
import { WindowOutlines } from "@/components/scene/WindowOutlines";
import { D2R, clamp, type Vec3 } from "@/lib/math";
import { narrowLayout, useView } from "@/lib/view";
import { drawKapScreen, drawMfdScreen, drawOff, drawPfdScreen, drawSbyAi, drawSbyAlt, drawSbyAsi } from "./displays";
import { FLOWS, cabinAirColor, flowRates, isCabinAir } from "./flows";
import { Z, loft, sided, windowOutlines, wingSec } from "./geometry";
import { live } from "./model";
import { CAT, COWL_FLAP, NOSE, NOSE_CASTER, NOSE_RAKE, P3, PROP, YOKES, surfacePivot } from "./parts";
import { KAP_LCD, LIGHTS, TANK_BL } from "./parts-systems";
import { AFT_CRANK, PULLEYS, RIG, RIG_SPEC, RUD_TRIM, aftCrankAngle, aftLinks, rudTrimLinks } from "./rig";
import type { CtlIn } from "../cessna/rig";
import { useC182 } from "./store";

type Pose = ReturnType<typeof RIG.pose>;

const P = ({ parent }: { parent?: string }) => <Parts cat={CAT} parent={parent} />;
const st = () => useC182.getState();

/**
 * Effective control inputs — the pilot's (or the KAP 140 servos'), the rudder trim bungee's bias on the rudder bars, the trim
 * position — with the rig pose and surface angles that follow from them. The surfaces, the rig and the links all ask every frame,
 * so these are recomputed only when an input changes.
 */
const IN = { p: NaN, r: NaN, y: NaN, t: NaN, f: NaN, c: { pitch: 0, roll: 0, yaw: 0, trim: 0 } as CtlIn, pose: null as unknown as Pose, sa: {} as Record<string, number> };
function rigState() {
  const p = live.ctl.pitch, r = live.ctl.roll, y = clamp(live.ctl.yaw + st().s.ctrl.rudTrim * RUD_TRIM.bias, -1, 1), t = live.kap.trim, f = live.flapAng;
  if (p !== IN.p || r !== IN.r || y !== IN.y || t !== IN.t || f !== IN.f) {
    IN.p = p; IN.r = r; IN.y = y; IN.t = t; IN.f = f;
    IN.c = { pitch: p, roll: r, yaw: y, trim: t };
    IN.pose = RIG.pose(IN.c);
    IN.sa = RIG.surfaceAngles(IN.c, f);
  }
  return IN;
}

/** Control-surface deflections (radians) from the wheel/pedals or the KAP 140 servos, the flap motor and the trim. */
const surfaceAngle = (key: string) => rigState().sa[key] ?? 0;

/** Nosewheel steering: about 11° each side with the pedals, up to 29° with differential braking (POH 7-19). */
const steerDeg = () => clamp(rigState().c.yaw * 11 + st().s.gear.diff * 18, -29, 29);

function NoseGear() {
  const caster = useRef<THREE.Group>(null!);
  useFrame(() => { caster.current.rotation.y = -steerDeg() * D2R; });
  return (
    <group position={NOSE} rotation={[0, 0, NOSE_RAKE]}>
      <P parent="noseGear" />
      <group ref={caster} position={NOSE_CASTER}><P parent="caster" /></group>
    </group>
  );
}

/** Three-blade constant-speed propeller: spins with RPM and twists its blades between 14.9° and 31.7° (POH 1-5). */
function Propeller() {
  const prop = useRef<THREE.Group>(null!);
  const blades = useRef<(THREE.Group | null)[]>([]);
  const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame((_, dt) => {
    prop.current.rotation.x -= (live.rpm / 60) * Math.PI * 2 * dt * (reduce ? 0.02 : 0.12);
    // blade angle shown exaggerated ×1.5 from the 30-inch station so the change is visible
    blades.current.forEach((b) => { if (b) b.rotation.y = -live.blade * 1.5 * D2R; });
  });
  return (
    <group ref={prop} position={PROP}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-x={(i * 2 * Math.PI) / 3}>
          <group ref={(o) => { blades.current[i] = o; }}><P parent={"blade:" + i} /></group>
        </group>
      ))}
    </group>
  );
}

/** Two cowl flap doors at the bottom aft edge of the cowl, hinged at their forward edge, worked by the pedestal lever (POH 7-37). */
function CowlFlaps() {
  const g = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const a = COWL_FLAP.base + st().s.eng.cowl * COWL_FLAP.open;
    g.current.forEach((o) => { if (o) o.rotation.z = a; });
  });
  return (
    <>
      {(["R", "L"] as const).map((k, i) => (
        <group key={k} ref={(o) => { g.current[i] = o; }} position={P3(COWL_FLAP.fs, (k === "R" ? 1 : -1) * COWL_FLAP.bl, COWL_FLAP.h)}>
          <P parent={"cowlFlap:" + k} />
        </group>
      ))}
    </>
  );
}

/** Control wheels, column interconnect, pulleys, bellcranks, pedals, trim wheels and moving rods (POH Figure 7-1). */
function ControlRig() {
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => { g.current[k] = o; };
  const Y = RIG_SPEC.yoke;
  useFrame(() => {
    const { c, pose: p } = rigState(), G = g.current;
    YOKES.forEach(({ side }) => { const y = G["yoke:" + side], w = G["wheel:" + side]; if (y) y.position.x = P3(Y.fs, 0, 0)[0] + p.yokeX; if (w) w.rotation.x = p.wheel; });
    if (G.cross) G.cross.position.x = P3(Y.colFs, 0, 0)[0] + p.yokeX;
    if (G.crank) G.crank.rotation.z = p.crank;
    if (G.aftCrank) G.aftCrank.rotation.z = aftCrankAngle(c.pitch);
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
    if (G.trimWheel) G.trimWheel.rotation.z = p.trimWheel; // nose up rolls the top aft (POH 7-7: forward = nose down)
    if (G.rudTrim) G.rudTrim.rotation.y = -st().s.ctrl.rudTrim * Math.PI * 1.5;
    for (const [k, d] of Object.entries(PULLEYS)) { const o = G["pul:" + k]; if (o) o.rotation[d.axis] = p.pulley[k]; }
  });
  return (
    <>
      {YOKES.map(({ side, bl }) => (
        <group key={side} ref={set("yoke:" + side)} position={P3(Y.fs, bl, Y.h)}>
          <P parent={"yoke:" + side} />
          <group ref={set("wheel:" + side)}><P parent={"wheel:" + side} /></group>
        </group>
      ))}
      <group ref={set("cross")} position={P3(Y.colFs, 0, Y.crossH)}><P parent="rig:cross" /></group>
      <group ref={set("crank")} position={RIG.p3(RIG_SPEC.elev.crank)}><P parent="rig:crank" /></group>
      <group ref={set("aftCrank")} position={AFT_CRANK.c}><P parent="rig:aftCrank" /></group>
      <group ref={set("pedL")}><P parent="rig:pedL" /></group>
      <group ref={set("pedR")}><P parent="rig:pedR" /></group>
      <group ref={set("trimWheel")} position={RIG.p3(RIG_SPEC.trim.wheel)}><P parent="rig:trimWheel" /></group>
      <group ref={set("rudTrim")} position={RUD_TRIM.wheel}><P parent="rig:rudTrim" /></group>
      {Object.entries(PULLEYS).map(([k, d]) => <group key={k} ref={set("pul:" + k)} position={d.c}><P parent={"rig:pul:" + k} /></group>)}
      <Links links={LINKS} points={linkPoints} />
    </>
  );
}

const LINKS: Record<string, LinkSpec> = {
  elevLink: { name: "Elevator push-pull link", note: "From the column interconnect down to the forward elevator bellcrank under the floor (POH Fig. 7-1 Sheet 2).", r: 0.006, chan: "elevator", sys: ["controls"] },
  elevPush: { name: "Elevator push-pull tube", note: "From the aft elevator bellcrank up to the elevator arm on the torque tube (POH Fig. 7-1 Sheet 2).", r: 0.007, chan: "elevator", sys: ["controls"] },
  downspring: { name: "Elevator downspring", note: "Spring from the aft bellcrank to the tailcone structure: a nose-down bias that improves stability in flight (POH 7-6).", r: 0.006, chan: "elevator", sys: ["controls"], color: "#B9A3F0" },
  ailRodR: { name: "Aileron push-pull rod", note: "Bellcrank → aileron horn (POH Fig. 7-1 Sheet 1).", r: 0.006, chan: "aileron", sys: ["controls"] },
  ailRodL: { name: "Aileron push-pull rod", note: "Bellcrank → aileron horn (POH Fig. 7-1 Sheet 1).", r: 0.006, chan: "aileron", sys: ["controls"] },
  tabRod: { name: "Trim tab push-pull rod", note: "From the actuator in the stabilizer to the tab horn on the right elevator (POH 7-6, Fig. 7-1).", r: 0.005, chan: "elevator", sys: ["controls", "autopilot"] },
  rudTrimBungee: { name: "Rudder trim bungee", note: "“The rudder is trimmed through a bungee connected to the rudder control system and a trim wheel mounted on the control pedestal” (POH 7-7): it biases the rudder bars — and the rudder and nosewheel with them.", r: 0.007, chan: "rudder", sys: ["controls"], color: "#7C57CF" },
  bungeeL: { name: "Steering bungee", note: "Spring-loaded steering bungee from the rudder bars to the nose gear: about 11° each side with the pedals, up to 29° with differential braking (POH 7-19).", r: 0.008, chan: "rudder", sys: ["controls", "gear"], color: "#7C57CF" },
  bungeeR: { name: "Steering bungee", note: "Spring-loaded steering bungee from the rudder bars to the nose gear: about 11° each side with the pedals, up to 29° with differential braking (POH 7-19).", r: 0.008, chan: "rudder", sys: ["controls", "gear"], color: "#7C57CF" },
};
/** Hinge pivots and axes of the surfaces the links ride on (fixed: looked up once, on first use). */
let piv: { ailR: Vec3; ailL: Vec3; axR: Vec3; axL: Vec3; elevR: Vec3; axE: Vec3 } | null = null;
const PIV = () => {
  if (!piv) {
    const g = (k: string) => surfacePivot(k), ax = (k: string) => CAT.surfaces.find((s) => s.key === k)!.axis;
    piv = { ailR: g("ailR"), ailL: g("ailL"), axR: ax("ailR"), axL: ax("ailL"), elevR: g("elevR"), axE: ax("elevR") };
  }
  return piv;
};
const linkPoints = () => {
  const { c, pose, sa } = rigState(), pv = PIV();
  return { ...RIG.links(c, pose, steerDeg(), pv), ...aftLinks(c.pitch, sa.elevR, pv.elevR, pv.axE), ...rudTrimLinks(pose.pedal, st().s.ctrl.rudTrim) };
};

/* ---------- integral wing tanks: fuel level is a clipping plane ---------- */
const TANKS: TankSpec[] = ([["L", -1], ["R", 1]] as const).map(([k, s]) => ({
  key: k,
  geo: () => loft(sided([TANK_BL[0], 40, 60, 80, TANK_BL[1]].map((b) => wingSec(s * Z(b), 0.12, 0.62, 0.82)), s)),
  level: () => { const f = st().s.fuel; return ((k === "L" ? f.qL : f.qR) + 2.5) / 46; },
  name: (s > 0 ? "Right" : "Left") + " fuel tank",
  note: "Vented integral wing tank: 46.0 gal total, 43.5 usable, 2.5 unusable (POH 2-14). Usable fuel CG FS 46.50 (POH 6-14).",
}));

/* ---------- live displays (GDU 1040, 10.4 in), the standby cluster and the KAP 140 LCD ---------- */
/** AVIONICS dimmer: fully counter-clockwise the displays use their photocells; turned on, it sets the lighting level manually (POH 7-59). */
const dimDisplay = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  const v = st().s.lights.avionics;
  if (v > 0.03) { ctx.fillStyle = `rgba(0,0,0,${(0.78 * (1 - v)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
};
const SCREENS: ScreenSpec[] = [
  // label anchors on the bezel's top edge / the instrument's top edge, so the labels sit above the displays instead of on them
  { key: "pfd", px: [640, 480], size: [0.211, 0.158], pos: P3(18.82, -11.5, 61.6), pinAt: [0, 0.104, 0], sys: ["avionics"], name: "PFD — GDU 1040",
    note: "Primary flight display with the annunciation window and the red PITCH TRIM box (top right) — no AFCS status bar: the KAP 140 has its own display. Shows PFD + EIS when the MFD is lost or DISPLAY BACKUP is pressed.",
    draw: (ctx, W, H) => { const { s, E } = st(); if (E.pfd) { drawPfdScreen(ctx, W, H, s, E); dimDisplay(ctx, W, H); } else drawOff(ctx, W, H); } },
  { key: "mfd", px: [640, 480], size: [0.211, 0.158], pos: P3(18.82, 10.5, 61.6), pinAt: [0, 0.104, 0], sys: ["avionics", "engine"], name: "MFD — GDU 1040",
    note: "Engine Indication System strip (ENGINE or SYSTEM page) and the moving map. MFD breaker, AVIONICS BUS 2.",
    draw: (ctx, W, H) => { const { s, E } = st(); if (E.mfd) { drawMfdScreen(ctx, W, H, s, E); dimDisplay(ctx, W, H); } else drawOff(ctx, W, H); } },
  { key: "asi", px: [220, 220], size: [0.08, 0.08], pos: P3(18.15, -3.6, 54.4), pinAt: [0, 0.041, 0], sys: ["avionics", "pitot"], name: "Standby airspeed",
    note: "Mechanical, on the shared pitot and static lines, arm 16.2 (POH 7-11, 6-23). Use it when the PFD airspeed shows a red X (POH 3-19).", draw: (ctx, W, H) => drawSbyAsi(ctx, W, H, st().s) },
  { key: "ai", px: [220, 220], size: [0.08, 0.08], pos: P3(18.15, 0.6, 54.4), pinAt: [0, -0.041, 0], sys: ["vacuum"], name: "Standby attitude",
    note: "Vacuum gyro with a GYRO flag for low vacuum. Don't use it if VAC is out of the green or the flag shows (POH 7-63, 3-21).", draw: (ctx, W, H) => drawSbyAi(ctx, W, H) },
  { key: "alt", px: [220, 220], size: [0.08, 0.08], pos: P3(18.15, 4.8, 54.4), pinAt: [0, 0.041, 0], sys: ["avionics"], name: "Standby altimeter",
    note: "Sensitive aneroid altimeter with 20 ft markings, inches of mercury and millibars, arm 15.3 (POH 6-23).", draw: (ctx, W, H) => drawSbyAlt(ctx, W, H, st().s) },
  { key: "kap", px: [400, 100], size: KAP_LCD.size, pos: KAP_LCD.pos, pinAt: [0, KAP_LCD.size[1] / 2, 0], sys: ["autopilot", "avionics"], name: "KAP 140 display",
    note: "Lateral mode and ARM left, AP and PT centre, vertical mode and ARM right, ALERT and the altitude / VS / baro readout; red P and R lamps bottom left (S3-8). Blank without the AUTO PILOT breaker or AVIONICS BUS 2.",
    draw: (ctx, W, H) => drawKapScreen(ctx, W, H) },
];

// on the phone layout the standby instruments and the KAP 140 LCD carry no label pin (they stay hoverable)
for (const d of SCREENS) if (["asi", "ai", "alt", "kap"].includes(d.key)) d.pin = () => !narrowLayout();

/* ---------- lights ---------- */
const extOn = (k: "nav" | "strobe" | "land" | "taxi" | "beacon") => () => {
  const sys = useView.getState().sys;
  return (sys === "overview" || sys === "lighting") && st().E.lit[k];
};
const cabOn = (k: "dome" | "flood" | "map") => () => useView.getState().sys === "lighting" && st().E.lit[k];
const courtesy = () => { const v = useView.getState().sys; return (v === "lighting" || v === "overview") && st().E.lit.dome; };
const strobeOn = extOn("strobe"), beaconOn = extOn("beacon");
const aim = (p: Vec3, dx: number, dy: number): Vec3 => [p[0] + dx, p[1] + dy, p[2]];
const GLOWS: GlowSpec[] = [
  { key: "navL", pos: LIGHTS.tipL, color: "#FF2A2A", size: 0.3, on: extOn("nav") },
  { key: "navR", pos: LIGHTS.tipR, color: "#22FF66", size: 0.3, on: extOn("nav") },
  { key: "tail", pos: LIGHTS.tail, color: "#FFFFFF", size: 0.22, on: extOn("nav") },
  { key: "strL", pos: LIGHTS.tipL, color: "#FFFFFF", size: 0.85, on: (t) => strobeOn() && t % 1.15 < 0.06 },
  { key: "strR", pos: LIGHTS.tipR, color: "#FFFFFF", size: 0.85, on: (t) => strobeOn() && t % 1.15 < 0.06 },
  { key: "bcn", pos: LIGHTS.beacon, color: "#FF3020", size: 0.55, on: (t) => beaconOn() && (t * 0.9) % 1 < 0.14 },
  { key: "land", pos: LIGHTS.land, color: "#FFF6DD", size: 0.45, on: extOn("land") },
  { key: "taxi", pos: LIGHTS.taxi, color: "#FFF6DD", size: 0.35, on: extOn("taxi") },
  { key: "curL", pos: LIGHTS.courtesyL, color: "#FFE7B0", size: 0.4, on: courtesy },
  { key: "curR", pos: LIGHTS.courtesyR, color: "#FFE7B0", size: 0.4, on: courtesy },
  { key: "dome", pos: LIGHTS.dome, color: "#FFE7B0", size: 0.5, on: cabOn("dome") },
  { key: "flood", pos: LIGHTS.flood, color: "#FFE7B0", size: 0.45, on: cabOn("flood") },
  { key: "map", pos: LIGHTS.map, color: "#FFE7B0", size: 0.25, on: cabOn("map") },
];
const BEAMS: BeamSpec[] = [
  { key: "land", from: LIGHTS.land, to: aim(LIGHTS.land, 3.2, -0.55), r: 0.5, opacity: 0.1, on: extOn("land") },
  { key: "taxi", from: LIGHTS.taxi, to: aim(LIGHTS.taxi, 2.2, -0.9), r: 0.7, opacity: 0.08, on: extOn("taxi") },
  { key: "curL", from: LIGHTS.courtesyL, to: aim(LIGHTS.courtesyL, 0, -1.6), r: 0.55, opacity: 0.07, on: () => useView.getState().sys === "lighting" && st().E.lit.dome },
  { key: "curR", from: LIGHTS.courtesyR, to: aim(LIGHTS.courtesyR, 0, -1.6), r: 0.55, opacity: 0.07, on: () => useView.getState().sys === "lighting" && st().E.lit.dome },
];

const rates = () => { const { s, E } = st(); return flowRates(s, E); };
const flowColor = (k: string, out: THREE.Color) => { if (!isCabinAir(k)) return false; cabinAirColor(st().s, out); return true; };

/** The C182T scene: airframe shells, control surfaces, moving assemblies, tanks, displays, lights. */
export function Model() {
  return (
    <>
      <Shells cat={CAT} />
      <ControlSurfaces cat={CAT} angle={surfaceAngle} />
      <P />
      <NoseGear />
      <Propeller />
      <CowlFlaps />
      <ControlRig />
      <Tanks tanks={TANKS} />
      <Flows flows={FLOWS} rates={rates} color={flowColor} />
      <Screens screens={SCREENS} />
      <LightFX glows={GLOWS} beams={BEAMS} />
      <WindowOutlines loops={windowOutlines} />
      {/* weak fill from below so the high wing's white underside and the belly don't read as dark paint */}
      <directionalLight position={[1, -8, 2]} intensity={0.4 * Math.PI} />
    </>
  );
}
