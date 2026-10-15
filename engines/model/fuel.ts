/**
 * Fuel metering, distribution and the port wall film.
 *
 * A servo injector meters fuel against the air flow: its air diaphragm sees impact-minus-venturi pressure (∝ ṁ²/ρ)
 * and its fuel diaphragm the metering-jet drop (∝ ṁf²), so fuel flow tracks air mass flow × √(ρ_ref / ρ): the mixture
 * gets richer as the air thins, which is why it needs leaning in a climb. The mixture valve scales the jet; a
 * constant-head spring gives a small flow with no air flow, enough to prime with the boost pump on.
 * The flow divider then feeds the four nozzles at one pressure, so a partly blocked nozzle starves its own cylinder
 * and raises the common nozzle pressure: a pressure-type gauge then reads high.
 */
import type { EngineSpec } from "../types";
import { RHO0 } from "./atmosphere";
import { AFR_STOICH } from "./mixture";

/** Flow the constant-head idle spring gives with no air flow, lb/h (illustrative). */
export const IDLE_SPRING_LBH = 1.0;

/** Metered fuel flow (lb/h) for an air flow (lb/h), mixture position 0 (idle cut-off) … 1 (full rich). */
export function servoFuelFlow(spec: EngineSpec, airLbH: number, mixture: number, inletRho: number, supply: number) {
  if (mixture <= 0.02 || supply <= 0) return 0;
  const far = 1 / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const valve = Math.min(1, mixture);
  const metered = airLbH * far * valve * Math.sqrt(RHO0 / Math.max(inletRho, 0.2));
  const spring = IDLE_SPRING_LBH * valve;
  return (metered + spring) * supply;
}

/** Nominal fuel flow (lb/h) at a nozzle pressure (psig), interpolated on the injector chart. */
export function nozzleFlow(spec: EngineSpec, psig: number) {
  const P = spec.nozzle.points;
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
  const a = spec.geometry.cylinders.map((_, i) => spec.calibration.nozzleTrim[i] * (1 - (blockage[i] ?? 0)));
  const sum = a.reduce((s, x) => s + x, 0) || 1;
  return { share: a.map((x) => x / sum), areaMean: sum / a.length };
}
