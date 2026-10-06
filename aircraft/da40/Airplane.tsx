"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { ControlSurfaces } from "@/components/scene/ControlSurface";
import { Flows } from "@/components/scene/Flows";
import { LightFX, type BeamSpec, type GlowSpec } from "@/components/scene/LightFX";
import { Parts, Shell, Shells } from "@/components/scene/Part";
import { Screens, type ScreenSpec } from "@/components/scene/Screens";
import { Tanks, type TankSpec } from "@/components/scene/Tanks";
import { WindowOutlines } from "@/components/scene/WindowOutlines";
import { D2R, V, lerp, type Vec3 } from "@/lib/math";
import { useView } from "@/lib/view";
import { ControlRig } from "./ControlRig";
import { drawBreakers, drawGma, drawMfdScreen, drawPfdScreen, drawStbyAlt, drawStbyAsi, drawStbyAtt } from "./displays";
import { FLOWS, cabinAirColor, flowRates, isCabinAir } from "./flows";
import { PANEL_X, canopyOutlines, doorOutlines, loft, windowOutlines, wingSec } from "./geometry";
import { sided } from "@/lib/geometry";
import { bladeAngle, extLit, live } from "./model";
import { CANOPY_HINGE, CANOPY_SHELL, CAT, CBP_Z, CYLS, DISPLAY_X, DOOR_HINGE, DOOR_SHELL, GMA_Z, LIGHTS, NOSE_CASTER, NOSE_GEAR, PROP, STBY_X } from "./parts";
import { deflections } from "./rig";
import { useDA40 } from "./store";

const P = ({ parent }: { parent?: string }) => <Parts cat={CAT} parent={parent} />;

/** Control-surface deflections (radians about each hinge axis) from the effective controls and the flap motor. */
const ang: Record<string, number> = {};
let angFor: { eff: typeof live.eff | null; flap: number } = { eff: null, flap: NaN };
function surfaceAngle(key: string) {
  // recomputed only when the tick has produced new control positions (live.eff is replaced every tick)
  if (angFor.eff !== live.eff || angFor.flap !== live.flapAng) {
    const c = live.eff, d = deflections(c.pitch, c.roll, c.yaw), fl = live.flapAng * D2R;
    ang.flapR = fl; ang.flapL = -fl; ang.ailR = -d.ailR * D2R; ang.ailL = d.ailL * D2R; ang.elev = -d.elev * D2R; ang.rudder = d.rud * D2R;
    angFor = { eff: live.eff, flap: live.flapAng };
  }
  return ang[key] ?? 0;
}

function NoseGear() {
  const caster = useRef<THREE.Group>(null!);
  // free-castering nose wheel follows differential braking (illustrative angle)
  useFrame(() => { caster.current.rotation.y = lerp(caster.current.rotation.y, -useDA40.getState().s.gear.diff * 35 * D2R, 0.1); });
  return (
    <group position={NOSE_GEAR}>
      <P parent="noseGear" />
      <group ref={caster} position={NOSE_CASTER}><P parent="caster" /></group>
    </group>
  );
}

function Propeller() {
  const prop = useRef<THREE.Group>(null!);
  const blades = useRef<THREE.Group[]>([]);
  const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame((_, dt) => {
    prop.current.rotation.x -= (live.rpm / 60) * Math.PI * 2 * dt * (reduce ? 0.02 : 0.12);
    const ba = bladeAngle(useDA40.getState().s, live.rpm) * D2R;
    blades.current.forEach((b) => b && (b.rotation.y = ba));
  });
  return (
    <group ref={prop} position={PROP}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-x={(i * Math.PI * 2) / 3}>
          <group ref={(g) => { if (g) blades.current[i] = g; }}><P parent={"blade:" + i} /></group>
        </group>
      ))}
    </group>
  );
}

const Cylinders = () => <>{CYLS.map((c) => <group key={c.n} position={[c.x, -0.05, c.s * 0.26]}><P parent={"cyl:" + c.n} /></group>)}</>;

/** Hinged front canopy and left rear door (closed / cooling gap / open; in flight only partly open). */
function Openings() {
  const can = useRef<THREE.Group>(null!), door = useRef<THREE.Group>(null!);
  const canLoops = useMemo(() => () => canopyOutlines().map((l) => l.map((p) => p.clone().sub(V(...CANOPY_HINGE)))), []);
  const doorLoops = useMemo(() => () => doorOutlines().map((l) => l.map((p) => p.clone().sub(V(...DOOR_HINGE)))), []);
  useFrame((_, dt) => {
    const { s } = useDA40.getState();
    const c = s.doors.canopy;
    const ct = c === "CLOSED" ? 0 : c === "GAP" ? 1.6 : s.air ? 7 : 52;
    const dtg = s.doors.rear ? 0 : s.air ? 12 : 82;
    const k = Math.min(1, dt * 3);
    can.current.rotation.z = lerp(can.current.rotation.z, -ct * D2R, k);
    door.current.rotation.x = lerp(door.current.rotation.x, dtg * D2R, k);
  });
  return (
    <>
      <group ref={can} position={CANOPY_HINGE}>
        <Shell spec={CANOPY_SHELL} />
        <P parent="canopy" />
        <WindowOutlines loops={canLoops} />
      </group>
      <group ref={door} position={DOOR_HINGE}>
        <Shell spec={DOOR_SHELL} />
        <P parent="door" />
        <WindowOutlines loops={doorLoops} />
      </group>
    </>
  );
}

/* ---------- long-range wing tanks (aluminium, 3 chambers each; 25 US gal usable per side) ---------- */
const TANKS: TankSpec[] = ([["L", -1], ["R", 1]] as const).map(([k, s]) => ({
  key: k,
  geo: () => { const secs = [1.18, 1.6, 2.2, 2.8, 3.3, 3.55].map((z) => wingSec(s * z, 0.12, 0.62, 0.8)); return loft(sided(secs, s)); },
  level: () => { const f = useDA40.getState().s.fuel; return (k === "L" ? f.qL : f.qR) / 25; },
  name: (s > 0 ? "Right" : "Left") + " fuel tank (long range)",
  note: "Aluminium tank in the wing, three chambers joined by flexible hose: 25.5 US gal total, 25 usable (AFM 2-23, 7-34). Two probes (inboard + outboard chambers) feed one G1000 gauge.",
}));

/* ---------- live cockpit displays (GDU 1040 PFD / GDU 1042 MFD — or the optional GDU 1044 — 10.4 in.) ---------- */
const sx = DISPLAY_X, st = STBY_X - 0.0095;
const SCREENS: ScreenSpec[] = [
  { key: "pfd", px: [640, 480], size: [0.211, 0.158], pos: [sx, -0.03, -0.26], sys: ["avionics", "autopilot"], name: "PFD — GDU 1040",
    note: "Attitude, airspeed, altitude, HSI, AFCS status bar and annunciation window. PFD 5 A on ESSENTIAL. If the MFD fails it shows the composite (reversionary) format with engine data.",
    draw: (ctx, W, H) => { const { s, E } = useDA40.getState(); drawPfdScreen(ctx, W, H, s, E); } },
  { key: "mfd", px: [640, 480], size: [0.211, 0.158], pos: [sx, -0.03, 0.13], sys: ["avionics", "autopilot"], name: "MFD — GDU 1042 / 1044",
    note: "Engine indication strip on the left, map on the right; AFCS keys on its bezel. GDU 1042, or the optional GDU 1044 that adds the VNV key (AFMS p. 57) — N949KC's fit is unconfirmed. MFD 5 A on MAIN — lost on ESS BUS. Takes over the PFD in reversionary mode.",
    draw: (ctx, W, H) => { const { s, E } = useDA40.getState(); drawMfdScreen(ctx, W, H, s, E); } },
  { key: "sasi", px: [200, 200], size: [0.08, 0.08], pos: [st, 0.15, -0.107], sys: ["avionics", "pitot"], name: "Standby airspeed",
    note: "Pneumatic (pitot-static), works with no electrical power. Markings: white 49–91, green 52–129, yellow 129–178, red 178 KIAS (AFM 2-4).",
    draw: (ctx, W, H) => drawStbyAsi(ctx, W, H, useDA40.getState().s) },
  { key: "satt", px: [200, 200], size: [0.08, 0.08], pos: [st, 0.15, -0.008], sys: ["avionics"], name: "Standby attitude",
    note: "Electric (BF Goodrich AIM 1100): HORIZON 3 A on ESSENTIAL, or the emergency battery with HORIZON EMERGENCY ON. OFF flag when unpowered.",
    draw: (ctx, W, H) => drawStbyAtt(ctx, W, H, useDA40.getState().E) },
  { key: "salt", px: [200, 200], size: [0.08, 0.08], pos: [st, 0.15, 0.089], sys: ["avionics", "pitot"], name: "Standby altimeter",
    note: "Pneumatic; set both altimeters before taxi (AFMS p. 45).",
    draw: (ctx, W, H) => drawStbyAlt(ctx, W, H, useDA40.getState().s) },
  // face-plate textures: the breaker panel shows pulled breakers live; the audio panel shows its key layout
  { key: "cbp", px: [240, 304], size: [0.148, 0.188], pos: [PANEL_X - 0.041, -0.03, CBP_Z], sys: ["electrical"], name: "Circuit-breaker panel",
    note: "ESSENTIAL, MAIN and MAIN AVIONICS rows, right of the MFD; a pulled breaker shows its white collar. Tap the breakers in the Electrical panel.",
    draw: (ctx, W, H) => drawBreakers(ctx, W, H, useDA40.getState().s) },
  { key: "gma", px: [96, 320], size: [0.056, 0.19], pos: [PANEL_X - 0.051, -0.03, GMA_Z], sys: ["avionics"], name: "GMA 1347 audio panel",
    note: "COM/NAV audio selection, intercom, marker beacon and the red DISPLAY BACKUP button at the bottom. AUDIO 5 A on ESSENTIAL in the GFC 700 airplane.",
    draw: (ctx, W, H) => drawGma(ctx, W, H, useDA40.getState().E.audio) },
];

/* ---------- exterior + interior light glows ---------- */
const extOn = (k: "land" | "taxi" | "pos" | "strobe") => () => {
  const sys = useView.getState().sys, { s, E } = useDA40.getState();
  return (sys === "overview" || sys === "lighting") && extLit(s, E)[k];
};
const strobeOn = extOn("strobe");
/** Whelen strobes: a double flash about once a second (flash rate not in the documents). */
const strobe = (t: number) => strobeOn() && (t % 1.1 < 0.05 || (t % 1.1 > 0.16 && t % 1.1 < 0.21));
const aim = (p: Vec3, dx: number, dy: number, dz = 0): Vec3 => [p[0] + dx, p[1] + dy, p[2] + dz];
const inside = (k: "flood" | "instr") => () => {
  const sys = useView.getState().sys, { s, E } = useDA40.getState();
  if (!(sys === "lighting" || sys === "avionics" || sys === "electrical")) return false;
  return k === "flood" ? E.floodPwr && (s.lights.flood > 0 || s.elec.emerg) : E.instPwr && s.lights.instr > 0;
};
const GLOWS: GlowSpec[] = [
  { key: "navL", pos: LIGHTS.tipL, color: "#FF2A2A", size: 0.3, on: extOn("pos") },
  { key: "navR", pos: LIGHTS.tipR, color: "#22FF66", size: 0.3, on: extOn("pos") },
  { key: "aftL", pos: LIGHTS.aftL, color: "#FFFFFF", size: 0.2, on: extOn("pos") },
  { key: "aftR", pos: LIGHTS.aftR, color: "#FFFFFF", size: 0.2, on: extOn("pos") },
  { key: "strL", pos: LIGHTS.tipL, color: "#FFFFFF", size: 0.85, on: strobe },
  { key: "strR", pos: LIGHTS.tipR, color: "#FFFFFF", size: 0.85, on: strobe },
  { key: "land", pos: LIGHTS.land, color: "#FFF6DD", size: 0.45, on: extOn("land") },
  { key: "taxi", pos: LIGHTS.taxi, color: "#FFF6DD", size: 0.35, on: extOn("taxi") },
  { key: "flood", pos: LIGHTS.flood, color: "#FFE7B0", size: 0.5, on: inside("flood") },
  { key: "instr", pos: LIGHTS.instr, color: "#FFD8A0", size: 0.3, on: inside("instr") },
];
const BEAMS: BeamSpec[] = [
  { key: "land", from: LIGHTS.land, to: aim(LIGHTS.land, 3.0, -0.35), r: 0.45, opacity: 0.1, on: extOn("land") },
  { key: "taxi", from: LIGHTS.taxi, to: aim(LIGHTS.taxi, 2.2, -0.7, -0.6), r: 0.6, opacity: 0.08, on: extOn("taxi") },
];

const rates = () => { const { s, E } = useDA40.getState(); return flowRates(s, E); };
const flowColor = (k: string, out: THREE.Color) => { if (!isCabinAir(k)) return false; cabinAirColor(useDA40.getState().s, out); return true; };

/** The DA40 XLS scene: airframe shells, control surfaces, moving assemblies, tanks, displays and lights. */
export function Model() {
  return (
    <>
      <Shells cat={CAT} />
      <ControlSurfaces cat={CAT} angle={surfaceAngle} />
      <P />
      <Openings />
      <NoseGear />
      <Propeller />
      <Cylinders />
      <ControlRig />
      <Tanks tanks={TANKS} />
      <Flows flows={FLOWS} rates={rates} color={flowColor} />
      <Screens screens={SCREENS} />
      <LightFX glows={GLOWS} beams={BEAMS} />
      <WindowOutlines loops={windowOutlines} />
    </>
  );
}
