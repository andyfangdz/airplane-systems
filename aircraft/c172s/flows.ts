/** Pipes, wires, ducts and cables with moving particles (POH Figures 7-1, 7-6, 7-7, 7-8, 7-9) and the rules that drive them. */
import * as THREE from "three";
import type { FlowSpec } from "@/lib/catalogue";
import { V, clamp, type Vec3 } from "@/lib/math";
import type { Chan, SysId } from "@/lib/systems";
import { Z, wingP } from "./geometry";
import { live, type Elec, type Sim } from "./model";
import { CYLS, P3, PV } from "./parts";
import { FSEL, PITOT, STALL_INLET, STATIC_PORT } from "./parts-systems";
import { CABLES } from "./rig";

const F: FlowSpec[] = [];
const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) => F.push({ key, pts, sys, ...o });
const wp = (bl: number, c: number, up = 0, dy = 0): Vec3 => PV(wingP(Z(bl), c, up).add(V(0, dy, 0)));

/* ---------- fuel (Figure 7-6): supply cross-hatched, return hatched, vent open ---------- */
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L";
  flow("fuel" + sd, [wp(s * 23.5, 0.28, -1, 0.02), wp(s * 17, 0.2, -1, 0.03), P3(31.2, s * 17.8, 75.5), P3(30.8, s * 18.2, 32), P3(26, s * 8, 27.4), [FSEL[0] - 0.02, FSEL[1], FSEL[2] + s * 0.03]], ["fuel"],
    { name: (s > 0 ? "Right" : "Left") + " tank supply line", note: "Gravity feed from the tank outlet screen down the forward door post to the selector valve.", r: 0.009 });
});
const RES = P3(14.5, 0, 25.6);
flow("fuelSel", [FSEL, P3(18, 0, 25.4), RES], ["fuel"], { name: "Selector → reservoir tank", r: 0.01 });
flow("fuelPump", [RES, P3(11, -2, 25.8), P3(9.5, -3, 26), P3(4.5, -2.5, 26.5), P3(0.5, -3, 27.5), P3(-4, -4, 29)], ["fuel"], { name: "Reservoir → aux pump → shutoff valve → strainer", note: "Through the firewall to the fuel strainer (Fig. 7-6).", r: 0.01 });
flow("fuelEdp", [P3(-4, -4, 29), P3(-6, -6, 36), P3(-7, -6, 45)], ["fuel", "engine"], { name: "Strainer → engine-driven pump", r: 0.009 });
flow("fuelServo", [P3(-7, -6, 45), P3(-12, -5, 38), P3(-20, 0, 36.5)], ["fuel", "engine"], { name: "Engine-driven pump → fuel/air control unit", r: 0.009 });
flow("fuelMetered", [P3(-20, 0, 37.5), P3(-24, 3, 46), P3(-22.6, 3, 57), P3(-18, 0, 58.5)], ["fuel", "engine"], { name: "Metered fuel → flow transducer → distribution unit", note: "From the servo on the bottom of the engine up to the flow divider on top, through the fuel flow transducer (POH 7-37).", r: 0.008 });
CYLS.forEach((c) => flow("inj" + c.n, [P3(-18, 0, 58.5), P3(c.fs + 1, c.s * 6, 57), P3(c.fs - 0.5, c.s * 9.5, 46)], ["fuel", "engine"], { name: "Injector line, cylinder " + c.n, note: "To the air-bleed nozzle at the intake port.", r: 0.005, count: 5 }));
flow("fuelReturn", [P3(-20, 2, 38.5), P3(-10, 4, 34), P3(0, 3.5, 28.5), P3(4, 3, 27.5), [RES[0] + 0.02, RES[1] + 0.02, RES[2] + 0.03]], ["fuel"], { name: "Fuel return line", note: "Orifice in the top of the fuel/air control unit → check valve → reservoir tank: returns fuel/vapor to cut hot-weather vapor (POH 7-44).", r: 0.006, color: "#7EB3F5" });
flow("vent", [wp(-90, 0.15, 1, -0.02), wp(-23, 0.15, 1, -0.02), wp(23, 0.15, 1, -0.02), wp(90, 0.15, 1, -0.02)], ["fuel"], { tube: false, pcolor: "#CFE3FF", size: 0.05, name: "Vent" });

/* ---------- oil, induction, exhaust, cooling ---------- */
flow("oil", [P3(-18, 0, 38.5), P3(-8, -3, 42), P3(-5, 0, 47.5), P3(-8, 9, 52), P3(-11, 14, 56), P3(-16, 6, 55), P3(-22, -6, 54), P3(-18, 0, 47)], ["engine"],
  { r: 0.009, color: "#B85A2A", name: "Oil circuit", note: "Sump pickup screen → engine-driven pump → full-flow filter → pressure relief valve → thermostatic remote oil cooler → galleries → back to the sump (POH 7-35)." });
flow("intake", [P3(-38.5, 0, 37.8), P3(-27.5, 0, 38), P3(-23, 0, 37.5), P3(-20, 0, 36.5)], ["engine"], { tube: false, pcolor: "#8FD3E8", size: 0.06, name: "Induction air" });
flow("altAir", [P3(-24, -12, 34), P3(-23, -5, 37.5), P3(-20, 0, 36.5)], ["engine"], { tube: false, pcolor: "#F2C26B", size: 0.06, name: "Alternate air (unfiltered)" });
CYLS.forEach((c) => {
  flow("man" + c.n, [P3(-20, 0, 37.5), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 11, 45.5)], ["engine"], { tube: false, pcolor: "#8FD3E8", count: 4, size: 0.04 });
  flow("exh" + c.n, [P3(c.fs, c.s * 15, 46), P3(c.fs - 1, c.s * 12, 38), P3(-22.7, c.s * 3, 34.5)], ["engine", "environment"], { r: 0.016, color: "#8A5A3C", pcolor: "#FF8A4A", count: 4, name: "Exhaust riser", note: "Each cylinder's riser runs to the common muffler below the engine (POH 7-37)." });
});
flow("tailpipe", [P3(-22.7, 4, 33.5), P3(-16, 6, 29), P3(-12, 7, 24)], ["engine"], { r: 0.022, color: "#8A5A3C", pcolor: "#FF8A4A", name: "Tailpipe", note: "Single tailpipe overboard below the cowl (POH 7-37).", ext: true });
[1, -1].forEach((s) => flow("cool" + (s > 0 ? "R" : "L"), [P3(-38.4, s * 10.2, 53.3), P3(-24, s * 9, 59), P3(-18, s * 13, 52), P3(-10, s * 12, 35), P3(-2, s * 6, 24)], ["engine"], { tube: false, pcolor: "#BEE6F2", size: 0.05, count: 10 }));

/* ---------- cabin heat and ventilation (Figure 7-8) ---------- */
const AIR = "#149C94", MAN = P3(5, 0, 31);
flow("ram", [P3(-38.5, 6, 49), P3(-30, 5, 40), P3(-22.7, 2, 34)], ["environment"], { tube: false, pcolor: "#8FD3E8", size: 0.05, name: "Ram air to the shroud" });
flow("heat", [P3(-22.7, -1, 34), P3(-12, 3, 35), P3(-3, 5, 37.5), P3(0.6, 5, 37.5)], ["environment"], { r: 0.022, color: "#E0522B", pcolor: "#FF7A3D", name: "Heated air duct", note: "Muffler shroud → heater control valve (CABIN HT) (Fig. 7-8)." });
flow("ventIn", [P3(-34, 12, 44), P3(-14, 13, 40), P3(0.6, 14, 36.5)], ["environment"], { r: 0.02, color: AIR, pcolor: "#5FC8F0", name: "Ventilating air duct", note: "Ram air from the right side → ventilating air door (CABIN AIR)." });
flow("toMan", [P3(0.6, 5, 37.5), P3(3, 3, 33), MAN], ["environment"], { r: 0.022, color: AIR, name: "Into the cabin manifold" });
flow("toMan2", [P3(0.6, 14, 36.5), P3(3, 8, 32), MAN], ["environment"], { r: 0.022, color: AIR });
[1, -1].forEach((s) => {
  const sd = s > 0 ? "R" : "L";
  flow("defrost" + sd, [MAN, P3(8, s * 4, 48), P3(12, s * 6, 62), P3(14.5, s * 7, 67)], ["environment"], { r: 0.014, color: AIR, name: "Defroster duct", note: "Manifold → defroster outlet at the base of the windshield (POH 7-62)." });
  flow("floor" + sd, [MAN, P3(8, s * 10, 27)], ["environment"], { r: 0.012, color: AIR, name: "Front floor outlets", note: "Holes across the manifold just forward of the front occupants' feet." });
  flow("rear" + sd, [MAN, P3(8, s * 14, 28), P3(14, s * 15, 27.5)], ["environment"], { r: 0.012, color: AIR, name: "Rear cabin floor duct", note: "Down each side of the cabin to an outlet just aft of the rudder pedals (POH 7-62)." });
  flow("wroot" + sd, [wp(s * 19, 0.01, 0, -0.005), wp(s * 17.5, 0.06, 0, -0.01), P3(29, s * 17.8, 77.5), P3(30, s * 18.2, 74.5)], ["environment"], { r: 0.012, color: AIR, pcolor: "#5FC8F0", name: "Wing-root fresh air", note: "To the forward cabin upper and lower outlets — not heated (Fig. 7-8)." });
  flow("wrear" + sd, [P3(29, s * 17.8, 77.5), P3(50, s * 17.5, 78), P3(72, s * 17.6, 75.5)], ["environment"], { r: 0.01, color: AIR, pcolor: "#5FC8F0", name: "Rear cabin upper air duct" });
});

/* ---------- pitot-static, stall warning, vacuum ---------- */
const PIT = "#3A9448", ADC = P3(118.7, -4, 55), SBY = P3(16, 0, 52);
flow("pitot", [[PITOT[0] - 0.05, PITOT[1] + 0.02, PITOT[2]], wp(-65, 0.25, -1, 0.04), wp(-45, 0.3, 0), wp(-17, 0.25, -1, 0.03), P3(31.6, -18.4, 75), P3(31, -18.3, 32), P3(20, -6, 28), SBY], ["pitot"], { r: 0.006, color: PIT, name: "Pitot line", note: "Pitot head → wing → door post → standby airspeed indicator and the air data computer (POH 7-12)." });
flow("pitot2", [P3(31, -18.3, 32), P3(70, -14, 29), P3(110, -6, 34), ADC], ["pitot"], { r: 0.006, color: PIT, name: "Pitot line to the GDC 74A" });
flow("static", [STATIC_PORT, P3(15, -17, 44), P3(16, -4, 49), SBY], ["pitot"], { r: 0.006, color: "#2E7A3A", name: "Static line", note: "Static port → standby airspeed and altimeter; shared with the air data computer (POH 7-12)." });
flow("static2", [P3(15, -17, 44), P3(40, -14, 27.5), P3(110, -6, 36), ADC], ["pitot"], { r: 0.006, color: "#2E7A3A", name: "Static line to the GDC 74A" });
flow("altStatic", [P3(30, -5, 40), P3(16.5, -3.5, 50.5), P3(16, -2, 51)], ["pitot"], { tube: false, pcolor: "#B7E5B4", size: 0.04, name: "Cabin static air" });
flow("stall", [STALL_INLET, wp(-91, 0.15, 0), wp(-30, 0.18, 0), wp(-17, 0.15, 0, -0.04), P3(27, -17.4, 74.5)], ["pitot"], { r: 0.007, color: PIT, name: "Stall warning tube", note: "Inlet in the left wing leading edge → air-operated horn at the upper left windshield (POH 7-67)." });
const VACC = "#4FA8A0";
flow("vac", [P3(2, 3, 58), P3(14, 1, 54), P3(12, 3, 54), P3(2, 8, 56), P3(-2, 0, 52), P3(-5, -5.5, 46.5)], ["vacuum"], { r: 0.008, color: VACC, name: "Vacuum line", note: "Filter → attitude indicator → regulator → engine-driven pump (Fig. 7-9).", pcolor: "#9FE3DA" });
flow("vacOut", [P3(-5, -5.5, 44), P3(-6, -6, 32), P3(-6, -8, 24.8)], ["vacuum"], { tube: false, pcolor: "#9FE3DA", size: 0.04 });

/* ---------- electrical feeders (Figure 7-7) ---------- */
const JB = P3(-2.5, -15, 43), CB = P3(16.8, -12.5, 46.3);
flow("alt", [P3(-29.5, 8, 43.5), P3(-20, 4, 34), P3(-8, -8, 36), JB], ["electrical"], { r: 0.01, color: "#D9960F", name: "Alternator output", note: "Alternator B terminal → ACU → alternator relay → J-box main node." });
flow("bat", [P3(-5, -12, 53), P3(-4, -14, 48), JB], ["electrical"], { r: 0.012, color: "#D9960F", name: "Battery cable", note: "Main battery → battery relay (MASTER BAT) → current shunt (M BATT)." });
flow("ext", [P3(-3, -20, 40), P3(-3, -17, 42), JB], ["electrical"], { r: 0.01, color: "#D9960F", name: "External power" });
flow("feedA", [JB, P3(2, -16, 44), P3(12, -14, 45), CB], ["electrical"], { r: 0.01, color: "#D9960F", name: "Bus feeders (C/B “A” and “B”)", note: "Push-to-reset feeder breakers in the J-box feed ELECTRICAL BUS 1 and BUS 2 on the breaker panel (Fig. 7-7)." });
flow("stbyBat", [P3(11.2, -14, 51), P3(14, -13.5, 48), CB], ["electrical"], { r: 0.008, color: "#D9960F", name: "Standby battery feed", note: "Standby battery → 25 A fuse → STBY BATT switch → STDBY BATT breaker → ESSENTIAL BUS." });
flow("starter", [JB, P3(-10, -12, 40), P3(-30, -7, 41.5)], ["electrical", "engine"], { r: 0.012, color: "#D9960F", name: "Starter cable", note: "Starter contactor (J-box) → starter." });

/* ---------- control cables (Figure 7-1) and flap drive ---------- */
CABLES.forEach((c) => flow(c.key, c.pts, ["controls"], { r: 0.004, size: 0.04, tension: 0.05, name: c.name, note: c.note, count: 18, chan: c.chan === "trim" ? ["elevator"] : [c.chan as Chan] }));
flow("flapX", [wp(-24, 0.66, 0, -0.01), wp(24, 0.66, 0, -0.01)], ["flaps"], { tube: false, pcolor: "#B9A3F0", size: 0.05 });

export const FLOWS = F;
const CABIN_AIR = ["toMan", "toMan2", "defrostL", "defrostR", "floorL", "floorR", "rearL", "rearR"];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/* control-cable motion follows the rate of change of each channel */
const prev = { pitch: 0, roll: 0, yaw: 0, trim: 0, t: 0 }, vel = { pitch: 0, roll: 0, yaw: 0, trim: 0 };
function controlRates() {
  const t = performance.now() / 1000, dt = Math.max(1e-3, t - prev.t);
  const cur = { ...live.ctl, trim: live.afcs.trim };
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
  R.fuelL = feed && hasL && f.sel !== "RIGHT" ? 1 : 0;
  R.fuelR = feed && hasR && f.sel !== "LEFT" ? 1 : 0;
  R.fuelSel = R.fuelPump = feed ? (E.fuelPumpOn ? 1.4 : 1) : 0;
  R.fuelEdp = R.fuelServo = feed ? 1 : 0;
  R.fuelMetered = feed && (s.eng.mix > 0.06 || prime) ? 1 : 0;
  CYLS.forEach((c) => {
    R["inj" + c.n] = R.fuelMetered;
    R["man" + c.n] = run ? 1 : 0;
    R["exh" + c.n] = run ? 1.2 : 0;
  });
  R.fuelReturn = run && feed ? 0.5 : 0;
  R.vent = feed ? 0.25 : 0;
  R.oil = run && !s.eng.fail.oil ? 0.7 : 0;
  R.intake = run && !s.eng.filter ? 1 : 0;
  R.altAir = run && s.eng.filter ? 1 : 0;
  R.tailpipe = run ? 1.2 : 0;
  R.coolL = R.coolR = run || flying ? 1 : 0;
  const ram = run || (flying && live.fs.ias > 30) ? 1 : 0;
  const env = s.env;
  R.ram = ram && env.heat > 0.02 ? 1 : 0;
  R.heat = ram ? env.heat * (run ? 1 : 0.4) : 0;
  R.ventIn = ram ? env.air : 0;
  R.toMan = R.heat; R.toMan2 = R.ventIn;
  const tot = Math.min(1.4, R.heat + R.ventIn);
  R.defrostL = R.defrostR = tot * env.defrost;
  R.floorL = R.floorR = R.rearL = R.rearR = tot * (1 - env.defrost * 0.5);
  const wr = flying && live.fs.ias > 30 && env.vents ? 0.8 : 0;
  R.wrootL = R.wrootR = R.wrearL = R.wrearR = wr;
  const air = flying ? 0.35 : 0;
  R.pitot = R.pitot2 = s.pitot.pitotBlocked ? 0 : air;
  R.static = R.static2 = s.pitot.staticBlocked || s.pitot.altStatic ? 0 : air;
  R.altStatic = s.pitot.altStatic ? 0.5 : 0;
  R.stall = live.horn ? -1 : 0;
  R.vac = R.vacOut = live.vac > 1 ? 1 : 0; // cabin air: filter → gyro rotor → regulator → pump → overboard
  R.alt = E.altOn ? 1 : 0;
  R.bat = E.mBatt > 0.3 ? -0.6 : E.mBatt < -0.3 ? 1 : 0;
  R.ext = s.elec.ext && s.elec.bat ? 1 : 0;
  R.feedA = E.v.E1 > 0 || E.v.E2 > 0 ? 1 : 0;
  R.stbyBat = E.sBatt < -0.2 ? 1 : E.sBatt > 0.05 ? -0.5 : 0;
  R.starter = s.eng.mags === "START" && E.starterPwr ? 1.6 : 0;
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
