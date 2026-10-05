/**
 * Per-frame simulation for the C172S: engine start (priming, flooding, starter), fixed-pitch RPM,
 * temperatures and pressures, vacuum and the standby gyro, fuel burn and starvation, flap motor,
 * battery state of charge (with time compression), latched annunciation timers, the GFC 700 and
 * the shared flight-state integrator. Continuous values go to `live`; discrete changes go through the store.
 */
import { clamp, lerp } from "@/lib/math";
import { initFlight, pitchFor, stepFlight, yokeCmd, type FlightState, type NavSrc } from "@/lib/avionics/flight";
import { gfc700Command, gfc700Engaged, gfc700Power, gfc700Tick } from "@/lib/avionics/gfc700";
import { stepNav3Soc } from "../cessna/electrical";
import { vacuumInHg } from "../cessna/annunciations";
import { AFCS_CFG, C172_FLIGHT, ELEC_CFG, densityFactor, enginePower, fuelFlowGph, fuelInd, lambda, live, rpmFor, stallKias, type Elec, type Sim } from "./model";
import { useC172 } from "./store";

/** Flap transit rate (°/s). The POH gives no transit time; ~10 s UP → FULL is assumed. */
export const FLAP_RATE = 3;

const magLive = (s: Sim) => {
  const g = s.eng, ok = (m: "L" | "R") => !(m === "L" ? g.fail.magL : g.fail.magR);
  return g.mags === "BOTH" || g.mags === "START" ? ok("L") || ok("R") : g.mags === "L" ? ok("L") : g.mags === "R" ? ok("R") : false;
};
const navValid = (src: NavSrc, E: Elec) => (src === "GPS" ? E.gia1 || E.gia2 : src.endsWith("1") ? E.gia1 : E.gia2);
/** Trim position → pitch attitude the airplane settles at hands-off (teaching model). */
export const trimPitch = (trim: number) => 2.8 + trim * 5;

export function simTick(dt: number) {
  const store = useC172.getState(), up = store.update;
  const { s, E } = store;
  const g = s.eng;
  const fs0 = live.fs, ias = s.ground ? 0 : fs0.ias, alt = fs0.alt;

  /* ---------- starting: priming, flooding, starter ---------- */
  const cranking = g.mags === "START" && E.starterPwr && !g.running;
  const pumpPrime = E.fuelPumpOn && E.fuelOk && !g.running;
  if (!g.running) {
    // aux pump + mixture rich with the engine stopped primes through the injection system (POH 4-12, 7-43)
    if (pumpPrime && g.mix > 0.5) live.wet += dt * 0.32 * g.mix;
    if (cranking) {
      live.crankT += dt; live.crankTotal += dt;
      if (E.fuelOk && g.mix > 0.3 && !g.fail.edp) live.wet += dt * 0.12 * g.mix; // engine-driven pump turning slowly
      // cranking with the mixture at IDLE CUTOFF slowly airs out the cylinders; with the throttle ½–full it clears a flooded engine (POH 4-12)
      if (g.mix < 0.08) live.wet -= dt * (0.03 + (g.throttle > 0.3 ? 0.55 * g.throttle : 0));
    } else { live.crankT = 0; live.crankTotal = Math.max(0, live.crankTotal - dt * 0.5); }
    live.wet = Math.max(0, live.wet - dt * 0.004);
    const flooded = live.wet > 1.9;
    if (flooded !== g.flooded) up((d) => { d.eng.flooded = flooded; });
    const warm = live.hot > 0.6 && g.mix > 0.25 && E.fuelOk;
    if (cranking && live.crankT > 0.9 && magLive(s) && ((live.wet > 0.3 && live.wet < 1.9) || warm)) {
      live.wet = 0.15; live.primeRun = 0;
      up((d) => { d.eng.running = true; });
    }
    // windmilling restart in flight (POH 3-7: "engine will restart automatically within a few seconds")
    const l = lambda(g.mix, alt);
    if (!s.ground && ias > 55 && magLive(s) && E.fuelOk && (!g.fail.edp || E.fuelPumpOn) && l > 0.6 && g.mags !== "START") {
      live.restartT += dt;
      if (live.restartT > 2.5) { live.restartT = 0; up((d) => { d.eng.running = true; }); }
    } else live.restartT = 0;
  } else {
    // running: stops on mags OFF, mixture cutoff (after the prime burns off), too lean, or no fuel pressure
    live.crankT = 0;
    if (g.mix < 0.06) live.primeRun += dt; else live.primeRun = 0;
    const fuelPress = E.fuelOk && (!g.fail.edp || E.fuelPumpOn);
    if (!fuelPress) live.starve += dt; else live.starve = 0;
    if (!magLive(s) || live.primeRun > 2.5 || lambda(g.mix, alt) < 0.5 || live.starve > (g.fail.edp ? 2 : 3.5)) {
      live.starve = 0; live.primeRun = 0;
      up((d) => { d.eng.running = false; });
    }
  }

  /* ---------- RPM (fixed-pitch: throttle, airspeed, altitude), engine indications ---------- */
  const cur = useC172.getState().s;
  const run = cur.eng.running;
  const P = run ? enginePower(cur, alt) : 0;
  const target = run ? rpmFor(P, ias) : cranking ? 260 : s.ground ? 0 : Math.max(0, (ias - 45) * 11);
  live.rpm = lerp(live.rpm, target, clamp(dt * (target > live.rpm ? 1.6 : 1.0), 0, 1));
  if (live.rpm < 3) live.rpm = 0;
  const l = lambda(cur.eng.mix, alt), air = Math.max(0.025, Math.pow(cur.eng.throttle, 0.85)) * densityFactor(alt);
  live.ff = run && E.fuelOk ? fuelFlowGph(cur, alt) : pumpPrime && cur.eng.mix > 0.5 ? 4.6 * cur.eng.mix : 0;
  const ap = (v: number, tgt: number, tau: number) => v + (tgt - v) * clamp(dt / tau, 0, 1);
  const oilPT = run && !g.fail.oil ? clamp(28 + 50 * Math.min(1, live.rpm / 2300) + (live.oilT < 120 ? 18 : 0), 0, 112) : 0;
  live.oilP = ap(live.oilP, oilPT, run && live.oilP < oilPT ? 9 : 2.5);
  const oatF = cur.pitot.oat * 1.8 + 32;
  live.oilT = ap(live.oilT, run ? 118 + 72 * P + cur.pitot.oat * 0.7 + (g.fail.oil ? 90 : 0) : oatF, 80);
  live.cht = ap(live.cht, run ? 230 + 190 * P * (1.15 - 0.5 * Math.abs(l - 1.05)) : oatF, 35);
  live.egt = ap(live.egt, run ? 1200 + 200 * air - (l > 1 ? 1500 : 2500) * (l - 1) ** 2 : oatF, 3);
  live.hot = clamp((live.cht - 120) / 220, 0, 1);
  if (live.oilP > 20) live.hobbs += dt / 3600;

  /* ---------- vacuum and the standby attitude gyro ---------- */
  live.vac = vacuumInHg(live.rpm, cur.vac.fail);
  live.gyro = live.vac >= 4 ? ap(live.gyro, 1, 20) : Math.max(0, live.gyro - live.gyro * dt / 200);
  live.drift = live.gyro > 0.7 ? ap(live.drift, 0, 10) : live.drift + dt * (1 - live.gyro) * 0.8;

  /* ---------- fuel burn, starvation, LOW FUEL timers ---------- */
  if (run && live.ff > 0) {
    const gal = (live.ff / 3600) * dt, f = cur.fuel;
    const hasL = f.qL > 0.02, hasR = f.qR > 0.02;
    if (f.sel === "LEFT") live.burnL += gal; else if (f.sel === "RIGHT") live.burnR += gal;
    else if (hasL && hasR) { live.burnL += gal / 2; live.burnR += gal / 2; } else if (hasL) live.burnL += gal; else live.burnR += gal;
    if (live.burnL + live.burnR > 0.05) {
      const bl = live.burnL, br = live.burnR; live.burnL = live.burnR = 0;
      up((d) => { d.fuel.qL = Math.max(0, d.fuel.qL - bl); d.fuel.qR = Math.max(0, d.fuel.qR - br); });
    }
  }
  const t = live.timers;
  t.lowL = fuelInd(cur.fuel.qL) < 5 ? t.lowL + dt : 0;
  t.lowR = fuelInd(cur.fuel.qR) < 5 ? t.lowR + dt : 0;
  t.stby = E.sBatt < -0.5 ? t.stby + dt : 0;
  const ann = { lowFuelL: t.lowL > 60, lowFuelR: t.lowR > 60, stbyBatt: t.stby > 10 };
  if (ann.lowFuelL !== cur.ann.lowFuelL || ann.lowFuelR !== cur.ann.lowFuelR || ann.stbyBatt !== cur.ann.stbyBatt) up((d) => { d.ann = ann; });

  /* ---------- flap motor (FLAPS breaker, ELECTRICAL BUS 1) ---------- */
  const ft = cur.flaps.cmd, moving = E.flapsPwr && Math.abs(live.flapAng - ft) > 0.05;
  if (moving) live.flapAng += Math.sign(ft - live.flapAng) * Math.min(Math.abs(ft - live.flapAng), FLAP_RATE * dt);
  if (moving !== cur.flaps.moving) up((d) => { d.flaps.moving = moving; });

  /* ---------- electrical: ACU over-voltage trip, battery state of charge ---------- */
  if (E.acuTrip && !cur.elec.cb["XF:ALT FIELD"]) up((d) => { d.elec.cb["XF:ALT FIELD"] = true; });
  live.socAcc += dt * cur.warp;
  if (live.socAcc > 0.5) {
    const n = stepNav3Soc(cur.elec, ELEC_CFG, E, live.socAcc / 60);
    live.socAcc = 0;
    if (Math.abs(n.socMain - cur.elec.socMain) > 0.001 || Math.abs(n.socStby - cur.elec.socStby) > 0.001 || (n.socStby === 0) !== (cur.elec.socStby === 0))
      up((d) => { d.elec.socMain = n.socMain; d.elec.socStby = n.socStby; });
  }
  live.testHeld = cur.elec.stby === "TEST" ? live.testHeld + dt : 0;

  /* ---------- CO from a cracked muffler under the heater shroud (POH 3-39) ---------- */
  const env = cur.env;
  const coT = env.coLeak && run ? Math.max(0, 170 * env.heat - 60 * env.air - (env.vents ? 25 : 0)) : 0;
  live.coPpm = ap(live.coPpm, coT, 15);

  /* ---------- flight state + GFC 700 ---------- */
  stepAir(cur, useC172.getState().E, P, dt);
}

function stepAir(s: Sim, E: Elec, P: number, dt: number) {
  let fs: FlightState = {
    ...live.fs, onGround: s.ground, power: P, oat: s.pitot.oat,
    fail: { att: !E.ahrs, hdg: !E.ahrs, air: !E.adc },
    navValid: navValid(live.fs.navSrc, E),
  };
  live.afcs = gfc700Power(live.afcs, E.afcsPwr && E.pfd, fs.t, AFCS_CFG);
  const engaged = gfc700Engaged(live.afcs);
  const ac = engaged ? gfc700Command(live.afcs, fs, AFCS_CFG) : null;
  const pilot = yokeCmd(s.ctrl.roll, s.ctrl.pitch, trimPitch(live.afcs.trim));
  const cmd = ac ?? (live.stallDemo ? { bank: 0, vs: 0 } : pilot);
  fs = stepFlight(fs, cmd, dt, C172_FLIGHT);
  if (s.ground) fs = { ...fs, ias: 0, vs: 0, pitch: 0, roll: 0, iasDot: 0 };
  live.afcs = gfc700Tick(live.afcs, fs, dt, AFCS_CFG);
  // autotrim relieves the pitch servo: trim follows the attitude the AP is holding
  if (engaged && live.afcs.pft === "pass" && !live.afcs.fail.trim) {
    const want = clamp((fs.pitch - 2.8) / 5, -1, 1);
    live.afcs = { ...live.afcs, trim: live.afcs.trim + clamp(want - live.afcs.trim, -0.05 * dt, 0.05 * dt) };
  }
  // stall: pneumatic horn 5–10 kt above the stall (POH 7-67), break below Vs
  const vs = stallKias(live.flapAng);
  live.horn = !s.ground && !s.stall.inletBlocked && fs.ias <= vs + 7;
  if (!s.ground && fs.ias < vs - 0.5) { live.stallDemo = false; fs = { ...fs, vs: Math.min(fs.vs, -900) }; }
  live.fs = fs;
  live.staticAlt = s.pitot.staticBlocked ? live.staticAlt ?? fs.alt : null;
  // effective control positions: servos when the AP is engaged, else the pilot's
  const tgt = { ...s.ctrl };
  if (engaged && ac) {
    tgt.roll = clamp((ac.bank - fs.roll) / 10, -1, 1) * 0.6;
    const pt = ac.pitch ?? pitchFor(fs, ac.vs ?? fs.vs);
    tgt.pitch = clamp((pt - fs.pitch) / 4, -1, 1) * 0.5;
  } else if (live.stallDemo && !s.ground) tgt.pitch = clamp((60 - fs.ias) / -25, -0.2, 0.9);
  const k = clamp(dt * 6, 0, 1);
  live.ctl.roll = lerp(live.ctl.roll, tgt.roll, k);
  live.ctl.pitch = lerp(live.ctl.pitch, tgt.pitch, k);
  live.ctl.yaw = lerp(live.ctl.yaw, tgt.yaw, k);
}

/* ---------- scenarios ---------- */
/** Scenarios keep the flight clock running so AFCS timers (preflight test, disconnect tone) stay consistent. */
const ground = (p: Partial<FlightState> = {}) => initFlight({ t: live.fs.t, onGround: true, ias: 0, vs: 0, pitch: 0, alt: 173, selAlt: 3000, hdg: 220, hdgBug: 220, crs: 220, power: 0, ...p });

/** Cold and dark on the ramp: everything off, engine cold, ready for the POH 4-11 start. */
export function scenarioColdDark() {
  live.fs = ground(); live.rpm = 0; live.oilP = 0; live.oilT = 60; live.cht = 60; live.egt = 60; live.wet = 0; live.hot = 0; live.vac = 0; live.gyro = 0; live.flapAng = 0;
  live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = true; d.eng.running = false; d.eng.mags = "OFF"; d.eng.throttle = 0; d.eng.mix = 0; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = false; d.elec.stby = "OFF"; d.elec.cb = {};
    d.fuel.pump = false; d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = true;
    d.lights = { ...d.lights, beacon: false, land: false, taxi: false, nav: false, strobe: false, dome: false };
    d.pitot.heat = false; d.ctrl = { pitch: 0, roll: 0, yaw: 0 };
  });
}

/** Engine running at 1,000 RPM on the ramp, avionics on (after the POH start checklist). */
export function scenarioRunUp() {
  live.fs = ground(); live.oilP = 60; live.oilT = 120; live.cht = 250; live.hot = 0.7; live.gyro = 1; live.flapAng = 0; live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = true; d.eng.running = true; d.eng.mags = "BOTH"; d.eng.throttle = 0.06; d.eng.mix = 0.95; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true; d.elec.stby = "ARM"; d.elec.cb = {};
    d.fuel.pump = false; d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = true;
    d.lights = { ...d.lights, beacon: true, nav: true, strobe: false };
  });
}

/** Cruise at 4,500 ft, 110 KIAS, AP off. */
export function scenarioCruise() {
  live.fs = initFlight({ t: live.fs.t, ias: 110, alt: 4500, selAlt: 4500, hdg: 90, hdgBug: 90, crs: 90, power: 0.75, oat: 8 });
  live.oilP = 74; live.oilT = 186; live.cht = 372; live.egt = 1360; live.hot = 1; live.gyro = 1; live.rpm = 2400; live.flapAng = 0; live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = false; d.eng.running = true; d.eng.mags = "BOTH"; d.eng.throttle = 0.86; d.eng.mix = 0.82; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true; d.elec.stby = "ARM";
    d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = false; d.ctrl = { pitch: 0, roll: 0, yaw: 0 };
    if (d.fuel.qL + d.fuel.qR < 10) { d.fuel.qL = 20; d.fuel.qR = 19; }
  });
}
