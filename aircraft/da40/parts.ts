/**
 * Declarative catalogue of every modelled DA40 XLS component (N949KC configuration, s/n 40.949).
 * Notes cite the DA 40 AFM Doc. 6.01.01-E Rev. 8 ("AFM x-y"), the Garmin G1000/GFC 700 AFMS 190-00492-10
 * ("AFMS p. n"), the G1000 SMM 190-00303-03 ("SMM") and, where marked, the TCDS or the GFC 700 load analysis.
 * Positions are in airplane coordinates (see geometry.ts) unless a part has a `parent` moving group.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec, type ShellSpec } from "@/lib/catalogue";
import { afRing, mergeGeos, sided } from "@/lib/geometry";
import { mats } from "@/lib/materials";
import { D2R, V, clamp, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { useView } from "@/lib/view";
import {
  AIL, BAG_FRAME, CANOPY, DOOR, ELEV_HINGE_X, EF, FIN_TOP, FLAP, FW, HF, HZ, PANEL_X, ROLLBAR_X, RUD_BOT, SSPAN, SY,
  WJ, WR, WTIP, af, box, botY, canopyGeo, cyl, doorGeo, fC, fLE, finCut, finHs, finSec, fixedFuselageGeo, fRing, fs,
  hingeX, loft, onSkin, paintSkin, pantGeo, planeRing, rudHs, sC, sLE, sectionSlab, sph, stabSec, topY, tubeGeo, wC,
  wLE, wT, wY, wingP, wingSec,
} from "./geometry";
import { hornLevel, live } from "./model";
import { ARMS, ELEV_HORN, FLAP_ACT, FLAP_HORN, FLAP_TUBE, PEDALS, RUD_HORN, SERVO, STICK, TAB, TRIM_WHEEL, rudHornPivot } from "./rig";
import { useDA40 } from "./store";

const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

export const CAT = new Catalogue("da40");
const { part, surfacePivot } = CAT;
const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) => CAT.shell(geo, name, note, skin ? paintSkin : undefined);
export { surfacePivot };

/* ---------- per-frame part animations ---------- */
const sysNow = () => useView.getState().sys;
const sim = () => useDA40.getState();
const firing = () => live.rpm > 100 && sim().s.eng.key !== "OFF";
const keyFires = (mag: "R" | "L") => { const k = sim().s.eng.key; return k === "BOTH" || k === "START" || k === mag; };
const sparkPhase = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h % 100) / 10; };
const plugAnim = (mag: "R" | "L", phase: number): PartAnim => (m, t) => {
  const sys = sysNow(), engSys = sys === "engine" || sys === "overview";
  const flash = firing() && keyFires(mag) && Math.sin(t * 18 + phase) > 0.3;
  m.material = engSys && flash ? mats("#6FD8FF").hi : engSys ? mats("#DADFE2").on : mats("#DADFE2").dim;
};
const magAnim = (mag: "R" | "L"): PartAnim => (m) => {
  const engSys = sysNow() === "engine" || sysNow() === "overview";
  m.material = engSys ? (firing() && keyFires(mag) ? mats("#6FD8FF").on : mats("#3E4A52").on) : mats("#3E4A52").dim;
};
/** Glows `on` when cond() is true in the given systems' views. */
const glow = (base: string, lit: string, cond: () => boolean, sys: SysId[]): PartAnim => (m) => {
  const v = sysNow(), show = v === "overview" || sys.includes(v);
  m.material = !show ? mats(base).dim : cond() ? mats(lit).hi : mats(base).on;
};
const brakeAnim = (side: "R" | "L"): PartAnim => (m) => {
  const g = sim().s.gear, amt = g.park ? 0.6 : side === "R" ? Math.max(0, g.diff) : Math.max(0, -g.diff);
  m.material = amt > 0.05 ? mats("#FF6A2A").hi : mats("#9AA3AA").on;
};
const selPtrAnim: PartAnim = (m) => { const sel = sim().s.fuel.sel; m.rotation.y = sel === "L" ? Math.PI * 0.75 : sel === "R" ? Math.PI * 0.25 : -Math.PI * 0.25; };
/** Throttle-quadrant lever knob slides fore/aft with its value. */
const leverAnim = (x0: number, val: () => number): PartAnim => (m) => { m.position.x = x0 - 0.05 + val() * 0.1; };
/** Nose-up trim rolls the top of the wheel aft (AFM 7-8: forward = nose down). */
const trimWheelAnim: PartAnim = (m) => { m.rotation.z = live.afcs.trim * 2.6; };
const flapLight = (pos: 0 | 1 | 2, lit: string): PartAnim => (m) => {
  const { E } = sim(), a = live.flapAng, th = [0, 20, 42][pos];
  const on = E.flapsPwr && (Math.abs(a - th) < 1 || (pos === 0 && a > 1 && a < 19) || (pos === 1 && ((a > 1 && a < 19) || (a > 21 && a < 41))) || (pos === 2 && a > 21 && a < 41));
  m.material = on ? mats(lit).hi : mats("#3A4249").on;
};

/* ---------- airframe shells ---------- */
shell(fixedFuselageGeo, "Fuselage", "GFRP semi-monocoque moulded shell with GFRP/CFRP main bulkheads (AFM 7-3). The cabin pod tapers into a slim tail boom; the whole airplane is painted white to keep the composite structure cool (AFM 8-9).", true);
shell(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(0.17 * Math.pow(Math.max(0, 1 - t * t), 0.55) + 0.001, t * 0.4)); }
  const g = new THREE.LatheGeometry(pts, 32); g.rotateZ(-Math.PI / 2); g.translate(fs(0.46), 0, 0); return g;
}, "Spinner", "Polished spinner over the MT propeller hub (XLS package).");
const wingSt = [WR, 0.58, 0.8, WJ, FLAP.z0, 1.8, 2.6, 3.4, FLAP.z1, AIL.z0, 4.6, 5.2, AIL.z1];
const tipSt = [AIL.z1, 5.6, 5.67, 5.75, 5.83, 5.9, 5.95, WTIP];
[1, -1].forEach((s) => {
  shell(() => loft(sided(wingSt.map((z) => wingSec(s * z, 0, FLAP.hinge)), s)), s > 0 ? "Right wing" : "Left wing",
    "Front and rear spar with separate top and bottom shells — a fail-safe GFRP/CFRP sandwich structure. An aluminium fuel tank sits in each wing (AFM 7-3). Bolts to the stub wing at the root rib; removable for road transport (AFM 8-8).");
  shell(() => loft(sided(tipSt.map((z) => wingSec(s * z, 0, 1)), s)), "Wing tip", "Raked, upturned wing tip carrying the Whelen position/strobe unit.");
  [[WR, 0.58, 0.8, WJ, FLAP.z0], [FLAP.z1, AIL.z0]].forEach((st) =>
    shell(() => loft(sided(st.map((z) => wingSec(s * z, FLAP.hinge, 1)), s)), "Wing trailing edge", ""));
  shell(() => loft(sided([...[0, 0.5, 1.0, HZ - 0.002].map((z) => stabSec(s * z, 0, EF(z))), ...[HZ, 1.56, SSPAN].map((z) => stabSec(s * z, 0, HF))], s)),
    "Horizontal stabilizer", "GFRP twin-spar T-tail stabilizer with an un-sandwiched skin; incidence about −3° (AFM 1-6, 7-3). Removable for transport.");
});
shell(() => loft(finHs.map((h) => finSec(h, 0, finCut(h)))), "Vertical stabilizer", "GFRP twin-spar fin carrying the T-tail. The levelling wedge (600:31) sits on the tail boom just ahead of it (AFM 6-3).");

/* ---------- moving shells: front canopy and rear passenger door ---------- */
/** Canopy and door shells live in their own hinged groups (Airplane.tsx); geometry is hinge-relative. */
export const CANOPY_HINGE = CANOPY.hinge;
export const DOOR_HINGE: Vec3 = (() => { const x = (DOOR.x0 + DOOR.x1) / 2; const p = onSkin(x, Math.min(0.42, topY(x) - 0.05), -1, 1); return [x, p.y, p.z]; })();
const rel = (g: THREE.BufferGeometry, o: Vec3) => { g.translate(-o[0], -o[1], -o[2]); return g; };
const relTo = (v: THREE.Vector3, o: Vec3): Vec3 => [v.x - o[0], v.y - o[1], v.z - o[2]];
export const CANOPY_SHELL: ShellSpec = { id: "da40/canopy", geo: () => rel(canopyGeo(), CANOPY_HINGE), name: "Front canopy", note: "Large one-piece canopy, hinged at the front. Pull the frame down and lock it with the handle on the left; steel bolts lock into polyethylene blocks. A second latch setting leaves a 'cooling gap' — ground only (AFM 7-17).", skin: paintSkin };
export const DOOR_SHELL: ShellSpec = { id: "da40/door", geo: () => rel(doorGeo(), DOOR_HINGE), name: "Rear passenger door (left)", note: "Opens upward; a gas-pressure damper holds it up and an additional safety lever guards against unintentional opening (AFM 7-18). Its front hinge can be released for emergency exit after a roll-over (AFM 3-41).", skin: paintSkin };

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
function surface(key: string, secs: () => THREE.Vector3[][], a: THREE.Vector3, b: THREE.Vector3, sys: SysId[], name: string, note: string) {
  CAT.surface({
    key, pivot: P(a), axis: P(b.clone().sub(a).normalize()), sys, name, note,
    geo: () => { const g = loft(secs()); g.translate(-a.x, -a.y, -a.z); return g; },
  });
}
const hp = (s: number, z: number, xc: number) => { const c = wC(z), [u, l] = af(xc, wT(z), 0.04); return V(wLE(z) - xc * c, wY(z) + ((u + l) / 2) * c, s * z); };
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L", nm = s > 0 ? "Right" : "Left";
  const fz = [FLAP.z0, 1.8, 2.6, 3.4, FLAP.z1], az = [AIL.z0, 4.6, 5.2, AIL.z1];
  surface("flap" + side, () => sided(fz.map((z) => wingSec(s * z, FLAP.hinge, 1)), s), hp(s, fz[0], FLAP.hinge), hp(s, fz[4], FLAP.hinge), ["flaps", "controls"],
    nm + " flap", "GFRP/CFRP sandwich on 6 hinges (roll-pinned hinge pins in aluminium brackets). UP 0° · T/O 20° · LDG 42° (TCDS). Driven by push rod and rod-end from the fuselage torsion tube (AFM 7-5).");
  surface("ail" + side, () => sided(az.map((z) => wingSec(s * z, AIL.hinge, 1)), s), hp(s, az[0], AIL.hinge), hp(s, az[3], AIL.hinge), ["controls"],
    nm + " aileron", "GFRP/CFRP sandwich on 4 hinges. Differential: up 20°, down 13° (TCDS). A steel push rod with a rod-end bearing drives the aluminium horn, held by 3 screws (AFM 7-4).");
});
{
  const ez = [-SSPAN, -1.56, -HZ - 0.002], eh = [-HZ, -1.0, -0.5, 0, 0.5, 1.0, HZ], eo = [HZ + 0.002, 1.56, SSPAN];
  surface("elev", () => [...ez.map((z) => stabSec(z, HF, 1)), ...eh.map((z) => stabSec(z, EF(z), 1)), ...eo.map((z) => stabSec(z, HF, 1))],
    V(ELEV_HINGE_X, SY, -SSPAN), V(ELEV_HINGE_X, SY, SSPAN), ["controls"],
    "Elevator", "One-piece GFRP sandwich elevator on 5 hinges at the top of the T-tail, horn-balanced at the tips. Up 18°, down 16° (TCDS, 1,200 kg rigging). Carries the trim tab.");
}
surface("rudder", () => rudHs.map((h) => finSec(h, finCut(h), 1)), V(hingeX(RUD_BOT), RUD_BOT, 0), V(hingeX(FIN_TOP), FIN_TOP, 0), ["controls"],
  "Rudder", "GFRP sandwich. Upper hinge is one bolt; the lower bearing bracket holds the rudder stops. Left 24°, right 26° with long-range tanks (TCDS). Cable-driven.");
/** Part attached to a moving control surface; `world` is converted to hinge-relative coordinates. */
function onSurf(key: string, world: THREE.Vector3, geo: () => THREE.BufferGeometry, o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] }) {
  const pv = surfacePivot(key);
  part(geo, o.sys || ["controls"], { chan: chanOfKey(key), ...o, parent: "surf:" + key, pos: [world.x - pv[0], world.y - pv[1], world.z - pv[2]] });
}

/* ---------- control-surface details ---------- */
const wickNote = "Static discharger: bleeds static charge off the trailing edge. Seven are installed and all seven are required for IFR (AFMS p. 20). Exact placement not in the documents.";
const WICK = "#2A2F33";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * 5.0, 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), { color: WICK, name: "Static discharger", note: wickNote, ext: true, pin: s > 0 });
  part(() => cyl(0.004, 0.12, "x", 6), ["controls"], { pos: P(wingP(s * 5.9, 1.0, 0).add(V(-0.05, 0, 0))), color: WICK, name: "Static discharger", note: wickNote, ext: true });
  onSurf("elev", V(ELEV_HINGE_X - 0.27, SY, s * 1.5), () => cyl(0.004, 0.11, "x", 6), { color: WICK, name: "Static discharger", note: wickNote, ext: true });
  [1.6, 2.6, 3.6].forEach((z, i) => part(() => box(0.3, 0.04, 0.02), ["flaps"], { pos: P(wingP(s * z, 0.77, -1).add(V(-0.02, -0.02, 0))), color: "#C9D0D5", name: "Flap hinge bracket", note: "Aluminium hinge bracket; the hinge pin is held by a roll pin — a lost roll pin can let the hinge pin walk out (AFM 7-5). Six hinges per flap.", ext: true, pin: s > 0 && i === 0 }));
  [4.2, 5.1].forEach((z, i) => part(() => box(0.28, 0.04, 0.02), ["controls"], { chan: ["aileron"], pos: P(wingP(s * z, 0.79, -1).add(V(-0.02, -0.02, 0))), color: "#C9D0D5", name: "Aileron hinge", note: "One of 4 hinges per aileron (hinge pin in an aluminium bracket, roll-pinned). Walk-around: aileron hinges and safety pin, no foreign objects in the aileron paddle (AFM 4A-7).", ext: true, pin: s > 0 && i === 0 }));
  // stall strips: 2 per wing (AFM 4A-7)
  [1.6, 2.0].forEach((z, i) => part(() => box(0.03, 0.025, 0.22), ["airframe"], { pos: P(wingP(s * z, 0.0, 0).add(V(0.005, 0, 0))), color: "#8C959C", name: "Stall strips", note: "Two per wing on the leading edge (AFM 4A-7); they make the inboard wing stall first. The fuel measuring device is held against a marked bore in the stall strip (AFM 7-38).", ext: true, pin: s > 0 && i === 0 }));
  part(() => box(0.18, 0.012, 0.16), ["airframe", "cabin"], { pos: P(wingP(s * 0.75, 0.45, 1).add(V(0, 0.008, 0))), color: "#30363B", name: "Wing step", note: "Walkway step on each stub wing; you board over the wing. Its unpainted latch areas are the grounding points for refuelling (AFM 4A-40).", ext: true, pin: s > 0 });
  part(() => cyl(0.012, 0.03), ["airframe"], { pos: P(wingP(s * 5.4, 0.45, -1).add(V(0, -0.02, 0))), color: "#9AA3AA", name: "Tie-down eyelet", note: "An M8 eyelet can be screwed in near each wing tip; the tail tie-down is a hole in the fin (AFM 8-7).", ext: true });
});
onSurf("elev", V(ELEV_HINGE_X - 0.27, SY, 0.0), () => cyl(0.004, 0.1, "x", 6), { color: WICK, name: "Static discharger", note: wickNote, ext: true });
onSurf("rudder", V(fLE(0.3) - fC(0.3) - 0.04, 0.3, 0), () => cyl(0.004, 0.11, "x", 6), { color: WICK, name: "Static discharger", note: wickNote, ext: true });
[1, -1].forEach((s) => onSurf("elev", V(sLE(1.58) - 0.3 * sC(1.58), SY, s * 1.58), () => box(0.05, 0.03, 0.08), { color: "#6E7A84", name: "Elevator horn balance", note: "The elevator tips reach forward of the hinge line (horn balance), reducing stick forces and helping prevent flutter.", pin: s > 0 }));
onSurf("rudder", V(fLE(0.0) - fC(0.0) - 0.03, 0.0, 0), () => box(0.07, 0.12, 0.004), { color: "#8C99A3", name: "Rudder trim tab", note: "Rudder trim tab — a walk-around item (visual inspection, AFM 4A-7). There is no cockpit rudder trim; the tab's type and position on the rudder are not in the documents, so it is shown as a fixed tab. The GFC 700 out-of-trim check then means 'centre the ball with rudder'.", ext: true, pin: true });
// elevator trim tab rides on the elevator and turns about its own hinge with the trim position
{
  const pv = surfacePivot("elev"), xh = ELEV_HINGE_X - 0.22 + TAB.chord, zc = (TAB.z0 + TAB.z1) / 2;
  part(() => { const g = box(TAB.chord, 0.008, Math.abs(TAB.z1 - TAB.z0)); g.translate(-TAB.chord / 2, 0, 0); return g; }, ["controls"], {
    parent: "surf:elev", chan: ["elevator"], pos: [xh - pv[0], SY - pv[1], zc - pv[2]], color: "#9F85E6", ext: true, pin: true,
    // nose-up trim puts the tab trailing edge down, so the air load holds the elevator trailing edge up (+ rotation = TE down)
    anim: (m) => { const t = live.afcs.trim; m.rotation.z = t > 0 ? t * 12 * D2R : t * 39 * D2R; },
    name: "Elevator trim tab", note: "One GFRP tab in the middle of the elevator trailing edge, behind the top of the fin. Walk-around: visual inspection, check the locking wire (AFM 4A-7). Two cranked levers from the actuator bracket at the fin top drive it: the left one by the Bowden cable from the trim wheel (also moved by the GFC 700 trim servo), the right one through a friction damper that stops the tab fluttering if the cable fails (AMM 27-38-00). Tab travel with the elevator neutral: nose up 12° trailing edge down, nose down 39° trailing edge up (TCDS +12° / −39°). Span approximate.",
  });
}

/* ---------- cowling inlets, exhaust ---------- */
shell(() => {
  const x0 = fs(0.465), ring = fRing(x0, 1, 64, 0, 2 * Math.PI, false);
  const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(-p.z, p.y)));
  const hole = (cz: number, cy: number, r: number) => { const h = new THREE.Path(); h.absarc(-cz, cy, r, 0, Math.PI * 2, true); return h; };
  shape.holes.push(hole(0, 0, 0.168), hole(0.235, 0, 0.058), hole(-0.235, 0, 0.058));
  const g = new THREE.ShapeGeometry(shape, 24); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g;
}, "Cowling nose", "Front face of the cowling around the spinner, with the two round cooling-air inlets (AFM 4A-9).");
[1, -1].forEach((s) => {
  part(() => { const g = new THREE.TorusGeometry(0.06, 0.016, 8, 20); g.rotateY(Math.PI / 2); g.translate(fs(0.47), 0.0, s * 0.235); return g; }, ["engine", "airframe"], {
    color: "#1E2A33", ext: true, pin: true,
    name: s > 0 ? "Right cowl inlet" : "Left cowl inlet",
    note: s > 0 ? "One of the 3 cowling air intakes (AFM 4A-9). An unofficial DA40 technical description says the right intake feeds the engine induction, the oil cooler, cabin heat and battery/alternator cooling." : "Cooling-air inlet beside the spinner (AFM 4A-9: 3 air intakes … clear).",
  });
  part(() => { const g = new THREE.CircleGeometry(0.06, 20); g.rotateY(Math.PI / 2); g.translate(fs(0.475), 0.0, s * 0.235); return g; }, ["engine", "airframe"], { color: "#0B1014", ext: true });
});
part(() => box(0.04, 0.05, 0.16), ["engine", "airframe"], { pos: [fs(0.6), -0.27, 0], color: "#1E2A33", ext: true, name: "Lower cowl inlet", note: "Third cowling intake (AFM 4A-9 lists 3). Its position is not given in the documents and is assumed here." });

/* ---------- landing gear (track 2.97 m, AFM 1-7) ---------- */
export const MG = { x: fs(2.73), y: -1.045, z: 1.485, r: 0.19 };
[1, -1].forEach((s) => {
  const top: Vec3 = [fs(2.62), -0.6, s * 0.62], mid: Vec3 = [fs(2.66), -0.66, s * 0.92];
  part(() => tubeGeo([top, mid, [MG.x + 0.02, MG.y + 0.04, s * (MG.z - 0.12)]], 0.03, 0.2), ["gear"], {
    color: "#6E7A84", name: "Main gear leg (spring steel)", note: "Sprung steel strut — the only shock absorption on the mains (AFM 7-13). Walk-around: strut, fairing, tyre, brake, brake line and slip marks (AFM 4A-6).", ext: true, pin: s > 0,
  });
  part(() => cyl(MG.r, 0.15, "z", 28), ["gear"], { pos: [MG.x, MG.y, s * MG.z], color: "#2A2F33", name: "Main wheel", note: "15 × 6.0-6 tyre (with the thin or tall MLG strut) or 6.00-6. Pressure 2.5 bar / 36 psi (AFM 1-7, 4A-6).", ext: true, pin: s > 0 });
  part(() => pantGeo(0.95, 0.2), ["gear"], { pos: [MG.x + 0.02, MG.y + 0.03, s * MG.z], scale: [1, 1, 0.6], fairing: true, name: "Wheel fairing", note: "Removable; without the fairings cruise speed drops by about 5 % (AFM 5-17).", ext: true, pin: s > 0 });
  part(() => cyl(0.11, 0.03, "z", 20), ["gear"], { pos: [MG.x, MG.y, s * (MG.z - 0.1)], color: "#9AA3AA", ext: true, anim: brakeAnim(s > 0 ? "R" : "L"),
    name: "Disc brake (Cleveland 30-239)", note: "Hydraulic single-disc brake on each main wheel, operated by the toe pedals (AFM 7-13, 6-23)." , pin: s > 0 });
  part(() => tubeGeo([[fs(1.6), -0.55, s * 0.25], [fs(2.3), -0.58, s * 0.3], [fs(2.55), -0.56, s * 0.5], top, mid, [MG.x + 0.02, MG.y + 0.07, s * (MG.z - 0.13)]], 0.008), ["gear"], {
    name: "Brake line (" + (s > 0 ? "R" : "L") + ")", note: "Parking-brake valve → brake cylinder at the wheel (AFM 7-14 hydraulic schematic).",
  });
});
/** Nose-gear leg: pivot at the bottom of the engine mount (≈ FS 1.36), raked steeply forward to the fork (axle ≈ FS 1.03, wheelbase per AFM 1-7). */
export const NOSE_GEAR: Vec3 = [fs(1.36), -0.5, 0];
export const NOSE_CASTER: Vec3 = [0.33, -0.52, 0];
part(() => tubeGeo([[0, 0, 0], [0.1, -0.12, 0], [0.33, -0.5, 0]], 0.03), ["gear"], { parent: "noseGear", color: "#6E7A84", name: "Nose gear strut", note: "Free-castering nose wheel sprung by an elastomer package (AFM 7-13). There is no nose-wheel steering: steer with rudder and differential braking.", ext: true, pin: true });
part(() => cyl(0.06, 0.16, "y", 14), ["gear"], { parent: "noseGear", pos: [0.05, -0.06, 0], rot: [0, 0, 0.69], color: "#2A2F33", name: "Elastomer package", note: "Stack of elastomer discs that springs the nose gear (AFM 7-13).", ext: true, pin: true });
part(() => cyl(0.178, 0.12, "z", 24), ["gear"], { parent: "caster", pos: [0.0, -0.005, 0], color: "#2A2F33", name: "Nose wheel", note: "5.00-5 tyre, 2.0 bar / 29 psi (AFM 1-7, 4A-9).", ext: true, pin: true });
part(() => pantGeo(0.72, 0.18), ["gear"], { parent: "caster", pos: [0.02, 0.02, 0], scale: [1, 1, 0.52], fairing: true, name: "Nose wheel fairing", note: "Has the holes for the tow bar. Remove the tow bar before starting the engine (AFM 8-3).", ext: true });
part(() => box(0.06, 0.12, 0.03), ["gear", "environment"], { pos: [fs(1.86), -0.36, 0.05], color: "#B53A3A", anim: (m) => { m.rotation.z = sim().s.gear.park ? -0.6 : 0.3; }, name: "PARKING BRAKE lever", note: "On the small centre console under the panel. Up = released. To set: pull down until it catches, then pump the toe brakes (AFM 7-13).", pin: true });
part(() => box(0.06, 0.05, 0.06), ["gear"], { pos: [fs(1.9), -0.58, 0.05], color: "#7E8A93", name: "Parking brake valve (Cleveland 60-59)", note: "Between the master cylinders and the wheel brake cylinders; traps pressure while set (AFM 7-14, 6-23). Location assumed." });
PEDALS.z.forEach((z, i) => {
  const parent = i % 2 === 0 ? "rig:pedL" : "rig:pedR"; // outer-left and inner-right pedals are the left pedals
  part(() => box(0.035, 0.16, 0.08), ["gear", "controls"], { chan: ["rudder"], parent, pos: [PEDALS.x, PEDALS.y, z], rot: [0, 0, 0.3], color: "#30363B", name: "Rudder pedal / toe brake", note: "Pedals with toe brakes at both front seats; adjustable fore/aft on the ground only — electrically on the XLS with a rocker switch on the leg-room rear wall (AFM 7-8, 7-9).", pin: i === 0 });
  part(() => cyl(0.014, 0.1), ["gear"], { parent, pos: [PEDALS.x + 0.05, PEDALS.y + 0.01, z], color: "#8C959C", name: "Brake master cylinder (Cleveland 10-54)", note: "Four: each pilot pedal cylinder is plumbed in series with the co-pilot's on the same side; the co-pilot cylinders carry the small reservoirs (AFM 7-14).", pin: i === 0 });
});
part(() => box(0.05, 0.03, 0.06), ["gear", "cabin"], { pos: [fs(1.95), -0.52, -0.3], color: "#3F4B54", name: "Pedal adjustment rocker + breaker", note: "XLS electric pedal adjustment (OAM 40-251): rocker on the leg-room rear wall, its circuit breaker just below. Runaway → pull that breaker (AFM 7-9, 4B-10). Rating and bus not in the documents." });

/* ---------- propeller: MT MTV-12-B/183-59b, 3 blades, Ø 1.83 m ---------- */
export const PROP: Vec3 = [fs(0.38), 0, 0];
const bladeGeo = () => {
  // scimitar planform: tip swept back, root under the spinner
  const sh = new THREE.Shape();
  sh.moveTo(-0.055, 0.14); sh.quadraticCurveTo(-0.085, 0.5, -0.02, 0.915); sh.lineTo(0.025, 0.9); sh.quadraticCurveTo(0.08, 0.5, 0.06, 0.14); sh.lineTo(-0.055, 0.14);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); g.translate(0, 0, -0.011); g.rotateY(Math.PI / 2); return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], { parent: "blade:" + i, color: "#2E3439", name: "Propeller blade", note: "MT wood-composite blade with a fibre-reinforced coating and stainless-steel leading-edge cladding (AFM 7-24). Ø 1.83 m, pitch 11°–30° at 0.75 R (STC SA06-52). Light blades change RPM faster than metal ones — move the levers slowly (AFM 7-22).", ext: true, pin: i === 0 });

/* ---------- engine: Lycoming IO-360-M1A (180 hp @ 2,700) ---------- */
export const CYLS = [{ n: 1, x: fs(0.76), s: 1 }, { n: 2, x: fs(0.83), s: -1 }, { n: 3, x: fs(1.0), s: 1 }, { n: 4, x: fs(1.07), s: -1 }];
part(() => box(0.7, 0.24, 0.3), ["engine"], { pos: [fs(0.92), -0.02, 0], color: "#7C858C", name: "Lycoming IO-360-M1A", note: "Air-cooled, four-cylinder, horizontally opposed, direct drive, fuel injected, underslung exhaust. 5,916 cm³ (361 in³), 180 hp at 2,700 RPM (AFM 7-20).", pin: true });
part(() => box(0.48, 0.1, 0.26), ["engine"], { pos: [fs(0.9), -0.2, 0], color: "#6A737A", name: "Oil sump", note: "Wet sump, 4–8 qt (VFR min 4, IFR min 6). Filler neck and dipstick behind a door in the cowling (AFM 2-5, 2-28). The fuel-pressure and fuel-flow sensors are mounted at the sump (SMM 2-18).", pin: true });
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.07, 0.18, "z", 18), ["engine"], { parent, color: "#7C858C", name: "Cylinder " + c.n, note: (c.s > 0 ? "Right" : "Left") + " bank (Lycoming numbering assumed: 1-3 right, 2-4 left). CHT probe in each head, EGT probe in each exhaust header (SMM 2-21)." });
  for (let k = -2; k <= 2; k++) part(() => cyl(0.085, 0.008, "z", 18), ["engine"], { parent, pos: [0, 0, k * 0.032], color: "#8C959C" });
  part(() => box(0.16, 0.16, 0.06), ["engine"], { parent, pos: [0, 0, c.s * 0.115], color: "#6A737A", name: "Cylinder head " + c.n, note: "Two spark plugs, CHT probe; fuel-injection nozzle at the intake port." });
  ([["U", 0.055], ["L", -0.055]] as const).forEach(([pos, dy]) => {
    const mag = (c.s > 0) === (pos === "L") ? "R" : "L";
    part(() => cyl(0.014, 0.05, "x", 10), ["engine"], { parent, pos: [-0.1, dy, c.s * 0.115], color: "#DADFE2", anim: plugAnim(mag, sparkPhase(`${c.n}${pos}`)), name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`, note: `Fired by the ${mag === "R" ? "right" : "left"} magneto (plug assignment not in the AFM; conventional cross-firing assumed).` });
  });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: [fs(1.27), 0.07, 0.1], color: "#3E4A52", anim: magAnim("R"), name: "Right magneto", note: "Slick magneto at the rear of the engine; the G1000 tach sensor sits in its bleed port (SMM 2-19). SlickSTART boosts spark energy for starting (AFM 7-43).", pin: true });
part(() => cyl(0.045, 0.12, "x"), ["engine"], { pos: [fs(1.27), 0.07, -0.1], color: "#3E4A52", anim: magAnim("L"), name: "Left magneto", note: "Second Slick magneto. Run-up check L–BOTH–R–BOTH: max drop 175 RPM, max difference 50 RPM (AFMS p. 47).", pin: true });
part(() => box(0.1, 0.09, 0.1), ["engine", "propeller"], { pos: [fs(0.75), 0.12, 0.06], color: "#C0602F", name: "Propeller governor", note: "Flanged onto the front of the engine (arm 0.747 m). Meters engine oil to the hub to hold the RPM set by the blue lever; if the governor or oil supply fails the blades go to fine pitch (max RPM) (AFM 7-22).", pin: true });
part(() => cyl(0.065, 0.12, "x"), ["electrical", "engine"], { pos: [fs(0.64), -0.18, -0.17], color: "#D9960F", anim: glow("#5A5040", "#D9960F", () => sim().E.altFeed, ["electrical", "engine"]), name: "Alternator — 28 V, 70 A", note: "Front of the engine, V-belt driven (AFM 7-42). Regulated by the VR2000 regulator with over-voltage protection; output through the ALT 70 A breaker to the MAIN bus.", pin: true });
part(() => box(0.12, 0.11, 0.12), ["engine", "electrical"], { pos: [fs(0.64), -0.2, 0.16], color: "#4B5860", anim: glow("#4B5860", "#E7B416", () => sim().E.starterOn, ["engine", "electrical"]), name: "Starter (Skytec 149-24LS)", note: "Front of the engine, fed from the relay box through the START relay (~160 A). Max 10 s cranking, then 20 s cooling; after 6 attempts let it cool 30 min (AFMS p. 39).", pin: true });
part(() => box(0.08, 0.08, 0.1), ["engine", "fuel"], { pos: [fs(1.28), -0.12, -0.12], color: "#7E8A93", name: "Engine-driven fuel pump", note: "Mechanical pump at the rear of the engine — the normal fuel supply; has a bleed line (AFM 7-20, 7-31).", pin: true });
part(() => cyl(0.05, 0.14, "x"), ["engine", "fuel"], { pos: [fs(1.08), -0.31, 0], color: "#7E8A93", name: "Fuel servo (injection timing device)", note: "The AFM schematic's 'injection timing device with screen': meters fuel with airflow and mixture. The fuel-pressure tap is here (AFM 7-31).", pin: true });
part(() => box(0.06, 0.05, 0.06), ["engine", "fuel"], { pos: [fs(0.92), 0.15, 0], color: "#7E8A93", name: "Fuel distributor", note: "Flow divider on top of the engine: four lines to the cylinders, plus a distributor bleed line (AFM 7-31).", pin: true });
part(() => box(0.06, 0.04, 0.05), ["engine", "fuel", "avionics"], { pos: [fs(0.98), -0.27, 0.15], color: "#2F7FE6", name: "Fuel-flow transducer (Shadin)", note: "Inline in the fuel hose in a fire sleeve, on a bracket at the oil sump; read by the GEA 71 (SMM 2-19)." });
part(() => box(0.08, 0.14, 0.1), ["engine"], { pos: [fs(0.6), -0.06, 0.32], color: "#9A6A48", name: "Oil cooler", note: "Exists (pre-heat thaws congealed oil in it, AFM 4A-14); location not in the documents — shown behind the right inlet, which also feeds it per an unofficial technical description." });
part(() => box(0.09, 0.1, 0.11), ["engine"], { pos: [fs(0.62), 0.0, 0.2], color: "#C9B98F", name: "Induction air filter", note: "Normal induction air passes an air filter. Location not in the AFM; shown behind the right inlet.", pin: true });
part(() => box(0.03, 0.08, 0.1), ["engine"], { pos: [fs(0.82), -0.18, 0.2], color: "#E0B040", anim: (m) => { m.position.y = -0.18 - (sim().s.eng.altAir ? 0.05 : 0); }, name: "Alternate air door", note: "Opened by the ALTERNATE AIR lever: takes warm air from the engine compartment if MP drops from icing or a blocked filter (AFM 7-23)." });
part(() => cyl(0.06, 0.3, "z"), ["engine", "environment"], { pos: [fs(0.95), -0.36, 0.06], color: "#8A5A3C", name: "Tuned exhaust (Power Flow)", note: "Underslung exhaust; the XLS has the Power Flow Systems tuned exhaust (AOPA 2008). Hot — can cause burns (AFM 4A-10).", pin: true });
part(() => cyl(0.075, 0.14, "z"), ["environment", "engine"], { pos: [fs(0.95), -0.32, 0.2], color: "#E0522B", name: "Muffler heat shroud", note: "Cabin heat source: ram air from the right intake through a shroud around the exhaust muffler (unofficial DA40 technical description; not in the AFM)." });

/* ---------- engine controls ---------- */
const Q = { x: fs(2.0), y: -0.27 };
([["Throttle", -0.045, "#1B1F23", () => sim().s.eng.throttle, "Left lever, large black knob. Forward = MAX PWR. At the forward stop extra fuel is supplied for high power. The GFC 700 GA button is on the left side of the knob (AFM 7-21; AFMS p. 57)."],
  ["RPM lever", 0, "#2D63B8", () => sim().s.eng.rpmLever, "Centre lever, blue handle. Forward = HIGH RPM (fine pitch). Sets the governor; RPM then holds regardless of airspeed and throttle (AFM 7-21)."],
  ["Mixture lever", 0.045, "#C8313B", () => sim().s.eng.mix, "Right lever, red handle with a lock. Forward = RICH; pull to the rear stop to shut the engine down (AFM 7-22, 7-23)."],
] as [string, number, string, () => number, string][]).forEach(([name, z, color, val, note], i) => {
  // each lever is tagged with the systems it works; in the engine view the quadrant carries the one label
  const sys: SysId[] = [["engine"], ["engine", "propeller"], ["engine", "fuel"]][i] as SysId[];
  part(() => box(0.03, 0.04, 0.03), sys, { pos: [Q.x, Q.y, z], color, anim: leverAnim(Q.x, val), name, note, pin: true, pinIn: sys.filter((x) => x !== "engine") });
});
part(() => box(0.14, 0.06, 0.15), ["engine", "cabin"], { pos: [Q.x, Q.y - 0.07, 0], color: "#39424A", name: "Throttle quadrant", note: "Large centre console: throttle (black), RPM (blue) and mixture (red) levers with a friction adjuster — a loose friction is the first check for uncommanded RPM changes (AFM 7-21, 3-13).", pin: true, pinIn: ["engine"] });
part(() => box(0.02, 0.012, 0.012), ["autopilot"], { pos: [Q.x + 0.0, Q.y + 0.01, -0.063], color: "#D9D9D9", anim: leverAnim(Q.x, () => sim().s.eng.throttle), name: "GA button", note: "Go-around switch on the left side of the throttle knob: disconnects the AP and commands GA (wings level, 7° nose up) (AFMS p. 57; CRG 6-16).", pin: true });
part(() => box(0.05, 0.05, 0.03), ["engine"], { pos: [fs(1.86), -0.33, -0.14], color: "#E0B040", anim: (m) => { m.position.x = fs(1.86) - (sim().s.eng.altAir ? 0.05 : 0); }, name: "ALTERNATE AIR lever", note: "Under the panel, left of the centre console. Pull aft = ALTERNATE AIR ON (placard changes) (AFM 7-23).", pin: true, pinIn: [] });
part(() => box(0.03, 0.03, 0.03), ["engine", "electrical"], { pos: [PANEL_X - 0.035, -0.17, -0.01], pinIn: ["electrical"], color: "#A8B0B6", anim: (m) => { const k = sim().s.eng.key; m.rotation.x = { OFF: -0.9, L: -0.45, R: 0, BOTH: 0.45, START: 0.9 }[k]; }, name: "Ignition key switch", note: "OFF – L – R – BOTH – START, turning right (AFM 7-20). START engages the starter through the START relay; the G1000 shows red STARTER ENGD while it is engaged.", pin: true });

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe", "engine"], { plate: true, pin: true, pinIn: ["airframe"], name: "Firewall", note: "Fire-resistant matting covered with stainless-steel cladding on the engine side (AFM 7-3). Station not given in the documents (≈ FS 1.35 here)." });
part(() => planeRing(BAG_FRAME), ["airframe", "cabin"], { plate: true, pin: true, name: "Baggage compartment frame", note: "Rear of the standard baggage compartment; the baggage tube and extension lie behind it. Cabin air leaves through holes in this frame (unofficial technical description)." });
part(() => tubeGeo(fRing(ROLLBAR_X, 0.93, 30, -0.1, Math.PI + 0.1, false), 0.025), ["airframe", "cabin", "environment"], { color: "#4E5961", name: "Roll bar", note: "Cabin roll bar behind the front seats; carries the spherical ventilation nozzles beside the front seats (AFM 7-12). Structural details not in the AFM.", pin: true });
// stub wing spars crossing under the seats (AMM Fig. 2-6 top view: two carry-throughs under the seat pans)
[[0.35, "Front spar carry-through", "Main spar of the stub wing crossing the cabin floor under the front seats (AMM Fig. 2-6)."], [0.68, "Rear spar carry-through", "Rear spar of the stub wing, under the rear seat pans."]].forEach(([xc, name, note]) => {
  part(() => tubeGeo([-1.1, -0.6, -0.3, 0, 0.3, 0.6, 1.1].map((z) => { const p = wingP(z === 0 ? 0.001 : z, xc as number, 0); return [p.x, p.y, z] as Vec3; }), 0.03), ["airframe"], { name: name as string, note: note as string, pin: true, color: "#3D5A73" });
});
[1, -1].forEach((s) => part(() => box(0.06, 0.13, 0.03), ["airframe"], { pos: P(wingP(s * WJ, 0.4, 0)), color: "#E0522B", name: "Root rib / wing joint", note: "The outer wing bolts to the stub wing here. The Datum Plane is 2.194 m (86.38 in) forward of the most forward point of this root rib (AFM 6-3).", pin: s > 0 }));
[1, -1].forEach((s) => part(() => sph(0.03), ["airframe", "gear"], { pos: [fs(2.41), botY(fs(2.41)) - 0.02, s * 0.35], color: "#E0522B", name: "Jack point", note: "Lower fuselage at the left and right root ribs (FS 2410), plus the tail fin (FS 7312) (AFM 8-7; SMM Fig. 2-6).", pin: s > 0, ext: true }));
part(() => box(0.15, 0.025, 0.04), ["airframe"], { pos: [fs(6.0), topY(fs(6.0)) - 0.016, 0], color: "#E0B040", name: "Levelling wedge position", note: "Place a 600:31 wedge here, on top of the tail boom in front of the fin: with its top level, the Datum Plane is vertical (AFM 6-3).", pin: true });
// ventral fin with tail skid
part(() => {
  const S = (h: number, le: number, te: number) => { const c = le - te; const pts: THREE.Vector3[] = []; for (const [x, z] of [[0, 0], [0.3, 0.012], [0.7, 0.008], [1, 0], [0.7, -0.008], [0.3, -0.012]]) pts.push(V(le - x * c, h, z)); return pts; };
  return loft([S(-0.69, fs(6.95), fs(7.3)), S(-0.6, fs(6.7), fs(7.32)), S(-0.5, fs(6.5), fs(7.34))]);
}, ["airframe"], { color: "#E6E9EB", name: "Lower fin and tail skid", note: "Small ventral fin with the tail skid underneath — walk-around item 'tail skid and lower fin' (AFM 4A-7).", ext: true, pin: true });

/* ---------- cockpit / cabin ---------- */
/** Panel layout (SMM Fig. 2-1; XLS panel photos): GMA 1347 between the displays, breaker panel right of the MFD. */
export const GMA_Z = -0.066, CBP_Z = 0.375;
/** Defrost outlet at the windshield base, and the roll-bar ventilation nozzles. */
export const DEFROST_X = PANEL_X + 0.14, RB_NOZZLE = { y: 0.22, z: 0.42 };
part(() => sectionSlab(PANEL_X, -0.26, 0.2, 0.96, 0.04, PANEL_X), ["avionics", "autopilot", "cabin"], { color: "#2B3238", name: "Instrument panel", note: "G1000 panel: PFD left, GMA 1347 centre, MFD right, breakers far right; standby instruments in the raised centre row (SMM Fig. 2-1). All panel items are at arm 1.78 m (AFM 6.5)." });
part(() => sectionSlab(PANEL_X + 0.09, 0.2, 0.26, 0.95, 0.14, PANEL_X + 0.16), ["cabin", "lighting"], { color: "#2B3238", name: "Glareshield", note: "Projects over the panel; the electroluminescent flood-light panel is mounted under it." });
part(() => box(0.38, 0.14, 0.12), ["cabin", "environment", "gear"], { pos: [fs(1.86), -0.38, 0], color: "#39424A", name: "Small centre console", note: "Under the panel: CABIN HEAT lever (left), DEFROST/FLOOR lever (centre) and PARKING BRAKE lever (AFM 7-13, 7-18; SMM Fig. 2-1)." });
part(() => box(0.7, 0.16, 0.18), ["cabin"], { pos: [fs(2.25), -0.42, 0], color: "#39424A", name: "Large centre console", note: "Throttle quadrant, trim wheel and fuel tank selector between the front seats." });
([[fs(2.3), -0.26, "Pilot seat", 0.36], [fs(2.3), 0.26, "Front passenger seat", 0.36], [fs(3.25), -0.26, "Rear seat (L)", 0.36], [fs(3.25), 0.26, "Rear seat (R)", 0.36]] as [number, number, string, number][]).forEach(([x, z, name, w], i) => {
  part(() => box(0.46, 0.08, w), ["cabin"], { pos: [x, -0.47, z], color: "#6B5A48", name, note: i < 2 ? "Carbon/Kevlar and GFRP seat with energy-absorbing foam; removable to inspect the control runs underneath (AFM 7-15). Front seat arm 2.30 m. Three-point Schroth harness." : "Rear seat (arm 3.25 m); the backs fold forward after pulling up the locking-bolt knob (AFM 7-15).", pin: i === 0 || i === 2 });
  part(() => box(0.08, 0.6, w * (i < 2 ? 0.92 : 0.8)), ["cabin"], { pos: [x - 0.26, -0.17, z], rot: [0, 0, 0.18], color: "#6B5A48", name, note: i < 2 ? "Three-point safety harness (Schroth); AmSafe inflatable lap belts on some seats (AFM 7-15)." : "Three-point harness; seat back folds forward for long items." });
});
part(() => box(0.5, 0.05, 0.74), ["cabin"], { pos: [fs(3.75), -0.46, 0], color: "#4A4F55", name: "Baggage compartment", note: "Behind the rear seats: 30 kg / 66 lb at 3.65 m; extended baggage (OAM 40-163, XLS) 45 kg / 100 lb total. No baggage without the net (AFM 2-11, 7-16).", pin: true });
part(() => cyl(0.09, 0.55, "x", 16), ["cabin"], { pos: [fs(4.35), -0.38, 0], color: "#4A4F55", name: "Baggage tube", note: "Aft of the standard compartment behind a cloth cover: 5 kg / 11 lb at 4.32 m (AFM 2-11, 7-16).", pin: true });
part(() => box(0.14, 0.06, 0.06), ["cabin"], { pos: [fs(2.79), -0.52, 0], color: "#D32640", name: "Fire extinguisher", note: "Portable: Amerex A620T (1.1 kg) or HAL1 (2.2 kg) at arm 2.794 m (AFM 6-22). Mounting position not in the documents.", pin: true });
part(() => box(0.32, 0.03, 0.06), ["cabin"], { pos: [fs(2.3), -0.55, -0.29], color: "#C84A2A", name: "Emergency axe", note: "OAM 40-326: on the floor panel under the pilot's seat — break through the canopy if it can't be opened (AFM 7-19).", pin: true });
part(() => box(0.16, 0.1, 0.1), ["cabin", "avionics"], { pos: [fs(4.4), -0.27, 0.22], color: "#EB7A12", name: "ELT", note: "Arm 4.40 m, behind the baggage-compartment frame, slightly low on the right (AFM 6-21). A 406 MHz Artex ME406 (OAM 40-284, AFM 6-21 equipment list; XLS brochure) is inferred for N949KC — its supplement is not available; Suppl. S1 covers the older 121.5/243 MHz ACK E-01. Post-flight, listen on 121.5 MHz for inadvertent activation (AFM 4A-39).", pin: true });
part(() => box(0.012, 0.03, 0.03), ["cabin", "environment"], { pos: [PANEL_X - 0.028, 0.12, 0.4], color: "#C83A3A", name: "CO detector alert light", note: "CO Guardian 452-201 (OAM 40-253, XLS standard). Flashes twice at power-up; stays on until CO < 50 ppm; one flash every 4 s = unit failure (AFM 7-55, 7-56).", pin: true });
// control sticks (moving)
(["L", "R"] as const).forEach((side) => {
  part(() => { const g = cyl(0.014, STICK.len, "y"); g.translate(0, STICK.len / 2, 0); return g; }, ["controls"], { parent: "stick:" + side, chan: ["elevator", "aileron"], color: "#30363B", name: "Control stick", note: "Centre stick at each front seat, with a boot to keep objects out of the controls. Each grip has a radio transmit switch (AFM 7-15, 7-54).", pin: side === "L" });
  part(() => { const g = cyl(0.022, 0.12, "y"); g.translate(0, STICK.len + 0.04, 0); return g; }, ["controls", "autopilot"], { parent: "stick:" + side, chan: ["elevator", "aileron"], color: "#1B1F23",
    name: side === "L" ? "Pilot stick grip — AP DISC, CWS, MET" : "Co-pilot stick grip", note: side === "L" ? "Red AP DISC (also interrupts manual electric trim while held), CWS and the split AP TRIM (MET) switch: the left half is ARM, both halves together trim (AFMS p. 9–10; CRG 6-1)." : "PTT switch. The CRG says AP DISC and CWS are on both sticks; the AFMS says the pilot's stick — unconfirmed for N949KC." , pin: true });
  part(() => box(0.015, ARMS.a, 0.015), ["controls"], { parent: "stick:" + side, chan: ["aileron"], pos: [0, -ARMS.a / 2, 0], color: "#8C959C" });
});
part(() => cyl(0.014, STICK.z * 2, "z"), ["controls"], { parent: "rig:ett", chan: ["elevator"], color: "#8C959C", name: "Stick torque tube", note: "Ties both sticks together in pitch; a lever under it drives the elevator push rod aft under the seats (routing not in the AFM — inferred)." , pin: true });
part(() => box(0.015, ARMS.e, 0.015), ["controls"], { parent: "rig:ett", chan: ["elevator"], pos: [0, -ARMS.e / 2, 0], color: "#7C57CF" });

/* ---------- flight-control mechanisms (AFM 7.3; intermediate positions inferred) ---------- */
const CTL = "#7C57CF";
const crank = (parent: string, chan: "elevator" | "aileron", name: string, note: string, arms: Vec3[], pin = true) => {
  part(() => cyl(0.02, 0.04, chan === "aileron" ? "y" : "z", 14), ["controls"], { parent, chan: [chan], color: CTL, name, note, pin });
  arms.forEach((a) => part(() => {
    const v = V(...a), len = v.length(), g = box(0.014, len, 0.014);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), v.normalize()));
    return g;
  }, ["controls"], { parent, chan: [chan], color: CTL }));
};
crank("rig:eIdle", "elevator", "Elevator idler bellcrank", "Supports the long elevator push rod under the rear cabin floor (position inferred; the AFM gives no routing figure).", [[0, -ARMS.e, 0]]);
crank("rig:eFin", "elevator", "Elevator bellcrank (fin base)", "Two of its bearings can be seen next to the lower rudder hinge (AFM 7-7). Turns the fore-aft push rod into the vertical rod up the fin.", [[0, -ARMS.e, 0], [-ARMS.e, 0, 0]]);
part(() => box(0.012, ELEV_HORN.len, 0.03), ["controls"], { parent: "surf:elev", chan: ["elevator"],
  pos: (() => { const pv = surfacePivot("elev"); return [ELEV_HORN.c[0] + ELEV_HORN.dir[0] * ELEV_HORN.len / 2 - pv[0], ELEV_HORN.c[1] + ELEV_HORN.dir[1] * ELEV_HORN.len / 2 - pv[1], 0 - pv[2]] as Vec3; })(),
  rot: [0, 0, Math.atan2(-ELEV_HORN.dir[0], ELEV_HORN.dir[1])], color: CTL, name: "Elevator horn", note: "Elevator horn, its bearing and the push-rod connection are inspected at the upper end of the rudder (AFM 7-7).", pin: true });
crank("rig:aFwd", "aileron", "Aileron bellcrank (forward)", "Turns the sideways motion of the stick link into the fore-aft aileron push rod (inferred).", [[ARMS.a, 0, 0], [0, 0, ARMS.a]]);
crank("rig:aAft", "aileron", "Aileron bellcrank (aft)", "Splits the aileron run into the two spanwise push rods behind the rear spar (inferred).", [[0, 0, ARMS.a], [-ARMS.a, 0, 0]]);
[1, -1].forEach((s) => crank("rig:wb" + (s > 0 ? "R" : "L"), "aileron", "Aileron bellcrank (wing)", "Drives the short push rod with rod-end bearing to the aileron horn; the rod-end nut is sealed with locking varnish so any disturbance shows (AFM 7-4).", [[0.06, 0, 0], [0, 0, s * 0.06]], s > 0));
[1, -1].forEach((s) => {
  const key = "ail" + (s > 0 ? "R" : "L"), pv = surfacePivot(key), hz = wingP(s * 4.04, AIL.hinge, -1);
  part(() => box(0.012, 0.05, 0.03), ["controls"], { chan: ["aileron"], parent: "surf:" + key, pos: [hz.x - pv[0], hz.y - 0.025 - pv[1], hz.z - pv[2]], color: CTL, name: "Aileron control horn", note: "Aluminium horn held to the aileron by 3 screws; a bolt joins it to the push-rod's rod-end bearing (AFM 7-4).", pin: s > 0 });
});
{
  const rh = rudHornPivot();
  part(() => box(0.03, 0.025, RUD_HORN.half * 2 + 0.02), ["controls"], { chan: ["rudder"], parent: "surf:rudder", pos: [rh[0] - surfacePivot("rudder")[0], rh[1] - surfacePivot("rudder")[1], 0], color: CTL, name: "Rudder lower bracket (cable horn)", note: "The cable eyes connect to bolts on this bracket; the bearing bracket below it carries the rudder stops (AFM 7-7).", pin: true });
}
part(() => { const g = new THREE.CylinderGeometry(TRIM_WHEEL.r, TRIM_WHEEL.r, 0.025, 28); g.rotateX(Math.PI / 2); return g; }, ["controls", "autopilot"], { pos: TRIM_WHEEL.c, chan: ["elevator"], color: "#1B1F23", anim: trimWheelAnim, name: "Elevator trim wheel", note: "Black wheel in the centre console behind the engine controls, with friction and a T/O mark. Forward = nose down, rear = nose up (AFM 7-8). It turns when the GFC 700 trims.", pin: true });
part(() => box(0.012, 0.02, 0.028), ["controls"], { pos: [TRIM_WHEEL.c[0], TRIM_WHEEL.c[1] + TRIM_WHEEL.r - 0.005, TRIM_WHEEL.c[2]], chan: ["elevator"], color: "#F2F5F7", anim: (m) => { const a = live.afcs.trim * 2.6; m.position.set(TRIM_WHEEL.c[0] - Math.sin(a) * (TRIM_WHEEL.r - 0.005), TRIM_WHEEL.c[1] + Math.cos(a) * (TRIM_WHEEL.r - 0.005), TRIM_WHEEL.c[2]); m.rotation.z = a; } });
part(() => box(0.1, 0.06, 0.07), ["autopilot", "controls"], { pos: SERVO.trim, chan: ["elevator"], color: "#C8399F", anim: glow("#7A3866", "#C8399F", () => sim().E.afcsPwr && live.afcs.pft === "pass", ["autopilot", "controls"]), name: "Pitch trim servo (GSA)", note: "GFC 700 trim servo on the trim Bowden cable: autotrim with the AP engaged, manual electric trim (both MET halves) otherwise. Location not documented — shown at the KAP 140 trim-servo arm (2.21 m).", pin: true });
part(() => box(0.12, 0.08, 0.08), ["autopilot", "controls"], { pos: SERVO.pitch, chan: ["elevator"], color: "#C8399F", anim: glow("#7A3866", "#C8399F", () => live.afcs.ap && !live.afcs.cws, ["autopilot", "controls"]), name: "Pitch servo (GSA)", note: "Moves the elevator push rod when the AP is engaged; a slip clutch lets the pilot overpower it in an emergency (CRG 6-21). Location not documented — KAP 140 pitch-servo arm 3.93 m.", pin: true });
part(() => box(0.12, 0.08, 0.08), ["autopilot", "controls"], { pos: SERVO.roll, chan: ["aileron"], color: "#C8399F", anim: glow("#7A3866", "#C8399F", () => live.afcs.ap && !live.afcs.cws, ["autopilot", "controls"]), name: "Roll servo (GSA)", note: "Drives the aileron push rod with the AP engaged (slip clutch for override). Location not documented — KAP 140 roll-servo arm 3.06 m.", pin: true });

/* ---------- flaps ---------- */
part(() => cyl(0.018, FLAP_TUBE.half * 2, "z"), ["flaps"], { parent: "rig:flapTube", color: "#9F85E6", name: "Flap torsion tube", note: "In the fuselage, joining the left and right flaps through aluminium fittings — both flaps always move together (AFM 7-5).", pin: true });
[1, -1].forEach((s) => part(() => { const g = box(0.014, FLAP_TUBE.arm, 0.014); g.translate(0, -FLAP_TUBE.arm / 2, 0); return g; }, ["flaps"], { parent: "rig:flapTube", pos: [0, 0, s * FLAP_TUBE.half], color: "#9F85E6" }));
part(() => box(0.24, 0.07, 0.08), ["flaps", "electrical"], { pos: FLAP_ACT, color: "#7C57CF", anim: glow("#5C4A8A", "#B9A3F0", () => { const t = [0, 20, 42][sim().s.flaps.cmd]; return sim().E.flapsPwr && Math.abs(live.flapAng - t) > 0.3; }, ["flaps"]), name: "Flap actuator", note: "Electric motor drive (P/N 430555); keeps running until the selected position is reached; UP and LDG have limit switches (AFM 7-5, 7-6). Location not in the documents.", pin: true });
[1, -1].forEach((s) => {
  const key = "flap" + (s > 0 ? "R" : "L"), pv = surfacePivot(key), hz = wingP(s * 1.28, FLAP.hinge, 0);
  part(() => box(0.012, FLAP_HORN, 0.03), ["flaps"], { parent: "surf:" + key, pos: [hz.x - pv[0], hz.y - FLAP_HORN / 2 - pv[1], hz.z - pv[2]], color: CTL, name: "Flap control horn", note: "Steel push rod with rod-end bearing to the flap horn, held by 3 screws (AFM 7-5).", pin: s > 0 });
});
part(() => box(0.1, 0.07, 0.05), ["flaps"], { pos: [PANEL_X - 0.01, -0.17, 0.19], color: "#2B3238", name: "Flap selector", note: "Three-position switch below the right side of the MFD, Cruise (UP) at the top. The flaps keep travelling until they reach the selected position (AFM 7-6; SMM Fig. 2-1). Placard: T/O max 108 KIAS, LDG max 91 KIAS.", pin: true });
([[0, "#2FD35A", 0.035, "Flap position light — UP (green)"], [1, "#F4F6F8", 0.0, "Flap position light — T/O (white)"], [2, "#F4F6F8", -0.035, "Flap position light — LDG (white)"]] as [0 | 1 | 2, string, number, string][]).forEach(([pos, c, dy, name]) =>
  part(() => sph(0.007), ["flaps", "lighting"], { pos: [PANEL_X - 0.024, -0.17 + dy, 0.155], color: c, anim: flapLight(pos, c), name, note: "Green UP, white T/O and white LDG. Two lights on together mean the flaps are travelling between those positions (AFM 7-6)." }));

/* ---------- fuel system (tanks rendered separately) ---------- */
[1, -1].forEach((s) => {
  const nm = s > 0 ? "Right" : "Left";
  part(() => cyl(0.04, 0.012), ["fuel"], { pos: P(wingP(s * 3.45, 0.32, 1).add(V(0, 0.006, 0))), color: "#2F7FE6", name: "Fuel filler neck", note: "At the outboard end of each tank (AFM 7-31). Placard AVGAS 100LL, 94 l / 25 US gal (long range). Ground the airplane at the step latches before refuelling (AFM 2-25, 4A-40).", ext: true, pin: s > 0 });
  part(() => sph(0.022), ["fuel"], { pos: P(wingP(s * 1.22, 0.42, -1)), color: "#0B3A80", name: nm + " tank drain", note: "Outlet valve at the tank's lowest, inboard point, behind a finger filter (AFM 7-35). Drain before every flight. The measuring device's connector is pressed against this drain (AFM 7-38).", ext: true, pin: s > 0 });
  part(() => box(0.08, 0.025, 0.04), ["fuel"], { pos: P(wingP(s * 1.24, 0.44, 0)), color: "#2F7FE6", name: "Finger filter", note: "Coarse filter before the tank outlet (AFM 7-35)." });
  [3.9, 4.04].forEach((z, i) => part(() => cyl(0.008, 0.05), ["fuel"], { pos: P(wingP(s * z, 0.45, -1).add(V(0, -0.02, 0))), color: "#2F7FE6", name: i ? "Tank vent — check valve" : "Tank vent — capillary", note: i ? "Lets air into the tank but not fuel out (AFM 7-34)." : "Two separate vents per tank on the wing underside about 2 m from the tip; the capillary equalises pressure and backs up the other vent (AFM 7-34).", ext: true, pin: s > 0 }));
});
export const SEL: Vec3 = [fs(2.38), -0.32, 0];
part(() => cyl(0.04, 0.025, "y"), ["fuel"], { pos: SEL, name: "Fuel tank selector", note: "On the centre console: LEFT / RIGHT / OFF. To reach OFF, pull up the safety catch while turning right. No BOTH position — switch tanks to stay within 8 US gal (AFM 7-33, 2-23).", pin: true });
part(() => box(0.07, 0.012, 0.015), ["fuel"], { pos: [SEL[0], SEL[1] + 0.016, SEL[2]], color: "#F2F5F7", anim: selPtrAnim });
part(() => box(0.02, 0.045, 0.02), ["fuel", "electrical"], { pos: [PANEL_X - 0.03, -0.17, 0.025], color: "#3F4B54", anim: (m) => { m.rotation.z = sim().s.fuel.pump ? -0.35 : 0.35; }, pinIn: ["fuel"], name: "FUEL PUMP switch", note: "On the switch row: ON for start (note pump noise), take-off, landing, tank switching, high altitude and low fuel pressure (AFM 7-33; AFMS p. 39–47). FUEL PUMP 5 A on the MAIN bus — lost on ESS BUS only.", pin: true });
part(() => cyl(0.04, 0.1), ["fuel"], { pos: [fs(1.89), -0.56, 0], color: "#7E8A93", name: "Gascolator", note: "Lowest point of the fuel system. Its drain is on the fuselage centreline about 30 cm forward of the wing leading edge (AFM 7-35). One of 3 drains.", pin: true });
part(() => cyl(0.015, 0.05), ["fuel"], { pos: [fs(1.89), botY(fs(1.89)) - 0.015, 0], color: "#0B3A80", name: "Gascolator drain", note: "Drain a small quantity and check for water and sediment (AFM 4A-10).", ext: true });
part(() => box(0.1, 0.08, 0.09), ["fuel", "electrical"], { pos: [fs(1.6), -0.55, 0.07], color: "#2F7FE6", anim: glow("#245C9E", "#7FB8FF", () => sim().s.fuel.pump && sim().E.pumpPwr, ["fuel", "electrical"]), name: "Electric fuel pump", note: "Auxiliary and emergency pump, drawn with a bypass so fuel passes when it is off (AFM 7-31, 7-33). Location shown is approximate.", pin: true });
part(() => box(0.04, 0.04, 0.04), ["fuel", "engine", "avionics"], { pos: [fs(0.83), -0.28, 0.08], color: "#2F7FE6", name: "Fuel-pressure sensor (Kulite)", note: "On a sensor mount at the oil sump (FS 830), hosed to the fuel-pressure port; FUEL PRES LO < 14 psi, HI > 35 psi (SMM 2-18; AFMS p. 19)." });

/* ---------- electrical ---------- */
part(() => box(0.24, 0.18, 0.17), ["electrical", "engine"], { pos: [fs(1.19), -0.18, 0.31], pinIn: ["electrical"], color: "#D9960F", name: "Main battery — 24 V, 11 Ah", note: "Lead-acid (Concorde RG24-11M or similar), right side of the engine compartment, arm 1.19 m. Connected through the battery relay and the BATT 70 A breaker to the ESSENTIAL bus (AFM 7-42, 6-19).", pin: true });
part(() => box(0.1, 0.08, 0.12), ["electrical"], { pos: [fs(1.3), -0.04, 0.32], color: "#6E5A2A", name: "Relay box", note: "Battery relay, START relay and external-power relay on one bus bar (AFM 7-40/7-41). Location not given — shown beside the battery." , pin: true });
part(() => box(0.08, 0.07, 0.02), ["electrical"], { pos: P(onSkin(fs(1.42), -0.36, 1, 1.01)), color: "#3F4B54", name: "External power receptacle", note: "Behind an access panel (AFM 4B-14); location not in the AFM. Not for starting with a flat battery if the flight will be IFR (AFM 2-32).", ext: true, pin: true });
part(() => box(0.1, 0.06, 0.08), ["electrical"], { pos: [fs(0.58), -0.06, -0.16], color: "#5A5040", name: "Voltage regulator (VR2000)", note: "Regulates the alternator field; its over-voltage protection opens the field (AFM 6-20, 7-41 figure). Location not in the documents." });
part(() => box(0.02, 0.19, 0.15), ["electrical"], { pos: [PANEL_X - 0.03, -0.03, CBP_Z], color: "#3A3F44", pinIn: [], name: "Circuit-breaker panel", note: "Right of the MFD, six rows around the right air nozzle (SMM Fig. 2-1): rows 1–3 essential, 4–5 main, 6 avionics (inferred from the schematics — the drawing has no bus headings; AUDIO is re-bussed to ESSENTIAL on the GFC 700 airplane). Push-pull breakers with the rating on the button.", pin: true });
part(() => box(0.06, 0.05, 0.05), ["electrical"], { pos: [PANEL_X + 0.08, -0.08, 0.37], pinIn: [], color: "#D9960F", name: "Alternator current sensor", note: "Around the ALT breaker cable behind the breaker panel; the GEA 71 reads it for AMPS and the ALTERNATOR warning (SMM 2-22).", pin: true });
part(() => box(0.05, 0.04, 0.04), ["electrical"], { pos: [PANEL_X + 0.08, 0.0, 0.42], color: "#B85A2A", name: "Transient voltage suppressors + 3.2 A fuses", note: "Lightning protection: TVS on the battery and alternator breakers, each with a 3.2 A slow-blow fuse; replace every 2 years (SMM 2-12, 4-1)." });
part(() => box(0.12, 0.08, 0.1), ["electrical", "avionics", "lighting"], { pos: [fs(1.69), -0.16, 0.3], color: "#D9960F", anim: glow("#6E5A2A", "#FFD24A", () => sim().s.elec.emerg && !sim().E.emergDead, ["electrical", "avionics", "lighting"]), name: "Emergency battery (lithium pack)", note: "Powers only the standby attitude indicator and the flood light, for 1 h 30 min, when the HORIZON EMERGENCY switch is ON (AFM 7-42). Arm 1.69 m, co-pilot side behind the panel.", pin: true });
// switch rows (SMM Fig. 2-1)
const SW = (name: string, z: number, y: number, sys: SysId[], note: string, on: () => boolean, color = "#3F4B54", pin = true, pinIn?: SysId[]) =>
  part(() => box(0.02, 0.045, 0.018), sys, { pos: [PANEL_X - 0.03, y, z], color, anim: (m) => { m.rotation.z = on() ? -0.35 : 0.35; }, name, note, pin, pinIn });
SW("Master switch ALT / BAT", -0.3, -0.17, ["electrical"], "Split rocker: ALT on the left, BAT on the right; together 'Master switch (ALT/BAT)' (AFM 7-43). BAT closes the battery relay; ALT powers the alternator field through ALT CONT.", () => sim().s.elec.bat);
SW("AVIONIC MASTER switch", -0.34, -0.17, ["electrical", "avionics", "autopilot"], "Closes the main (avionics) relay to power the MAIN AVIONICS bus: GIA 2, COM 2, GFC 700, GDL 69A. Also a way to disable the autopilot and electric trim (AFMS p. 10).", () => sim().s.elec.avMaster, undefined, true, ["avionics", "autopilot"]);
SW("ESS. BUS switch", -0.37, -0.17, ["electrical"], "Placard: 'Ess. Bus NOT for normal operation. See AFM.' ON opens the tie relay so the battery feeds only the ESSENTIAL bus (alternator failure, smoke) (AFM 2-28; AFMS p. 29–32).", () => sim().s.elec.essBus);
SW("HORIZON EMERGENCY switch", -0.18, 0.15, ["electrical", "avionics", "lighting"], "Sealed, guarded switch. ON feeds the standby attitude and flood light from the emergency battery. IFR is not permitted with the seal broken (AFM 2-32, 7-42).", () => sim().s.elec.emerg, "#B53A3A", true, ["avionics", "lighting"]);
SW("PITOT switch", 0.055, -0.17, ["pitot", "electrical"], "Pitot heat ON/OFF. PITOT 10 A on ESSENTIAL. Yellow PITOT OFF when off, PITOT FAIL on a heater fault (AFM 7-45; AFMS p. 19).", () => sim().s.pitot.heat, undefined, true, ["pitot"]);
SW("LANDING light switch", -0.275, 0.15, ["lighting"], "LIGHTS row: LANDING (ESSENTIAL, 5 A).", () => sim().s.lights.landing);
SW("TAXI light switch", -0.253, 0.15, ["lighting"], "TAXI (TAXI/MAP 5 A, MAIN).", () => sim().s.lights.taxi, "#3F4B54", false);
SW("POSITION light switch", -0.231, 0.15, ["lighting"], "POSITION (5 A, MAIN). Position lights must always be on at night (AFMS p. 45).", () => sim().s.lights.position, "#3F4B54", false);
SW("STROBE light switch", -0.209, 0.15, ["lighting"], "STROBE (5 A, MAIN) — the strobes are the anti-collision lights (ACL); off when close to other aircraft or in cloud at night (AFMS p. 45).", () => sim().s.lights.strobe, "#3F4B54", false);
([["INSTRUMENT dimmer", -0.35, () => sim().s.lights.instr, "Rotary knob in the LIGHTS group: switches on and dims the instrument lighting (INST 3 A, MAIN) (AFM 7-44)."],
  ["FLOOD dimmer", -0.31, () => sim().s.lights.flood, "Rotary knob: switches on and dims the glareshield flood light (FLOOD 5 A, ESSENTIAL; or the emergency battery) (AFM 7-44)."]] as [string, number, () => number, string][]).forEach(([name, z, v, note]) =>
  part(() => cyl(0.014, 0.02, "x", 16), ["lighting"], { pos: [PANEL_X - 0.03, 0.15, z], color: "#1B1F23", anim: (m) => { m.rotation.x = -1.2 + v() * 2.4; }, name, note, pin: true }));

/* ---------- avionics LRUs (SMM §2, Fig. 2-2 / 2-6) ---------- */
part(() => box(0.03, 0.2, 0.058), ["avionics", "autopilot"], { pos: [PANEL_X - 0.035, -0.03, GMA_Z], color: "#1B1F23", pinIn: [], name: "GMA 1347 audio panel", note: "Between the displays: COM/NAV audio, intercom, marker beacon, clearance recorder. On ESSENTIAL (AUDIO 5 A) in the GFC 700 airplane so the AP disconnect tone is heard even with the avionics bus off (ELA).", pin: true });
part(() => box(0.012, 0.022, 0.026), ["avionics"], { pos: [PANEL_X - 0.056, -0.112, GMA_Z], color: "#B53A3A", anim: glow("#6E2424", "#FF4A4A", () => sim().s.avx.backup, ["avionics"]), name: "DISPLAY BACKUP button", note: "Red button at the bottom of the GMA 1347. OUT = reversionary (composite) mode on both displays; one attempt to return to normal is approved (CRG 11-1; AFMS p. 33).", pin: true });
/* ---------- display bezels, standby instrument cases, compass, ELT remote (XLS panel photos) ---------- */
/** Screen planes sit just proud of their bezels / cases on the panel's aft face (PANEL_X − 0.02). */
export const DISPLAY_X = PANEL_X - 0.046, STBY_X = PANEL_X - 0.026;
const BEZEL = "#1B1F23", KNOB = "#3A4148";
([[-0.26, "PFD (GDU 1040)"], [0.13, "MFD (GDU 1042 / 1044)"]] as [number, string][]).forEach(([z, which], d) => {
  part(() => box(0.025, 0.21, 0.32), ["avionics", "autopilot"], { pos: [PANEL_X - 0.032, -0.03, z], color: BEZEL, name: `${which} bezel`,
    note: d ? "Knobs NAV, HDG, ALT (left) and COM, CRS/BARO, RANGE/PAN, FMS (right); the GFC 700 AFCS keys are on this bezel, and the VNV key only on the optional GDU 1044 (AFMS p. 57)." : "Knobs NAV, HDG, ALT (left) and COM, CRS/BARO, RANGE/PAN, FMS (right), 12 softkeys under the screen (CRG §1)." });
  // dual concentric knobs down each side of the screen
  [[-1, [0.04, -0.015, -0.11]], [1, [0.05, 0.005, -0.04, -0.085, -0.115]]].forEach(([side, ys]) => (ys as number[]).forEach((y) =>
    part(() => cyl(0.011, 0.016, "x", 16), ["avionics"], { pos: [PANEL_X - 0.052, y, z + (side as number) * 0.134], color: KNOB })));
  // softkey row under the screen
  for (let k = 0; k < 12; k++) part(() => box(0.006, 0.008, 0.011), ["avionics"], { pos: [PANEL_X - 0.047, -0.124, z - 0.1 + k * 0.0182], color: "#5A636B" });
});
[-0.107, -0.008, 0.089].forEach((z) => part(() => box(0.016, 0.09, 0.09), ["avionics"], { pos: [STBY_X, 0.15, z], color: BEZEL }));
part(() => box(0.05, 0.05, 0.06), ["avionics"], { pos: [PANEL_X - 0.045, 0.15, 0.168], color: BEZEL, name: "Magnetic compass", note: "Standby compass in the top row, right of the standby altimeter (XLS panel photos). Its loss has no effect on the autopilot (AFMS p. 10).", pin: true, pinIn: [] });
part(() => box(0.006, 0.026, 0.034), ["avionics"], { pos: [PANEL_X - 0.072, 0.15, 0.168], color: "#E8E2CF" });
part(() => box(0.012, 0.03, 0.045), ["cabin", "avionics"], { pos: [PANEL_X - 0.026, 0.15, 0.31], color: "#2B2F33", name: "ELT remote switch", note: "ARM / ON remote switch with its indicator light, upper right of the panel (XLS panel photos; an Artex remote switch is listed in AFM 6-21).", pin: true, pinIn: [] });
part(() => box(0.006, 0.014, 0.016), ["cabin", "avionics"], { pos: [PANEL_X - 0.034, 0.15, 0.316], color: "#D9442A" });
part(() => box(0.1, 0.16, 0.05), ["avionics", "engine"], { pos: [PANEL_X + 0.1, -0.05, -0.3], pinIn: ["avionics"], color: "#C8399F", name: "GEA 71 engine/airframe unit", note: "Behind the panel, vertical. Reads MAP, RPM, oil, fuel, CHT/EGT, volts, alternator current, fuel probes, pitot heat, door switches and starter engage; ENG INST 5 A on ESSENTIAL (SMM 2-3).", pin: true });
part(() => box(0.15, 0.06, 0.12), ["avionics", "pitot"], { pos: [PANEL_X + 0.1, 0.06, 0.12], color: "#C8399F", name: "GDC 74A air data computer", note: "On a rack behind the panel, right of centre; hosed to the pitot-static system. ADC 5 A, ESSENTIAL (SMM 2-5).", pin: true });
([[-0.18, "PFD cooling fan"], [0.22, "MFD cooling fan"]] as [number, string][]).forEach(([z, name]) => part(() => cyl(0.03, 0.03, "x", 14), ["avionics", "electrical"], { pos: [PANEL_X + 0.06, 0.03, z], color: "#8A6C9A", anim: glow("#5A4A62", "#C8399F", () => sim().E.cduFan, ["avionics", "electrical"]), name, note: "Behind the panel; CDU FAN 3 A on MAIN. Failure → white " + (z < 0 ? "PFD" : "MFD") + " FAN FAIL advisory (SMM 5-9)." }));
export const ENCL: Vec3 = [fs(3.83), -0.56, 0];
part(() => box(0.32, 0.12, 0.34), ["avionics"], { pos: ENCL, color: "#5A3550", name: "Remote avionics enclosure", note: "Under the baggage floor (FS 3832): GIA 63W ×2, GTX 33, GDL 69A, the CI-1125 NAV diplexer and lightning-protection fuses; cooled by a ducted blower (SMM 2-3, 2-9).", pin: true });
([[-0.1, "GIA 63W #1", "WAAS GPS 1, COM 1, NAV 1/GS 1 and integration; flight-director logic. COM 1 + GPS/NAV 1 on ESSENTIAL (SMM 2-3)."], [0.0, "GIA 63W #2", "GPS 2, COM 2, NAV 2/GS 2. On the MAIN AVIONICS bus — its loss stops the autopilot and electric trim (AFMS p. 10)."], [0.1, "GTX 33 transponder", "Mode S, remote-mounted in the enclosure; XPDR 5 A on ESSENTIAL. (N949KC is reported as later upgraded to a GTX 345R.)"]] as [number, string, string][]).forEach(([z, name, note]) =>
  part(() => box(0.28, 0.1, 0.07), ["avionics"], { pos: [ENCL[0], ENCL[1] + 0.04, z], color: "#C8399F", name, note, pin: true }));
part(() => box(0.1, 0.06, 0.08), ["avionics"], { pos: [ENCL[0] - 0.22, ENCL[1], 0.0], color: "#8A6C9A", anim: glow("#5A4A62", "#C8399F", () => sim().E.avFan, ["avionics", "electrical"]), name: "Avionics enclosure blower", note: "Remote avionics blower with an air duct to the enclosure; AV FAN 3 A, MAIN. Failure → white GIA FAN FAIL (SMM 2-9, 5-9)." });
part(() => box(0.12, 0.07, 0.1), ["avionics"], { pos: [fs(3.83), -0.44, 0.2], color: "#C8399F", name: "GRS 77 AHRS", note: "In the baggage compartment, starboard of the remote avionics enclosure (RBL 174). AHRS 5 A, ESSENTIAL; also powers the GMU 44 (SMM 2-6).", pin: true });
part(() => box(0.07, 0.04, 0.07), ["avionics"], { pos: P(wingP(2.6, 0.45, 0)), color: "#C8399F", name: "GMU 44 magnetometer", note: "Under the right wing at the old flux-valve location, behind an access plate (SMM 2-7). Span station approximate.", pin: true });
part(() => tubeGeo([[fs(2.0), botY(fs(2.0)) + 0.01, 0.3], [fs(2.0) + 0.01, botY(fs(2.0)) - 0.06, 0.3]], 0.006), ["avionics", "pitot"], { color: "#8C959C", name: "GTP 59 OAT probe", note: "On the bottom starboard side of the fuselage; feeds the GDC 74A (SMM 2-5).", ext: true, pin: true });
const ANT = "#C8399F";
part(() => { const g = cyl(0.006, 0.42); g.rotateZ(0.5); return g; }, ["avionics"], { pos: [fs(4.55), topY(fs(4.55)) + 0.18, 0], color: ANT, name: "COM 1 antenna", note: "Whip on top of the fuselage behind the cabin. Antenna locations are not in the documents — placed from photos of DA40 XLS airplanes.", ext: true, pin: true });
part(() => { const g = tubeGeo([[0, 0, 0], [0, -0.16, 0], [-0.22, -0.2, 0]], 0.006); return g; }, ["avionics"], { pos: [fs(4.25), botY(fs(4.25)), 0], color: ANT, name: "COM 2 antenna", note: "Bent whip under the fuselage (placed from photos).", ext: true, pin: true });
[[fs(3.95), "GPS 1 antenna"], [fs(4.25), "GPS 2 / XM antenna"]].forEach(([x, name]) =>
  part(() => cyl(0.045, 0.02), ["avionics"], { pos: [x as number, topY(x as number) + 0.01, 0], color: ANT, name: name as string, note: "Garmin GA 56 (AFM 6-28), on top of the fuselage behind the cabin (placed from photos).", ext: true, pin: true }));
part(() => box(0.08, 0.06, 0.012), ["avionics"], { pos: [fs(3.55), botY(fs(3.55)) - 0.03, 0.08], color: ANT, name: "Transponder antenna", note: "Blade on the belly (KA 60/61, AFM 6-26; location assumed).", ext: true, pin: true });
part(() => box(0.24, 0.012, 0.08), ["avionics"], { pos: [fs(4.85), botY(fs(4.85)) - 0.006, 0], color: ANT, name: "Marker beacon antenna", note: "Comant CI 102 (AFM 6-26); belly location assumed.", ext: true });
part(() => box(0.3, 0.01, 0.02), ["avionics"], { pos: [fs(7.3), 0.25, 0], color: ANT, name: "NAV (VOR/LOC/GS) antenna", note: "Comant CI 157P (AFM 6-27), through the CI-1125 diplexer to both GIAs. Shown inside the composite fin — location not in the documents." });
part(() => cyl(0.004, 0.3), ["avionics", "cabin"], { pos: [fs(4.9), topY(fs(4.9)) + 0.15, 0.06], color: ANT, name: "ELT antenna", note: "ELT whip (location assumed).", ext: true });

/* ---------- pitot-static & stall warning ---------- */
export const PITOT_Z = -3.9;
export const pitotBase = wingP(PITOT_Z, 0.28, -1);
/** Streamlined mast hanging below the wing, leaning forward, with a short pitot head at its lower leading edge. */
const MAST = { h: 0.16, c0: 0.085, c1: 0.055, lean: 0.07, head: 0.05, r: 0.011 };
const mastAt = (u: number) => ({ y: pitotBase.y + 0.01 - u * MAST.h, c: MAST.c0 + (MAST.c1 - MAST.c0) * u, le: pitotBase.x + 0.035 + MAST.lean * u });
const MAST_TIP = (() => { const b = mastAt(1); return V(b.le + MAST.head, b.y + 0.012, PITOT_Z); })();
part(() => {
  const blade = loft([0, 0.25, 0.5, 0.75, 1].map((u) => { const m = mastAt(u); return afRing(0, 1, 0.16, 0, 12).map(([x, t]) => V(m.le - x * m.c, m.y, PITOT_Z + t * m.c)); }));
  const head = new THREE.CylinderGeometry(MAST.r * 0.8, MAST.r, MAST.head + 0.02, 16);
  head.rotateZ(Math.PI / 2); head.translate(MAST_TIP.x - (MAST.head + 0.02) / 2, MAST_TIP.y, PITOT_Z);
  return mergeGeos([blade, head]);
}, ["pitot"], {
  anim: (m) => { const { s, E } = sim(); const hot = s.pitot.heat && E.pitotPwr && !s.pitot.heaterFail; m.material = (sysNow() === "pitot" || sysNow() === "overview") ? (hot ? mats("#FF8A4A").hi : mats("#3A9448").on) : mats("#3A9448").dim; },
  name: "Pitot-static mast (heated)", ext: true, pin: true,
  note: "One streamlined mast under the left wing gives both pressures: total pressure at the opening on its leading edge, static pressure at two orifices on its lower and rear edges (AFM 7.12, p. 7-54, which calls it the Pitot probe; P/N DAI-9034-57-00). Electrically heated; a thermal switch holds the temperature and a thermal fuse protects it (AFM 7-45). Span station approximate.",
});
part(() => { const g = new THREE.CircleGeometry(MAST.r * 0.45, 12); g.rotateY(Math.PI / 2); return g; }, ["pitot"], { pos: [MAST_TIP.x + 0.0005, MAST_TIP.y, PITOT_Z], color: "#0B1014", name: "Pitot opening", note: "Total (ram) pressure enters at the leading edge of the mast (AFM 7.12). Check it is clean and open on the walk-around (AFM 4A).", ext: true });
([[0.5, -1], [1, 0]] as const).forEach(([xc, up], i) => { const m = mastAt(1); part(() => sph(0.0045), ["pitot"], { pos: [m.le - xc * m.c + (up ? 0 : -0.002), m.y + (up < 0 ? -0.001 : 0.02), PITOT_Z], color: "#0B1014", name: "Static orifice", note: i === 0 ? "Static pressure is taken at two orifices, on the lower and rear edges of the pitot-static mast (AFM 7.12)." : "Rear-edge static orifice on the pitot-static mast (AFM 7.12).", ext: true }); });
part(() => box(0.05, 0.03, 0.04), ["pitot"], { pos: [fs(2.3), -0.5, -0.5], color: "#3A9448", name: "Pitot-static filters", note: "Filters against dirt and condensation, reachable from the left wing root (AFM 7-54)." });
part(() => box(0.05, 0.05, 0.04), ["pitot"], { pos: [fs(1.86), -0.3, -0.42], color: "#3A9448", anim: (m) => { m.rotation.z = sim().s.pitot.altStatic ? 0.8 : 0; }, name: "Alternate static valve", note: "Optional (OAM 40-072), under the panel: OPEN uses cabin pressure. 'If Alternate Static is open Emergency Window and Cockpit Vent must be closed' (AFM 7-54, 2-29).", pin: true });
export const STALL_Z = -3.0;
part(() => { const g = new THREE.TorusGeometry(0.022, 0.006, 8, 16); g.rotateY(Math.PI / 2); return g; }, ["pitot"], { pos: P(wingP(STALL_Z, 0, 0).add(V(0.004, 0, 0))), color: "#E0263B", name: "Stall-warning orifice (red ring)", note: "In the left wing leading edge, marked by a red ring. Suction here sounds the horn through a hose (AFM 7-54). Pre-flight: suck on the opening (AFM 4A-6).", ext: true, pin: true });
part(() => sph(0.035), ["pitot"], { pos: P(wingP(STALL_Z, 0.2, 1)), color: "#E0263B", anim: (m) => { const s = sim().s; const vs = 53, ias = s.stall.ias; const xc = clamp(0.25 - ((vs + 15 - ias) / 15) * 0.25, 0, 0.25); m.position.copy(wingP(STALL_Z, xc, xc < 0.02 ? 0 : 1)); m.visible = sysNow() === "pitot"; }, name: "Low-pressure peak", note: "Moves forward around the leading edge as the angle of attack rises; near the stall it reaches the orifice.", ext: true });
/** Stall-warning hose: inside the left wing to the root, under the floor ahead of the pilot's seat, up behind the panel to the horn. */
export const STALL_HOSE: Vec3[] = [P(wingP(STALL_Z, 0.04, 0)), P(wingP(-2.0, 0.2, 0)), P(wingP(-0.6, 0.2, 0)), [fs(2.05), -0.54, -0.36], [PANEL_X + 0.05, -0.45, -0.36], [PANEL_X + 0.05, -0.12, -0.42]];
part(() => tubeGeo(STALL_HOSE, 0.006), ["pitot"], { color: "#3A9448", name: "Stall-warning hose", note: "Runs from the orifice to the horn in the instrument panel (routing assumed)." });
part(() => cyl(0.025, 0.03, "x", 16), ["pitot"], { pos: [PANEL_X + 0.03, -0.12, -0.42], color: "#3A9448", anim: glow("#2A6A34", "#FF4A4A", () => hornLevel(sim().s) > 0, ["pitot"]), name: "Stall-warning horn", note: "In the instrument panel; purely pneumatic — works with no electrical power. Sounds from about 10 to at least 5 kt above the stall, louder as you slow (AFM 7-54).", pin: true });
part(() => box(0.04, 0.03, 0.03), ["pitot", "avionics"], { pos: [PANEL_X + 0.12, 0.02, 0.06], color: "#3A9448", name: "Pitot / static lines to GDC 74A", note: "Green and blue PVC tubing to the GDC 74A and the standby airspeed and altimeter (SMM Fig. 2-2)." });

/* ---------- environment: heating & ventilation ---------- */
part(() => box(0.03, 0.08, 0.02), ["environment"], { pos: [fs(1.87), -0.31, -0.035], color: "#E0522B", anim: (m) => { m.rotation.z = (sim().s.env.heat - 0.5) * 1.4; }, name: "CABIN HEAT lever", note: "Left lever on the small centre console: up = heating ON, down = OFF (AFM 7-18). OFF dumps the heated air overboard at the bottom of the cowling.", pin: true });
part(() => box(0.03, 0.08, 0.02), ["environment"], { pos: [fs(1.87), -0.31, 0.0], color: "#149C94", anim: (m) => { m.rotation.z = (sim().s.env.dist - 0.5) * 1.4; }, name: "DEFROST / FLOOR lever", note: "Centre lever: up = airflow to the canopy (defrost), down = to the floor (AFM 7-18).", pin: true });
part(() => box(0.08, 0.1, 0.12), ["environment"], { pos: [FW - 0.06, -0.4, 0.12], color: "#E0522B", name: "Heat valve", note: "On the firewall: sends muffler-heated air to the cabin, or overboard when OFF (unofficial technical description).", pin: true });
part(() => box(0.08, 0.1, 0.18), ["environment"], { pos: [FW - 0.14, -0.42, 0.0], color: "#149C94", name: "Floor / defrost distributor valve", note: "Behind the firewall under the panel; the distribution lever splits the air between the canopy defrost outlet and the floor outlets.", pin: true });
part(() => box(0.04, 0.012, 0.44), ["environment"], { pos: [DEFROST_X, 0.23, 0], color: "#149C94", name: "Defrost outlet", note: "Hot air onto the base of the canopy to clear mist and frost." });
[1, -1].forEach((s) => part(() => sph(0.03), ["environment"], { pos: [PANEL_X - 0.02, -0.03, s * 0.485], color: "#149C94", name: "Panel air nozzle", note: "Movable ventilation nozzle at each end of the panel; spherical nozzles open and close by twisting (AFM 7-12).", pin: s > 0 }));
[1, -1].forEach((s) => part(() => sph(0.025), ["environment"], { pos: [ROLLBAR_X, RB_NOZZLE.y, s * RB_NOZZLE.z], color: "#149C94", name: "Roll-bar air nozzle", note: "Spherical nozzles in the roll bar beside the front seats and on the central console above the passengers' heads (AFM 7-12).", pin: s > 0 }));
part(() => box(0.22, 0.012, 0.08), ["environment"], { pos: [fs(2.25), wingP(-0.85, 0.08, -1).y - 0.005, -0.85], color: "#149C94", name: "Fresh-air inlet (NACA)", note: "Fresh air enters through an inlet on the bottom of the left stub wing (Suppl. E7; AFM 4A-6 'air intake on lower surface'). A winter baffle may be fitted below 15 °C.", ext: true, pin: true });
part(() => box(0.05, 0.12, 0.03), ["environment", "cabin"], { parent: "canopy", pos: relTo(onSkin(fs(2.35), 0.18, -1, 1.03), CANOPY_HINGE), color: "#149C94", anim: (m) => { m.rotation.y = sim().s.env.window ? 0.6 : 0; }, name: "Canopy emergency window", note: "Opening window on the left of the canopy for ventilation or as an emergency window; close it if the alternate static valve is open (AFM 7-17, 2-29).", pin: true });

/* ---------- canopy / door hardware ---------- */
part(() => box(0.04, 0.03, 0.12), ["cabin"], { parent: "canopy", pos: relTo(onSkin(fs(2.5), -0.03, -1, 1.02), CANOPY_HINGE), color: "#30363B", name: "Canopy handle (left)", note: "Locks the front canopy; position 2 latches the bolts with a cooling gap (ground only). Optional key lock — the placard says it must be unlocked in flight (AFM 7-17, 2-31).", pin: true });
part(() => tubeGeo([[DOOR.x0 - 0.15, 0.25, -0.44], [DOOR.x0 - 0.25, -0.05, -0.47]], 0.01), ["cabin"], { name: "Rear door gas strut", note: "Gas-pressure damper that holds the rear door open; hold the door in strong wind (AFM 7-18)." });
part(() => box(0.04, 0.03, 0.05), ["cabin"], { parent: "door", pos: relTo(onSkin(fs(3.55), 0.0, -1, 1.02), DOOR_HINGE), color: "#C83A3A", name: "Rear door safety lever", note: "Extra lever against unintentional opening. Never try to lock the rear door in flight — it can come off; the airplane flies fine without it (AFM 7-18, 3-40).", pin: true });

/* ---------- lights ---------- */
const tipLE = (s: number): Vec3 => P(wingP(s * 5.62, 0.05, 0));
export const LIGHTS = {
  tipL: tipLE(-1), tipR: tipLE(1),
  aftL: P(wingP(-5.95, 1.0, 0).add(V(-0.02, 0, 0))), aftR: P(wingP(5.95, 1.0, 0).add(V(-0.02, 0, 0))),
  /**
   * Landing and taxi lights built into the left wing leading edge, outboard of the pitot mast: the AFM walk-around checks
   * them after the pitot probe and just before the wing tip (AFM 4A-7). Span stations not in the documents.
   */
  land: P(wingP(-4.45, 0, 0).add(V(0.01, 0, 0))), taxi: P(wingP(-4.7, 0, 0).add(V(0.01, 0, 0))),
  flood: [PANEL_X + 0.06, 0.18, 0] as Vec3,
  instr: [PANEL_X - 0.05, 0.05, -0.1] as Vec3,
  map: [ROLLBAR_X + 0.03, 0.42, -0.2] as Vec3,
};
([[LIGHTS.tipL, "Left wing tip: position (red) + strobe", "Whelen A600-PR-D-28"], [LIGHTS.tipR, "Right wing tip: position (green) + strobe", "Whelen A600-PG-D-28"]] as [Vec3, string, string][]).forEach(([pos, name, pn]) =>
  part(() => sph(0.035), ["lighting"], { pos, color: "#D9D9D9", name, note: `Combined position and strobe (anti-collision) light, ${pn} (AFM 7-44, 6-24). POSITION and STROBE 5 A breakers on MAIN.`, pin: true, ext: true }));
[LIGHTS.aftL, LIGHTS.aftR].forEach((pos, i) => part(() => sph(0.022), ["lighting"], { pos, color: "#D9D9D9", name: "Aft position light (white)", note: "Rear-facing white position light; no separate tail light is listed, so it is assumed to be in the wing-tip units (unverified).", pin: i === 0, ext: true }));
part(() => box(0.03, 0.05, 0.12), ["lighting"], { pos: LIGHTS.land, color: "#F2F2E8", name: "Landing light", note: "Built into the left wing (AFM 7-44): Whelen 70346 or an HID lamp. LANDING 5 A on ESSENTIAL — it stays available on ESS BUS. Placed outboard of the pitot mast, following the walk-around order (AFM 4A-7); exact station not documented.", pin: true, ext: true });
part(() => box(0.03, 0.05, 0.1), ["lighting"], { pos: LIGHTS.taxi, color: "#F2F2E8", name: "Taxi light", note: "Next to the landing light in the left wing. TAXI/MAP 5 A on MAIN — lost on ESS BUS.", pin: true, ext: true });
[1, -1].forEach((s) => part(() => box(0.12, 0.05, 0.06), ["lighting", "electrical"], { pos: P(wingP(s * 1.45, 0.3, 0)), color: "#7A6A3A", name: "Strobe power supply", note: "Whelen A490ATS, LH and RH, arm 2.566 m (AFM 6-24).", pin: s > 0 }));
part(() => box(0.03, 0.01, 0.7), ["lighting"], { pos: LIGHTS.flood, color: "#E8C46A", anim: glow("#6A5A30", "#FFE7B0", () => { const { s, E } = sim(); return E.floodPwr && (s.lights.flood > 0 || s.elec.emerg); }, ["lighting", "electrical"]), name: "Flood light (glareshield EL panel)", note: "Electroluminescent panel above the instrument panel lighting all instruments, levers and switches; FLOOD knob. Emergency-battery powered with HORIZON EMERGENCY ON (AFM 7-42, 7-44).", pin: true });
part(() => sph(0.02), ["lighting", "cabin"], { pos: LIGHTS.map, color: "#E8C46A", name: "Map / reading light", note: "Crew map/reading light (Rivoret), on the TAXI/MAP breaker (AFM 6-24, 1-13). Location not in the documents." });

export type { PartSpec };
