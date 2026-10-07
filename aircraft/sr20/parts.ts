/**
 * Declarative catalogue of every modelled SR20 component.
 * Geometry is built lazily (browser only). Positions are in airplane coordinates unless the
 * part has a `parent`, in which case they are relative to that moving group.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { mergeGeos, roundEnds, sweepGeo } from "@/lib/geometry";
import { mats } from "@/lib/materials";
import { V, clamp, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { useView } from "@/lib/view";
import {
  AB, EF, FIN, FW, HF, HH, HR, HZ, SSPAN, SY, WR, af, box, botY, cyl, fC, fLE, finCut, finHs, finSec, fus, fuselageGeo, hingeX,
  loft, onSkin, paintSkin, pantGeo, planeRing, sC, sLE, sectionSlab, sph, stabSec, topY, tubeGeo, wC, wLE, wT, wY, wingP, wingSec, fRing,
} from "./geometry";
import { live } from "./model";
import { AIL_DRIVE, AIL_SECTOR, CARR, ELEV_HORN, ETT, LEVER_ANG, PEDAL_TT, PULLEYS, RUD_HORN, RUD_HORN_AFT, alongCable, pulleyGeo, sectorGeo } from "./rig";
import { useSR20 } from "./store";

export { chanOfKey };
const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

// The ADAHRS and GIAs sit behind the displays, and the bezels frame them: listed under "tap to locate" but not labelled, so
// their pins don't cover the screens (which carry their own labels on the top bezel edge, Airplane.tsx SCREENS).
export const CAT = new Catalogue("sr20", { quiet: { avionics: ["GSU 75 ADAHRS", "GIA 63W/64W ×2", "PFD bezel", "MFD bezel"] } });
const { part, surfacePivot } = CAT;
const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) => CAT.shell(geo, name, note, skin ? paintSkin : undefined);
export { surfacePivot };

/* ---------- per-frame part animations ---------- */
const sysNow = () => useView.getState().sys;
const firing = () => live.rpm > 100 && useSR20.getState().s.eng.key !== "OFF";
const keyFires = (mag: "R" | "L") => { const k = useSR20.getState().s.eng.key; return k === "BOTH" || k === "START" || k === mag; };
const sparkPhase = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h % 100) / 10; };
/** Spark plug: flashes while its magneto fires (engine view). */
const plugAnim = (mag: "R" | "L", phase: number): PartAnim => (m, t) => {
  const sys = sysNow(), engSys = sys === "engine" || sys === "overview";
  const flash = firing() && keyFires(mag) && Math.sin(t * 18 + phase) > 0.3;
  m.material = engSys && flash ? mats("#6FD8FF").hi : engSys || sys === "propeller" ? mats("#DADFE2").on : mats("#DADFE2").dim;
};
const magAnim = (mag: "R" | "L"): PartAnim => (m) => {
  const sys = sysNow(), engSys = sys === "engine" || sys === "overview";
  m.material = engSys ? (firing() && keyFires(mag) ? mats("#6FD8FF").on : mats("#3E4A52").on) : mats("#3E4A52").dim;
};
const altAnim = (which: "alt1" | "alt2"): PartAnim => (m) => {
  const up = useSR20.getState().E[which], sys = sysNow();
  const show = sys === "overview" || sys === "electrical" || sys === "engine";
  m.material = !show ? mats("#D9960F").dim : up ? mats("#D9960F").hi : mats("#5A5040").on;
};
const brakeAnim = (side: "R" | "L"): PartAnim => (m) => {
  const g = useSR20.getState().s.gear;
  const amt = g.park ? 0.6 : side === "R" ? Math.max(0, g.diff) : Math.max(0, -g.diff);
  m.material = amt > 0.05 ? mats("#FF6A2A").hi : mats("#9AA3AA").on;
};
const selPtrAnim: PartAnim = (m) => {
  const sel = useSR20.getState().s.fuel.sel;
  m.rotation.y = sel === "L" ? Math.PI / 2 : sel === "R" ? -Math.PI / 2 : Math.PI;
};
const altDoorAnim = (x0: number): PartAnim => (m) => { m.position.x = x0 - (useSR20.getState().s.eng.altAir ? 0.05 : 0); };
const suctionAnim: PartAnim = (m) => {
  const aoa = useSR20.getState().s.stall.aoa, xc = clamp(0.32 - (aoa / 14) * 0.32, 0, 0.32);
  m.position.copy(wingP(STALL_Z, xc, aoa >= 14 ? 0 : 1));
  m.visible = sysNow() === "pitot";
};

/* ---------- airframe shells ---------- */
shell(fuselageGeo, "Fuselage", "Composite monocoque with integral roll cage. Cabin runs from the firewall (FS 100) to the aft baggage bulkhead (FS 222).", true);
shell(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.155 * Math.sqrt(1 - t * t * 0.97), t * 0.42)); }
  const g = new THREE.LatheGeometry(pts, 32); g.rotateZ(-Math.PI / 2); g.translate(3.74, -0.13, 0); return g;
}, "Spinner", "Covers the constant-speed propeller hub.");
const wingSpanSt = [WR, 0.9, 1.6, 2.4, 3.2, 4.0, 4.6, 5.2, 5.45, 5.65, 5.78, 5.84];
const sided = (secs: THREE.Vector3[][], s: number) => (s < 0 ? secs.map((r) => r.reverse()) : secs);
[1, -1].forEach((s) => {
  shell(() => loft(sided(wingSpanSt.map((z) => wingSec(s * z, 0, 0.75)), s)), s > 0 ? "Right wing" : "Left wing",
    "Composite torsion box: carbon spar, ribs and bonded skins. Holds a 29.3 gal integral fuel tank and the main gear.");
  [[WR, 0.94], [3.62, 3.68], [5.0, 5.2, 5.45, 5.65, 5.78, 5.84]].forEach((st) =>
    shell(() => loft(sided(st.map((z) => wingSec(s * z, 0.75, 1)), s)), "Wing trailing edge", ""));
  shell(() => loft(sided([...[0, 0.3, 1.0, 1.7, HZ - 0.002].map((z) => stabSec(s * z, 0, EF)), ...[HZ, SSPAN].map((z) => stabSec(s * z, 0, HF))], s)),
    "Horizontal stabilizer", "Single composite structure tip to tip.");
});
shell(() => loft(finHs.map((h) => finSec(h, 0, finCut(h)))), "Vertical stabilizer", "Composite, integral with the fuselage shell; swept leading edge blends into a dorsal fillet.");

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
function surface(key: string, secs: () => THREE.Vector3[][], a: THREE.Vector3, b: THREE.Vector3, sys: SysId[], name: string, note: string) {
  CAT.surface({
    key, pivot: P(a), axis: P(b.clone().sub(a).normalize()), sys, name, note,
    geo: () => { const g = loft(secs()); g.translate(-a.x, -a.y, -a.z); return g; },
  });
}
const hp = (s: number, z: number, xc: number) => { const c = wC(z), [u, l] = af(xc, wT(z), 0.02); return V(wLE(z) - xc * c, wY(z) + ((u + l) / 2) * c, s * z); };
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  const fz = [0.94, 1.8, 2.7, 3.62], az = [3.68, 4.3, 5.0];
  surface("flap" + side, () => sided(fz.map((z) => wingSec(s * z, 0.75, 1)), s), hp(s, fz[0], 0.75), hp(s, fz[3], 0.75), ["flaps", "controls"],
    (s > 0 ? "Right" : "Left") + " flap", "Single-slotted aluminum flap on three hinges. 0% / 50% (16°) / 100% (32°).");
  surface("ail" + side, () => sided(az.map((z) => wingSec(s * z, 0.75, 1)), s), hp(s, az[0], 0.75), hp(s, az[2], 0.75), ["controls"],
    (s > 0 ? "Right" : "Left") + " aileron", "Aluminum, two hinge points. Driven by cable to a sector/crank arm in the wing." + (s > 0 ? " Right aileron carries the ground-adjustable trim tab." : ""));
  const ez = [0.1, 1.0, SSPAN];
  surface("elev" + side, () => sided([...[0.1, 1.0, HZ - 0.002].map((z) => stabSec(s * z, EF, 1)), ...[HZ, SSPAN].map((z) => stabSec(s * z, HF, 1))], s),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]), V(sLE(ez[2]) - EF * sC(ez[2]), SY, s * ez[2]), ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)", "Two-piece aluminum elevator, two hinges per half plus the control sector. Horn-balanced tip.");
});
surface("rudder", () => [-0.2, 0.05, 0.31, 0.52, 0.8, 1.1, HH - 0.002, HH, 1.42, 1.47].map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(-0.2), -0.2, 0), V(hingeX(1.44), 1.44, 0), ["controls"],
  "Rudder", "Aluminum, three hinge points on the fin rear shear web. Extends below the stabilizer to the tailcone tip.");
/** Part attached to a moving control surface; `world` is converted to hinge-relative coords. */
function onSurf(key: string, world: THREE.Vector3, geo: () => THREE.BufferGeometry, o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] }) {
  const pv = surfacePivot(key);
  part(geo, o.sys || ["controls"], { chan: chanOfKey(key), ...o, parent: "surf:" + key, pos: [world.x - pv[0], world.y - pv[1], world.z - pv[2]] });
}

/* ---------- control-surface details (Costanzo deck photos) ---------- */
const wickNote = "Static wick: bleeds static charge off the trailing edge to cut radio noise. Check it's present on preflight.";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * 4.85, 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.13, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true, pin: s > 0 });
  onSurf("elev" + side, V(sLE(1.88) - sC(1.88) - 0.05, SY, s * 1.88), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true });
  onSurf("elev" + side, V(sLE(1.83) - (HF + 0.06) * sC(1.83), SY, s * 1.83), () => box(0.05, 0.03, 0.12), {
    color: "#6E7A84", name: "Elevator horn balance + weight", pin: s > 0,
    note: "The elevator tip reaches forward of the hinge line (horn) with a balance weight inside, reducing control forces and preventing flutter. (Costanzo deck)",
  });
  ([
    [1.0, "Flap hinge bracket + control arm", "Flap hinge bracket. The inboard bracket carries the control arm driven by the flap torque tube. Rub strips on the flap top leading edge protect the cove. (Costanzo deck)", ["flaps"]],
    [2.3, "Flap hinge bracket", "One of three hinges per flap.", ["flaps"]],
    [3.55, "Flap hinge bracket", "One of three hinges per flap.", ["flaps"]],
    [3.95, "Aileron hinge fairing", "One of two hinges per aileron.", ["controls"]],
    [4.85, "Aileron hinge fairing", "One of two hinges per aileron.", ["controls"]],
  ] as [number, string, string, SysId[]][]).forEach(([z, name, note, sys], i) =>
    part(() => box(0.34, 0.05, 0.025), sys, { pos: P(wingP(s * z, 0.74, -1).add(V(-0.02, -0.02, 0))), color: "#C9D0D5", name, note, ext: true, pin: s > 0 && i === 0, chan: sys[0] === "controls" ? ["aileron"] : undefined }));
});
onSurf("ailR", wingP(4.3, 0.99, 0).add(V(-0.03, 0, 0)), () => box(0.07, 0.004, 0.12), { color: "#8C99A3", name: "Aileron trim tab (ground-adjustable)", note: "Right aileron only. Factory-set; bent on the ground to trim out a wing-heavy tendency.", ext: true, pin: true });
onSurf("elevR", V(sLE(0.5) - sC(0.5) - 0.03, SY, 0.5), () => box(0.07, 0.004, 0.14), { color: "#8C99A3", name: "Elevator trim tab (ground-adjustable)", note: "Factory-set tab for small neutral-trim corrections. (Costanzo deck)", ext: true, pin: true });
onSurf("rudder", V(fLE(0.35) - fC(0.35) - 0.03, 0.35, 0), () => box(0.07, 0.14, 0.004), { color: "#8C99A3", name: "Rudder trim tab (ground-adjustable)", note: "Factory-set; the only yaw trim besides the pedal spring cartridge.", ext: true, pin: true });
onSurf("rudder", V(fLE(1.3) - fC(1.3) - 0.05, 1.3, 0), () => cyl(0.004, 0.12, "x", 6), { color: "#2A2F33", name: "Static wick", note: wickNote, ext: true });
onSurf("rudder", V(fLE(1.42) - (HR + 0.05) * fC(1.42), 1.42, 0), () => box(0.06, 0.04, 0.03), { color: "#6E7A84", name: "Rudder horn balance + weight", note: "Top of the rudder extends forward of the hinge with a balance weight — reduces pedal force and flutter risk. (Costanzo deck)", pin: true });

/* ---------- cowl inlets ---------- */
[1, -1].forEach((s) => {
  part(() => { const g = new THREE.TorusGeometry(0.075, 0.018, 8, 20); g.rotateY(Math.PI / 2); g.translate(3.7, -0.13, s * 0.22); return g; }, ["engine", "airframe"], {
    color: "#1E2A33", ext: true, pin: true,
    name: s > 0 ? "Right cowl inlet — induction" : "Left cowl inlet — cooling",
    note: s > 0 ? "Primary induction intake: air passes the filter screen just inside this inlet. Cooling air also enters here. If it clogs, use ALT AIR. (Costanzo deck)" : "Cooling air over the cylinder baffles.",
  });
  part(() => { const g = new THREE.CircleGeometry(0.075, 20); g.rotateY(Math.PI / 2); g.translate(3.695, -0.13, s * 0.22); return g; }, ["engine", "airframe"], { color: "#0B1014", ext: true });
});

/* ---------- landing gear (track ≈ 2.8 m per POH Fig. 1-1) ---------- */
export const MG = { x: 1.12, y: -1.2, z: 1.42 };
[1, -1].forEach((s) => {
  const top = wingP(s * 1.0, 0.28, -1);
  part(() => tubeGeo([[top.x, top.y + 0.02, s * 1.0], [1.14, -0.9, s * 1.22], [MG.x, -1.1, s * 1.36]], 0.04), ["gear"], { name: "Main gear strut", note: "Composite strut bolted to the wing between spar and shear web.", ext: true });
  part(() => cyl(0.19, 0.15, "z", 28), ["gear"], { pos: [MG.x, MG.y, s * MG.z], color: "#2A2F33", name: "Main wheel", note: "15 × 6.00 × 6 tubeless tire.", ext: true });
  part(() => pantGeo(0.92, 0.19), ["gear"], { pos: [MG.x, -1.17, s * MG.z], scale: [1, 1, 0.75], fairing: true, name: "Wheel pant", note: "Removable; access plugs allow tire inflation checks.", ext: true });
  part(() => cyl(0.12, 0.03, "z", 20), ["gear"], {
    pos: [MG.x, MG.y, s * (MG.z - 0.1)], color: "#9AA3AA", ext: true, anim: brakeAnim(s > 0 ? "R" : "L"), name: "Disc brake",
    note: "Single-disc caliper with pads. An orange temperature tab on the caliper turns brown if the brake overheated — inspect. Brake temp sensor also feeds the CAS alerts.",
  });
  part(() => tubeGeo([[2.4, -0.6, s * 0.3], [1.8, -0.58, s * 0.34], [1.28, -0.6, s * 0.8], wingP(s * 1.0, 0.33, -1).add(V(0, 0.012, 0))], 0.011), ["gear"], { name: "Brake line (" + (s > 0 ? "R" : "L") + ")", note: "Master cylinder at each pedal → parking-brake valve → caliper." });
  // down the aft face of the strut (r 0.04), clear of it, to the caliper on the inboard side of the disc
  part(() => tubeGeo([wingP(s * 1.0, 0.33, -1), [MG.x - 0.04, -0.9, s * 1.22], [MG.x - 0.06, -1.13, s * (MG.z - 0.12)]], 0.011), ["gear"], { name: "Brake line (" + (s > 0 ? "R" : "L") + ")", note: "Runs down the aft side of the gear leg to the caliper (routing on the leg approximate).", ext: true });
});
export const NOSE_GEAR: Vec3 = [3.06, -0.52, 0];
export const NOSE_CASTER: Vec3 = [0.22, -0.68, 0];
part(() => tubeGeo([[0, 0, 0], [0.09, -0.34, 0], [0.22, -0.66, 0]], 0.035), ["gear"], { parent: "noseGear", name: "Nose gear strut", note: "Tubular steel on the engine mount; oleo shock absorber. Plastic fairing.", ext: true });
part(() => cyl(0.17, 0.11, "z", 24), ["gear"], { parent: "caster", pos: [0.02, 0, 0], color: "#2A2F33", name: "Nose wheel", note: "5.00 × 5 tire. Free-castering ±85°; steer with differential braking.", ext: true });
part(() => pantGeo(0.7, 0.17), ["gear"], { parent: "caster", pos: [0.02, 0.02, 0], scale: [1, 1, 0.7], fairing: true, name: "Nose wheel pant", note: "", ext: true });
part(() => box(0.04, 0.025, 0.07), ["gear"], { pos: [2.16, -0.17, -0.17], name: "PARK BRAKE handle", note: "Right side kick plate by the pilot's right knee. Set toe brakes, then pull aft. Never set in flight.", pin: true });
[-0.36, -0.14, 0.14, 0.36].forEach((z) => {
  const parent = z < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.04, 0.18, 0.09), ["gear", "controls"], { chan: ["rudder"], parent, pos: [2.42, -0.52, z], rot: [0, 0, 0.35], name: "Rudder pedal / toe brake", note: "Top half is the toe brake. Either pilot's left or right toe brake applies that side's brake. Pushing a pedal forward pulls its rudder cable (POH Fig. 7-3)." });
  part(() => cyl(0.018, 0.1), ["gear"], { parent, pos: [2.45, -0.58, z], color: "#8C959C", name: "Brake master cylinder", note: "One per pedal. Pressing the toe brake pressurizes that side's brake line." });
});

/* ---------- propeller (74 in., 3 blade) ---------- */
export const PROP: Vec3 = [3.8, -0.14, 0];
const bladeGeo = () => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.06, 0.12); sh.quadraticCurveTo(-0.09, 0.5, -0.045, 0.94); sh.lineTo(0.03, 0.94); sh.quadraticCurveTo(0.075, 0.5, 0.06, 0.12); sh.lineTo(-0.06, 0.12);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }); g.translate(0, 0, -0.009); g.rotateY(Math.PI / 2); return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], { parent: "blade:" + i, color: "#3A4148", name: "Propeller blade", note: "Hartzell three-blade, 74 in. constant-speed. Metal standard, composite optional.", ext: true });

/* ---------- engine (IO-390, ~0.87 m wide, inside the cowl) ---------- */
const EY = -0.16;
part(() => box(0.78, 0.26, 0.26), ["engine"], { pos: [3.14, EY, 0], name: "Lycoming IO-390-C3B6", note: "Four-cylinder, horizontally opposed, fuel-injected. 215 hp at 2,700 RPM; 2,200 hr TBO.", pin: true });
part(() => box(0.55, 0.12, 0.26), ["engine"], { pos: [3.08, -0.38, 0], name: "Oil sump", note: "Wet sump, 7 quart capacity. Filler cap/dipstick at right rear via cowl door." });
export const CYLS = [{ n: 1, x: 3.36, s: 1 }, { n: 2, x: 3.22, s: -1 }, { n: 3, x: 2.99, s: 1 }, { n: 4, x: 2.85, s: -1 }];
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.085, 0.2, "z", 18), ["engine"], { parent, color: "#7C858C", name: "Cylinder " + c.n, note: (c.s > 0 ? "Right" : "Left") + " bank. Cooling fins; baffled ram-air cooling (no cowl flaps)." });
  for (let k = -2; k <= 2; k++) part(() => cyl(0.1, 0.01, "z", 18), ["engine"], { parent, pos: [0, 0, k * 0.035], color: "#8C959C" });
  part(() => box(0.19, 0.19, 0.07), ["engine"], { parent, pos: [0, 0, c.s * 0.13], color: "#6A737A", name: "Cylinder head " + c.n, note: "Two spark plugs, CHT probe; EGT probe in the exhaust." });
  ([["U", 0.065], ["L", -0.065]] as const).forEach(([pos, dy]) => {
    const mag = (c.s > 0) === (pos === "L") ? "R" : "L";
    part(() => cyl(0.017, 0.06, "x", 10), ["engine"], {
      parent, pos: [-0.12, dy, c.s * 0.13], color: "#DADFE2", anim: plugAnim(mag, sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`, note: `Fired by the ${mag === "R" ? "right" : "left"} magneto.`,
    });
  });
});
part(() => cyl(0.05, 0.13, "x"), ["engine"], { pos: [2.72, -0.04, 0.11], color: "#3E4A52", anim: magAnim("R"), name: "Right magneto", note: "Fires lower-right and upper-left plugs. Also the tachometer's RPM pickup.", pin: true });
part(() => cyl(0.05, 0.13, "x"), ["engine"], { pos: [2.72, -0.04, -0.11], color: "#3E4A52", anim: magAnim("L"), name: "Left magneto", note: "Fires lower-left and upper-right plugs.", pin: true });
part(() => box(0.1, 0.09, 0.12), ["engine", "propeller"], { pos: [3.55, -0.06, 0], color: "#C0602F", name: "Propeller governor", note: "Flyweights sense RPM; a cable from the power lever sets the target. Boosts engine oil pressure to move blade pitch.", pin: true });
part(() => box(0.08, 0.16, 0.12), ["engine"], { pos: [3.36, -0.1, -0.35], color: "#9A6A48", name: "Oil cooler", note: "Remote-mounted. Valve bypasses it below 170 °F or above an 18 psi pressure drop." });
part(() => box(0.1, 0.12, 0.14), ["engine"], { pos: [3.58, -0.15, 0.2], color: "#C9B98F", name: "Induction air filter", note: "Paper filter screen just inside the right cowl inlet. (Costanzo deck)", pin: true });
part(() => cyl(0.045, 0.11, "x"), ["engine"], { pos: [2.8, -0.02, 0.18], color: "#1F3A5A", name: "Oil filter (full-flow)", note: "Spin-on filter at the accessory case, next to the magnetos. (Costanzo deck)", pin: true });
// under the front of the engine, just forward of the oil sump (x ≤ 3.355) and above the cowl bottom; clear of ALT 1 / ALT 2 (|z| ≥ 0.15)
part(() => cyl(0.055, 0.14, "x"), ["engine", "fuel"], { pos: [3.43, -0.435, 0], color: "#7E8A93", name: "Throttle body / fuel servo", note: "The power lever's cable works the air throttle body on the fuel servo: its butterfly meters air, and the servo meters fuel in proportion to airflow and mixture (POH 7-36). The MAP sensor is on the bottom of the induction air manifold near the throttle body (POH 7-41). The POH doesn't locate the servo: shown under the front of the engine (approximate).", pin: true });
part(() => box(0.03, 0.08, 0.1), ["engine"], { pos: [3.514, -0.15, 0.2], color: "#E0B040", anim: altDoorAnim(3.514), name: "Alternate air door",
  note: "On the engine induction air manifold (POH Section 7, Alternate Air Control); shown on its face just aft of the filter, above ALT 1 — the exact position is approximate. The ALT AIR – PULL knob opens it: bypasses the filter with warm, unfiltered air." });
part(() => cyl(0.06, 0.28, "z"), ["engine", "environment"], { pos: [3.04, -0.44, 0.22], color: "#8A5A3C", name: "Muffler", note: "Single muffler; exhaust exits through the lower cowl. Placed on the right with the heat muff and mixing chamber per the POH environmental section and the Costanzo deck photo (the POH engine paragraph says left)." });
part(() => cyl(0.08, 0.2, "z"), ["environment", "engine"], { pos: [3.04, -0.44, 0.22], color: "#E0522B", fairing: true, name: "Heat exchanger (muff)", note: "Shroud around the muffler; heats ram air for the cabin." });
part(() => cyl(0.07, 0.12, "x"), ["electrical", "engine"], { pos: [3.5, -0.3, 0.22], color: "#D9960F", anim: altAnim("alt1"), name: "ALT 1 — 100 A", note: "Belt-driven, right front. Regulated to 27.7 V. Feeds Main Distribution Bus 1.", pin: true });
part(() => cyl(0.06, 0.11, "x"), ["electrical", "engine"], { pos: [3.5, -0.3, -0.22], color: "#D9960F", anim: altAnim("alt2"), name: "ALT 2 — 70 A", note: "Belt-driven, left front. Regulated to 28.7 V, so it carries the loads it shares with ALT 1.", pin: true });
part(() => box(0.1, 0.12, 0.14), ["engine"], { pos: [2.74, -0.24, 0], color: "#4B5860", name: "Starter / SlickSTART", note: "START energizes the starter and SlickSTART booster (retards timing, hotter spark). Spring-returns to BOTH." });

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe"], { plate: true, pin: true, name: "Firewall — FS 100", note: "Forward cabin boundary. Lower firewall has a 20° bevel for crashworthiness." });
part(() => planeRing(AB), ["airframe", "cabin"], { plate: true, pin: true, name: "Aft bulkhead — FS 222", note: "Rear of the baggage compartment. Avionics bay, BAT 2, ELT and CAPS sit aft of it." });
part(() => {
  const pts: THREE.Vector3[] = [];
  for (let z = -5.3; z <= 5.31; z += 0.5) { const az = Math.max(Math.abs(z), WR); pts.push(V(wLE(az) - 0.3 * wC(az), wY(az) + 0.02 * wC(az), z)); }
  return tubeGeo(pts, 0.04);
}, ["airframe"], { name: "Main spar", note: "Laminated carbon/epoxy C-section, continuous tip to tip. Passes under the front seats.", pin: true });
[0.75, 2.2].forEach((x) => part(() => tubeGeo(fRing(x, 0.93, 30, -0.25, Math.PI + 0.25, false), 0.025), ["airframe"], { name: "Composite roll cage", note: "Built into the fuselage to protect occupants in a rollover.", pin: x === 0.75 }));
([[1.3, -0.62, 0.4], [1.3, -0.62, -0.4], [0.2, -0.4, 0.49], [0.2, -0.4, -0.49]] as Vec3[]).forEach((p, i) =>
  part(() => sph(0.05), ["airframe"], { pos: p, color: "#E0522B", name: "Wing attach point", note: i < 2 ? "Spar attaches under the front seats." : "Rear shear web attaches to the sidewall just aft of the rear seats.", pin: i === 0 || i === 2 }));

/* ---------- cockpit / cabin ---------- */
part(() => sectionSlab(2.3, -0.18, 0.3, 0.97, 0.04, 2.32), ["avionics", "cabin"], { color: "#2B3238", name: "Instrument panel", note: "All-metal sectional panel under a composite glareshield." });
part(() => sectionSlab(2.24, 0.3, 0.35, 0.95, 0.2, 2.36), ["cabin"], { color: "#2B3238", name: "Glareshield", note: "Projects over the panel; windshield diffuser outlet runs along its base." });
// POH Fig. 7-4: the bolster runs between the yokes directly under the displays (switch strip at the PFD's lower edge, MD302
// below it), and the avionics stack of the centre console (item 15) rises in the middle to meet the displays.
part(() => box(0.16, 0.14, 0.8), ["cabin", "lighting", "electrical"], { pos: [2.2, -0.08, 0], color: "#39424A", name: "Bolster switch panel",
  note: "Below the PFD (POH Fig. 7-4 item 18, Fig. 7-12): a placard, then MASTER (BAT 2, BAT 1, ALT 1, ALT 2, AVIONICS) and EXTERIOR LIGHTS (NAV, STROBE, LAND), PITOT HEAT, the ICE PROTECT positions (blank without FIKI), and the PANEL and INSTRUMENT dimmers at the right end. The MD302 standby is below the switches, under the PFD." });
/**
 * Bolster switch strip under the PFD, laid out from POH Fig. 7-12: the strip spans the PFD's width (z −0.385 … −0.10) and
 * `slot` maps the figure's horizontal position (its pixel column, strip 205–625) onto it. The rockers sit close together,
 * five MASTER then the EXTERIOR LIGHTS; PITOT HEAT and the ICE PROTECT positions follow after a gap. Up = ON.
 */
const BOLSTER = { x: 2.12, y: -0.036 };
const slot = (px: number) => -0.385 + (px - 205) * (0.285 / 420);
const SR = () => useSR20.getState().s;
part(() => box(0.004, 0.048, 0.285), ["cabin", "lighting", "electrical"], { pos: [BOLSTER.x - 0.001, BOLSTER.y, slot(415)], color: "#20262B" });
part(() => box(0.003, 0.03, 0.06), ["cabin"], { pos: [BOLSTER.x - 0.004, BOLSTER.y, slot(255)], color: "#9AA3AA" });
([[312, "BAT 2", "Battery 2 relay: BAT 2 feeds ESS BUS 1 and charges from it.", () => SR().elec.bat2],
  [329, "BAT 1", "Battery 1 relay: BAT 1 on the Main Dist Bus 1 side, for starting; ALT 1 needs it on.", () => SR().elec.bat1],
  [346, "ALT 1", "Alternator 1 field; needs BAT 1 on.", () => SR().elec.alt1],
  [363, "ALT 2", "Alternator 2 field.", () => SR().elec.alt2],
  [380, "AVIONICS", "AVIONICS bus.", () => SR().elec.avionics],
  [397, "NAV", "Wingtip position and aft position lights.", () => SR().lights.nav],
  [414, "STROBE", "Wingtip anti-collision strobes.", () => SR().lights.strobe],
  [431, "LAND", "Both wingtip landing lights.", () => SR().lights.land],
  [448, "ICE", "Wing ice inspection lights. Fig. 7-12 shows only NAV, STROBE and LAND (exterior lighting is in the Spectra wing tip light supplement): shown after LAND, position approximate.", () => SR().lights.ice],
  [470, "PITOT HEAT", "Heated pitot tube; a current sensor drives PITOT HEAT FAIL.", () => SR().pitot.heat],
] as [number, string, string, () => boolean][]).forEach(([px, label, note, on]) =>
  part(() => box(0.01, 0.02, 0.0095), ["electrical", "lighting"], { pos: [BOLSTER.x - 0.007, BOLSTER.y, slot(px)], color: "#D8DDE0",
    anim: (m) => { m.rotation.z = on() ? -0.3 : 0.3; }, name: label + " switch", note: note + " Bolster switch panel (POH Fig. 7-12), up = ON." }));
// ICE PROTECT positions (blank on a non-FIKI airplane) and the wider blank slot before the dimmers
([[495, 0.0095], [512, 0.0095], [537, 0.02]] as [number, number][]).forEach(([px, w]) =>
  part(() => box(0.004, 0.02, w), ["cabin"], { pos: [BOLSTER.x - 0.004, BOLSTER.y, slot(px)], color: "#3A4148" }));
([[0.012, "PANEL dimmer"], [-0.012, "INSTRUMENT dimmer"]] as [number, string][]).forEach(([dy, name]) =>
  part(() => cyl(0.008, 0.014, "x", 16), ["lighting"], { pos: [BOLSTER.x - 0.008, BOLSTER.y + dy, slot(588)], color: "#20262B", name, note: "Right end of the bolster switch panel: PANEL above, INSTRUMENT below (POH Fig. 7-12)." }));
// POH 7-13, Fig. 7-4 item 19: left side of the instrument panel, outboard of the PFD; above the yoke tube here (height approximate)
part(() => cyl(0.016, 0.01, "x"), ["engine", "electrical"], { pos: [2.276, 0.03, -0.47], color: "#3E4A52" });
part(() => box(0.012, 0.03, 0.008), ["engine", "electrical"], { pos: [2.266, 0.03, -0.47], color: "#C9D0D5",
  anim: (m) => { m.rotation.x = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[SR().eng.key]; }, name: "Ignition key switch", pin: true, pinIn: ["engine"],
  note: "Keyed rotary switch on the left side of the instrument panel, outboard of the PFD: OFF – R – L – BOTH – START, spring-loaded from START to BOTH (POH 7-13, Fig. 7-4 item 19)." });
part(() => box(0.9, 0.26, 0.26), ["cabin"], { pos: [1.63, -0.4, 0], color: "#39424A", name: "Center console", note: "Horizontal section between the seats: power and mixture levers, fuel selector, armrest; breakers, ALT AIR, ELT switch and alternate static on its left side. The avionics stack and flap switch are on its upright front section." });
// upright front section of the console (Fig. 7-4 item 15, POH 7-13, 7-76), top to bottom: GCU 479 FMS keyboard, GMC 707 autopilot
// mode controller, GMA 350 audio panel, then the flap control at its foot (order from Fig. 7-4; heights approximate)
part(() => box(0.2, 0.52, 0.17), ["cabin", "avionics"], { pos: [2.18, -0.27, 0.005], color: "#39424A", name: "Avionics panel (centre console)",
  note: "Upright front section of the centre console, rising between the bolster halves to meet the displays: FMS keyboard, autopilot mode controller and audio panel, with the flap control at its foot (POH 7-13, Fig. 7-4 items 10 and 15)." });
part(() => box(0.4, 0.18, 0.02), ["electrical"], { pos: [1.78, -0.4, -0.14], color: "#5A4A1C", name: "Circuit breaker panel", note: "Left side of the center console. Holds ESS 1/2, MAIN 1/2/3, NON ESS, A/C 1/2 and AVIONICS bus breakers.", pin: true });
([[1.25, -0.33, "Pilot seat", 0.4], [1.25, 0.33, "Front passenger seat", 0.4], [0.35, -0.24, "Rear seat (2+1 bench)", 0.46], [0.35, 0.28, "Rear seat", 0.4]] as [number, number, string, number][]).forEach(([x, z, name, w], i) => {
  part(() => box(0.48, 0.1, w), ["cabin"], { pos: [x, -0.4, z], color: "#6B5A48", name, note: i < 2 ? "Adjusts fore/aft on an upward-angled track. Honeycomb core crushes to absorb vertical impact — never stand on it." : "Seat backs split 60/40 and fold forward for long cargo." });
  part(() => box(0.09, 0.58, w * 0.92), ["cabin"], { pos: [x - 0.27, -0.08, z], rot: [0, 0, 0.2], color: "#6B5A48", name, note: i < 2 ? "4-point harness with inflatable shoulder belt (airbag)." : "3-point harness on inertia reels at the rear bulkhead." });
});
export const YOKES = [{ side: "L", z: -0.46 }, { side: "R", z: 0.46 }];
export const YOKE_X = 2.02, YOKE_Y = -0.06;
/**
 * Side-yoke grip in its roll group's frame (origin where the yoke tube meets the grip; s −1 left, +1 right): a handle rising
 * up and inboard from the tube end to a head that carries the trim switch (outboard) and the red A/P DISC button (inboard).
 * The POH gives no dimensions: shape and proportions are from photos of the Perspective panel.
 */
const GRIP_LEAN = 37 * (Math.PI / 180);
/** Point in side s's grip frame: xo fore-aft, d along the handle (+ up, toward the head), w across it (+ toward the right wing). */
const onGrip = (s: number, xo: number, d: number, w: number): Vec3 =>
  [xo, d * Math.cos(GRIP_LEAN) + w * s * Math.sin(GRIP_LEAN), -s * d * Math.sin(GRIP_LEAN) + w * Math.cos(GRIP_LEAN)];
const gripRot = (s: number): Vec3 => [-s * GRIP_LEAN, 0, 0];
const HEAD = { d: 0.114, x: -0.01, l: 0.04 };
function sideYokeGeo(s: number) {
  const handle = sweepGeo([onGrip(s, 0.002, -0.05, 0), onGrip(s, 0.006, 0, 0), onGrip(s, 0.003, 0.05, 0), onGrip(s, -0.006, HEAD.d - 0.01, 0)],
    (t) => { const e = roundEnds(t, 0.14, 0); return [(0.019 + 0.002 * Math.sin(Math.PI * t)) * e, 0.017 * e]; });
  const head = new RoundedBoxGeometry(0.054, HEAD.l, 0.048, 3, 0.013);
  head.rotateX(gripRot(s)[0]);
  head.translate(...onGrip(s, HEAD.x, HEAD.d, 0));
  const boss = cyl(0.022, 0.036, "x");
  boss.translate(0.016, 0, 0);
  return mergeGeos([handle, head, boss]);
}
YOKES.forEach(({ side }) => {
  const s = side === "L" ? -1 : 1, grip = "grip:" + side, top = HEAD.d + HEAD.l / 2;
  part(() => cyl(0.018, 0.5, "x"), ["controls"], { parent: "yoke:" + side, chan: ["elevator", "aileron"], pos: [0.27, 0, 0], color: "#555E66", name: "Yoke tube", note: "Slides fore/aft in its bearing carriage for pitch (driving the elevator drop link) and rotates the carriage for roll." });
  part(() => sideYokeGeo(s), ["controls"], { parent: grip, chan: ["elevator", "aileron"], color: "#20262B", name: "Side yoke",
    note: "Single-handed grip on the end of each yoke tube, angled up and inboard. Push or pull to slide the tube for pitch; rotate the grip to turn the tube and its bearing carriage for roll. Conical trim switch and red A/P DISC button on the head; PTT switch for COM." });
  part(() => { const g = new THREE.CylinderGeometry(0.004, 0.008, 0.012, 16); g.translate(0, 0.006, 0); return g; }, ["controls"], { parent: grip, chan: ["elevator", "aileron"],
    pos: onGrip(s, HEAD.x - 0.004, top, s * 0.01), rot: gripRot(s), color: "#4A535B", name: "Trim switch", note: "Conical switch on the head of each yoke: fore/aft = pitch trim, left/right = roll trim. The trim motors move the spring cartridges' neutral point (PITCH TRIM and ROLL TRIM breakers, ESS BUS 2)." });
  part(() => cyl(0.0065, 0.006), ["controls"], { parent: grip, chan: ["elevator", "aileron"], pos: onGrip(s, HEAD.x + 0.004, top + 0.002, -s * 0.011), rot: gripRot(s), color: "#C8313B",
    name: "A/P DISC button", note: "Red autopilot disconnect button on the head of each yoke: disengages the GFC 700." });
});
part(() => box(0.08, 0.05, 0.05), ["controls"], { pos: [-2.66, 0.05, 0.04], color: "#9F85E6", chan: ["elevator"], name: "Pitch trim cartridge", note: "Electric motor shifts the spring cartridge's neutral point. 2 A PITCH TRIM breaker, ESS BUS 2." });
part(() => box(0.08, 0.04, 0.06), ["controls"], { pos: P(wingP(-3.4, 0.66, 0)), color: "#9F85E6", chan: ["aileron"], name: "Roll trim cartridge", note: "Spring cartridge at the left actuation pulley. Autopilot also uses it. 2 A ROLL TRIM, ESS BUS 2." });
part(() => box(0.08, 0.04, 0.06), ["controls"], { pos: [PEDAL_TT.x - 0.05, PEDAL_TT.y, -0.22], color: "#9F85E6", chan: ["rudder"], name: "Yaw trim spring cartridge", note: "Centering spring on the pedal torque tube. Ground-adjustable only." });
export const FT = { x: 0.66, y: -0.54 };
part(() => cyl(0.02, 1.9, "z"), ["flaps"], { pos: [FT.x, FT.y, 0], color: "#9F85E6", name: "Flap torque tube", note: "Mechanically ties both flaps to one actuator." });
part(() => box(0.24, 0.07, 0.09), ["flaps"], { pos: [FT.x + 0.02, FT.y + 0.02, 0], color: "#7C57CF", name: "Flap actuator", note: "Motorized linear actuator; proximity switches stop travel and drive the position lights. 10 A FLAPS, NON ESS BUS.", pin: true });
// POH 7-23: at the bottom of the console's vertical section. Fig. 7-4 (7-14/7-15) item 10 is the panel between the avionics panel
// (15) and the engine controls (13), knob on its right: here at the foot of the upright avionics panel, right of centre.
part(() => box(0.04, 0.04, 0.07), ["flaps"], { pos: [2.06, -0.235, 0.04], color: "#7C57CF", name: "FLAPS switch", pin: true,
  note: "Airfoil-shaped knob at the bottom of the console's vertical section, with detents at UP (0%), 50% and 100%; VFE is marked at 50% and 100%. A light at each position comes on when the flaps reach it: UP green, 50% and 100% yellow (POH 7-23, Fig. 7-4 item 10). Position in the model is approximate." });
part(() => cyl(0.045, 0.03, "y"), ["fuel"], { pos: [1.24, -0.25, 0], name: "Fuel selector valve", note: "LEFT / RIGHT / OFF at the rear of the console. Lift the release to select OFF.", pin: true });
part(() => box(0.09, 0.02, 0.02), ["fuel"], { pos: [1.24, -0.23, 0], color: "#F2F5F7", anim: selPtrAnim });
part(() => box(0.04, 0.03, 0.04), ["fuel"], { pos: [1.34, -0.26, 0.08], name: "BOOST PUMP switch", note: "Next to the selector. On for takeoff, climb, maneuvering, landing and tank switching." });
part(() => new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), ["caps", "cabin"], { pos: [1.3, 0.63, -0.02], color: "#D32640", name: "CAPS activation T-handle", note: "Ceiling, centerline, above the pilot's right shoulder. Pull ~2 in. of slack, then pull straight down (up to 45 lb).", pin: true });
part(() => box(0.03, 0.02, 0.15), ["caps", "cabin"], { pos: [1.3, 0.58, -0.02], color: "#D32640" });
part(() => cyl(0.04, 0.24), ["cabin"], { pos: [2.18, -0.45, -0.5], color: "#D32640", name: "Fire extinguisher", note: "Halon 1211, class B & C. Forward outboard in the pilot footwell. About 2.5 lb; check gauge/pin preflight.", pin: true });
part(() => box(0.22, 0.05, 0.12), ["cabin"], { pos: [1.45, -0.24, 0], color: "#8A6A3A", name: "Armrest: egress hammer & hour meters", note: "8 oz ball-peen hammer for breaking the acrylic windows. HOBBS runs with BAT 1 + either ALT on; FLIGHT starts ~35 KIAS.", pin: true });
part(() => box(0.16, 0.09, 0.11), ["cabin", "caps"], { pos: [-0.8, -0.28, 0.13], color: "#EB7A12", name: "ELT — Artex ELT 1000", note: "406 MHz + 121.5 MHz. Triggers at 4–5 ft/s longitudinal Δv or on CAPS deployment. Removable for portable use.", pin: true });
// both stand proud of the circuit breaker panel face (z −0.15) on the left side of the console
part(() => box(0.05, 0.04, 0.02), ["cabin"], { pos: [1.92, -0.44, -0.161], color: "#EB7A12", name: "ELT remote switch (RCPI)", note: "ON – ARM/OFF – TEST, red LED flashes when transmitting. Below the ALT AIR knob by the pilot's right knee (POH Section 7, ELT Remote Switch and Indicator Panel)." });
part(() => box(0.05, 0.05, 0.03), ["engine"], { pos: [1.92, -0.36, -0.166], color: "#E0B040", name: "ALT AIR – PULL knob", note: "On the left side of the console near the pilot's right knee. Press the lock button, pull, release: opens the alternate air door. Use if induction filter blockage is suspected (POH Section 7, Alternate Air Control)." });

/* ---------- electrical ---------- */
part(() => box(0.07, 0.18, 0.14), ["electrical"], { pos: [2.66, -0.08, -0.33], name: "Master Control Unit", note: "Left firewall. Regulates both alternators, houses the three distribution buses, fuses, the MDB1→MDB2 diode and the starter/external-power relays.", pin: true });
part(() => box(0.13, 0.17, 0.2), ["electrical"], { pos: [2.7, -0.04, 0.34], name: "BAT 1 — 24 V, 11 Ah", note: "Lead-acid, right firewall. Charged from Main Dist Bus 1; used for starting (POH 7-49).", pin: true });
part(() => box(0.2, 0.13, 0.26), ["electrical"], { pos: [-0.76, 0, 0], name: "BAT 2 — 2 × 12 V, 7 Ah", note: "Sealed lead-acid pair in series, aft of FS 222 below the parachute canister. Charged from ESS BUS 1.", pin: true });
part(() => box(0.08, 0.07, 0.02), ["electrical"], { pos: [2.45, -0.3, -0.6], name: "Ground service receptacle", note: "Left side just aft of the cowl. Regulated 28 V; works only with BAT 1 on.", ext: true });

/* ---------- avionics ---------- */
// GDU 1050A bezels around the 0.211 × 0.158 m screens (Airplane.tsx SCREENS), sized from the Pilot's Guide drawing (approximate):
// ≈1.31 × 1.25 of the screen, knobs on the inboard edges, softkeys below. The inboard control strips nearly meet, with a narrow
// strip between them carrying the red DISPLAY BACKUP button at the top (PG Fig 1-2, 1-6; Perspective+ brochure).
const BEZEL_Z = { pfd: -0.241, mfd: 0.054 } as const;
part(() => box(0.014, 0.198, 0.276), ["avionics"], { pos: [2.285, 0.092, BEZEL_Z.pfd], color: "#15181B", name: "PFD bezel", pin: true,
  note: "COM volume and frequency knobs, BARO, RANGE joystick, menu keys and the FMS knob on its right (inboard) edge; 12 softkeys under the screen." });
part(() => box(0.014, 0.198, 0.276), ["avionics"], { pos: [2.285, 0.092, BEZEL_Z.mfd], color: "#15181B", name: "MFD bezel", pin: true,
  note: "NAV volume and frequency knobs at the top of its left (inboard) edge; 12 softkeys under the screen." });
part(() => cyl(0.008, 0.012, "x"), ["avionics"], { pos: [2.274, 0.165, -0.0935], color: "#D32640", name: "DISPLAY BACKUP button",
  note: "Puts both displays in reversionary mode: PFD instruments plus the Engine Strip. Press again to exit. The other display reverts on its own if one fails (POH 7-72)." });
// bezel controls (decorative): knobs on each inboard strip (PFD: COM volume, COM, BARO, RANGE, FMS; MFD: NAV volume, NAV), 12 softkeys under each screen
const KNOB = "#2C3136";
for (const [y, r] of [[0.165, 0.008], [0.127, 0.011], [0.089, 0.009], [0.055, 0.007], [0.008, 0.011]] as const)
  part(() => cyl(r, 0.014, "x"), ["avionics"], { pos: [2.272, y, BEZEL_Z.pfd + 0.121], color: KNOB });
for (const [y, r] of [[0.165, 0.008], [0.127, 0.011]] as const)
  part(() => cyl(r, 0.014, "x"), ["avionics"], { pos: [2.272, y, BEZEL_Z.mfd - 0.121], color: KNOB });
for (const z0 of [BEZEL_Z.pfd, BEZEL_Z.mfd]) for (let i = 0; i < 12; i++)
  part(() => box(0.004, 0.006, 0.012), ["avionics"], { pos: [2.277, 0.008, z0 + (i - 5.5) * 0.0176], color: KNOB });
part(() => box(0.1, 0.09, 0.15), ["avionics", "pitot"], { pos: [2.43, 0.1, -0.24], name: "GSU 75 ADAHRS", note: "Behind the PFD: attitude/heading reference plus air data computer. ADAHRS 1 on ESS BUS 1.", pin: true });
part(() => box(0.12, 0.11, 0.15), ["avionics"], { pos: [2.44, 0.12, 0.2], name: "GIA 63W/64W ×2", note: "Integrated avionics units: WAAS GPS, VHF COM/NAV/GS, integration. GIA 1 on ESS BUS 1, GIA 2 on MAIN BUS 2.", pin: true });
part(() => box(0.1, 0.07, 0.1), ["avionics", "engine"], { pos: [2.44, -0.04, 0.3], name: "GEA 71 Engine Airframe Unit", note: "Digitizes fuel, CHT, EGT, MAP, RPM and other sensors. 3 A ENGINE INSTR on ESS BUS 2." });
part(() => box(0.012, 0.085, 0.15), ["avionics"], { pos: [2.074, -0.055, 0.005], color: "#15181B", name: "GCU 479 FMS keyboard", note: "Upper section of the centre console, just below the displays (POH 7-76). Data entry, tuning, course. KEYPADS / AP CTRL on MAIN BUS 1." });
part(() => box(0.012, 0.04, 0.15), ["avionics", "controls"], { pos: [2.074, -0.125, 0.005], color: "#15181B", name: "GMC 707 autopilot mode controller", note: "GFC 700 mode controller, below the FMS keyboard in the centre console (POH 7-73; position from Fig. 7-4, approximate)." });
part(() => box(0.012, 0.045, 0.15), ["avionics"], { pos: [2.074, -0.18, 0.005], color: "#15181B", name: "GMA 350 audio panel", note: "Audio panel with marker beacon receiver, below the autopilot controller in the centre console (POH 7-73; position from Fig. 7-4, approximate)." });
part(() => box(0.16, 0.09, 0.12), ["avionics"], { pos: [-1.15, -0.08, -0.1], name: "GTX 335/345 transponder", note: "In the empennage avionics bay. XPONDER breaker on the AVIONICS bus." });
const ANT = "#C8399F";
part(() => cyl(0.007, 0.3), ["avionics"], { pos: [0.45, 0.82, 0], rot: [0, 0, 0.45], color: ANT, name: "COM 1 antenna", note: "Rod on top above the passenger compartment.", ext: true });
part(() => cyl(0.007, 0.26), ["avionics"], { pos: [-0.35, -0.7, 0], rot: [0, 0, -0.45], color: ANT, name: "COM 2 antenna", note: "Rod below the baggage compartment.", ext: true });
part(() => cyl(0.05, 0.015), ["avionics"], { pos: [1.0, 0.72, 0], color: ANT, name: "GPS 1 antenna", note: "Above the passenger compartment (GPS/XM combo if XM installed).", ext: true });
part(() => cyl(0.05, 0.015), ["avionics"], { pos: [-0.28, 0.54, 0], color: ANT, name: "GPS 2 / Iridium antenna", note: "Just forward of the baggage-compartment window.", ext: true });
part(() => box(0.2, 0.015, 0.015), ["avionics"], { pos: [-3.36, 1.48, 0], color: ANT, name: "NAV antenna", note: "Top of the fin: VOR/LOC and glideslope for both GIAs.", ext: true });
part(() => box(0.08, 0.08, 0.01), ["avionics"], { pos: [-0.72, -0.57, 0.12], color: ANT, name: "Transponder antenna", note: "Belly, just aft of the baggage bulkhead, right side.", ext: true });
part(() => box(0.2, 0.012, 0.08), ["avionics"], { pos: [0.25, topY(0.25) + 0.004, 0], color: ANT, name: "Stormscope antenna (optional)", note: "Lightning-detection antenna directly above the passenger compartment.", ext: true });
part(() => box(0.14, 0.06, 0.012), ["avionics"], { pos: [1.45, topY(1.45) + 0.03, 0], color: ANT, name: "Traffic antenna, top (optional)", note: "Just above the pilot/copilot compartment; a second traffic antenna sits under the belly.", ext: true });
part(() => box(0.3, 0.012, 0.1), ["avionics"], { pos: [-0.25, botY(-0.25) - 0.004, 0], color: ANT, name: "Marker beacon antenna", note: "Sled type, below the baggage compartment floor.", ext: true });
part(() => box(0.1, 0.06, 0.012), ["avionics"], { pos: [2.3, botY(2.3) - 0.03, 0.1], color: ANT, name: "DME antenna (optional)", note: "Blade on the belly just aft and right of the firewall.", ext: true });
part(() => box(0.07, 0.04, 0.07), ["avionics"], { pos: P(wingP(-4.9, 0.45, 0)), color: ANT, name: "Magnetometer (MAG 1)", note: "Senses the local magnetic field for AHRS heading. Mounted out near a wing tip, away from ferrous masses. Exact location approximate.", pin: true });

/* ---------- pitot-static & stall ---------- */
export const PITOT_Z = -3.2;
export const pitotBase = wingP(PITOT_Z, 0.3, -1);
part(() => tubeGeo([pitotBase, [pitotBase.x, pitotBase.y - 0.16, PITOT_Z]], 0.013), ["pitot"], { name: "Pitot mast", note: "Single heated pitot, left wing underside.", ext: true });
part(() => cyl(0.016, 0.28, "x"), ["pitot"], { pos: [pitotBase.x + 0.11, pitotBase.y - 0.16, PITOT_Z], name: "Heated pitot tube", note: "Element heated when PITOT HEAT is on. 7.5 A breaker on NON ESS BUS; current sensor drives PITOT HEAT FAIL.", pin: true, ext: true });
export const SPX = -1.6;
export const statR = fus(SPX);
[1, -1].forEach((s) => part(() => cyl(0.025, 0.006, "z"), ["pitot"], { pos: [SPX, statR.cy, s * statR.hw], color: "#3A9448", name: "Static port (" + (s > 0 ? "R" : "L") + ")", note: "Dual static ports in the fuselage.", pin: s > 0, ext: true }));
part(() => box(0.05, 0.05, 0.03), ["pitot"], { pos: [1.84, -0.3, -0.14], color: "#3A9448", name: "Alternate static valve", note: "Console, right of the pilot's leg. Uses cabin pressure; apply Section 5 corrections.", pin: true });
part(() => box(0.05, 0.04, 0.05), ["pitot"], { pos: [0.9, -0.62, 0], color: "#3A9448", name: "Water traps", note: "Drains at pitot/static low points under the cabin floor. Drain at annual or when water suspected." });
export const STALL_Z = 3.0;
part(() => sph(0.025), ["pitot"], { pos: P(wingP(STALL_Z, 0, 0)), color: "#3A9448", name: "Stall warning inlet", note: "Right wing leading edge. Sucks as the low-pressure peak moves forward near stall → pressure switch → horn, red STALL, autopilot disconnect.", pin: true, ext: true });
part(() => sph(0.04), ["pitot"], { pos: P(wingP(STALL_Z, 0.3, 1)), color: "#E0263B", anim: suctionAnim, name: "Low-pressure peak", note: "Moves forward around the leading edge as angle of attack increases.", ext: true });
[-2.15, -2.3].forEach((z, i) => {
  const b = wingP(z, 0.45, -1);
  part(() => tubeGeo([b.clone().add(V(0, 0.01, 0)), b.clone().add(V(0.01, -0.07, 0))], 0.006), ["pitot", "avionics"], { color: "#8C959C", name: "OAT probes", note: "Two outside-air-temperature probes under the left wing feed the air data computers (location per Costanzo deck photo).", ext: true, pin: i === 0 });
});

/* ---------- fuel system hardware (tanks are rendered separately) ---------- */
[1, -1].forEach((s) => {
  part(() => box(0.2, 0.07, 0.16), ["fuel"], { pos: P(wingP(s * 0.72, 0.45, 0)), name: (s > 0 ? "Right" : "Left") + " collector tank / sump", note: "Tank fuel gravity-feeds through strainers and a flapper valve into the collector. Flush drain." });
  part(() => box(0.08, 0.012, 0.12), ["fuel"], { pos: P(wingP(s * 5.1, 0.45, -1).add(V(0, -0.006, 0))), color: "#2F7FE6", name: "NACA fuel vent", note: "Under the wing near the tip. A blocked vent starves the engine — check it preflight.", ext: true });
  part(() => sph(0.025), ["fuel"], { pos: P(wingP(s * 1.3, 0.3, -1)), color: "#0B3A80", name: "Tank drain", note: "One of 5 drains: 2 tank, 2 collector, 1 gascolator. Sample before every flight.", ext: true });
  part(() => cyl(0.045, 0.012), ["fuel"], { pos: P(wingP(s * 2.7, 0.38, 1)), color: "#2F7FE6", name: "Filler cap", note: "Top of each wing. Filling to the tab = 13 gal usable per side.", ext: true });
});
part(() => box(0.1, 0.08, 0.1), ["fuel"], { pos: [1.66, -0.62, 0.1], name: "Electric boost pump", note: "Single-speed, continuous 23 psi boost for priming, vapor suppression and backup. 5 A FUEL PUMP, MAIN BUS 2.", pin: true });
part(() => cyl(0.045, 0.1), ["fuel"], { pos: [2.7, -0.52, 0.08], name: "Gascolator", note: "Filter/sump at the low point ahead of the firewall. Drain preflight.", pin: true });
part(() => cyl(0.045, 0.09, "x"), ["fuel", "engine"], { pos: [2.8, -0.3, 0.12], name: "Engine-driven fuel pump", note: "Draws fuel from the selected collector and pressure-feeds the servo." });
part(() => box(0.07, 0.05, 0.07), ["fuel", "engine"], { pos: [3.1, 0, 0], name: "Flow divider (“the spider”) + FF transducer", note: "Top of the engine. Distributes metered fuel to four injector nozzles; fuel flow is measured just upstream.", pin: true });

/* ---------- environmental ---------- */
part(() => box(0.1, 0.03, 0.02), ["environment"], { pos: [3.42, -0.38, 0.49], name: "NACA fresh-air inlet", note: "Lower right cowl. Ram air for ventilation and the heat muff.", pin: true, ext: true });
part(() => box(0.1, 0.12, 0.14), ["environment"], { pos: [2.54, -0.46, 0.3], name: "Mixing chamber", note: "Lower right firewall. Hot-air and fresh-air valves on the forward side set the blend.", pin: true });
// above the aileron push rod (y −0.2) and the central pulley sector below it; must match E0 in flows.ts
part(() => box(0.08, 0.12, 0.28), ["environment"], { pos: [2.52, -0.1, 0], name: "Distribution manifold + fan", note: "Mounted to the center, aft side of the firewall (POH 7-69, 7-70); its height on the firewall is approximate. Butterfly valves feed floor and defrost; the panel vents are always fed. Blower: OFF (ram air), 1, 2, 3.", pin: true });
part(() => box(0.2, 0.07, 0.2), ["environment"], { pos: [1.25, -0.58, 0.33], color: "#6EC9E6", name: "A/C evaporator (optional)", note: "Under the front passenger seat. Condensate drains overboard through the belly." });

/* ---------- CAPS ---------- */
export const CAPS_BOX: Vec3 = [-0.76, 0.22, 0];
part(() => box(0.4, 0.18, 0.26), ["caps"], { pos: CAPS_BOX, name: "CAPS canister", note: "Composite box aft of the baggage bulkhead holding the 2,400 ft² canopy and solid-propellant rocket, under a thin composite cover.", pin: true });
export const HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = { fwdL: [2.55, 0.1, -0.4], fwdR: [2.55, 0.1, 0.4], aft: [AB, 0.2, 0] };
[-1, 1].forEach((s) => part(() => tubeGeo([[-0.6, 0.3, s * 0.12], [0, 0.5, s * 0.25], [1.2, 0.6, s * 0.3], [2.0, 0.45, s * 0.35], [2.55, 0.1, s * 0.4]], 0.012), ["caps"], { name: "Forward harness strap", note: "Runs just under the skin to the firewall; tears through the covering during deployment.", pin: s > 0 }));
part(() => tubeGeo([[-0.62, 0.24, 0], [AB, 0.2, 0]], 0.014), ["caps"], { name: "Aft harness strap", note: "Attaches at the aft baggage bulkhead." });

/* ---------- lights ---------- */
const tipAt = (s: number): Vec3 => [wLE(5.84) - 0.5 * wC(5.84), wY(5.84), s * 5.85];
const iceAt = (s: number) => onSkin(2.02, -0.34, s);
export const LIGHTS = {
  // wingtip assemblies: forward nav + strobe, aft-facing white position light, leading-edge landing light
  tipL: tipAt(-1), tipR: tipAt(1),
  aftL: P(wingP(-5.8, 0.93, 0).add(V(-0.02, 0, -0.01))), aftR: P(wingP(5.8, 0.93, 0).add(V(-0.02, 0, 0.01))),
  landL: P(wingP(-5.5, 0, 0).add(V(0.01, 0, 0))), landR: P(wingP(5.5, 0, 0).add(V(0.01, 0, 0))),
  /** Ice inspection lights on the fuselage sides, aimed at each wing leading edge. */
  iceL: P(iceAt(-1)), iceR: P(iceAt(1)),
  iceAimL: P(wingP(-2.4, 0.02, 1)), iceAimR: P(wingP(2.4, 0.02, 1)),
  dome: [1.2, 0.64, 0] as Vec3,
  foot: [[2.2, -0.55, -0.35], [2.2, -0.55, 0.35], [0.8, -0.56, -0.35], [0.8, -0.56, 0.35]] as Vec3[],
  step: [[1.55, -0.74, -0.52], [1.55, -0.74, 0.52]] as Vec3[],
  bag: [-0.3, 0.48, 0] as Vec3,
};
([["Dome light", LIGHTS.dome, false], ["Footwell light", LIGHTS.foot[0], false], ["Entry step light", LIGHTS.step[0], true], ["Baggage light", LIGHTS.bag, false]] as [string, Vec3, boolean][]).forEach(([name, pos, ext]) =>
  part(() => sph(0.022), ["lighting"], { pos, color: "#E8C46A", name, note: "Convenience lighting, 5 A CONV LIGHTS breaker on the CONV bus (BAT 1 direct).", pin: true, ext }));
const EXT = "#D9D9D9";
([[LIGHTS.tipL, "Left wingtip: nav (red) + strobe"], [LIGHTS.tipR, "Right wingtip: nav (green) + strobe"]] as [Vec3, string][]).forEach(([pos, name]) =>
  part(() => sph(0.035), ["lighting"], { pos, color: EXT, name, note: "LED position light and anti-collision strobe in one wingtip assembly. NAV and STROBE switches on the bolster; breakers on NON ESS BUS.", pin: true, ext: true }));
[LIGHTS.aftL, LIGHTS.aftR].forEach((pos, i) =>
  part(() => sph(0.025), ["lighting"], { pos, color: EXT, name: "Aft position light (white)", note: "White rear-facing position light in the wingtip trailing edge, on the NAV switch. It does the tail light's job: there is no light on the rudder or tailcone.", pin: i === 0, ext: true }));
[LIGHTS.landL, LIGHTS.landR].forEach((pos, i) =>
  part(() => box(0.03, 0.035, 0.14), ["lighting"], { pos, color: EXT, name: "Wingtip landing light", note: "LED landing light behind the clear lens in the wingtip leading edge, one per side. The G6 has no cowl landing light: both are on the LAND switch. LANDING LIGHTS breaker on MAIN BUS 3, fed from Main Dist Bus 1 (POH 7-48), so after an ALT 1 failure it lasts only as long as BAT 1.", pin: i === 1, ext: true }));
[LIGHTS.iceL, LIGHTS.iceR].forEach((pos, i) =>
  part(() => cyl(0.022, 0.02, "z"), ["lighting"], { pos, color: EXT, name: "Ice inspection light", note: "Fuselage-side light aimed at the wing leading edge so you can check for ice at night. ICE switch on the bolster; ICE LIGHTS breaker on MAIN BUS 1 (POH 7-47). Position on the model is approximate.", pin: i === 1, ext: true }));

/* ---------- flight-control mechanisms (POH Figures 7-1, 7-2, 7-3) ---------- */
const CTL = "#7C57CF", STEEL = "#8C959C";
// elevator: lateral torque tube under the panel with end levers and the forward cable sector
part(() => cyl(0.016, ETT.half * 2, "z"), ["controls"], { chan: ["elevator"], parent: "rig:ett", color: STEEL, name: "Elevator torque tube", note: "Lateral torque tube under the panel. Drop links from both yoke tubes rotate it; its forward sector drives the elevator cables (POH Fig. 7-1).", pin: true });
[-1, 1].forEach((sd) => part(() => box(0.02, ETT.lever, 0.02), ["controls"], { chan: ["elevator"], parent: "rig:ett", pos: [Math.sin(LEVER_ANG) * ETT.lever / 2, Math.cos(LEVER_ANG) * ETT.lever / 2, sd * CARR.z], rot: [0, 0, -LEVER_ANG], color: STEEL, name: "Torque tube lever", note: "Lever arm at each end of the elevator torque tube; the yoke drop link attaches to its tip." }));
part(() => sectorGeo(ETT.sectorR), ["controls"], { chan: ["elevator"], parent: "rig:ett", pos: [0, 0, ETT.sectorZ], color: CTL, name: "Forward elevator sector", note: "Cable sector on the torque tube. The two elevator cables leave it as a crossed pair to the forward pulleys.", pin: true });
part(() => cyl(0.02, 0.05, "z"), ["controls"], { chan: ["elevator"], pos: [ETT.c[0], ETT.c[1], -0.25], color: "#5A636A", name: "Torque tube bearing block", note: "Bearing blocks support the elevator torque tube." });
part(() => cyl(0.02, 0.05, "z"), ["controls"], { chan: ["elevator"], pos: [ETT.c[0], ETT.c[1], 0.25], color: "#5A636A" });
// aileron: pivoting bearing carriages, central pulley sector
[-1, 1].forEach((sd) => {
  const parent = "rig:carr:" + (sd < 0 ? "L" : "R");
  part(() => box(0.2, 0.02, 0.05), ["controls"], { chan: ["aileron"], parent, pos: [0, -0.03, 0], color: STEEL, name: "Aileron bearing carriage", note: "The yoke tube rotates this pivoting carriage for roll and slides through it for pitch (POH Fig. 7-2).", pin: sd > 0 });
  part(() => box(0.02, CARR.arm, 0.02), ["controls"], { chan: ["aileron"], parent, pos: [CARR.armX, -CARR.arm / 2, 0], color: STEEL, name: "Carriage arm", note: "Drives the lateral push rod to the central aileron sector." });
});
part(() => { const g = new THREE.CylinderGeometry(AIL_SECTOR.r, AIL_SECTOR.r, 0.014, 32); g.rotateZ(Math.PI / 2); return g; }, ["controls"], { chan: ["aileron"], parent: "rig:ailSector", color: CTL, name: "Central aileron pulley sector", note: "Centrally located pulley sector: the push rod turns it and it drives both aileron cables down to the floor pulleys.", pin: true });
part(() => box(0.012, 0.02, 0.012), ["controls"], { chan: ["aileron"], parent: "rig:ailSector", pos: [0, AIL_SECTOR.r, 0], color: STEEL });
// rudder: pedal torque tube and cable horn
part(() => cyl(0.014, PEDAL_TT.half * 2, "z"), ["controls", "gear"], { chan: ["rudder"], pos: [PEDAL_TT.x, PEDAL_TT.y, 0], color: STEEL, name: "Rudder pedal torque tube", note: "Carries the four pedals; springs and a ground-adjustable spring cartridge here centre the rudder." , pin: true });
part(() => box(0.03, 0.02, RUD_HORN.half * 2 + 0.02), ["controls"], { chan: ["rudder"], parent: "rig:rudHorn", color: CTL, name: "Rudder cable horn", note: "Pedal links pivot this horn; its ends pull the two rudder cable strands.", pin: true });
part(() => cyl(0.008, 0.05, "y"), ["controls"], { chan: ["rudder"], pos: RUD_HORN.c, color: STEEL });
// arm from each pedal pair's inboard pedal across to its pedal link
[-1, 1].forEach((sd) => {
  const z0 = sd * 0.14, z1 = RUD_HORN.c[2] + sd * RUD_HORN.half;
  part(() => box(0.02, 0.015, Math.abs(z1 - z0) + 0.02), ["controls"], { chan: ["rudder"], parent: sd < 0 ? "rig:pedL" : "rig:pedR", pos: [PEDAL_TT.x, RUD_HORN.c[1], (z0 + z1) / 2], color: STEEL, name: "Pedal arm", note: "Ties each pedal pair to its pedal link; pushing a pedal forward pulls the horn." });
});
// pulleys (each in its own group so it can turn with cable travel)
Object.entries(PULLEYS).forEach(([k, d]) =>
  part(() => pulleyGeo(d.r, d.axis, d.double, d.gap), ["controls"], { chan: chanOfKey(k === "ef" || k === "em" || k === "ea" ? "el" : k.startsWith("a") ? "ail" : "rud"), parent: "rig:pul:" + k, color: k === "ea" || k === "ra" || k.startsWith("aw") ? CTL : "#A6AEB4", name: d.name, note: d.note, pin: true }));
// crank pins on the aft sectors
part(() => cyl(0.008, 0.03, "z"), ["controls"], { chan: ["elevator"], parent: "rig:pul:ea", pos: [0, -0.06, 0], color: STEEL });
part(() => cyl(0.008, 0.03, "y"), ["controls"], { chan: ["rudder"], parent: "rig:pul:ra", pos: [0, 0, 0.05], color: STEEL });
// bellcranks on the surfaces
{
  const pv = surfacePivot("elevR"), c = ELEV_HORN.c;
  part(() => box(0.02, ELEV_HORN.arm, 0.02), ["controls"], { parent: "surf:elevR", pos: [c[0] - pv[0], c[1] - ELEV_HORN.arm / 2 - pv[1], c[2] - pv[2]], color: CTL, name: "Elevator bellcrank", note: "Between the elevator halves; the push-pull tube from the aft sector pulley drives it.", pin: true });
  part(() => cyl(0.014, 0.2, "z"), ["controls"], { parent: "surf:elevR", pos: [c[0] - pv[0], c[1] - pv[1], c[2] - pv[2]], color: STEEL, name: "Elevator torque tube (tail)", note: "Joins the two elevator halves on the hinge line." });
  const rv = surfacePivot("rudder"), r = RUD_HORN_AFT.c;
  part(() => box(0.02, 0.02, RUD_HORN_AFT.arm), ["controls"], { parent: "surf:rudder", pos: [r[0] - rv[0], r[1] - rv[1], RUD_HORN_AFT.arm / 2 - rv[2]], color: CTL, name: "Rudder bellcrank", note: "Horn at the bottom of the rudder; the push-pull tube from the aft rudder sector drives it.", pin: true });
  [1, -1].forEach((sd) => {
    const key = "ail" + (sd > 0 ? "R" : "L"), av = surfacePivot(key);
    const hz = wingP(sd * AIL_DRIVE.z, 0.75, 0);
    part(() => box(0.012, AIL_DRIVE.arm, 0.012), ["controls"], { chan: ["aileron"], parent: "surf:" + key, pos: [hz.x - av[0], hz.y + AIL_DRIVE.arm / 2 - av[1], hz.z - av[2]], color: CTL, name: "Aileron conical drive arm", note: "Right-angle drive: the arm on the aileron hinge that the wing sector's crank turns." });
    part(() => box(0.012, 0.012, AIL_DRIVE.crank), ["controls"], { chan: ["aileron"], parent: "rig:pul:aw" + (sd > 0 ? "R" : "L"), pos: [0, AIL_DRIVE.lift, sd * AIL_DRIVE.crank / 2], color: STEEL, name: "Wing sector crank arm", note: "Swings fore-aft as the sector turns and drives the aileron's conical drive arm." });
  });
}
// turnbuckles and cable guides. The elevator turnbuckles sit on each strand's long run up the tailcone (segment 4): elA's segment 3
// is the short wrap round the intermediate pulley, where they would sit inside the pulley wheel.
([["elA", 4, 0.25], ["elB", 4, 0.25], ["elA", 4, 0.35], ["elB", 4, 0.35], ["rudR", 2, 0.3], ["rudL", 2, 0.3]] as [string, number, number][]).forEach(([k, i, t], j) =>
  part(() => cyl(0.009, 0.07, "x"), ["controls"], { chan: chanOfKey(k), pos: alongCable(k, i, t), color: "#C9B98F", name: "Turnbuckle", note: "Sets cable tension; safety-wired after rigging.", pin: j === 0 }));
[1, -1].forEach((sd) => [["ailBal", sd > 0 ? 1 : 6], ["ail" + (sd > 0 ? "R" : "L"), 7]].forEach(([k, i]) =>
  part(() => box(0.03, 0.03, 0.02), ["controls"], { chan: ["aileron"], pos: alongCable(k as string, i as number, 0.5), color: "#C9D0D5", name: "Cable guide", note: "Fairlead that keeps the aileron cable centred as it runs spanwise (the clips drawn in POH Fig. 7-2).", pin: sd > 0 && k === "ailBal" }))
);

export { FIN };
export type { PartSpec };
