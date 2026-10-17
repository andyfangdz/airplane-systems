/**
 * "Start from" setups for the TSIO-550-K, following the Cirrus SR22T POH's procedures (Section 4) and cruise tables
 * (Section 5). Each runs the model the way the pilot gets there: start per POH 4-12, lean for taxi, then set the power
 * the procedure names. The targets in the notes are the POH's; whether the settled model lands on them is the
 * calibration's test (tests/tsio550k-engine.test.ts).
 *
 * Every setup starts on the ground at sea level and then moves to its altitude (the POH's maximum takeoff altitude is
 * 10,000 ft, POH 2-19). There is no propeller control; the governor holds 2,500 rpm (POH 7-32), so the setups leave
 * `prop` alone.
 */
import { atmosphere, AVGAS_LB_GAL } from "../model/atmosphere";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  type Controls,
  type EngineState,
  type Failures,
} from "../model/engine";
import { AFR_STOICH } from "../model/mixture";
// types only: engines/model/scenarios.ts lists these setups, so a value import back would be a cycle
import type { Scenario, Setup } from "../model/scenarios";
import { settle } from "../model/trim";
import type { EngineSpec } from "../types";
import { TSIO550K } from "./spec";

/** These setups are the TSIO-550-K's (its `scenariosFor` list); the general ones are for the other engines. */
export const forTsio550k = (spec: EngineSpec) => spec.id === TSIO550K.id;

/**
 * True airspeed (kt) for an indicated airspeed at a pressure altitude, taking indicated as equivalent airspeed (no
 * instrument error; compressibility is under 1 % at climb speeds below 25,000 ft).
 */
export const tasFor = (kias: number, altFt: number, isaDevC = 0) => kias / Math.sqrt(atmosphere(altFt, isaDevC).sigma);

/** Power lever "open ¼ inch" for the start (POH 4-12 step 9). The lever's travel is not published: the IO-390's
 * cracked-throttle start position, kept while the start is calibrated (running within 10 s, POH 4-12). */
const START_THROTTLE = 0.15;
/** Taxi: maximum continuous 1,000 rpm (POH 4-13); the start holds it too (POH 4-12 step 11). */
const TAXI_RPM = 1000;
/** Mixture steps when leaning for maximum rpm after the start (POH 4-12 step 13). */
const LEAN_STEP = 0.04;
/** Oil warmed to at least 100 °F before takeoff in cold weather (POH 4-14): the first flight of the day. */
const COLD_OIL_F = 100;
/** Rotation 77–80 KIAS (POH 4-18); sea level standard, so KTAS = KIAS. */
const TAKEOFF_KT = 77;
/** Full-power climb at 120 KIAS (POH 4-20, 5-28), settled at the critical altitude 18,000 ft (M-18 Table 2-2). */
const CLIMB_KIAS = 120;
const CLIMB_FT = 18000;
/** Cruise climb: 600–700 fpm at 130–140 KIAS, minimum 120 KIAS (POH 4-21). The POH gives no altitude: the cruise's. */
const CRUISE_CLIMB_KIAS = 130;
/** Cruise at 10,000 ft and 25,000 ft, standard day, 75 %: 175 and 201 KTAS (POH 5-33, 5-34). */
const CRUISE = { altFt: 10000, tasKt: 175 };
const HIGH_CRUISE = { altFt: 25000, tasKt: 201 };
const CRUISE_PCT = 75;
/** Rapid descent: manifold pressure 18–20 in.Hg (POH 4-23); the middle of the range. */
const DESCENT_MAP = 19;
/** A 0.5 gph reduction in fuel flow lowers CHT about 15 °F; the POH's leaning step when a CHT is above 420 °F (4-22). */
const LEAN_GPH = 0.5;
/** "30.5 in.Hg or less" (POH 4-22): the lever aimed this far below, so the mean stays under it. The controller's
 * hunting at part throttle still carries single readings a few tenths above. */
const LEAN_MAP_MARGIN = 0.1;

/** An optional spec field these setups need (the TSIO-550-K spec has them all). */
function need<T>(v: T | undefined, name: string): T {
  if (v === undefined) throw new Error(`The engine spec lacks ${name}; add it in engines/tsio550k/spec.ts`);
  return v;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Seconds per look at the gauges: the turbochargers, the wastegate and the governor settle in the first half. */
const LOOK_S = 30;

/** Gauge readings averaged over a look: manifold pressure (inHg), fuel and air flow (lb/h). */
interface Gauges {
  map: number;
  fuel: number;
  air: number;
}

/**
 * Run a look (temperatures `thermal`× faster) and read the gauges averaged over its second half: lean of peak at
 * cruise manifold pressure the model's engine does not sit still (rpm, manifold pressure and fuel flow swing together),
 * and a pilot reads such gauges by eye as their middle.
 */
function look(spec: EngineSpec, x: Setup, f: Failures, thermal: number): Gauges {
  settle(spec, x.s, x.c, x.env, f, LOOK_S / 2, {}, thermal);
  const n = LOOK_S / 2 / 0.25;
  const g = { map: 0, fuel: 0, air: 0 };
  for (let k = 0; k < n; k++) {
    settle(spec, x.s, x.c, x.env, f, 0.25, {}, thermal);
    g.map += x.s.map / n;
    g.fuel += x.s.fuel / n;
    g.air += x.s.air / n;
  }
  return g;
}

/**
 * Set a manifold pressure with the power lever, and optionally a fuel flow (lb/h, from the readings) with the mixture,
 * the way a pilot does: move the lever, let the turbochargers and the wastegate settle, look again. Steering the lever
 * every step (as `settle`'s hold does) chases the spool and gate lags, and leaves the engine still moving when the
 * setup ends. The first half of the looks run the temperatures fast; the last setting gets one more look.
 */
function setPower(
  spec: EngineSpec,
  x: Setup,
  f: Failures,
  map: number,
  fuel?: (g: Gauges) => number,
  looks = 10,
): Gauges {
  let prev: { throttle: number; map: number } | undefined;
  for (let i = 0; i < looks; i++) {
    const g = look(spec, x, f, i < looks / 2 ? 20 : 1);
    // the metered flow scales with the mixture valve
    if (fuel && g.fuel > 0.5) x.c.mixture = clamp((x.c.mixture * fuel(g)) / g.fuel, 0.03, 1);
    const moved = prev && x.c.throttle - prev.throttle;
    const slope = moved && Math.abs(moved) > 1e-4 ? (g.map - prev!.map) / moved : 0;
    prev = { throttle: x.c.throttle, map: g.map };
    x.c.throttle = clamp(x.c.throttle + clamp((map - g.map) / (slope > 1 ? slope : 40), -0.25, 0.25), 0, 1);
  }
  return look(spec, x, f, 1);
}

const hottestCht = (s: EngineState) => Math.max(...s.cyl.map((c) => c.cht));
const coldestCht = (s: EngineState) => Math.min(...s.cyl.map((c) => c.cht));

/** Lean until the rpm rises to a maximum and leave the mixture there for taxi (POH 4-12 step 13). */
function leanForTaxi(spec: EngineSpec, x: Setup, f: Failures) {
  let best = { mixture: x.c.mixture, rpm: x.s.rpm };
  for (let k = 1; k * LEAN_STEP < 0.9; k++) {
    x.c.mixture = 1 - k * LEAN_STEP;
    settle(spec, x.s, x.c, x.env, f, 2.5);
    if (x.s.rpm > best.rpm) best = { mixture: x.c.mixture, rpm: x.s.rpm };
    else if (x.s.rpm < best.rpm - 20) break;
  }
  x.c.mixture = best.mixture;
  settle(spec, x.s, x.c, x.env, f, 5);
}

/**
 * Start per POH 4-12 on a standard day at sea level: mixture full rich, fuel pump BOOST, power lever open ¼ inch,
 * START until the engine runs on its own (at most the 10 s cranking limit), then 1,000 rpm, lean for taxi and warm up
 * at taxi rpm. BOOST stays on (POH 4-12 leaves it; 4-14 and 4-17 keep it for takeoff and climb). With `oilF`, the
 * warm-up stops once the oil reaches it.
 */
function pohStart(spec: EngineSpec, f: Failures, oilF?: number): Setup {
  const env = defaultEnvironment();
  const s = initialState(spec, env);
  const c: Controls = { ...defaultControls(), mixture: 1, throttle: START_THROTTLE, boost: true, mags: "START" };
  // release after the engine starts: it has outrun the starter
  const free = spec.accessories.starterFreeRpm ?? 380;
  const crankS = need(spec.limits.starterMaxS, "limits.starterMaxS").value; // 10 s (POH 4-12)
  for (let t = 0; t < crankS && !(s.running && s.rpm > free); t += 0.25) settle(spec, s, c, env, f, 0.25);
  c.mags = "BOTH";
  settle(spec, s, c, env, f, 10, { rpm: TAXI_RPM });
  const x = { s, c, env };
  leanForTaxi(spec, x, f);
  if (oilF === undefined) settle(spec, s, c, env, f, 60, { rpm: TAXI_RPM }, 20);
  else for (let t = 0; t < 60 && s.oilT < oilF; t += 2) settle(spec, s, c, env, f, 2, { rpm: TAXI_RPM }, 20);
  return x;
}

/** Power lever full forward, mixture full rich, fuel pump BOOST (POH 4-14, 4-17, 4-20). */
function fullPower(x: Setup) {
  x.c.throttle = 1;
  x.c.mixture = 1;
  x.c.boost = true;
}

/**
 * Cruise per POH 4-22: power lever back to 30.5 in.Hg (leaning is approved only at or below it), mixture leaned to
 * the table's fuel flow for the % power (POH 5-32 to 5-34). Lean of peak the power follows the fuel flow, not the
 * manifold pressure (POH 4-22), so the power is the outcome; the calibration checks it against the table.
 */
function leanCruise(spec: EngineSpec, x: Setup, f: Failures, pct: number) {
  const point = need(
    spec.rating.cruise.find((p) => p.pct === pct),
    `rating.cruise ${pct} %`,
  );
  const lbh = point.gph * AVGAS_LB_GAL;
  const map = need(spec.limits.leanMaxMap, "limits.leanMaxMap").value - LEAN_MAP_MARGIN;
  x.c.mixture = 1;
  x.c.boost = false; // POH 4-22: BOOST or OFF as conditions permit
  setPower(spec, x, f, map, () => lbh);
}

export const TSIO550K_SCENARIOS: Scenario[] = [
  {
    id: "cold",
    label: "Cold and stopped",
    only: forTsio550k,
    note: () =>
      "Soaked to a standard day at sea level, everything off. To start: mixture full rich, power lever full forward, fuel pump BOOST (on the first start of the day hold HIGH BOOST/PRIME for 2 seconds), power lever open ¼ inch, START. Crank for no more than 10 seconds, with 20 seconds to cool between attempts (POH 4-11, 4-12).",
    run: (spec) => {
      const env = defaultEnvironment();
      return { s: initialState(spec, env), c: defaultControls(), env };
    },
  },
  {
    id: "idle",
    label: "Warm idle",
    only: forTsio550k,
    note: () =>
      "Started, leaned at 1,000 rpm until the rpm peaks and left there for taxi (POH 4-12), power lever idle. Idle is 600 to 750 rpm (POH 4-15); taxi at no more than 1,000 rpm (POH 4-13).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      x.c.throttle = 0;
      settle(spec, x.s, x.c, x.env, f, 30, {}, 10);
      return x;
    },
  },
  {
    id: "runup",
    label: "Magneto check",
    only: forTsio550k,
    note: () =>
      "Mixture full rich, fuel pump BOOST (POH 4-14), power lever at 1,700 rpm. Switch to R, then L: the drop must not exceed 150 rpm for either magneto, and the two must not differ by more than 75 rpm (POH 4-15).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      x.c.mixture = 1;
      settle(spec, x.s, x.c, x.env, f, 25, { rpm: spec.limits.magCheckRpm.min });
      return x;
    },
  },
  {
    id: "takeoff",
    label: "Takeoff",
    only: forTsio550k,
    note: () =>
      "Power lever full forward, mixture full rich, fuel pump BOOST, sea level, 77 KIAS at rotation (POH 4-14, 4-18). About 2,500 rpm and 36.0 in.Hg, fuel flow in the green arc (POH 4-17).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      fullPower(x);
      x.env = { ...x.env, tasKt: TAKEOFF_KT };
      settle(spec, x.s, x.c, x.env, f, 20, {}, 5);
      return x;
    },
  },
  {
    id: "coldoil",
    label: "Takeoff, cold oil",
    only: forTsio550k,
    note: () =>
      "The first flight of the day: as Takeoff, with the oil warmed only to 100 °F (POH 4-14; 75 °F is the minimum for takeoff, POH 2-6). Manifold pressure may read 36.0 to 37.0 in.Hg until the oil warms (POH 4-17); above 36.5 the MAN PRESSURE caution calls for less than 36.5 (POH 3A-9).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f, COLD_OIL_F);
      fullPower(x);
      x.env = { ...x.env, tasKt: TAKEOFF_KT };
      settle(spec, x.s, x.c, x.env, f, 10);
      return x;
    },
  },
  {
    id: "climb",
    label: "Full-power climb",
    only: forTsio550k,
    note: () =>
      "Power lever full forward, mixture full rich (fuel flow in the green arc), fuel pump BOOST, 120 KIAS, temperatures settled at 18,000 ft (POH 4-19, 4-20). The turbochargers hold 36.0 in.Hg to about 18,000 ft, the critical altitude (POH 4-14; M-18 Table 2-2).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      fullPower(x);
      x.env = { ...x.env, altFt: CLIMB_FT, tasKt: tasFor(CLIMB_KIAS, CLIMB_FT) };
      settle(spec, x.s, x.c, x.env, f, 60, {}, 30);
      return x;
    },
  },
  {
    id: "cruiseclimb",
    label: "Cruise climb, lean of peak",
    only: forTsio550k,
    note: () =>
      "At 10,000 ft and 130 KIAS: power lever back to 30.5 in.Hg, mixture leaned to the target fuel flow, fuel pump BOOST; lean further if any CHT is above 420 °F. Minimum 120 KIAS (POH 4-21).",
    run: (spec, f = noFailures(spec)) => {
      const maxMap = need(spec.limits.leanMaxMap, "limits.leanMaxMap").value - LEAN_MAP_MARGIN;
      const target = need(spec.calibration.lambdaTarget, "calibration.lambdaTarget");
      const x = pohStart(spec, f);
      fullPower(x);
      x.env = { ...x.env, altFt: CRUISE.altFt, tasKt: tasFor(CRUISE_CLIMB_KIAS, CRUISE.altFt) };
      // the target fuel flow: λ = lambdaTarget at the air the engine takes
      let g = setPower(spec, x, f, maxMap, (r) => r.air / (AFR_STOICH * target));
      for (let k = 0; k < 4 && hottestCht(x.s) > spec.limits.chtBestAbove75.value; k++) {
        const lbh = g.fuel - LEAN_GPH * AVGAS_LB_GAL;
        g = setPower(spec, x, f, maxMap, () => lbh, 4);
      }
      return x;
    },
  },
  {
    id: "cruise",
    label: "Cruise, 75 % at 16.4 gph",
    only: forTsio550k,
    note: () =>
      "10,000 ft, standard day, 175 KTAS: power lever at 30.5 in.Hg or less, mixture leaned to 16.4 gph, lean of peak (POH 4-22, 5-33). If a CHT goes above 420 °F, lean 0.5 gph (POH 4-23).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      x.env = { ...x.env, ...CRUISE };
      leanCruise(spec, x, f, CRUISE_PCT);
      return x;
    },
  },
  {
    id: "highcruise",
    label: "High cruise, 25,000 ft",
    only: forTsio550k,
    note: () =>
      "25,000 ft, the maximum operating altitude (POH 2-19), standard day, 201 KTAS: 75 % at 16.4 gph, power lever at 30.5 in.Hg or less (POH 4-22, 5-34). The POH's table flow is a lean-of-peak setting (5-32), but this high the model's charge air is warmer and thinner than at 10,000 ft, so 16.4 gph reads at about peak here; leaning further goes lean of peak at lower power (POH 4-22). Above 18,000 ft keep manifold pressure at 15 in.Hg or more (POH 2-6).",
    run: (spec, f = noFailures(spec)) => {
      const x = pohStart(spec, f);
      x.env = { ...x.env, ...HIGH_CRUISE };
      leanCruise(spec, x, f, CRUISE_PCT);
      return x;
    },
  },
  {
    id: "descent",
    label: "Descent",
    only: forTsio550k,
    note: () =>
      "From the 10,000 ft cruise, power lever back to 19 in.Hg (18 to 20 for a rapid descent), mixture enriched as needed to keep every CHT at 240 °F or above (POH 4-23).",
    run: (spec, f = noFailures(spec)) => {
      const minCht = need(spec.limits.chtMinDescent, "limits.chtMinDescent").value;
      const x = pohStart(spec, f);
      x.env = { ...x.env, ...CRUISE };
      leanCruise(spec, x, f, CRUISE_PCT);
      // the mixture lever stays where cruise left it; the metering follows the air, so λ stays about the same
      setPower(spec, x, f, DESCENT_MAP);
      let best = { mixture: x.c.mixture, cht: coldestCht(x.s) };
      for (let k = 0; k < 10 && best.cht < minCht && x.c.mixture < 1; k++) {
        x.c.mixture = Math.min(1, x.c.mixture + 0.05);
        setPower(spec, x, f, DESCENT_MAP, undefined, 4);
        if (coldestCht(x.s) > best.cht) best = { mixture: x.c.mixture, cht: coldestCht(x.s) };
      }
      if (x.c.mixture !== best.mixture) {
        x.c.mixture = best.mixture;
        setPower(spec, x, f, DESCENT_MAP, undefined, 4);
      }
      return x;
    },
  },
];
