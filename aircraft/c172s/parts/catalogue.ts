/**
 * C172S catalogue: `CAT` with its label lists, and the helpers the section files share (POH 172SPHBUS-04).
 * The parts themselves register in the section files; `index.ts` imports them in order.
 * Positions use the POH stations through `P3(FS, BL, h)` (inches → metres, see geometry.ts).
 * Equipment-list arms (POH Figure 6-9) place most items fore/aft; butt lines and heights are not in the
 * POH and are placed from the descriptions ("left forward side of the firewall", "tailcone", …) and photos.
 */
import { Catalogue, type PartAnim } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { AF, X, Z, paintSkin, wC, wLE, wingP } from "../geometry";
import { brakeAmount, magFires } from "@/lib/anims";
import { live } from "../model";
import { useC172 } from "../store";

/** POH station → scene position (FS, BL, h in inches), and Vector3 → Vec3: from the Cessna airframe builder. */
export const { P3, P: PV } = AF;

/**
 * Pinned parts that stay in a view's "tap to locate" list but carry no label pin there, so each view shows about ten
 * labels instead of piling them up around the firewall, the cockpit and the tail.
 */
const QUIET: Partial<Record<SysId, string[]>> = {
  airframe: ["Refueling step", "Assist handle", "Leveling screws", "Tail tiedown ring"],
  controls: [
    "Static discharger",
    "Elevator balance weight",
    "Aileron balance weights",
    "Rudder balance weight",
    "Control column",
    "Copilot's control wheel",
    "A/P TRIM DISC button",
    "CWS button",
    "Manual Electric Trim (MET) switch",
    "Column interconnect",
    "Elevator cable pulleys (forward)",
    "Elevator cable pulleys",
    "Aileron cable pulley (lower forward cabin)",
    "Aileron door-post pulley",
    "Rudder cable pulley",
    "Elevator trim cable pulley",
    "Turnbuckle",
    "Control lock",
    "GFC 700 roll servo",
    "GFC 700 pitch servo",
    "GFC 700 pitch trim servo",
    "Elevator trim tab actuator",
    "Rudder horn",
    "Rudder trim tab (ground adjustable)",
  ],
  cabin: [
    "Main gear step bracket",
    "Tow bar (stowed)",
    "Aft baggage wall — FS 108",
    "Front passenger seat",
    "Control lock",
    "Stall warning horn",
    "Courtesy light (under wing)",
    "ELT remote switch",
    "Hour (Hobbs) meter",
    "Inertia reel (front seat)",
    "Openable door window",
    "Baggage area A (FS 82–108)",
  ],
  flaps: ["Flap bellcrank"],
  gear: ["Wheel fairing", "Brake disc", "Rudder bars"],
  environment: ["CABIN AIR knob", "Cabin manifold"],
  engine: [
    "Propeller blade",
    "Oil dipstick / filler",
    "Induction air intake",
    "Alternate air door",
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
  ],
  fuel: [
    "Refueling step",
    "Assist handle",
    "Fuel vent interconnect",
    "Fuel reservoir tank",
    "Fuel shutoff valve",
    "FUEL SHUTOFF knob",
    "Fuel distribution unit (flow divider)",
    "Fuel quantity transmitter",
    "Fuel tank sump drain",
    "Tank outlet screen",
    "Fuel flow transducer",
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
    "Circuit breaker panel",
    "MASTER switch (ALT | BAT)",
  ],
  lighting: [
    "Switch panel",
    "Flood light",
    "Overhead console",
    "Rear dome light",
    "Taxi light",
    "Control wheel map light",
  ],
  avionics: [
    "PFD bezel AFCS keys",
    "AVIONICS switch (BUS 1 | BUS 2)",
    "DISPLAY BACKUP button",
    "Forward avionics cooling fan",
    "Aft avionics cooling fan",
    "COM 2 / GPS 2 antenna",
    "VOR/GS navigation antenna",
    "Marker beacon antenna",
    "Transponder antenna",
    "OAT probe (GTP 59)",
    "GEA 71 engine/airframe unit",
  ],
  autopilot: [
    "Elevator trim cable pulley",
    "GIA 63W #2",
    "CWS button",
    "Manual Electric Trim (MET) switch",
    "PFD bezel AFCS keys",
    "GFC 700 pitch trim servo",
  ],
};
export const CAT = new Catalogue("c172s", { quiet: QUIET }, paintSkin);
export const { part, surfacePivot, shell, loftSurface: surface, onSurface: onSurf } = CAT;

/* ---------- per-frame part animations ---------- */
export const S = () => useC172.getState().s;
/** The magneto is firing: engine turning, its key position on, and not failed. */
export const fires = (mag: "R" | "L") => () => {
  const e = S().eng;
  return live.rpm > 150 && magFires(mag, e.mags, mag === "L" ? e.fail.magL : e.fail.magR);
};
/** Toe brake (differential) or parking brake on one side, 0..1. */
export const braking = (side: "R" | "L") => () => brakeAmount(S().gear, side);
export const altDoorAnim =
  (x0: number): PartAnim =>
  (m) => {
    m.rotation.z = S().eng.filter ? -0.6 : 0;
    m.position.x = x0;
  };
export const EL = () => useC172.getState().E;

/* ---------- shared placement helpers ---------- */
export const wp = (bl: number, c: number, up = 0, dy = 0): Vec3 => PV(wingP(Z(bl), c, up).add(V(0, dy, 0)));
/** Top of the wing centre section over the cabin (antennas sit on it). */
export const top = (fs: number, bl = 0) => {
  const z = Z(bl);
  return wingP(z, (wLE(z) - X(fs)) / wC(z), 1).y;
};
