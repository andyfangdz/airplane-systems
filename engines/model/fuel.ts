/**
 * Fuel metering, distribution and the port wall film.
 *
 * A servo injector meters fuel against the air flow: its air diaphragm sees impact-minus-venturi pressure (∝ ṁ²/ρ)
 * and its fuel diaphragm the metering-jet drop (∝ ṁf²), so fuel flow tracks air mass flow × √(ρ_ref / ρ): the mixture
 * gets richer as the air thins, which is why it needs leaning in a climb. The mixture valve scales the jet; a
 * constant-head spring gives a small flow with no air flow, enough to prime with the boost pump on.
 * The flow divider then feeds the four nozzles at one pressure, so a partly blocked nozzle starves its own cylinder
 * and raises the common nozzle pressure: a pressure-type gauge then reads high.
 *
 * A Continental continuous-flow system (`fuelSystem.kind: "continental"`, the TSIO-550-K) meters "in proportion to
 * engine RPM, mixture setting, and throttle angle" (SR22T POH 7-38) with an aneroid on the upper-deck pressure (M-18
 * 2-1). The model takes the air flow as a fraction of rated air in their place: full rich is a λ schedule against that
 * fraction (`fullRichLambda`), with no density richening, and the mixture valve scales it. The engine-driven pump's
 * unmetered pressure rises with rpm through the two setup points (AMM 73-20); the nozzles follow a square-root law
 * through the rated nozzle pressure, a differential to the upper deck (M-18 Table 2-4 note 4).
 */
import type { ContinentalInjection, EngineSpec } from "../types";
import { LB_KG, RHO0 } from "./atmosphere";
import { engineAirFlow, inductionCal } from "./induction";
import { AFR_STOICH } from "./mixture";

/** Flow the constant-head idle spring gives with no air flow, lb/h (illustrative). */
export const IDLE_SPRING_LBH = 1.0;

/** Engine speed of the low unmetered-pressure setting (M-18 Table 2-4 "600 RPM"; AMM 73-20 PDF 2588–2589 (u), (z)). */
export const PUMP_SET_RPM = 600;

const P0 = 29.92126;
const mid = ([a, b]: [number, number]) => (a + b) / 2;

/** The spec's Continental fuel system, or undefined for a servo injector or a carburetor. */
export const continentalSystem = (spec: EngineSpec): ContinentalInjection | undefined =>
  spec.fuelSystem.kind === "continental" ? spec.fuelSystem : undefined;

const ratedAirCache = new WeakMap<EngineSpec, number>();
/**
 * Air flow (lb/h) the air fraction is measured against: rated rpm at the installed manifold pressure `rating.map`,
 * sea level standard, exhaust at 1.02 × standard pressure. A fixed reference, not what a turbocharger delivers.
 */
export function ratedAirLbH(spec: EngineSpec) {
  let v = ratedAirCache.get(spec);
  if (v === undefined) {
    const map = spec.rating.map;
    if (map === undefined)
      throw new Error(`${spec.id}: a Continental fuel system needs rating.map (the installed full-throttle MAP)`);
    v = (engineAirFlow(spec, inductionCal(spec).ve, spec.rating.rpm, map, 15, P0 * 1.02) / LB_KG) * 3600;
    ratedAirCache.set(spec, v);
  }
  return v;
}

/** λ at full rich for an air fraction `a` of rated (the `fullRichLambda` schedule, flat beyond its ends). */
export function fullRichLambda(fs: ContinentalInjection, a: number) {
  const P = fs.fullRichLambda;
  if (a <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++)
    if (a <= P[i][0]) return P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * (a - P[i - 1][0])) / (P[i][0] - P[i - 1][0]);
  return P[P.length - 1][1];
}

/** Full-rich λ at an air flow (lb/h) for a Continental system; undefined for a servo system. */
export function fullRichLambdaAt(spec: EngineSpec, airLbH: number) {
  const fs = continentalSystem(spec);
  return fs ? fullRichLambda(fs, airLbH / ratedAirLbH(spec)) : undefined;
}

/**
 * Continental metered flow (lb/h): full rich for the air fraction, scaled by the mixture valve. The schedule's λ is read
 * at `scheduleLbH` (default the air flow itself); the turbocharged -K reads it at its throttle-angle stand-in, the
 * same air at rated rpm (turbo.ts `turboMetering`), so the flow follows rpm and the schedule does not.
 */
export function continentalFuelFlow(
  spec: EngineSpec,
  airLbH: number,
  mixture: number,
  supply: number,
  scheduleLbH = airLbH,
) {
  if (mixture <= 0.02 || supply <= 0) return 0;
  const fullRich = airLbH / (AFR_STOICH * fullRichLambdaAt(spec, scheduleLbH)!);
  const valve = Math.min(1, mixture);
  return (fullRich * valve + IDLE_SPRING_LBH * valve) * supply;
}

/** Metered fuel flow (lb/h) by the spec's fuel system: Continental (schedule read at `scheduleLbH`), or the servo. */
export function meteredFuelFlow(
  spec: EngineSpec,
  airLbH: number,
  mixture: number,
  inletRho: number,
  supply: number,
  scheduleLbH = airLbH,
) {
  return continentalSystem(spec)
    ? continentalFuelFlow(spec, airLbH, mixture, supply, scheduleLbH)
    : servoFuelFlow(spec, airLbH, mixture, inletRho, supply);
}

/** Mixture position that gives λ at an air flow (lb/h): the inverse of `meteredFuelFlow` with the supply on. */
export function mixtureForFlow(
  spec: EngineSpec,
  airLbH: number,
  lambda: number,
  inletRho: number,
  scheduleLbH = airLbH,
) {
  const want = airLbH / (AFR_STOICH * lambda);
  if (continentalSystem(spec)) {
    const perUnit = airLbH / (AFR_STOICH * fullRichLambdaAt(spec, scheduleLbH)!) + IDLE_SPRING_LBH;
    return Math.max(0.03, Math.min(1, want / perUnit));
  }
  const far = 1 / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const perUnit = airLbH * far * Math.sqrt(RHO0 / Math.max(inletRho, 0.2)) + IDLE_SPRING_LBH;
  return Math.max(0.03, Math.min(1, want / perUnit));
}

/**
 * Continental engine-driven pump, unmetered pressure (psi) at an rpm: straight through the middle of the 600 rpm band
 * and of the rated band (AMM 73-20 PDF 2589 (z), (x)), and in proportion to rpm below 600.
 */
export function continentalPumpPsi(spec: EngineSpec, rpm: number) {
  const fs = continentalSystem(spec)!;
  const idle = mid(fs.pumpPsi.idle),
    rated = mid(fs.pumpPsi.rated);
  if (rpm <= PUMP_SET_RPM) return (idle * Math.max(rpm, 0)) / PUMP_SET_RPM;
  return idle + ((rated - idle) * (rpm - PUMP_SET_RPM)) / (spec.rating.rpm - PUMP_SET_RPM);
}

/** Continental boost pump pressure, psi (middle of the published band). */
export const continentalBoostPsi = (spec: EngineSpec) => mid(continentalSystem(spec)!.boostPsi);

/** Total flow (lb/h) through nominal nozzles at the rated nozzle pressure: the square-root law's anchor. */
const nozzleRef = (spec: EngineSpec) => nozzleFlow(spec, continentalSystem(spec)!.nozzleRatedPsid);

/** Continental metered nozzle pressure (psid to the upper deck) for a total flow when nozzles are `areaMean` open. */
export function continentalNozzlePsid(spec: EngineSpec, lbH: number, areaMean: number) {
  const q = lbH / (Math.max(areaMean, 0.05) * nozzleRef(spec));
  return continentalSystem(spec)!.nozzleRatedPsid * q * q;
}

/** The most a Continental nozzle set passes (lb/h) at a pressure (psi): the square-root law. */
export function continentalNozzleCapacity(spec: EngineSpec, psi: number, areaMean: number) {
  if (psi <= 0) return 0;
  return nozzleRef(spec) * Math.sqrt(psi / continentalSystem(spec)!.nozzleRatedPsid) * areaMean;
}

/** Metered fuel flow (lb/h) for an air flow (lb/h), mixture position 0 (idle cut-off) … 1 (full rich). */
export function servoFuelFlow(spec: EngineSpec, airLbH: number, mixture: number, inletRho: number, supply: number) {
  if (mixture <= 0.02 || supply <= 0) return 0;
  const far = 1 / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const valve = Math.min(1, mixture);
  const metered = airLbH * far * valve * Math.sqrt(RHO0 / Math.max(inletRho, 0.2));
  const spring = IDLE_SPRING_LBH * valve;
  return (metered + spring) * supply;
}

/** Nominal fuel flow (lb/h) at a nozzle pressure (psig), interpolated on the injector chart (none: a carburetor). */
export function nozzleFlow(spec: EngineSpec, psig: number) {
  if (spec.fuelSystem.kind === "carburetor") return 0;
  const P = spec.fuelSystem.nozzle.points;
  if (psig <= 0) return 0;
  for (let i = 1; i < P.length; i++)
    if (psig <= P[i][0])
      return P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * (psig - P[i - 1][0])) / (P[i][0] - P[i - 1][0]);
  const [a, b] = [P[P.length - 2], P[P.length - 1]];
  return b[1] + ((b[1] - a[1]) * (psig - b[0])) / (b[0] - a[0]);
}

/** Nozzle pressure (psig) for a total flow (lb/h) when the nozzles' open areas average `areaMean` of nominal. */
export function nozzlePressure(spec: EngineSpec, lbH: number, areaMean: number) {
  const target = lbH / Math.max(areaMean, 0.05);
  let lo = 0,
    hi = 60;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (nozzleFlow(spec, m) < target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Each cylinder's share of the metered flow: all nozzles see one pressure, so flow ∝ open area. */
export function distribution(spec: EngineSpec, blockage: number[]) {
  const a = spec.geometry.cylinders.map((_, i) => spec.calibration.fuelTrim[i] * (1 - (blockage[i] ?? 0)));
  const sum = a.reduce((s, x) => s + x, 0);
  // with every nozzle blocked nothing flows: no share, no open area
  return { share: a.map((x) => (sum > 0 ? x / sum : 0)), areaMean: sum / a.length };
}
