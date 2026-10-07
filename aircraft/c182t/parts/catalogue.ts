/**
 * C182T catalogue: `CAT` with its label lists, and the helpers the section files share (POH 182TPHAUS-04 Rev 4 + Supplement 3).
 * The parts themselves register in the section files; `index.ts` imports them in order.
 * Positions use the POH stations through `P3(FS, BL, h)` (inches → metres, see geometry.ts). Equipment-list arms (POH Figure 6-9)
 * place most items fore/aft; butt lines and heights are not in the POH and are placed from the descriptions ("left forward side
 * of the firewall", "tailcone", …), Figure 7-2 and photos.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { AF, X, Y, Z, loft, paintSkin, wC, wLE, wingP } from "../geometry";
import { live } from "../model";
import { useC182 } from "../store";

/** POH station → scene position: FS (in aft of datum), BL (in right), h (in above ground). */
export const P3 = (fs: number, bl: number, h: number): Vec3 => [X(fs), Y(h), Z(bl)];
/** Vector3 → Vec3. */
export const PV = AF.P;

/**
 * Pinned parts that stay in a view's "tap to locate" list but carry no label pin there, so each view shows about a dozen labels
 * instead of piling them up around the firewall, the cockpit and the tail.
 */
const QUIET: Partial<Record<SysId, string[]>> = {
  airframe: [
    "Refueling step",
    "Assist handle",
    "Leveling screws",
    "Tail tiedown ring",
    "Strut-to-wing fitting",
    "Identification plate",
    "Rear window",
    "Wing tiedown ring",
    "Strut-to-fuselage fitting",
    "Engine mount",
    "Main gear leg (spring steel)",
    "Wing rear spar (partial span)",
    "Rear carry-through spar",
  ],
  controls: [
    "Static discharger",
    "Elevator balance weight",
    "Aileron balance weights",
    "Rudder balance weight",
    "Control column",
    "Copilot's control wheel",
    "A/P DISC/TRIM INT switch",
    "Manual electric trim (MET) switches",
    "Column interconnect",
    "Elevator cable pulleys (forward)",
    "Elevator cable pulleys",
    "Aileron cable pulley (lower forward cabin)",
    "Aileron door-post pulley",
    "Rudder cable pulley",
    "Elevator trim cable pulley",
    "Turnbuckle",
    "Control lock",
    "KS 271C roll servo",
    "KS-270C pitch servo",
    "KS-272C pitch trim servo",
    "Elevator trim tab actuator",
    "Rudder horn",
    "Trim position indicator",
    "Rudder trim indicator",
    "Elevator downspring",
    "Aileron horn",
    "Elevator bellcrank (forward)",
    "Rudder bars",
    "Steering arm",
    "Elevator arm",
  ],
  cabin: [
    "Main gear step bracket",
    "Tow bar (stowed)",
    "Aft cabin wall — FS 134",
    "Front passenger seat",
    "Control lock",
    "Stall warning horn",
    "Baggage area C (shelf)",
    "Courtesy light (under wing)",
    "ELT remote switch",
    "Hour (Hobbs) meter",
    "Inertia reel (front seat)",
    "Openable door window",
    "Baggage area A (FS 82–109)",
  ],
  // the lever and indicator are in the cockpit, out of this view's frame (pins aren't depth-tested): listed, not labelled
  flaps: ["Flap bellcrank", "Wing flap switch lever", "Flap position indicator"],
  gear: [
    "Brake disc",
    "Rudder bars",
    "Main gear step bracket",
    "Steering arm",
    "Nose gear fork and torque link",
    "Wheel fairing",
  ],
  environment: ["CABIN AIR knob", "Cabin manifold", "DEFROST knob"],
  engine: [
    "Propeller blade",
    "Oil dipstick / filler",
    "Induction air intake",
    "Cooling air inlet",
    "MAGNETOS switch",
    "Firewall — FS 0 (datum)",
    "Fuel flow transducer",
    "Fuel distribution unit (flow divider)",
    "GEA 71 engine/airframe unit",
    "Engine-driven vacuum pump",
    "Hour (Hobbs) meter",
    "Mixture (red, vernier)",
    "Throttle (with friction lock)",
    "Left magneto",
    "Engine-driven fuel pump",
    "Fuel/air control unit (servo)",
    "Propeller governor",
    "Cylinder head 1",
    "Tach sensor",
    "Oil pressure transducer",
    "Manifold pressure transducer",
    "PROPELLER control (blue)",
    "Engine mount",
    "Induction air filter",
    "Alternator — 28 V, 60 A",
  ],
  fuel: [
    "Refueling step",
    "Assist handle",
    "Fuel vent interconnect",
    "Fuel quantity transmitter",
    "Tank outlet screen",
    "Fuel flow transducer",
    "Fuel distribution unit (flow divider)",
    "Fuel return line drain",
    "Fuel manifold (aft door post)",
    "Fuel strainer",
    "Fuel/air control unit (servo)",
  ],
  electrical: [
    "MAGNETOS switch",
    "Flap motor and actuator",
    "Auxiliary fuel pump",
    "Alternator Control Unit (ACU)",
    "STBY BATT switch",
    "AVIONICS switch (BUS 1 | BUS 2)",
    "Switch panel",
    "Forward avionics cooling fan",
    "Aft avionics cooling fan",
    "Circuit breaker panel (BUS 1 · BUS 2 · X-FEED)",
    "MASTER switch (ALT | BAT)",
    "Starter",
    "External power receptacle",
    "Circuit breaker panel (ESS · AVN 1 · AVN 2)",
  ],
  lighting: ["Switch panel", "Flood light", "Overhead console", "Rear dome light", "Taxi light", "DIMMING panel"],
  avionics: [
    "AVIONICS switch (BUS 1 | BUS 2)",
    "DISPLAY BACKUP button",
    "Forward avionics cooling fan",
    "Aft avionics cooling fan",
    "COM 2 / GPS 2 / XM antenna",
    "VOR/GS navigation antenna",
    "Marker beacon antenna",
    "Transponder antenna",
    "OAT probe (GTP 59)",
    "GEA 71 engine/airframe unit",
    "GIA 63 #2",
    "DC turn coordinator (KAP 140)",
    "Magnetic compass (non-stabilized)",
    "GDC 74A air data computer",
    "KAP 140 flight computer",
    "GMU 44 magnetometer",
    "COM 1 / GPS 1 antenna",
  ],
  autopilot: [
    "Elevator trim cable pulley",
    "GIA 63 #2",
    "Manual electric trim (MET) switches",
    "Trim position indicator",
    "Elevator trim tab",
    "KAP 140 flight computer",
    "DC turn coordinator (KAP 140)",
    "KS-272C pitch trim servo",
  ],
  propeller: ["Propeller control cable"],
  pitot: ["Static port"],
  vacuum: ["Vacuum regulator"],
};
/**
 * On a phone-width layout (the stacked layout, ≤ 860 px) the labels are as wide as half the 3D view, so each view shows only these few,
 * spread-out labels; everything stays in the panel's "tap to locate" list.
 */
const NARROW: Partial<Record<SysId, string[]>> = {
  airframe: ["Wing strut", "Aft cabin wall — FS 134"],
  controls: ["Pilot's control wheel", "Elevator trim tab", "Aileron bellcrank"],
  gear: ["Main wheel and tire", "Nose wheel and tire", "Tow bar (stowed)"],
  flaps: ["Flap motor and actuator"],
  cabin: ["Pilot seat", "Baggage door", "ELT"],
  engine: ["Lycoming IO-540-AB1A5", "Cowl flap", "Muffler heater shroud"],
  propeller: ["Propeller governor", "Propeller blade"],
  fuel: ["Fuel selector valve"],
  electrical: ["Power distribution module (J-box)"],
  lighting: ["Flashing beacon", "Landing light", "Control wheel map light"],
  environment: ["Muffler heater shroud", "Defroster outlet", "Adjustable ventilator (forward)"],
  pitot: ["Heated pitot head", "ALT STATIC AIR valve", "GRS 77 AHRS"],
  vacuum: ["Engine-driven vacuum pump", "Vacuum system air filter"],
  avionics: [],
  autopilot: ["KS 271C roll servo", "KS-270C pitch servo"],
};
export const CAT = new Catalogue("c182t", { quiet: QUIET, narrow: NARROW });
const { part, surfacePivot } = CAT;
export { part, surfacePivot };
export const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) =>
  CAT.shell(geo, name, note, skin ? paintSkin : undefined);

/* ---------- per-frame part animations ---------- */
export const S = () => useC182.getState().s;
export const EL = () => useC182.getState().E;
/** The magneto is firing: engine turning, its key position on, and not failed. */
export const fires = (mag: "R" | "L") => () => {
  const e = S().eng,
    k = e.mags;
  return live.rpm > 150 && (k === "BOTH" || k === "START" || k === mag) && !(mag === "L" ? e.fail.magL : e.fail.magR);
};
/** Toe brake (differential) or parking brake on one side, 0..1. */
export const braking = (side: "R" | "L") => () => {
  const g = S().gear;
  return g.park ? 0.6 : side === "R" ? Math.max(0, g.diff) : Math.max(0, -g.diff);
};
export const altDoorAnim =
  (x0: number): PartAnim =>
  (m) => {
    m.rotation.z = S().eng.filter ? -0.6 : 0;
    m.position.x = x0;
  };
export const fairingAnim: PartAnim = (m) => {
  m.visible = S().gear.fairings;
};

/* ---------- shared placement helpers ---------- */
export const wp = (bl: number, c: number, up = 0, dy = 0): Vec3 => PV(wingP(Z(bl), c, up).add(V(0, dy, 0)));
/** Chord fraction of a fuselage station on the wing at BL (for equipment-list arms in the wing). */
export const cAt = (fs: number, bl: number) => {
  const z = Z(bl);
  return (wLE(z) - X(fs)) / wC(z);
};
/** Top of the wing centre section over the cabin (antennas sit on it). */
export const top = (fs: number, bl = 0) => wingP(Z(bl), cAt(fs, bl), 1).y;

/* ---------- control surfaces and the parts that ride on them ---------- */
/** Control surface pivoting on its hinge line from `a` to `b`. */
export function surface(
  key: string,
  secs: () => THREE.Vector3[][],
  a: THREE.Vector3,
  b: THREE.Vector3,
  sys: SysId[],
  name: string,
  note: string,
) {
  CAT.surface({
    key,
    pivot: PV(a),
    axis: PV(b.clone().sub(a).normalize()),
    sys,
    name,
    note,
    geo: () => {
      const g = loft(secs());
      g.translate(-a.x, -a.y, -a.z);
      return g;
    },
  });
}

/** Part riding on a control surface; `world` is converted to hinge-relative coordinates. */
export function onSurf(
  key: string,
  world: THREE.Vector3 | Vec3,
  geo: () => THREE.BufferGeometry,
  o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] },
) {
  const pv = surfacePivot(key),
    w = Array.isArray(world) ? V(...world) : world;
  part(geo, o.sys || ["controls"], {
    chan: chanOfKey(key),
    ...o,
    parent: "surf:" + key,
    pos: [w.x - pv[0], w.y - pv[1], w.z - pv[2]],
  });
}
