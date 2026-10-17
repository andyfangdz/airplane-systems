/**
 * How the fuel–air ratio changes what one cylinder does, as functions of the excess-air ratio λ (1 = chemically
 * correct). Shapes are the textbook spark-ignition curves; the two anchors that matter for Lycoming's data are
 * set per engine: λ at the chart's "best power" mixture and the power left at peak EGT ("best economy" in the IOM).
 * Nothing here is manufacturer data.
 */

/** Stoichiometric air–fuel ratio for 100LL by mass (iso-octane is 15.1, motor gasoline 14.7). */
export const AFR_STOICH = 15.0;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The rich edge below which cycles start to misfire, λ (`calibration.richMisfireLambda` overrides it per engine). */
export const RICH_MISFIRE_LAMBDA = 0.55;

/**
 * Combustion stability, 1 = every cycle burns, 0 = misfiring (rich and lean flammability limits). Below the rich edge
 * `rich` stability falls to nothing over 0.15 of λ.
 */
export function stability(lambda: number, rich = RICH_MISFIRE_LAMBDA) {
  if (lambda <= 0) return 0;
  if (lambda < rich) return clamp01((lambda - (rich - 0.15)) / 0.15);
  if (lambda > 1.35) return clamp01((1.75 - lambda) / 0.4);
  return 1;
}

/** Indicated power relative to best-power mixture (1.0); `rich` is the rich misfire edge (`stability`). */
export function mixturePower(lambda: number, lambdaBP: number, peakPower: number, rich = RICH_MISFIRE_LAMBDA) {
  // no fuel (λ = ∞) or too lean to burn at all
  if (lambda <= 0 || stability(lambda, rich) === 0) return 0;
  let p: number;
  if (lambda <= lambdaBP) p = 1 - 1.5 * (lambdaBP - lambda) ** 2;
  else if (lambda <= 1) {
    // Hermite from (λbp, 1, flat) to (1, peakPower, slope −peakPower) so the fuel-limited lean side joins smoothly
    const h = 1 - lambdaBP,
      t = (lambda - lambdaBP) / h,
      m1 = -peakPower * h;
    p = 2 * t ** 3 - 3 * t ** 2 + 1 + (-2 * t ** 3 + 3 * t ** 2) * peakPower + (t ** 3 - t ** 2) * m1;
  } else {
    // lean of peak: all the fuel burns, so power follows fuel flow; slower burning costs a little more far lean
    p = (peakPower / lambda) * (1 - 0.8 * Math.max(0, lambda - 1.2) ** 2);
  }
  return p * stability(lambda, rich);
}

/**
 * EGT relative to peak (°F, ≤ 0). Peak at λ = 1; falls faster on the rich side (excess fuel cools the charge). The rich
 * slope puts best power (λ ≈ 0.85) at about 150 °F rich of peak, the IOM's leanest mixture for maximum-power cruise.
 */
export function egtOffset(lambda: number, rich = RICH_MISFIRE_LAMBDA) {
  const w = 0.04,
    d = lambda - 1,
    b = d < 0 ? 1310 : 600;
  const off = -b * (Math.sqrt(d * d + w * w) - w);
  // misfiring cycles send unburned charge through: the probe cools
  return off - (1 - stability(lambda, rich)) * 500;
}

/** Heat into the cylinder head relative to best power: peaks about 50 °F rich of peak EGT (λ ≈ 0.93). */
export function headHeat(lambda: number, lambdaBP: number, rich = RICH_MISFIRE_LAMBDA) {
  const shape = (l: number) => Math.exp(-(((l - 0.93) / (l < 0.93 ? 0.45 : 0.35)) ** 2));
  return (shape(lambda) / shape(lambdaBP)) * stability(lambda, rich);
}
