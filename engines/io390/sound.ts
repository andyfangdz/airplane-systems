import type { EngineState } from "../model/engine";
import { stability } from "../model/mixture";
import type { EngineSpec } from "../types";

/** One slot per exhaust opening, in crank order. The two banks feed a common muffler. */
export function soundLayout(spec: EngineSpec) {
  const cylinders = spec.geometry.firingOrder.map((n) => spec.geometry.cylinders.findIndex((c) => c.n === n));
  return {
    cylinders,
    leftBank: cylinders.map((i) => spec.geometry.cylinders[i].side === "L"),
    exhaustOpen: 180 - spec.geometry.valves.evo,
    blades: spec.propeller.blades,
    starterRatio: spec.accessories.starterRatio,
    ratedRpm: spec.rating.rpm,
  };
}

/** Relative work per firing at this RPM. The solver's cylinder hp already includes the fraction of cycles that burn. */
export function soundFrame(spec: EngineSpec, s: EngineState, cylinders: number[]) {
  const ratedHpPerCylinder = spec.rating.hp / cylinders.length;
  return {
    rpm: s.rpm,
    crank: s.crank,
    starter: s.starterEngaged,
    load: Math.max(0, Math.min(1, s.pct / 100)),
    pulses: cylinders.map((i) => {
      const c = s.cyl[i];
      const chance = c.plugs ? stability(c.lambda, spec.calibration.richMisfireLambda) : 0;
      const work = (c.hp * spec.rating.rpm) / (ratedHpPerCylinder * Math.max(1, s.rpm));
      return { chance, strength: chance > 0 ? Math.sqrt(Math.max(0, Math.min(1.6, work / chance))) : 0 };
    }),
  };
}
