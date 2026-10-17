/**
 * Brake power from the manufacturer's performance charts, and what the charts leave out (friction and pumping), so the
 * engine model can change the combustion part (mixture, ignition, a dead cylinder) and keep the rest.
 *
 * Lycoming's method (IOM Appendix C, Figure C-1 notes 1–4): find A on the full-throttle altitude curve for the rpm
 * and manifold pressure, B on the sea-level curve, carry B to C at sea level, and read the power at the actual
 * altitude D on the straight line A–C; then correct for inlet air temperature with √((460 + Ts) / (460 + T)).
 * The altitude chart's abscissa is linear in density ratio, so "straight line" means straight in 1 − σ.
 *
 * Continental's form (`performance.kind: "continental"`, the TSIO-550-K's M-18 Figure 2-37): curved sea-level lines of
 * brake hp against absolute manifold pressure and no altitude chart. The chart's reference conditions are at the
 * throttle inlet and exhaust exit (M-18 Table 2-2 note 1), so manifold pressure alone sets the power, corrected about
 * 1 % per 6 °F of compressor-inlet temperature. Above `fullRichAboveInHg` the chart is at full rich, at or below it at
 * best power.
 */
import type { ContinentalLine, ContinentalPerformance, EngineSpec, SeaLevelLine } from "../types";
import { atmosphere, cToF, HP_W, INHG_PA, sigmaStd } from "./atmosphere";
import { mixturePower } from "./mixture";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SIGMA_20K = sigmaStd(20000);
const P0 = 29.92126;

/** The chart's sea-level rpm lines in Lycoming's form; a Continental chart is read by `seaLevelHpContinental`. */
export function seaLevelLines(spec: EngineSpec): SeaLevelLine[] {
  const p = spec.performance;
  if (p.kind !== "lycoming")
    throw new Error(`${spec.id}: a ${p.kind} performance chart has no Lycoming sea-level lines`);
  return p.lines;
}

/** The spec's Continental chart, or undefined for a Lycoming chart. */
export const continentalChart = (spec: EngineSpec): ContinentalPerformance | undefined =>
  spec.performance.kind === "continental" ? spec.performance : undefined;

/** Brake hp on one Continental rpm line: straight between the digitized points, extended past the ends. */
function onCurve(l: ContinentalLine, map: number) {
  const P = l.points;
  let i = 1;
  while (i < P.length - 1 && map > P[i][0]) i++;
  const [a, b] = [P[i - 1], P[i]];
  return a[1] + ((b[1] - a[1]) * (map - a[0])) / (b[0] - a[0]);
}

/** Sea-level brake hp on the Continental chart (M-18 Figure 2-37): linear in rpm between lines, extrapolated. */
export function seaLevelHpContinental(spec: EngineSpec, rpm: number, map: number) {
  const L = continentalChart(spec)!.lines;
  let i = 0;
  while (i < L.length - 2 && rpm > L[i + 1].rpm) i++;
  const lo = L[i],
    hi = L[i + 1];
  const f = (rpm - lo.rpm) / (hi.rpm - lo.rpm);
  return onCurve(lo, map) * (1 - f) + onCurve(hi, map) * f;
}

/**
 * Weight of the full-rich basis at a manifold pressure: 0 at or below `fullRichAboveInHg − blendInHg` (best power),
 * 1 at or above `fullRichAboveInHg + blendInHg` (full rich), linear between so the gross power has no step.
 */
export function fullRichWeight(spec: EngineSpec, map: number) {
  const k = continentalChart(spec);
  if (!k) return 0;
  if (k.blendInHg <= 0) return map > k.fullRichAboveInHg ? 1 : 0;
  return clamp((map - (k.fullRichAboveInHg - k.blendInHg)) / (2 * k.blendInHg), 0, 1);
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
 *
 * Continental form: the sea-level chart at that manifold pressure, less `tempPctPerF` % per °F that the
 * compressor-inlet air (`inletC`) is above standard at the pressure altitude (59 °F at sea level, M-18 Table 2-2
 * note 1). Above `fullRichAboveInHg` this is full-rich power, at or below it best power.
 */
export function chartHp(spec: EngineSpec, rpm: number, map: number, altFt: number, inletC: number) {
  const k = continentalChart(spec);
  if (k) {
    const dF = cToF(inletC) - cToF(atmosphere(altFt).ts);
    return seaLevelHpContinental(spec, rpm, map) * (1 - (dF * k.tempPctPerF) / 100);
  }
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
 *
 * Continental form: where the chart is at full rich, its gross is divided by the power full rich gives relative to
 * best power, `mixturePower(lambdaFullRich)`, so a cylinder running at full rich reproduces the chart. The divisor is
 * blended in with `fullRichWeight`. `lambdaFullRich` is the full-rich λ at the current air flow (fuel.ts
 * `fullRichLambdaAt`); without it the chart is taken as best power throughout. With `chargeRefC` and a charge
 * temperature `chargeC` (the intercooled manifold air), the chart's power scales by the charge's density against the
 * reference, in place of the compressor-inlet law, so the power follows the air the cylinders take (lean of peak, the
 * fuel they burn).
 */
export function grossIndicatedHp(
  spec: EngineSpec,
  rpm: number,
  map: number,
  altFt: number,
  inletC: number,
  exhaust: number,
  ve: (rpm: number) => number,
  lambdaFullRich?: number,
  chargeC?: number,
) {
  if (rpm <= 0) return 0;
  const k = continentalChart(spec);
  if (k) {
    const L = k.lines;
    const r = clamp(rpm, L[0].rpm, L[L.length - 1].rpm);
    const cal = spec.calibration;
    const fr =
      lambdaFullRich === undefined
        ? 1
        : mixturePower(lambdaFullRich, cal.lambdaBestPower, cal.peakEgtPower, cal.richMisfireLambda);
    const divisor = 1 + (fr - 1) * fullRichWeight(spec, map);
    // with a charge reference the charge's density carries the temperature effect in place of the 1 %/6 °F
    // compressor-inlet law (at a fixed pressure ratio the intercooled charge's kelvin temperature follows the inlet's:
    // ISA +30 °C costs about 9 % either way, M-18 Table 2-2 note 1)
    const chart =
      k.chargeRefC !== undefined && chargeC !== undefined
        ? (seaLevelHpContinental(spec, r, map) * (k.chargeRefC + 273.15)) / (chargeC + 273.15)
        : chartHp(spec, r, map, altFt, inletC);
    const gross = chart + frictionHp(spec, r) + pumpingHp(spec, r, map, exhaust);
    return (Math.max(0, gross) / Math.max(divisor, 0.05)) * (rpm / r) * (ve(rpm) / ve(r));
  }
  const L = seaLevelLines(spec);
  const r = clamp(rpm, L[0].rpm, L[L.length - 1].rpm);
  const gross = chartHp(spec, r, map, altFt, inletC) + frictionHp(spec, r) + pumpingHp(spec, r, map, exhaust);
  return Math.max(0, gross) * (rpm / r) * (ve(rpm) / ve(r));
}

/**
 * Lycoming fuel consumption (lb/h) at a brake hp, best-power or best-economy mixture: the part-throttle chart where the
 * manual has one (IO-390 Figure C-3), else a constant best-power specific consumption from a published cruise point.
 * Best economy (peak EGT) then takes the same power from air the mixture model says it needs: λ at peak is 1, power
 * there `peakEgtPower` of best power, so fuel scales by λbp / peakEgtPower. A Continental chart (M-18 Figure 2-36) has
 * one curve per mixture for every rpm, read by brake hp and straight on beyond its drawn 173–262 bhp.
 */
export function chartFuelFlow(spec: EngineSpec, rpm: number, hp: number, mixture: "bestPower" | "bestEconomy") {
  const ff = spec.fuelFlow;
  if (ff.kind === "continental") return lineThrough(ff[mixture], hp);
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

/** Linear interpolation on [x, y] points increasing in x, straight on beyond the end segments. */
function lineThrough(P: [number, number][], x: number) {
  let i = 0;
  while (i < P.length - 2 && x > P[i + 1][0]) i++;
  const [x0, y0] = P[i],
    [x1, y1] = P[i + 1];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
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
