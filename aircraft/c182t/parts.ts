/**
 * Declarative catalogue of the C182T NAV III, part 1 (POH 182TPHAUS-04 Rev 4 + Supplement 3); the systems parts are in
 * parts-systems.ts.
 * Positions use the POH stations through `P3(FS, BL, h)` (inches → metres, see geometry.ts). Equipment-list arms (POH Figure 6-9)
 * place most items fore/aft; butt lines and heights are not in the POH and are placed from the descriptions ("left forward side
 * of the firewall", "tailcone", …), Figure 7-2 and photos.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { Chan, SysId } from "@/lib/systems";
import {
  AF, AIL_C, BL, EF, FLAP_C, HF, HZ, SY, X, Y, Z, box, cyl, finCut, finSec, fLE, fC, hingeX, loft, onSkin, paintSkin,
  planeRing, rearRoofGeo, sC, sLE, sectionSlab, sided, sph, stabSec, strutGeo, taperTubeGeo, tubeGeo, wC, wLE, wheelFairingGeo, wingP, wingSec, wY,
} from "./geometry";
import { live } from "./model";
import { AFT_CRANK, PULLEYS, RIG, RIG_SPEC, RUD_TRIM } from "./rig";
import { useC182 } from "./store";
import { IN } from "../cessna/airframe";
import { brakeAnim, magAnim, plugAnim, pushPull, sparkPhase } from "../cessna/anims";
import { pulleyGeo } from "../cessna/rig";

/** POH station → scene position: FS (in aft of datum), BL (in right), h (in above ground). */
export const P3 = (fs: number, bl: number, h: number): Vec3 => [X(fs), Y(h), Z(bl)];
/** Vector3 → Vec3. */
export const PV = AF.P;

/**
 * Pinned parts that stay in a view's "tap to locate" list but carry no label pin there, so each view shows about a dozen labels
 * instead of piling them up around the firewall, the cockpit and the tail.
 */
const QUIET: Partial<Record<SysId, string[]>> = {
  airframe: ["Refueling step", "Assist handle", "Leveling screws", "Tail tiedown ring", "Strut-to-wing fitting", "Identification plate", "Rear window", "Wing tiedown ring",
    "Strut-to-fuselage fitting", "Engine mount", "Main gear leg (spring steel)", "Wing rear spar (partial span)", "Rear carry-through spar"],
  controls: ["Static discharger", "Elevator balance weight", "Aileron balance weights", "Rudder balance weight", "Control column", "Copilot's control wheel",
    "A/P DISC/TRIM INT switch", "Manual electric trim (MET) switches", "Column interconnect", "Elevator cable pulleys (forward)", "Elevator cable pulleys",
    "Aileron cable pulley (lower forward cabin)", "Aileron door-post pulley", "Rudder cable pulley", "Elevator trim cable pulley", "Turnbuckle", "Control lock",
    "KS 271C roll servo", "KS-270C pitch servo", "KS-272C pitch trim servo", "Elevator trim tab actuator", "Rudder horn", "Trim position indicator", "Rudder trim indicator",
    "Elevator downspring", "Aileron horn", "Elevator bellcrank (forward)", "Rudder bars", "Steering arm", "Elevator arm"],
  cabin: ["Main gear step bracket", "Tow bar (stowed)", "Aft cabin wall — FS 134", "Front passenger seat", "Control lock", "Stall warning horn", "Baggage area C (shelf)",
    "Courtesy light (under wing)", "ELT remote switch", "Hour (Hobbs) meter", "Inertia reel (front seat)", "Openable door window", "Baggage area A (FS 82–109)"],
  // the lever and indicator are in the cockpit, out of this view's frame (pins aren't depth-tested): listed, not labelled
  flaps: ["Flap bellcrank", "Wing flap switch lever", "Flap position indicator"],
  gear: ["Brake disc", "Rudder bars", "Main gear step bracket", "Steering arm", "Nose gear fork and torque link", "Wheel fairing"],
  environment: ["CABIN AIR knob", "Cabin manifold", "DEFROST knob"],
  engine: ["Propeller blade", "Oil dipstick / filler", "Induction air intake", "Cooling air inlet", "MAGNETOS switch", "Firewall — FS 0 (datum)",
    "Fuel flow transducer", "Fuel distribution unit (flow divider)", "GEA 71 engine/airframe unit", "Engine-driven vacuum pump", "Hour (Hobbs) meter", "Mixture (red, vernier)",
    "Throttle (with friction lock)", "Left magneto", "Engine-driven fuel pump", "Fuel/air control unit (servo)", "Propeller governor", "Cylinder head 1", "Tach sensor",
    "Oil pressure transducer", "Manifold pressure transducer", "PROPELLER control (blue)", "Engine mount",
    "Induction air filter", "Alternator — 28 V, 60 A"],
  fuel: ["Refueling step", "Assist handle", "Fuel vent interconnect", "Fuel quantity transmitter", "Tank outlet screen", "Fuel flow transducer",
    "Fuel distribution unit (flow divider)", "Fuel return line drain", "Fuel manifold (aft door post)", "Fuel strainer",
    "Fuel/air control unit (servo)"],
  electrical: ["MAGNETOS switch", "Flap motor and actuator", "Auxiliary fuel pump", "Alternator Control Unit (ACU)", "STBY BATT switch", "AVIONICS switch (BUS 1 | BUS 2)",
    "Switch panel", "Forward avionics cooling fan", "Aft avionics cooling fan", "Circuit breaker panel (BUS 1 · BUS 2 · X-FEED)", "MASTER switch (ALT | BAT)", "Starter", "External power receptacle",
    "Circuit breaker panel (ESS · AVN 1 · AVN 2)"],
  lighting: ["Switch panel", "Flood light", "Overhead console", "Rear dome light", "Taxi light", "DIMMING panel"],
  avionics: ["AVIONICS switch (BUS 1 | BUS 2)", "DISPLAY BACKUP button", "Forward avionics cooling fan", "Aft avionics cooling fan", "COM 2 / GPS 2 / XM antenna",
    "VOR/GS navigation antenna", "Marker beacon antenna", "Transponder antenna", "OAT probe (GTP 59)", "GEA 71 engine/airframe unit", "GIA 63 #2",
    "DC turn coordinator (KAP 140)", "Magnetic compass (non-stabilized)", "GDC 74A air data computer", "KAP 140 flight computer",
    "GMU 44 magnetometer", "COM 1 / GPS 1 antenna"],
  autopilot: ["Elevator trim cable pulley", "GIA 63 #2", "Manual electric trim (MET) switches", "Trim position indicator", "Elevator trim tab", "KAP 140 flight computer",
    "DC turn coordinator (KAP 140)", "KS-272C pitch trim servo"],
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
export { surfacePivot };
const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) => CAT.shell(geo, name, note, skin ? paintSkin : undefined);

/* ---------- per-frame part animations ---------- */
const S = () => useC182.getState().s;
/** The magneto is firing: engine turning, its key position on, and not failed. */
const fires = (mag: "R" | "L") => () => {
  const e = S().eng, k = e.mags;
  return live.rpm > 150 && (k === "BOTH" || k === "START" || k === mag) && !(mag === "L" ? e.fail.magL : e.fail.magR);
};
/** Toe brake (differential) or parking brake on one side, 0..1. */
const braking = (side: "R" | "L") => () => { const g = S().gear; return g.park ? 0.6 : side === "R" ? Math.max(0, g.diff) : Math.max(0, -g.diff); };
const altDoorAnim = (x0: number): PartAnim => (m) => { m.rotation.z = S().eng.filter ? -0.6 : 0; m.position.x = x0; };
const fairingAnim: PartAnim = (m) => { m.visible = S().gear.fairings; };

/* ---------- airframe shells ---------- */
shell(fuselageGeoOf(), "Fuselage", "All-metal semimonocoque: formed bulkheads, stringers and skin. Front and rear carry-through spars take the wings; a bulkhead and forgings at the base of the rear door posts take the main gear; a bulkhead with fittings at the base of the forward door posts takes the struts; four engine mount stringers run from the forward door posts to the firewall (POH 7-5).", true);
function fuselageGeoOf() { return AF.fuselageGeo; }
shell(() => {
  // long pointed spinner: tip FS −64 (scaled from Fig 1-1), base ≈ FS −44.5, D-7261-2 (arm −49.9, POH 6-24)
  const pts: THREE.Vector2[] = [], L = 19.6 * IN, R = 8.2 * IN;
  for (let i = 0; i <= 22; i++) { const t = i / 22; pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.pow(1 - t, 0.62) * (1 - 0.05 * t)), t * L)); }
  const g = new THREE.LatheGeometry(pts, 36); g.rotateZ(-Math.PI / 2); g.translate(X(-44.4), 0, 0); return g;
}, "Spinner", "D-7261-2 spinner, arm −49.9 (POH 6-24), over the oil-filled hub of the McCauley constant-speed propeller. Preflight: “Propeller and Spinner — CHECK (for nicks, security and no red oil leaks)” (POH 4-10).");

const ailS = [BL.ail0, 125, 150, 175, 195, BL.ail1];
const tipS = [BL.ail1, 209.5, 211, 212.2, 213];
[1, -1].forEach((s) => {
  const side = s > 0 ? "Right" : "Left";
  const zs = (bls: number[]) => bls.map((b) => Z(b));
  shell(() => loft(sided(zs([0, 10, BL.flap0, 40, 60, 80, BL.flap1, BL.ail0]).map((z) => wingSec(s * z, 0, FLAP_C)), s)), side + " wing",
    "Externally braced wing with an integral fuel tank: front and rear spar, formed ribs, doublers and stringers, aluminum skin. The front spar has the wing-to-fuselage and wing-to-strut fittings; the rear spar is partial span (POH 7-5). Constant chord inboard, tapered outboard panel.");
  shell(() => loft(sided(zs([...ailS, ...tipS.slice(1)]).map((z) => wingSec(s * z, 0, AIL_C)), s)), side + " wing", "Outboard tapered panel carrying the aileron and the wing-tip lights.");
  shell(() => loft(sided(zs([0, 10, BL.flap0]).map((z) => wingSec(s * z, FLAP_C, 1)), s)), "Wing root trailing edge", "");
  shell(() => loft(sided(zs([BL.flap1, BL.ail0]).map((z) => wingSec(s * z, FLAP_C, 1)), s)), "Wing trailing edge", "");
  shell(() => loft(sided(zs(tipS).map((z) => wingSec(s * z, AIL_C, 1)), s)), "Wing tip", "Slightly down-turned fiberglass tip carrying the position light and the strobe (POH 7-57, Fig 1-1).");
  shell(() => loft(sided([...[0, 0.12, 0.3, 0.5, 0.75, 1.0].map((b) => stabSec(s * Z(b * (HZ - 0.05)), 0, EF)), ...[HZ, 64.5, 66.8, 68.4, 69.4, 70].map((b) => stabSec(s * Z(b), 0, HF))], s)),
    "Horizontal stabilizer", "Forward and aft spar, ribs and stiffeners, centre upper and lower skins and two left and two right wraparound skins that form the leading edges. It also contains the elevator trim tab actuator (POH 7-6). Span 11'-8\" (POH 1-3).");
});
const finHs = [46.5, 54, 61.8, 63, 64.3, 66, 69.5, 74.2, 80, 85, 92, 100, 106, 108.4, 109.6].map(Y);
shell(() => loft(finHs.map((h) => finSec(h, 0, finCut(h)))), "Vertical stabilizer", "Forward and aft spar, formed ribs and reinforcements, four skin panels, formed leading-edge skins and a dorsal fin (POH 7-5). The rudder hinges on its aft spar.");

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
  surface("flap" + side, () => sided(fz.map((z) => wingSec(s * z, FLAP_C, 1)), s), hp(s, BL.flap0, FLAP_C - 0.01, 0.075), hp(s, BL.flap1, FLAP_C - 0.01, 0.075), ["flaps", "controls"],
    Side + " flap", "Single-slot flap, built like the ailerons but without balance weights and with a formed leading edge (POH 7-5). UP, 10°, 20°, FULL — 38° per TCDS 3A13 (the POH never gives the FULL angle).");
  surface("ail" + side, () => sided(az.map((z) => wingSec(s * z, AIL_C, 1)), s), hp(s, BL.ail0, AIL_C + 0.02), hp(s, BL.ail1, AIL_C + 0.02), ["controls"],
    Side + " aileron", "Conventional hinged aileron: forward spar with balance weights, formed ribs and “V” corrugated skins (POH 7-5). Travel up 20° / down 15° ±2° (TCDS 3A13).");
  const ez = [2.5, 20, 40, HZ - 0.05].map(Z);
  surface("elev" + side, () => sided([...ez.map((z) => stabSec(s * z, EF, 1)), ...[HZ, 64.5, 66.8, 68.4, 69.4, 70].map((b) => stabSec(s * Z(b), HF, 1))], s),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]), V(sLE(Z(HZ)) - EF * sC(Z(HZ)), SY, s * Z(HZ)), ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)", "Formed leading-edge skins, forward spar, ribs, torque tube and bellcrank, “V” corrugated skins; both tip leading-edge extensions carry balance weights (POH 7-6). Travel up 28° / down 21° ±1° (TCDS 3A13)." + (s > 0 ? " The right half's skins have the trim-tab cutout." : ""));
});
surface("rudder", () => [46.5, 54, 61.8, 66, 74.2, 85, 95, 100, 106, 108.4].map(Y).map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(Y(46.5)), Y(46.5), 0), V(hingeX(Y(106)), Y(106), 0), ["controls"],
  "Rudder", "Forward and aft spar, formed ribs, a wraparound skin; the top has a leading-edge extension with a balance weight (POH 7-6). Travel 24° each way measured parallel to WL 0 (TCDS 3A13). Rudder trim acts through a bungee on the rudder bars, not a tab.");

/** Part riding on a control surface; `world` is converted to hinge-relative coordinates. */
export function onSurf(key: string, world: THREE.Vector3 | Vec3, geo: () => THREE.BufferGeometry, o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] }) {
  const pv = surfacePivot(key), w = Array.isArray(world) ? V(...world) : world;
  part(geo, o.sys || ["controls"], { chan: chanOfKey(key), ...o, parent: "surf:" + key, pos: [w.x - pv[0], w.y - pv[1], w.z - pv[2]] });
}

/* ---------- surface details ---------- */
const WICK = "Static discharger: bleeds static charge off the trailing edges to cut radio noise. Set of 10, arm 152.9 (POH 6-20); check them at every annual (POH 7-73).";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * Z(195), 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true, pin: s > 0 });
  onSurf("elev" + side, V(sLE(Z(52)) - sC(Z(52)) - 0.05, SY, s * Z(52)), () => cyl(0.004, 0.11, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true });
  onSurf("elev" + side, V(sLE(Z(66)) - 0.05, SY, s * Z(66)), () => box(0.08, 0.03, 0.12), { color: "#6E7A84", name: "Elevator balance weight", note: "In each elevator tip leading-edge extension ahead of the hinge (horn balance): reduces control forces and prevents flutter (POH 7-6).", pin: s > 0 });
  onSurf("ail" + side, wingP(s * Z(150), AIL_C + 0.035, 0), () => box(0.05, 0.025, 0.5), { color: "#6E7A84", name: "Aileron balance weights", note: "Carried in the aileron forward spar (POH 7-5).", pin: s > 0 });
  [32, 62, 94].forEach((b, i) => part(() => box(0.32, 0.05, 0.03), ["flaps"], { pos: PV(wingP(s * Z(b), 0.72, -1).add(V(-0.03, -0.03, 0))), color: "#B9C1C7", name: "Flap track and rollers", note: "The flap rolls aft and down along curved tracks as it extends, opening the slot (single-slot flap, POH 7-20).", ext: true, pin: s > 0 && i === 0 }));
  [118, 165, 202].forEach((b) => part(() => box(0.2, 0.035, 0.022), ["controls"], { pos: PV(wingP(s * Z(b), 0.78, -1).add(V(-0.01, -0.012, 0))), color: "#C9D0D5", name: "Aileron hinge", note: "Aileron hinge bracket on the rear spar.", ext: true, chan: ["aileron"] }));
});
// elevator trim tab on the right elevator (deflects with trim: tab UP for nose-down trim, DOWN for nose-up — S3-22, S3-23)
{
  const tz = Z(RIG_SPEC.trim.tabBl), hx = sLE(tz) - sC(tz) + 0.12;
  onSurf("elevR", V(hx, SY, tz), () => { const g = box(0.12, 0.008, 0.62); g.translate(-0.06, 0, 0); return g; }, {
    color: "#9F85E6", name: "Elevator trim tab", pin: true, sys: ["controls", "autopilot"],
    note: "In the trailing-edge cutout of the RIGHT elevator: spar, rib and “V” corrugated skins (POH 7-6). Driven by the actuator in the stabilizer through a push-pull rod. Moves UP with nose-down trim and DOWN with nose-up trim (S3-22). Travel 24° up / 15° down (TCDS).",
    anim: (m) => { m.rotation.z = RIG.surfaceAngles({ ...live.ctl, trim: live.kap.trim }, 0).tab; },
  });
  onSurf("elevR", V(hx - 0.02, SY + 0.025, tz), () => box(0.02, 0.05, 0.01), { color: "#7C57CF", name: "Trim tab horn" });
}
onSurf("rudder", V(fLE(Y(108)) - 0.1, Y(108), 0), () => box(0.12, 0.035, 0.03), { color: "#6E7A84", name: "Rudder balance weight", note: "In the leading-edge extension at the top of the rudder (horn balance, POH 7-6).", pin: true });
onSurf("rudder", V(fLE(Y(98)) - fC(Y(98)) - 0.04, Y(98), 0), () => cyl(0.004, 0.11, "x", 6), { color: "#2A2F33", name: "Static discharger", note: WICK, ext: true });

/* ---------- landing gear: track 9'-0" (POH 1-3), wheelbase 66.5 in, main axles FS 58.9, nose axle ≈ FS −7.6 (POH 1-4, 6-22) ---------- */
export const MG = { fs: 58.9, bl: 54, h: 8.7 };
[1, -1].forEach((s) => {
  const top = P3(64.8, s * 17.5, 23.6), axle = P3(MG.fs, s * (MG.bl - 4.4), MG.h + 1.4);
  part(() => taperTubeGeo(top, axle, 1.2 * IN, 0.85 * IN), ["gear", "airframe"], { color: "#AEB6BC", name: "Main gear leg (spring steel)", note: "Tubular spring-steel main landing gear strut, attached by a bulkhead and forgings at the base of the rear door posts (FS 65.30) (POH 7-5, 7-21). Its step bracket has the jack pad (POH 8-10).", ext: true, pin: s > 0 });
  {
    const sb = V(...top).lerp(V(...axle), 0.34);
    part(() => box(0.1, 0.012, 0.09), ["gear", "cabin"], { pos: [sb.x - 0.05, sb.y + 0.01, sb.z], color: "#5C666E", name: "Main gear step bracket", note: "Step on each main gear strut; its jack pad lets one main wheel be jacked at a time — the strut flexes and the wheel slides inboard. Don't jack both mains at once (POH 8-10).", ext: true, pin: s > 0 });
  }
  part(() => cyl(8.75 * IN, 6 * IN, "z", 28), ["gear"], { pos: P3(MG.fs, s * MG.bl, MG.h), color: "#2A2F33", name: "Main wheel and tire", note: "6.00-6, 6-ply rated, 42 PSI, with tube; Cleveland 40-75B wheel, arm 58.9 (POH 8-21, 6-22).", ext: true, pin: s > 0 });
  part(() => wheelFairingGeo({ len: 38, height: 20, width: 11, axle: 0.42, lift: 0.6, cut: 3.2 - MG.h, tail: 1.1 }), ["gear"], { pos: P3(MG.fs, s * (MG.bl - 0.8), MG.h), color: "#EEF1F3", anim: fairingAnim, fairing: true, name: "Wheel fairing", note: "Main fairings, set of 2, arm 60.6 (equipment item 32-03-A). Optional in the 2005 POH (standard in 2007); worth ≈ 3 knots (POH v, 7-21). Whether N8050J and N21200 carry them: check the airplanes — toggle them in the Gear panel.", ext: true, pin: s > 0 });
  part(() => cyl(4.4 * IN, 0.25 * IN, "z", 24), ["gear"], { pos: P3(MG.fs, s * (MG.bl - 3.8), MG.h), color: "#9AA3AA", anim: brakeAnim(braking(s > 0 ? "R" : "L")), name: "Brake disc", note: "Single-disc, hydraulically actuated brake on the inboard side of each main wheel; Cleveland 30-52, arm 55.5 (POH 7-46, 7-21, 6-22).", ext: true, pin: s > 0 });
  part(() => box(0.08, 0.06, 0.04), ["gear"], { pos: P3(MG.fs - 2.5, s * (MG.bl - 4.8), MG.h + 3), color: "#C8313B", name: "Brake caliper", note: "MIL-H-5606 fluid (POH 8-21). Fading, noisy or dragging brakes, soft or spongy pedals: release and reapply hard; pump to build pressure; with one brake weak use the other sparingly with opposite rudder (POH 7-46).", ext: true });
  part(() => tubeGeo([P3(8.5, s * 8, 27.2), P3(30, s * 11, 26.4), P3(55, s * 13, 25.6), P3(63.5, s * 16.5, 24.0), [top[0], top[1] - 0.01, top[2]], [axle[0] + 0.05, axle[1] + 0.05, axle[2] - s * 0.03]], 0.006), ["gear"], { name: "Brake line", note: "From the master cylinder on each of the pilot's pedals, down the gear leg to the wheel cylinder (POH 7-46)." });
});
/** Top of the nose strut inside the cowl. The strut rakes forward: the axle (FS −7.6, which keeps the POH 66.5 in wheelbase) sits about
 *  4.6 in ahead of where the strut leaves the cowl (182T photos). The noseGear group is tilted by NOSE_RAKE so its y axis runs
 *  down the strut and the steering turns about the strut. */
export const NOSE: Vec3 = P3(-3, 0, 30.5);
const AXLE: Vec3 = P3(-7.6, 0, 7.1);
export const NOSE_RAKE = Math.atan2(AXLE[0] - NOSE[0], NOSE[1] - AXLE[1]);
/** The steering group pivots at the strut top, about the strut axis. */
export const NOSE_CASTER: Vec3 = [0, 0, 0];
/** Axle in the strut frame (on the strut line). */
const NA: Vec3 = [0, -Math.hypot(AXLE[0] - NOSE[0], AXLE[1] - NOSE[1]), 0];
part(() => cyl(0.036, 0.22), ["gear"], { parent: "noseGear", pos: [0, -0.07, 0], color: "#AEB6BC", name: "Nose gear shock strut (air/oil)", note: "Air/oil shock strut: MIL-H-5606 and 55–60 PSI with no load on the strut; about 2 in of strut shows in the normal ground attitude (POH 7-21, 8-21, 1-4). A deflated strut raises the tail when towing (POH 8-9).", ext: true, pin: true });
// fork: a stem from the strut down to a crown above the tire, two legs either side of the wheel to the axle
[1, -1].forEach((s) => part(() => tubeGeo([[0, NA[1] + 0.21, s * 0.075], [0, NA[1], s * 0.075]], 0.012), ["gear"], { parent: "caster", color: "#C9D0D5" }));
part(() => box(0.035, 0.03, 0.17), ["gear"], { parent: "caster", pos: [0, NA[1] + 0.215, 0], color: "#C9D0D5" });
part(() => tubeGeo([[0, -0.16, 0], [0.01, NA[1] * 0.55, 0], [0, NA[1] + 0.22, 0]], 0.022), ["gear"], { parent: "caster", color: "#C9D0D5", name: "Nose gear fork and torque link", note: "Turns with the steering bungee: about 11° each side with the pedals, up to 29° with differential braking (POH 7-19).", ext: true, pin: true });
part(() => cyl(7.1 * IN, 5 * IN, "z", 24), ["gear"], { parent: "caster", pos: NA, color: "#2A2F33", name: "Nose wheel and tire", note: "5.00-5, 6-ply rated, 49 PSI, with tube; Cleveland 40-77 wheel, arm −7.1 (POH 8-21, 6-22). Never turn it more than 29° either side when towing (POH 7-19).", ext: true, pin: true });
part(() => wheelFairingGeo({ len: 32, height: 16, width: 8.5, axle: 0.42, lift: 0.6, cut: -4.6, tail: 1.1 }), ["gear"], { parent: "caster", pos: [NA[0], NA[1], 0], rot: [0, 0, -NOSE_RAKE], color: "#EEF1F3", anim: fairingAnim, fairing: true, name: "Nose wheel fairing", note: "Nose speed fairing, arm −6.0 (equipment item 32-03-A, optional in 2005). Check fairings for mud, snow or slush (POH 4-26).", ext: true });
part(() => box(0.06, 0.03, 0.16), ["gear", "controls"], { parent: "caster", pos: [0.0, -0.02, 0], color: "#7C57CF", name: "Steering arm", note: "The spring-loaded steering bungees from the rudder bars attach here (POH 7-19).", chan: ["rudder"], pin: true });
part(() => box(0.06, 0.03, 0.1), ["gear"], { pos: P3(18.6, -13.5, 40.4), color: "#C8313B", name: "Parking brake handle", note: "Under the left side of the panel (Fig 7-2 item 37): set the brakes with the pedals, pull the handle aft and rotate it 90° down (POH 7-46). Not in cold weather with moisture, nor with hot brakes (POH 8-9).", pin: true });
part(() => box(0.5, 0.04, 0.04), ["gear", "cabin"], { pos: P3(108, 11.5, 36), color: "#8C959C", name: "Tow bar (stowed)", note: "Stowed on the side of the baggage area, arm 108.0 (POH 8-9, 6-21). Without it, push on the wing struts — never on the tail surfaces (POH 7-19).", pin: true });

/* ---------- propeller: McCauley B3D36C431/80VSA-1, three blades, 79 in, constant speed (POH 1-5, 2-6) ---------- */
/** Prop plane at the propeller assembly arm (FS −47.5, POH 6-24), on the thrust line. */
export const PROP: Vec3 = P3(-47.8, 0, 50.375);
const bladeGeo = () => {
  const R = 39.5 * IN, sh = new THREE.Shape();
  sh.moveTo(-0.05, 0.13); sh.quadraticCurveTo(-0.08, R * 0.5, -0.045, R * 0.96); sh.quadraticCurveTo(-0.01, R * 1.005, 0.03, R * 0.965); sh.quadraticCurveTo(0.065, R * 0.5, 0.045, 0.13); sh.lineTo(-0.05, 0.13);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false }); g.translate(0, 0, -0.008); g.rotateY(Math.PI / 2); return g;
};
for (let i = 0; i < 3; i++) part(bladeGeo, ["propeller", "engine"], { parent: "blade:" + i, color: "#2E3439", name: "Propeller blade", note: "All-metal blade of the 3-blade McCauley B3D36C431/80VSA-1, 79 in. Hydraulically actuated: low pitch 14.9°, high pitch 31.7° at the 30-in station (POH 1-5, 2-6). Never use an alkaline cleaner on the blades (POH 8-23).", ext: true, pin: i === 0 });
part(() => cyl(0.075, 0.13, "x"), ["propeller"], { pos: P3(-45.5, 0, 50.375), color: "#8C959C", name: "Propeller hub (oil filled)", note: "P4317296-01 oil-filled hub, assembly 76.6 lb at arm −47.5 (POH 6-24). Governor oil pressure on its piston twists the blades toward high pitch (low RPM); centrifugal force and an internal spring twist them back toward low pitch (POH 7-37).", pin: true });

/* ---------- engine: Lycoming IO-540-AB1A5, 230 BHP @ 2,400 RPM (POH 1-5) ---------- */
part(() => box(0.86, 0.3, 0.44), ["engine"], { pos: P3(-23.6, 0, 48.6), color: "#7E8890", name: "Lycoming IO-540-AB1A5", note: "Normally aspirated, direct drive, air-cooled, horizontally opposed, fuel injected, six cylinders, 541 cu in; 230 BHP at 2,400 RPM; wet sump; 400.4 lb at arm −23.6 (POH 1-5, 7-27, 6-24).", pin: true });
part(() => box(0.62, 0.12, 0.36), ["engine"], { pos: P3(-24, 0, 37.5), color: "#B85A2A", name: "Oil sump", note: "Wet sump on the bottom of the engine: 8 qt sump, 9 qt total (POH 1-7, 8-14; placard “OIL 9 QTS”) — never operate on less than 4 qt; fill to 8 qt for flights under 3 hours, 9 qt for extended flight (POH 7-34). Section 7 (p. 7-34) states the sump as 9 qt plus 1 qt in the filter; Sections 1 and 8 and the 9-qt placard govern." });
/** Cylinder positions: 1, 3, 5 right bank, 2, 4, 6 left (Lycoming numbering — the POH does not map numbers to positions). */
export const CYLS = [{ n: 1, fs: -35.5, s: 1 }, { n: 2, fs: -32.5, s: -1 }, { n: 3, fs: -29.5, s: 1 }, { n: 4, fs: -26.5, s: -1 }, { n: 5, fs: -23.5, s: 1 }, { n: 6, fs: -20.5, s: -1 }];
CYLS.forEach((c) => {
  const base = P3(c.fs, c.s * 12, 50);
  part(() => cyl(0.058, 0.2, "z", 18), ["engine"], { pos: base, color: "#7C858C", name: "Cylinder " + c.n, note: (c.s > 0 ? "Right" : "Left") + " bank. Baffles route cooling air around the fins and out past the cowl flaps (POH 7-37). Numbering per Lycoming convention (not stated in the POH)." + (c.n === 3 ? " CHT 3 is the most critical: operation with CHT 3 inoperative is not allowed (POH 7-33)." : "") });
  for (let k = -2; k <= 2; k++) part(() => cyl(0.072, 0.008, "z", 18), ["engine"], { pos: [base[0], base[1], base[2] + c.s * k * 0.03], color: "#8C959C" });
  part(() => box(0.14, 0.15, 0.07), ["engine"], { pos: [base[0], base[1] + 0.01, base[2] + c.s * 0.12], color: "#6A737A", name: "Cylinder head " + c.n, note: "Two spark plugs; CHT thermocouple in the head and EGT thermocouple in the exhaust pipe (POH 7-33). Engine page shows the hottest; the LEAN page shows all six.", pin: c.n === 1 });
  // upper plug on the top face of the head, lower plug on its bottom face (heads span y −0.065..+0.085 about base): along x they would
  // sit in the 0.5 in. gap to the next head aft
  ([["U", 0.105], ["L", -0.085]] as const).forEach(([pos, dy]) => {
    // POH 7-35 (KAP 140 edition, image-verified): right magneto fires lower right + upper left; left magneto lower left + upper right
    const mag = (c.s > 0) === (pos === "L") ? "R" : "L";
    part(() => cyl(0.013, 0.05, "y", 10), ["engine"], { pos: [base[0] - 0.03, base[1] + dy, base[2] + c.s * 0.12], color: "#DADFE2", anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`, note: `Fired by the ${mag === "L" ? "left" : "right"} magneto. “The right magneto fires the lower right and upper left spark plugs, and the left magneto fires the lower left and upper right” (POH 7-35; the 2007 edition states the reverse).` });
  });
  part(() => box(0.03, 0.03, 0.03), ["engine", "fuel"], { pos: [base[0] - 0.02, base[1] - 0.11, base[2] + c.s * 0.07], color: "#C9B98F", name: "Fuel injector nozzle", note: "Air-bleed type nozzle in the intake chamber of each cylinder, fed by the fuel distribution unit (POH 7-36, 7-40)." });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: P3(-4.5, -5.5, 55), color: "#3E4A52", anim: magAnim(fires("L")), name: "Left magneto", note: "Rear accessory case; fires the lower left and upper right plugs (POH 7-35). Self-powered: OFF grounds it, so with a loose P-lead the engine can fire when the propeller is turned (POH 4-49).", pin: true });
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: P3(-4.5, 5.5, 55), color: "#3E4A52", anim: magAnim(fires("R")), name: "Right magneto", note: "Fires the lower right and upper left plugs (POH 7-35). Normal operation is BOTH; R and L are for checking and emergencies. Mag check at 1,800 RPM: ≤ 175 RPM drop, ≤ 50 RPM between (POH 4-17).", pin: true });
part(() => box(0.12, 0.1, 0.11), ["engine", "electrical"], { pos: P3(-39, -8, 42.5), color: "#4B5860", name: "Starter", note: "Front of the engine (POH 7-27). MAGNETOS to START with the MASTER on closes the starter contactor in the J-box. 10 s cranking, 20 s cool; three cycles then 10 minutes (POH 4-28).", pin: true });
part(() => cyl(0.04, 0.1, "x"), ["engine"], { pos: P3(-4.5, 0, 47.5), color: "#1F3A5A", name: "Oil filter (full flow)", note: "Rear of the accessory case; its adapter has a bypass valve for a plugged filter or very cold oil and carries the oil temperature sensor (POH 7-34, 7-32).", pin: true });
part(() => box(0.06, 0.15, 0.2), ["engine"], { pos: P3(-11.4, -13, 56), color: "#9A6A48", name: "Oil cooler", note: "Thermostatically controlled remote cooler, arm −11.4 (POH 7-34, 6-25). In extreme cold the oil congeals in it — preheat (POH 4-49). Lateral position assumed." });
part(() => cyl(0.012, 0.18, "y"), ["engine"], { pos: P3(-14, -9, 57), color: "#E0B040", name: "Oil dipstick / filler", note: "Upper LEFT side of the engine case, through a door in the left-centre upper cowling (POH 7-34). Don't operate below 4 qt; fill to 9 qt for extended flight (POH 4-10).", pin: true });
// on the outside of the crankcase box (BL ±8.66, top WL 54.5): sensors at their equipment-list arms; side and height are not in the POH
part(() => box(0.03, 0.03, 0.03), ["engine"], { pos: P3(-12.9, 9.31, 45), color: "#3A9448", name: "Oil pressure transducer", note: "Connected to the engine forward oil pressure port; P165-5281, arm −12.9 → OIL PRES on the EIS (POH 7-31, 6-25). Shown at that arm on the right side of the crankcase: the side and height are approximate (not in the POH). A separate switch drives the red OIL PRESSURE annunciation.", pin: true });
part(() => box(0.025, 0.025, 0.025), ["engine"], { pos: P3(-10.9, 9.21, 45), color: "#E0263B", name: "Low oil pressure switch", note: "Independent of the transducer: OIL PRESSURE (red, continuous tone) at 0–20 PSI — shown before start (POH 7-31, 4-7). The Hobbs runs above 20 PSI (POH 7-12). The POH doesn't locate the switch: shown beside the transducer (approximate)." });
part(() => box(0.06, 0.05, 0.06), ["engine"], { pos: P3(-8, 0, 55.55), color: "#4B5860", name: "Tach sensor", note: "Speed sensor on the engine tachometer drive accessory pad, arm −8.0: digital RPM to the GEA 71 (POH 7-29, 6-25). Shown on top of the rear accessory case between the magnetos; the pad's exact position is approximate (not in the POH).", pin: true });
part(() => box(0.04, 0.04, 0.03), ["engine"], { pos: P3(-1.2, 7, 58), color: "#3A9448", name: "Manifold pressure transducer", note: "Absolute pressure transducer → MAN IN. POH 7-29 says “between the firewall and the instrument panel” but the equipment list gives arm −8.5 (forward of the firewall): placed on the firewall here (POH 6-25).", pin: true });
// induction (POH 7-35)
part(() => box(0.05, 0.1, 0.24), ["engine"], { pos: P3(-43.6, 0, 39), color: "#1E2A33", name: "Induction air intake", note: "Ram air through an intake on the lower front of the cowling, covered by the air filter (POH 7-35).", ext: true, pin: true });
part(() => box(0.08, 0.1, 0.2), ["engine"], { pos: P3(-35.2, 0, 39), color: "#C9B98F", name: "Induction air filter", note: "P106150, arm −35.2 (POH 6-24). Check for dust preflight (POH 4-10); replace as condition warrants, 500 h maximum (POH 8-23). Ice on the filter shows as an unexplained MAP loss (POH 3-29).", pin: true });
// the air box lies between the filter and the servo, under the oil sump (bottom h 35.1): the door hangs below the sump
part(() => box(0.1, 0.07, 0.03), ["engine"], { pos: P3(-29, -5, 33), color: "#E0B040", anim: altDoorAnim(X(-29)), name: "Alternate air door", note: "One spring-loaded door in the air box: if the filter blocks, engine suction opens it and draws unfiltered air from the lower cowl — about 10% power loss at full throttle. No cockpit control (POH 7-35). Where it sits on the air box is not in the POH (shown below the oil sump).", pin: true });
part(() => cyl(0.05, 0.12, "x"), ["engine", "fuel"], { pos: P3(-22, 0, 35), color: "#7E8A93", name: "Fuel/air control unit (servo)", note: "Under the engine: meters fuel in proportion to induction air flow; throttle and mixture act here. An orificed fitting in its top feeds the fuel return line (POH 7-35, 7-40, 7-43).", pin: true });
CYLS.forEach((c) => part(() => tubeGeo([P3(-22, 0, 36.5), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 12, 45.5)], 0.015), ["engine"], { color: "#8A969E", name: "Intake manifold tube", note: "From the fuel/air control unit to each cylinder's intake port (POH 7-35)." }));
// exhaust and cabin heat (POH 7-36)
[1, -1].forEach((s) => {
  part(() => cyl(0.055, 0.32, "x"), ["engine", "environment"], { pos: P3(-24.2, s * 9.5, 33.5), color: "#8A5A3C", name: "Muffler", note: "Each cylinder's riser feeds a collector on its side below the engine, then a muffler; both go overboard through a single tailpipe. LEFT and RIGHT exhaust systems, arm −24.2 (POH 7-36, 6-25). Merge point not in the POH." });
  part(() => cyl(0.072, 0.22, "x"), ["environment", "engine"], { pos: P3(-24.2, s * 9.5, 33.5), color: "#E0522B", fairing: true, name: "Muffler heater shroud", note: "Outside air flows through a shroud around each muffler and is heated for the cabin (POH 7-36). A cracked exhaust pipe inside a shroud can put CO in the cabin (POH 3-36).", pin: s > 0 });
});
// cooling and cowl flaps (POH 7-37)
[1, -1].forEach((s) => {
  part(() => { const g = new THREE.TorusGeometry(0.06, 0.012, 8, 22); g.rotateY(Math.PI / 2); return g; }, ["engine", "airframe"], { pos: P3(-43.75, s * 10.8, 53.8), color: "#1E2A33", ext: true, pin: s > 0, name: "Cooling air inlet", note: "Two intake openings in the front of the cowling; baffling directs the air around the cylinders and it leaves through the cowl flaps at the bottom aft edge (POH 7-37)." });
  part(() => { const g = new THREE.CircleGeometry(0.06, 20); g.rotateY(Math.PI / 2); return g; }, ["engine", "airframe"], { pos: P3(-44.0, s * 10.8, 53.8), color: "#0B1014", ext: true });
});
part(() => box(0.36, 0.02, 0.56), ["engine"], { pos: P3(-26, 0, 59.2), color: "#B8BEC4", name: "Cylinder baffles", note: "Direct ram air from above the engine down around the cylinders (POH 7-37; GFC 7-40)." });
/** Cowl flaps: two doors at the bottom aft edge of the cowl, hinged at their forward edge (count and travel NOT IN the POH). */
export const COWL_FLAP = { fs: -9.5, h: 24.2, bl: 8, len: 7.5 * IN, base: 0.2, open: 0.35 };
[1, -1].forEach((s) => part(() => { const g = box(COWL_FLAP.len, 0.006, 9 * IN); g.translate(-COWL_FLAP.len / 2, 0, 0); return g; }, ["engine"], {
  parent: "cowlFlap:" + (s > 0 ? "R" : "L"), color: "#D6DCE0", ext: true, pin: s > 0, name: "Cowl flap",
  note: "Mechanically operated from the cowl flap lever on the right side of the pedestal: OPEN for start, takeoff, climb and ground runs; CLOSED in cruise unless needed to hold CHT near two-thirds of the green arc; closed in long descents (POH 7-37, 4-12 – 4-24). Door count and angles are not in the POH (two doors modelled).",
}));
// engine mount
[1, -1].forEach((s) => [1, -1].forEach((u) => part(() => tubeGeo([P3(-0.5, s * 14, 48 + u * 10), P3(-10, s * 9, 47 + u * 4.5)], 0.009), ["engine", "airframe"], { color: "#5C6E7E", name: "Engine mount", note: "Welded tube mount bolted to the firewall at the four engine mount stringers (POH 7-5).", pin: s > 0 && u > 0 })));
// engine controls on the lower centre panel, left to right: throttle, propeller, mixture (Fig 7-2 items 31, 24, 23; GFC 7-29)
export const KNOB = { fs: 18.2, h: 43.2 };
part(() => cyl(0.016, 0.03, "x"), ["engine"], { pos: P3(KNOB.fs, -1.8, KNOB.h), color: "#1A1F23", anim: pushPull(X(KNOB.fs), () => S().eng.throttle), name: "Throttle (with friction lock)", note: "Smooth black knob at the centre of the panel below the radios: forward = open (MAP up), aft = closed. Friction lock at its base: clockwise to increase (POH 7-27).", pin: true });
part(() => { const g = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10); g.rotateZ(Math.PI / 2); return g; }, ["engine", "propeller"], { pos: P3(KNOB.fs, 2.0, KNOB.h), color: "#2F64C8", anim: pushPull(X(KNOB.fs), () => S().eng.prop), name: "PROPELLER control (blue)", note: "Fluted blue knob right of the throttle, “PROPELLER, PUSH INCR RPM”: in = low pitch / high RPM, out = high pitch / low RPM. Rotate for fine adjustment; press the button on the end for large moves (POH 7-27, 7-38).", pin: true });
part(() => cyl(0.016, 0.03, "x"), ["engine"], { pos: P3(KNOB.fs, 5.8, KNOB.h), color: "#C8313B", anim: pushPull(X(KNOB.fs), () => S().eng.mix), name: "Mixture (red, vernier)", note: "Red knob with raised points and a lock button: in = RICH, out = IDLE CUTOFF; rotate for fine adjustment (POH 7-28). Use FULL RICH above 80% power (POH 4-37).", pin: true });
part(() => cyl(0.016, 0.01, "x"), ["engine", "electrical"], { pos: P3(18.0, -19.4, 50.4), color: "#3E4A52" });
part(() => box(0.012, 0.032, 0.009), ["engine", "electrical"], { pos: P3(18.3, -19.4, 50.4), color: "#C9D0D5", anim: (m) => { const k = S().eng.mags; m.rotation.x = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[k]; }, name: "MAGNETOS switch", note: "Keyed rotary switch on the left switch and control panel (Fig 7-2 item 41): OFF – R – L – BOTH – START, spring-loaded from START back to BOTH (POH 7-35). The starter relay coil is fed through the WARN breaker.", pin: true });

/* ---------- structure ---------- */
part(() => planeRing(X(0)), ["airframe", "engine"], { plate: true, pin: true, name: "Firewall — FS 0 (datum)", note: "Reference datum: front face of the firewall, lower portion (POH 2-8, 6-5). The J-box (PDM) is on its left forward side." });
part(() => planeRing(X(134), 0.97), ["airframe", "cabin"], { plate: true, pin: true, name: "Aft cabin wall — FS 134", note: "Aft baggage wall (≈ FS 134), “a convenient interior reference point” (POH 6-14). The ELT is behind this partition; the main battery, GIAs, AHRS and transponder sit in the tailcone (POH 2-21, 6-20)." });
const FSPAR = 0.25, RSPAR = 0.68;
([[FSPAR, "Front carry-through spar", "The wings attach to front and rear carry-through spars across the cabin top (POH 7-5)."], [RSPAR, "Rear carry-through spar", "Rear carry-through spar at the rear door posts (POH 7-5)."]] as [number, string, string][]).forEach(([c, name, note]) =>
  part(() => tubeGeo([-22, 0, 22].map((b) => wingP(Z(b), c, 0)), 0.03), ["airframe"], { color: "#3D5A73", name, note, pin: true }));
[1, -1].forEach((s) => {
  part(() => tubeGeo([22, 60, 100, 140, 180, 206].map((b) => wingP(s * Z(b), FSPAR, 0)), 0.024), ["airframe"], { color: "#3D5A73", name: "Wing front spar", note: "Full-span front spar with the wing-to-fuselage and wing-to-strut attach fittings (POH 7-5).", pin: s > 0 });
  part(() => tubeGeo([22, 60, 102, 132].map((b) => wingP(s * Z(b), RSPAR, 0)), 0.018), ["airframe"], { color: "#3D5A73", name: "Wing rear spar (partial span)", note: "The aft spars are partial-span spars with wing-to-fuselage attach fittings (POH 7-5).", pin: s > 0 });
  // lift strut: base of the forward door post → front spar near the chord break (Fig 1-1)
  const lo = PV(onSkin(X(29.5), Y(28.5), s, 1.0)), hi = PV(wingP(s * Z(100), FSPAR, -1).add(V(0, -0.02, 0)));
  part(() => strutGeo(lo, hi, 0.16, 0.055), ["airframe"], { color: "#E9EDF0", name: "Wing strut", note: "One streamlined lift strut per side from the fitting at the base of the forward door post to the front spar near the chord break (POH 7-5, Fig 1-1). Use the struts as push points when moving the airplane by hand (POH 7-19).", ext: true, pin: s > 0 });
  [lo, hi].forEach((p, i) => part(() => sph(0.03), ["airframe"], { pos: p, color: "#E0522B", name: i ? "Strut-to-wing fitting" : "Strut-to-fuselage fitting", note: i ? "On the wing front spar." : "Bulkhead with attach fittings at the base of the forward door post (POH 7-5).", ext: true, pin: s > 0 }));
  part(() => tubeGeo([PV(onSkin(X(29.8), Y(29), s, 0.955)), PV(onSkin(X(30.6), Y(76), s, 0.955))], 0.012), ["airframe", "cabin"], { color: "#5C6E7E", name: "Forward door post", note: "Strut attach fitting at its base; the aileron cables run up inside it (POH 7-5, Fig 7-1)." });
  part(() => tubeGeo([PV(onSkin(X(65.3), Y(28), s, 0.955)), PV(onSkin(X(65.3), Y(76.5), s, 0.955))], 0.012), ["airframe", "cabin", "fuel"], { color: "#5C6E7E", name: "Rear door post", note: "Rear door post bulkhead at FS 65.30 with the main gear forgings at its base (POH 7-5, 6-15); the fuel manifold from each tank runs down inside it (POH 7-38)." });
  part(() => box(0.1, 0.05, 0.16), ["airframe", "gear"], { pos: P3(65, s * 14, 24.5), color: "#E0522B", name: "Main gear bulkhead / forging", note: "Takes the spring-steel main gear leg at the base of the rear door post (POH 7-5)." });
  part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], { pos: PV(wingP(s * Z(100), FSPAR + 0.08, -1).add(V(0, -0.03, 0))), color: "#8C959C", name: "Wing tiedown ring", note: "Wing, tail and nose tiedown fittings: 700 lb ropes or chains (POH 8-10).", ext: true, pin: s > 0 });
});
part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], { pos: P3(250, 0, 41.2), color: "#8C959C", name: "Tail tiedown ring", note: "Tail tiedown under the tailcone; the tail rests on it when the nose is raised by pressing on a tailcone bulkhead — never on the stabilizer (POH 8-10).", ext: true, pin: true });
[139.65, 171.65].forEach((fs, i) => part(() => cyl(0.012, 0.01, "z"), ["airframe"], { pos: PV(onSkin(X(fs), Y(50), -1, 1.01)), color: "#E0B040", name: "Leveling screws", note: "Left side of the tailcone at FS 139.65 and 171.65; lateral leveling uses the upper door sills (POH 6-6, 8-11).", ext: true, pin: i === 0 }));
part(rearRoofGeo, ["airframe", "cabin"], { color: "#141B22", fairing: true, name: "Rear window", note: "Fixed wraparound rear window over the tailcone behind the wing; with the rear side windows it can't be opened (POH 7-26).", ext: true, pin: true });
[1, -1].forEach((s) => {
  // refueling steps and assist handles on the forward fuselage sides, arm 15.2 (POH 6-24, 4-6)
  part(() => box(0.1, 0.012, 0.05), ["airframe", "fuel"], { pos: PV(onSkin(X(15.2), Y(38), s, 1.0).add(V(0, 0, s * 0.02))), color: "#5C666E", name: "Refueling step", note: "Steps on both sides of the forward fuselage with an assist handle above; they simplify access to the upper wing for fuel checks and refueling (POH 4-6, 6-24).", ext: true, pin: s > 0 });
  part(() => tubeGeo([PV(onSkin(X(13.6), Y(57.5), s, 1.0)), PV(onSkin(X(14.5), Y(58.1), s, 1.0).add(V(0, 0, s * 0.03))), PV(onSkin(X(16.1), Y(58.1), s, 1.0).add(V(0, 0, s * 0.03))), PV(onSkin(X(17), Y(57.5), s, 1.0))], 0.007), ["airframe", "fuel"], { color: "#8C959C", name: "Assist handle", note: "Handle above the refueling step, arm 15.2 (POH 6-24).", ext: true, pin: s > 0 });
});
part(() => box(0.06, 0.04, 0.005), ["airframe", "cabin"], { pos: PV(onSkin(X(200), Y(50), -1, 1.01)), color: "#B8A46A", name: "Identification plate", note: "On the aft left tailcone; a secondary plate is on the lower part of the left forward door post (POH 8-4).", ext: true, pin: true });

/* ---------- cockpit: panel, pedestal, seats ---------- */
part(() => sectionSlab(X(17), Y(41.5), Y(67.4), 0.97, 0.035, X(17)), ["avionics", "cabin"], { color: "#2B3238", name: "Instrument panel", note: "Figure 7-2: PFD, GMA 1347 audio panel and MFD across the top; standby airspeed, attitude and altimeter, then the KAP 140, then throttle / propeller / mixture down the centre; switch, dimming and breaker panels at the lower left; ELT switch and Hobbs at the upper right (POH 7-10 – 7-14)." });
part(() => sectionSlab(X(16.6), Y(66.4), Y(67.8), 0.97, 0.06, X(15.4)), ["cabin"], { color: "#20262B", name: "Glareshield", note: "Placard above the PFD: MANEUVERING SPEED – 110 KIAS (POH 2-20). The forward avionics fan blows warm air up the windshield through a screen in it (POH 7-69, 3-20)." });
part(() => box(0.28, 0.38, 0.15), ["cabin", "fuel"], { pos: P3(21.5, 0, 33.5), color: "#39424A", fairing: true, name: "Center pedestal", note: "Elevator and rudder trim wheels and indicators, cowl flap lever, 12V outlet, AUX AUDIO IN jack and microphone bracket; the fuel selector handle is at its base (POH 7-12)." });
([[41.5, -11, "Pilot seat", "Vertically adjusting crew seat: fore/aft handle below the centre of the frame, height crank under the right corner, seat-back release at the front centre (POH 7-21, 7-22). Occupant CG range FS 32–50 (POH 6-14)."],
  [41.5, 11, "Front passenger seat", "Same as the pilot's seat. Front occupants at arm 37 for loading (POH 6-14)."],
  [82, 0, "Rear bench seat", "Fixed one-piece bottom with an infinitely adjustable split back; rear passengers at arm 74. It can be removed to carry cargo (POH 7-22, 6-14)."]] as [number, number, string, string][]).forEach(([fs, bl, name, note], i) => {
  const w = i === 2 ? 0.86 : 0.42;
  part(() => box(0.5, 0.1, w), ["cabin"], { pos: P3(fs, bl, 32.5), color: "#6B5A48", name, note, pin: true });
  part(() => box(0.09, 0.64, w * 0.92), ["cabin"], { pos: P3(fs + 11, bl, 45.5), rot: [0, 0, 0.18], color: "#6B5A48", name, note });
});

/* ---------- flight controls (POH Figure 7-1) ---------- */
const CTL = "#7C57CF", STEEL = "#8C959C";
export const YOKES = [{ side: "L", bl: -RIG_SPEC.yoke.bl }, { side: "R", bl: RIG_SPEC.yoke.bl }] as const;
YOKES.forEach(({ side }) => {
  const yk = "yoke:" + side, wh = "wheel:" + side, colLen = (RIG_SPEC.yoke.fs - RIG_SPEC.yoke.colFs) * IN;
  part(() => cyl(0.016, colLen, "x"), ["controls"], { parent: yk, pos: [colLen / 2, 0, 0], color: STEEL, chan: ["elevator", "aileron"], name: "Control column", note: "Control-wheel shaft through the instrument panel: slides fore/aft for pitch and turns for roll. The pilot's shaft passes through the shaft collar that takes the control lock (POH 7-27, Fig 7-1).", pin: side === "L" });
  part(() => { const g = new THREE.TorusGeometry(0.1, 0.014, 8, 28, Math.PI * 1.1); g.rotateZ(Math.PI * 1.45); g.rotateY(Math.PI / 2); return g; }, ["controls"], { parent: wh, color: "#20262B", chan: ["elevator", "aileron"], name: side === "L" ? "Pilot's control wheel" : "Copilot's control wheel", note: side === "L" ? "Left horn: A/P DISC/TRIM INT switch and the split DN-UP manual electric trim switches on the outboard side (Fig 7-2 item 6), mic switch; map light and rheostat underneath (POH 7-14, 7-59; S3-10)." : "Dual controls, right seat: copilot control wheel at FS 26.0 (POH 6-22).", pin: true });
  part(() => box(0.03, 0.06, 0.06), ["controls"], { parent: wh, color: "#20262B", chan: ["elevator", "aileron"] });
});
// control-wheel switches (left horn of the pilot's wheel — KAP 140 installation, Supplement 3)
part(() => box(0.02, 0.02, 0.014), ["autopilot", "controls"], { parent: "wheel:L", pos: [0.0, 0.07, -0.09], color: "#C8313B", name: "A/P DISC/TRIM INT switch", note: "Disengages the autopilot and interrupts manual electric trim power: 2-second tone with the AP annunciation flashing (S3-10). In a malfunction: PUSH and HOLD throughout the recovery (S3-14).", pin: true });
part(() => box(0.02, 0.03, 0.012), ["autopilot", "controls"], { parent: "wheel:L", pos: [-0.012, 0.03, -0.103], color: "#9F85E6", name: "Manual electric trim (MET) switches", note: "Split DN – UP switches on the outboard side of the left wheel: both must be pressed the same way to trim; one alone does nothing (the right one alone lights the red PT within 5 s — monitor test). MET use disengages the autopilot (S3-10, S3-21).", pin: true });
part(() => box(0.03, 0.01, 0.03), ["lighting"], { parent: "wheel:L", pos: [0.0, -0.06, -0.02], color: "#E8C46A", name: "Control wheel map light", note: "On the lower surface of the pilot's wheel, arm 21.5: turn NAV on, then the knurled rheostat — clockwise brighter (POH 7-59, 6-23). NAV LTS breaker, ELECTRICAL BUS 2.", pin: true });
part(() => box(0.03, 0.05, Z(RIG_SPEC.yoke.bl) * 2 + 0.04), ["controls"], { parent: "rig:cross", color: STEEL, chan: ["elevator", "aileron"], name: "Column interconnect", note: "Behind the panel the two control-wheel shafts are linked by a transverse member to the elevator arm at the lower forward cabin, and by a cable for the ailerons (POH Fig. 7-1).", pin: true });
[-1, 1].forEach((s) => part(() => box(0.02, Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH), 0.02), ["controls"], { parent: "rig:cross", pos: [0, (Y(RIG_SPEC.yoke.h) - Y(RIG_SPEC.yoke.crossH)) / 2, s * Z(RIG_SPEC.yoke.bl)], color: STEEL, chan: ["elevator"] }));
part(() => box(0.04, RIG_SPEC.elev.arm * IN * 3.2, 0.03), ["controls"], { parent: "rig:crank", color: CTL, chan: ["elevator"], name: "Elevator bellcrank (forward)", note: "Arm at the lower forward cabin: the link from the column interconnect rocks it, pulling one elevator cable and paying out the other (POH Fig. 7-1 Sheet 2).", pin: true });
Object.entries(PULLEYS).forEach(([k, d]) => part(() => pulleyGeo(d.r, d.axis, d.double, d.gap), d.chan === "trim" ? ["controls", "autopilot"] : ["controls"], {
  chan: d.chan === "trim" ? ["elevator"] : [d.chan as Chan], parent: "rig:pul:" + k, color: k.startsWith("aw") ? CTL : "#A6AEB4", name: d.name, note: d.note, pin: true }));
(["L", "R"] as const).forEach((sd) => part(() => box(0.16, 0.012, 0.016), ["controls"], { parent: "rig:pul:aw" + sd, pos: [-0.04, -0.012, 0], color: STEEL, chan: ["aileron"] }));
// aft elevator bellcrank (tailcone) + downspring anchor
part(() => box(0.03, AFT_CRANK.arm * 2.3, 0.03), ["controls"], { parent: "rig:aftCrank", color: CTL, chan: ["elevator"], name: "Elevator bellcrank (aft)", note: "In the aft tailcone just forward of and below the horizontal stabilizer: the up and down cables rock it and a push-pull tube drives the elevator arm (POH Fig. 7-1 Sheet 2).", pin: true });
part(() => box(0.012, AFT_CRANK.rod, 0.012), ["controls"], { parent: "rig:aftCrank", pos: [0, AFT_CRANK.rod / 2, 0.035], color: STEEL, chan: ["elevator"] });
part(() => cyl(0.012, 0.06, "z"), ["controls"], { pos: AFT_CRANK.c, color: "#5A636A", chan: ["elevator"] });
part(() => box(0.03, 0.03, 0.03), ["controls"], { pos: P3(205, 0, 38.6), color: "#5A636A", chan: ["elevator"], name: "Elevator downspring", note: "“The elevator control system is equipped with downsprings which provide improved stability in flight” (POH 7-6); drawn beside the aft bellcrank in Fig 7-1 Sheet 2.", pin: true });
// rudder bars and pedals (the pilot's pedals carry the brake master cylinders)
part(() => cyl(0.014, Z(RIG_SPEC.rud.half) * 2, "z"), ["controls", "gear"], { pos: P3(RIG_SPEC.rud.barFs, 0, RIG_SPEC.rud.barH), color: STEEL, chan: ["rudder"], name: "Rudder bars", note: "The interconnected rudder/brake pedals pivot on transverse rudder bars just aft of the firewall; the rudder cables, the steering bungee and the rudder trim bungee attach to them (POH 7-19, Fig 7-1).", pin: true });
[-17, -8.5, 8.5, 17].forEach((bl) => {
  const parent = bl < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.03, 0.17, 0.08), ["controls", "gear"], { parent, pos: P3(6.8, bl, 32.5), rot: [0, 0, 0.3], color: "#20262B", chan: ["rudder"], name: "Rudder / brake pedal", note: "Pedals steer the nosewheel through the bungee and move the rudder; toe pressure on the top applies that side's brake. Copilot pedals at FS 6.8 (POH 6-22, 7-46)." });
  if (bl < 0) part(() => cyl(0.014, 0.1), ["gear"], { parent, pos: P3(5.5, bl, 28.5), color: STEEL, name: "Brake master cylinder", note: "One on each of the pilot's pedals; the copilot's pedals act through the interconnect (POH 7-46)." });
});
// elevator arm on the torque tube, rudder horn, aileron horns
{
  const pv = surfacePivot("elevR"), arm = RIG_SPEC.elev.hornArm * IN;
  part(() => box(0.025, arm * 2.2, 0.025), ["controls"], { parent: "surf:elevR", pos: [0.02, -arm * 0.9, -pv[2] + 0.035], color: CTL, chan: ["elevator"], name: "Elevator arm", note: "Arm on the elevator torque tube at the centre of the elevator; the push-pull tube from the aft bellcrank drives it (POH 7-6, Fig 7-1 Sheet 2).", pin: true });
  part(() => cyl(0.012, Z(4) * 2, "z"), ["controls"], { parent: "surf:elevR", pos: [0, 0, -pv[2]], color: STEEL, chan: ["elevator"], name: "Elevator torque tube", note: "Joins both elevator halves on the hinge line (POH 7-6)." });
  const rv = surfacePivot("rudder"), hy = Y(RIG_SPEC.rud.hornH);
  part(() => box(0.03, 0.025, Z(RIG_SPEC.rud.hornArm) * 2), ["controls"], { parent: "surf:rudder", pos: [hingeX(hy) + 0.02 - rv[0], hy - rv[1], 0], color: CTL, chan: ["rudder"], name: "Rudder horn", note: "Bottom of the rudder: each rudder cable pulls one end (POH Fig. 7-1 Sheet 1).", pin: true });
}
[1, -1].forEach((s) => { const sd = s > 0 ? "R" : "L", aw = PULLEYS["aw" + sd].c; onSurf("ail" + sd, [aw[0] - 0.16, aw[1] - 0.035, aw[2]], () => box(0.03, 0.04, 0.012), { color: CTL, name: "Aileron horn", note: "The push-pull rod from the bellcrank drives the aileron's inboard leading edge here (Fig 7-1).", pin: s > 0 }); });
// elevator trim wheel and indicator (vertical, pedestal), trim actuator
part(() => { const g = new THREE.CylinderGeometry(RIG_SPEC.trim.r * IN, RIG_SPEC.trim.r * IN, 0.03, 28); g.rotateX(Math.PI / 2); return g; }, ["controls", "autopilot"], {
  parent: "rig:trimWheel", color: "#20262B", chan: ["elevator"], name: "Elevator trim wheel", pin: true,
  note: "Vertically mounted wheel on the pedestal: forward = nose down, aft = nose up (POH 7-7). It turns under KAP 140 autotrim and manual electric trim because the KS-272C servo drives the same cable (S3-21).",
});
part(() => box(0.012, 0.012, 0.035), ["controls", "autopilot"], { parent: "rig:trimWheel", pos: [0, RIG_SPEC.trim.r * IN, 0], color: "#E8ECEE", chan: ["elevator"] });
part(() => box(0.01, 0.02, 0.01), ["controls", "autopilot"], { pos: P3(27.2, -1.6, 37.5), color: "#FFFFFF", chan: ["elevator"], anim: (m) => { m.position.y = Y(37.5) + live.kap.trim * 0.04; },
  name: "Trim position indicator", note: "Elevator trim tab is in the takeoff position when the pointer lines up with the index mark on the pedestal cover (POH 7-7, 4-32). Required for all operations (KOEL, POH 2-11).", pin: true });
part(() => box(0.06, 0.035, 0.05), ["controls"], { pos: RIG.p3(RIG_SPEC.trim.actuator), color: CTL, chan: ["elevator"], name: "Elevator trim tab actuator", note: "Inside the horizontal stabilizer (POH 7-6), right side; driven by the trim cable, it pushes the tab through a push-pull rod (Fig 7-1 Sheet 2).", pin: true });
// rudder trim: horizontally mounted wheel on the pedestal + indicator; a bungee biases the rudder bars (POH 7-7)
part(() => { const g = new THREE.CylinderGeometry(RUD_TRIM.r, RUD_TRIM.r, 0.022, 26); return g; }, ["controls"], { parent: "rig:rudTrim", color: "#20262B", chan: ["rudder"], name: "Rudder trim wheel", pin: true,
  note: "Horizontally mounted wheel on the pedestal (Fig 7-2 item 25): rotate right for nose right, left for nose left. “The rudder is trimmed through a bungee connected to the rudder control system” (POH 7-7). Before start and takeoff: TAKEOFF position (POH 4-8, 4-17)." });
part(() => box(0.03, 0.012, 0.012), ["controls"], { parent: "rig:rudTrim", pos: [RUD_TRIM.r * 0.8, 0.012, 0], color: "#E8ECEE", chan: ["rudder"] });
part(() => box(0.012, 0.006, 0.02), ["controls"], { pos: [RUD_TRIM.wheel[0] - 0.05, RUD_TRIM.wheel[1] + 0.02, RUD_TRIM.wheel[2]], color: "#FFFFFF", chan: ["rudder"], anim: (m) => { m.position.z = RUD_TRIM.wheel[2] + S().ctrl.rudTrim * 0.03; },
  name: "Rudder trim indicator", note: "Rudder trim position indicator beside the wheel; the KOEL requires it for every kind of operation (POH 2-11).", pin: true });
part(() => cyl(0.006, Y(RUD_TRIM.shaftTop) - Y(RUD_TRIM.shaftBot), "y"), ["controls"], { pos: [RUD_TRIM.wheel[0], (Y(RUD_TRIM.shaftTop) + Y(RUD_TRIM.shaftBot)) / 2, RUD_TRIM.wheel[2]], color: STEEL, chan: ["rudder"], name: "Rudder trim shaft", note: "Vertical shaft from the rudder-bar linkage up to the horizontal rudder trim wheel (Fig 7-1 Sheet 1)." });
(["elUp", "elDn", "rudL", "rudR", "trim"] as const).forEach((k, i) => {
  const c = RIG.cable(k).pts, a = c[c.length - 3], b = c[c.length - 2];
  part(() => cyl(0.008, 0.06, "x"), ["controls"], { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color: "#C9B98F", chan: chanOfKey(k === "trim" ? "el" : k), name: "Turnbuckle", note: "Sets cable tension; safety-wired after rigging. Cable tensions are not in the POH.", pin: i === 0 });
});
part(() => cyl(0.006, 0.22, "x"), ["controls", "cabin"], { pos: P3(18.5, -14, 58.5), color: "#C8313B", anim: (m) => { m.visible = S().cabin.lock; }, name: "Control lock", note: "Shaped steel rod and flag through the pilot's control-wheel shaft and the panel collar: ailerons neutral, elevators slightly trailing edge down, flag over the ignition switch. Placard: CAUTION! CONTROL LOCK REMOVE BEFORE STARTING ENGINE (POH 7-27, 2-18). In gusty winds also fit a lock over the fin and rudder.", pin: true });
