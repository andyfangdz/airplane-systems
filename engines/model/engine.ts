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
import type { EngineSpec, Side, TurboSpec } from "../types";
import { leanGaugeAbove, leanOverNext } from "./alerts";
import { type Air, atmosphere, cToF, fToK, HP_W, INHG_PA, KT_MS, LB_KG, R_AIR, RHO0, ramPressure } from "./atmosphere";
import { phaseOf } from "./cycle";
import { carbFuelFlow, condensedWater, iceRate, mixtureChamberC } from "./carburetor";
import {
  continentalBoostPsi,
  continentalNozzleCapacity,
  continentalNozzlePsid,
  continentalPumpPsi,
  continentalSystem,
  distribution,
  fullRichLambdaAt,
  meteredFuelFlow,
  nozzleFlow,
  nozzlePressure,
} from "./fuel";
import { inductionCal, orificeFlow, series, solveManifold, throttleArea } from "./induction";
import { excessAirRatio } from "./mixture-units";
import { AFR_STOICH, egtOffset, headHeat, mixturePower, stability } from "./mixture";
import { remainingOilQt } from "./oil";
import { chartFuelFlow, frictionHp, fullRichWeight, grossIndicatedHp, pumpingHp, seaLevelLines } from "./performance";
import { governor, inducedVelocity, propTorque } from "./propeller";
import {
  actuatorPressure,
  altAirDoorNext,
  bearingHeatW,
  compressorOut,
  controllerBleed,
  equilibriumPR,
  filterOutletInHg,
  gateTarget,
  INH2O_PA,
  intercool,
  intercoolerDrop,
  oilLossQtPerMin,
  reliefFlow,
  reliefOpenNext,
  titContinuousMaxF,
  titOverNext,
  titTargets,
  turbineInletPressure,
  turbinePowerW,
  turbineRpm,
  turboMetering,
  turboRef,
} from "./turbo";

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
  /** HIGH BOOST/PRIME selected on a three-position pump switch (which sets `boost` too); subject to the spec's lockout. */
  highBoost?: boolean;
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
  // Turbo-system failures: present (false or null) only for a spec with `turbo` (see noFailures).
  /** Wastegate seized open or closed (null: free): it stays put whatever the actuator, its oil or the spring do. */
  wastegateSeized?: "open" | "closed" | null;
  /** Wastegate actuator oil supply lost (the spring opens the gate). */
  wastegateOil?: boolean;
  /** Oil leaking overboard from the turbocharger oil system. */
  oilLeak?: boolean;
  /** Leak between the compressors and the throttle. */
  inductionLeak?: boolean;
  /** Intercooler leak, by side [L, R]. */
  intercoolerLeak?: [boolean, boolean];
  /** Exhaust leak upstream of the turbines. */
  exhaustLeak?: boolean;
  /** Turbocharger internal failure, by side [L, R]. */
  turboInternal?: [boolean, boolean];
  /** Differential controller misadjusted (set point shifted by `turbo.controller.misadjustInHg`). */
  controllerMisadjust?: boolean;
  /** TIT probe failed, by side [L, R]. */
  titProbe?: [boolean, boolean];
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
  /** Induction source pressure and temperature (the compressor inlet for a turbocharged spec). */
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
  // Turbocharged engines. initialState sets the neutral value each comment gives; an engine without `turbo` keeps it.
  /** Upper-deck (throttle-inlet) pressure, inHg. Neutral: the inlet pressure. */
  deckInHg?: number;
  /** Wastegate position, 0 closed … 1 open; 1 when stopped or without oil. Neutral: 1. */
  gate?: number;
  /** Controller bleed (0 … 1) and wastegate actuator oil pressure (psi). Neutral: 0. */
  bleed?: number;
  pActPsi?: number;
  /** Turbocharger shaft speed by side [L, R], rpm, display only. Neutral: [0, 0]. */
  turboRpm?: [number, number];
  /** Compressor discharge and manifold air (after the intercooler), °C. Neutral: the inlet temperature. */
  compressorOutC?: number;
  matC?: number;
  /** Turbine-inlet (exhaust) pressure, inHg. Neutral: outside air pressure. */
  turbineInletInHg?: number;
  /** Turbine inlet temperature by side [L, R], °F. Neutral: outside air. */
  tit?: [number, number];
  /** Seconds above the continuous TIT limit (the transient timer). Neutral: 0. */
  titOverS?: number;
  /** Seconds above continuous TIT per side, independent of probe failures; populated by step (POH 3-31). */
  titProbeOverS?: [number, number];
  /** Overboost relief valve open. Neutral: false. */
  reliefOpen?: boolean;
  /** Automatic alternate-air door open. Neutral: false. */
  altAirOpen?: boolean;
  /** Previous turbo step's deck leakage and relief flow, kg/s. Neutral: absent (read as 0). */
  deckLossKgS?: number;
  /** Oil lost to leaks this run, qt. Neutral: 0. */
  oilLossQt?: number;
  /** HIGH BOOST actually running (after the lockout). Neutral: false. */
  highBoostOn?: boolean;
  /** The manifold pressure a turbocharged spec's metering reads as its throttle-angle stand-in (turbo.ts
   * `turboMetering`): the MAP without an intake leak. Set by `step` for a turbocharged spec only; absent, `map`. */
  meterMapInHg?: number;
  /** The leaning flag's timer (alerts.ts `leanOverNext`), only on a spec with `limits.leanMaxMap` (POH 4-22): net
   * seconds the manifold-pressure gauge has read above the limit with the mixture off full rich, 0 … `LEAN_DWELL_S`,
   * and the flag it latches. Without the limit the members are absent. */
  leanOverS?: number;
  leanOver?: boolean;
  /** The leaning cap the cylinders' work follows this step (`leanCapAt`; undefined: none). Set by `step` for a spec
   * with `calibration.leanGainMax` only. */
  leanCap?: LeanCap;
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
  ...(spec.turbo && {
    wastegateSeized: null,
    wastegateOil: false,
    oilLeak: false,
    inductionLeak: false,
    intercoolerLeak: [false, false],
    exhaustLeak: false,
    turboInternal: [false, false],
    controllerMisadjust: false,
    titProbe: [false, false],
  }),
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
    deckInHg: air.p,
    gate: 1,
    bleed: 0,
    pActPsi: 0,
    turboRpm: [0, 0],
    compressorOutC: air.t,
    matC: air.t,
    turbineInletInHg: air.p,
    tit: [f, f],
    titOverS: 0,
    reliefOpen: false,
    altAirOpen: false,
    oilLossQt: 0,
    highBoostOn: false,
    ...(spec.limits.leanMaxMap && { leanOverS: 0, leanOver: false }),
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
/**
 * Air flow (lb/h) at rated power, best-power mixture, from the fuel the manual gives for it. The carburetor and the
 * servo injector meter against this; a Continental system meters against `fuel.ts`'s `ratedAirLbH` instead.
 */
export function ratedAirLbH(spec: EngineSpec) {
  if (spec.fuelSystem.kind === "continental")
    throw new Error(`${spec.id}: a Continental fuel system meters against fuel.ts's ratedAirLbH; call that one`);
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

/**
 * Governor set speed for a propeller-control position. A governor with no pilot control (`propeller.control:
 * "fixed"`: SR22T POH 7-32, AMM 61-20 "factory-set to 2500 RPM") holds rated rpm whatever the control says.
 */
export const governedRpm = (spec: EngineSpec, prop: number) =>
  spec.propeller.control === "fixed"
    ? spec.rating.rpm
    : spec.propeller.governorMinRpm +
      Math.max(0, Math.min(1, prop)) * (spec.rating.rpm - spec.propeller.governorMinRpm);

/**
 * Whether the HIGH BOOST/PRIME lockout lets the fuel pump run in high-speed mode (SR22T POH 7-41): manifold pressure
 * equal to or greater than `highBoost.mapInHg` and pressure altitude equal to or greater than `altFt`, or engine speed
 * below `belowRpm`. (Figure 7-8's note prints "greater than"; the 7-41 text, which says "equal to or greater than", is
 * used.) Otherwise the relay limits the pump to BOOST. False for a fuel system without HIGH BOOST.
 */
export function highBoostEnabled(spec: EngineSpec, s: EngineState, env: Environment) {
  const hb = spec.fuelSystem.kind === "continental" ? spec.fuelSystem.highBoost : undefined;
  if (!hb) return false;
  return (s.map >= hb.mapInHg && env.altFt >= hb.altFt) || s.rpm < hb.belowRpm;
}

/**
 * Fuel HIGH BOOST/PRIME pushes through the metering to the nozzles below `highBoost.belowRpm`, lb/h at full rich. Not
 * published: about 5 GPH, so the POH 4-12 note's 2 s prime leaves about 8 g in the six ports.
 */
const HIGH_BOOST_PRIME_LBH = 30;

/**
 * The magnetos a switch position connects, before failures and crank speed. At START with `ignition.startMags:
 * "retard"` (the default) only the retard magneto fires: the plain one is grounded during the start cycle (IOM System
 * Description p. 2). With `"both"` START "activates both magnetos" (SR22T POH 7-37), each held to top centre by its
 * impulse coupling (AMM 74-00 PDF 2604).
 */
export function startFiringMags(spec: EngineSpec, mags: MagSwitch): Side[] {
  if (mags === "BOTH") return ["L", "R"];
  if (mags === "START") return spec.ignition.startMags === "both" ? ["L", "R"] : [spec.ignition.retardMag];
  return mags === "OFF" ? [] : [mags];
}

/** Which plugs fire in each cylinder for a switch position and magneto failures. */
export function sparks(spec: EngineSpec, mags: MagSwitch, f: Failures, rpm: number) {
  const ign = spec.ignition;
  const live = startFiringMags(spec, mags);
  const on = (m: Side) => rpm >= ign.minStartRpm * 0.6 && !(m === "L" ? f.magL : f.magR) && live.includes(m);
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
  // the rich misfire edge, where the spec sets one (mixture.ts; absent: 0.55)
  const rich = cal.richMisfireLambda;
  const ind = inductionCal(spec);
  const air = atmosphere(env.altFt, env.isaDevC);
  const nCyl = spec.geometry.cylinders.length;
  const rated = spec.rating;
  s.t += dt;
  s.oatC = air.t;

  // ---- induction: ram air through the filter, or unfiltered cowl air (alternate air, or carburetor heat from the muff)
  const carb = spec.fuelSystem.kind === "carburetor" ? spec.fuelSystem : null;
  const intake = spec.induction;
  const v = env.tasKt * KT_MS;
  const ram = ramPressure(air.p, air.t, env.tasKt, intake?.ramEta ?? 0.7);
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
  } else if (intake?.altAir === "automatic") {
    // an automatic door (POH 7-37; AMM 71-60 PDF 2542) has no pilot control, so the switch is ignored. An obstructed
    // filter upstream of the compressors leaves the air boxes below the cowl's pressure; that suction opens the door
    // against its magnets, and the engine then draws unfiltered, warmer air from inside the cowl (turbo.ts). A clean
    // filter is no restriction.
    const box = f.filter
      ? filterOutletInHg(
          (intake.filterBlockedArea ?? 0.12) * ind.cdAFull,
          ram,
          air.t + 273.15,
          (s.air * LB_KG) / 3600 + (s.deckLossKgS ?? 0),
        )
      : ram;
    const door = altAirDoorNext(spec, !!s.altAirOpen, ((air.p - box) * INHG_PA) / INH2O_PA);
    s.altAirOpen = door;
    source = door ? air.p : box;
    inletC = air.t + (door ? (intake.altAirDeltaC ?? 15) : 0);
    cdA = ind.cdAFull * throttleArea(c.throttle, cal.idleArea);
  } else {
    source = c.altAir ? air.p : ram;
    inletC = air.t + (c.altAir ? (intake?.altAirDeltaC ?? 15) : 0); // alternate air is warmer (assumed +15 °C)
    const open = throttleArea(c.throttle, cal.idleArea);
    // a blocked filter is a restriction in series with the throttle; the alternate air door bypasses it
    cdA = ind.cdAFull * (f.filter && !c.altAir ? series(open, intake?.filterBlockedArea ?? 0.12) : open);
  }
  // a leaking intake pipe is an orifice in parallel with the throttle, its air unmetered (assumed: a full leak is 3 % of
  // the wide-open area)
  const leaks = f.intakeLeak.map((l) => ind.cdAFull * 0.03 * clamp(l, 0, 1));
  const leakArea = leaks.reduce((a, x) => a + x, 0);
  // a turbocharged engine's throttle is fed from the upper deck at the intercooled temperature, and its exhaust
  // leaves against the turbine-inlet pressure (turbo.ts); otherwise outside air, and the exhaust exit pressure
  let deck = source,
    deckC = inletC,
    exhaust: number;
  if (spec.turbo) ({ deck, deckC, exhaust } = turboStep(spec, spec.turbo, s, f, air, source, inletC, ind.ve, dt));
  else exhaust = air.p * 1.02;
  const { map, air: airKgS } = solveManifold(spec, ind, cdA + leakArea, deck, deckC, s.rpm, exhaust);
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
  // the air the metering sees and the factor on its flow: the -K meters on rpm, throttle angle and deck pressure, not
  // the charge's density (turbo.ts), and the cylinders then burn the air they actually take
  let meterLbH = meteredAir,
    meterScale = 1,
    scheduleLbH = meteredAir;
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
    // boost pump or engine-driven pump to the metering (servo or Continental, fuel.ts), metered against air flow,
    // split by nozzle area
    const continental = continentalSystem(spec);
    // HIGH BOOST/PRIME runs the pump too; past the lockout it runs as BOOST (POH 7-41). Only the Continental system
    // has the mode: elsewhere `highBoost` alone does nothing.
    const highBoost = !!c.highBoost && highBoostEnabled(spec, s, env);
    s.highBoostOn = highBoost;
    const boost = c.boost || (!!c.highBoost && !!continental);
    const supply = Math.max(boost ? 1 : 0, enginePump);
    const servo = spec.fuelSystem.kind === "injected" ? spec.fuelSystem : undefined;
    s.fuelPsi = continental
      ? Math.max(boost ? continentalBoostPsi(spec) : 0, enginePump * continentalPumpPsi(spec, s.rpm))
      : Math.max(boost ? (servo?.boostPsi ?? 26) : 0, enginePump * clamp(s.rpm / 900, 0, 1) * (servo?.pumpPsi ?? 28));
    // below the lockout's rpm HIGH BOOST primes: fuel through the mixture valve to the nozzles and into the ports
    const valve = c.mixture > 0.02 ? Math.min(1, c.mixture) : 0;
    const prime = continental && highBoost && s.rpm < continental.highBoost.belowRpm ? HIGH_BOOST_PRIME_LBH * valve : 0;
    dist = distribution(spec, f.nozzle);
    // the -K meters on throttle angle (turbo.ts), which an intake leak does not move: the leak is downstream of the
    // throttle and unmetered, so the schedule reads the MAP the throttle alone would give
    if (spec.turbo)
      s.meterMapInHg = leakArea > 0 ? solveManifold(spec, ind, cdA, deck, deckC, s.rpm, exhaust).map : map;
    const tm = spec.turbo ? turboMetering(spec, ind.ve, s.rpm, s.meterMapInHg!, deck) : undefined;
    meterLbH = tm?.airLbH ?? meteredAir;
    meterScale = tm?.scale ?? 1;
    scheduleLbH = tm?.scheduleLbH ?? meterLbH;
    // the nozzles can pass no more than the pump pressure pushes through their open area: with every nozzle blocked,
    // nothing flows however much the metering asks for
    metered = Math.min(
      meteredFuelFlow(spec, meterLbH, c.mixture, inletRho, supply, scheduleLbH) * meterScale + prime,
      continental
        ? continentalNozzleCapacity(spec, s.fuelPsi, dist.areaMean)
        : nozzleFlow(spec, s.fuelPsi) * dist.areaMean,
    );
    s.fuel = metered;
    // a Continental nozzle pressure is a differential to the upper deck (M-18 Table 2-4 note 4)
    const nozzleP = continental ? continentalNozzlePsid : nozzlePressure;
    s.nozzlePsi = metered > 0.5 ? Math.min(nozzleP(spec, metered, dist.areaMean), s.fuelPsi) : 0;
  }

  // ---- each cylinder: port fuel film, mixture, spark, work
  const plugs = sparks(spec, c.mags, f, s.rpm);
  const tau = 0.08 + 250 / Math.max(s.rpm, 20); // film evaporation time, s: slow when cranking
  // full rich, the cylinders burn at the schedule's λ scaled by the air they take over the air metered for
  const lfr = fullRichLambdaAt(spec, scheduleLbH);
  const lambdaFR = lfr !== undefined && airLbH > 0 && meterLbH > 0 ? (lfr * airLbH) / (meterLbH * meterScale) : lfr;
  // leaning above the chart's full-rich manifold pressures: the work a cylinder gains over full rich is capped
  // (leanCapAt); kept on the state for the readings that lean the cylinders by hand (tit.ts)
  const leanCap = leanCapAt(spec, lambdaFR, map);
  if (cal.leanGainMax !== undefined) s.leanCap = leanCap;
  // a turbocharged engine's chart power follows its intercooled charge's density (performance.ts, chargeRefC)
  const bp = grossIndicatedHp(
    spec,
    s.rpm,
    map,
    env.altFt,
    inletC,
    exhaust,
    ind.ve,
    lambdaFR,
    spec.turbo ? deckC : undefined,
  );
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
    cy.lambda = cy.fuel > 1e-4 ? excessAirRatio(airCyl, cy.fuel, AFR_STOICH) : Infinity;
    cy.plugs = plugs[i];
    let w = cy.plugs ? cylinderWork(spec, cy.lambda, leanCap) : 0;
    if (cy.plugs === 1) w *= cal.singlePlug;
    if (c.mags === "START") w *= 0.85; // retarded spark wastes work
    cy.work = w;
    cy.hp = (bp / nCyl) * w;
    work += w;
    // roughness: a dead or misfiring cylinder, or one plug (slower, less even burn)
    const stab = cy.plugs ? stability(cy.lambda, rich) : 0;
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
  const acc = spec.accessories;
  const starterTorque = cranking
    ? (acc.starterTorque ?? 230) * Math.max(0, 1 - s.rpm / (acc.starterFreeRpm ?? 380))
    : 0;
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
  const coolingFor = (slipRated: number) => {
    const slip = slipRated * Math.cbrt(Math.max(s.hp, 0) / rated.hp);
    return Math.max(0.15, Math.pow(((air.rho / RHO0) * Math.sqrt(env.tasKt ** 2 + slip ** 2)) / 100, 0.4));
  };
  const cooling = coolingFor(cal.slipKt ?? 55);
  // the oil cooler's own share of the slipstream, where the spec gives one (absent: the cylinders')
  const oilCooling = cal.oilSlipKt === undefined ? cooling : coolingFor(cal.oilSlipKt);
  const oatF = cToF(air.t);

  // ---- exhaust gas and cylinder head temperatures
  s.cyl.forEach((cy, i) => {
    const load = (cy.hp * nCyl) / ratedGross;
    const firing = cy.work > 0.02;
    let egt = oatF;
    if (firing) {
      egt = cal.egtBase + cal.egtGain * Math.sqrt(Math.max(load, 0)) + egtOffset(cy.lambda, rich);
      if (cy.plugs === 1) egt += 60; // one flame front: later, hotter exhaust
      if (c.mags === "START") egt += 80;
    } else if (s.rpm > 50) egt = Math.max(oatF, (cy.cht + oatF) / 2);
    cy.egt = approach(cy.egt, egt, dt, firing ? 3 : 12 / thermal);
    const heat = firing
      ? cal.chtRise * Math.pow(Math.max(load, 0), 0.6) * headHeat(cy.lambda, cal.lambdaBestPower, rich)
      : 0;
    const chtTarget = oatF + heat / (cooling * cal.coolingTrim[i]);
    // the time constant follows the cooling: more air, faster approach
    cy.cht = approach(cy.cht, chtTarget, dtT, cal.chtTau / (cooling * cal.coolingTrim[i]));
  });

  // ---- turbine-inlet temperature each side's probe reads (POH 7-35; turbo.ts), and the time above its continuous limit
  if (spec.turbo) {
    const target = titTargets(
      spec,
      s.cyl.map((cy) => cy.egt),
      oatF,
    );
    const tau = cal.titTauS ?? 5;
    s.tit = [approach(s.tit![0], target[0], dt, tau), approach(s.tit![1], target[1], dt, tau)];
    const limit = titContinuousMaxF(spec);
    // Legacy checkpoints retain only aggregate dwell; inherit it once, before advancing either history.
    const previous = s.titProbeOverS ?? [s.titOverS ?? 0, s.titOverS ?? 0];
    s.titOverS = limit === undefined ? 0 : titOverNext(s.titOverS!, s.tit, limit, dt);
    // Probe failures change the displayed readings, not either turbine's temperature history (POH 3-31).
    s.titProbeOverS = [0, 1].map((i) =>
      limit === undefined ? 0 : titOverNext(previous[i], [s.tit![i]], limit, dt),
    ) as [number, number];
    // oil lost overboard while the pump pressurises it: an engine oil leak, and each failed turbocharger's bearing
    // (POH 3-28 causes 3, 4); the sump runs down and the pickup then uncovers (below)
    const sources = (f.oilLeak ? 1 : 0) + (f.turboInternal?.filter(Boolean).length ?? 0);
    if (sources && s.oilP > 0.5)
      s.oilLossQt = Math.min(env.oilQt, (s.oilLossQt ?? 0) + (oilLossQtPerMin(spec.turbo, sources) / 60) * dt);
  }

  // ---- oil: friction and piston-cooling heat in; thermostatic cooler and crankcase out
  const valve = clamp((s.oilT - (spec.oil.thermostatF - 25)) / 25, 0.15, 1);
  s.coolerValve = valve;
  // W; a turbocharged engine's oil also carries the turbochargers' bearing heat (AMM 79-00 PDF 2764)
  const heatIn = oilHeatHp(fric, gross) * HP_W + (spec.turbo ? bearingHeatW(spec.turbo, s.turboRpm!) : 0);
  const uaRef = (ratedOilHeat(spec) * HP_W) / cal.oilRise; // W/°F, at rated power and reference cooling air
  const ua = uaRef * Math.max(oilCooling * (0.25 + 0.75 * valve), 0.05);
  s.oilT = approach(s.oilT, oatF + heatIn / ua, dtT, (cal.oilTau * uaRef) / ua);
  s.coolerBtu = s.rpm > 0 ? uaRef * oilCooling * 0.75 * valve * Math.max(s.oilT - oatF, 0) * 0.056869 : 0;

  // ---- oil pressure: positive-displacement pump, resistance ∝ viscosity, relief valve
  let oilP = s.rpm > 0 ? cal.oilPressPerRpm * Math.pow(s.rpm / 1000, 0.7) * Math.sqrt(visc) : 0;
  if (oilP > cal.oilRelief) oilP = cal.oilRelief + (oilP - cal.oilRelief) * 0.12;
  const [bare, covered] = spec.oil.pickupQt ?? [1.5, 3];
  const sump = clamp((remainingOilQt(env.oilQt, s.oilLossQt) - bare) / (covered - bare), 0, 1); // the pickup uncovers below ~3 qt
  oilP *= sump < 1 ? sump * (0.85 + 0.15 * Math.sin(s.t * 7)) : 1;
  // the turbochargers' supply from the oil cooler is a branch in parallel with the engine's passages: it takes
  // `turbo.oil.bleedPsi` at rated rpm, in proportion to the pump's flow (AMM 79-00 PDF 2764)
  if (spec.turbo) oilP = Math.max(0, oilP - spec.turbo.oil.bleedPsi * clamp(s.rpm / rated.rpm, 0, 1));
  s.oilP = approach(s.oilP, oilP, dt, 0.4);

  // ---- the leaning limit's timer, in real time: the flag reads the power setting, not the controller's hunting
  const lean = spec.limits.leanMaxMap;
  if (lean) {
    const next = leanOverNext(
      { s: s.leanOverS ?? 0, on: s.leanOver ?? false },
      s.running && c.mixture < 0.99,
      leanGaugeAbove(s.map, lean.value),
      dt,
    );
    s.leanOverS = next.s;
    s.leanOver = next.on;
  }
}

/**
 * One substep of the turbocharger (turbo.ts), from the previous substep's air, fuel, manifold pressure, exhaust
 * temperatures and oil pressure: the controller sets the bleed and the wastegate follows its actuator; the exhaust
 * sets the turbine-inlet pressure and the turbines' power; the deck pressure lags toward the ratio that power holds;
 * the intercoolers cool the compressed charge. Returns the throttle's source pressure and temperature and the exhaust
 * pressure, and writes the turbo members of the state.
 */
function turboStep(
  spec: EngineSpec,
  turbo: TurboSpec,
  s: EngineState,
  f: Failures,
  air: Air,
  source: number,
  inletC: number,
  ve: (rpm: number) => number,
  dt: number,
) {
  const t1 = inletC + 273.15;
  // the turbines discharge through the tailpipes against the exit pressure a normally aspirated exhaust sees
  const pTail = air.p * 1.02;
  const bleed = controllerBleed(turbo, s.deckInHg!, s.map, !!f.controllerMisadjust);
  // the actuator takes engine oil through its inlet restriction (POH 3-27/3-28 cause 3: none with its oil lost)
  const pAct = actuatorPressure(f.wastegateOil ? 0 : s.oilP, bleed, turbo.controller.ratio);
  // a seized wastegate stays where it stuck, whatever the actuator, its oil or the spring do
  const seized = f.wastegateSeized;
  const gate =
    seized === "closed"
      ? 0
      : seized === "open"
        ? 1
        : approach(s.gate!, gateTarget(turbo, pAct, s.rpm), dt, turbo.wastegate.tauS);
  // the relief valve on the deck (LH intercooler outlet, AMM 71-60 PDF 2542) vents deck air into the cowl: the
  // compressors then pass that air as well as the engine's, so the same turbine power holds a lower pressure ratio
  const relief = reliefOpenNext(turbo, !!s.reliefOpen, s.deckInHg!);
  const mR = relief ? reliefFlow(turbo, s.deckInHg!, s.matC! + 273.15, air.p) : 0;
  s.reliefOpen = relief;
  // a split induction coupling or a leaking intercooler vents deck air into the cowl the same way: the compressors
  // pass it as well, and the engine falls back toward normally aspirated (POH 3-27 cause 1)
  const failed = f.turboInternal ?? [false, false];
  const deckLeak =
    (f.inductionLeak ? turbo.leaks.inductionArea : 0) +
    (f.intercoolerLeak ?? [false, false]).filter(Boolean).length * turbo.leaks.intercoolerArea;
  const mL = deckLeak > 0 ? orificeFlow(deckLeak, s.deckInHg! * INHG_PA, s.matC! + 273.15, air.p * INHG_PA) : 0;
  // Both vented flows must enter through the filter on the next induction step. Keep the neutral field absent
  // for existing no-failure setups and default old checkpoints to zero at the reader.
  if (mL + mR > 0 || s.deckLossKgS !== undefined) s.deckLossKgS = mL + mR;
  // a failed turbocharger's stopped compressor is an open path from the deck back through its intercooler to its air
  // box (the two paths join only at the throttle body, AMM 71-60 PDF 2542): the working compressor passes that
  // recirculating air as well (POH 3-28 cause 4: "a sudden loss of manifold pressure")
  const deadArea = (turbo.leaks.deadCompressorArea ?? 0) * failed.filter(Boolean).length;
  const mB = deadArea > 0 ? orificeFlow(deadArea, s.deckInHg! * INHG_PA, s.matC! + 273.15, source * INHG_PA) : 0;
  const mA = (s.air * LB_KG) / 3600,
    mE = ((s.air + s.fuel) * LB_KG) / 3600;
  // the gas the turbines expand: the cylinders' mean exhaust gas temperature (the probes' `tit` reading, with its
  // offset and lag, is display and limits only, so fitting it does not move the turbocharger's calibration). An
  // exhaust leak ahead of the turbines bypasses them (POH 3-28 cause 2); a failed turbocharger passes its gas but
  // does no work, and the working one compresses all the air (cause 4).
  const titK = fToK(s.cyl.reduce((a, cy) => a + cy.egt, 0) / s.cyl.length);
  const exhaustLeak = f.exhaustLeak ? turbo.leaks.exhaustArea : 0;
  const working = turbo.count - failed.filter(Boolean).length;
  const pTI = turbineInletPressure(turbo, mE, titK, pTail, gate, exhaustLeak);
  const power = turbinePowerW(turbo, mE, titK, pTI, pTail, gate, exhaustLeak, working);
  const pr = equilibriumPR(turbo, power, mA + mR + mL + mB, t1);
  const ref = turboRef(spec, ve);
  const rho2 = (s.deckInHg! * INHG_PA) / (R_AIR * (s.compressorOutC! + 273.15));
  // The working compressor's outlet also passes the recirculating flow through its intercooler. The effective
  // deadCompressorArea includes the return path's stopped compressor, intercooler and duct losses (AMM 71-60).
  // Rated flow is shared by all paths; only the working paths carry the forward flow after a failure.
  const drop =
    working > 0
      ? intercoolerDrop(turbo, mA + mR + mL + mB, ref.mRef * (working / turbo.count), rho2, ref.rhoRef)
      : intercoolerDrop(turbo, mA + mR + mL + mB, ref.mRef, rho2, ref.rhoRef);
  const deck = approach(s.deckInHg!, pr * source - drop, dt, turbo.spoolTauS);
  const prNow = Math.max(1, (deck + drop) / source);
  const t2 = compressorOut(turbo, t1, prNow);
  const mat = intercool(turbo, t2, air.t + 273.15);
  const n = turbineRpm(turbo, prNow);
  s.deckInHg = deck;
  s.gate = gate;
  s.bleed = bleed;
  s.pActPsi = pAct;
  s.turboRpm = [failed[0] ? 0 : n, failed[1] ? 0 : n];
  s.compressorOutC = t2 - 273.15;
  s.matC = mat - 273.15;
  s.turbineInletInHg = pTI;
  return { deck, deckC: mat - 273.15, exhaust: pTI };
}

/** Propeller governor (oil-driven, needs oil pressure to go coarse). */
function governorStep(spec: EngineSpec, s: EngineState, target: number, dt: number) {
  const ps = { beta: s.beta, integ: s.propInteg };
  governor(ps, s.rpm, target, s.oilP, spec.propeller.fineDeg, spec.propeller.coarseDeg, dt);
  s.beta = ps.beta;
  s.propInteg = ps.integ;
  s.governing = s.beta > spec.propeller.fineDeg + 0.2 && Math.abs(s.rpm - target) < 40;
}

/**
 * The cap on the work a cylinder gains when leaned above the chart's full-rich manifold pressures
 * (`calibration.leanGainMax`): `leanGainMax` × its work at the full-rich λ, phased in with the full-rich basis
 * (performance.ts fullRichWeight). On a hot day the full-rich basis is a very rich λ, and leaning from it would
 * otherwise gain far more than a standard day's (tsio550k/SOURCES.md "Leaning above 30.5 in.Hg").
 */
export interface LeanCap {
  /** The most work a leaned cylinder does, as a fraction of best-power work. */
  work: number;
  /** How much of the work above `work` is taken off, 0 … 1 (fullRichWeight at the manifold pressure). */
  weight: number;
}

/** The leaning cap at the full-rich λ `lambdaFR` and manifold pressure `map` (inHg); undefined where none applies. */
export function leanCapAt(spec: EngineSpec, lambdaFR: number | undefined, map: number): LeanCap | undefined {
  const cal = spec.calibration;
  const weight = fullRichWeight(spec, map);
  return cal.leanGainMax !== undefined && lambdaFR !== undefined && weight > 0
    ? {
        work: cal.leanGainMax * mixturePower(lambdaFR, cal.lambdaBestPower, cal.peakEgtPower, cal.richMisfireLambda),
        weight,
      }
    : undefined;
}

/**
 * The fraction of best-power work a cylinder firing on both plugs does at `lambda` (mixture.ts mixturePower), with
 * the leaning cap: above `cap.work`, `cap.weight` of the excess is taken off.
 */
export function cylinderWork(spec: EngineSpec, lambda: number, cap?: LeanCap) {
  const cal = spec.calibration;
  const w = mixturePower(lambda, cal.lambdaBestPower, cal.peakEgtPower, cal.richMisfireLambda);
  return cap !== undefined && w > cap.work ? w - cap.weight * (w - cap.work) : w;
}

const ratedCache = new WeakMap<EngineSpec, number>();
/** Gross indicated hp at rated power, sea level standard: the reference for load-dependent temperatures. */
export function ratedGrossHp(spec: EngineSpec) {
  let v = ratedCache.get(spec);
  if (v === undefined) {
    const r = spec.rating.rpm;
    const ind = inductionCal(spec);
    // the installed full-throttle MAP where the spec gives one (a turbocharged engine), else the chart's at sea level;
    // best-power basis (no full-rich divisor), so full rich at rated reads a load of about 1
    const map = spec.rating.map ?? seaLevelLines(spec).find((l) => l.rpm === r)!.ftMap;
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
