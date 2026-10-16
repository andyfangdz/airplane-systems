/**
 * The engine simulation: controls, environment and failures in; a mutable state advanced by `step(dt)`.
 * Everything is a pure function of the spec and the objects passed in (no module state), so tests and the page can
 * run as many engines as they like.
 *
 * Each step: manifold pressure from the throttle and the air the cylinders take (induction.ts), metered fuel and
 * its split between cylinders (fuel.ts), each cylinder's mixture and spark, indicated power from the manufacturer's
 * chart scaled by what each cylinder actually burns (performance.ts, mixture.ts), shaft speed from engine, starter
 * and propeller torque (propeller.ts), then exhaust, head and oil temperatures and oil pressure.
 */
import type { EngineSpec, Side } from "../types";
import { atmosphere, cToF, HP_W, INHG_PA, KT_MS, LB_KG, RHO0, ramPressure } from "./atmosphere";
import { phaseOf } from "./cycle";
import { carbFuelFlow, condensedWater, iceRate, mixtureChamberC } from "./carburetor";
import { distribution, nozzleFlow, nozzlePressure, servoFuelFlow } from "./fuel";
import { inductionCal, series, solveManifold, throttleArea } from "./induction";
import { AFR_STOICH, egtOffset, headHeat, mixturePower, stability } from "./mixture";
import { chartFuelFlow, frictionHp, grossIndicatedHp, pumpingHp, seaLevelLines } from "./performance";
import { governor, inducedVelocity, propTorque } from "./propeller";

export type MagSwitch = "OFF" | "R" | "L" | "BOTH" | "START";

export interface Controls {
  /** 0 idle stop … 1 full throttle. */
  throttle: number;
  /** 0 idle cut-off … 1 full rich. */
  mixture: number;
  /** Propeller control: 0 low rpm … 1 high rpm (full increase). */
  prop: number;
  mags: MagSwitch;
  boost: boolean;
  /** Alternate induction air (unfiltered, from inside the cowling): injected engines. */
  altAir: boolean;
  /** Carburetor heat 0 (cold, filtered ram air) … 1 (full hot, from the exhaust heater muff): carbureted engines. */
  carbHeat: number;
}

export interface Environment {
  /** Pressure altitude, ft. */
  altFt: number;
  /** Deviation from standard temperature, °C. */
  isaDevC: number;
  /** True airspeed, kt (0 = ground run). */
  tasKt: number;
  /** Oil in the sump, US quarts. */
  oilQt: number;
  /** Relative humidity of the outside air, 0 … 1 (carburetor icing). */
  humidity: number;
}

export interface Failures {
  magL: boolean;
  magR: boolean;
  /** Fouled plugs, by cylinder index: [top, bottom]. */
  plugs: [boolean, boolean][];
  /** Nozzle blockage, by cylinder index, 0 … 1. */
  nozzle: number[];
  /** Engine-driven fuel pump failed (the boost pump can still supply the servo). */
  fuelPump: boolean;
  /** Induction air filter blocked (alternate air restores flow). */
  filter: boolean;
  /** Starter inoperative. */
  starter: boolean;
  /** Starter stuck engaged: its solenoid stays closed and the pinion in mesh after the switch leaves START. */
  starterStuck: boolean;
  /** Leak in an intake pipe (a split hose, a loose clamp), by cylinder index, 0 … 1: unmetered air into that cylinder. */
  intakeLeak: number[];
}

export interface CylState {
  /** Fuel film in the intake port, lb. */
  puddle: number;
  /** Fuel into the cylinder, lb/h. */
  fuel: number;
  lambda: number;
  /** Plugs firing (0, 1, 2). */
  plugs: number;
  /** Fraction of best-power work this cylinder does (0 dead … ~1). */
  work: number;
  /** Gross indicated hp. */
  hp: number;
  egt: number;
  cht: number;
}

export interface EngineState {
  t: number;
  rpm: number;
  /** Crank angle, 0 … 720 (two revolutions: the cycle). */
  crank: number;
  map: number;
  /** Air and metered fuel flow, lb/h. */
  air: number;
  fuel: number;
  /** The part of `air` that came through the throttle body (the rest leaked into the intake unmetered), lb/h. */
  meteredAir: number;
  nozzlePsi: number;
  fuelPsi: number;
  /** Brake hp, % of rated, torque N·m, gross indicated hp. */
  hp: number;
  pct: number;
  torque: number;
  gross: number;
  frictionHp: number;
  cyl: CylState[];
  oilT: number;
  oilP: number;
  /** Heat the oil cooler rejects, Btu/min. */
  coolerBtu: number;
  /** Fraction of oil flow through the cooler (thermostatic valve). */
  coolerValve: number;
  beta: number;
  propInteg: number;
  /** Starter energized, its pinion in mesh with the ring gear. */
  starterEngaged: boolean;
  /** Seconds the starter has been engaged in the current attempt. */
  starterS: number;
  /** Something is burning. */
  running: boolean;
  /** 0 smooth … 1 very rough (dead cylinders, misfire, single plug). */
  rough: number;
  /** Governor set speed and whether it is governing. */
  govRpm: number;
  governing: boolean;
  /** Induction source pressure and temperature. */
  inletInHg: number;
  inletC: number;
  oatC: number;
  /** Carburetor: fuel in the float bowl (lb), mixture-chamber temperature (°C), fraction of the bore iced, and melt
   * water being ingested (0 … 1); the throttle position last step (the accelerator pump acts on its change). */
  bowl: number;
  carbC: number;
  ice: number;
  melt: number;
  lastThrottle: number;
}

export const defaultControls = (): Controls => ({
  throttle: 0,
  mixture: 0,
  prop: 1,
  mags: "OFF",
  boost: false,
  altAir: false,
  carbHeat: 0,
});

export const defaultEnvironment = (): Environment => ({ altFt: 0, isaDevC: 0, tasKt: 0, oilQt: 7, humidity: 0 });

export const noFailures = (spec: EngineSpec): Failures => ({
  magL: false,
  magR: false,
  plugs: spec.geometry.cylinders.map(() => [false, false]),
  nozzle: spec.geometry.cylinders.map(() => 0),
  fuelPump: false,
  filter: false,
  starter: false,
  starterStuck: false,
  intakeLeak: spec.geometry.cylinders.map(() => 0),
});

/** A cold engine, stopped, soaked to the outside air. */
export function initialState(spec: EngineSpec, env: Environment = defaultEnvironment()): EngineState {
  const air = atmosphere(env.altFt, env.isaDevC);
  const f = cToF(air.t);
  return {
    t: 0,
    rpm: 0,
    crank: 0,
    map: air.p,
    air: 0,
    fuel: 0,
    meteredAir: 0,
    nozzlePsi: 0,
    fuelPsi: 0,
    hp: 0,
    pct: 0,
    torque: 0,
    gross: 0,
    frictionHp: 0,
    cyl: spec.geometry.cylinders.map(() => ({
      puddle: 0,
      fuel: 0,
      lambda: Infinity,
      plugs: 0,
      work: 0,
      hp: 0,
      egt: f,
      cht: f,
    })),
    oilT: f,
    oilP: 0,
    coolerBtu: 0,
    coolerValve: 0,
    beta: spec.propeller.fineDeg,
    propInteg: 0,
    starterEngaged: false,
    starterS: 0,
    running: false,
    rough: 0,
    govRpm: 0,
    governing: false,
    inletInHg: air.p,
    inletC: air.t,
    oatC: air.t,
    bowl: spec.fuelSystem.kind === "carburetor" ? spec.fuelSystem.bowlLb : 0,
    carbC: air.t,
    ice: 0,
    melt: 0,
    lastThrottle: 0,
  };
}

/** One stroke of the primer: fuel straight into each cylinder's intake port (carbureted engines, OM p. 1-3). */
export function prime(spec: EngineSpec, s: EngineState, strokes = 1) {
  if (spec.fuelSystem.kind !== "carburetor") return s;
  const lb = spec.fuelSystem.primeLb * strokes;
  s.cyl.forEach((cy) => (cy.puddle += lb));
  return s;
}

const ratedAirCache = new WeakMap<EngineSpec, number>();
/** Air flow (lb/h) at rated power, best-power mixture, from the fuel the manual gives for it. */
export function ratedAirLbH(spec: EngineSpec) {
  let v = ratedAirCache.get(spec);
  if (v === undefined) {
    v =
      chartFuelFlow(spec, spec.rating.rpm, spec.rating.hp, "bestPower") * AFR_STOICH * spec.calibration.lambdaBestPower;
    ratedAirCache.set(spec, v);
  }
  return v;
}

/** Oil viscosity relative to 180 °F (Andrade fit to a multigrade aviation oil: ~120 cSt at 40 °C, ~18 at 100 °C). */
export const viscosity = (oilF: number) => Math.exp(3691 * (1 / ((oilF - 32) / 1.8 + 273.15) - 1 / 355.37));

/** Governor set speed for a propeller-control position. */
export const governedRpm = (spec: EngineSpec, prop: number) =>
  spec.propeller.governorMinRpm + Math.max(0, Math.min(1, prop)) * (spec.rating.rpm - spec.propeller.governorMinRpm);

/** Which plugs fire in each cylinder for a switch position and magneto failures. */
export function sparks(spec: EngineSpec, mags: MagSwitch, f: Failures, rpm: number) {
  const ign = spec.ignition;
  const on = (m: Side) =>
    rpm >= ign.minStartRpm * 0.6 &&
    !(m === "L" ? f.magL : f.magR) &&
    (mags === "BOTH" ||
      mags === m ||
      // the plain magneto is grounded during the start cycle (IOM System Description p. 2)
      (mags === "START" && m === ign.retardMag));
  return spec.geometry.cylinders.map((c, i) => {
    const top = ign.topPlugMag[c.n],
      bottom: Side = top === "L" ? "R" : "L";
    return (on(top) && !f.plugs[i][0] ? 1 : 0) + (on(bottom) && !f.plugs[i][1] ? 1 : 0);
  });
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const approach = (v: number, target: number, dt: number, tau: number) => v + (target - v) * (1 - Math.exp(-dt / tau));

/**
 * Advance the engine by `dt` seconds (any size: substeps keep the shaft dynamics stable). `thermal` speeds up the
 * temperatures only (head, exhaust, oil), so warm-up and cool-down can be watched without waiting.
 */
export function step(
  spec: EngineSpec,
  s: EngineState,
  c: Controls,
  env: Environment,
  f: Failures,
  dt: number,
  thermal = 1,
) {
  if (!(dt > 0)) return s;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < n; i++) substep(spec, s, c, env, f, dt / n, thermal);
  return s;
}

function substep(
  spec: EngineSpec,
  s: EngineState,
  c: Controls,
  env: Environment,
  f: Failures,
  dt: number,
  thermal: number,
) {
  const dtT = dt * thermal;
  const cal = spec.calibration;
  const ind = inductionCal(spec);
  const air = atmosphere(env.altFt, env.isaDevC);
  const nCyl = spec.geometry.cylinders.length;
  const rated = spec.rating;
  s.t += dt;
  s.oatC = air.t;

  // ---- induction: ram air through the filter, or unfiltered cowl air (alternate air, or carburetor heat from the muff)
  const carb = spec.fuelSystem.kind === "carburetor" ? spec.fuelSystem : null;
  const v = env.tasKt * KT_MS;
  const ram = ramPressure(air.p, air.t, env.tasKt);
  let source: number, inletC: number, cdA: number;
  if (carb) {
    const heat = clamp(c.carbHeat, 0, 1);
    source = ram + (air.p - ram) * heat; // heated air comes from inside the cowling: no ram
    // the muff's heat follows the exhaust (assumed: full heatRiseC with the exhaust at cruise heat)
    const egtMean = s.cyl.reduce((a, cy) => a + cy.egt, 0) / nCyl;
    inletC = air.t + carb.heatRiseC * heat * clamp((egtMean - cToF(air.t)) / 1100, 0, 1.1);
    // ice narrows the bore at the butterfly; heated air bypasses the filter
    const open = throttleArea(c.throttle, cal.idleArea) * (1 - 0.92 * s.ice);
    cdA = ind.cdAFull * (f.filter ? series(open, 0.12 + 0.88 * heat) : open);
  } else {
    source = c.altAir ? air.p : ram;
    inletC = air.t + (c.altAir ? 15 : 0); // alternate air is warmer (assumed +15 °C)
    const open = throttleArea(c.throttle, cal.idleArea);
    // a blocked filter is a restriction in series with the throttle; the alternate air door bypasses it
    cdA = ind.cdAFull * (f.filter && !c.altAir ? series(open, 0.12) : open);
  }
  // a leaking intake pipe is an orifice in parallel with the throttle, its air unmetered (assumed: a full leak is 3 % of
  // the wide-open area)
  const leaks = f.intakeLeak.map((l) => ind.cdAFull * 0.03 * clamp(l, 0, 1));
  const leakArea = leaks.reduce((a, x) => a + x, 0);
  const exhaust = air.p * 1.02;
  const { map, air: airKgS } = solveManifold(spec, ind, cdA + leakArea, source, inletC, s.rpm, exhaust);
  s.map = map;
  s.inletInHg = source;
  s.inletC = inletC;
  const airLbH = (airKgS / LB_KG) * 3600;
  s.air = airLbH;
  const meteredAir = leakArea > 0 ? (airLbH * cdA) / (cdA + leakArea) : airLbH;
  s.meteredAir = meteredAir;

  // ---- fuel
  const inletRho = (source * INHG_PA) / (287.05 * (inletC + 273.15));
  const enginePump = f.fuelPump ? 0 : clamp((s.rpm - 60) / 160, 0, 1);
  let dist: { share: number[]; areaMean: number };
  let metered: number;
  let squirt = 0;
  if (carb) {
    // engine-driven or boost pump to the carburetor inlet; the float valve keeps the bowl full while there is pressure
    const desired = carb.inletPsi.desired;
    s.fuelPsi = Math.max(c.boost ? desired : 0, enginePump * clamp(s.rpm / 900, 0, 1) * desired);
    const refill = s.fuelPsi > 0.3 ? Math.min((carb.bowlLb - s.bowl) / 0.5, 0.05 * Math.sqrt(s.fuelPsi / desired)) : 0;
    const flow = carbFuelFlow(spec, carb, meteredAir, ratedAirLbH(spec), c.mixture, inletRho, map, source, s.ice);
    // the accelerator pump squirts as the throttle opens (also how the M20C primes, pumping the throttle)
    const opened = Math.max(0, c.throttle - s.lastThrottle);
    s.lastThrottle = c.throttle;
    const inBowl = Math.max(0, s.bowl + refill * dt);
    squirt = Math.min(carb.accelLb * opened, inBowl);
    metered = Math.min(flow.main + flow.idle, ((inBowl - squirt) / dt) * 3600);
    s.bowl = Math.max(0, inBowl - squirt - (metered / 3600) * dt);
    s.fuel = metered;
    s.nozzlePsi = 0;
    // the metered air carries the fuel and divides evenly among the cylinders (with their trims)
    const nominal = spec.geometry.cylinders.map((_, i) => cal.fuelTrim[i]);
    const sum = nominal.reduce((a, x) => a + x, 0);
    dist = { share: nominal.map((x) => x / sum), areaMean: 1 };

    // mixture chamber temperature and ice
    const far = meteredAir > 1 ? metered / meteredAir : 0;
    s.carbC = approach(s.carbC, s.rpm > 20 ? mixtureChamberC(carb, inletC, far, map, source) : inletC, dt, 3);
    const kPa = INHG_PA / 1000;
    const water = condensedWater(air.t, env.humidity, air.p * kPa, s.carbC, map * kPa);
    const rate = iceRate(carb, airKgS, water, s.carbC, inletC, air.t);
    const before = s.ice;
    s.ice = clamp(s.ice + rate * dtT, 0, 1);
    // melt water going through the engine makes it run rough for a while
    s.melt = approach(s.melt, s.rpm > 100 ? clamp(((before - s.ice) / Math.max(dt, 1e-6)) * 25, 0, 1) : 0, dt, 2);
  } else {
    // boost pump or engine-driven pump to the servo, metered against air flow, split by nozzle area
    const supply = Math.max(c.boost ? 1 : 0, enginePump);
    s.fuelPsi = Math.max(c.boost ? 26 : 0, enginePump * clamp(s.rpm / 900, 0, 1) * 28);
    dist = distribution(spec, f.nozzle);
    // the nozzles can pass no more than the pump pressure pushes through their open area: with every nozzle blocked,
    // nothing flows however much the servo meters
    metered = Math.min(
      servoFuelFlow(spec, meteredAir, c.mixture, inletRho, supply),
      nozzleFlow(spec, s.fuelPsi) * dist.areaMean,
    );
    s.fuel = metered;
    s.nozzlePsi = metered > 0.5 ? Math.min(nozzlePressure(spec, metered, dist.areaMean), s.fuelPsi) : 0;
  }

  // ---- each cylinder: port fuel film, mixture, spark, work
  const plugs = sparks(spec, c.mags, f, s.rpm);
  const tau = 0.08 + 250 / Math.max(s.rpm, 20); // film evaporation time, s: slow when cranking
  const bp = grossIndicatedHp(spec, s.rpm, map, env.altFt, inletC, exhaust, ind.ve);
  const ratedGross = ratedGrossHp(spec);
  let work = 0;
  let worst = 0;
  s.cyl.forEach((cy, i) => {
    const into = (metered * dist.share[i]) / 3600; // lb/s into the port
    const evap = s.rpm > 20 ? cy.puddle / tau : 0;
    const drain = cy.puddle / 120; // pooled fuel slowly drains overboard
    cy.puddle = Math.max(0, cy.puddle + (into - evap - drain) * dt + squirt * dist.share[i]);
    cy.fuel = evap * 3600;
    // each cylinder takes an even share of the metered air, and a leaking pipe adds its unmetered air to its own
    const airCyl = meteredAir / nCyl + (leakArea > 0 ? (airLbH * leaks[i]) / (cdA + leakArea) : 0);
    cy.lambda = cy.fuel > 1e-4 ? airCyl / (cy.fuel * AFR_STOICH) : Infinity;
    cy.plugs = plugs[i];
    let w = cy.plugs ? mixturePower(cy.lambda, cal.lambdaBestPower, cal.peakEgtPower) : 0;
    if (cy.plugs === 1) w *= cal.singlePlug;
    if (c.mags === "START") w *= 0.85; // retarded spark wastes work
    cy.work = w;
    cy.hp = (bp / nCyl) * w;
    work += w;
    // roughness: a dead or misfiring cylinder, or one plug (slower, less even burn)
    const stab = cy.plugs ? stability(cy.lambda) : 0;
    worst = Math.max(worst, 1 - stab, cy.plugs === 1 ? 0.15 : 0);
  });
  const mean = work / nCyl;
  const spread = Math.sqrt(s.cyl.reduce((a, cy) => a + (cy.work - mean) ** 2, 0) / nCyl);
  s.rough = clamp(spread * 2.5 + Math.max(worst, s.melt) * 0.5, 0, 1);
  s.running = mean > 0.05 && s.rpm > 100;

  // ---- shaft: engine, starter and propeller torques
  const visc = viscosity(s.oilT);
  const fric = frictionHp(spec, Math.max(s.rpm, 1), visc);
  const pump = pumpingHp(spec, Math.max(s.rpm, 1), map, exhaust);
  s.frictionHp = fric;
  const gross = bp * mean;
  s.gross = gross;
  const omega = (s.rpm * 2 * Math.PI) / 60;
  const lossTorque = s.rpm > 1 ? ((fric + pump) * HP_W) / Math.max(omega, 1) : 0;
  // below ~10 rpm friction is static: it holds the engine rather than reversing it
  const fricTorque = lossTorque * Math.min(1, s.rpm / 10);
  const grossTorque = omega > 0.5 ? (gross * HP_W) / omega : 0;
  // the starter is engaged while the switch is at START, or all the time once stuck; an inoperative one never is. Its
  // torque falls to nothing at its own free speed, so a running engine outruns it rather than being held back.
  const cranking = (c.mags === "START" || f.starterStuck) && !f.starter;
  s.starterEngaged = cranking;
  s.starterS = cranking ? s.starterS + dt : 0;
  const starterTorque = cranking ? 230 * Math.max(0, 1 - s.rpm / 380) : 0;
  const d = (spec.propeller.diameterIn * 2.54) / 100;
  s.govRpm = governedRpm(spec, c.prop);
  governorStep(spec, s, s.govRpm, dt);
  // the inflow the propeller induces, where the spec asks for it (the IO-390's load was calibrated without)
  const vi = spec.propeller.inducedInflow ? inducedVelocity(Math.max(s.hp, 0) * HP_W, v, air.rho, d) : 0;
  const propQ = propTorque(s.beta, v + vi, s.rpm, d, air.rho) * (spec.propeller.cpScale ?? 1);
  const breakaway = s.rpm < 1 && grossTorque + starterTorque < 40;
  const net = breakaway ? 0 : grossTorque + starterTorque - fricTorque - propQ;
  s.rpm = Math.max(0, s.rpm + ((net / spec.propeller.inertia) * dt * 60) / (2 * Math.PI));
  // friction stops a crankshaft that is barely turning (it would otherwise creep down forever)
  if (s.rpm < 5 && !cranking && grossTorque < 1) s.rpm = 0;
  s.crank = (s.crank + s.rpm * 6 * dt) % 720;
  s.torque = s.rpm > 1 ? grossTorque - fricTorque : 0;
  s.hp = s.rpm > 1 ? ((grossTorque - lossTorque) * omega) / HP_W : 0;
  s.pct = (s.hp / rated.hp) * 100;

  // ---- cooling air over the cylinders: airspeed plus propeller slipstream (actuator disk, ∝ P^⅓)
  const slipKt = 55 * Math.cbrt(Math.max(s.hp, 0) / rated.hp);
  const coolKt = Math.sqrt(env.tasKt ** 2 + slipKt ** 2);
  const cooling = Math.max(0.15, Math.pow(((air.rho / RHO0) * coolKt) / 100, 0.4));
  const oatF = cToF(air.t);

  // ---- exhaust gas and cylinder head temperatures
  s.cyl.forEach((cy, i) => {
    const load = (cy.hp * nCyl) / ratedGross;
    const firing = cy.work > 0.02;
    let egt = oatF;
    if (firing) {
      egt = cal.egtBase + cal.egtGain * Math.sqrt(Math.max(load, 0)) + egtOffset(cy.lambda);
      if (cy.plugs === 1) egt += 60; // one flame front: later, hotter exhaust
      if (c.mags === "START") egt += 80;
    } else if (s.rpm > 50) egt = Math.max(oatF, (cy.cht + oatF) / 2);
    cy.egt = approach(cy.egt, egt, dt, firing ? 3 : 12 / thermal);
    const heat = firing ? cal.chtRise * Math.pow(Math.max(load, 0), 0.6) * headHeat(cy.lambda, cal.lambdaBestPower) : 0;
    const chtTarget = oatF + heat / (cooling * cal.coolingTrim[i]);
    // the time constant follows the cooling: more air, faster approach
    cy.cht = approach(cy.cht, chtTarget, dtT, cal.chtTau / (cooling * cal.coolingTrim[i]));
  });

  // ---- oil: friction and piston-cooling heat in; thermostatic cooler and crankcase out
  const valve = clamp((s.oilT - (spec.oil.thermostatF - 25)) / 25, 0.15, 1);
  s.coolerValve = valve;
  const heatIn = oilHeatHp(fric, gross) * HP_W; // W
  const uaRef = (ratedOilHeat(spec) * HP_W) / cal.oilRise; // W/°F, at rated power and reference cooling air
  const ua = uaRef * Math.max(cooling * (0.25 + 0.75 * valve), 0.05);
  s.oilT = approach(s.oilT, oatF + heatIn / ua, dtT, (cal.oilTau * uaRef) / ua);
  s.coolerBtu = s.rpm > 0 ? uaRef * cooling * 0.75 * valve * Math.max(s.oilT - oatF, 0) * 0.056869 : 0;

  // ---- oil pressure: positive-displacement pump, resistance ∝ viscosity, relief valve
  let oilP = s.rpm > 0 ? cal.oilPressPerRpm * Math.pow(s.rpm / 1000, 0.7) * Math.sqrt(visc) : 0;
  if (oilP > cal.oilRelief) oilP = cal.oilRelief + (oilP - cal.oilRelief) * 0.12;
  const sump = clamp((env.oilQt - 1.5) / 1.5, 0, 1); // the pickup uncovers below ~3 qt
  oilP *= sump < 1 ? sump * (0.85 + 0.15 * Math.sin(s.t * 7)) : 1;
  s.oilP = approach(s.oilP, oilP, dt, 0.4);
}

/** Propeller governor (oil-driven, needs oil pressure to go coarse). */
function governorStep(spec: EngineSpec, s: EngineState, target: number, dt: number) {
  const ps = { beta: s.beta, integ: s.propInteg };
  governor(ps, s.rpm, target, s.oilP, spec.propeller.fineDeg, spec.propeller.coarseDeg, dt);
  s.beta = ps.beta;
  s.propInteg = ps.integ;
  s.governing = s.beta > spec.propeller.fineDeg + 0.2 && Math.abs(s.rpm - target) < 40;
}

const ratedCache = new WeakMap<EngineSpec, number>();
/** Gross indicated hp at rated power, sea level standard: the reference for load-dependent temperatures. */
export function ratedGrossHp(spec: EngineSpec) {
  let v = ratedCache.get(spec);
  if (v === undefined) {
    const r = spec.rating.rpm;
    const ind = inductionCal(spec);
    const map = seaLevelLines(spec).find((l) => l.rpm === r)!.ftMap;
    v = grossIndicatedHp(spec, r, map, 0, 15, 29.92126 * 1.02, ind.ve);
    ratedCache.set(spec, v);
  }
  return v;
}

/** Heat into the oil (hp): most of the friction, and the piston-cooling jets' share of combustion heat. */
const oilHeatHp = (friction: number, gross: number) => 0.35 * friction + 0.04 * (gross + friction);

/** Oil heat (hp) at rated power: the reference for the oil temperature rise. */
function ratedOilHeat(spec: EngineSpec) {
  return oilHeatHp(frictionHp(spec, spec.rating.rpm), ratedGrossHp(spec));
}

/** The cylinder that fires next and the phase of every cylinder, for drawing. */
export function phases(spec: EngineSpec, crank: number) {
  return spec.geometry.cylinders.map((cy) => phaseOf(spec, cy.n, crank));
}
