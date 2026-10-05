/** Pipes, wires, ducts and cables with moving particles, plus the rules that drive them. */
import * as THREE from "three";
import { chanOfKey, type FlowSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { FW, PANEL_X, ROLLBAR_X, botY, fs, wingP } from "./geometry";
import { fuelAvail, hornLevel, live, type Elec, type Sim } from "./model";
import { CYLS, ENCL, PITOT_Z, SEL, STALL_Z, pitotBase } from "./parts";
import { CABLES } from "./rig";

const F: FlowSpec[] = [];
const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) => F.push({ key, pts, sys, ...o });
const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/* ---------- fuel: AFM 7.10 schematic (long-range tank) ---------- */
const tankOut = (s: number) => wingP(s * 1.24, 0.42, -1).add(V(0, 0.03, 0));
flow("fuelL", [tankOut(-1), P(wingP(-0.7, 0.42, -1).add(V(0, 0.03, 0))), [fs(2.6), -0.6, -0.12], [fs(2.45), -0.42, -0.04], SEL], ["fuel"], { name: "Left feed line", note: "Finger filter at the inboard, lowest end of the left tank → fuel tank selector (AFM 7.10 schematic)." });
flow("fuelR", [tankOut(1), P(wingP(0.7, 0.42, -1).add(V(0, 0.03, 0))), [fs(2.6), -0.6, 0.12], [fs(2.45), -0.42, 0.04], SEL], ["fuel"], { name: "Right feed line", note: "Right tank → fuel tank selector. There is no crossfeed or BOTH position." });
const GASC: Vec3 = [fs(1.89), -0.58, 0], EPUMP: Vec3 = [fs(1.6), -0.55, 0.07], MECH: Vec3 = [fs(1.28), -0.12, -0.12], SERVO: Vec3 = [fs(1.08), -0.31, 0], DIST: Vec3 = [fs(0.92), 0.15, 0];
flow("fuelSel", [SEL, [fs(2.3), -0.5, 0], [fs(2.05), -0.6, 0], GASC], ["fuel"], { name: "Selector → gascolator", note: "Down from the console to the filter/screen (gascolator) at the lowest point of the system.", r: 0.012 });
flow("fuelPump", [GASC, [fs(1.75), -0.6, 0.04], EPUMP], ["fuel"], { name: "Gascolator → electric pump", note: "The electric pump has a bypass, so fuel flows through it when it is off (AFM 7.10 schematic).", r: 0.012 });
flow("fuelFw", [EPUMP, [FW + 0.02, -0.5, 0.0], [fs(1.3), -0.3, -0.1], MECH], ["fuel", "engine"], { name: "Through the firewall → engine-driven pump", note: "Feeds the mechanical pump at the rear of the engine.", r: 0.012 });
flow("fuelEng", [MECH, [fs(1.15), -0.25, 0.05], [fs(0.98), -0.27, 0.15], [fs(1.02), -0.32, 0.06], SERVO], ["fuel", "engine"], { name: "Pump → fuel-flow transducer → servo", note: "The fuel-flow sensor sits between the mechanical pump and the injection timing device (fuel servo), where fuel pressure is tapped (AFM 7-31; SMM 2-18).", r: 0.011 });
flow("fuelDist", [SERVO, [fs(1.0), -0.15, 0.0], DIST], ["fuel", "engine"], { name: "Servo → fuel distributor", note: "Metered fuel to the flow divider on top of the engine.", r: 0.01 });
CYLS.forEach((c) => flow("inj" + c.n, [DIST, [c.x, 0.1, c.s * 0.2], [c.x, 0.06, c.s * 0.37]], ["fuel", "engine"], { name: "Injector line, cyl " + c.n, note: "One of four lines 'to cylinders' from the fuel distributor (AFM 7-31).", r: 0.006, count: 5 }));
flow("bleed", [MECH, [fs(1.3), -0.4, -0.15], [fs(1.32), botY(fs(1.32)) - 0.02, -0.12]], ["fuel", "engine"], { name: "Pump bleed line", note: "Bleed line from the mechanical pump out of the engine compartment; where it ends is not in the documents.", r: 0.006, count: 4 });
[1, -1].forEach((s) => flow("vent" + (s > 0 ? "R" : "L"), [P(wingP(s * 3.5, 0.45, 1).add(V(0, -0.02, 0))), P(wingP(s * 3.9, 0.45, 0)), P(wingP(s * 3.9, 0.45, -1).add(V(0, -0.03, 0)))], ["fuel"], { name: "Tank vent line", note: "Capillary and check-valve vents end under the wing about 2 m from the tip (AFM 7-34).", r: 0.006, count: 4, pcolor: "#BFE3FF" }));

/* ---------- oil ---------- */
flow("oil", [[fs(0.9), -0.24, 0], [fs(1.22), -0.12, 0.0], [fs(0.7), -0.1, 0.25], [fs(0.6), -0.06, 0.32], [fs(0.75), 0.02, 0.1], [fs(1.0), 0.04, 0]], ["engine"], { r: 0.009, color: "#B85A2A", name: "Oil circuit", note: "Sump → pump → oil cooler → engine galleries (filter and pump details not in the AFM)." });
flow("oilGov", [[fs(0.85), 0.05, 0.03], [fs(0.75), 0.12, 0.06], [fs(0.5), 0.04, 0], [fs(0.38), 0, 0]], ["engine", "propeller"], { r: 0.008, color: "#B85A2A", name: "Governor oil to the hub", note: "The governor boosts engine oil and meters it into the propeller hub to hold RPM (AFM 7-22)." });

/* ---------- induction & exhaust ---------- */
flow("intake", [[fs(0.47), 0.0, 0.235], [fs(0.62), 0.0, 0.2], [fs(0.85), -0.18, 0.12], SERVO], ["engine"], { tube: false, pcolor: "#8FD3E8", size: 0.06, name: "Induction air" });
flow("altAir", [[fs(0.82), -0.18, 0.22], [fs(0.95), -0.25, 0.12], SERVO], ["engine"], { tube: false, pcolor: "#F2C35A", size: 0.06 });
CYLS.forEach((c) => flow("man" + c.n, [SERVO, [c.x, -0.18, c.s * 0.14], [c.x, -0.08, c.s * 0.3]], ["engine"], { r: 0.014, color: "#8A969E", pcolor: "#8FD3E8", count: 4, name: "Intake pipe", note: "Induction pipes from the servo / plenum to the intake ports." }));
CYLS.forEach((c) => flow("exh" + c.n, [[c.x, -0.08, c.s * 0.38], [c.x, -0.3, c.s * 0.3], [fs(0.95), -0.36, c.s * 0.12]], ["engine"], { r: 0.015, color: "#8A5A3C", pcolor: "#FF8A4A", count: 4, name: "Exhaust header", note: "One EGT probe in each header primary pipe (SMM 2-21)." }));
flow("tailpipe", [[fs(0.95), -0.36, 0.06], [fs(1.15), -0.42, 0.1], [fs(1.3), botY(fs(1.3)) - 0.05, 0.14]], ["engine"], { r: 0.024, color: "#8A5A3C", pcolor: "#FF8A4A", name: "Exhaust tailpipe", note: "Underslung exhaust, out under the cowling.", ext: true });

/* ---------- cabin heat & fresh air (heat source and ducting from an unofficial technical description) ---------- */
const AIR = "#149C94", HOT = "#E0522B";
const HV: Vec3 = [FW - 0.06, -0.4, 0.12], DV: Vec3 = [FW - 0.14, -0.42, 0.0];
flow("heatIn", [[fs(0.48), -0.06, 0.25], [fs(0.7), -0.25, 0.28], [fs(0.95), -0.36, 0.22], [fs(1.2), -0.42, 0.18], [FW + 0.04, -0.42, 0.13], HV], ["environment"], { r: 0.022, color: HOT, pcolor: "#FF7A3D", name: "Heat duct", note: "Right cowl intake → shroud around the exhaust muffler → heat valve on the firewall." });
flow("heatDump", [HV, [FW + 0.05, -0.5, 0.15], [FW + 0.08, botY(FW + 0.08) - 0.04, 0.15]], ["environment"], { r: 0.018, color: HOT, pcolor: "#FFA070", name: "Heat valve overboard outlet", note: "With CABIN HEAT OFF the flap dumps the hot air overboard at the bottom of the cowling.", ext: true });
flow("heatCab", [HV, [FW - 0.1, -0.42, 0.06], DV], ["environment"], { r: 0.022, color: HOT, name: "Heat valve → distributor" });
flow("defrost", [DV, [PANEL_X + 0.15, -0.2, 0.0], [PANEL_X + 0.24, 0.1, 0.0], [PANEL_X + 0.22, 0.22, 0.0]], ["environment"], { r: 0.02, color: AIR, name: "Defrost duct", note: "Distributor ▲ position: air to the front of the canopy against mist and frost." });
[1, -1].forEach((s) => {
  flow("floorF" + s, [DV, [fs(1.75), -0.56, s * 0.2], [fs(1.95), -0.56, s * 0.3]], ["environment"], { r: 0.014, color: AIR, name: "Pilots' floor outlets" });
  flow("floorR" + s, [DV, [fs(1.8), -0.6, s * 0.12], [fs(2.6), -0.6, s * 0.12], [fs(2.95), -0.56, s * 0.3]], ["environment"], { r: 0.014, color: AIR, name: "Passengers' floor outlets" });
});
const NACA = P(wingP(-0.85, 0.08, -1));
flow("fresh", [NACA, [fs(2.3), -0.56, -0.55], [fs(2.6), -0.3, -0.52], [ROLLBAR_X + 0.02, 0.2, -0.48], [ROLLBAR_X + 0.02, 0.3, -0.46]], ["environment"], { r: 0.02, color: AIR, pcolor: "#5FC8F0", name: "Fresh-air duct (left)", note: "Stub-wing NACA inlet → side duct → roll-bar nozzle (unofficial technical description)." });
flow("fresh2", [[ROLLBAR_X + 0.02, 0.3, -0.46], [ROLLBAR_X + 0.02, 0.52, 0], [ROLLBAR_X + 0.02, 0.3, 0.46]], ["environment"], { r: 0.016, color: AIR, pcolor: "#5FC8F0", name: "Roll-bar duct", note: "Across the roll bar to the right nozzle and the console nozzle above the passengers' heads." });
flow("freshPanel", [[fs(2.3), -0.56, -0.55], [fs(1.95), -0.5, -0.52], [PANEL_X + 0.04, -0.03, -0.49]], ["environment"], { r: 0.016, color: AIR, pcolor: "#5FC8F0", name: "Panel nozzle feed", note: "To the movable nozzle at the panel end. Routing assumed." });
flow("cabinOut", [[fs(3.6), 0.1, 0], [fs(4.1), -0.1, 0], [fs(5.5), -0.37, 0], [fs(7.2), -0.42, 0], [fs(7.45), -0.42, 0]], ["environment"], { tube: false, pcolor: "#9FD6E6", size: 0.05, name: "Cabin air exhaust" });

/* ---------- pitot-static (AFM 7.12) ---------- */
const GDC: Vec3 = [PANEL_X + 0.1, 0.06, 0.12], STBY_ASI: Vec3 = [PANEL_X + 0.03, 0.15, -0.107], STBY_ALT: Vec3 = [PANEL_X + 0.03, 0.15, 0.089];
const root: Vec3 = [fs(2.3), -0.5, -0.5];
const probeIn = P(pitotBase.clone().add(V(0, 0.01, 0)));
// Lines run inboard in the wing, forward along the lower left cabin side and up behind the panel (routing assumed).
const PT: Vec3 = [PANEL_X + 0.06, -0.2, -0.3], ST: Vec3 = [PANEL_X + 0.075, -0.2, -0.26];
flow("pitot", [probeIn, P(wingP(PITOT_Z, 0.32, 0)), P(wingP(-1.4, 0.32, 0)), root, [fs(1.9), -0.56, -0.47], [PANEL_X + 0.06, -0.48, -0.42], PT, [PANEL_X + 0.08, 0.0, -0.05], GDC], ["pitot"], { r: 0.008, name: "Pitot line", note: "Total pressure from the probe through the wing-root filter to the GDC 74A and the standby airspeed." });
flow("pitot2", [PT, [PANEL_X + 0.06, 0.05, -0.2], STBY_ASI], ["pitot"], { r: 0.007 });
flow("static", [P(pitotBase.clone().add(V(-0.03, 0.01, 0.03))), P(wingP(PITOT_Z, 0.36, 0)), P(wingP(-1.4, 0.36, 0)), [root[0] - 0.04, root[1], root[2] + 0.04], [fs(1.9), -0.56, -0.43], [PANEL_X + 0.075, -0.48, -0.38], ST, [PANEL_X + 0.095, 0.0, -0.01], GDC], ["pitot"], { r: 0.008, color: "#2E6FB0", name: "Static line", note: "From the two static orifices on the same probe to the GDC 74A and the standby altimeter and airspeed." });
flow("static2", [ST, [PANEL_X + 0.075, 0.05, -0.05], STBY_ALT], ["pitot"], { r: 0.007, color: "#2E6FB0" });
flow("altStatic", [[fs(1.86), -0.3, -0.42], [PANEL_X + 0.02, -0.3, -0.36], [PANEL_X + 0.075, -0.25, -0.3], ST], ["pitot"], { r: 0.007, color: "#2E6FB0", name: "Alternate static line", note: "Valve open: cabin static pressure feeds the static system." });
flow("stall", [P(wingP(STALL_Z, 0.04, 0)), P(wingP(-2.0, 0.2, 0)), P(wingP(-0.6, 0.2, 0)), [fs(1.9), -0.56, -0.5], [PANEL_X + 0.05, -0.48, -0.45], [PANEL_X + 0.05, -0.12, -0.42]], ["pitot"], { tube: false, pcolor: "#FF6A6A", size: 0.04 });

/* ---------- electrical feeders (AMM-E Fig. 2-3) ---------- */
const BAT: Vec3 = [fs(1.19), -0.08, 0.31], RELAY: Vec3 = [fs(1.3), -0.04, 0.32], CBP: Vec3 = [PANEL_X + 0.03, -0.03, 0.4];
flow("bat", [BAT, RELAY], ["electrical"], { r: 0.014, name: "Battery cable", note: "Battery → battery relay in the relay box (closed by the BAT switch)." });
flow("batEss", [RELAY, [FW + 0.02, 0.0, 0.34], [PANEL_X + 0.1, -0.05, 0.4], CBP], ["electrical"], { r: 0.014, name: "Relay box → BATT 70 A → ESSENTIAL", note: "Main feeder from the relay-box bus bar through the BATT breaker to the Essential bus." });
flow("start", [RELAY, [fs(1.2), -0.25, 0.25], [fs(0.64), -0.22, 0.16]], ["electrical", "engine"], { r: 0.016, color: "#B0761A", name: "Starter cable", note: "START relay → starter (~160 A, AFM 7-41 figure)." });
flow("alt", [[fs(0.64), -0.18, -0.17], [fs(1.0), -0.3, -0.3], [FW + 0.02, -0.1, -0.2], [PANEL_X + 0.1, -0.08, 0.2], [PANEL_X + 0.08, -0.08, 0.37], CBP], ["electrical"], { r: 0.014, name: "Alternator output", note: "Alternator → current sensor → ALT 70 A → MAIN bus." });
flow("ext", [P(V(fs(1.42), -0.36, 0.48)), [fs(1.36), -0.2, 0.36], RELAY], ["electrical"], { r: 0.012, name: "External power", note: "Receptacle → external-power relay → relay-box bus bar (AFM 7-40 figure)." });
flow("avFeed", [CBP, [PANEL_X + 0.15, -0.3, 0.3], [fs(2.2), -0.62, 0.22], [fs(3.3), -0.62, 0.2], [ENCL[0] + 0.15, ENCL[1], 0.15]], ["electrical", "avionics"], { r: 0.012, name: "Remote avionics power", note: "ESSENTIAL (GIA 1, XPDR) and MAIN AVIONICS (GIA 2, GDL 69) feeds to the enclosure under the baggage floor." });
flow("emerg", [[fs(1.69), -0.16, 0.3], [PANEL_X + 0.08, 0.05, 0.1], [PANEL_X + 0.03, 0.15, -0.008]], ["electrical", "avionics"], { r: 0.008, color: "#FFD24A", name: "Emergency battery feed", note: "HORIZON EMERGENCY ON: emergency battery → standby attitude and flood light." });

/* ---------- control cables ---------- */
CABLES.forEach((c) => flow(c.key, c.pts, c.key === "trim" ? ["controls", "autopilot"] : ["controls", "gear"], { r: c.key === "trim" ? 0.006 : 0.005, size: 0.045, tension: 0.1, name: c.name, note: c.note, count: 18, chan: c.key === "trim" ? ["elevator"] : chanOfKey(c.key) }));

export const FLOWS = F;

const CABIN_AIR = ["defrost", "floorF1", "floorF-1", "floorR1", "floorR-1", "heatCab"];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/** Particle speed multiplier per flow (0 = stopped; negative = reversed). */
export function flowRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running, avail = fuelAvail(s);
  const pumping = s.fuel.pump && E.pumpPwr && avail;
  // fuel: engine flow, or the electric pump priming with the mixture rich
  const ff = run ? live.ff / 9 : pumping ? (s.eng.mix > 0.5 ? 0.6 : 0.25) : 0;
  const feed = avail && (run || pumping) ? Math.max(0.3, ff) : 0;
  R.fuelL = s.fuel.sel === "L" ? feed : 0;
  R.fuelR = s.fuel.sel === "R" ? feed : 0;
  R.fuelSel = R.fuelPump = R.fuelFw = feed;
  R.fuelEng = feed && (run || pumping) ? feed : 0;
  R.fuelDist = run || (pumping && s.eng.mix > 0.5) ? feed : 0;
  CYLS.forEach((c) => { R["inj" + c.n] = R.fuelDist; R["man" + c.n] = run ? live.rpm / 2400 : 0; R["exh" + c.n] = run ? 1.2 * live.rpm / 2400 : 0; });
  R.bleed = run ? 0.3 : 0;
  R.ventL = R.ventR = s.air ? 0.2 : 0;
  R.oil = run || live.oilP > 5 ? 0.7 : 0;
  R.oilGov = run && !s.eng.fail.governor && live.oilP > 15 ? 0.5 : 0;
  R.intake = run && !s.eng.altAir ? live.rpm / 2400 : 0;
  R.altAir = run && s.eng.altAir ? live.rpm / 2400 : 0;
  R.tailpipe = run ? 1.3 : 0;
  // heat: ram air (or prop wash on the ground) through the muffler shroud
  const ram = s.air ? 1 : run ? 0.5 : 0, heat = s.env.heat;
  R.heatIn = ram;
  R.heatDump = ram * (1 - heat);
  R.heatCab = ram * heat;
  R.defrost = ram * heat * s.env.dist;
  ["floorF1", "floorF-1", "floorR1", "floorR-1"].forEach((k) => (R[k] = ram * heat * (1 - s.env.dist)));
  const fresh = s.air ? 0.8 : run ? 0.25 : 0;
  R.fresh = R.fresh2 = R.freshPanel = fresh;
  R.cabinOut = fresh || R.heatCab ? 0.5 : 0;
  // pitot-static: only moves with airspeed changes — shown gently while airborne
  R.pitot = R.pitot2 = R.static = R.static2 = s.air ? 0.4 : 0;
  R.altStatic = s.pitot.altStatic ? 0.4 : 0;
  R.stall = hornLevel(s) > 0 ? -1.2 : 0;
  // electrical
  R.bat = !E.batOk ? 0 : E.batCharging ? -0.6 : E.ess > 0 ? 1 : 0;
  R.batEss = E.bar && E.ess > 0 ? (E.batCharging && !s.elec.ext ? -0.6 : 1) : 0;
  R.start = E.starterOn ? 2.5 : 0;
  R.alt = E.altFeed ? 1 : 0;
  R.ext = s.elec.ext ? 1 : 0;
  R.avFeed = E.ess > 0 ? 0.8 : 0;
  R.emerg = s.elec.emerg && !E.emergDead ? 0.8 : 0;
  // cables: one strand pays out while the other takes up
  R.rudL = live.eff.yaw * 2; R.rudR = -live.eff.yaw * 2;
  R.trim = Math.max(-3, Math.min(3, live.trimRate * 6));
  return R;
}

/** Cabin-air particles follow the heat lever (cool blue → hot orange). */
export function cabinAirColor(s: Sim, out: THREE.Color) {
  return out.set("#5FC8F0").lerp(new THREE.Color("#FF7A3D"), s.env.heat);
}
