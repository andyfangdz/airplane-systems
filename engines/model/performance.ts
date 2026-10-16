/**
 * Brake power from the manufacturer's performance charts, and what the charts leave out (friction and pumping), so the
 * engine model can change the combustion part (mixture, ignition, a dead cylinder) and keep the rest.
 *
 * Lycoming's method (IOM Appendix C, Figure C-1 notes 1–4): find A on the full-throttle altitude curve for the rpm
 * and manifold pressure, B on the sea-level curve, carry B to C at sea level, and read the power at the actual
 * altitude D on the straight line A–C; then correct for inlet air temperature with √((460 + Ts) / (460 + T)).
 * The altitude chart's abscissa is linear in density ratio, so "straight line" means straight in 1 − σ.
 */
import type { EngineSpec, SeaLevelLine } from "../types";
import { atmosphere, cToF, HP_W, INHG_PA, sigmaStd } from "./atmosphere";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SIGMA_20K = sigmaStd(20000);
const P0 = 29.92126;

/** The chart's sea-level rpm lines: Lycoming's form, the only one the model reads so far. */
export function seaLevelLines(spec: EngineSpec): SeaLevelLine[] {
  const p = spec.performance;
  if (p.kind !== "lycoming") throw new Error(`${spec.id}: the model does not read a ${p.kind} performance chart yet`);
  return p.lines;
}

/** Brake hp on one sea-level rpm line (lines are straight in manifold pressure, extended beyond the chart). */
const onLine = (l: SeaLevelLine, map: number) => l.a[1] + ((l.b[1] - l.a[1]) * (map - l.a[0])) / (l.b[0] - l.a[0]);

/** The two chart lines bracketing `rpm` and the fraction between them (extrapolates past the ends). */
function bracket(spec: EngineSpec, rpm: number) {
  const L = seaLevelLines(spec);
  let i = 0;
  while (i < L.length - 2 && rpm > L[i + 1].rpm) i++;
  const lo = L[i],
    hi = L[i + 1];
  return { lo, hi, f: (rpm - lo.rpm) / (hi.rpm - lo.rpm) };
}

/** Full-throttle manifold pressure at sea level on each chart line (the chart's own full-throttle curve). */
export function chartFullThrottleMap(spec: EngineSpec, rpm: number) {
  const { lo, hi, f } = bracket(spec, rpm);
  return lo.ftMap + (hi.ftMap - lo.ftMap) * f;
}

/** Sea-level brake hp at best-power mixture, standard temperature (Figure C-1, sea-level panel). */
export function seaLevelHp(spec: EngineSpec, rpm: number, map: number) {
  const { lo, hi, f } = bracket(spec, rpm);
  return onLine(lo, map) * (1 - f) + onLine(hi, map) * f;
}

/** Full-throttle brake hp at a pressure altitude, standard temperature (Figure C-1, altitude panel). */
export function fullThrottleHp(spec: EngineSpec, rpm: number, altFt: number) {
  const { lo, hi, f } = bracket(spec, rpm);
  const at = (l: SeaLevelLine) => {
    const sl = onLine(l, l.ftMap);
    return sl + ((l.hp20k - sl) * (1 - sigmaStd(altFt))) / (1 - SIGMA_20K);
  };
  return at(lo) * (1 - f) + at(hi) * f;
}

/**
 * Full-throttle manifold pressure at an altitude: ambient less the induction loss, which scales with density
 * (mass flow ∝ ρ, loss ∝ ṁ²/ρ). Matches the chart at sea level by construction.
 */
export function fullThrottleMap(spec: EngineSpec, rpm: number, altFt: number) {
  const a = atmosphere(altFt);
  return a.p - (P0 - chartFullThrottleMap(spec, rpm)) * a.sigma;
}

/** The pressure altitude at which full throttle gives `map` at this rpm (point A of the chart's method). */
export function fullThrottleAltitude(spec: EngineSpec, rpm: number, map: number) {
  let lo = -5000,
    hi = 40000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fullThrottleMap(spec, rpm, mid) > map) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Brake hp from the chart at best-power mixture: rpm, manifold pressure (inHg), pressure altitude (ft) and induction
 * air temperature (°C). `rpm` should be within the chart (callers clamp it, see `grossIndicatedHp`).
 */
export function chartHp(spec: EngineSpec, rpm: number, map: number, altFt: number, inletC: number) {
  const c = seaLevelHp(spec, rpm, map);
  const hA = fullThrottleAltitude(spec, rpm, map);
  const xA = 1 - sigmaStd(hA),
    xD = 1 - sigmaStd(altFt);
  const a = fullThrottleHp(spec, rpm, hA);
  const hp = Math.abs(xA) < 1e-4 ? c : c + ((a - c) * xD) / xA;
  const tsF = cToF(atmosphere(altFt).ts),
    tF = cToF(inletC);
  return hp * Math.sqrt((460 + tsF) / (460 + tF));
}

/**
 * Friction mean effective pressure (bar): the quadratic in speed commonly used for spark-ignition engines
 * (0.97 + 0.15 N + 0.05 N², N in 1000 rpm). A modelling assumption, not Lycoming data; `visc` scales it for cold oil.
 */
export const fmepBar = (rpm: number, visc = 1) => {
  const n = rpm / 1000;
  return (0.97 + 0.15 * n + 0.05 * n * n) * Math.pow(visc, 0.15);
};

/** Displacement in m³. */
export const displacementM3 = (spec: EngineSpec) => spec.geometry.displacementIn3 * 1.6387064e-5;

/** Power (hp) of a mean effective pressure (Pa) at an rpm, four-stroke. */
export const mepHp = (spec: EngineSpec, mepPa: number, rpm: number) =>
  (mepPa * displacementM3(spec) * rpm) / 120 / HP_W;

export const frictionHp = (spec: EngineSpec, rpm: number, visc = 1) => mepHp(spec, fmepBar(rpm, visc) * 1e5, rpm);

/** Pumping loss (hp): exhaust stroke against `exhaust`, intake stroke at `map` (both inHg). */
export const pumpingHp = (spec: EngineSpec, rpm: number, map: number, exhaust: number) =>
  mepHp(spec, (exhaust - map) * INHG_PA, rpm);

/**
 * Gross indicated hp at best-power mixture: what the burning charge delivers to the pistons before friction and
 * pumping. Inside the chart's rpm range it is the chart's brake hp plus friction and pumping; outside it, the work
 * per cycle at the nearest chart rpm scales with the air each cycle takes in (volumetric efficiency).
 */
export function grossIndicatedHp(
  spec: EngineSpec,
  rpm: number,
  map: number,
  altFt: number,
  inletC: number,
  exhaust: number,
  ve: (rpm: number) => number,
) {
  if (rpm <= 0) return 0;
  const L = seaLevelLines(spec);
  const r = clamp(rpm, L[0].rpm, L[L.length - 1].rpm);
  const gross = chartHp(spec, r, map, altFt, inletC) + frictionHp(spec, r) + pumpingHp(spec, r, map, exhaust);
  return Math.max(0, gross) * (rpm / r) * (ve(rpm) / ve(r));
}

/**
 * Lycoming fuel consumption (lb/h) at a brake hp, best-power or best-economy mixture: the part-throttle chart where the
 * manual has one (IO-390 Figure C-3), else a constant best-power specific consumption from a published cruise point.
 * Best economy (peak EGT) then takes the same power from air the mixture model says it needs: λ at peak is 1, power
 * there `peakEgtPower` of best power, so fuel scales by λbp / peakEgtPower.
 */
export function chartFuelFlow(spec: EngineSpec, rpm: number, hp: number, mixture: "bestPower" | "bestEconomy") {
  const ff = spec.fuelFlow;
  if (ff.kind === "continental")
    throw new Error(`${spec.id}: the model does not read a continental fuel-flow chart yet`);
  if (ff.kind === "bsfc") {
    const bp = ff.bsfc * hp;
    const cal = spec.calibration;
    return mixture === "bestPower" ? bp : (bp * cal.lambdaBestPower) / cal.peakEgtPower;
  }
  const pts = ff[mixture];
  let i = 0;
  while (i < pts.length - 2 && rpm > pts[i + 1].rpm) i++;
  const a = pts[i],
    b = pts[i + 1];
  const base = a.base + ((b.base - a.base) * (rpm - a.rpm)) / (b.rpm - a.rpm);
  return base + ff.slope * hp;
}

/** The minimum allowable fuel flow (US gal/h) at a % of rated power, where the manual gives that curve. */
export function minimumFuelFlow(spec: EngineSpec, pct: number) {
  if (spec.fuelFlow.kind !== "bsfc") return undefined;
  const P = spec.fuelFlow.minimum.points;
  if (pct <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++)
    if (pct <= P[i][0]) return P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * (pct - P[i - 1][0])) / (P[i][0] - P[i - 1][0]);
  return P[P.length - 1][1];
}
