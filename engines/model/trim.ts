/**
 * Helpers that set an engine up the way a pilot would: hold a manifold pressure or rpm with the throttle, lean to a
 * mixture, let the temperatures settle. Used by the page's "Start from" buttons and by the tests.
 */
import type { EngineSpec } from "../types";
import { atmosphere, INHG_PA } from "./atmosphere";
import { type Controls, type EngineState, type Environment, type Failures, step } from "./engine";
import { mixtureForFlow } from "./fuel";
import { inductionCal } from "./induction";
import { turboMetering } from "./turbo";

export interface Hold {
  /** Throttle holds this manifold pressure (inHg) or this rpm. */
  map?: number;
  rpm?: number;
  /** Mixture holds this mean λ. */
  lambda?: number;
}

/** Mixture position that gives a mean λ at the current air flow (inverts the spec's fuel metering, fuel.ts). */
export function mixtureFor(spec: EngineSpec, s: EngineState, env: Environment, lambda: number, current = 1) {
  // a carburetor's mixture valve scales main and idle flow alike: step the position by the λ error
  if (spec.fuelSystem.kind === "carburetor") {
    const now = meanLambda(s);
    return Number.isFinite(now) ? Math.max(0.03, Math.min(1, current * Math.pow(now / lambda, 0.5))) : current;
  }
  const air = atmosphere(env.altFt, env.isaDevC);
  const rho = (s.inletInHg * INHG_PA) / (287.05 * (s.inletC + 273.15));
  // a turbocharged -K meters on throttle angle and deck pressure, not the air it takes (turbo.ts): ask for the λ that,
  // at the metered air and deck scale, gives this λ at the actual air
  if (spec.turbo && s.air > 0) {
    const m = turboMetering(spec, inductionCal(spec).ve, s.rpm, s.map, s.deckInHg!);
    return mixtureForFlow(spec, m.airLbH, (lambda * m.airLbH * m.scale) / s.air, rho || air.rho, m.scheduleLbH);
  }
  return mixtureForFlow(spec, s.air, lambda, rho || air.rho);
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
    if (hold.lambda !== undefined && s.air > 1) c.mixture = mixtureFor(spec, s, env, hold.lambda, c.mixture);
    step(spec, s, c, env, f, dt, thermal);
  }
  return s;
}

/** Mean λ across cylinders that are getting fuel. */
export const meanLambda = (s: EngineState) => {
  const l = s.cyl.map((c) => c.lambda).filter(Number.isFinite);
  return l.length ? l.reduce((a, b) => a + b, 0) / l.length : Infinity;
};
