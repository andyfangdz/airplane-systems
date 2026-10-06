/**
 * Declarative catalogue of every modelled C172S NAV III component (POH 172SPHBUS-04).
 * Positions use the POH stations through `P3(FS, BL, h)` (inches → metres, see geometry.ts).
 * Equipment-list arms (POH Figure 6-9) place most items fore/aft; butt lines and heights are not in the
 * POH and are placed from the descriptions ("left forward side of the firewall", "tailcone", …) and photos.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { Chan, SysId } from "@/lib/systems";
import { gfc700Engaged } from "@/lib/avionics/gfc700";
import {
  AF, AIL_C, BL, EF, FLAP_C, HF, HZ, SY, X, Y, Z, box, cyl, fuselageGeo, finCut, finSec, fLE, fC, hingeX, loft, onSkin, paintSkin,
  planeRing, rearRoofGeo, sC, sLE, sectionSlab, sided, sph, stabSec, strutGeo, taperTubeGeo, tubeGeo, wC, wLE, wY, wheelFairingGeo, wingP, wingSec,
} from "./geometry";
import { live } from "./model";
import { PULLEYS, RIG, RIG_SPEC } from "./rig";
import { useC172 } from "./store";
import { IN } from "../cessna/airframe";
import { brakeAnim, glowAnim, magAnim, plugAnim, pushPull, sparkPhase } from "../cessna/anims";
import { pulleyGeo } from "../cessna/rig";

/** POH station → scene position: FS (in aft of datum), BL (in right), h (in above ground). */
export const P3 = (fs: number, bl: number, h: number): Vec3 => [X(fs), Y(h), Z(bl)];
/** Vector3 → Vec3. */
const PV = AF.P;

/**
 * Pinned parts that stay in a view's "tap to locate" list but carry no label pin there, so each view shows about ten
 * labels instead of piling them up around the firewall, the cockpit and the tail.
 */
const QUIET: Partial<Record<SysId, string[]>> = {
  airframe: ["Refueling step", "Assist handle", "Leveling screws", "Tail tiedown ring"],
  controls: ["Static discharger", "Elevator balance weight", "Aileron balance weights", "Rudder balance weight", "Control column", "Copilot's control wheel",
    "A/P TRIM DISC button", "CWS button", "Manual Electric Trim (MET) switch", "Column interconnect", "Elevator cable pulleys (forward)", "Elevator cable pulleys",
    "Aileron cable pulley (lower forward cabin)", "Aileron door-post pulley", "Rudder cable pulley", "Elevator trim cable pulley", "Turnbuckle", "Control lock",
    "GFC 700 roll servo", "GFC 700 pitch servo", "GFC 700 pitch trim servo", "Elevator trim tab actuator", "Rudder horn", "Rudder trim tab (ground adjustable)"],
  cabin: ["Main gear step bracket", "Tow bar (stowed)", "Aft baggage wall — FS 108", "Front passenger seat", "Control lock", "Stall warning horn",
    "Courtesy light (under wing)", "ELT remote switch", "Hour (Hobbs) meter", "Inertia reel (front seat)", "Openable door window", "Baggage area A (FS 82–108)"],
  flaps: ["Flap bellcrank"],
  gear: ["Wheel fairing", "Brake disc", "Rudder bars"],
  environment: ["CABIN AIR knob", "Cabin manifold"],
  engine: ["Propeller blade", "Oil dipstick / filler", "Induction air intake", "Alternate air door", "Cooling air inlet", "MAGNETOS switch", "Firewall — FS 0 (datum)",
    "Fuel flow transducer", "Fuel distribution unit (flow divider)", "GEA 71 engine/airframe unit", "Engine-driven vacuum pump", "Hour (Hobbs) meter", "Mixture (red, vernier)",
    "Throttle (with friction lock)", "Left magneto", "Engine-driven fuel pump", "Fuel/air control unit (servo)"],
  fuel: ["Refueling step", "Assist handle", "Fuel vent interconnect", "Fuel reservoir tank", "Fuel shutoff valve", "FUEL SHUTOFF knob", "Fuel distribution unit (flow divider)", "Fuel quantity transmitter",
    "Fuel tank sump drain", "Tank outlet screen", "Fuel flow transducer"],
  electrical: ["MAGNETOS switch", "Flap motor and actuator", "Auxiliary fuel pump", "Alternator Control Unit (ACU)", "STBY BATT switch", "AVIONICS switch (BUS 1 | BUS 2)",
    "Switch panel", "Forward avionics cooling fan", "Aft avionics cooling fan", "Circuit breaker panel", "MASTER switch (ALT | BAT)"],
  lighting: ["Switch panel", "Flood light", "Overhead console", "Rear dome light", "Taxi light"],
  avionics: ["PFD bezel AFCS keys", "AVIONICS switch (BUS 1 | BUS 2)", "DISPLAY BACKUP button", "Forward avionics cooling fan", "Aft avionics cooling fan",
    "COM 2 / GPS 2 antenna", "VOR/GS navigation antenna", "Marker beacon antenna", "Transponder antenna", "OAT probe (GTP 59)", "GEA 71 engine/airframe unit"],
  autopilot: ["Elevator trim cable pulley", "GIA 63W #2", "CWS button", "Manual Electric Trim (MET) switch", "PFD bezel AFCS keys", "GFC 700 pitch trim servo"],
};
export const CAT = new Catalogue("c172s", { quiet: QUIET });
const { part, surfacePivot } = CAT;
export { surfacePivot };
const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) => CAT.shell(geo, name, note, skin ? paintSkin : undefined);

/* ---------- per-frame part animations ---------- */
const S = () => useC172.getState().s;
/** The magneto is firing: engine turning, its key position on, and not failed. */
const fires = (mag: "R" | "L") => () => {
  const e = S().eng, k = e.mags;
  return live.rpm > 150 && (k === "BOTH" || k === "START" || k === mag) && !(mag === "L" ? e.fail.magL : e.fail.magR);
};
/** Toe brake (differential) or parking brake on one side, 0..1. */
const braking = (side: "R" | "L") => () => { const g = S().gear; return g.park ? 0.6 : side === "R" ? Math.max(0, g.diff) : Math.max(0, -g.diff); };
const altDoorAnim = (x0: number): PartAnim => (m) => { m.rotation.z = S().eng.filter ? -0.6 : 0; m.position.x = x0; };

/* ---------- airframe shells ---------- */
shell(fuselageGeo, "Fuselage", "All-metal semimonocoque: formed bulkheads, stringers and skin. Front and rear carry-through spars take the wings; a bulkhead and forgings at the base of the rear door posts take the main gear; four engine mount stringers run from the forward door posts to the firewall (POH 7-5).", true);
shell(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(Math.max(1e-4, 7.6 * IN * Math.sqrt(1 - t * t * 0.985)), t * 9.6 * IN)); }
  const g = new THREE.LatheGeometry(pts, 32); g.rotateZ(-Math.PI / 2); g.translate(X(-37.4), 0, 0); return g;
}, "Spinner", "Spinner dome FS −42.6, forward bulkhead −40.8, aft bulkhead −37.3 (POH 6-23). Covers the McCauley fixed-pitch propeller hub.");

const tipS = [BL.ail1, 209, 211, 212.5, 213.5];
[1, -1].forEach((s) => {
  const side = s > 0 ? "Right" : "Left";
  const zs = (bls: number[]) => bls.map((b) => Z(b));
  shell(() => loft(sided(zs([0, 10, 21.5, 40, 60, 80, BL.flap1, BL.ail0]).map((z) => wingSec(s * z, 0, FLAP_C)), s)), side + " wing",
    "Externally braced all-metal wing with an integral fuel tank. Front spar with wing-to-fuselage and wing-to-strut fittings; partial-span rear spar (POH 7-5). Constant chord inboard, tapered outboard panel, conical-camber tip.");
  shell(() => loft(sided(zs([BL.ail0, 125, 150, 175, 195, BL.ail1, ...tipS.slice(1)]).map((z) => wingSec(s * z, 0, AIL_C)), s)), side + " wing", "Outboard tapered panel carrying the aileron and the wing-tip lights.");
  shell(() => loft(sided(zs([0, 10, BL.flap0]).map((z) => wingSec(s * z, FLAP_C, 1)), s)), "Wing root trailing edge", "");
  shell(() => loft(sided(zs([BL.flap1, BL.ail0]).map((z) => wingSec(s * z, FLAP_C, 1)), s)), "Wing trailing edge", "");
  shell(() => loft(sided(zs(tipS).map((z) => wingSec(s * z, AIL_C, 1)), s)), "Wing tip", "Fiberglass conical-camber tip; carries the position light and strobe.");
  shell(() => loft(sided([...[0, 0.12, 0.3, 0.5, 0.75, 1.0].map((b) => stabSec(s * Z(b * (HZ - 0.05)), 0, EF)), ...[HZ, 62, 64.5, 66.5, 67.6, 68].map((b) => stabSec(s * Z(b), 0, HF))], s)),
    "Horizontal stabilizer", "Forward and aft spars, ribs and wraparound skins; it also houses the elevator trim tab actuator (POH 7-6). Span 11'-4\" (POH 1-3).");
});
const finHs = [44.5, 52, 59, 60, 61.5, 64, 70, 78, 85, 92, 100, 103, 104.4].map(Y);
shell(() => loft(finHs.map((h) => finSec(h, 0, finCut(h)))), "Vertical stabilizer", "Spar, ribs, wraparound skin and a dorsal fin (POH 7-5). The rudder hinges on its rear spar.");

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
function surface(key: string, secs: () => THREE.Vector3[][], a: THREE.Vector3, b: THREE.Vector3, sys: SysId[], name: string, note: string) {
  CAT.surface({ key, pivot: PV(a), axis: PV(b.clone().sub(a).normalize()), sys, name, note,
    geo: () => { const g = loft(secs()); g.translate(-a.x, -a.y, -a.z); return g; } });
}
/** Hinge point on the wing at BL, chord fraction c, dropped below the mean line by `drop` m. */
const hp = (s: number, bl: number, c: number, drop = 0) => { const z = Z(bl); return V(wLE(z) - c * wC(z), wY(z) - drop, s * z); };
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L", Side = s > 0 ? "Right" : "Left";
  const fz = [BL.flap0, 40, 60, 80, BL.flap1].map(Z), az = [BL.ail0, 130, 160, 185, BL.ail1].map(Z);
  // single-slot flap rides aft and down: the hinge axis sits below the wing so rotation moves it aft as it deflects
  surface("flap" + side, () => sided(fz.map((z) => wingSec(s * z, FLAP_C, 1)), s), hp(s, BL.flap0, 0.69, 0.07), hp(s, BL.flap1, 0.69, 0.07), ["flaps", "controls"],
    Side + " flap", "Single-slot flap: built like the ailerons but without balance weights, with a formed leading edge (POH 7-5). UP, 10°, 20°, FULL (30°).");
  surface("ail" + side, () => sided(az.map((z) => wingSec(s * z, AIL_C, 1)), s), hp(s, BL.ail0, AIL_C + 0.02), hp(s, BL.ail1, AIL_C + 0.02), ["controls"],
    Side + " aileron", "Conventional hinged aileron (modified Frise): forward spar with balance weights, “V” corrugated skins. Travel up 20° / down 15° (TCDS 3A12).");
  const ez = [2, 20, 40, HZ - 0.05].map(Z);
  surface("elev" + side, () => sided([...ez.map((z) => stabSec(s * z, EF, 1)), ...[HZ, 62, 64.5, 66.5, 67.6, 68].map((b) => stabSec(s * Z(b), HF, 1))], s),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]), V(sLE(Z(HZ)) - EF * sC(Z(HZ)), SY, s * Z(HZ)), ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)", "Torque tube and bellcrank; tip leading-edge extensions carry balance weights (POH 7-6). Travel up 28° / down 23° (TCDS 3A12)." + (s > 0 ? " Right half has the trim-tab cutout." : ""));
});
surface("rudder", () => [44.5, 52, 59, 64, 72, 82, 92, 100, 103, 104.4].map(Y).map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(Y(44.5)), Y(44.5), 0), V(hingeX(Y(103)), Y(103), 0), ["controls"],
  "Rudder", "Formed leading edge, spar, hinge brackets, wraparound skin; the top has a leading-edge extension with a balance weight; ground-adjustable trim tab at the base of the trailing edge (POH 7-6). Travel ±16°10′ (TCDS 3A12).");

/** Part riding on a control surface; `world` is converted to hinge-relative coordinates. */
function onSurf(key: string, world: THREE.Vector3 | Vec3, geo: () => THREE.BufferGeometry, o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] }) {
  const pv = surfacePivot(key), w = Array.isArray(world) ? V(...world) : world;
  part(geo, o.sys || ["controls"], { chan: chanOfKey(key), ...o, parent: "surf:" + key, pos: [w.x - pv[0], w.y - pv[1], w.z - pv[2]] });
}

/* ---------- surface details ---------- */
const WICK = "Static discharger: bleeds static charge off the trailing edge to cut radio noise. A set of 10 is installed (POH 7-78, 6-19).";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * Z(195), 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true, pin: s > 0 });
  onSurf("elev" + side, V(sLE(Z(52)) - sC(Z(52)) - 0.05, SY, s * Z(52)), () => cyl(0.004, 0.11, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true });
  onSurf("elev" + side, V(sLE(Z(64)) - 0.04, SY, s * Z(64)), () => box(0.07, 0.03, 0.12), { color: "#6E7A84", name: "Elevator balance weight", note: "In the elevator tip leading-edge extension ahead of the hinge (horn balance) — reduces stick force and prevents flutter (POH 7-6).", pin: s > 0 });
  onSurf("ail" + side, wingP(s * Z(150), AIL_C + 0.035, 0), () => box(0.05, 0.025, 0.5), { color: "#6E7A84", name: "Aileron balance weights", note: "Carried in the aileron forward spar (POH 7-6).", pin: s > 0 });
  // flap tracks / rollers and aileron hinges
  [30, 60, 92].forEach((b, i) => part(() => box(0.32, 0.05, 0.03), ["flaps"], { pos: PV(wingP(s * Z(b), 0.74, -1).add(V(-0.03, -0.03, 0))), color: "#B9C1C7", name: "Flap track and rollers", note: "The flap rolls aft and down along curved tracks as it extends, opening the slot (single-slot flap).", ext: true, pin: s > 0 && i === 0 }));
  [118, 165, 200].forEach((b) => part(() => box(0.2, 0.035, 0.022), ["controls"], { pos: PV(wingP(s * Z(b), 0.78, -1).add(V(-0.01, -0.012, 0))), color: "#C9D0D5", name: "Aileron hinge", note: "Aileron hinge bracket on the rear spar.", ext: true, chan: ["aileron"] }));
});
// elevator trim tab on the right elevator (anim: deflects with trim), ground-adjustable rudder tab
{
  const tz = Z(RIG_SPEC.trim.tabBl), hx = sLE(tz) - sC(tz) + 0.11;
  onSurf("elevR", V(hx, SY, tz), () => { const g = box(0.11, 0.008, 0.6); g.translate(-0.055, 0, 0); return g; }, {
    color: "#9F85E6", name: "Elevator trim tab", pin: true,
    note: "On the right elevator trailing edge (cutout in the right skins, POH 7-6). Driven by the actuator in the stabilizer through a push-pull rod. Travel up 22° / down 19° (TCDS). Forward wheel = nose down.",
    anim: (m) => { const t = RIG.surfaceAngles({ ...live.ctl, trim: live.afcs.trim }, 0).tab; m.rotation.z = t; },
  });
  onSurf("elevR", V(hx - 0.02, SY + 0.025, tz), () => box(0.02, 0.05, 0.01), { color: "#7C57CF", name: "Trim tab horn" });
}
onSurf("rudder", V(fLE(Y(49)) - fC(Y(49)) + 0.055, Y(49), 0), () => box(0.1, 0.13, 0.005), { color: "#8C99A3", name: "Rudder trim tab (ground adjustable)", note: "“A ground adjustable trim tab at the base of the trailing edge” (POH 7-6) — the only rudder trim. Bent on the ground to trim out a constant yaw.", ext: true, pin: true });
onSurf("rudder", V(fLE(Y(103.5)) - 0.12, Y(103.5), 0), () => box(0.12, 0.04, 0.03), { color: "#6E7A84", name: "Rudder balance weight", note: "In the leading-edge extension at the top of the rudder (horn balance, POH 7-6).", pin: true });
onSurf("rudder", V(fLE(Y(95)) - fC(Y(95)) - 0.04, Y(95), 0), () => cyl(0.004, 0.11, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true });

/* ---------- landing gear: wheelbase 65.0 in, main axles FS 58.2, nose axle FS −6.8 (POH 1-4, 6-21) ---------- */
export const MG = { fs: 58.2, bl: 50, h: 8.6 };
[1, -1].forEach((s) => {
  const top = P3(60.5, s * 14.5, 25.8), axle = P3(MG.fs, s * (MG.bl - 4.2), MG.h + 1.4);
  part(() => taperTubeGeo(top, axle, 1.1 * IN, 0.8 * IN), ["gear", "airframe"], { color: "#AEB6BC", name: "Main gear leg (spring steel)", note: "Tubular spring-steel main landing gear strut attached by a bulkhead and forgings at the base of the rear door posts (POH 7-5, 7-23). Jack pad in the step bracket (POH 8-10).", ext: true, pin: s > 0 });
  {
    // step bracket about a third of the way down the strut, on its aft side; it carries the jack pad (POH 8-10)
    const sb = V(...top).lerp(V(...axle), 0.36);
    part(() => box(0.1, 0.012, 0.09), ["gear", "cabin"], { pos: [sb.x - 0.05, sb.y + 0.01, sb.z], color: "#5C666E", name: "Main gear step bracket", note: "Step on each main gear strut; the individual-gear jack pad is built into it (POH 8-10). Jack one main wheel at a time — the strut flexes and the wheel slides inboard.", ext: true, pin: s > 0 });
  }
  part(() => cyl(8.75 * IN, 6 * IN, "z", 28), ["gear"], { pos: P3(MG.fs, s * MG.bl, MG.h), color: "#2A2F33", name: "Main wheel and tire", note: "6.00 × 6, 6-ply tube type, 42 PSI (POH 8-21). Wheel assembly arm FS 58.2.", ext: true, pin: s > 0 });
  part(() => wheelFairingGeo({ len: 36, height: 20, width: 11, axle: 0.47, lift: 1, cut: 3 - MG.h }), ["gear"], { pos: P3(MG.fs, s * (MG.bl - 0.7), MG.h), fairing: true, name: "Wheel fairing", note: "Speed fairings are standard (POH 7-23) and worth about 2 knots (POH v); removable per the KOEL.", ext: true, pin: s > 0, color: "#EEF1F3" });
  part(() => cyl(4.2 * IN, 0.25 * IN, "z", 24), ["gear"], { pos: P3(MG.fs, s * (MG.bl - 3.6), MG.h), color: "#9AA3AA", anim: brakeAnim(braking(s > 0 ? "R" : "L")), name: "Brake disc", note: "Single-disc, hydraulically actuated brake on the inboard side of each main wheel (POH 7-46, 7-23).", ext: true, pin: s > 0 });
  part(() => box(0.08, 0.06, 0.04), ["gear"], { pos: P3(MG.fs - 2, s * (MG.bl - 4.6), MG.h + 3), color: "#C8313B", name: "Brake caliper", note: "MIL-H-5606 fluid (POH 8-21). Fading, spongy pedals or dragging brakes: release and reapply hard; pump to build pressure (POH 7-46).", ext: true });
  part(() => tubeGeo([P3(9, s * 8, 27.5), P3(30, s * 11, 27), P3(55, s * 12, 27), P3(59.5, s * 14.5, 25.6), [top[0], top[1] - 0.01, top[2]], [axle[0] + 0.05, axle[1] + 0.05, axle[2] - s * 0.03]], 0.006), ["gear"], { name: "Brake line", note: "From the master cylinder on the pilot's pedal, down the gear leg to the wheel cylinder (POH 7-46)." });
});
export const NOSE: Vec3 = P3(-10, 0, 31);
/** The steering group pivots at the strut top; the axle sits below and slightly aft (trail). */
export const NOSE_CASTER: Vec3 = [0, 0, 0];
const NA: Vec3 = (() => { const a = P3(-6.8, 0, 7.1); return [a[0] - NOSE[0], a[1] - NOSE[1], 0]; })();
part(() => cyl(0.034, 0.2), ["gear"], { parent: "noseGear", pos: [0, -0.06, 0], color: "#AEB6BC", name: "Nose gear shock strut (oleo)", note: "Air/oil shock strut: MIL-H-5606 and 45 PSI with no load on the strut; about 2 in of strut shows in the normal ground attitude (POH 7-23, 8-21, 1-4).", ext: true, pin: true });
part(() => tubeGeo([[0, -0.15, 0], [NA[0] * 0.5, -0.4, 0], [NA[0], NA[1] + 0.02, 0]], 0.022), ["gear"], { parent: "caster", color: "#C9D0D5", name: "Nose gear fork and torque link", note: "Turns with the steering bungee: about 10° each side with the pedals, up to 30° with differential braking (POH 7-22).", ext: true });
part(() => cyl(7.1 * IN, 4.6 * IN, "z", 24), ["gear"], { parent: "caster", pos: NA, color: "#2A2F33", name: "Nose wheel and tire", note: "5.00 × 5, 6-ply tube type, 45 PSI; nose wheel arm FS −6.8 (POH 6-21, 8-21). Never turn more than 30° when towing (POH 7-22).", ext: true, pin: true });
part(() => wheelFairingGeo({ len: 32, height: 18, width: 9.5, axle: 0.47, lift: 1, cut: -4.5 }), ["gear"], { parent: "caster", pos: [NA[0], NA[1], 0], color: "#EEF1F3", fairing: true, name: "Nose wheel fairing", note: "Nose speed fairing, arm FS −3.5 (POH 6-21).", ext: true });
part(() => box(0.06, 0.03, 0.16), ["gear", "controls"], { parent: "caster", pos: [0.0, -0.02, 0], color: "#7C57CF", name: "Steering arm", note: "The spring-loaded steering bungees from the rudder bars attach here (POH 7-22).", chan: ["rudder"] });
part(() => box(0.06, 0.1, 0.03), ["gear"], { pos: P3(19, -12, 46), color: "#C8313B", name: "Parking brake handle", note: "Under the left side of the panel: set the brakes with the pedals, pull the handle aft and rotate it 90° down (POH 7-46). Don't set it in cold weather or with hot brakes (POH 8-9).", pin: true });
part(() => box(0.5, 0.04, 0.04), ["gear", "cabin"], { pos: P3(121, 9.5, 36), color: "#8C959C", name: "Tow bar (stowed)", note: "Stowed on the side of the baggage area, arm 124.0 (POH 6-20, 8-9). Without it, push on the wing struts — never on the tail surfaces.", pin: true });

/* ---------- propeller: McCauley 1A170E/JHA7660, 76 in, fixed pitch (POH 1-5) ---------- */
/** Blades between the spinner bulkheads (FS −40.8 / −37.3, POH 6-23), clear of the nose bowl face at about FS −37.4. */
export const PROP: Vec3 = P3(-39.6, 0, 49.25);
const bladeGeo = () => {
  const R = 38 * IN, sh = new THREE.Shape();
  sh.moveTo(-0.055, 0.1); sh.quadraticCurveTo(-0.075, R * 0.55, -0.04, R); sh.lineTo(0.025, R); sh.quadraticCurveTo(0.06, R * 0.5, 0.05, 0.1); sh.lineTo(-0.055, 0.1);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false }); g.translate(0, 0, -0.008); g.rotateY(Math.PI / 2 - 0.35); return g;
};
for (let i = 0; i < 2; i++) part(bladeGeo, ["propeller", "engine"], { parent: "blade:" + i, color: "#2E3439", name: "Propeller blade", note: "One-piece forged aluminum, anodized; fixed pitch, 2 blades, 76 in (75 in minimum) (POH 1-5, 2-6). Dress out nicks; never use alkaline cleaners (POH 8-24).", ext: true, pin: i === 0 });
part(() => cyl(0.055, 0.1, "x"), ["propeller"], { pos: P3(-35.5, 0, 49.25), color: "#8C959C", name: "Propeller spacer / hub", note: "3.5-inch spacer C5464 (arm −36.0) between the crankshaft flange and the propeller (POH 6-23). No governor: there is nothing to control the blade angle." });

/* ---------- engine: Lycoming IO-360-L2A, 180 BHP @ 2,700 RPM (POH 1-5) ---------- */
part(() => box(0.62, 0.3, 0.42), ["engine"], { pos: P3(-18.6, 0, 47.5), color: "#7E8890", name: "Lycoming IO-360-L2A", note: "Four-cylinder, horizontally opposed, fuel-injected, direct drive, air cooled, 360 cu in; 180 BHP at 2,700 RPM; wet sump (POH 1-5, 7-29). Engine CG FS −18.6 (POH 6-23).", pin: true });
part(() => box(0.5, 0.12, 0.34), ["engine"], { pos: P3(-18, 0, 38.5), color: "#B85A2A", name: "Oil sump", note: "Wet sump on the bottom of the engine: 8 qt capacity (9 total with the filter); never operate below 5 qt (POH 7-35, 1-7)." });
/** Cylinder positions (Lycoming numbering: 1 & 3 right, 2 & 4 left; the POH does not map numbers to positions). */
export const CYLS = [{ n: 1, fs: -27.5, s: 1 }, { n: 2, fs: -24, s: -1 }, { n: 3, fs: -15.5, s: 1 }, { n: 4, fs: -12, s: -1 }];
CYLS.forEach((c) => {
  const base = P3(c.fs, c.s * 11, 49.5);
  part(() => cyl(0.06, 0.2, "z", 18), ["engine"], { pos: base, color: "#7C858C", name: "Cylinder " + c.n, note: (c.s > 0 ? "Right" : "Left") + " bank. Baffles route cooling air down around the fins (POH 7-37). Numbering per Lycoming convention (not stated in the POH)." });
  for (let k = -2; k <= 2; k++) part(() => cyl(0.075, 0.008, "z", 18), ["engine"], { pos: [base[0], base[1], base[2] + c.s * k * 0.03], color: "#8C959C" });
  part(() => box(0.15, 0.15, 0.07), ["engine"], { pos: [base[0], base[1] + 0.01, base[2] + c.s * 0.12], color: "#6A737A", name: "Cylinder head " + c.n, note: "Two spark plugs; CHT thermocouple in the head, EGT probe in the exhaust riser (POH 7-34)." });
  ([["U", 0.055], ["L", -0.055]] as const).forEach(([pos, dy]) => {
    // POH 7-36: left magneto fires the upper left and lower right plugs; right magneto the lower left and upper right
    const mag = (c.s < 0) === (pos === "U") ? "L" : "R";
    part(() => cyl(0.014, 0.05, "x", 10), ["engine"], { pos: [base[0] - 0.09, base[1] + dy, base[2] + c.s * 0.12], color: "#DADFE2", anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`, note: `Fired by the ${mag === "L" ? "left" : "right"} magneto. “The left magneto fires the upper left and lower right spark plugs, and the right magneto fires the lower left and upper right” (POH 7-36).` });
  });
  part(() => box(0.03, 0.03, 0.03), ["engine"], { pos: [base[0] - 0.02, base[1] - 0.12, base[2] + c.s * 0.08], color: "#C9B98F", name: "Fuel injector nozzle", note: "Air-bleed nozzle in the intake valve chamber of each cylinder (POH 7-37)." });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: P3(-5.5, -5.5, 54), color: "#3E4A52", anim: magAnim(fires("L")), name: "Left magneto", note: "Fires the upper left and lower right plugs (POH 7-36). Rear accessory case.", pin: true });
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: P3(-5.5, 5.5, 54), color: "#3E4A52", anim: magAnim(fires("R")), name: "Right magneto", note: "Fires the lower left and upper right plugs (POH 7-36). Normal operation is BOTH; R and L are for checking and emergencies.", pin: true });
part(() => box(0.12, 0.1, 0.1), ["engine", "electrical"], { pos: P3(-33.5, -7, 42.5), color: "#4B5860", name: "Starter", note: "Front of the engine (POH 7-29). MAGNETOS to START with the MASTER on closes the starter contactor in the J-box. Crank 10 s, cool 20 s (POH 4-26).", pin: true });
part(() => cyl(0.04, 0.1, "x"), ["engine"], { pos: P3(-5, 0, 47.5), color: "#1F3A5A", name: "Oil filter (full flow)", note: "Rear of the accessory case; its adapter has a bypass valve for a plugged filter or very cold oil, and carries the oil temperature sensor (POH 7-35, 7-33).", pin: true });
part(() => box(0.06, 0.14, 0.18), ["engine"], { pos: P3(-11, 11, 54), color: "#9A6A48", name: "Oil cooler", note: "Thermostatically controlled remote cooler (POH 7-35); arm −11.0 (POH 6-24). The KAP 140 POH puts it on the right rear baffle." });
part(() => cyl(0.012, 0.18, "y"), ["engine"], { pos: P3(-8, 9, 52), color: "#E0B040", name: "Oil dipstick / filler", note: "Right rear of the engine through a door in the right cowl. Cap placard “OIL 8 QTS.” Fill to 8 qt for normal flights (POH 7-35, 2-26).", pin: true });
// on the outside of the crankcase box (BL ±8.27, top WL 53.4): sensors at their equipment-list arms; side and height are not in the POH
part(() => box(0.03, 0.03, 0.03), ["engine"], { pos: P3(-12.9, 8.92, 43), color: "#3A9448", name: "Oil pressure transducer", note: "Connected to the engine forward oil pressure port → OIL PRES on the EIS (POH 7-33); P165-5281, arm −12.9 (POH 6-24). Shown at that arm on the right side of the crankcase: the side and height are approximate (not in the POH). A separate low-pressure switch drives the red OIL PRESSURE annunciation at 0–20 PSI." });
part(() => box(0.025, 0.025, 0.025), ["engine"], { pos: P3(-10.9, 8.82, 43), color: "#E0263B", name: "Low oil pressure switch", note: "Independent of the transducer: OIL PRESSURE (red) at 0–20 PSI — shown before start (POH 7-33, 4-5). The Hobbs runs above 20 PSI (POH 7-13). The POH doesn't locate the switch: shown beside the transducer (approximate)." });
part(() => box(0.08, 0.06, 0.08), ["engine"], { pos: P3(-8, 0, 54.65), color: "#4B5860", name: "Tach sensor", note: "Speed sensor on the engine tachometer drive accessory pad, arm −8.0 → digital RPM to the GEA 71 (POH 7-31, 6-24). Shown on top of the rear accessory case between the magnetos; the pad's exact position is approximate (not in the POH)." });
// induction
part(() => box(0.06, 0.08, 0.2), ["engine"], { pos: P3(-36.5, 0, 37.8), color: "#1E2A33", name: "Induction air intake", note: "Ram air enters through an intake on the lower front of the cowl, through the air filter into the air box (POH 7-36).", ext: true, pin: true });
part(() => box(0.08, 0.1, 0.16), ["engine"], { pos: P3(-27.5, 0, 38), color: "#C9B98F", name: "Induction air filter", note: "Arm −27.5 (POH 6-23). Replace as condition warrants, 500 h maximum (POH 8-24). Ice on the filter costs RPM (POH 3-14).", pin: true });
part(() => box(0.1, 0.07, 0.03), ["engine"], { pos: P3(-23, -4.5, 37.5), color: "#E0B040", anim: altDoorAnim(X(-23)), name: "Alternate air door", note: "Spring-loaded door in the air box: if the filter blocks, engine suction opens it and draws unfiltered air from the lower cowl — about 10% power loss at full throttle (POH 7-36). No cockpit control.", pin: true });
part(() => cyl(0.05, 0.12, "x"), ["engine", "fuel"], { pos: P3(-20, 0, 36.5), color: "#7E8A93", name: "Fuel/air control unit (servo)", note: "Bottom of the engine: meters fuel in proportion to induction air flow; throttle and mixture act here. An orifice in its top feeds the fuel return line (POH 7-39, 7-44).", pin: true });
CYLS.forEach((c) => part(() => tubeGeo([P3(-20, 0, 37.5), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 11, 45.5)], 0.016), ["engine"], { color: "#8A969E", name: "Intake tube", note: "From the fuel/air control unit to each cylinder's intake port." }));
// exhaust and cabin heat
part(() => cyl(0.06, 0.34, "z"), ["engine", "environment"], { pos: P3(-22.7, 0, 33.5), color: "#8A5A3C", name: "Muffler", note: "Each cylinder's riser feeds one common muffler below the engine, then a single tailpipe (POH 7-37). Arm −22.7." });
part(() => cyl(0.078, 0.26, "z"), ["environment", "engine"], { pos: P3(-22.7, 0, 33.5), color: "#E0522B", fairing: true, name: "Muffler heater shroud", note: "Outside air flows through a shroud around the muffler and is heated for the cabin (POH 7-37). A muffler crack under the shroud can put CO in the cabin (POH 3-39).", pin: true });
// cooling
[1, -1].forEach((s) => {
  part(() => { const g = new THREE.TorusGeometry(0.056, 0.011, 8, 22); g.rotateY(Math.PI / 2); return g; }, ["engine", "airframe"], { pos: P3(-37.25, s * 10.2, 53.3), color: "#1E2A33", ext: true, pin: s > 0, name: "Cooling air inlet", note: "Two intake openings in the front of the cowl; baffles route the air down around the cylinders; it exits at the bottom aft edge of the cowl. No cowl flaps (POH 7-37)." });
  part(() => { const g = new THREE.CircleGeometry(0.056, 20); g.rotateY(Math.PI / 2); return g; }, ["engine", "airframe"], { pos: P3(-37.55, s * 10.2, 53.3), color: "#0B1014", ext: true });
});
part(() => box(0.05, 0.03, 0.42), ["engine"], { pos: P3(-1.5, 0, 25), color: "#1E2A33", name: "Cooling air exit", note: "Opening at the bottom aft edge of the cowl (POH 7-37). Point the airplane into the wind for long ground runs (POH 4-30).", ext: true });
part(() => box(0.32, 0.02, 0.5), ["engine"], { pos: P3(-19, 0, 58.5), color: "#B8BEC4", name: "Cylinder baffles", note: "Direct ram air from above the engine down around the cylinders (POH 7-37)." });
// engine mount
[1, -1].forEach((s) => [1, -1].forEach((u) => part(() => tubeGeo([P3(-0.5, s * 13, 49 + u * 9), P3(-9, s * 9, 47 + u * 4)], 0.009), ["engine", "airframe"], { color: "#5C6E7E", name: "Engine mount", note: "Welded tube mount bolted to the firewall at the four engine mount stringers (POH 7-5)." })));
// controls on the panel
part(() => cyl(0.016, 0.03, "x"), ["engine"], { pos: P3(18.6, 1.8, 47.5), color: "#1A1F23", anim: pushPull(X(18.6), () => S().eng.throttle), name: "Throttle (with friction lock)", note: "Smooth black push-pull knob below the standby instruments: in = FULL, out = IDLE. Friction lock at its base (POH 7-29). With a fixed-pitch prop it sets RPM directly.", pin: true });
part(() => cyl(0.016, 0.03, "x"), ["engine"], { pos: P3(18.6, 5.2, 47.5), color: "#C8313B", anim: pushPull(X(18.6), () => S().eng.mix), name: "Mixture (red, vernier)", note: "Red knob with raised points and a lock button: in = RICH, out = IDLE CUTOFF; rotate for fine adjustment (POH 7-29).", pin: true });
part(() => cyl(0.012, 0.025, "z"), ["engine", "electrical"], { pos: P3(17.9, -16, 49), color: "#C9D0D5", anim: (m) => { const k = S().eng.mags; m.rotation.z = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[k]; }, name: "MAGNETOS switch", note: "Rotary OFF – R – L – BOTH – START, spring-loaded from START back to BOTH (POH 7-36). The starter relay coil is fed through the WARN breaker.", pin: true });

/* ---------- structure ---------- */
part(() => planeRing(X(0)), ["airframe", "engine"], { plate: true, pin: true, name: "Firewall — FS 0 (datum)", note: "Reference datum: lower portion of the front face of the firewall (POH 2-9). Battery, J-box and external-power receptacle are on its left forward side." });
part(() => planeRing(X(108), 0.97), ["airframe", "cabin"], { plate: true, pin: true, name: "Aft baggage wall — FS 108", note: "End of baggage area A (FS 82–108, 120 lb). Area B runs to FS 142 (50 lb); A + B 120 lb maximum (POH 2-8, 6-13)." });
part(() => planeRing(X(142), 0.97), ["airframe", "cabin"], { plate: true, name: "Aft baggage wall — FS 142", note: "End of baggage area B. ELT and the remote avionics sit aft of the cabin partition." });
const FSPAR = 0.25, RSPAR = 0.68;
([[FSPAR, "Front carry-through spar", "The wings attach to front and rear carry-through spars across the cabin top (POH 7-5)."], [RSPAR, "Rear carry-through spar", "Rear carry-through spar at the rear door posts (POH 7-5)."]] as [number, string, string][]).forEach(([c, name, note]) =>
  part(() => tubeGeo([-21, 0, 21].map((b) => wingP(Z(b), c, 0)), 0.03), ["airframe"], { color: "#3D5A73", name, note, pin: true }));
[1, -1].forEach((s) => {
  part(() => tubeGeo([21, 60, 100, 140, 180, 205].map((b) => wingP(s * Z(b), FSPAR, 0)), 0.024), ["airframe"], { color: "#3D5A73", name: "Wing front spar", note: "Full-span front spar with the wing-to-fuselage and wing-to-strut attach fittings (POH 7-5).", pin: s > 0 });
  part(() => tubeGeo([21, 60, 100, 135].map((b) => wingP(s * Z(b), RSPAR, 0)), 0.018), ["airframe"], { color: "#3D5A73", name: "Wing rear spar (partial span)", note: "The aft spars are partial-span spars with wing-to-fuselage fittings (POH 7-5).", pin: s > 0 });
  // lift strut: base of the forward door post → front spar at about BL 99 (Fig 1-1)
  const lo = PV(onSkin(X(30), Y(29.5), s, 1.0)), hi = PV(wingP(s * Z(99), FSPAR, -1).add(V(0, -0.02, 0)));
  part(() => strutGeo(lo, hi, 0.15, 0.04), ["airframe"], { color: "#E9EDF0", name: "Wing strut", note: "One streamlined lift strut per side from the fitting at the base of the forward door post to the front spar (POH 7-5). Use the struts as push points when moving the airplane by hand (POH 7-22).", ext: true, pin: s > 0 });
  [lo, hi].forEach((p, i) => part(() => sph(0.03), ["airframe"], { pos: p, color: "#E0522B", name: i ? "Strut-to-wing fitting" : "Strut-to-fuselage fitting", note: i ? "On the wing front spar." : "Bulkhead with attach fittings at the base of the forward door post (POH 7-5).", ext: true }));
  part(() => tubeGeo([PV(onSkin(X(30.8), Y(30), s, 0.955)), PV(onSkin(X(31.6), Y(76), s, 0.955))], 0.012), ["airframe", "cabin"], { color: "#5C6E7E", name: "Forward door post", note: "Strut attach fitting at its base; aileron cables and fuel lines run inside it." });
  part(() => tubeGeo([PV(onSkin(X(65.3), Y(30), s, 0.955)), PV(onSkin(X(65.3), Y(76.5), s, 0.955))], 0.012), ["airframe", "cabin"], { color: "#5C6E7E", name: "Rear door post", note: "Main gear bulkhead and forgings at its base (POH 7-5)." });
  part(() => box(0.1, 0.05, 0.16), ["airframe", "gear"], { pos: P3(61, s * 13, 28), color: "#E0522B", name: "Main gear bulkhead / forging", note: "Takes the spring-steel main gear leg at the base of the rear door post (POH 7-5)." });
  part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], { pos: PV(wingP(s * Z(99), FSPAR + 0.08, -1).add(V(0, -0.03, 0))), color: "#8C959C", name: "Wing tiedown ring", note: "Wing, tail and nose tiedowns: 700 lb rope or chain (POH 8-10).", ext: true });
});
part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], { pos: P3(250, 0, 42.9), color: "#8C959C", name: "Tail tiedown ring", note: "Tail tiedown under the tailcone; the tail rests on it when the nose is raised (POH 8-10).", ext: true, pin: true });
[108, 142].forEach((fs, i) => part(() => cyl(0.012, 0.01, "z"), ["airframe"], { pos: PV(onSkin(X(fs), Y(52), -1, 1.01)), color: "#E0B040", name: "Leveling screws", note: "Left side of the tailcone at FS 108.00 and 142.00; lateral leveling uses the upper door sills (POH 6-4).", ext: true, pin: i === 0 }));
part(rearRoofGeo, ["airframe", "cabin"], { color: "#26323C", fairing: true, name: "Rear window", note: "Fixed wraparound rear window over the tailcone behind the wing; with the rear side windows it is not openable (POH 7-28).", ext: true });
[1, -1].forEach((s) => {
  // refueling steps and assist handles on the forward fuselage sides, arm 16.3 (POH 6-22 equipment list 53-01-S, walkaround 4-6 NOTE)
  part(() => box(0.1, 0.012, 0.05), ["airframe", "fuel"], { pos: PV(onSkin(X(16.3), Y(40), s, 1.0).add(V(0, 0, s * 0.02))), color: "#5C666E", name: "Refueling step", note: "Steps on both sides of the forward fuselage with an assist handle above; use them to reach the upper wing for fuel checks and refueling (POH 4-6).", ext: true, pin: s > 0 });
  part(() => tubeGeo([PV(onSkin(X(14.6), Y(57), s, 1.0)), PV(onSkin(X(15.5), Y(57.6), s, 1.0).add(V(0, 0, s * 0.03))), PV(onSkin(X(17.1), Y(57.6), s, 1.0).add(V(0, 0, s * 0.03))), PV(onSkin(X(18), Y(57), s, 1.0))], 0.007), ["airframe", "fuel"], { color: "#8C959C", name: "Assist handle", note: "Handle above the refueling step, arm 16.3 (POH 6-22).", ext: true, pin: s > 0 });
});
part(() => box(0.06, 0.04, 0.005), ["airframe", "cabin"], { pos: PV(onSkin(X(200), Y(52), -1, 1.01)), color: "#B8A46A", name: "Identification plate", note: "On the aft left tailcone; Finish and Trim plate on the lower left forward doorpost (POH 8-4).", ext: true });

/* ---------- cockpit: panel, pedestal, seats ---------- */
part(() => sectionSlab(X(16.8), Y(44.5), Y(67.2), 0.97, 0.035, X(16.8)), ["avionics", "cabin"], { color: "#2B3238", name: "Instrument panel", note: "Figure 7-2 Sheet 1 (serials 172S10656 thru 172S12700): PFD, audio panel, MFD; standby airspeed, attitude and altimeter below; switch and breaker panels lower left." });
part(() => sectionSlab(X(16.5), Y(66.2), Y(67.6), 0.97, 0.06, X(15.3)), ["cabin"], { color: "#20262B", name: "Glareshield", note: "Placard above the PFD: MANEUVERING SPEED: 105 KIAS (POH 2-26)." });
part(() => box(0.26, 0.5, 0.2), ["cabin", "fuel"], { pos: P3(20.5, 0, 35.5), color: "#39424A", fairing: true, name: "Center pedestal", note: "Elevator trim wheel and position indicator, fuel shutoff knob, fuel selector at its base, 12 V outlet, hand mic (POH 7-13)." });
([[42, -10, "Pilot seat", "Vertically adjusting crew seat: fore/aft handle under the center of the frame, height crank under the right corner, seat-back angle button (POH 7-24)."],
  [42, 10, "Front passenger seat", "Same as the pilot seat. Average occupant CG FS 37 (range 34–46) (POH 6-10)."],
  [79.5, 0, "Rear bench seat", "Fixed one-piece bottom, three-position reclining back; rear passengers FS 73 (POH 7-24, 6-13)."]] as [number, number, string, string][]).forEach(([fs, bl, name, note], i) => {
  const w = i === 2 ? 0.82 : 0.4;
  part(() => box(0.48, 0.1, w), ["cabin"], { pos: P3(fs, bl, 33), color: "#6B5A48", name, note, pin: true });
  part(() => box(0.09, 0.62, w * 0.92), ["cabin"], { pos: P3(fs + 10.5, bl, 45.5), rot: [0, 0, 0.18], color: "#6B5A48", name, note });
});

/* ---------- flight controls (POH Figure 7-1) ---------- */
const CTL = "#7C57CF", STEEL = "#8C959C";
export const YOKES = [{ side: "L", bl: -RIG_SPEC.yoke.bl }, { side: "R", bl: RIG_SPEC.yoke.bl }] as const;
YOKES.forEach(({ side }) => {
  const yk = "yoke:" + side, wh = "wheel:" + side, colLen = (RIG_SPEC.yoke.fs - RIG_SPEC.yoke.colFs) * IN;
  part(() => cyl(0.016, colLen, "x"), ["controls"], { parent: yk, pos: [colLen / 2, 0, 0], color: STEEL, chan: ["elevator", "aileron"], name: "Control column", note: "Passes through the instrument panel: slides fore/aft for pitch and turns for roll. Both columns are joined behind the panel (POH Fig. 7-1).", pin: side === "L" });
  part(() => { const g = new THREE.TorusGeometry(0.095, 0.014, 8, 28, Math.PI * 1.1); g.rotateZ(Math.PI * 1.45); g.rotateY(Math.PI / 2); return g; }, ["controls"], { parent: wh, color: "#20262B", chan: ["elevator", "aileron"], name: side === "L" ? "Pilot's control wheel" : "Copilot's control wheel", note: side === "L" ? "Left horn: microphone button, Control Wheel Steering (CWS), A/P TRIM DISC button and the split Manual Electric Trim switch; map light and rheostat underneath (POH 7-14, 7-61)." : "Dual controls, right seat: copilot control wheel at FS 26.0 (POH 6-21).", pin: true });
  part(() => box(0.03, 0.06, 0.06), ["controls"], { parent: wh, color: "#20262B", chan: ["elevator", "aileron"] });
});
// control-wheel switches (left horn of the pilot's wheel)
part(() => box(0.02, 0.02, 0.014), ["autopilot", "controls"], { parent: "wheel:L", pos: [0.0, 0.07, -0.085], color: "#C8313B", name: "A/P TRIM DISC button", note: "Disconnects the autopilot; press and hold to remove power from the trim motor and servos (CRG 113). Before takeoff: press, verify the AP disengages and the aural alert sounds (POH 4-16).", pin: true });
part(() => box(0.02, 0.016, 0.014), ["autopilot", "controls"], { parent: "wheel:L", pos: [0.0, 0.045, -0.095], color: "#E8ECEE", name: "CWS button", note: "Control Wheel Steering: immediately disconnects the pitch and roll servos while held; references resync on release (POH 7-71).", pin: true });
part(() => box(0.02, 0.03, 0.012), ["autopilot", "controls"], { parent: "wheel:L", pos: [-0.012, 0.02, -0.1], color: "#9F85E6", name: "Manual Electric Trim (MET) switch", note: "Split rocker: both halves must move together; drives the GFC 700 trim servo (MET). Unavailable with AFCS or PTRM shown (CRG 117). Max 163 KIAS (POH 2-21).", pin: true });
part(() => box(0.03, 0.01, 0.03), ["lighting"], { parent: "wheel:L", pos: [0.0, -0.06, -0.02], color: "#E8C46A", name: "Control wheel map light", note: "Under the pilot's wheel; turn NAV on, then set the knurled rheostat (POH 7-61). NAV LTS breaker, ELECTRICAL BUS 2.", pin: true });
part(() => box(0.03, 0.05, Z(RIG_SPEC.yoke.bl) * 2 + 0.04), ["controls"], { parent: "rig:cross", color: STEEL, chan: ["elevator", "aileron"], name: "Column interconnect", note: "Joins the two control columns behind the panel so both wheels move together (POH Fig. 7-1).", pin: true });
[-1, 1].forEach((s) => part(() => box(0.02, Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH), 0.02), ["controls"], { parent: "rig:cross", pos: [0, (Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH)) / 2, s * Z(RIG_SPEC.yoke.bl)], color: STEEL, chan: ["elevator"] }));
part(() => box(0.04, RIG_SPEC.elev.arm * IN * 3.2, 0.03), ["controls"], { parent: "rig:crank", color: CTL, chan: ["elevator"], name: "Elevator bellcrank (forward)", note: "Under the forward cabin floor: the link from the column interconnect rocks it, pulling one elevator cable and paying out the other (POH Fig. 7-1).", pin: true });
Object.entries(PULLEYS).forEach(([k, d]) => part(() => pulleyGeo(d.r, d.axis, d.double, d.gap), d.chan === "trim" ? ["controls", "autopilot"] : ["controls"], {
  chan: d.chan === "trim" ? ["elevator"] : [d.chan as Chan], parent: "rig:pul:" + k, color: k.startsWith("aw") ? CTL : "#A6AEB4", name: d.name, note: d.note, pin: true }));
(["L", "R"] as const).forEach((sd) => part(() => box(0.16, 0.012, 0.016), ["controls"], { parent: "rig:pul:aw" + sd, pos: [-0.04, -0.012, 0], color: STEEL, chan: ["aileron"] }));
// rudder bars and pedals (the pilot's pedals carry the brake master cylinders)
part(() => cyl(0.014, Z(RIG_SPEC.rud.half) * 2, "z"), ["controls", "gear"], { pos: P3(RIG_SPEC.rud.barFs, 0, RIG_SPEC.rud.barH), color: STEEL, chan: ["rudder"], name: "Rudder bars", note: "The interconnected rudder/brake pedals pivot on the rudder bars; the rudder cables and the nose-gear steering bungees attach to them (POH 7-22, 7-46).", pin: true });
[-16, -8, 8, 16].forEach((bl) => {
  const parent = bl < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.03, 0.17, 0.08), ["controls", "gear"], { parent, pos: P3(6.8, bl, 33), rot: [0, 0, 0.3], color: "#20262B", chan: ["rudder"], name: "Rudder / brake pedal", note: "Pedals steer the nosewheel through the bungee and move the rudder; toe pressure on the top applies that side's brake. Copilot pedals at FS 6.8 (POH 6-21)." });
  if (bl < 0) part(() => cyl(0.014, 0.1), ["gear"], { parent, pos: P3(5.5, bl, 29), color: STEEL, name: "Brake master cylinder", note: "One on each of the pilot's pedals; the copilot pedals act through the interconnect (POH 7-46)." });
});
// elevator bellcrank / torque tube in the tailcone, rudder horn, aileron horns
{
  const pv = surfacePivot("elevR"), arm = RIG_SPEC.elev.hornArm * IN;
  part(() => box(0.025, arm * 2.2, 0.025), ["controls"], { parent: "surf:elevR", pos: [0.02, 0, -pv[2] + 0.02], color: CTL, chan: ["elevator"], name: "Elevator bellcrank (tail)", note: "On the elevator torque tube: the up and down cables pull its upper and lower arms (POH 7-6, Fig. 7-1).", pin: true });
  part(() => cyl(0.012, Z(4) * 2, "z"), ["controls"], { parent: "surf:elevR", pos: [0, 0, -pv[2]], color: STEEL, chan: ["elevator"], name: "Elevator torque tube", note: "Joins both elevator halves on the hinge line." });
  const rv = surfacePivot("rudder"), hy = Y(RIG_SPEC.rud.hornH);
  part(() => box(0.03, 0.025, Z(RIG_SPEC.rud.hornArm) * 2), ["controls"], { parent: "surf:rudder", pos: [hingeX(hy) + 0.02 - rv[0], hy - rv[1], 0], color: CTL, chan: ["rudder"], name: "Rudder horn", note: "Bottom of the rudder: each rudder cable pulls one end (POH Fig. 7-1).", pin: true });
}
[1, -1].forEach((s) => { const sd = s > 0 ? "R" : "L", aw = PULLEYS["aw" + sd].c; onSurf("ail" + sd, [aw[0] - 0.16, aw[1] - 0.035, aw[2]], () => box(0.03, 0.04, 0.012), { color: CTL, name: "Aileron horn", note: "The push-pull rod from the bellcrank drives the aileron here." }); });
// trim wheel and indicator, trim actuator
part(() => { const g = new THREE.CylinderGeometry(RIG_SPEC.trim.r * IN, RIG_SPEC.trim.r * IN, 0.03, 28); g.rotateX(Math.PI / 2); return g; }, ["controls", "autopilot"], {
  parent: "rig:trimWheel", color: "#20262B", chan: ["elevator"], name: "Elevator trim wheel", pin: true,
  note: "Vertical wheel on the pedestal: forward = nose down, aft = nose up (POH 7-7). It turns when the GFC 700 trim servo runs (MET or autotrim) because the servo drives the same cable (Fig. 7-10).",
});
part(() => box(0.012, 0.012, 0.035), ["controls", "autopilot"], { parent: "rig:trimWheel", pos: [0, RIG_SPEC.trim.r * IN, 0], color: "#E8ECEE", chan: ["elevator"] });
part(() => box(0.01, 0.02, 0.01), ["controls"], { pos: P3(25.8, 2.6, 37.5), color: "#FFFFFF", chan: ["elevator"], anim: (m) => { m.position.y = Y(37.5) + live.afcs.trim * 0.04; },
  name: "Trim position indicator", note: "Pointer beside the wheel; TAKEOFF when it lines up with the index mark on the pedestal cover (POH 4-31). Required for all operations (KOEL)." });
part(() => box(0.06, 0.035, 0.05), ["controls"], { pos: RIG.p3(RIG_SPEC.trim.actuator), color: CTL, chan: ["elevator"], name: "Elevator trim tab actuator", note: "Inside the horizontal stabilizer (POH 7-6); driven by the trim cable, it pushes the tab through a push-pull rod.", pin: true });
(["elUp", "elDn", "rudL", "rudR", "trim"] as const).forEach((k, i) => {
  const c = RIG.cable(k).pts, a = c[c.length - 3], b = c[c.length - 2];
  part(() => cyl(0.008, 0.06, "x"), ["controls"], { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color: "#C9B98F", chan: chanOfKey(k === "trim" ? "el" : k), name: "Turnbuckle", note: "Sets cable tension; safety-wired after rigging.", pin: i === 0 });
});
part(() => cyl(0.006, 0.22, "x"), ["controls", "cabin"], { pos: P3(18.5, -13.5, 59), color: "#C8313B", anim: (m) => { m.visible = S().cabin.lock; }, name: "Control lock", note: "Steel rod and flag through the pilot's column shaft and collar: ailerons neutral, elevator slightly TE down; the flag covers the ignition switch. “CAUTION! CONTROL LOCK REMOVE BEFORE STARTING ENGINE” (POH 7-28, 2-23).", pin: true });

/* ---------- autopilot: GFC 700 servos and controls ---------- */
/** Servos drive only while engaged and not released by CWS; the trim servo needs the AUTO PILOT breaker (no AFCS failure). */
const apEngaged = () => gfc700Engaged(live.afcs);
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], { pos: RIG.p3(RIG_SPEC.servo.roll), color: "#C8399F", chan: ["aileron"], anim: glowAnim("#C8399F", apEngaged, ["autopilot", "controls"], "#FF7BE0"), name: "GFC 700 roll servo", note: "Arm 59.5 (POH 6-19); drives the aileron system through a bridle cable and slip clutch — the pilot can overpower it (POH 4-16). Lateral position assumed.", pin: true });
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], { pos: RIG.p3(RIG_SPEC.servo.pitch), color: "#C8399F", chan: ["elevator"], anim: glowAnim("#C8399F", apEngaged, ["autopilot", "controls"], "#FF7BE0"), name: "GFC 700 pitch servo", note: "In the tailcone at FS 180.7 (POH 6-19): bridle on the elevator cables.", pin: true });
part(() => cyl(0.045, 0.1, "z"), ["autopilot", "controls"], { pos: RIG.p3(RIG_SPEC.servo.trim), color: "#C8399F", chan: ["elevator"], anim: glowAnim("#C8399F", () => live.afcs.powered && live.afcs.pft === "pass" && !live.afcs.fail.sys, ["autopilot"], "#FF7BE0"), name: "GFC 700 pitch trim servo", note: "FS 180.7: drives the elevator trim cable (MET and autotrim) — so the cockpit trim wheel turns too (POH Fig. 7-10).", pin: true });
part(() => box(0.02, 0.022, 0.022), ["autopilot"], { pos: P3(18.3, -2.2, 48.8), color: "#20262B", name: "GA button", note: "Go-around button left of the throttle, below ALT STATIC AIR (Fig. 7-2 item 27): on the ground TO, in the air GA — disengages the AP, wings level and a fixed pitch-up (CRG 21–22).", pin: true });
([[-11.5, "PFD bezel AFCS keys"], [10.5, "MFD bezel AFCS keys"]] as [number, string][]).forEach(([bl, name], i) => part(() => box(0.012, 0.11, 0.04), ["autopilot", "avionics"], { pos: P3(18.4, bl - 5.3, 59), color: "#2A2F33", name, note: "AP FD / HDG ALT / NAV VNV / APR BC / VS FLC / NOSE UP NOSE DN on the left bezel of both GDUs — “push AP button on either PFD or MFD bezel” (POH 4-16).", pin: i === 0 }));

export { onSurf, PV };
