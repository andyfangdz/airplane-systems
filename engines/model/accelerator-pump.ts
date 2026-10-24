/**
 * Float-carburetor accelerator pump (FAA-H-8083-32B p. 2-13; MA-4-5 OI ¶3-3).
 * A spring spreads a rapid throttle opening into a decaying stroke. Slow displacement leaks back to the bowl.
 * Travel times and bypass rate are illustrative, not measured MA-4-5 calibration data.
 */
import type { Carburetor } from "../types";

export interface Pump {
  /** Plunger travel, 0 (up) … 1 (bottomed). */
  plunger: number;
  /** Fuel actually discharged into the bore this step, lb/h. */
  squirt: number;
}

const DOWN_S = 0.6;
const UP_S = 0.15;
/** Fraction of a full stroke per second that can seep back into the bowl. */
const BYPASS_PER_S = 0.12;

export function pumpStep(carb: Carburetor, p: Pump, throttle: number, dt: number, bowlLb = Infinity): Pump {
  if (!(dt > 0)) return p;
  const target = Math.max(0, Math.min(1, throttle));
  const tau = target > p.plunger ? DOWN_S : UP_S;
  const plunger = p.plunger + (target - p.plunger) * (1 - Math.exp(-dt / tau));
  // Only displacement faster than the bypass capacity leaves the bowl. Closing only refills the pump.
  const discharge = Math.max(0, plunger - p.plunger - BYPASS_PER_S * dt);
  const fuel = Math.min(carb.accelLb * discharge, Math.max(0, bowlLb));
  return { plunger, squirt: (fuel / dt) * 3600 };
}
