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
} from "./engine";
import { settle } from "./trim";

export interface Setup {
  s: EngineState;
  c: Controls;
  env: Environment;
}

export interface Scenario {
  id: string;
  label: string;
  note: string;
  run: (spec: EngineSpec, f?: Failures) => Setup;
}

/** Propeller-control position that sets the governor to `rpm`. */
export const propFor = (spec: EngineSpec, rpm: number) =>
  (rpm - spec.propeller.governorMinRpm) / (governedRpm(spec, 1) - spec.propeller.governorMinRpm);

/** Start per the IOM (throttle cracked, boost pump on, mixture rich, starter), then warm up at 1,000 rpm. */
export function warmStart(
  spec: EngineSpec,
  envPatch: Partial<Environment> = {},
  f: Failures = noFailures(spec),
): Setup {
  const env: Environment = { ...defaultEnvironment(), ...envPatch };
  const s = initialState(spec, env);
  const c: Controls = { ...defaultControls(), throttle: 0.15, mixture: 1, boost: true, mags: "START" };
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

export const SCENARIOS: Scenario[] = [
  {
    id: "cold",
    label: "Cold and stopped",
    note: "Soaked to a standard day at sea level, everything off. Prime with the boost pump and start (IOM p. 30).",
    run: (spec) => {
      const env = defaultEnvironment();
      return { s: initialState(spec, env), c: defaultControls(), env };
    },
  },
  {
    id: "idle",
    label: "Warm idle",
    note: "Started and warmed up, throttle closed. The IOM gives 600 to 700 rpm as the usual idle speed (p. 26).",
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
    note: "Warm, at 2,150 rpm with the propeller full increase. Switch to L or R and watch the drop: at most 175 rpm, within 50 rpm of each other (pp. 31–32).",
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, {}, f);
      settle(spec, x.s, x.c, x.env, f, 25, { rpm: 2150 });
      return x;
    },
  },
  {
    id: "takeoff",
    label: "Takeoff",
    note: "Full throttle, full rich, propeller full increase, sea level, 70 kt.",
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
    note: "Full throttle, full rich, 2,700 rpm at 100 kt, temperatures settled at 3,000 ft.",
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 100, altFt: 3000 }, f);
      x.c.prop = 1;
      settle(spec, x.s, x.c, x.env, f, 60, { map: 40 }, 30);
      return x;
    },
  },
  {
    id: "cruise75",
    label: "Performance cruise, 75 %",
    note: "161 hp at 2,450 rpm, leaned to best power, at 4,000 ft (IOM Table A-1, p. 39). Table A-1 gives 12.8 gph.",
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 140, altFt: 4000 }, f);
      x.c.prop = propFor(spec, 2450);
      const lambda = spec.calibration.lambdaBestPower;
      settle(spec, x.s, x.c, x.env, f, 40, { map: 23, lambda }, 30);
      holdHp(spec, x, f, 161, lambda);
      return x;
    },
  },
  {
    id: "economy65",
    label: "Economy cruise, 65 %",
    note: "140 hp at 2,350 rpm, leaned to peak EGT (best economy) at 6,000 ft (IOM Table A-1, p. 39). Table A-1 gives 9.8 gph.",
    run: (spec, f = noFailures(spec)) => {
      const x = warmStart(spec, { tasKt: 135, altFt: 6000 }, f);
      x.c.prop = propFor(spec, 2350);
      settle(spec, x.s, x.c, x.env, f, 40, { map: 22, lambda: 1 }, 30);
      holdHp(spec, x, f, 140, 1);
      return x;
    },
  },
];
