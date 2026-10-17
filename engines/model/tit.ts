/**
 * How far the turbine-inlet temperature is from its peak as the mixture is leaned (the monitor's "TIT pk"; SR22T POH
 * 4-22 leans by TIT, 7-35 its probes). Read off the model's own TIT path rather than an EGT shape alone: each
 * cylinder's EGT law (engine.ts: `egtBase + egtGain √load + egtOffset(λ)`, the load following the cylinder's work,
 * engine.ts `cylinderWork(λ)` with the leaning cap the engine applies, at the air it takes now) and the probes' reading
 * of the banks (turbo.ts `titTargets`: crossover, gain over outside air, offset).
 */
import type { EngineSpec } from "../types";
import { cylinderWork, ratedGrossHp, type CylState, type LeanCap } from "./engine";
import { egtOffset } from "./mixture";
import { titTargets } from "./turbo";

export interface TitFromPeak {
  /** °F the TIT would rise to its peak (0 at the peak). */
  off: number;
  /** Which side of the peak the mixture is on. */
  side: "ROP" | "LOP" | "peak";
  /** The leaning factor on every cylinder's λ that reaches the peak (above 1: leaner; below 1: richer). */
  k: number;
}

/**
 * °F below the peak TIT for the cylinders' present mixtures, and on which side of it they are: every cylinder's λ is
 * scaled by one leaning factor k at the air it takes now (the lever moved, the throttle and rpm held), its EGT follows
 * the model's law, and the probes read the banks as `titTargets` does. The reading is the mean of the two probes. A
 * cylinder that is not firing keeps its EGT. `leanCap` is the cap the engine's step put on the cylinders' work
 * (EngineState `leanCap`; absent, none), held as the lever moves: its full-rich λ and manifold pressure do not move
 * with the lever. The manifold pressure and the gross power are held too: at full throttle the turbochargers' boost
 * rises as leaning heats the exhaust, and this reading does not follow that. The outside air temperature cancels from
 * the difference; it is taken only so `titTargets` applies `titGain`. Null without a turbocharger or a burning cylinder.
 */
export function titFromPeak(
  spec: EngineSpec,
  cyl: readonly CylState[],
  leanCap?: LeanCap,
  oatF = 59,
): TitFromPeak | null {
  if (!spec.turbo) return null;
  const cal = spec.calibration,
    rich = cal.richMisfireLambda,
    nCyl = cyl.length,
    rated = ratedGrossHp(spec);
  const work = (lambda: number) => cylinderWork(spec, lambda, leanCap);
  const burning = cyl.map((c) => Number.isFinite(c.lambda) && c.work > 0.02 && work(c.lambda) > 0);
  if (!burning.some(Boolean)) return null;
  // each burning cylinder's load at its present mixture (engine.ts: hp × cylinders ÷ rated gross)
  const load = cyl.map((c) => (Math.max(c.hp, 0) * nCyl) / rated);
  const tit = (k: number) => {
    const egt = cyl.map((c, i) => {
      if (!burning[i]) return c.egt;
      const l = k * c.lambda;
      return cal.egtBase + cal.egtGain * Math.sqrt((load[i] * work(l)) / work(c.lambda)) + egtOffset(l, rich);
    });
    const [left, right] = titTargets(spec, egt, oatF);
    return (left + right) / 2;
  };
  // the factors searched reach λ 0.7 to 1.3 on every burning cylinder (at least 0.5 to 2): a mixture as rich as the
  // engine's misfire edge (λ 0.45 for the -K) needs more than 2 to reach its peak
  const lambdas = cyl.flatMap((c, i) => (burning[i] ? [c.lambda] : []));
  const lo = Math.min(0.5, 0.7 / Math.max(...lambdas)),
    hi = Math.max(2, 1.3 / Math.min(...lambdas));
  // a grid finds the peak's neighbourhood (the curve is kinked at λ = 1), then golden-section search refines it
  let best = 1;
  for (let k = lo; k <= hi + 1e-9; k += 0.005) if (tit(k) > tit(best)) best = k;
  const g = (Math.sqrt(5) - 1) / 2;
  let a = best - 0.005,
    b = best + 0.005;
  for (let i = 0; i < 30; i++) {
    const c = b - g * (b - a),
      d = a + g * (b - a);
    if (tit(c) > tit(d)) b = d;
    else a = c;
  }
  const k = (a + b) / 2;
  return { off: Math.max(0, tit(k) - tit(1)), side: k > 1.01 ? "ROP" : k < 0.99 ? "LOP" : "peak", k };
}
