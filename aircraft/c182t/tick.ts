/**
 * Per-frame simulation for the C182T: engine start (priming with the aux pump, flooding, starter), manifold pressure and the
 * constant-speed propeller governor, temperatures and pressures with the cowl flaps, vacuum and the standby gyro, fuel burn,
 * unporting and starvation, flap motor, battery state of charge (with time compression), latched annunciation timers, the
 * KAP 140 and the shared flight-state integrator. Continuous values go to `live`; discrete changes go through the store.
 */
import { clamp, lerp } from "@/lib/math";
import { navReceiverValid, pitchFor, stepFlight, yokeCmd, type FlightState } from "@/lib/avionics/flight";
import { kap140Command, kap140Power, kap140Tick } from "@/lib/avionics/kap140";
import { stepNav3Soc } from "../cessna/electrical";
import { vacuumInHg } from "../cessna/tick";
import {
  C182_FLIGHT,
  bladeGov,
  eisExceedance,
  elecCfg,
  fuelFlowGph,
  fuelInd,
  govRpm,
  lambda,
  live,
  magsLive,
  manifold,
  powerFrac,
  rpmFine,
  stallKias,
  type Elec,
  type Sim,
} from "./model";
import { useC182 } from "./store";

/** Flap transit rate (°/s). The POH gives no transit time; ≈ 12 s from UP to FULL (38°) is assumed. */
export const FLAP_RATE = 3.2;
/** A quarter tank of usable fuel (43.5 gal per tank): below it, prolonged uncoordinated flight on that tank is prohibited (POH 2-14). */
export const QUARTER_TANK = 43.5 / 4;

/** Trim position → pitch attitude the airplane settles at hands-off (teaching model). */
export const trimPitch = (trim: number) => 2.5 + trim * 5;

/** Selected tank(s) uncovered by a prolonged slip: ¼ tank or less on LEFT/RIGHT, or one tank dry on BOTH (POH 2-14, 7-39, 7-44). */
export function unportRisk(s: Sim) {
  const f = s.fuel;
  if (!f.slip || s.ground) return false;
  if (f.sel === "LEFT") return f.qL <= QUARTER_TANK;
  if (f.sel === "RIGHT") return f.qR <= QUARTER_TANK;
  if (f.sel === "BOTH") return f.qL <= 0.02 || f.qR <= 0.02;
  return false;
}

export function simTick(dt: number) {
  const store = useC182.getState(),
    up = store.update;
  const { s, E } = store;
  const g = s.eng;
  const fs0 = live.fs,
    ias = s.ground ? 0 : fs0.ias,
    alt = fs0.alt;

  /* ---------- starting: priming through the injection system, flooding, starter (POH 4-13, 4-27, 7-43) ---------- */
  const cranking = g.mags === "START" && E.starterPwr && !g.running;
  const pumpPrime = E.fuelPumpOn && E.fuelOk && !g.running;
  if (!g.running) {
    // aux pump + mixture rich with the engine stopped primes; "stable fuel flow is indicated (approximately 3 to 5 seconds)"
    if (pumpPrime && g.mix > 0.5) live.wet += dt * 0.3 * g.mix;
    if (cranking) {
      live.crankT += dt;
      live.crankTotal += dt;
      if (E.fuelOk && g.mix > 0.3 && !g.fail.edp) live.wet += dt * 0.1 * g.mix;
      // flooded start: mixture IDLE CUTOFF, throttle ½ to full, crank (POH 4-13)
      if (g.mix < 0.08) live.wet -= dt * (0.03 + (g.throttle > 0.4 ? 0.55 * g.throttle : 0));
    } else {
      live.crankT = 0;
      live.crankTotal = Math.max(0, live.crankTotal - dt * 0.5);
    }
    live.wet = Math.max(0, live.wet - dt * 0.004);
    const flooded = live.wet > 1.9;
    if (flooded !== g.flooded)
      up((d) => {
        d.eng.flooded = flooded;
      });
    // warm engine: the fuel manifold stays primed for 20–30 min after shutdown — omit priming (POH 4-13 NOTE, 4-27)
    const warm = live.hot > 0.6 && E.fuelOk;
    if (cranking && live.crankT > 1.0 && magsLive(g) > 0 && live.wet < 1.9 && (live.wet > 0.3 || warm)) {
      live.wet = 0.15;
      live.primeRun = 0;
      live.crankTotal = 0;
      up((d) => {
        d.eng.running = true;
      });
    }
    // windmilling restart (POH 3-7: "If propeller is windmilling, engine will restart automatically within a few seconds")
    const l = lambda(g.mix, alt);
    if (
      !s.ground &&
      ias > 60 &&
      magsLive(g) > 0 &&
      E.fuelOk &&
      (!g.fail.edp || E.fuelPumpOn) &&
      l > 0.6 &&
      g.mags !== "START" &&
      live.unport < 30
    ) {
      live.restartT += dt;
      if (live.restartT > 2.5) {
        live.restartT = 0;
        up((d) => {
          d.eng.running = true;
        });
      }
    } else live.restartT = 0;
  } else {
    // running: stops on mags OFF, no fuel pressure, an uncovered tank outlet, or a mixture too lean to burn once the fuel already
    // in the cylinders has burned off (~2.5 s) — also the window to advance the mixture after a start
    live.crankT = 0;
    if (lambda(g.mix, alt) < 0.5) live.primeRun += dt;
    else live.primeRun = 0;
    const fuelPress = E.fuelOk && (!g.fail.edp || E.fuelPumpOn) && live.unport < 30;
    if (!fuelPress) live.starve += dt;
    else live.starve = 0;
    if (magsLive(g) === 0 || live.primeRun > 2.5 || live.starve > (g.fail.edp ? 2 : 3.5)) {
      live.starve = 0;
      live.primeRun = 0;
      up((d) => {
        d.eng.running = false;
      });
    }
  }
  live.unport = unportRisk(s) ? live.unport + dt : 0;

  /* ---------- MAP, governor and RPM, power, engine indications ---------- */
  const cur = useC182.getState().s;
  const run = cur.eng.running;
  const p2400 = run ? powerFrac(cur, manifold(cur, 2400, alt), 2400, alt) : 0;
  const fine = rpmFine(p2400, ias),
    gov = govRpm(cur.eng.prop);
  // the governor boosts engine oil to the hub; without it the blades go to low pitch (POH 7-37)
  const governs = !cur.eng.fail.gov && live.oilP > 10;
  const target = run
    ? governs
      ? Math.min(fine, gov)
      : Math.min(fine, 2760)
    : cranking
      ? 260
      : s.ground
        ? 0
        : Math.max(0, (ias - 45) * 12);
  live.rpm = lerp(live.rpm, target, clamp(dt * (target > live.rpm ? 1.6 : 1.0), 0, 1));
  if (live.rpm < 3) live.rpm = 0;
  live.map = lerp(live.map, manifold(cur, live.rpm, alt), clamp(dt * 3, 0, 1));
  const P = run ? powerFrac(cur, live.map, live.rpm, alt) : 0;
  // on the low-pitch stop below the governed RPM; governing, the blade angle follows airspeed and power
  const bladeT =
    governs && run
      ? 14.9 + (bladeGov(ias * (1 + alt * 0.00002), live.rpm, P) - 14.9) * clamp((fine - gov) / 150, 0, 1)
      : 14.9;
  live.blade = lerp(live.blade, bladeT, clamp(dt * 2, 0, 1));
  const l = lambda(cur.eng.mix, alt);
  // FFLOW needs pump pressure: an engine-driven pump failure drops it to ~0 before the engine quits (POH 3-31)
  live.ff =
    run && E.fuelOk && (!cur.eng.fail.edp || E.fuelPumpOn)
      ? fuelFlowGph(live.map, live.rpm, l)
      : pumpPrime && cur.eng.mix > 0.5
        ? 6.5 * cur.eng.mix
        : 0;
  const ap = (v: number, tgt: number, tau: number) => v + (tgt - v) * clamp(dt / tau, 0, 1);
  const oilPT =
    run && !g.fail.oil ? clamp(30 + 48 * Math.min(1, live.rpm / 2400) + (live.oilT < 120 ? 22 : 0), 0, 112) : 0;
  live.oilP = ap(live.oilP, oilPT, run && live.oilP < oilPT ? 9 : 2.5);
  const oatF = cur.pitot.oat * 1.8 + 32,
    cowlClosed = 1 - cur.eng.cowl;
  // cowl flaps: closed in cruise holds CHT near two-thirds of the green arc; open for start, climb and ground runs (POH 7-37, 4-31)
  const speedCool = s.ground ? -25 : clamp((ias - 90) * 0.45, -18, 25);
  live.oilT = ap(
    live.oilT,
    run ? 125 + 72 * P + cur.pitot.oat * 0.7 + cowlClosed * 8 - speedCool * 0.2 + (g.fail.oil ? 90 : 0) : oatF,
    run ? 80 : 1800,
  );
  live.cht = ap(
    live.cht,
    run ? 240 + 200 * P * (1.15 - 0.5 * Math.abs(l - 1.05)) + cowlClosed * 48 - speedCool : oatF,
    run ? 35 : 1200,
  );
  const air = (live.map / 29.92) * (live.rpm / 2400);
  live.egt = ap(live.egt, run ? 1180 + 260 * air - (l > 1 ? 1500 : 2500) * (l - 1) ** 2 : oatF, 3);
  live.hot = clamp((live.cht - 120) / 220, 0, 1);
  // Hobbs: oil pressure above 20 PSI, powered through the WARN breaker (POH 7-12, Fig 7-7); ENG HRS: GEA 71 powered, engine running
  if (live.oilP > 20 && E.warnPwr) live.hobbs += dt / 3600;
  if (run && E.gea) live.engHrs += dt / 3600;
  const rpmQ = Math.round(live.rpm / 50) * 50;
  if (rpmQ !== cur.eng.rpm)
    up((d) => {
      d.eng.rpm = rpmQ;
    });
  // an exceedance starting on the SYSTEM page brings the EIS back to the ENGINE page (POH 7-29 – 7-33)
  const ex = eisExceedance(E);
  if (ex && !live.eisEx && cur.avx.eisPage === "SYSTEM")
    up((d) => {
      d.avx.eisPage = "ENGINE";
    });
  live.eisEx = ex;

  /* ---------- vacuum and the standby attitude gyro ---------- */
  live.vac = vacuumInHg(live.rpm, cur.vac.fail);
  live.gyro = live.vac >= 4 ? ap(live.gyro, 1, 20) : Math.max(0, live.gyro - (live.gyro * dt) / 200);
  live.drift = live.gyro > 0.7 ? ap(live.drift, 0, 10) : live.drift + dt * (1 - live.gyro) * 0.8;

  /* ---------- fuel burn (the return line goes back to the feeding tank, so it nets out), totalizer, LOW FUEL timers ---------- */
  if (run && live.ff > 0) {
    const gal = (live.ff / 3600) * dt,
      f = cur.fuel;
    const hasL = f.qL > 0.02,
      hasR = f.qR > 0.02;
    if (f.sel === "LEFT") live.burnL += gal;
    else if (f.sel === "RIGHT") live.burnR += gal;
    else if (hasL && hasR) {
      live.burnL += gal / 2;
      live.burnR += gal / 2;
    } else if (hasL) live.burnL += gal;
    else live.burnR += gal;
    live.galUsed += gal;
    if (live.burnL + live.burnR > 0.05) {
      const bl = live.burnL,
        br = live.burnR;
      live.burnL = live.burnR = 0;
      up((d) => {
        d.fuel.qL = Math.max(0, d.fuel.qL - bl);
        d.fuel.qR = Math.max(0, d.fuel.qR - br);
      });
    }
  }
  const t = live.timers;
  t.lowL = fuelInd(cur.fuel.qL) < 8 ? t.lowL + dt : 0;
  t.lowR = fuelInd(cur.fuel.qR) < 8 ? t.lowR + dt : 0;
  t.stby = E.sBatt < -0.5 ? t.stby + dt : 0;
  const ann = { lowFuelL: t.lowL > 60, lowFuelR: t.lowR > 60, stbyBatt: t.stby > 10 };
  if (ann.lowFuelL !== cur.ann.lowFuelL || ann.lowFuelR !== cur.ann.lowFuelR || ann.stbyBatt !== cur.ann.stbyBatt)
    up((d) => {
      d.ann = ann;
    });

  /* ---------- flap motor (FLAPS 10 A, ELECTRICAL BUS 1) ---------- */
  const ft = cur.flaps.cmd,
    moving = E.flapsPwr && Math.abs(live.flapAng - ft) > 0.05;
  if (moving) live.flapAng += Math.sign(ft - live.flapAng) * Math.min(Math.abs(ft - live.flapAng), FLAP_RATE * dt);
  if (moving !== cur.flaps.moving)
    up((d) => {
      d.flaps.moving = moving;
    });

  /* ---------- electrical: ACU over-voltage trip, battery state of charge ---------- */
  if (E.acuTrip && !cur.elec.cb["XF:ALT FIELD"])
    up((d) => {
      d.elec.cb["XF:ALT FIELD"] = true;
    });
  const so = live.soc,
    el = cur.elec;
  if (el.socMain !== so.pm) so.m = so.pm = el.socMain;
  if (el.socStby !== so.ps) so.s = so.ps = el.socStby;
  const n = stepNav3Soc({ ...el, socMain: so.m, socStby: so.s }, elecCfg(cur), E, (dt * cur.warp) / 60);
  so.m = n.socMain;
  so.s = n.socStby;
  if (
    Math.abs(so.m - el.socMain) > 0.001 ||
    Math.abs(so.s - el.socStby) > 0.001 ||
    (so.m === 0) !== (el.socMain === 0) ||
    (so.s === 0) !== (el.socStby === 0)
  ) {
    so.pm = so.m;
    so.ps = so.s;
    up((d) => {
      d.elec.socMain = so.m;
      d.elec.socStby = so.s;
    });
  }
  live.testHeld = cur.elec.stby === "TEST" ? live.testHeld + dt : 0;

  /* ---------- CO from a cracked muffler under a heater shroud (POH 3-36) ---------- */
  const env = cur.env;
  const coT = env.coLeak && run ? Math.max(0, 170 * env.heat - 60 * env.air - (env.vents ? 25 : 0)) : 0;
  live.coPpm = ap(live.coPpm, coT, 15);
  if (env.coAck && live.coPpm < 50)
    up((d) => {
      d.env.coAck = false;
    });

  /* ---------- flight state + KAP 140 ---------- */
  stepAir(cur, useC182.getState().E, P, dt);
}

/**
 * The flight state as the KAP 140 sees it. It gets NAV, HDG and roll steering from the G1000 through GIA #2 (Fig S3-1). ROL uses its
 * own DC turn coordinator; VS and ALT run independently of the G1000 (POH 7-12 — their sensor isn't named); the encoder's gray-code
 * altitude feeds only the alerter and preselect (S3-19 item 5). Its "attitude" failure is the turn coordinator, not the AHRS; with the
 * AHRS or GIA #2 lost it works in ROL only (S3-19; POH 3-26 instead says only HDG is lost — the supplement is modelled).
 */
export const kapView = (s: Sim, E: Elec, f: FlightState): FlightState => ({
  ...f,
  fail: { ...f.fail, att: s.avx.tcFail },
  navValid: f.navValid && E.gia2 && E.ahrs,
});

function stepAir(s: Sim, E: Elec, P: number, dt: number) {
  let fs: FlightState = {
    ...live.fs,
    onGround: s.ground,
    power: P,
    oat: s.pitot.oat,
    fail: { att: !E.ahrs, hdg: !E.ahrs, air: !E.adc },
    navValid: navReceiverValid(live.fs.navSrc, E.gia1, E.gia2),
  };
  const kfs = (f: FlightState) => kapView(s, E, f);
  // engaged when the AUTO PILOT breaker or AVIONICS BUS 2 drops: the computer goes dark, but the disconnect horn is on WARN (S3-10)
  if (live.kap.ap && !E.kapPwr) live.discTone = fs.t + 2;
  live.kap = kap140Power(live.kap, E.kapPwr, fs.t);
  // no heading signal (AHRS or GIA #2 lost): HDG can't work — it flashes and the pilot selects ROL (S3-18, S3-19)
  if (live.kap.ap && live.kap.lat === "HDG" && (!E.ahrs || !E.gia2))
    live.kap = { ...live.kap, lat: "ROL", lostLat: "HDG" };
  const engaged = live.kap.ap;
  const ac = engaged ? kap140Command(live.kap, kfs(fs)) : null;
  const pilot = yokeCmd(s.ctrl.roll, s.ctrl.pitch, trimPitch(live.kap.trim));
  const cmd = ac ?? (live.stallDemo ? { bank: 0, vs: 0 } : pilot);
  fs = stepFlight(fs, cmd, dt, C182_FLIGHT);
  if (s.ground) fs = { ...fs, ias: 0, vs: 0, pitch: 0, roll: 0, iasDot: 0 };
  live.kap = kap140Tick(live.kap, kfs(fs), dt);
  // voice messages through the audio panel (S3-16): trim running > 5 s (repeats every 5 s), out of trim ≈ 20 s
  const tm = live.timers;
  tm.trimRun = live.kap.pt ? tm.trimRun + dt : 0;
  tm.outOfTrim = live.kap.pt ? tm.outOfTrim + dt : Math.max(0, tm.outOfTrim - dt * 2);
  if (E.audio && tm.trimRun > 5 && fs.t - live.voiceT > 5) {
    live.voice = "TRIM IN MOTION";
    live.voiceT = fs.t;
  }
  if (E.audio && tm.outOfTrim > 20 && fs.t - live.voiceT > 5) {
    live.voice = "CHECK PITCH TRIM";
    live.voiceT = fs.t;
  }
  // stall warning: electric vane switch → horn through WARN, 5–10 kt above the stall (POH 7-65, 4-42); break below Vs
  const vs = stallKias(live.flapAng);
  live.horn = !s.ground && E.warnPwr && !s.stall.vaneStuck && fs.ias <= vs + 7;
  if (!s.ground && fs.ias < vs - 0.5) {
    live.stallDemo = false;
    fs = { ...fs, vs: Math.min(fs.vs, -900) };
  }
  live.fs = fs;
  live.staticAlt = s.pitot.staticBlocked ? (live.staticAlt ?? fs.alt) : null;
  // effective control positions: the KAP 140 servos when engaged, else the pilot's
  const tgt = { pitch: s.ctrl.pitch, roll: s.ctrl.roll, yaw: s.ctrl.yaw };
  if (engaged && ac) {
    tgt.roll = clamp((ac.bank - fs.roll) / 10, -1, 1) * 0.6;
    tgt.pitch = clamp((pitchFor(fs, ac.vs ?? fs.vs) - fs.pitch) / 4, -1, 1) * 0.5;
  } else if (live.stallDemo && !s.ground) tgt.pitch = clamp((62 - fs.ias) / -25, -0.2, 0.9);
  const k = clamp(dt * 6, 0, 1);
  live.ctl.roll = lerp(live.ctl.roll, tgt.roll, k);
  live.ctl.pitch = lerp(live.ctl.pitch, tgt.pitch, k);
  live.ctl.yaw = lerp(live.ctl.yaw, tgt.yaw, k);
}
