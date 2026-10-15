/**
 * The engine's load: a constant-speed propeller. Power absorbed is Cp ρ n³ D⁵, with Cp from the blade angle of
 * attack at 75 % radius (blade angle less the helix angle of the airflow). A flyweight governor moves the blades:
 * engine oil, boosted by the governor, drives them coarse; with the oil drained they return fine (a single-acting,
 * non-counterweighted hub). Coefficients are illustrative, not Hartzell data.
 */

const D2R = Math.PI / 180;

export interface PropState {
  /** Blade angle at 75 % radius, degrees. */
  beta: number;
  /** Governor integral term. */
  integ: number;
}

/** Angle of attack at 75 % radius (deg) for blade angle β, airspeed (m/s), shaft speed (rev/s), diameter (m). */
export function attack(beta: number, v: number, n: number, d: number) {
  if (n <= 0.01) return beta - 90;
  const phi = Math.atan2(v, 0.75 * Math.PI * n * d) / D2R;
  return beta - phi;
}

/** Power coefficient. Linear in angle of attack up to a soft stall; profile drag keeps a floor. */
export function powerCoeff(alpha: number) {
  const a = Math.max(-6, Math.min(alpha, 18));
  const stall = alpha > 16 ? 0.002 * (alpha - 16) : 0;
  return Math.max(0.004, 0.012 + 0.0045 * a + stall);
}

/** Torque (N·m) the propeller absorbs. Windmilling (negative α) can drive the engine. */
export function propTorque(beta: number, v: number, rpm: number, d: number, rho: number) {
  const n = Math.max(rpm, 0) / 60;
  if (n < 0.02) return 0;
  const alpha = attack(beta, v, n, d);
  let cp = powerCoeff(alpha);
  if (alpha < -6) cp = 0.012 + 0.0045 * alpha; // windmilling
  const power = cp * rho * n ** 3 * d ** 5;
  return power / (2 * Math.PI * n);
}

/**
 * Governor: proportional-integral on speed error, rate limited by oil flow. Coarse needs governor oil pressure
 * (`oilPsi`); fine happens by draining, so it works without. Returns the new blade angle.
 */
export function governor(
  s: PropState,
  rpm: number,
  target: number,
  oilPsi: number,
  fine: number,
  coarse: number,
  dt: number,
) {
  const err = (rpm - target) / 100; // + overspeed → coarser
  s.integ = Math.max(-20, Math.min(20, s.integ + err * dt));
  let rate = 6 * err + 1.5 * s.integ; // deg/s
  const maxCoarse = 12 * Math.min(1, Math.max(0, (oilPsi - 10) / 30));
  rate = Math.max(-12, Math.min(maxCoarse, rate));
  s.beta = Math.max(fine, Math.min(coarse, s.beta + rate * dt));
  // don't wind up against a stop
  if ((s.beta <= fine && err < 0) || (s.beta >= coarse && err > 0)) s.integ *= 0.9;
  return s.beta;
}
