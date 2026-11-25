import type { EngineSpec } from "../types";
import { INHG_PA } from "./atmosphere";
import { mod, phaseOf, volume } from "./cycle";

/** During a start, a cylinder must take a charge and reach its firing angle before it can do work. */
export interface StartCycle {
  previousCrank: number;
  cylinders: { trappedInHg: number; mixtureWork: number; firedWork: number }[];
}

export function beginStartCycle(spec: EngineSpec, crank: number): StartCycle {
  return {
    previousCrank: crank,
    cylinders: spec.geometry.cylinders.map(() => ({ trappedInHg: 0, mixtureWork: 0, firedWork: 0 })),
  };
}

/** Events over the crank travel actually integrated in the preceding fixed step, including the 720° wrap. */
export function startingCylinder(
  spec: EngineSpec,
  cycle: StartCycle,
  index: number,
  crank: number,
  manifold: number,
  ambient: number,
  mixtureWork: number,
  ignitionEfficiency: number,
  advance: number,
) {
  const cyl = cycle.cylinders[index];
  const phase = phaseOf(spec, spec.geometry.cylinders[index].n, crank);
  const travel = mod(crank - cycle.previousCrank, 720);
  const close = 540 + spec.geometry.valves.ivc;
  const open = 180 - spec.geometry.valves.evo;
  if (mod(phase - close, 720) < travel) {
    cyl.trappedInHg = manifold;
    cyl.mixtureWork = mixtureWork;
  }
  if (mod(phase + advance, 720) < travel) cyl.firedWork = cyl.mixtureWork * ignitionEfficiency;

  let gasTorque = 0;
  if (cyl.trappedInHg > 0 && (phase >= close || phase < open)) {
    // Motored gas spring: polytropic compression followed by expansion. Torque = (p - p_case) dV/dθ.
    const v = volume(spec, phase);
    const pressure = cyl.trappedInHg * (volume(spec, close) / v) ** 1.3;
    const dVdRad = (volume(spec, phase + 0.5) - volume(spec, phase - 0.5)) * (180 / Math.PI);
    gasTorque = (pressure - ambient) * INHG_PA * dVdRad;
  }
  // Distribute the indicated work over the expansion stroke. The weight integrates to 720 degrees per cycle.
  const thrust = phase < 180 ? 2 * Math.PI * Math.sin((phase * Math.PI) / 180) : 0;
  return { work: cyl.firedWork, powerStrokeWork: cyl.firedWork * thrust, gasTorque };
}
