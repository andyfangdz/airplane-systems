/**
 * Pipes, wires, ducts and cables with moving particles (POH Figures 7-1, 7-6, 7-7, 7-8, 7-9; Supplement 3 Fig S3-1) and the rules
 * that drive them. Particle speeds are relative (1 ≈ normal flow); negative runs them backwards.
 */
import * as THREE from "three";
import type { FlowSpec } from "@/lib/catalogue";
import { V, clamp, type Vec3 } from "@/lib/math";
import type { Chan, SysId } from "@/lib/systems";
import { Z, wingP } from "./geometry";
import { govRpm, live, rpmFine, type Elec, type Sim } from "./model";
import { CYLS, P3, PV } from "./parts";
import { DIVIDER, GOVERNOR, JBOX, KAP, MANIFOLD, PITOT, STALL_VANE, STATIC_PORTS } from "./parts-systems";
import { CABLES, RIG_SPEC } from "./rig";

const F: FlowSpec[] = [];
const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) => F.push({ key, pts, sys, ...o });
const wp = (bl: number, c: number, up = 0, dy = 0): Vec3 => PV(wingP(Z(bl), c, up).add(V(0, dy, 0)));

/* ---------- fuel (Figure 7-6): supply, return to the selected tank(s), vents ---------- */
const FUEL = "#2F7FE6", RET = "#7EB3F5", VALVE = P3(27.2, 0, 24.6);
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L";
  // particles only: the manifold tube itself is a catalogue part
  flow("fuel" + sd, [wp(s * 24.5, 0.62, -1, 0.02), P3(65, s * 21.2, 78), P3(65, s * 21.3, 30), P3(40, s * 8, 26.8), P3(27.5, s * 2.5, 25.4)], ["fuel"],
    { tube: false, pcolor: "#5FA0FF", size: 0.05, name: (s > 0 ? "Right" : "Left") + " tank supply" });
  flow("ret" + sd, [P3(27.4, s * 1, 25.9), P3(40, s * 9.4, 27.8), P3(64.4, s * 20.4, 31), P3(64.4, s * 20.4, 77.5), wp(s * 27, 0.6, -1, 0.03)], ["fuel"],
    { r: 0.005, color: RET, name: "Fuel return line to the " + (s > 0 ? "right" : "left") + " tank", note: "From the top (return) section of the selector back up the aft door post to the tank — only to the tank(s) selected as the feed (POH 7-43)." });
});
flow("fuelPump", [VALVE, P3(18, 1, 25), P3(2, 3, 26.8), P3(0, 4, 28), P3(-10, 5, 30.4), P3(-12, 5, 31)], ["fuel"], { r: 0.01, color: FUEL, name: "Selector → auxiliary fuel pump", note: "Supply section of the selector, forward under the floor and through the firewall to the aux pump (Fig. 7-6)." });
flow("fuelStr", [P3(-12, 5, 31), P3(-9.5, 6, 30), P3(-7, 7, 29)], ["fuel"], { r: 0.01, color: FUEL, name: "Aux pump → fuel strainer" });
flow("fuelEdp", [P3(-7, 7, 31), P3(-4, 2, 36), P3(-5, -4, 42), P3(-6, -6, 44)], ["fuel", "engine"], { r: 0.009, color: FUEL, name: "Strainer → engine-driven pump" });
flow("fuelServo", [P3(-6, -6, 44), P3(-10, -5, 38), P3(-20, -1, 35.5), P3(-22, 0, 35)], ["fuel", "engine"], { r: 0.009, color: FUEL, name: "Engine-driven pump → fuel/air control unit" });
flow("fuelMetered", [P3(-22, 0, 36.5), P3(-16, -2, 44), P3(-13, 0, 52), P3(-12.4, 0, 57.5), P3(-18, 0, 60), DIVIDER], ["fuel", "engine"],
  { r: 0.008, color: FUEL, name: "Metered fuel → flow transducer → distribution unit", note: "From the servo under the engine, through the flow transducer on the engine centerline, to the flow divider on top (POH 7-40, 7-41)." });
/** Injector nozzle positions (match the catalogue's nozzle parts). */
export const NOZZLES = CYLS.map((c) => { const b = P3(c.fs, c.s * 12, 50); return [b[0] - 0.02, b[1] - 0.11, b[2] + c.s * 0.07] as Vec3; });
CYLS.forEach((c, i) => flow("inj" + c.n, [DIVIDER, P3(c.fs, c.s * 7, 59), P3(c.fs - 0.8, c.s * 18.4, 51), NOZZLES[i]], ["fuel", "engine"],
  { r: 0.004, color: FUEL, count: 5, name: "Injector line, cylinder " + c.n, note: "Flow divider → air-bleed nozzle in the cylinder's intake (POH 7-36)." }));
flow("fuelReturn", [P3(-21, 1.5, 37), P3(-12, 3, 33), P3(-2, 3, 30), P3(8, 2.6, 27), P3(22.5, 3, 25.2), [VALVE[0] - 0.01, VALVE[1] + 0.02, VALVE[2] + 0.02]], ["fuel"],
  { r: 0.006, color: RET, name: "Fuel return line from the engine", note: "Orificed fitting in the top of the servo → flexible hose to the firewall → aluminum line to the top (return) section of the selector: ≈ 7 GPH of fuel and vapor back to the tanks for hot-weather idling (POH 7-43)." });
flow("vent", [wp(-90, 0.14, 1, -0.02), wp(-23, 0.14, 1, -0.02), wp(23, 0.14, 1, -0.02), wp(90, 0.14, 1, -0.02)], ["fuel"], { tube: false, pcolor: "#CFE3FF", size: 0.05, name: "Vent" });
[1, -1].forEach((s) => flow("ovb" + (s > 0 ? "R" : "L"), [wp(s * 100, 0.38, -1, -0.07), wp(s * 100, 0.36, -1, 0.0), wp(s * 96, 0.3, 0, 0)], ["fuel"], { tube: false, pcolor: "#CFE3FF", size: 0.04, count: 4 }));

/* ---------- oil, governor, induction, exhaust, cooling (POH 7-34 – 7-37) ---------- */
flow("oil", [P3(-24, 0, 38.5), P3(-8, -2, 42), P3(-4.5, 0, 47.5), P3(-14, 8, 53), P3(-11.4, -13, 56), P3(-22, -7, 54.5), P3(-32, -7, 54)], ["engine"],
  { r: 0.009, color: "#B85A2A", name: "Oil circuit", note: "Sump pickup screen → engine-driven oil pump → full-flow filter (bypass valve) → relief valve at the rear of the right gallery → thermostatic remote oil cooler → left gallery and propeller governor; it returns to the sump by gravity (POH 7-34)." });
flow("oilRet", [P3(-30, 6, 50), P3(-28, 4, 44), P3(-25, 0, 39)], ["engine"], { tube: false, pcolor: "#E08A4A", size: 0.04, count: 5 });
flow("oilGov", [P3(-32, -7, 54), P3(-40, -7, 55), GOVERNOR, P3(-44, -2, 51.5), P3(-45.5, 0, 50.4)], ["engine", "propeller"],
  { r: 0.007, color: "#B85A2A", name: "Governor oil to the propeller hub", note: "The governing pump boosts engine oil to the hub piston: pressure in = higher pitch (lower RPM); relieved = lower pitch (POH 7-37)." });
flow("intake", [P3(-43.6, 0, 39), P3(-35.2, 0, 39), P3(-29, 0, 38), P3(-22, 0, 35)], ["engine"], { tube: false, pcolor: "#8FD3E8", size: 0.06, name: "Induction air" });
flow("altAir", [P3(-29, -12, 33), P3(-29, -5, 37.5), P3(-22, 0, 35)], ["engine"], { tube: false, pcolor: "#F2C26B", size: 0.06, name: "Alternate air (unfiltered)" });
const MUF = (s: number, fs: number) => P3(clamp(fs, -30, -18.5), s * 9.5, 33.5);
CYLS.forEach((c) => {
  flow("man" + c.n, [P3(-22, 0, 36.5), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 12, 45.5)], ["engine"], { tube: false, pcolor: "#8FD3E8", count: 4, size: 0.04 });
  flow("exh" + c.n, [P3(c.fs, c.s * 15.5, 46), P3(c.fs - 0.5, c.s * 13, 38), MUF(c.s, c.fs)], ["engine", "environment"],
    { r: 0.016, color: "#8A5A3C", pcolor: "#FF8A4A", count: 4, name: "Exhaust riser", note: "Each cylinder's riser runs to the collector and muffler on its side below the engine (POH 7-36)." });
});
flow("tailpipe", [P3(-17.8, 9.5, 33.5), P3(-12, 6, 30), P3(-7, 4, 25), P3(-4, 4, 21.5)], ["engine"], { r: 0.022, color: "#8A5A3C", pcolor: "#FF8A4A", name: "Tailpipe", note: "Both mufflers go overboard through a single tailpipe; the merge point isn't in the POH (POH 7-36).", ext: true });
flow("tailpipeL", [P3(-17.8, -9.5, 33.5), P3(-12, -2, 31), P3(-10, 4, 28.5)], ["engine"], { r: 0.02, color: "#8A5A3C", pcolor: "#FF8A4A" });
[1, -1].forEach((s) => flow("cool" + (s > 0 ? "R" : "L"), [P3(-43.8, s * 10.8, 53.8), P3(-34, s * 9, 60.5), P3(-24, s * 15, 54), P3(-18, s * 16, 40), P3(-8, s * 8, 26), P3(-1, s * 8, 19.5)], ["engine"], { tube: false, pcolor: "#BEE6F2", size: 0.05, count: 10, name: "Cooling air" }));

/* ---------- cabin heat and ventilation (Figure 7-8) ---------- */
const AIR = "#149C94";
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L";
  flow("ram" + sd, [P3(-43, s * 6, 45), P3(-36, s * 9, 38), P3(-30.4, s * 9.5, 33.5)], ["environment"], { tube: false, pcolor: "#8FD3E8", size: 0.05, name: "Ram air to the muffler shroud" });
  flow("heat" + sd, [P3(-18, s * 9.5, 33.5), P3(-10, s * 6, 35.5), P3(-3, -3, 38.5), P3(0.6, -5, 39)], ["environment"], { r: 0.02, color: "#E0522B", pcolor: "#FF7A3D", name: "Heated air duct", note: "Muffler shroud → heater valve on the firewall (CABIN HT) (Fig. 7-8)." });
});
flow("ventIn", [P3(-36, 15, 46), P3(-14, 15, 41), P3(0.6, 13, 38)], ["environment"], { r: 0.02, color: AIR, pcolor: "#5FC8F0", name: "Ventilating air duct", note: "Ram air from a second inlet on the right side → ventilating air door (CABIN AIR) (Fig. 7-8)." });
flow("toMan", [P3(0.6, -5, 39), P3(3, -3, 34), MANIFOLD], ["environment"], { r: 0.022, color: AIR, name: "Into the cabin manifold" });
flow("toMan2", [P3(0.6, 13, 38), P3(3, 8, 33), MANIFOLD], ["environment"], { r: 0.022, color: AIR });
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L";
  flow("defrost" + sd, [MANIFOLD, P3(8, s * 4, 48), P3(13, s * 6, 63), P3(15.6, s * 7, 67.6)], ["environment"], { r: 0.014, color: AIR, name: "Defroster duct", note: "Manifold → defroster outlet on top of the glareshield; the DEFROST knob sets the flow (POH 7-60)." });
  flow("floor" + sd, [MANIFOLD, P3(8, s * 10, 27)], ["environment"], { r: 0.012, color: AIR, name: "Front floor outlets", note: "Outlet holes across the manifold just forward of the front occupants' feet (POH 7-60)." });
  flow("rear" + sd, [MANIFOLD, P3(8, s * 14, 28), P3(14, s * 16.5, 27.5)], ["environment"], { r: 0.012, color: AIR, name: "Rear cabin floor duct", note: "Down each side of the cabin to an outlet just aft of the rudder pedals at floor level (POH 7-60)." });
  flow("wroot" + sd, [wp(s * 19, 0.01, 0, -0.005), wp(s * 17.5, 0.06, 0, -0.01), P3(29, s * 18.2, 79), P3(30, s * 18.8, 76)], ["environment"], { r: 0.012, color: AIR, pcolor: "#5FC8F0", name: "Wing-root fresh air", note: "To the forward cabin upper (adjustable) and lower outlets — not heated (Fig. 7-8)." });
  flow("wlow" + sd, [P3(29, s * 18.2, 79), P3(31, s * 19.6, 52), P3(31, s * 19.4, 34)], ["environment"], { r: 0.01, color: AIR, pcolor: "#5FC8F0", name: "Forward cabin lower air duct" });
  flow("wrear" + sd, [P3(29, s * 18.2, 79), P3(52, s * 18, 79.6), P3(74, s * 18, 76)], ["environment"], { r: 0.01, color: AIR, pcolor: "#5FC8F0", name: "Rear cabin ventilating air duct" });
});

/* ---------- pitot-static, stall warning, vacuum ---------- */
const PIT = "#3A9448", ADC = P3(11.4, 10.5, 61.5), SBY = P3(16.6, 0.6, 52.2);
flow("pitot", [[PITOT[0] - 0.05, PITOT[1] + 0.02, PITOT[2]], wp(-110, 0.2, -1, 0.04), wp(-60, 0.25, 0), wp(-17, 0.22, -1, 0.03), P3(31.6, -18.9, 76), P3(30.6, -18.9, 50), P3(20, -8, 50), SBY], ["pitot"],
  { r: 0.006, color: PIT, name: "Pitot line", note: "Pitot head → left wing → forward door post → standby airspeed indicator and the GDC 74A (POH 7-62)." });
flow("pitot2", [SBY, P3(14, 5, 57), ADC], ["pitot"], { r: 0.006, color: PIT, name: "Pitot line to the GDC 74A" });
const STAT = "#2E7A3A";
STATIC_PORTS.forEach((p, i) => { const s = i === 0 ? 1 : -1; flow("static" + (s > 0 ? "R" : "L"), [p, P3(15, s * 17, 44.5), P3(15.6, s * 6, 49), SBY], ["pitot"], { r: 0.006, color: STAT, name: "Static line", note: "Both static ports join behind the panel: standby airspeed and altimeter, and the air data computer (POH 7-62)." }); });
flow("static2", [SBY, P3(13, 6, 54), [ADC[0] + 0.02, ADC[1] - 0.03, ADC[2]]], ["pitot"], { r: 0.006, color: STAT, name: "Static line to the GDC 74A" });
flow("altStatic", [P3(30, -6, 41), P3(18.4, -4.6, 43.2), P3(16, -2, 47), SBY], ["pitot"], { tube: false, pcolor: "#B7E5B4", size: 0.04, name: "Cabin static air" });
flow("stall", [[STALL_VANE[0] - 0.03, STALL_VANE[1], STALL_VANE[2]], wp(-92, 0.12, 0), wp(-30, 0.16, 0), wp(-19, 0.14, 0, -0.04), P3(40, -19, 78)], ["pitot"],
  { r: 0.004, color: "#D9960F", name: "Stall warning switch wire", note: "Vane switch in the left wing → horn in the headliner above the left door, through the WARN breaker (POH 7-65, Fig. 7-7)." });
const VACC = "#4FA8A0";
flow("vac", [P3(11.5, 3, 58.5), P3(16, 1.5, 55), P3(13, 4, 53.5), P3(2.1, 8, 56), P3(-2, 6, 52), P3(-5, 5.5, 47)], ["vacuum"],
  { r: 0.008, color: VACC, pcolor: "#9FE3DA", name: "Vacuum line", note: "Cabin air: filter → standby attitude indicator rotor → regulator → engine-driven pump (Fig. 7-9)." });
flow("vacOut", [P3(-5, 5.5, 44.5), P3(-6, 6, 32), P3(-6, 7, 23.2)], ["vacuum"], { tube: false, pcolor: "#9FE3DA", size: 0.04 });

/* ---------- electrical feeders (Figure 7-7) ---------- */
const ELEC = "#D9960F", CBA = P3(17.3, -18.6, 44.2), CBB = P3(17.3, -8.6, 44.2);
flow("alt", [P3(-33.4, 9, 41.5), P3(-20, 6, 36), P3(-8, -8, 38), JBOX], ["electrical"], { r: 0.01, color: ELEC, name: "Alternator output", note: "Alternator → ACU → alternator relay → J-box main node (Fig. 7-7 Sheet 1)." });
flow("bat", [P3(132.1, -5, 37), P3(110, -12, 29), P3(60, -16, 27.4), P3(20, -17, 28), P3(4, -16, 34), JBOX], ["electrical"],
  { r: 0.011, color: ELEC, name: "Main battery cable", note: "From the battery in the tailcone forward under the floor to the battery relay (MASTER BAT) in the J-box; cranking current runs here, upstream of the M BATT shunt (Fig. 7-7 Sheet 1)." });
flow("ext", [P3(-3, -21.4, 40), P3(-3, -17, 42), JBOX], ["electrical"], { r: 0.01, color: ELEC, name: "External power" });
flow("feedA", [JBOX, P3(2, -16, 44), P3(12, -17.5, 44.4), CBA], ["electrical"], { r: 0.01, color: ELEC, name: "Bus feeders (C/B “A” and “B”)", note: "Push-to-reset feeder breakers in the J-box feed ELECTRICAL BUS 2 (A) and BUS 1 (B) on the breaker panel (Fig. 7-7)." });
flow("stbyBat", [P3(10.8, -14, 50.5), P3(14, -12, 47), CBB], ["electrical"], { r: 0.008, color: ELEC, name: "Standby battery feed", note: "Standby battery → 25 A fuse → STBY BATT switch → STDBY BATT breaker → ESSENTIAL BUS (Fig. 7-7 Sheet 3)." });
flow("starter", [JBOX, P3(-12, -12, 40), P3(-36, -8, 42.5)], ["electrical", "engine"], { r: 0.012, color: ELEC, name: "Starter cable", note: "Starter relay (J-box) → starter on the front of the engine." });

/* ---------- KAP 140: GIA #2 signals in, servo drive out (Fig. S3-1) ---------- */
const KAPU = P3(KAP.fs - 0.6, KAP.bl, KAP.h), SV = RIG_SPEC.servo, APC = "#E0A21C";
flow("kapNav", [P3(136, 4.5, 49.5), P3(110, 9, 31), P3(40, 9, 27.5), P3(16, 3, 40), KAPU], ["autopilot"], { r: 0.004, color: "#C8399F", name: "NAV / HDG / GPSS signals", note: "GIA 63 #2 sends the selected course, heading bug and GPS roll steering to the KAP 140 (Fig. S3-1)." });
flow("kapTc", [P3(15.5, 4, 53), P3(16, 2, 51), KAPU], ["autopilot"], { r: 0.004, color: "#9C4C88", name: "Roll-rate signal", note: "From the hidden DC turn coordinator — the KAP 140's own attitude sensing (POH 7-12)." });
flow("apRoll", [KAPU, P3(16, 2, 60), P3(28, 17, 70), P3(40, 14, 79.6), P3(SV.roll[0], SV.roll[1], SV.roll[2] - 2.6)], ["autopilot"], { r: 0.004, color: APC, name: "Roll servo drive", note: "KAP 140 → KS 271C roll servo (FS 52.0)." });
flow("apPitch", [KAPU, P3(16, 2, 45), P3(20, 7, 29), P3(90, 8, 28.5), P3(SV.pitch[0], SV.pitch[1] + 4, SV.pitch[2])], ["autopilot"], { r: 0.004, color: APC, name: "Pitch servo drive", note: "KAP 140 → KS-270C pitch servo (FS 158.8)." });
flow("apTrim", [P3(90, 8, 28.5), P3(150, -1, 33), P3(SV.trim[0], SV.trim[1] - 4, SV.trim[2])], ["autopilot"], { r: 0.004, color: APC, name: "Pitch trim servo drive", note: "KAP 140 → KS-272C pitch trim servo (FS 176.4): autotrim and manual electric trim." });

/* ---------- control cables (Figure 7-1) and flap drive ---------- */
CABLES.forEach((c) => flow(c.key, c.pts, ["controls"], { r: 0.004, size: 0.04, tension: 0.05, name: c.name, note: c.note, count: 18, chan: c.chan === "trim" ? ["elevator"] : [c.chan as Chan] }));
flow("flapX", [wp(-24, 0.67, 0, -0.01), wp(24, 0.67, 0, -0.01)], ["flaps"], { tube: false, pcolor: "#B9A3F0", size: 0.05 });

export const FLOWS = F;
const CABIN_AIR = ["toMan", "toMan2", "defrostL", "defrostR", "floorL", "floorR", "rearL", "rearR"];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/* control-cable motion follows the rate of change of each channel */
const prev = { pitch: 0, roll: 0, yaw: 0, trim: 0, t: 0 }, vel = { pitch: 0, roll: 0, yaw: 0, trim: 0 };
function controlRates() {
  const t = performance.now() / 1000, dt = Math.max(1e-3, t - prev.t);
  const cur = { ...live.ctl, trim: live.kap.trim };
  (["pitch", "roll", "yaw", "trim"] as const).forEach((k) => {
    const v = (cur[k] - prev[k]) / dt;
    vel[k] = vel[k] * 0.85 + clamp(v, -4, 4) * 0.15;
    prev[k] = cur[k];
  });
  prev.t = t;
  return vel;
}

/** Particle speed multiplier per flow (0 = stopped; negative = reversed). */
export function flowRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running, f = s.fuel, flying = !s.ground;
  const prime = !run && E.fuelPumpOn && E.fuelOk && s.eng.mix > 0.5;
  const feed = (run && E.fuelOk && E.fuelPress) || prime;
  const hasL = f.qL > 0.02, hasR = f.qR > 0.02;
  const usesL = f.sel === "LEFT" || f.sel === "BOTH", usesR = f.sel === "RIGHT" || f.sel === "BOTH";
  R.fuelL = feed && hasL && usesL ? 1 : 0;
  R.fuelR = feed && hasR && usesR ? 1 : 0;
  R.fuelPump = R.fuelStr = feed ? (E.fuelPumpOn ? 1.4 : 1) : 0;
  R.fuelEdp = R.fuelServo = feed ? 1 : 0;
  R.fuelMetered = feed && (s.eng.mix > 0.06 || prime) ? 1 : 0;
  CYLS.forEach((c) => {
    R["inj" + c.n] = R.fuelMetered;
    R["man" + c.n] = run ? 1 : 0;
    R["exh" + c.n] = run ? 1.2 : 0;
  });
  // return: ≈ 7 GPH back through the top section of the selector to the selected tank(s) only (POH 7-43)
  const ret = run && feed ? 0.5 : 0;
  R.fuelReturn = ret;
  R.retL = usesL ? ret : 0; R.retR = usesR ? ret : 0;
  R.vent = feed ? 0.25 : 0;
  R.ovbL = R.ovbR = feed ? -0.3 : 0; // air in through the overboard vents as fuel is used
  const oil = run && !s.eng.fail.oil;
  R.oil = oil ? 0.7 : 0; R.oilRet = oil ? 0.5 : 0;
  const governs = oil && !s.eng.fail.gov;
  const fine = rpmFine(1, live.fs.ias), gov = govRpm(s.eng.prop);
  R.oilGov = governs ? (live.rpm > gov - 30 || fine > gov ? 0.8 : -0.4) : 0;
  R.intake = run && !s.eng.filter ? 1 : 0;
  R.altAir = run && s.eng.filter ? 1 : 0;
  R.tailpipe = R.tailpipeL = run ? 1.2 : 0;
  R.coolL = R.coolR = run || flying ? 0.6 + 0.6 * s.eng.cowl : 0;
  const ram = run || (flying && live.fs.ias > 30) ? 1 : 0;
  const env = s.env;
  R.ramL = R.ramR = ram && env.heat > 0.02 ? 1 : 0;
  R.heatL = R.heatR = ram ? env.heat * (run ? 1 : 0.4) : 0;
  R.ventIn = ram ? env.air : 0;
  R.toMan = R.heatL; R.toMan2 = R.ventIn;
  const tot = Math.min(1.4, R.heatL + R.ventIn);
  R.defrostL = R.defrostR = tot * env.defrost;
  R.floorL = R.floorR = R.rearL = R.rearR = tot * (1 - env.defrost * 0.5);
  const wr = flying && live.fs.ias > 30 && env.vents ? 0.8 : 0;
  R.wrootL = R.wrootR = R.wrearL = R.wrearR = R.wlowL = R.wlowR = wr;
  const air = flying ? 0.35 : 0;
  R.pitot = R.pitot2 = s.pitot.pitotBlocked ? 0 : air;
  R.staticL = R.staticR = R.static2 = s.pitot.staticBlocked || s.pitot.altStatic ? 0 : air;
  R.altStatic = s.pitot.altStatic ? 0.5 : 0;
  R.stall = live.horn ? 1.5 : 0;
  R.vac = R.vacOut = live.vac > 1 ? 1 : 0;
  R.alt = E.altOn ? 1 : 0;
  R.bat = E.mBatt > 0.3 ? -0.6 : E.mBatt < -0.3 ? 1 : s.eng.mags === "START" && E.starterPwr ? 1.6 : 0;
  R.ext = s.elec.ext && s.elec.bat ? 1 : 0;
  R.feedA = E.v.E1 > 0 || E.v.E2 > 0 ? 1 : 0;
  R.stbyBat = E.sBatt < -0.2 ? 1 : E.sBatt > 0.05 ? -0.5 : 0;
  R.starter = s.eng.mags === "START" && E.starterPwr ? 1.6 : 0;
  const k = live.kap;
  R.kapNav = k.powered && E.gia2 ? 0.4 : 0;
  R.kapTc = k.powered && !s.avx.tcFail ? 0.4 : 0;
  R.apRoll = R.apPitch = k.ap ? 1 : 0;
  R.apTrim = k.pt ? 1 : 0;
  // control cables: one strand pays out while the other takes up, only while the control moves
  const v = controlRates();
  R.elUp = v.pitch * 1.5; R.elDn = -v.pitch * 1.5;
  R.ailR = v.roll * 1.5; R.ailL = -v.roll * 1.5; R.ailBal = -v.roll * 1.5;
  R.rudR = -v.yaw * 1.5; R.rudL = v.yaw * 1.5;
  R.trim = v.trim * 4;
  R.flapX = s.flaps.moving ? 1 : 0;
  return R;
}

/** Cabin-air particle colour follows the CABIN HT / CABIN AIR blend. */
export function cabinAirColor(s: Sim, out: THREE.Color) {
  const h = s.env.heat / Math.max(0.05, s.env.heat + s.env.air);
  return out.set("#5FC8F0").lerp(new THREE.Color("#FF7A3D"), s.eng.running ? h : 0);
}
