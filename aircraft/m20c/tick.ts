/**
 * Per-frame simulation: engine start (OM p. 15–16: boost pump, pump the throttle twice, START and push), carburetor ice
 * and heat, governor and RPM/MAP, oil, fuel pressure, temperatures, the vacuum pump with the PC system and the vacuum
 * step, the Johnson-bar gear, hand-pumped flaps, and the flight state. Continuous values go to `live`; only discrete
 * changes go through the store.
 */
import { stepFlight, yokeCmd, type FlightCmd } from "@/lib/avionics/flight";
import { clamp, lerp } from "@/lib/math";
import { FLAP_MAX, M20C_FLIGHT, VAC, fuelAvail, govRpm, live, pcEngaged } from "./model";
import { useM20C } from "./store";

/** START push hold (s): released when the engine fires, or after this. */
export const START_HOLD = 6;
/** Trim that holds level flight with the wheel centred: the stabilizer sets a pitch attitude (pilot command = 1.5° + 4° × trim). */
export const trimPitch = (trim: number) => 1.5 + trim * 4;
/** Engine power fraction 0..1 from MAP and RPM (illustrative). */
export const powerFrac = (map: number, rpm: number) => clamp(((map - 10) / 18.5) * (rpm / 2700), 0, 1);

let trimPrev = initialTrim();
function initialTrim() {
  return useM20C.getState().s.ctrl.trim;
}

export function simTick(dt: number) {
  const store = useM20C.getState(),
    up = store.update;
  let { s, E } = store;
  const fs = live.fs;

  // ---------- starter: START is pushed in and held; it springs back to BOTH when released (OM p. 16) ----------
  if (s.eng.key === "START") {
    live.startTimer -= dt;
    if (live.startTimer <= 0)
      up((d) => {
        d.eng.key = "BOTH";
      });
  }
  ({ s, E } = useM20C.getState());
  const cranking = E.starterOn && !s.eng.running;
  live.crankT = E.starterOn ? live.crankT + dt : 0;
  const avail = fuelAvail(s);
  const pumping = E.fuelPump && avail;

  // ---------- priming (accelerator-pump shots, store.primeThrottle) and starting ----------
  if (!s.eng.running) {
    const windmilling = live.rpm > 100 && !cranking;
    live.prime = Math.max(
      0,
      live.prime - dt * (windmilling ? 0.5 : cranking && s.eng.mix <= 0.05 && s.eng.throttle > 0.4 ? 0.6 : 0.02),
    );
    const flooded = live.prime > 4.5,
      ign = s.eng.key !== "OFF";
    // windmilling relight: fuel back at the carburetor with the ignition on and the mixture rich (OM p. 21: throttle back first)
    const relight =
      s.air && !cranking && live.rpm > 500 && avail && ign && s.eng.mix > 0.3 && live.fuelP >= 0.5 && !flooded;
    if (relight) {
      live.prime = 0;
      live.fireT = -1;
      up((d) => {
        d.eng.running = true;
      });
    } else if (cranking && avail && ign && E.vibrator) {
      const primed = live.prime >= 1 && !flooded;
      const fires = (primed && live.crankT > 1.2) || (!flooded && live.prime < 1 && s.eng.mix > 0.3 && live.crankT > 5);
      // it fires: "hold start switch on for another second then allow the spring loaded switch to return to BOTH"
      if (fires) {
        live.prime = 0;
        live.fireT = 0;
        live.startTimer = Math.min(live.startTimer, 1);
        up((d) => {
          d.eng.running = true;
        });
      }
    }
  }
  ({ s, E } = useM20C.getState());

  // ---------- fuel pressure: engine-driven pump, electric boost pump (OM p. 3); gauge 0.5–6 psi, normal 2.5–3.5 ----------
  const mechNom = live.rpm > 500 ? 2.6 + 0.9 * clamp((live.rpm - 600) / 2100, 0, 1) : live.rpm > 100 ? 1.0 : 0;
  const mech = s.eng.fail.mechPump ? 0 : mechNom;
  const elecP = pumping ? 3.4 : 0;
  live.fuelP = lerp(live.fuelP, !avail ? 0 : Math.max(mech, elecP), clamp(dt * 3, 0, 1));

  // ---------- running checks: key OFF, idle cut-off, starvation ----------
  if (s.eng.running) {
    if (live.fireT >= 0) {
      live.fireT += dt;
      if (live.fireT > 3) live.fireT = -1;
    }
    const cutoff = s.eng.mix <= 0.05;
    const starved = !avail || live.fuelP < 0.5;
    live.starve = starved ? live.starve + dt : 0;
    if (s.eng.key === "OFF" || cutoff || live.starve > 3 || live.carbIce >= 1) {
      live.starve = 0;
      live.fireT = -1;
      up((d) => {
        d.eng.running = false;
      });
    }
  }
  ({ s, E } = useM20C.getState());
  const run = s.eng.running;

  // ---------- carburetor ice (failure switch): builds with the heat off, melts with full heat (OM p. 22: use full heat) ----------
  const icing = s.eng.fail.carbIce && run && s.eng.carbHeat < 0.9;
  live.carbIce = clamp(live.carbIce + (icing ? dt / 45 : -dt / 12), 0, 1);

  // ---------- RPM: governor (propeller control) or fine-pitch stop (throttle) ----------
  const gov = govRpm(s),
    govOk = !s.eng.fail.governor && live.oilP >= 20;
  const fine = 650 + s.eng.throttle * 2350 + (s.air ? fs.ias * 4 : 0);
  const windmill = s.air && fs.ias > 60 ? 550 + (fs.ias - 60) * 12 : 0;
  let target = 0;
  if (run) {
    target = govOk ? Math.min(fine, gov) : Math.min(fine, 2950);
    if ((s.eng.key === "L" || s.eng.key === "R") && fine <= gov + 30) target -= 110; // single magneto (max drop 125, OM p. 18)
    if (s.eng.mix < 0.25) target -= (0.25 - s.eng.mix) * 1600;
    target -= live.carbIce * 900; // ice: power loss, rough running
  } else if (cranking) target = Math.max(250, windmill);
  else target = windmill;
  live.rpm = lerp(live.rpm, target, clamp(dt * (target > live.rpm ? 2.0 : 1.2), 0, 1));
  if (live.rpm < 3) live.rpm = 0;

  // ---------- manifold pressure, power, fuel flow ----------
  const ambient = 29.92 - (s.air ? fs.alt / 1000 : 0.4);
  const mapT = run
    ? Math.min(ambient, 10 + 19.5 * Math.pow(s.eng.throttle, 0.85) - (s.air ? fs.alt / 1000 : 0) * 0.15) -
      s.eng.carbHeat * 1.3 -
      live.carbIce * 6
    : ambient;
  live.map = lerp(live.map, mapT, clamp(dt * 3, 0, 1));
  const pwr = run ? powerFrac(live.map, live.rpm) : 0;
  const ffT = run ? (2.0 + 12.5 * pwr) * (0.75 + 0.35 * s.eng.mix) : 0;
  live.ff = lerp(live.ff, ffT, clamp(dt * 2, 0, 1));

  // ---------- oil and temperatures (cowl flaps and carb heat matter) ----------
  const oatF = s.pitot.oat * 1.8 + 32;
  const cowl = s.eng.cowlFlaps ? -18 : 0,
    ground = !s.air && run ? 35 : 0;
  live.oilT = lerp(
    live.oilT,
    run ? 165 + 50 * pwr + (s.pitot.oat - 15) * 0.8 + ground * 0.5 : oatF,
    clamp(dt / 40, 0, 1),
  );
  live.oilLoss = s.eng.fail.oilLeak ? Math.min(1, live.oilLoss + dt / 40) : 0;
  const oilPT =
    run || live.rpm > 300
      ? (35 + 45 * clamp((live.rpm - 600) / 2100, 0, 1) + clamp((180 - live.oilT) * 0.2, 0, 15)) * (1 - live.oilLoss)
      : 0;
  live.oilP = lerp(live.oilP, oilPT, clamp(dt * 2, 0, 1));
  live.cht = lerp(live.cht, run ? 250 + 190 * pwr + 40 * (1 - s.eng.mix) + cowl + ground : oatF, clamp(dt / 25, 0, 1));
  live.egt = lerp(
    live.egt,
    run ? 1150 + 260 * pwr + 220 * Math.exp(-(((s.eng.mix - 0.55) / 0.2) ** 2)) : oatF,
    clamp(dt / 4, 0, 1),
  );

  // ---------- vacuum: engine-driven pump, regulated 4.5–5.0 (OM p. 10); PC needs ≈ 1,000 RPM ----------
  const vacT = s.eng.fail.vacPump
    ? 0
    : live.rpm < 400
      ? 0
      : live.rpm < 1000
        ? ((live.rpm - 400) / 600) * VAC.reg
        : VAC.reg + (live.rpm > 2600 ? 0.1 : 0);
  live.vac = lerp(live.vac, vacT, clamp(dt * 1.5, 0, 1));
  // vacuum-operated entry step: a servo raises it once vacuum is up; a spring pulls it down when vacuum is gone (OM p. 10)
  live.stepFrac = clamp(live.stepFrac + (live.vac > 3.5 ? dt / 3 : -dt / 2), 0, 1);

  // ---------- landing gear: the bar swings in about a second; the gear follows the linkage ----------
  const gearT = s.gear.lever === "UP" ? 1 : 0;
  live.gearFrac = clamp(
    live.gearFrac + Math.sign(gearT - live.gearFrac) * Math.min(Math.abs(gearT - live.gearFrac), dt / 1.3),
    0,
    1,
  );

  // ---------- flaps: pumped down (store.pumpFlaps), bled up by the relief valve at a controlled rate (OM p. 9) ----------
  if (s.flaps.valve === "UP" && live.flapAng > 0) live.flapAng = Math.max(0, live.flapAng - 6 * dt);
  if (live.pumpAnim > 0) live.pumpAnim = Math.max(0, live.pumpAnim - dt * 2.2);
  live.flapAng = Math.min(live.flapAng, FLAP_MAX);

  // ---------- flight state: pilot on the wheel, PC servos holding wings level ----------
  if (fs.onGround === s.air) live.fs = { ...fs, onGround: !s.air };
  const pc = pcEngaged(s);
  const pcBank = s.pc.rollTrim * 8;
  const pcRoll = pc ? clamp((pcBank - live.fs.roll) / 18, -0.35, 0.35) : 0;
  const pcYaw = pc ? clamp(-live.fs.slip * 0.4, -0.2, 0.2) : 0;
  live.pcRoll = lerp(live.pcRoll, pcRoll, clamp(dt * 3, 0, 1));
  live.pcYaw = lerp(live.pcYaw, pcYaw, clamp(dt * 3, 0, 1));
  const roll = clamp(s.ctrl.roll + live.pcRoll, -1, 1);
  const cmd: FlightCmd = yokeCmd(roll, s.ctrl.pitch, trimPitch(s.ctrl.trim));
  if (!live.fs.onGround && live.flapAng > 5) cmd.pitch = (cmd.pitch ?? 0) - live.flapAng * 0.06; // flaps: nose heavy (OM p. 23)
  const drag = live.gearFrac < 1 ? 0.12 : 0;
  live.fs = stepFlight(
    { ...live.fs, power: run ? clamp(pwr * 1.05 - drag - live.flapAng * 0.004, 0, 1) : 0 },
    cmd,
    dt,
    M20C_FLIGHT,
  );
  const k = clamp(dt * 5, 0, 1);
  live.eff = {
    pitch: lerp(live.eff.pitch, s.ctrl.pitch, k),
    roll: lerp(live.eff.roll, roll, k),
    yaw: lerp(live.eff.yaw, clamp(s.ctrl.yaw + live.pcYaw, -1, 1), k),
  };
  live.trimRate = (s.ctrl.trim - trimPrev) / Math.max(dt, 1e-3);
  trimPrev = s.ctrl.trim;
}
