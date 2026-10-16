/**
 * Ready-made starting points for the engine page ("Start from"): each one runs the model the way a pilot would get
 * there (start per the IOM, warm up, set power) and returns the settled state with the controls and environment that
 * hold it. The temperatures are run faster than real time (`settle`'s `thermal`) so they reach their steady values.
 */
import type { EngineSpec } from "../types";
import {
  defaultControls,
  defaultEnvironment,
  governedRpm,
  initialState,
  noFailures,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
  prime,
} from "./engine";
import { fullThrottleMap } from "./performance";
import { settle } from "./trim";
import { f0 } from "@/lib/format";

export interface Setup {
  s: EngineState;
  c: Controls;
  env: Environment;
}

export interface Scenario {
  id: string;
  label: string | ((spec: EngineSpec) => string);
  note: (spec: EngineSpec) => string;
  run: (spec: EngineSpec, f?: Failures) => Setup;
  /** Only for engines this is true of (carburetor icing needs a carburetor). */
  only?: (spec: EngineSpec) => boolean;
}

/** The scenarios an engine offers, and a scenario's label for it. */
export const scenariosFor = (spec: EngineSpec) => SCENARIOS.filter((sc) => !sc.only || sc.only(spec));
export const labelOf = (sc: Scenario, spec: EngineSpec) => (typeof sc.label === "string" ? sc.label : sc.label(spec));

const carbureted = (spec: EngineSpec) => spec.fuelSystem.kind === "carburetor";

/** Propeller-control position that sets the governor to `rpm`. */
export const propFor = (spec: EngineSpec, rpm: number) =>
  (rpm - spec.propeller.governorMinRpm) / (governedRpm(spec, 1) - spec.propeller.governorMinRpm);

/**
 * Start per the manual, then warm up at 1,000 rpm. Injected: throttle cracked, boost pump on, mixture rich, starter.
 * Carbureted (float type, OM p. 3-1): mixture full rich, boost pump on, throttle about a quarter open, two strokes of
 * the primer, starter.
 */
export function warmStart(
  spec: EngineSpec,
  envPatch: Partial<Environment> = {},
  f: Failures = noFailures(spec),
): Setup {
  const env: Environment = { ...defaultEnvironment(), ...envPatch };
  const s = initialState(spec, env);
  const carb = carbureted(spec);
  const c: Controls = { ...defaultControls(), throttle: carb ? 0.25 : 0.15, mixture: 1, boost: true, mags: "START" };
  if (carb) {
    s.lastThrottle = c.throttle;
    prime(spec, s, 2);
  }
  settle(spec, s, c, env, f, 3);
  c.mags = "BOTH";
  c.boost = false;
  settle(spec, s, c, env, f, 60, { rpm: 1000 }, 20);
  return { s, c, env };
}

/** Throttle for a brake horsepower at the current rpm and mixture (a few passes of manifold pressure). */
function holdHp(spec: EngineSpec, x: Setup, f: Failures, hp: number, lambda?: number) {
  for (let i = 0; i < 6; i++)
    settle(spec, x.s, x.c, x.env, f, 15, { map: x.s.map + (hp - x.s.hp) / 8.5, lambda }, i < 2 ? 20 : 1);
}

/** Cruise at a published point: hold its rpm with the propeller, its hp with the throttle, its mixture. */
function cruise(spec: EngineSpec, k: number, altFt: number, tasKt: number, f: Failures) {
  const p = spec.rating.cruise[k];
  const x = warmStart(spec, { tasKt, altFt }, f);
  x.c.prop = propFor(spec, p.rpm);
  const lambda = p.mixture === "best power" ? spec.calibration.lambdaBestPower : 1;
  const map = Math.min(fullThrottleMap(spec, p.rpm, altFt) - 0.5, 23);
  settle(spec, x.s, x.c, x.env, f, 40, { map, lambda }, 30);
  holdHp(spec, x, f, p.hp, lambda);
  return x;
}

const cruiseNote = (spec: EngineSpec, k: number, altFt: number) => {
  const p = spec.rating.cruise[k];
  const how = p.mixture === "best power" ? "leaned to best power" : "leaned to peak EGT (best economy)";
  return `${p.hp} hp at ${f0(p.rpm)} rpm, ${how}, at ${f0(altFt)} ft (${spec.refs.cruise}). The manual gives ${p.gph} gph.`;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "cold",
    label: "Cold and stopped",
    note: (spec) =>
      carbureted(spec)
        ? `Soaked to a standard day at sea level, everything off. Boost pump on, mixture rich, throttle a quarter open, prime one to three strokes, then start (${spec.refs.start}).`
        : `Soaked to a standard day at sea level, everything off. Prime with the boost pump and start (${spec.refs.start}).`,
    run: (spec) => {
      const env = defaultEnvironment();
      return { s: initialState(spec, env), c: defaultControls(), env };
    },
  },
  {
    id: "idle",
    label: "Warm idle",
    note: (spec) => {
      const L = spec.limits.idleRpm;
      return L.assumed
        ? `Started and warmed up, throttle closed. The manual leaves idle speed to the airframe maker; the model idles at about ${L.min} to ${L.max} rpm (${spec.refs.idle}).`
        : `Started and warmed up, throttle closed. The ${spec.doc} gives ${L.min} to ${L.max} rpm as the usual idle speed (${spec.refs.idle}).`;
    },
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, {}, f);
      x.c.throttle = 0;
      settle(spec, x.s, x.c, x.env, f, 30, {}, 10);
      return x;
    },
  },
  {
    id: "runup",
    label: "Magneto check",
    note: (spec) => {
      const L = spec.limits;
      return `Warm, at ${f0(magRpm(spec))} rpm with the propeller full increase. Switch to L or R and watch the drop: at most ${L.magDropMax.value} rpm, within ${L.magDiffMax.value} rpm of each other (${spec.refs.magCheck}).`;
    },
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, {}, f);
      settle(spec, x.s, x.c, x.env, f, 25, { rpm: magRpm(spec) });
      return x;
    },
  },
  {
    id: "takeoff",
    label: "Takeoff",
    note: (spec) =>
      `Full throttle, full rich, propeller full increase${carbureted(spec) ? ", carburetor heat off" : ""}, sea level, 70 kt.`,
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 70 }, f);
      x.c.prop = 1;
      settle(spec, x.s, x.c, x.env, f, 20, { map: 40 }, 5);
      return x;
    },
  },
  {
    id: "climb",
    label: "Full-power climb",
    note: (spec) => `Full throttle, full rich, ${f0(spec.rating.rpm)} rpm at 100 kt, temperatures settled at 3,000 ft.`,
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 100, altFt: 3000 }, f);
      x.c.prop = 1;
      settle(spec, x.s, x.c, x.env, f, 60, { map: 40 }, 30);
      return x;
    },
  },
  {
    id: "cruise75",
    label: (spec) => `Performance cruise, ${spec.rating.cruise[0].pct} %`,
    note: (spec) => cruiseNote(spec, 0, 4000),
    run: (spec, f = noFailures(spec)) => cruise(spec, 0, 4000, 140, f),
  },
  {
    id: "economy65",
    label: (spec) => `Economy cruise, ${spec.rating.cruise[1].pct} %`,
    note: (spec) => cruiseNote(spec, 1, 6000),
    run: (spec, f = noFailures(spec)) => cruise(spec, 1, 6000, 135, f),
  },
  {
    id: "carbice",
    label: "Carburetor icing",
    only: carbureted,
    note: (spec) =>
      `Cruise descent in cloudy, humid air: about 9 °C (standard at 3,000 ft), 80 % humidity, part throttle. Ice is building in the carburetor and manifold pressure is falling; apply full carburetor heat and open the throttle (${spec.refs.carbHeat ?? spec.doc}).`,
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 130, altFt: 3000 }, f);
      x.c.prop = propFor(spec, 2350);
      settle(spec, x.s, x.c, x.env, f, 40, { map: 19 }, 30);
      x.env.humidity = 0.8;
      settle(spec, x.s, x.c, x.env, f, 60);
      return x;
    },
  },
];

/** Magneto check speed: the middle of the manual's range. */
const magRpm = (spec: EngineSpec) => (spec.limits.magCheckRpm.min + spec.limits.magCheckRpm.max) / 2;
