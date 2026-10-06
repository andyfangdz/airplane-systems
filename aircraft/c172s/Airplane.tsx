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
import { useView } from "@/lib/view";
import { drawMfdScreen, drawOff, drawPfdScreen, drawSbyAi, drawSbyAlt, drawSbyAsi } from "./displays";
import { FLOWS, cabinAirColor, flowRates, isCabinAir } from "./flows";
import { Z, loft, sided, windowOutlines, wingSec } from "./geometry";
import { live } from "./model";
import { CAT, NOSE, NOSE_CASTER, P3, PROP, YOKES, surfacePivot } from "./parts";
import { LIGHTS } from "./parts-systems";
import { PULLEYS, RIG, RIG_SPEC } from "./rig";
import { useC172 } from "./store";

const P = ({ parent }: { parent?: string }) => <Parts cat={CAT} parent={parent} />;
const ctlIn = () => ({ ...live.ctl, trim: live.afcs.trim });

/** Control-surface deflections (radians) from the wheel/pedals or the GFC 700 servos, the flap motor and the trim. */
const surfaceAngle = (key: string) => (RIG.surfaceAngles(ctlIn(), live.flapAng) as Record<string, number>)[key] ?? 0;

/** Nosewheel steering: about 10° each side with the pedals, up to 30° with differential braking (POH 7-22). */
const steerDeg = () => { const s = useC172.getState().s; return clamp(live.ctl.yaw * 10 + s.gear.diff * 20, -30, 30); };

function NoseGear() {
  const caster = useRef<THREE.Group>(null!);
  useFrame(() => { caster.current.rotation.y = -steerDeg() * D2R; });
  return (
    <group position={NOSE}>
      <P parent="noseGear" />
      <group ref={caster} position={NOSE_CASTER}><P parent="caster" /></group>
    </group>
  );
}

function Propeller() {
  const prop = useRef<THREE.Group>(null!);
  const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame((_, dt) => { prop.current.rotation.x -= (live.rpm / 60) * Math.PI * 2 * dt * (reduce ? 0.02 : 0.12); });
  return (
    <group ref={prop} position={PROP}>
      {[0, 1].map((i) => <group key={i} rotation-x={i * Math.PI}><P parent={"blade:" + i} /></group>)}
    </group>
  );
}

/** Control wheels and the column interconnect, pulleys, bellcranks, pedals, trim wheel and moving rods (POH Fig. 7-1). */
function ControlRig() {
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => { g.current[k] = o; };
  const Y = RIG_SPEC.yoke;
  useFrame(() => {
    const p = RIG.pose(ctlIn()), G = g.current;
    YOKES.forEach(({ side }) => { const y = G["yoke:" + side], w = G["wheel:" + side]; if (y) y.position.x = P3(Y.fs, 0, 0)[0] + p.yokeX; if (w) w.rotation.x = p.wheel; });
    if (G.cross) G.cross.position.x = P3(Y.colFs, 0, 0)[0] + p.yokeX;
    if (G.crank) G.crank.rotation.z = p.crank;
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
    if (G.trimWheel) G.trimWheel.rotation.z = p.trimWheel; // nose up rolls the top aft (POH 7-7: forward = nose down)
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
      <group ref={set("pedL")}><P parent="rig:pedL" /></group>
      <group ref={set("pedR")}><P parent="rig:pedR" /></group>
      <group ref={set("trimWheel")} position={RIG.p3(RIG_SPEC.trim.wheel)}><P parent="rig:trimWheel" /></group>
      {Object.entries(PULLEYS).map(([k, d]) => <group key={k} ref={set("pul:" + k)} position={d.c}><P parent={"rig:pul:" + k} /></group>)}
      <Links links={LINKS} points={linkPoints} />
    </>
  );
}

const LINKS: Record<string, LinkSpec> = {
  elevLink: { name: "Elevator push-pull link", note: "From the column interconnect down to the forward elevator bellcrank under the floor (POH Fig. 7-1).", r: 0.006, chan: "elevator", sys: ["controls"] },
  ailRodR: { name: "Aileron push-pull rod", note: "Bellcrank → aileron horn (POH Fig. 7-1).", r: 0.006, chan: "aileron", sys: ["controls"] },
  ailRodL: { name: "Aileron push-pull rod", note: "Bellcrank → aileron horn (POH Fig. 7-1).", r: 0.006, chan: "aileron", sys: ["controls"] },
  tabRod: { name: "Trim tab push-pull rod", note: "From the actuator in the stabilizer to the tab horn on the right elevator (POH Fig. 7-1).", r: 0.005, chan: "elevator", sys: ["controls", "autopilot"] },
  bungeeL: { name: "Steering bungee", note: "Spring-loaded bungee from the rudder bars to the nose gear: about 10° of nosewheel steering each side (POH 7-22).", r: 0.008, chan: "rudder", sys: ["controls", "gear"], color: "#7C57CF" },
  bungeeR: { name: "Steering bungee", note: "Spring-loaded bungee from the rudder bars to the nose gear: about 10° of nosewheel steering each side (POH 7-22).", r: 0.008, chan: "rudder", sys: ["controls", "gear"], color: "#7C57CF" },
};
const PIV = (() => {
  const g = (k: string) => surfacePivot(k);
  const ax = (k: string) => CAT.surfaces.find((s) => s.key === k)!.axis;
  return () => ({ ailR: g("ailR"), ailL: g("ailL"), axR: ax("ailR"), axL: ax("ailL"), elevR: g("elevR"), axE: ax("elevR") });
})();
const linkPoints = () => { const c = ctlIn(); return RIG.links(c, RIG.pose(c), steerDeg(), PIV()); };

/* ---------- integral wing tanks: fuel level is a clipping plane ---------- */
const TANKS: TankSpec[] = ([["L", -1], ["R", 1]] as const).map(([k, s]) => ({
  key: k,
  geo: () => loft(sided([23, 40, 60, 80, 95].map((b) => wingSec(s * Z(b), 0.12, 0.62, 0.82)), s)),
  level: () => { const f = useC172.getState().s.fuel; return ((k === "L" ? f.qL : f.qR) + 1.5) / 28; },
  name: (s > 0 ? "Right" : "Left") + " fuel tank",
  note: "Integral vented wing tank: 28.0 gal total, 26.5 usable, 1.5 unusable (POH 2-18). Usable fuel CG FS 48.0.",
}));

/* ---------- live displays (GDU 1040 4:3, 10.4 in) and the standby cluster ---------- */
const st = () => useC172.getState();
/** AVIONICS dimmer: fully counter-clockwise (off) the displays use their photocells (full daylight brightness here); turned on,
 *  it sets the PFD/MFD lighting level manually (POH 7-61). */
const dimDisplay = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  const v = st().s.lights.avionics;
  if (v > 0.03) { ctx.fillStyle = `rgba(0,0,0,${(0.78 * (1 - v)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
};
const SCREENS: ScreenSpec[] = [
  { key: "pfd", px: [640, 480], size: [0.211, 0.158], pos: P3(18.62, -11.5, 61.4), sys: ["avionics"], name: "PFD — GDU 1040",
    note: "Primary flight display with the AFCS status bar and the annunciation window. Dual-fed (PFD breakers on ESS and AVN BUS 1). Shows PFD + EIS when the MFD is lost or DISPLAY BACKUP is pressed.",
    draw: (ctx, W, H) => { const { s, E } = st(); if (E.pfd) { drawPfdScreen(ctx, W, H, s, E); dimDisplay(ctx, W, H); } else drawOff(ctx, W, H); } },
  { key: "mfd", px: [640, 480], size: [0.211, 0.158], pos: P3(18.62, 10.5, 61.4), sys: ["avionics", "engine"], name: "MFD — GDU 1040",
    note: "Engine Indication System strip (ENGINE page) and moving map. MFD breaker, AVIONICS BUS 2.",
    draw: (ctx, W, H) => { const { s, E } = st(); if (E.mfd) { drawMfdScreen(ctx, W, H, s, E); dimDisplay(ctx, W, H); } else drawOff(ctx, W, H); } },
  { key: "asi", px: [220, 220], size: [0.08, 0.08], pos: P3(17.95, -3.6, 52.6), sys: ["avionics", "pitot"], name: "Standby airspeed",
    note: "Mechanical, on the shared pitot and static lines (POH 7-12). Use it when the PFD airspeed shows a red X (POH 3-21).", draw: (ctx, W, H) => drawSbyAsi(ctx, W, H, st().s) },
  { key: "ai", px: [220, 220], size: [0.08, 0.08], pos: P3(17.95, 0.6, 52.6), sys: ["vacuum"], name: "Standby attitude",
    note: "Vacuum-driven gyro with a GYRO flag for low vacuum. Don't use it if VAC is out of the green or the flag shows (POH 7-65, 3-23).", draw: (ctx, W, H) => drawSbyAi(ctx, W, H) },
  { key: "alt", px: [220, 220], size: [0.08, 0.08], pos: P3(17.95, 4.8, 52.6), sys: ["avionics"], name: "Standby altimeter",
    note: "Sensitive aneroid altimeter, 20 ft markings (POH 6-22). Set it before takeoff and in the descent (POH 4-15).", draw: (ctx, W, H) => drawSbyAlt(ctx, W, H, st().s) },
];

/* ---------- lights ---------- */
const extOn = (k: "nav" | "strobe" | "land" | "taxi" | "beacon") => () => {
  const sys = useView.getState().sys;
  return (sys === "overview" || sys === "lighting") && st().E.lit[k];
};
const cabOn = (k: "dome" | "flood" | "map") => () => useView.getState().sys === "lighting" && st().E.lit[k];
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
  { key: "curL", pos: LIGHTS.courtesyL, color: "#FFE7B0", size: 0.4, on: () => (useView.getState().sys === "lighting" || useView.getState().sys === "overview") && st().E.lit.dome },
  { key: "curR", pos: LIGHTS.courtesyR, color: "#FFE7B0", size: 0.4, on: () => (useView.getState().sys === "lighting" || useView.getState().sys === "overview") && st().E.lit.dome },
  { key: "dome", pos: LIGHTS.dome, color: "#FFE7B0", size: 0.5, on: cabOn("dome") },
  ...LIGHTS.flood.map((p, i) => ({ key: "flood" + i, pos: p, color: "#FFE7B0", size: 0.4, on: cabOn("flood") })),
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

/** The C172S scene: airframe shells, control surfaces, moving assemblies, tanks, displays, lights. */
export function Model() {
  return (
    <>
      <Shells cat={CAT} />
      <ControlSurfaces cat={CAT} angle={surfaceAngle} />
      <P />
      <NoseGear />
      <Propeller />
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
