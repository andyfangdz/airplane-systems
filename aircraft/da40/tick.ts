/**
 * Per-frame simulation: engine start (AFM 4A / AFMS §4 start procedures), governor and RPM/MAP, oil and fuel
 * pressures, temperatures, fuel starvation, flap motor, long-range fuel-gauge behaviour, and the GFC 700 +
 * flight-state stepping. Continuous values go to `live`; only discrete changes go through the store.
 */
import { pitchFor, stepFlight, yokeCmd, type FlightCmd } from "@/lib/avionics/flight";
import { GFC700_DA40, gfc700Command, gfc700Engaged, gfc700Fail, gfc700Power, gfc700Tick, type Gfc700Mistrim } from "@/lib/avionics/gfc700";
import { clamp, lerp } from "@/lib/math";
import { DA40_FLIGHT, fuelAvail, gaugeTarget, govRpm, live } from "./model";
import { useDA40 } from "./store";

export const AFCS_CFG = GFC700_DA40;
/** Trim that holds ~119 KIAS level with the stick centred (pilot command pitch = 1.5° + 4° × trim). */
export const TRIM_PITCH = (trim: number) => 1.5 + trim * 4;
live.afcs = { ...live.afcs, trim: 0.27 };

/** Engine power fraction 0..1 from MAP and RPM (illustrative). */
export const powerFrac = (map: number, rpm: number) => clamp(((map - 10) / 18.5) * (rpm / 2700), 0, 1);

let trimPrev = live.afcs.trim;

export function simTick(dt: number) {
  const store = useDA40.getState(), up = store.update;
  let { s, E } = store;
  const g = s.eng, fs = live.fs;

  // ---------- ignition key: START springs back to BOTH (spring return assumed; AFM 7-20 is silent) ----------
  if (g.key === "START") {
    live.startTimer -= dt;
    if (live.startTimer <= 0) up((d) => { d.eng.key = "BOTH"; });
  }
  ({ s, E } = useDA40.getState());
  const cranking = E.starterOn && !s.eng.running;
  live.crankT = E.starterOn ? live.crankT + dt : 0;
  const avail = fuelAvail(s);
  const pumping = s.fuel.pump && E.pumpPwr && avail;

  // ---------- priming and starting ----------
  if (!s.eng.running) {
    if (pumping && s.eng.mix > 0.5) live.prime = Math.min(12, live.prime + dt); // electric pump ON + mixture RICH = priming
    else if (cranking && s.eng.mix <= 0.05 && s.eng.throttle > 0.35) live.prime = Math.max(0, live.prime - dt * 1.5); // flooded start: mixture LEAN, throttle half
    else live.prime = Math.max(0, live.prime - dt * 0.03);
    if (cranking && avail && s.eng.key !== "OFF") {
      const flooded = live.prime > 7, primed = live.prime >= 1 && !flooded;
      const fires = (primed && live.crankT > 1.0) || (!flooded && live.prime < 1 && s.eng.mix > 0.3 && live.crankT > 3.5);
      if (fires) { live.prime = 0; live.fireT = 0; up((d) => { d.eng.running = true; }); }
    }
  }
  ({ s, E } = useDA40.getState());

  // ---------- fuel pressure: engine-driven pump + electric pump ----------
  const mech = s.eng.fail.mechPump ? 0 : live.rpm > 500 ? 16 + 12 * clamp((live.rpm - 600) / 2100, 0, 1) : live.rpm > 100 ? 4 : 0;
  const elecP = pumping ? 26 : 0;
  const fuelPT = !avail ? 0 : Math.max(mech, elecP) + (mech > 0 && elecP > 0 ? 2 : 0);
  live.fuelP = lerp(live.fuelP, fuelPT, clamp(dt * 3, 0, 1));

  // ---------- running checks: key OFF, mixture cut-off, starvation ----------
  if (s.eng.running) {
    if (live.fireT >= 0) { live.fireT += dt; if (s.eng.mix > 0.05) live.fireT = -1; }
    const cutoff = s.eng.mix <= 0.05 && (live.fireT < 0 || live.fireT > 3);
    const starved = !avail || live.fuelP < 8;
    live.starve = starved ? live.starve + dt : 0;
    if (s.eng.key === "OFF" || cutoff || live.starve > 3) { live.starve = 0; live.fireT = -1; up((d) => { d.eng.running = false; }); }
  }
  ({ s, E } = useDA40.getState());
  const run = s.eng.running;

  // ---------- RPM: governor (blue lever) or fine-pitch stop (throttle) ----------
  const gov = govRpm(s), govOk = !s.eng.fail.governor && live.oilP >= 15;
  const fine = 650 + s.eng.throttle * 2350 + (s.air ? fs.ias * 4 : 0);
  let target = 0;
  if (run) {
    target = govOk ? Math.min(fine, gov) : Math.min(fine, 2950);
    if ((s.eng.key === "L" || s.eng.key === "R") && fine <= gov + 30) target -= 90; // single-magneto drop below the governing range
    if (s.eng.mix < 0.25) target -= (0.25 - s.eng.mix) * 1600; // too lean: rough running
  } else if (cranking) target = 260;
  else if (s.air && fs.ias > 65) target = 600 + (fs.ias - 65) * 12; // windmilling (AFM 3-17: keeps turning above ~65 KIAS)
  live.rpm = lerp(live.rpm, target, clamp(dt * (target > live.rpm ? 2.0 : 1.2), 0, 1));
  if (live.rpm < 3) live.rpm = 0;

  // ---------- MAP, power, fuel flow ----------
  const ambient = 29.92 - (s.air ? fs.alt / 1000 : 0.19);
  const mapT = run ? Math.min(ambient, 10 + 19.5 * Math.pow(s.eng.throttle, 0.85) - (s.air ? fs.alt / 1000 : 0) * 0.15) - (s.eng.altAir ? 0.8 : 0) : ambient;
  live.map = lerp(live.map, mapT, clamp(dt * 3, 0, 1));
  const pwr = run ? powerFrac(live.map, live.rpm) : 0;
  const ffT = run ? (1.8 + 12.6 * pwr) * (0.75 + 0.35 * s.eng.mix) : pumping && s.eng.mix > 0.5 ? 4 : 0;
  live.ff = lerp(live.ff, ffT, clamp(dt * 2, 0, 1));

  // ---------- oil and temperatures ----------
  const oatF = s.pitot.oat * 1.8 + 32;
  const oilTT = run ? 160 + 55 * pwr + (s.pitot.oat - 15) * 0.8 : oatF;
  live.oilT = lerp(live.oilT, oilTT, clamp(dt / 40, 0, 1));
  // oil loss: pressure decays over ~40 s; below 15 psi the governor loses oil and the blades go to fine pitch (AFM 7-22)
  live.oilLoss = s.eng.fail.oilLeak ? Math.min(1, live.oilLoss + dt / 40) : 0;
  const oilPT = run || live.rpm > 300 ? (35 + 45 * clamp((live.rpm - 600) / 2100, 0, 1) + clamp((180 - live.oilT) * 0.2, 0, 15)) * (1 - live.oilLoss) : 0;
  live.oilP = lerp(live.oilP, oilPT, clamp(dt * 2, 0, 1));
  live.cht = lerp(live.cht, run ? 210 + 190 * pwr + 40 * (1 - s.eng.mix) : oatF, clamp(dt / 25, 0, 1));
  live.egt = lerp(live.egt, run ? 1150 + 260 * pwr + 220 * Math.exp(-(((s.eng.mix - 0.55) / 0.2) ** 2)) : oatF, clamp(dt / 4, 0, 1));

  // ---------- flaps: electric motor (travel time not in the AFM; ~7°/s assumed) ----------
  const ft = [0, 20, 42][s.flaps.cmd];
  if (E.flapsPwr && Math.abs(live.flapAng - ft) > 0.01) live.flapAng += Math.sign(ft - live.flapAng) * Math.min(Math.abs(ft - live.flapAng), 7 * dt);

  // ---------- long-range fuel gauges: pointer migrates to 16 over 30 s (AFMS §7.10) ----------
  const gauge = (cur: number, q: number) => { const t = gaugeTarget(q); return t === 16 && cur > 16 && cur <= 24.01 && q <= 19 ? Math.max(16, cur - (8 / 30) * dt) : t; };
  live.gaugeL = gauge(live.gaugeL, s.fuel.qL);
  live.gaugeR = gauge(live.gaugeR, s.fuel.qR);

  // ---------- GFC 700 and flight state ----------
  if (fs.onGround === s.air) live.fs = { ...fs, onGround: !s.air };
  const fail = { att: !E.ahrs, hdg: !E.ahrs, air: !E.adc };
  if (!!live.fs.fail.att !== fail.att || !!live.fs.fail.air !== fail.air) live.fs = { ...live.fs, fail };
  // GIA 1 lost → AP, FD and MET inoperative; GIA 2 or PFD lost → AP & MET lost (red AFCS) (AFMS p. 10)
  live.afcs = gfc700Power(live.afcs, E.afcsPwr && E.gia1, live.fs.t, AFCS_CFG);
  const imb = s.fuel.qL - s.fuel.qR, U = live.afcsUser;
  const mistrim: Gfc700Mistrim | null = U.mistrim ?? (live.afcs.ap && Math.abs(imb) > 8 ? (imb > 0 ? "AIL→" : "←AIL") : null);
  const want = { pitch: !!U.pitch, roll: !!U.roll, trim: !!U.trim, pft: !!U.pft, sys: !!U.sys || !E.gia2 || !E.pfd, mistrim };
  const key = JSON.stringify(want);
  if (live.afcs.powered && key !== live.afcsDerived) { live.afcs = gfc700Fail(live.afcs, want, live.fs.t); live.afcsDerived = key; }
  if (!live.afcs.powered) live.afcsDerived = "";
  const engaged = gfc700Engaged(live.afcs);
  const ap = engaged ? gfc700Command(live.afcs, live.fs, AFCS_CFG) : null;
  const cmd: FlightCmd = ap ?? yokeCmd(s.ctrl.roll, s.ctrl.pitch, TRIM_PITCH(live.afcs.trim));
  live.fs = stepFlight({ ...live.fs, power: run ? s.eng.throttle : 0 }, cmd, dt, DA40_FLIGHT);
  live.afcs = gfc700Tick(live.afcs, live.fs, dt, AFCS_CFG);

  // servos drive the stick and surfaces while engaged; autotrim offloads the pitch servo (CRG 6-21)
  const f = live.fs;
  let tgt = s.ctrl;
  if (ap) {
    const pitchT = ap.pitch ?? pitchFor(f, ap.vs ?? f.vs);
    tgt = { pitch: clamp((pitchT - f.pitch) / 3, -1, 1) * 0.5 + clamp((pitchT - TRIM_PITCH(live.afcs.trim)) / 8, -0.3, 0.3), roll: clamp((ap.bank - f.roll) / 10, -1, 1) * 0.55 + f.roll / 120, yaw: 0 };
    const trimT = clamp((pitchT - 1.5) / 4, -1, 1);
    live.afcs = { ...live.afcs, trim: live.afcs.trim + clamp(trimT - live.afcs.trim, -0.06 * dt, 0.06 * dt) };
  }
  const k = clamp(dt * 5, 0, 1);
  live.eff = { pitch: lerp(live.eff.pitch, tgt.pitch, k), roll: lerp(live.eff.roll, tgt.roll, k), yaw: lerp(live.eff.yaw, tgt.yaw, k) };
  live.trimRate = (live.afcs.trim - trimPrev) / Math.max(dt, 1e-3);
  trimPrev = live.afcs.trim;
}
