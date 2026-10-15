/**
 * Helpers that set an engine up the way a pilot would: hold a manifold pressure or rpm with the throttle, lean to a
 * mixture, let the temperatures settle. Used by the page's "Start from" buttons and by the tests.
 */
import type { EngineSpec } from "../types";
import { atmosphere, INHG_PA, RHO0 } from "./atmosphere";
import { type Controls, type EngineState, type Environment, type Failures, step } from "./engine";
import { IDLE_SPRING_LBH } from "./fuel";
import { AFR_STOICH } from "./mixture";

export interface Hold {
  /** Throttle holds this manifold pressure (inHg) or this rpm. */
  map?: number;
  rpm?: number;
  /** Mixture holds this mean λ. */
  lambda?: number;
}

/** Mixture position that gives a mean λ at the current air flow (inverts the servo's metering). */
export function mixtureFor(spec: EngineSpec, s: EngineState, env: Environment, lambda: number) {
  const air = atmosphere(env.altFt, env.isaDevC);
  const rho = (s.inletInHg * INHG_PA) / (287.05 * (s.inletC + 273.15));
  const far = 1 / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const want = s.air / (AFR_STOICH * lambda);
  const perUnit = s.air * far * Math.sqrt(RHO0 / Math.max(rho || air.rho, 0.2)) + IDLE_SPRING_LBH;
  return Math.max(0.03, Math.min(1, want / perUnit));
}

/** Run for `seconds` (real time for the shaft, `thermal`× for temperatures), steering the throttle and mixture. */
export function settle(
  spec: EngineSpec,
  s: EngineState,
  c: Controls,
  env: Environment,
  f: Failures,
  seconds: number,
  hold: Hold = {},
  thermal = 1,
  dt = 0.05,
) {
  for (let t = 0; t < seconds; t += dt) {
    if (hold.map !== undefined) c.throttle = Math.max(0, Math.min(1, c.throttle + (hold.map - s.map) * 0.012));
    if (hold.rpm !== undefined) c.throttle = Math.max(0, Math.min(1, c.throttle + (hold.rpm - s.rpm) * 0.00005));
    if (hold.lambda !== undefined && s.air > 1) c.mixture = mixtureFor(spec, s, env, hold.lambda);
    step(spec, s, c, env, f, dt, thermal);
  }
  return s;
}

/** Mean λ across cylinders that are getting fuel. */
export const meanLambda = (s: EngineState) => {
  const l = s.cyl.map((c) => c.lambda).filter(Number.isFinite);
  return l.length ? l.reduce((a, b) => a + b, 0) / l.length : Infinity;
};
