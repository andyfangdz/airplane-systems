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
    idleRpm: spec.limits.idleRpm.min,
  };
}

/** Relative work per firing at this RPM. The solver's cylinder hp already includes the fraction of cycles that burn. */
export function soundFrame(spec: EngineSpec, s: EngineState, cylinders: number[]) {
  const ratedHpPerCylinder = spec.rating.hp / cylinders.length;
  return {
    rpm: s.rpm,
    crank: s.crank,
    starting: !!s.startCycle,
    starter: s.starterEngaged,
    load: Math.max(0, Math.min(1, s.pct / 100)),
    pulses: cylinders.map((i) => {
      const c = s.cyl[i];
      // At cranking speed the solver remembers the charge that actually fired. Its exhaust arrives
      // later even if the key or mixture has moved in the meantime.
      const fired = s.startCycle?.cylinders[i].firedWork;
      const chance =
        fired !== undefined ? Number(fired > 0) : c.plugs ? stability(c.lambda, spec.calibration.richMisfireLambda) : 0;
      // The torque solver blends into mean power approaching idle. Keep the individual exhaust
      // pulse at the strength of the charge that fired until that handover is complete.
      const hp = fired !== undefined && c.work > 0 ? c.hp * (fired / c.work) : c.hp;
      const work = (hp * spec.rating.rpm) / (ratedHpPerCylinder * Math.max(1, s.rpm));
      return { chance, strength: chance > 0 ? Math.sqrt(Math.max(0, Math.min(1.6, work / chance))) : 0 };
    }),
  };
}
