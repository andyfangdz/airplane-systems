/**
 * Air into the engine: a throttle plate (a compressible orifice) feeding a manifold that the cylinders empty at
 * a rate set by speed, density and volumetric efficiency. Manifold pressure is where the two flows balance.
 */
import type { EngineSpec } from "../types";
import { GAMMA, INHG_PA, LB_KG, R_AIR } from "./atmosphere";
import { chartFullThrottleMap, chartFuelFlow, displacementM3, seaLevelHp, seaLevelLines } from "./performance";
import { AFR_STOICH } from "./mixture";

const P0 = 29.92126;
const T0 = 288.15;

/** Mass flow (kg/s) through an orifice of effective area `cdA` (m²) from total pressure `p0` to `p` (Pa), `t0` K. */
export function orificeFlow(cdA: number, p0: number, t0: number, p: number) {
  if (p >= p0 || cdA <= 0) return 0;
  const crit = Math.pow(2 / (GAMMA + 1), GAMMA / (GAMMA - 1));
  const pr = Math.max(p / p0, crit);
  const psi = Math.sqrt(((2 * GAMMA) / (GAMMA - 1)) * (Math.pow(pr, 2 / GAMMA) - Math.pow(pr, (GAMMA + 1) / GAMMA)));
  return (cdA * p0 * psi) / Math.sqrt(R_AIR * t0);
}

/**
 * Exhaust residuals: the clearance volume keeps burned gas at exhaust pressure, so the fresh charge shrinks as
 * manifold pressure falls below exhaust pressure. Uses the published compression ratio.
 */
export function residualFactor(cr: number, map: number, exhaust: number) {
  return (cr - Math.pow(exhaust / Math.max(map, 0.5), 1 / GAMMA)) / (cr - 1);
}

export interface InductionCal {
  /** Volumetric efficiency at each chart rpm (from the fuel-flow and power charts) and an interpolator. */
  vePoints: [number, number][];
  ve: (rpm: number) => number;
  /** Effective area of the wide-open induction (m²). */
  cdAFull: number;
}

const cache = new WeakMap<EngineSpec, InductionCal>();

/**
 * Volumetric efficiency from the charts: at full throttle on each sea-level rpm line, the best-power fuel flow
 * (Figure C-3) divided by the best-power fuel–air ratio is the air the engine took in at the chart's manifold pressure.
 * Below the chart it falls off linearly with speed (an assumption), bounded to a physical range.
 */
export function inductionCal(spec: EngineSpec): InductionCal {
  const hit = cache.get(spec);
  if (hit) return hit;
  const vd = displacementM3(spec);
  const lbp = spec.calibration.lambdaBestPower;
  const vePoints = seaLevelLines(spec).map((l): [number, number] => {
    const hp = seaLevelHp(spec, l.rpm, l.ftMap);
    const fuel = (chartFuelFlow(spec, l.rpm, hp, "bestPower") * LB_KG) / 3600;
    const air = fuel * AFR_STOICH * lbp;
    const rho = (l.ftMap * INHG_PA) / (R_AIR * T0);
    return [l.rpm, air / (rho * ((vd * l.rpm) / 120) * residualFactor(spec.geometry.compressionRatio, l.ftMap, P0))];
  });
  const ve = (rpm: number) => {
    const P = vePoints;
    let i = 0;
    while (i < P.length - 2 && rpm > P[i + 1][0]) i++;
    const [r0, v0] = P[i],
      [r1, v1] = P[i + 1];
    let v = v0 + ((v1 - v0) * (rpm - r0)) / (r1 - r0);
    // below the chart, use the slope across the whole chart (local slopes are digitizing noise)
    if (rpm < P[0][0]) {
      const k = (P[P.length - 1][1] - P[0][1]) / (P[P.length - 1][0] - P[0][0]);
      v = P[0][1] + k * (rpm - P[0][0]);
    }
    return Math.max(0.7, Math.min(1.0, v));
  };
  // size the open induction so rated rpm at sea level gives the chart's full-throttle manifold pressure
  const rated = spec.rating.rpm;
  const ftMap = chartFullThrottleMap(spec, rated);
  const air = engineAirFlow(spec, ve, rated, ftMap, T0 - 273.15, P0);
  const cdAFull = air / orificeFlow(1, P0 * INHG_PA, T0, ftMap * INHG_PA);
  const cal = { vePoints, ve, cdAFull };
  cache.set(spec, cal);
  return cal;
}

/** Air the cylinders take in (kg/s) at a manifold pressure (inHg) and charge temperature (°C). */
export function engineAirFlow(
  spec: EngineSpec,
  ve: (rpm: number) => number,
  rpm: number,
  map: number,
  chargeC: number,
  exhaust: number,
) {
  if (rpm <= 0) return 0;
  const rho = (map * INHG_PA) / (R_AIR * (chargeC + 273.15));
  return (
    ve(rpm) * residualFactor(spec.geometry.compressionRatio, map, exhaust) * rho * ((displacementM3(spec) * rpm) / 120)
  );
}

/**
 * Open area of a butterfly throttle as a fraction of wide open, for a control position 0 (idle stop) … 1 (full).
 * A plate at angle φ from closed uncovers ∝ 1 − cos φ; the idle stop leaves a small leak.
 */
export function throttleArea(pos: number, idle: number) {
  const phi = Math.max(0, Math.min(1, pos)) * (Math.PI / 2);
  return idle + (1 - idle) * (1 - Math.cos(phi));
}

/** Effective area of restrictions in series (1/A² adds). */
export const series = (...a: number[]) => 1 / Math.sqrt(a.reduce((s, x) => s + 1 / Math.max(x, 1e-9) ** 2, 0));

/** Manifold pressure (inHg) where throttle flow equals engine demand; also returns that air flow (kg/s). */
export function solveManifold(
  spec: EngineSpec,
  cal: InductionCal,
  cdA: number,
  sourceInHg: number,
  sourceC: number,
  rpm: number,
  exhaust: number,
) {
  const t0 = sourceC + 273.15;
  if (rpm <= 1) return { map: sourceInHg, air: 0 };
  let lo = 0.02 * sourceInHg,
    hi = sourceInHg;
  for (let i = 0; i < 36; i++) {
    const m = (lo + hi) / 2;
    const thr = orificeFlow(cdA, sourceInHg * INHG_PA, t0, m * INHG_PA);
    const eng = engineAirFlow(spec, cal.ve, rpm, m, sourceC, exhaust);
    if (thr > eng) lo = m;
    else hi = m;
  }
  const map = (lo + hi) / 2;
  return { map, air: engineAirFlow(spec, cal.ve, rpm, map, sourceC, exhaust) };
}
