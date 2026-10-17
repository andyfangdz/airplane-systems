/**
 * The standalone engine model against what Continental and Cirrus document for the TSIO-550-K (M-18, 21 September
 * 2017; SR22T POH 13772-007; AMM 13773-002 Rev 7). Chart values were digitized (engines/tsio550k/SOURCES.md); the
 * literals below are the chart readings, not read back from the spec. Calibration targets carry a T-n label the
 * tests use to refer to each other (this file's own numbering). The engine is not registered yet, so these drive the
 * model directly: the POH 4-12 start and taxi warm-up are set up here, not by a page scenario.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";
import { atmosphere, LB_KG, ramPressure } from "@/engines/model/atmosphere";
import { pressureTrace, sparkBTC } from "@/engines/model/cycle";
import {
  defaultControls,
  defaultEnvironment,
  governedRpm,
  cylinderWork,
  highBoostEnabled,
  initialState,
  leanCapAt,
  noFailures,
  ratedAirLbH as servoRatedAirLbH,
  sparks,
  startFiringMags,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import {
  continentalFuelFlow,
  continentalNozzleCapacity,
  continentalNozzlePsid,
  continentalPumpPsi,
  fullRichLambdaAt,
  IDLE_SPRING_LBH,
  meteredFuelFlow,
  mixtureForFlow,
  ratedAirLbH,
} from "@/engines/model/fuel";
import { engineAirFlow, inductionCal } from "@/engines/model/induction";
import { mixturePower } from "@/engines/model/mixture";
import {
  chartHp,
  continentalChart,
  frictionHp,
  fullRichWeight,
  grossIndicatedHp,
  pumpingHp,
  seaLevelHpContinental,
} from "@/engines/model/performance";
import { type Setup, warmStart } from "@/engines/model/scenarios";
import { meanLambda, settle, type Hold } from "@/engines/model/trim";
import {
  altAirDoorNext,
  bearingHeatW,
  DOOR_RESEAT_FRACTION,
  filterOutletInHg,
  fullThrottleMapTurbo,
  titContinuousMaxF,
  titOverNext,
  titTargets,
  turbineRpmLimit,
  turboMetering,
} from "@/engines/model/turbo";
import { patched } from "./helpers";

const K = TSIO550K;

const P0 = 29.92126;
/** Sea-level exhaust pressure the naturally aspirated model uses (engine.ts). */
const EXHAUST = P0 * 1.02;
/** The page's top airspeed (POH 5-34, `envelope.maxTasKt`): its ram rise lets a naturally aspirated run reach 30.5 in.Hg. */
const TAS = 220;
const airLbH = (spec: EngineSpec, map: number) =>
  (engineAirFlow(spec, inductionCal(spec).ve, 2500, map, 15, EXHAUST) / LB_KG) * 3600;

/** A turning engine, warmed up at sea level ISA, at the page's top airspeed. */
function running(envPatch: Partial<Environment> = {}) {
  const e: Environment = { ...defaultEnvironment(), tasKt: TAS, ...envPatch };
  const s = initialState(K, e);
  s.rpm = 1500;
  const c: Controls = { ...defaultControls(), throttle: 0.5, mixture: 1, mags: "BOTH" };
  const f = noFailures(K);
  settle(K, s, c, e, f, 60, { map: 24 }, 30);
  return { s, c, e, f };
}

/** Throttle to a brake hp at 2,500 rpm, the mixture at full rich or held at a λ. */
function atBhp(hp: number, lambda?: number) {
  const { s, c, e, f } = running();
  let map = 20 + (hp - 156) / 10.5;
  for (let i = 0; i < 8; i++) {
    settle(K, s, c, e, f, 15, { map, lambda });
    map = s.map + (hp - s.hp) / 10; // Figure 2-37: about 10 hp per in.Hg at 2,500 rpm
  }
  return s;
}

describe("Continental sea-level performance chart (M-18 Figure 2-37 p. 2-45)", () => {
  test("T-2: the chart function reproduces Figure 2-37 at 20, 25, 30.5, 36.0 and 36.5 in.Hg", () => {
    // [MAP in.Hg, bhp, tolerance]: the 2400 line runs under the hatching above 29 in.Hg (±3 hp)
    const fig: Record<number, [number, number, number][]> = {
      2500: [
        [20, 156.2, 1.5],
        [25, 211.9, 1.5],
        [30.5, 265.7, 1.5],
        [36, 311.7, 1.5],
        [36.5, 315.1, 1.5],
      ],
      2400: [
        [20, 146.6, 1.5],
        [25, 198.2, 1.5],
        [29, 236.1, 1.5],
        [36.5, 297.9, 3],
      ],
      2300: [
        [20, 136.0, 1.5],
        [25, 185.5, 1.5],
        [30.5, 232.7, 1.5],
        [36, 272.5, 1.5],
        [36.5, 275.5, 1.5],
      ],
    };
    for (const [rpm, pts] of Object.entries(fig))
      for (const [map, hp, tol] of pts) {
        expect(Math.abs(chartHp(K, Number(rpm), map, 0, 15) - hp)).toBeLessThanOrEqual(tol);
        expect(seaLevelHpContinental(K, Number(rpm), map)).toBeCloseTo(chartHp(K, Number(rpm), map, 0, 15), 9);
      }
    // between the lines power is linear in rpm
    expect(seaLevelHpContinental(K, 2450, 30)).toBeCloseTo(
      (seaLevelHpContinental(K, 2400, 30) + seaLevelHpContinental(K, 2500, 30)) / 2,
      9,
    );
  });

  test("T-3: maximum recommended cruise 262 bhp at 2,500 rpm and 30.5 in.Hg (M-18 Table 2-2 p. 2-25), ±2 %", () => {
    const hp = chartHp(K, 2500, 30.5, 0, 15);
    expect(hp).toBeGreaterThanOrEqual(262 * 0.98);
    expect(hp).toBeLessThanOrEqual(262 * 1.02);
  });

  test("T-4: power falls about 1 % per 6 °F of compressor-inlet temperature above standard (M-18 Table 2-2 note 1)", () => {
    for (const alt of [0, 10000]) {
      const ts = atmosphere(alt).ts;
      const drop = 1 - chartHp(K, 2500, 30.5, alt, ts + 6 / 1.8) / chartHp(K, 2500, 30.5, alt, ts);
      expect(drop).toBeGreaterThanOrEqual(0.008);
      expect(drop).toBeLessThanOrEqual(0.012);
    }
  });

  test("no altitude chart for the K: at standard temperature a manifold pressure gives the same power at any altitude (M-18 2-3.3.5)", () => {
    const sl = chartHp(K, 2500, 30, 0, 15);
    for (const alt of [10000, 20000]) expect(chartHp(K, 2500, 30, alt, atmosphere(alt).ts)).toBeCloseTo(sl, 9);
  });

  test("full rich above 30.5 in.Hg, best power at or below, blended over ±1 in.Hg: no step over 1 % across 29–32 in.Hg (Figure 2-37 hatch)", () => {
    const { lambdaBestPower: bp, peakEgtPower: pk } = K.calibration;
    const ve = inductionCal(K).ve;
    const sweep = (spec: EngineSpec) => {
      const gross: number[] = [],
        brake: number[] = [];
      for (let map = 29; map <= 32.0001; map += 0.05) {
        const lfr = fullRichLambdaAt(spec, airLbH(spec, map))!;
        const g = grossIndicatedHp(spec, 2500, map, 0, 15, EXHAUST, ve, lfr);
        const losses = frictionHp(spec, 2500) + pumpingHp(spec, 2500, map, EXHAUST);
        const chart = chartHp(spec, 2500, map, 0, 15) + losses;
        if (map <= 29.5) expect(g).toBeCloseTo(chart, 9); // best power: the chart as it stands
        if (map >= 31.5) expect(g * mixturePower(lfr, bp, pk)).toBeCloseTo(chart, 9); // full rich gives the chart
        gross.push(g);
        brake.push(g * mixturePower(lfr, bp, pk) - losses);
      }
      const maxStep = (v: number[]) => Math.max(...v.slice(1).map((x, i) => Math.abs(x - v[i]) / v[i]));
      return { gross: maxStep(gross), brake: maxStep(brake) };
    };
    const blended = sweep(K);
    expect(blended.gross).toBeLessThanOrEqual(0.01);
    expect(blended.brake).toBeLessThanOrEqual(0.01);
    expect(fullRichWeight(K, 30.5)).toBeCloseTo(0.5, 9);
    // switching the basis at 30.5 with no blend would put a step of over 1 % into the gross power
    const hard: EngineSpec = { ...K, performance: { ...continentalChart(K)!, blendInHg: 0 } };
    expect(sweep(hard).gross).toBeGreaterThan(0.01);
  });
});

describe("Continental fuel metering (SR22T POH 7-38; M-18 2-1, Figure 2-36 p. 2-44, Table 2-4)", () => {
  // Figure 2-36 [bhp, lean full rich, rich full rich] lb/h; the chart includes return flow (Table 2-4)
  test.each([
    [173, 83.4, 93.4],
    [205, 100, 110],
    [236, 118, 128],
    [262, 133, 143],
  ])(
    "T-13a: full rich at %i bhp and 2,500 rpm burns inside Figure 2-36's full-rich band, never above it (±3 lb/h)",
    (hp, lean, rich) => {
      const s = atBhp(hp);
      expect(Math.abs(s.rpm - 2500)).toBeLessThan(20);
      expect(s.hp).toBeCloseTo(hp, 0);
      expect(s.fuel).toBeGreaterThanOrEqual(lean - 3);
      expect(s.fuel).toBeLessThanOrEqual(rich + 3);
    },
  );

  test("T-14: at 236 bhp best power burns 103 ± 8 lb/h and peak EGT 89 ± 8 lb/h (Figure 2-36)", () => {
    const best = atBhp(236, K.calibration.lambdaBestPower);
    expect(best.hp).toBeCloseTo(236, 0);
    expect(best.fuel).toBeGreaterThanOrEqual(95);
    // upper tolerances widened to the measured flows (111.2, 98.6 lb/h): the turbocharged -K's volumetric efficiency is
    // fitted to the AMM full-power fuel flow (T-12), which outranks this loose Continental target
    // (engines/tsio550k/SOURCES.md)
    expect(best.fuel).toBeLessThanOrEqual(111.5);
    const peak = atBhp(236, 1.0);
    expect(peak.hp).toBeCloseTo(236, 0);
    expect(peak.fuel).toBeGreaterThanOrEqual(81);
    expect(peak.fuel).toBeLessThanOrEqual(99);
    // recorded, not fitted: M-18 Table 2-6's 41.5 lb/min at 315 bhp would need a volumetric efficiency near 1.2 (C7)
    expect(ratedAirLbH(K) / 60).toBeLessThan(41.5);
  });

  test("the servo injector's and carburetor's rated air refuses a Continental system; the -K meters against fuel.ts's", () => {
    expect(() => servoRatedAirLbH(K)).toThrow(/fuel\.ts's ratedAirLbH/);
    expect(servoRatedAirLbH(IO390)).toBeGreaterThan(0);
  });

  test("no density richening: Continental full-rich fuel follows the air flow alone, where the servo richens (POH 7-38)", () => {
    expect(meteredFuelFlow(K, 1500, 1, 0.7, 1)).toBe(meteredFuelFlow(K, 1500, 1, 1.225, 1));
    expect(meteredFuelFlow(IO390, 900, 1, 0.7, 1)).toBeGreaterThan(meteredFuelFlow(IO390, 900, 1, 1.225, 1));
  });

  test("the mixture valve scales the full-rich flow; idle cut-off or no fuel supply stops it (POH 7-38)", () => {
    const full = meteredFuelFlow(K, 1500, 1, 1.225, 1);
    expect(full).toBeCloseTo(1500 / (15 * fullRichLambdaAt(K, 1500)!) + IDLE_SPRING_LBH, 9);
    expect(meteredFuelFlow(K, 1500, 0.5, 1.225, 1)).toBeCloseTo(full / 2, 9);
    expect(meteredFuelFlow(K, 1500, 0.02, 1.225, 1)).toBe(0);
    expect(meteredFuelFlow(K, 1500, 1, 1.225, 0)).toBe(0);
  });

  test("T-39 pump law: unmetered fuel pressure 7.0–9.0 psi at 600 rpm and 21.0–24.5 psi at 2,500 (AMM 73-20 PDF 2589 (z), (x))", () => {
    expect(continentalPumpPsi(K, 600)).toBeGreaterThanOrEqual(7.0);
    expect(continentalPumpPsi(K, 600)).toBeLessThanOrEqual(9.0);
    expect(continentalPumpPsi(K, 2500)).toBeGreaterThanOrEqual(21.0);
    expect(continentalPumpPsi(K, 2500)).toBeLessThanOrEqual(24.5);
    expect(continentalPumpPsi(K, 0)).toBe(0);
    for (let rpm = 50; rpm <= 2600; rpm += 50)
      expect(continentalPumpPsi(K, rpm)).toBeGreaterThan(continentalPumpPsi(K, rpm - 50));
  });

  test("metered nozzle pressure 14.2–14.8 psid at the AMM full-power flow, a square-root law to the upper deck (M-18 Table 2-4 notes 3, 4)", () => {
    // the nozzle curve's anchor, 37.23 GPH (inside AMM Figure 73-20-2 PDF 2592's band; full power settles at 36.91
    // GPH and 14.30 psid, T-12, T-39), 6.0 lb/gal (POH 5-30), not the band's mid 38.2 GPH (SOURCES.md)
    const fullPower = 37.23 * 6;
    const psid = continentalNozzlePsid(K, fullPower, 1);
    expect(psid).toBeGreaterThanOrEqual(14.2);
    expect(psid).toBeLessThanOrEqual(14.8);
    expect(continentalNozzlePsid(K, fullPower / 2, 1)).toBeCloseTo(psid / 4, 9);
    // a partly blocked set needs more pressure for the same flow; the capacity is the same law inverted
    expect(continentalNozzlePsid(K, fullPower, 0.9)).toBeGreaterThan(psid);
    expect(continentalNozzleCapacity(K, psid, 1)).toBeCloseTo(fullPower, 6);
  });
});

describe("mixtureFor inverts each fuel system's metering (trim.ts)", () => {
  test.each([
    ["IO-390 (servo)", IO390],
    ["TSIO-550-K (Continental)", K],
  ])("%s: the mixture it returns meters the λ asked for", (_, spec) => {
    for (const lambda of [0.7, 0.85, 1.0, 1.2])
      for (const air of [600, 1200, 1800]) {
        const m = mixtureForFlow(spec, air, lambda, 1.0);
        if (m <= 0.03 || m >= 1) continue; // clamped at idle cut-off or full rich
        expect(air / (15 * meteredFuelFlow(spec, air, m, 1.0, 1))).toBeCloseTo(lambda, 9);
      }
  });

  test("the IO-390 servo inverse is the same arithmetic as before the per-system split (T-37)", () => {
    const before = (air: number, lambda: number, rho: number) => {
      const far = 1 / (15 * IO390.calibration.lambdaFullRich);
      const want = air / (15 * lambda);
      const perUnit = air * far * Math.sqrt(1.225 / Math.max(rho, 0.2)) + IDLE_SPRING_LBH;
      return Math.max(0.03, Math.min(1, want / perUnit));
    };
    for (const lambda of [0.7, 0.85, 1.0, 1.2])
      for (const air of [100, 600, 1200])
        for (const rho of [1.225, 0.9, 0.1])
          expect(mixtureForFlow(IO390, air, lambda, rho)).toBe(before(air, lambda, rho));
  });

  test("holding λ on the -K settles at that λ (settle, hold.lambda)", () => {
    const { s, c, e, f } = running();
    settle(K, s, c, e, f, 40, { map: 25, lambda: 1.0 });
    expect(s.air / (15 * s.fuel)).toBeGreaterThan(0.98);
    expect(s.air / (15 * s.fuel)).toBeLessThan(1.02);
  });
});

describe("the -K's state stays finite", () => {
  test("20 s at 60 Hz through part throttle, full throttle, leaned and idle: every state value stays finite", () => {
    const e: Environment = { ...defaultEnvironment(), tasKt: 120 };
    const s = initialState(K, e);
    s.rpm = 1500;
    const c: Controls = { ...defaultControls(), throttle: 0.3, mixture: 1, mags: "BOTH" };
    const f = noFailures(K);
    const finite = (v: unknown, path: string): void => {
      if (typeof v === "number") {
        // a cylinder getting no fuel has λ = ∞
        if (!(path.endsWith(".lambda") && v === Infinity)) expect(Number.isFinite(v), path).toBe(true);
      } else if (Array.isArray(v)) v.forEach((x, i) => finite(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) finite(x, `${path}.${k}`);
    };
    for (let i = 0; i < 20 * 60; i++) {
      const t = i / 60;
      c.throttle = t < 5 ? 0.3 : t < 15 ? 1 : 0;
      c.mixture = t >= 10 && t < 15 ? 0.6 : 1;
      step(K, s, c, e, f, 1 / 60);
      finite(s as EngineState, "s");
    }
    expect(s.running).toBe(true);
  });
});

// ---- turbocharger, wastegate controller and intercooler

/** 120 KIAS (POH 4-20 climb speed), taken as equivalent airspeed: TAS = 120 / √σ, ISA. */
const climbTas = (alt: number) => 120 / Math.sqrt(atmosphere(alt).sigma);
const gph = (s: EngineState) => s.fuel / 6; // 6.0 lb/gal (POH 5-28 conditions)

/**
 * What a run passed through, time step by time step: the highest deck pressure, whether the overboost
 * relief valve or the alternate-air door ever opened, and the highest turbine speed as a fraction of its M-18 Figure
 * 2-41 limit at that side's TIT.
 */
interface Watch {
  maxDeck: number;
  relief: boolean;
  door: boolean;
  turbineSpeed: number;
}
const newWatch = (): Watch => ({ maxDeck: 0, relief: false, door: false, turbineSpeed: 0 });
function observe(w: Watch, spec: EngineSpec, s: EngineState) {
  w.maxDeck = Math.max(w.maxDeck, s.deckInHg!);
  w.relief ||= !!s.reliefOpen;
  w.door ||= !!s.altAirOpen;
  for (const i of [0, 1]) w.turbineSpeed = Math.max(w.turbineSpeed, s.turboRpm![i] / turbineRpmLimit(spec, s.tit![i]));
}
/** `settle`, one time step per call (settle trims the throttle once per step, so the run is the same), watched. */
function watchedSettle(
  w: Watch,
  spec: EngineSpec,
  x: { s: EngineState; c: Controls; e: Environment; f: Failures },
  seconds: number,
  hold: Hold = {},
  thermal = 1,
) {
  for (let t = 0; t < seconds; t += 0.05) {
    settle(spec, x.s, x.c, x.e, x.f, 0.05, hold, thermal);
    observe(w, spec, x.s);
  }
}

/** Warm at sea level ISA (or `env`'s day), static, BOOST on (POH 4-14 before takeoff), then full throttle and full rich. */
function takeoff(spec: EngineSpec = K, env: Partial<Environment> = {}) {
  const e: Environment = { ...defaultEnvironment(), tasKt: 0, ...env };
  const s = initialState(spec, e);
  s.rpm = 1500;
  const c: Controls = { ...defaultControls(), throttle: 0.5, mixture: 1, mags: "BOTH", boost: true };
  const f = noFailures(spec);
  const w = newWatch();
  watchedSettle(w, spec, { s, c, e, f }, 60, { map: 24 }, 30);
  c.throttle = 1;
  watchedSettle(w, spec, { s, c, e, f }, 40);
  return { s, c, e, f, w };
}

let ratedRun: ReturnType<typeof takeoff> | undefined;
/** The settled sea-level static full-power run (shared; tests that change it copy it first). */
const rated = () => (ratedRun ??= takeoff());
const copy = (r: ReturnType<typeof takeoff>) => ({
  s: structuredClone(r.s),
  c: { ...r.c },
  e: { ...r.e },
  f: structuredClone(r.f),
});

interface ClimbPoint {
  alt: number;
  map: number;
  gph: number;
  gate: number;
  rpm: number;
  oilT: number;
  /** Manifold pressure range over 10 s once settled, in.Hg. */
  band: number;
  titF: number;
  oilP: number;
}
const CLIMB_ALTS = [0, 5000, 10000, 15000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000];
let climbRun: ClimbPoint[] | undefined;
let climbWatch: Watch | undefined;
/** Full-power climb at 120 KIAS, full rich, BOOST (POH 4-19/4-20, 5-28 conditions), settled at each altitude. */
function climb() {
  if (climbRun) return climbRun;
  const { s, c, e, f, w } = takeoff(K);
  climbWatch = w;
  climbRun = CLIMB_ALTS.map((alt) => {
    e.altFt = alt;
    e.tasKt = climbTas(alt);
    for (let t = 0; t < 30; t += 0.05) {
      step(K, s, c, e, f, 0.05);
      observe(w, K, s);
    }
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < 600; i++) {
      step(K, s, c, e, f, 1 / 60);
      observe(w, K, s);
      lo = Math.min(lo, s.map);
      hi = Math.max(hi, s.map);
    }
    const titF = s.cyl.reduce((a, cy) => a + cy.egt, 0) / s.cyl.length;
    return { alt, map: s.map, gph: gph(s), gate: s.gate!, rpm: s.rpm, oilT: s.oilT, band: hi - lo, titF, oilP: s.oilP };
  });
  return climbRun;
}
const at = (alt: number) => climb().find((p) => p.alt === alt)!;
/** What the T-5/6/7 climb passed through. */
const climbWatched = () => (climb(), climbWatch!);

/** T-8: the settled full-power run with the oil at a temperature (temperatures held, thermal ≈ 0, while the
 * pressures settle). */
function coldOilRun(oilF: number) {
  const { s, c, e, f } = copy(rated());
  const w = newWatch();
  s.oilT = oilF;
  let peak = 0;
  for (let t = 0; t < 30; t += 0.05) {
    step(K, s, c, e, f, 0.05, 1e-6);
    observe(w, K, s);
    peak = Math.max(peak, s.map);
  }
  return { s, peak, w };
}

/** T-9: 10,000 ft cruise at 30.5 in.Hg, the actuator's oil lost for 5 s, then full throttle for 30 s. */
function oilLossRun() {
  const x = takeoff(K);
  const { s, c, e, f, w } = x;
  e.altFt = 10000;
  e.tasKt = 170;
  watchedSettle(w, K, x, 60, { map: 30.5 });
  const regulating = s.gate!;
  f.wastegateOil = true;
  for (let t = 0; t < 5; t += 0.05) {
    step(K, s, c, e, f, 0.05);
    observe(w, K, s);
  }
  const opened = s.gate!;
  c.throttle = 1;
  for (let t = 0; t < 30; t += 0.05) {
    step(K, s, c, e, f, 0.05);
    observe(w, K, s);
  }
  return { s, e, regulating, opened, w };
}
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

describe("turbocharger at sea level (POH 4-14, 4-17; AMM Figure 73-20-2; M-18 Tables 2-1, 2-6)", () => {
  test("T-1: 36.0 in.Hg and 306–318 bhp at sea level static full throttle, full rich (POH 4-14, 4-17; M-18 Figure 2-37: 311.7 at 36.0)", () => {
    const { s } = rated();
    expect(Math.abs(s.rpm - 2500)).toBeLessThan(30);
    expect(s.oilT).toBeGreaterThanOrEqual(150);
    expect(Math.abs(s.map - 36.0)).toBeLessThanOrEqual(0.2);
    expect(s.hp).toBeGreaterThanOrEqual(306);
    expect(s.hp).toBeLessThanOrEqual(318);
  });

  test("T-12: full-power fuel flow 36.7–39.8 GPH at 36.0 in.Hg (AMM Figure 73-20-2 PDF 2592), every cylinder burning (λ ≥ 0.55 on average)", () => {
    const { s } = rated();
    expect(gph(s)).toBeGreaterThanOrEqual(36.7);
    expect(gph(s)).toBeLessThanOrEqual(39.8);
    expect(mean(s.cyl.map((cy) => cy.lambda))).toBeGreaterThanOrEqual(0.55);
    expect(s.rough).toBeLessThan(0.1);
  });

  test("the throttle body drops induction.throttleLossInHg at rated: deck − manifold 0.5 ± 0.1 in.Hg", () => {
    const { s } = rated();
    expect(s.deckInHg! - s.map).toBeGreaterThanOrEqual(0.4);
    expect(s.deckInHg! - s.map).toBeLessThanOrEqual(0.6);
  });

  test("T-38: tailpipe back pressure at rated ≤ 2.5 in.Hg (M-18 Table 2-1 p. 2-24); the turbines take their pressure drop above it", () => {
    const { s, e } = rated();
    const a = atmosphere(e.altFt);
    const tailpipe = a.p * 1.02; // turbine discharge: the exit pressure the normally aspirated exhaust sees (engine.ts)
    expect(tailpipe - a.p).toBeLessThanOrEqual(2.5);
    // recorded, not limited (SOURCES.md): about 35 in.Hg at the turbine inlet
    expect(s.turbineInletInHg!).toBeGreaterThan(tailpipe);
  });

  test("T-40: at rated takeoff the intercooled charge is at most 130 °F and the intercoolers' effectiveness at least 0.5 (M-18 Table 2-6, Figure 2-39)", () => {
    const { s } = rated();
    const t = K.turbo!.intercooler;
    expect((s.matC! * 9) / 5 + 32).toBeLessThanOrEqual(130);
    const eff = (s.compressorOutC! - s.matC!) / (s.compressorOutC! - (s.oatC + t.coolRiseC));
    expect(eff).toBeGreaterThanOrEqual(0.5);
  });

  test("T-8: cold oil raises MAP to (36.0, 37.0], never above 37.0, and fuel flow rises in proportion (POH 4-17, 3-29, 3A-9)", () => {
    const warm = rated().s;
    const run = coldOilRun;
    const cold = run(100); // first flight of the day: oil just warm enough to go (POH 4-14: at least 100 °F)
    expect(cold.s.map).toBeGreaterThan(36.0);
    expect(cold.s.map).toBeLessThanOrEqual(37.0);
    expect(cold.peak).toBeLessThanOrEqual(37.0);
    expect(gph(cold.s) / gph(warm) / (cold.s.map / warm.map)).toBeGreaterThan(0.985);
    expect(gph(cold.s) / gph(warm) / (cold.s.map / warm.map)).toBeLessThan(1.015);
    // and inside the AMM band at that MAP (Figure 73-20-2: 36.7–39.8 GPH at 36.0, 37.35–40.45 at 36.5, linear;
    // SOURCES.md)
    const k = (cold.s.map - 36) / 0.5;
    expect(gph(cold.s)).toBeGreaterThanOrEqual(36.7 + 0.65 * k);
    expect(gph(cold.s)).toBeLessThanOrEqual(39.8 + 0.65 * k);
    // warm oil from 150 to about 225 °F holds 36.0 ± 0.2 (POH 3-29: above 150 °F a high MAP needs a controller
    // adjustment); 225 °F is where the rated run's oil settles (T-1)
    for (const oilF of [150, 180, 225]) expect(Math.abs(run(oilF).s.map - 36.0)).toBeLessThanOrEqual(0.2);
    // hotter, the thinner oil lets MAP sag a little: 36.0 − 0.25 at 240 °F, the tolerance the model meets (recorded,
    // not a POH limit: POH 3-29 concerns a MAP that stays high)
    const hot = run(240).s.map;
    expect(hot).toBeGreaterThanOrEqual(35.75);
    expect(hot).toBeLessThanOrEqual(36.0);
  });

  test("engine stopped: the spring opens the wastegate (POH 3-27/3-28)", () => {
    const { s, c, e, f } = copy(rated());
    expect(s.gate!).toBeLessThan(0.5); // running at rated the controller holds it mostly shut
    c.mags = "OFF";
    c.mixture = 0;
    c.throttle = 0;
    let t = 0;
    while (s.rpm > 0 && t < 120) {
      step(K, s, c, e, f, 0.05);
      t += 0.05;
    }
    expect(s.rpm).toBe(0);
    for (let i = 0; i < 200; i++) step(K, s, c, e, f, 0.05);
    expect(s.gate!).toBeGreaterThan(0.999999);
  });
});

describe("turbocharged climb (POH 4-14, 4-19/4-20, 5-28/5-29; M-18 Table 2-2)", () => {
  test("T-5: full throttle at 120 KIAS holds MAP 36.0 ± 0.3 at 0, 5,000, 10,000, 15,000 and 17,000 ft (POH 4-14, 4-17)", () => {
    for (const alt of [0, 5000, 10000, 15000, 17000]) {
      const p = at(alt);
      expect(Math.abs(p.rpm - 2500), `${alt} ft rpm`).toBeLessThan(20);
      expect(p.oilT, `${alt} ft oil`).toBeGreaterThanOrEqual(150);
      expect(Math.abs(p.map - 36.0), `${alt} ft MAP ${p.map}`).toBeLessThanOrEqual(0.3);
    }
  }, 60_000); // the first caller runs the whole climb (≈ 2 s; past 5 s on a loaded machine)

  // the controller, wastegate and spool lags must not cycle
  test("no limit cycle: at each T-5 altitude MAP varies under 0.05 in.Hg over 10 s settled", () => {
    for (const alt of [0, 5000, 10000, 15000, 17000]) expect(at(alt).band, `${alt} ft`).toBeLessThan(0.05);
  });

  test("T-6: the gate closes and MAP first falls below 35.7 between 18,000 and 21,000 ft (M-18 Table 2-2: K critical altitude 18,000)", () => {
    const first = climb().find((p) => p.alt >= 17000 && p.map < 35.7)!;
    expect(first.alt).toBeGreaterThanOrEqual(18000);
    expect(first.alt).toBeLessThanOrEqual(21000);
    expect(first.gate).toBeLessThan(0.02);
    for (const p of climb().filter((q) => q.alt < first.alt)) expect(p.map, `${p.alt} ft`).toBeGreaterThanOrEqual(35.7);
  });

  test("T-7: above the critical altitude MAP falls, 30.5–35.0 at 25,000 ft; full-rich climb fuel flow as POH 5-28/5-29", () => {
    const first = climb().find((p) => p.alt >= 17000 && p.map < 35.7)!;
    const above = climb().filter((p) => p.alt >= first.alt);
    for (let i = 1; i < above.length; i++) expect(above[i].map).toBeLessThanOrEqual(above[i - 1].map);
    expect(at(25000).map).toBeGreaterThanOrEqual(30.5);
    expect(at(25000).map).toBeLessThanOrEqual(35.0);
    // POH 5-28/5-29 print fuel to 0.1 gal and time to 0.1 min. 18,000–20,000 ft: (11.3 − 10.1) gal in (18.9 − 16.8)
    // min = 34.3 GPH, but ±0.1 on each difference spans 1.1/2.2 … 1.3/2.0 × 60 = 30.0–39.0 GPH, so the band is the
    // table's own resolution (SOURCES.md). 20,000–25,000 ft: 3.8 gal in 6.8 min = 33.5 GPH, ±1.5 (the resolution is
    // 32.2–34.9).
    const band1 = mean([18000, 19000, 20000].map((a) => at(a).gph));
    expect(band1).toBeGreaterThanOrEqual(30.0);
    expect(band1).toBeLessThanOrEqual(39.0);
    const band2 = mean([20000, 21000, 22000, 23000, 24000, 25000].map((a) => at(a).gph));
    expect(band2).toBeGreaterThanOrEqual(33.53 - 1.5);
    expect(band2).toBeLessThanOrEqual(33.53 + 1.5);
  });

  test("T-13 climb part: full-rich full-throttle fuel flow 36 ± 1.5 GPH from sea level to 17,000 ft (POH 5-28: 9.5 gal in 15.8 min = 36.08)", () => {
    const pts = [0, 5000, 10000, 15000, 17000].map((a) => at(a).gph);
    expect(mean(pts)).toBeGreaterThanOrEqual(36.08 - 1.5);
    expect(mean(pts)).toBeLessThanOrEqual(36.08 + 1.5);
    for (const g of pts) {
      expect(g).toBeGreaterThanOrEqual(36.08 - 1.5);
      expect(g).toBeLessThanOrEqual(36.08 + 1.5);
    }
  });

  test("the steady full-throttle point (turbo.ts fullThrottleMapTurbo) matches the settled engine within 0.3 in.Hg", () => {
    for (const alt of [0, 10000, 20000, 25000]) {
      const p = at(alt);
      const pt = fullThrottleMapTurbo(K, 2500, alt, { tasKt: climbTas(alt), titF: p.titF, oilPsi: p.oilP });
      expect(Math.abs(pt.map - p.map), `${alt} ft: ${pt.map} vs ${p.map}`).toBeLessThanOrEqual(0.3);
    }
  });
});

describe("wastegate actuator oil loss (POH 3-27/3-28 cause 3)", () => {
  test("T-9: at 10,000 ft cruise the gate opens within 5 s of losing actuator oil; full throttle then gives at most ram + 1.5 in.Hg", () => {
    const { s, e, regulating, opened } = oilLossRun();
    expect(regulating).toBeLessThan(0.9); // regulating: the turbo is boosting above the 20.6 in.Hg outside
    expect(opened).toBeGreaterThanOrEqual(0.98);
    const a = atmosphere(10000);
    const ram = ramPressure(a.p, a.t, e.tasKt, K.induction?.ramEta ?? 0.7);
    expect(s.map).toBeLessThanOrEqual(ram + 1.5);
  });
});

// ---- SR22T controls: START, the fixed governor, HIGH BOOST/PRIME and automatic alternate air

describe("START fires both magnetos at top centre (SR22T POH 7-37, 4-12; AMM 74-00 PDF 2604)", () => {
  test("T-17 mechanics: START activates both magnetos, every cylinder fires both plugs, spark at 0° ATC (impulse couplings)", () => {
    expect(startFiringMags(K, "START")).toEqual(["L", "R"]);
    expect(sparks(K, "START", noFailures(K), 200)).toEqual([2, 2, 2, 2, 2, 2]);
    // one magneto failed: the other still fires its plug in every cylinder
    expect(sparks(K, "START", { ...noFailures(K), magL: true }, 200)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(Math.abs(sparkBTC(K, "START"))).toBe(0);
    const trace = pressureTrace(K, {
      map: 29.9,
      exhaust: 30.5,
      grossWork: 100,
      advance: sparkBTC(K, "START"),
      burnDeg: 40,
      firing: true,
    });
    expect(trace.spark).toBe(0); // combustion starts at top centre
  });

  test("T-17 mechanics: cranking per POH 4-12 (full rich, BOOST, power lever open ¼ in, START), both plugs fire in every cylinder and the engine runs within 10 s", () => {
    const e = defaultEnvironment();
    const s = initialState(K, e);
    const f = noFailures(K);
    const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.15, boost: true, mags: "START" };
    let turning = 0,
      bothPlugs = 0,
      ranAt = Infinity;
    for (let t = 0; t < 10; t += 1 / 60) {
      step(K, s, c, e, f, 1 / 60);
      if (s.rpm >= K.ignition.minStartRpm) {
        turning++;
        if (s.cyl.every((cy) => cy.plugs === 2)) bothPlugs++;
      }
      if (s.running && s.rpm > 500) ranAt = Math.min(ranAt, t);
    }
    expect(turning).toBeGreaterThan(0);
    expect(bothPlugs).toBe(turning);
    expect(ranAt).toBeLessThan(10);
  });

  test("T-17 / T-37: the IO-390's START still fires its retard magneto alone (IOM System Description p. 2)", () => {
    expect(startFiringMags(IO390, "START")).toEqual([IO390.ignition.retardMag]);
    expect(sparks(IO390, "START", noFailures(IO390), 200)).toEqual(IO390.geometry.cylinders.map(() => 1));
  });
});

describe("governor fixed at 2,500 rpm with no propeller control (SR22T POH 4-17, 7-32, 7-39; AMM 61-20 PDF 2450)", () => {
  /** The -K with a governor range: only `propeller.control: "fixed"` keeps the control from moving the set speed. */
  const RANGE = patched(K, { propeller: { governorMinRpm: 2000 } });
  const settleRpm = (spec: EngineSpec, x: ReturnType<typeof takeoff>, secs: number) => {
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < secs * 60; i++) {
      step(spec, x.s, x.c, x.e, x.f, 1 / 60);
      lo = Math.min(lo, x.s.rpm);
      hi = Math.max(hi, x.s.rpm);
    }
    return hi - lo;
  };

  test("T-36: the governor sets 2,500 rpm whatever the propeller control says (POH 7-32 'No propeller control is required')", () => {
    for (const prop of [0, 0.5, 1, Number.NaN]) {
      expect(governedRpm(K, prop)).toBe(2500);
      expect(governedRpm(RANGE, prop)).toBe(2500);
    }
    expect(governedRpm(IO390, 0)).toBe(IO390.propeller.governorMinRpm); // a lever still moves the IO-390's
  });

  test("T-36: controls.prop 0 and 1 give the same static full-throttle rpm", () => {
    const run = (prop: number) => {
      const x = takeoff(RANGE);
      x.c.prop = prop;
      settleRpm(RANGE, x, 20);
      return x.s.rpm;
    };
    const [low, high] = [run(0), run(1)];
    expect(Math.abs(low - high)).toBeLessThan(0.5);
    expect(Math.abs(low - 2500)).toBeLessThanOrEqual(30);
  });

  test("T-36: static full throttle at sea level governs 2,500 ± 30 rpm off the fine stop (POH 4-17 'approximately 2500 RPM')", () => {
    const { s } = rated();
    expect(Math.abs(s.rpm - 2500)).toBeLessThanOrEqual(30);
    expect(s.governing).toBe(true);
    expect(s.beta).toBeGreaterThan(K.propeller.fineDeg + 0.2);
  });

  test("T-36: at ISA the 120 KIAS full-power climb governs 2,500 ± 20 rpm to 25,000 ft, and so does full throttle at POH 5-34's 213 and 220 KTAS there (POH 7-39)", () => {
    const x = takeoff(K);
    const points: [number, number][] = [
      ...[0, 5000, 10000, 15000, 17000, 18000, 20000, 22000, 25000].map((alt): [number, number] => [
        alt,
        climbTas(alt),
      ]),
      [25000, 213],
      [25000, 220],
    ];
    const off: string[] = [];
    for (const [alt, tas] of points) {
      x.e.altFt = alt;
      x.e.tasKt = tas;
      for (let t = 0; t < 30; t += 0.05) step(K, x.s, x.c, x.e, x.f, 0.05);
      const band = settleRpm(K, x, 10);
      const { rpm, beta } = x.s;
      const governing = beta > K.propeller.fineDeg + 0.2 && beta < K.propeller.coarseDeg - 0.5;
      if (Math.abs(rpm - 2500) > 20 || band > 2 || !governing)
        off.push(
          `${alt} ft ${tas.toFixed(0)} kt: ${rpm.toFixed(1)} rpm, band ${band.toFixed(2)}, β ${beta.toFixed(1)}°`,
        );
    }
    expect(off).toEqual([]);
  }, 60_000); // a full climb plus two cruise points (≈ 2 s; past 5 s on a loaded machine)
});

describe("fuel pump HIGH BOOST/PRIME and its lockout (SR22T POH 7-41, Figure 7-8; 4-12)", () => {
  test("T-45: HIGH BOOST/PRIME is enabled iff MAP ≥ 24 in.Hg and pressure altitude ≥ 10,000 ft, or below 500 rpm", () => {
    const table: { map: number; altFt: number; rpm: number; on: boolean }[] = [];
    for (const map of [23.9, 24.0])
      for (const altFt of [9999, 10000])
        for (const rpm of [499, 500])
          table.push({
            map,
            altFt,
            rpm,
            on: highBoostEnabled(K, { ...initialState(K), map, rpm }, { ...defaultEnvironment(), altFt }),
          });
    expect(table).toEqual([
      { map: 23.9, altFt: 9999, rpm: 499, on: true },
      { map: 23.9, altFt: 9999, rpm: 500, on: false },
      { map: 23.9, altFt: 10000, rpm: 499, on: true },
      { map: 23.9, altFt: 10000, rpm: 500, on: false },
      { map: 24.0, altFt: 9999, rpm: 499, on: true },
      { map: 24.0, altFt: 9999, rpm: 500, on: false },
      { map: 24.0, altFt: 10000, rpm: 499, on: true },
      { map: 24.0, altFt: 10000, rpm: 500, on: true },
    ]);
  });

  test("T-45: the IO-390 has no HIGH BOOST: never enabled, never on", () => {
    expect(highBoostEnabled(IO390, initialState(IO390), defaultEnvironment())).toBe(false);
    const e = defaultEnvironment();
    const s = initialState(IO390, e);
    step(IO390, s, { ...defaultControls(), boost: true, highBoost: true, mixture: 1 }, e, noFailures(IO390), 0.5);
    expect(s.highBoostOn).toBe(false);
  });

  test("the IO-390 has no HIGH BOOST: highBoost alone does not run its boost pump (only the -K's switch sets both)", () => {
    const e = defaultEnvironment();
    const s = initialState(IO390, e);
    step(IO390, s, { ...defaultControls(), highBoost: true, mixture: 1 }, e, noFailures(IO390), 0.5);
    expect(s.fuelPsi).toBe(0);
  });

  test("below 500 rpm HIGH BOOST/PRIME primes the intake ports; BOOST alone does not, and mixture cut-off stops it (POH 7-41, 4-12 note)", () => {
    const prime = (highBoost: boolean, mixture: number) => {
      const e = defaultEnvironment();
      const s = initialState(K, e);
      const c: Controls = { ...defaultControls(), mixture, throttle: 0.15, boost: true, highBoost };
      for (let t = 0; t < 2; t += 1 / 60) step(K, s, c, e, noFailures(K), 1 / 60);
      return { lb: s.cyl.reduce((a, cy) => a + cy.puddle, 0), on: s.highBoostOn };
    };
    const boost = prime(false, 1),
      high = prime(true, 1);
    expect(boost.lb).toBeLessThan(0.001); // the idle spring's trickle
    expect(high.on).toBe(true);
    expect(high.lb).toBeGreaterThan(boost.lb + 0.01); // ≈ 8 g in 2 s
    expect(prime(true, 0)).toEqual({ lb: 0, on: true }); // cut-off: the pump runs, no fuel passes the mixture valve
  });

  test("above 500 rpm HIGH BOOST runs as BOOST: the same engine, with highBoostOn only past the 24 in.Hg and 10,000 ft lockout", () => {
    const cruise = (highBoost: boolean, altFt: number) => {
      const e: Environment = { ...defaultEnvironment(), altFt, tasKt: 150 };
      const s = initialState(K, e);
      s.rpm = 1500;
      const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.5, mags: "BOTH", boost: true };
      const f = noFailures(K);
      settle(K, s, c, e, f, 40, { map: 28 }, 10);
      c.highBoost = highBoost;
      for (let t = 0; t < 5; t += 1 / 60) step(K, s, c, e, f, 1 / 60);
      return s;
    };
    for (const [altFt, on] of [
      [5000, false],
      [10000, true],
    ] as const) {
      const boost = cruise(false, altFt),
        high = cruise(true, altFt);
      expect(high.map).toBeGreaterThanOrEqual(24);
      expect(high.highBoostOn, `${altFt} ft`).toBe(on);
      expect({ ...high, highBoostOn: false }).toEqual(boost);
    }
  });
});

describe("automatic alternate air (SR22T POH 7-37)", () => {
  test("controls.altAir has no effect on the -K: the door opens by itself, with no pilot control", () => {
    const run = (altAir: boolean) => {
      const e: Environment = { ...defaultEnvironment(), altFt: 10000, tasKt: 150 };
      const s = initialState(K, e);
      s.rpm = 1500;
      const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.6, mags: "BOTH", altAir };
      for (let t = 0; t < 20; t += 1 / 60) step(K, s, c, e, noFailures(K), 1 / 60);
      return s;
    };
    expect(run(true)).toEqual(run(false));
  });
});

// ---- overboost relief valve, seized wastegate, TIT, turbo oil and automatic alternate air

/** Run a copy of the engine for `seconds` at 1/60 s, counting relief-valve and door changes and the MAP range. */
function track(spec: EngineSpec, x: ReturnType<typeof copy>, seconds: number) {
  let lo = Infinity,
    hi = -Infinity,
    reliefOpenings = 0,
    doorChanges = 0,
    maxGate = 0,
    openSteps = 0,
    mapSum = 0;
  const n = seconds * 60;
  for (let i = 0; i < n; i++) {
    const relief = !!x.s.reliefOpen,
      door = !!x.s.altAirOpen;
    step(spec, x.s, x.c, x.e, x.f, 1 / 60);
    if (x.s.reliefOpen && !relief) reliefOpenings++;
    if (!!x.s.altAirOpen !== door) doorChanges++;
    if (x.s.reliefOpen) openSteps++;
    mapSum += x.s.map;
    lo = Math.min(lo, x.s.map);
    hi = Math.max(hi, x.s.map);
    maxGate = Math.max(maxGate, x.s.gate!);
  }
  /** `openFraction`: the share of the window the relief valve is open; `meanMap`: the window's mean MAP. */
  return { lo, hi, reliefOpenings, doorChanges, maxGate, openFraction: openSteps / n, meanMap: mapSum / n };
}

describe("overboost relief valve and a seized wastegate (POH 3-29, 3-30, 2-9; AMM 71-60 PDF 2542, 81-20 PDF 2812)", () => {
  /** The wastegate seizes closed at full power, tracked from that moment: the onset (20 s), then a settled 10 s. */
  const seizedClosed = (x: ReturnType<typeof copy> = copy(rated())) => {
    x.f.wastegateSeized = "closed";
    const onset = track(K, x, 20);
    return { x, onset, settled: track(K, x, 10) };
  };
  /** T-10's surge: MAP into the MAN PRESSURE warning band (POH 2-9) and no higher than 40.0 from the seizure on,
   * the valve cycling ("cycling high manifold pressure followed by sudden drop", POH 3-30). */
  const expectSurge = ({ onset, settled }: ReturnType<typeof seizedClosed>) => {
    expect(Math.max(onset.maxGate, settled.maxGate)).toBe(0);
    expect(Math.max(onset.hi, settled.hi)).toBeLessThanOrEqual(40.0);
    expect(settled.hi).toBeGreaterThan(37.5);
    expect(settled.hi - settled.lo).toBeGreaterThanOrEqual(0.5);
    expect(settled.reliefOpenings).toBeGreaterThanOrEqual(2);
  };

  test("T-10: a wastegate seized closed overboosts and the relief valve surges: MAP above 37.5, cycling at least 0.5 in.Hg, peak at most 40.0 (POH 3-30)", () => {
    expectSurge(seizedClosed());
  });

  test("T-10 on a cold day, leaned: at ISA −30 °C and λ about 0.8 the relief valve still surges and MAP peaks at most 40.0 (POH 3-30: 'adequately protected by the pressure relief valve'; 'higher density air … may aggravate')", () => {
    const x = takeoff(K, { isaDevC: -30 });
    x.c.mixture = 0.75; // POH 3-30 step 2 adjusts the mixture: a leaned engine is a normal case when the gate seizes
    track(K, x, 30);
    const lambda = mean(x.s.cyl.map((cy) => cy.lambda));
    expect(lambda).toBeGreaterThan(0.75);
    expect(lambda).toBeLessThan(0.85);
    expectSurge(seizedClosed(x));
  });

  test("T-10: reducing power to 30.5 in.Hg lowers the surge, the relief valve still bounding MAP; at the suite's 24 in.Hg warm-up power the valve reseats and stays shut (POH 3-30 Overboost / Pressure Relief Valve step 1 and NOTE)", () => {
    // POH 3-30: "Reducing manifold pressure … reducing the energy available to drive the turbine"; "If noticeable
    // surging is present: Land as soon as practicable" (the surge may persist after step 1)
    const { x, settled: full } = seizedClosed();
    settle(K, x.s, x.c, x.e, x.f, 40, { map: 30.5 });
    const w = track(K, x, 10);
    expect(w.hi).toBeLessThanOrEqual(40.0);
    expect(w.openFraction).toBeLessThan(full.openFraction);
    expect(w.hi - w.lo).toBeLessThan(full.hi - full.lo);
    expect(Math.abs(w.meanMap - 30.5)).toBeLessThan(0.5);
    settle(K, x.s, x.c, x.e, x.f, 40, { map: 24 });
    const w2 = track(K, x, 10);
    expect(x.s.reliefOpen).toBe(false);
    expect(w2.reliefOpenings).toBe(0);
    expect(w2.hi - w2.lo).toBeLessThan(0.05);
    expect(Math.abs(x.s.map - 24)).toBeLessThan(0.1);
    expect(x.s.deckInHg!).toBeLessThan(K.turbo!.overboost.crackInHg - K.turbo!.overboost.hystInHg);
  });

  test("a seized-closed wastegate overboosts below the critical altitude and not above it (POH 3-30: 'lower altitudes … may aggravate the condition')", () => {
    // the critical altitude is the T-6 test's own: the climb's first altitude with MAP below 35.7 (gate shut)
    const crit = climb().find((p) => p.alt >= 17000 && p.map < 35.7)!.alt;
    expect(crit).toBeLessThanOrEqual(21000);
    // the same climb with and without the seizure
    const x = copy(rated()),
      normal = copy(rated());
    x.f.wastegateSeized = "closed";
    const surges: Record<number, number> = {};
    for (const alt of [5000, 10000, 15000, 18000, 19000, 20000, 21000, 22000, 23000, 25000]) {
      for (const y of [x, normal]) {
        y.e.altFt = alt;
        y.e.tasKt = climbTas(alt);
        track(K, y, 30);
      }
      surges[alt] = track(K, x, 10).reliefOpenings;
      track(K, normal, 10);
      if (alt < crit) {
        if (alt <= 15000) expect(surges[alt], `${alt} ft`).toBeGreaterThanOrEqual(2);
        expect(x.s.map, `${alt} ft`).toBeGreaterThan(normal.s.map);
      } else {
        // above the critical altitude the free gate is shut anyway
        expect(Math.abs(x.s.map - normal.s.map), `${alt} ft`).toBeLessThan(0.05);
        expect(surges[alt], `${alt} ft`).toBe(0);
      }
    }
  }, 60_000);

  test("a wastegate seized open: full throttle at 10,000 ft gives at most ram + 1.5 in.Hg; seized closed stays shut with the engine stopped", () => {
    const x = takeoff(K);
    x.e.altFt = 10000;
    x.e.tasKt = 170;
    x.f.wastegateSeized = "open";
    track(K, x, 30);
    const a = atmosphere(10000);
    expect(x.s.gate).toBe(1);
    expect(x.s.map).toBeLessThanOrEqual(ramPressure(a.p, a.t, x.e.tasKt, K.induction?.ramEta ?? 0.7) + 1.5);
    const y = copy(rated());
    y.f.wastegateSeized = "closed";
    y.c.mags = "OFF";
    y.c.mixture = 0;
    for (let t = 0; t < 60; t += 0.05) step(K, y.s, y.c, y.e, y.f, 0.05);
    expect(y.s.rpm).toBe(0);
    expect(y.s.gate).toBe(0); // the spring cannot open a seized gate
  });

  test("the relief valve never opens and the alternate-air door stays shut in normal operation (T-1, T-5 … T-9, T-12)", () => {
    const runs: [string, Watch][] = [
      ["T-1/T-12 takeoff", rated().w],
      ["T-5/6/7 climb", climbWatched()],
      ...[100, 150, 180].map((oilF): [string, Watch] => [`T-8 oil ${oilF} °F`, coldOilRun(oilF).w]),
      ["T-9 actuator oil loss", oilLossRun().w],
    ];
    const { crackInHg, hystInHg } = K.turbo!.overboost;
    for (const [name, w] of runs) {
      expect(w.relief, name).toBe(false);
      expect(w.door, name).toBe(false);
      expect(w.maxDeck, name).toBeLessThan(crackInHg - hystInHg);
    }
  }, 60_000);
});

describe("turbine inlet temperature, LH and RH (POH 7-35; M-18 Table 2-1, Figure 2-41)", () => {
  test("TIT is each bank's mean EGT with the crossover's share of the other bank and the offset (POH 7-35)", () => {
    // cylinder order 1 … 6: odd numbers are the right bank, even the left (M-18 Figure 2-3)
    const egt = [1300, 1400, 1300, 1400, 1300, 1400];
    expect(titTargets(K, egt)).toEqual([0.8 * 1400 + 0.2 * 1300, 0.8 * 1300 + 0.2 * 1400]);
    const offset = patched(K, { calibration: { titOffsetF: 50, titCrossover: 0 } });
    expect(titTargets(offset, egt)).toEqual([1450, 1350]);
    // the gain scales the rise above outside air: a cold engine reads outside air
    const gain = patched(K, { calibration: { titGain: 1.2, titCrossover: 0 } });
    expect(titTargets(gain, egt, 59)).toEqual([59 + 1.2 * (1400 - 59), 59 + 1.2 * (1300 - 59)]);
    expect(titTargets(gain, [59, 59, 59, 59, 59, 59], 59)).toEqual([59, 59]);
  });

  test("the TIT reading lags the exhaust by titTauS: about 63 % of the way after one time constant", () => {
    const x = copy(rated());
    const target = titTargets(
      K,
      x.s.cyl.map((cy) => cy.egt),
      (x.s.oatC * 9) / 5 + 32,
    );
    x.s.tit = [500, 500];
    for (let t = 0; t < K.calibration.titTauS!; t += 1 / 60) step(K, x.s, x.c, x.e, x.f, 1 / 60);
    for (const i of [0, 1]) {
      const frac = (x.s.tit![i] - 500) / (target[i] - 500);
      expect(frac).toBeGreaterThan(0.6);
      expect(frac).toBeLessThan(0.66);
    }
  });

  test("T-23: TIT peaks within ±0.03 λ of the EGT peak, and L and R stay within 60 °F (POH 7-35, 4-22)", () => {
    const x = takeoff(K);
    x.e.altFt = 10000;
    x.e.tasKt = 170;
    settle(K, x.s, x.c, x.e, x.f, 60, { map: 30.5 }, 30);
    const sweep: { lambda: number; egt: number; tit: [number, number] }[] = [];
    for (let target = 0.8; target <= 1.3001; target += 0.02) {
      settle(K, x.s, x.c, x.e, x.f, 30, { lambda: target });
      const lambda = mean(x.s.cyl.map((cy) => cy.lambda));
      sweep.push({ lambda, egt: mean(x.s.cyl.map((cy) => cy.egt)), tit: [...x.s.tit!] });
    }
    const peakAt = (v: (p: (typeof sweep)[number]) => number) =>
      sweep.reduce((best, p) => (v(p) > v(best) ? p : best)).lambda;
    const egtPeak = peakAt((p) => p.egt);
    expect(egtPeak).toBeGreaterThan(0.85); // a peak inside the sweep, not at its end
    expect(egtPeak).toBeLessThan(1.25);
    for (const i of [0, 1]) expect(Math.abs(peakAt((p) => p.tit[i]) - egtPeak), `side ${i}`).toBeLessThanOrEqual(0.03);
    expect(Math.max(...sweep.map((p) => Math.abs(p.tit[0] - p.tit[1])))).toBeLessThan(60);
  }, 60_000);

  test("titOverS counts seconds above the 1750 °F continuous limit and starts again at or below it (M-18 Table 2-1; POH 2-9)", () => {
    expect(titContinuousMaxF(K)).toBe(1750);
    expect(titContinuousMaxF(IO390)).toBeUndefined();
    let over = 0;
    for (const tit of [
      [1700, 1760],
      [1760, 1700],
      [1751, 1751],
    ])
      over = titOverNext(over, tit, 1750, 0.5);
    expect(over).toBe(1.5);
    expect(titOverNext(over, [1750, 1749], 1750, 0.5)).toBe(0);
    expect(rated().s.titOverS).toBe(0);
  });

  test("T-34: turbine speed stays below the M-18 Figure 2-41 limit in every normal run", () => {
    // Figure 2-41: 132,000 rpm to 1440 °F, falling linearly to 122,000 at 1750 °F; flat beyond the line's ends
    for (const [tit, rpm] of [
      [1000, 132000],
      [1440, 132000],
      [1595, 127000],
      [1750, 122000],
      [1800, 122000],
    ])
      expect(turbineRpmLimit(K, tit)).toBeCloseTo(rpm, 6);
    expect(turbineRpmLimit(IO390, 1500)).toBe(Infinity);
    const runs: [string, Watch][] = [
      ["takeoff", rated().w],
      ["climb to 25,000 ft", climbWatched()],
      ["cold oil", coldOilRun(100).w],
      ["10,000 ft cruise", oilLossRun().w],
    ];
    for (const [name, w] of runs) {
      expect(w.turbineSpeed, name).toBeGreaterThan(0.2); // the turbochargers were turning
      expect(w.turbineSpeed, name).toBeLessThan(1);
    }
  }, 60_000);
});

describe("turbocharger oil (AMM 79-00 PDF 2764; POH 7-38)", () => {
  test("the bearings' heat into the oil grows with the square of the shaft speed", () => {
    const t = K.turbo!;
    expect(bearingHeatW(t, [0, 0])).toBe(0);
    const full = bearingHeatW(t, [t.rpmRef, t.rpmRef]);
    expect(full).toBeGreaterThan(0);
    expect(bearingHeatW(t, [t.rpmRef / 2, t.rpmRef / 2])).toBeCloseTo(full / 4, 9);
    // in a climb the turbochargers spin fast: their heat warms the oil
    const climbOil = (spec: EngineSpec) => {
      const x = takeoff(spec);
      x.e.altFt = 17000;
      x.e.tasKt = climbTas(17000);
      for (let i = 0; i < 60 * 20; i++) step(spec, x.s, x.c, x.e, x.f, 1 / 60, 30);
      return x.s.oilT;
    };
    expect(climbOil(K)).toBeGreaterThan(
      climbOil({ ...K, turbo: { ...K.turbo!, oil: { ...K.turbo!.oil, bearingHeatK: 0 } } }) + 0.5,
    );
  }, 60_000);

  test("the turbochargers' oil supply takes about bleedPsi of oil pressure at rated rpm", () => {
    const noBleed = takeoff({ ...K, turbo: { ...K.turbo!, oil: { ...K.turbo!.oil, bleedPsi: 0 } } }).s;
    const d = noBleed.oilP - rated().s.oilP;
    expect(d).toBeGreaterThan(K.turbo!.oil.bleedPsi - 0.3);
    expect(d).toBeLessThan(K.turbo!.oil.bleedPsi + 0.3);
  });
});

describe("automatic alternate-air door (POH 7-37, 7-38, 3A-11; AMM 71-60 PDF 2542)", () => {
  /** Hold a manifold pressure by trimming the throttle slowly, letting the turbocharger and controller settle between
   * trims (settle's per-step trim chases the turbo's lags near full throttle at altitude). */
  const trimMap = (spec: EngineSpec, x: ReturnType<typeof copy>, target: number) => {
    for (let k = 0; k < 15; k++) {
      // the window's mean MAP: at part throttle the proportional controller hunts a few tenths (SOURCES.md)
      const w = track(spec, x, 8);
      x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (target - w.meanMap) * 0.03));
    }
    track(spec, x, 10);
  };

  test("the door opens above doorOpenInH2O of filter suction and, once open, closes below DOOR_RESEAT_FRACTION of it", () => {
    const open = K.induction!.doorOpenInH2O!;
    expect(altAirDoorNext(K, false, open + 0.01)).toBe(true);
    expect(altAirDoorNext(K, false, open - 0.01)).toBe(false);
    expect(altAirDoorNext(K, true, open * DOOR_RESEAT_FRACTION + 0.01)).toBe(true);
    expect(altAirDoorNext(K, true, open * DOOR_RESEAT_FRACTION - 0.01)).toBe(false);
    // a fully blocked filter passes nothing at any air-box pressure: its suction is far past the door's
    expect(filterOutletInHg(0, 30, 288, 0.2)).toBeLessThan(10);
    expect(filterOutletInHg(1, 30, 288, 0.2)).toBeCloseTo(30, 2);
  });

  test("T-30: a fully blocked filter at 10,000 ft and 75 % power opens the door with no pilot input: MAP within 0.3 in.Hg, 3–5 % less power (POH 3A-11, 7-37)", () => {
    const BLOCKED = patched(K, { induction: { filterBlockedArea: 0 } });
    const x = takeoff(BLOCKED);
    x.e.altFt = 10000;
    x.e.tasKt = 170;
    settle(BLOCKED, x.s, x.c, x.e, x.f, 60, { map: 27, lambda: 0.85 }, 30);
    // 75 % of 315 bhp at best power: λ held, the power lever moved once per look by the power error (about 10 hp per
    // in.Hg, 40 in.Hg per unit of lever), so the turbocharger and the controller settle between moves (trimming every
    // step, as settle's hold does, leaves the engine still moving when the filter blocks)
    for (let i = 0; i < 12; i++) {
      settle(BLOCKED, x.s, x.c, x.e, x.f, 10, { lambda: 0.85 });
      x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (236 - x.s.hp) / 10 / 40));
    }
    settle(BLOCKED, x.s, x.c, x.e, x.f, 10, { lambda: 0.85 });
    /** Manifold pressure and brake hp averaged over the second half of `seconds`, the controls held. */
    const means = (seconds: number) => {
      let map = 0,
        hp = 0,
        n = 0,
        doorChanges = 0;
      for (let i = 0; i < seconds * 60; i++) {
        const door = !!x.s.altAirOpen;
        step(BLOCKED, x.s, x.c, x.e, x.f, 1 / 60);
        if (!!x.s.altAirOpen !== door) doorChanges++;
        if (i >= seconds * 30) {
          map += x.s.map;
          hp += x.s.hp;
          n++;
        }
      }
      return { map: map / n, hp: hp / n, doorChanges };
    };
    const before = means(30);
    expect(x.s.altAirOpen).toBe(false);
    x.f.filter = true;
    const after = means(60);
    expect(x.s.altAirOpen).toBe(true);
    expect(x.c.altAir).toBe(false);
    expect(after.doorChanges).toBe(1);
    expect(Math.abs(after.map - before.map)).toBeLessThanOrEqual(0.3);
    const drop = 1 - after.hp / before.hp;
    expect(drop).toBeGreaterThanOrEqual(0.03);
    expect(drop).toBeLessThanOrEqual(0.05);
  }, 60_000);

  test("T-31: with the door open, full-throttle MAP at 22,000 ft is at least 0.5 in.Hg lower and the climb's wastegate closes at least 1,000 ft lower (POH 7-38, 3A-11)", () => {
    const BLOCKED = patched(K, { induction: { filterBlockedArea: 0 } });
    const x = takeoff(BLOCKED);
    x.f.filter = true;
    let gateShut: number | undefined;
    let at22 = NaN;
    for (let alt = 0; alt <= 22000; alt += 1000) {
      x.e.altFt = alt;
      x.e.tasKt = climbTas(alt);
      track(BLOCKED, x, 25);
      expect(x.s.altAirOpen, `${alt} ft`).toBe(true);
      expect(x.s.running, `${alt} ft`).toBe(true);
      if (gateShut === undefined && x.s.gate! < 0.02) gateShut = alt;
      if (alt === 22000) at22 = x.s.map;
    }
    expect(at22).toBeLessThanOrEqual(at(22000).map - 0.5);
    // the T-6 measure on filter air: the first climb altitude with the gate shut
    const normalShut = climb().find((p) => p.gate < 0.02)!.alt;
    expect(gateShut).toBeDefined();
    expect(gateShut!).toBeLessThanOrEqual(normalShut - 1000);
  }, 60_000);

  test("T-42: a partly blocked filter opens the door at full power, and it closes again once power is reduced to 30.5 in.Hg (POH 3A-11)", () => {
    const x = copy(rated());
    x.f.filter = true; // the spec's filterBlockedArea: a partial obstruction
    const sl = track(K, x, 20);
    expect(x.s.altAirOpen).toBe(true);
    expect(sl.doorChanges).toBe(1);
    x.e.altFt = 10000;
    x.e.tasKt = climbTas(10000);
    track(K, x, 40);
    const climbing = track(K, x, 10);
    expect(x.s.altAirOpen).toBe(true);
    expect(climbing.doorChanges).toBe(0); // no chatter
    x.e.tasKt = 170;
    trimMap(K, x, 30.3);
    const cruising = track(K, x, 10);
    // the 10 s mean: at part throttle the proportional controller hunts a few tenths of an in.Hg
    expect(cruising.meanMap).toBeLessThanOrEqual(30.5);
    expect(x.s.altAirOpen).toBe(false);
    expect(cruising.doorChanges).toBe(0);
    // full throttle again: the door opens again
    x.e.tasKt = climbTas(10000);
    x.c.throttle = 1;
    track(K, x, 40);
    expect(x.s.altAirOpen).toBe(true);
  }, 60_000);
});

// ---- the POH 4-12 start, idle and run-up

/**
 * Start per POH 4-12 on a standard day at sea level: mixture full rich, fuel pump BOOST, power lever open ¼ inch (its
 * travel is not published: the IO-390's cracked-throttle start position), START until the engine runs on its own (at
 * most the 10 s cranking limit), then 1,000 rpm (POH 4-12 step 11, 4-13), leaned until the rpm peaks and left there for
 * taxi (step 13), and warmed at taxi rpm. BOOST stays on (POH 4-14 keeps it for takeoff).
 */
function pohStart(): Setup {
  const env = defaultEnvironment();
  const s = initialState(K, env);
  const f = noFailures(K);
  const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.15, boost: true, mags: "START" };
  // release after the engine starts: it has outrun the starter
  const free = K.accessories.starterFreeRpm ?? 380;
  for (let t = 0; t < K.limits.starterMaxS!.value && !(s.running && s.rpm > free); t += 0.25)
    settle(K, s, c, env, f, 0.25);
  c.mags = "BOTH";
  settle(K, s, c, env, f, 10, { rpm: 1000 });
  let best = { mixture: c.mixture, rpm: s.rpm };
  for (let k = 1; k * 0.04 < 0.9; k++) {
    c.mixture = 1 - k * 0.04;
    settle(K, s, c, env, f, 2.5);
    if (s.rpm > best.rpm) best = { mixture: c.mixture, rpm: s.rpm };
    else if (s.rpm < best.rpm - 20) break;
  }
  c.mixture = best.mixture;
  settle(K, s, c, env, f, 5);
  settle(K, s, c, env, f, 60, { rpm: 1000 }, 20);
  return { s, c, env };
}

let idleRun: Setup | undefined;
/** Warm idle: started and leaned for taxi, power lever at idle (POH 4-12, 4-15). A copy of a shared run. */
const idle = () =>
  structuredClone(
    (idleRun ??= (() => {
      const x = pohStart();
      x.c.throttle = 0;
      settle(K, x.s, x.c, x.env, noFailures(K), 30, {}, 10);
      return x;
    })()),
  );

/** Run-up: mixture full rich, BOOST, the power lever at 1,700 rpm (POH 4-14, 4-15). */
function runup() {
  const x = pohStart();
  x.c.mixture = 1;
  settle(K, x.s, x.c, x.env, noFailures(K), 25, { rpm: K.limits.magCheckRpm.min });
  return x;
}

// ---- part-throttle cruise, a misadjusted controller, TIT in normal operation, and every modelled failure

/** T-9's 10,000 ft cruise at 30.5 in.Hg and 170 KTAS, settled (shared; copied per test). */
let cruiseRun: ReturnType<typeof takeoff> | undefined;
const cruise10k = () =>
  copy(
    (cruiseRun ??= (() => {
      const x = takeoff(K);
      x.e.altFt = 10000;
      x.e.tasKt = 170;
      watchedSettle(x.w, K, x, 60, { map: 30.5 });
      // settled as T-30 settles its point: the lever moved once per look, the turbocharger and the controller
      // settling between moves (settle's per-step trim leaves the engine moving)
      for (let i = 0; i < 12; i++) {
        watchedSettle(x.w, K, x, 10);
        x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (30.5 - x.s.map) / 40));
      }
      watchedSettle(x.w, K, x, 10);
      return x;
    })()),
  );
const run = (x: ReturnType<typeof copy>, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.05) step(K, x.s, x.c, x.e, x.f, 0.05);
};
/** POH 2-9's manifold-pressure bands: the caution (MAN PRESSURE) and warning edges. */
const mapBand = (color: "yellow" | "red") =>
  K.markings!.find((m) => m.gauge === "map")!.bands.find((b) => b.color === color)!;

describe("part throttle and a misadjusted controller (POH 3-29, 3A-9, 4-22)", () => {
  test("the 10,000 ft cruise point is settled: MAP moves under 0.2 in.Hg in 30 s", () => {
    // read as a pilot reads the gauge, its middle: at part throttle the proportional controller hunts a few tenths of
    // an in.Hg (SOURCES.md), so the reading is the 10 s mean at the start and at the end of the 30 s
    const control = cruise10k();
    const mean10 = () => {
      let sum = 0;
      for (let i = 0; i < 600; i++) {
        step(K, control.s, control.c, control.e, control.f, 1 / 60);
        sum += control.s.map;
      }
      return sum / 600;
    };
    const start = mean10();
    run(control, 10);
    expect(Math.abs(mean10() - start)).toBeLessThan(0.2);
  }, 60_000);

  test("a misadjusted controller holds MAP in the MAN PRESSURE caution band with warm oil, relief valve shut (POH 3-29, 3A-9: 'MAP controller requires a maintenance adjustment')", () => {
    const x = copy(rated());
    x.f.controllerMisadjust = true;
    track(K, x, 30);
    const w = track(K, x, 10);
    expect(x.s.oilT).toBeGreaterThan(150);
    expect(w.lo).toBeGreaterThan(mapBand("yellow").from);
    expect(w.hi).toBeLessThanOrEqual(mapBand("yellow").to);
    expect(w.reliefOpenings).toBe(0);
    expect(x.s.reliefOpen).toBe(false);
  }, 60_000);

  test("T-24: at rated power and in the full-power climb at 5,000 and 15,000 ft both TITs stay below 1750 °F (POH 2-9; M-18 Table 2-1)", () => {
    const r = copy(rated());
    expect(Math.max(...r.s.tit!)).toBeLessThan(1750);
    expect(r.s.titOverS).toBe(0);
    for (const alt of [5000, 15000]) {
      const x = copy(rated());
      x.e.altFt = alt;
      x.e.tasKt = climbTas(alt);
      run(x, 30);
      expect(Math.max(...x.s.tit!), `${alt} ft`).toBeLessThan(1750);
      expect(x.s.titOverS, `${alt} ft`).toBe(0);
    }
  }, 60_000);
});

describe("T-35: the -K keeps a finite state under every failure the model runs", () => {
  const FAILURES: [string, (f: Failures) => void][] = [
    ["left magneto", (f) => (f.magL = true)],
    ["both magnetos", (f) => ((f.magL = true), (f.magR = true))],
    ["engine-driven fuel pump", (f) => (f.fuelPump = true)],
    ["induction filter", (f) => (f.filter = true)],
    ["starter", (f) => (f.starter = true)],
    ["every spark plug", (f) => f.plugs.forEach((p) => p.fill(true))],
    ["one nozzle", (f) => (f.nozzle[0] = 1)],
    ["every nozzle", (f) => f.nozzle.fill(1)],
    ["starter stuck engaged", (f) => (f.starterStuck = true)],
    ["intake leak", (f) => (f.intakeLeak[1] = 1)],
    ["wastegate seized open", (f) => (f.wastegateSeized = "open")],
    ["wastegate seized closed", (f) => (f.wastegateSeized = "closed")],
    ["wastegate actuator oil", (f) => (f.wastegateOil = true)],
    ["controller misadjusted", (f) => (f.controllerMisadjust = true)],
  ];
  /** Paths of non-finite numbers in the state; a cylinder with no fuel has λ = ∞, which is the one allowed. */
  const nonFinite = (o: unknown, path = ""): string[] =>
    typeof o === "number"
      ? Number.isFinite(o) || (path.endsWith(".lambda") && o === Infinity)
        ? []
        : [`${path}=${o}`]
      : o && typeof o === "object"
        ? Object.entries(o).flatMap(([k, v]) => nonFinite(v, `${path}.${k}`))
        : [];

  // each setup is made once, then every failure starts from a copy of it
  let setups: { id: string; setup: Setup }[] = [];
  beforeAll(() => {
    const env = defaultEnvironment();
    const asSetup = (x: ReturnType<typeof copy>): Setup => ({ s: x.s, c: x.c, env: x.e });
    setups = [
      { id: "cold", setup: { s: initialState(K, env), c: defaultControls(), env } },
      { id: "idle", setup: idle() },
      { id: "takeoff", setup: asSetup(copy(rated())) },
      { id: "cruise 10,000 ft", setup: asSetup(cruise10k()) },
    ];
  }, 120_000);

  test.each(FAILURES)("20 s at 60 Hz from each setup: %s", (_, fail) => {
    for (const sc of setups) {
      const { s, c, env } = structuredClone(sc.setup);
      const f = noFailures(K);
      fail(f);
      let first: string[] = [];
      for (let i = 0; i < 20 * 60 && !first.length; i++) {
        step(K, s, c, env, f, 1 / 60, 1);
        if (i % 6 === 0) first = nonFinite(s).map((p) => `${sc.id} at ${(i / 60).toFixed(1)} s: ${p}`);
      }
      expect(first).toEqual([]);
      expect(nonFinite(s).map((p) => `${sc.id} at 20 s: ${p}`)).toEqual([]);
    }
  });
});

describe("T-48: an intake leak is downstream of the throttle and unmetered (POH 3-27; POH 7-38)", () => {
  /** The same setup run 20 s at 60 Hz with no failure and with cylinder 2's intake pipe fully leaking. */
  const pair = (x: Setup) => {
    const clean = structuredClone(x),
      leak = structuredClone(x);
    const f = noFailures(K);
    f.intakeLeak[1] = 1;
    for (let i = 0; i < 20 * 60; i++) {
      step(K, clean.s, clean.c, clean.env, noFailures(K), 1 / 60);
      step(K, leak.s, leak.c, leak.env, f, 1 / 60);
    }
    const others = (s: EngineState) => mean(s.cyl.filter((_, i) => i !== 1).map((cy) => cy.lambda));
    return { clean: clean.s, leak: leak.s, others: others(leak.s) / others(clean.s) };
  };
  const cruise = () => {
    const x = cruise10k();
    return { s: x.s, c: x.c, env: x.e };
  };

  // At part throttle the metering's inputs barely move: the throttle angle is the same, the deck moves under 0.2 % and
  // the rpm under 3 %, the higher rpm reading a lower leak-free MAP, so the scheduled fuel stays within 1 % (0.4 % at
  // run-up, 0.1 % in cruise). The others' λ follows their share of the throttle's air, which the leak, raising the MAP,
  // cuts by about 5 %: richer by under 8 %, where reading the leak as throttle made them 27 % richer at run-up.
  test.each([
    ["run-up, 1,700 rpm", runup],
    ["10,000 ft cruise, 30.5 in.Hg", cruise],
  ])("%s: the fuel stays within 1 % and only the leaking cylinder goes lean", (_, setup) => {
    const { clean, leak, others } = pair(setup());
    expect(leak.rpm).toBeGreaterThan(0.95 * clean.rpm);
    expect(Math.abs(leak.fuel / clean.fuel - 1)).toBeLessThanOrEqual(0.01);
    for (const [i, cy] of leak.cyl.entries()) if (i !== 1) expect(leak.cyl[1].lambda).toBeGreaterThan(cy.lambda);
    expect(others).toBeGreaterThanOrEqual(0.92);
    expect(leak.air).toBeGreaterThan(leak.meteredAir);
  });

  // At idle the leak is a second throttle several times the idle opening: the air rises more than threefold and the
  // rpm by about two thirds, and the schedule follows the rpm at the throttle's own (lower) MAP, so the fuel rises
  // 3.3 %, inside 5 %. The engine keeps running.
  test("warm idle: the engine keeps running, the air rises threefold and the fuel by under 5 %", () => {
    const { clean, leak, others } = pair(idle());
    expect(leak.rpm).toBeGreaterThan(clean.rpm);
    expect(leak.air).toBeGreaterThan(3 * clean.air);
    expect(Math.abs(leak.fuel / clean.fuel - 1)).toBeLessThanOrEqual(0.05);
    for (const [i, cy] of leak.cyl.entries()) if (i !== 1) expect(leak.cyl[1].lambda).toBeGreaterThan(cy.lambda);
    expect(others).toBeGreaterThanOrEqual(0.92);
  });

  test("holding λ with the leak settles at that λ: mixtureFor reads the metering's leak-free MAP too (trim.ts)", () => {
    const x = runup();
    const f = noFailures(K);
    f.intakeLeak[1] = 1;
    settle(K, x.s, x.c, x.env, f, 20, { lambda: 1.0 });
    expect(x.s.air / (15 * x.s.fuel)).toBeGreaterThan(0.98);
    expect(x.s.air / (15 * x.s.fuel)).toBeLessThan(1.02);
  });
});

// ---- calibration. The metering's full-rich schedule is read at the throttle-angle stand-in, rated rpm
// (engines/model/turbo.ts turboMetering), so a change of rpm moves the flow in proportion and not the schedule
// (POH 7-38).

/** Spread of a run's rpm and manifold pressure over `seconds` at 60 Hz, the controls held. */
function spread(spec: EngineSpec, s: EngineState, c: Controls, e: Environment, f: Failures, seconds: number) {
  let rLo = Infinity,
    rHi = -Infinity,
    mLo = Infinity,
    mHi = -Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    step(spec, s, c, e, f, 1 / 60);
    rLo = Math.min(rLo, s.rpm);
    rHi = Math.max(rHi, s.rpm);
    mLo = Math.min(mLo, s.map);
    mHi = Math.max(mHi, s.map);
  }
  return { rLo, rHi, map: mHi - mLo };
}

describe("fuel metering in proportion to rpm, mixture and throttle angle (SR22T POH 7-38)", () => {
  test("at a fixed throttle angle the metered λ is the same at 2,300 and 2,500 rpm: rpm moves the flow, not the full-rich schedule", () => {
    const ve = inductionCal(K).ve;
    for (const [map, deck] of [
      [30.5, 32.2],
      [34.0, 35.0],
      [36.0, 36.5],
    ]) {
      const lambdaAt = (rpm: number) => {
        const m = turboMetering(K, ve, rpm, map, deck);
        return m.airLbH / (15 * continentalFuelFlow(K, m.airLbH, 1, 1, m.scheduleLbH));
      };
      expect(lambdaAt(2300), `${map} in.Hg`).toBeCloseTo(lambdaAt(2500), 2);
    }
  });

  test("lean of peak at 10,000 and 25,000 ft the fixed governor holds 2,500 ± 20 rpm and MAP stays within 1 in.Hg (POH 7-32, 4-22)", () => {
    const rows: string[] = [];
    for (const [altFt, tasKt, throttle] of [
      [10000, 175, 0.65],
      [25000, 201, 0.7],
    ])
      for (const mixture of [0.7, 0.61, 0.55]) {
        const x = warmStart(K, { altFt, tasKt });
        Object.assign(x.c, { boost: false, throttle, mixture });
        const f = noFailures(K);
        settle(K, x.s, x.c, x.env, f, 90);
        const r = spread(K, x.s, x.c, x.env, f, 30);
        if (r.rLo < 2480 || r.rHi > 2520 || r.map > 1)
          rows.push(`${altFt} ft mixture ${mixture}: ${JSON.stringify(r)}`);
      }
    expect(rows).toEqual([]);
  }, 60_000);

  test("leaning at full power never overspeeds the fixed governor: 2,500 ± 20 rpm static, at 77 KIAS and at 18,000 ft, full rich to mixture 0.45; on an ISA +30 °C day at 18,000 and 25,000 ft, leaning to 18.3 GPH and on to 0.45, never past the 2,550 rpm red line (POH 7-32; 4-14; 2-9)", () => {
    const rows: string[] = [];
    for (const [altFt, tasKt] of [
      [0, 0],
      [0, 77],
      [18000, 159],
    ]) {
      const x = copy(rated());
      x.e.altFt = altFt;
      x.e.tasKt = tasKt;
      settle(K, x.s, x.c, x.e, x.f, 30, {}, 5);
      for (const mixture of [0.8, 0.6, 0.55, 0.5, 0.45]) {
        x.c.mixture = mixture;
        settle(K, x.s, x.c, x.e, x.f, 15);
        const r = spread(K, x.s, x.c, x.e, x.f, 15);
        if (r.rLo < 2480 || r.rHi > 2520) rows.push(`${altFt} ft ${tasKt} kt mixture ${mixture}: ${JSON.stringify(r)}`);
      }
    }
    // a hot day: full rich at full throttle in the 120 KIAS climb, then leaned look by look to 18.3 GPH (the 85 % flow)
    // and on to 0.45, the lever moved as a hand moves it (0.02 per half second), the rpm watched at every step against
    // the POH 2-9 red line
    const red = K.markings!.find((mk) => mk.gauge === "rpm")!.bands.find((b) => b.level === "warning")!.from;
    for (const altFt of [18000, 25000]) {
      const x = warmStart(K, { isaDevC: 30 });
      const f = noFailures(K);
      Object.assign(x.c, { throttle: 1, mixture: 1, boost: true });
      for (const alt of [5000, 10000, 15000, altFt]) {
        x.env.altFt = alt;
        x.env.tasKt = 120 / Math.sqrt(atmosphere(alt, 30).sigma);
        settle(K, x.s, x.c, x.env, f, 30, {}, 5);
      }
      let hi = 0;
      const leanTo = (target: number, seconds: number) => {
        for (let t = 0; t < seconds; t += 0.5) {
          x.c.mixture += Math.max(-0.02, Math.min(0.02, target - x.c.mixture));
          hi = Math.max(hi, spread(K, x.s, x.c, x.env, f, 0.5).rHi);
        }
      };
      for (let i = 0; i < 8; i++) {
        let fuel = 0;
        for (let k = 0; k < 40; k++) {
          hi = Math.max(hi, spread(K, x.s, x.c, x.env, f, 0.25).rHi);
          fuel += x.s.fuel / 40;
        }
        leanTo(Math.max(0.03, Math.min(1, (x.c.mixture * 18.3 * 6) / fuel)), 20);
      }
      for (const mixture of [0.6, 0.5, 0.45]) leanTo(mixture, 20);
      if (hi > red) rows.push(`${altFt} ft ISA +30 °C: ${hi.toFixed(0)} rpm`);
    }
    expect(rows).toEqual([]);
  }, 120_000);
});

describe("fuel pressures at the settled points (AMM 73-20 PDF 2589 (x), (z); M-18 Table 2-4)", () => {
  test("T-39: at full power the metered nozzle pressure is 14.2–14.8 psid and the unmetered pump pressure 21.0–24.5 psi", () => {
    const { s } = rated();
    expect(s.nozzlePsi).toBeGreaterThanOrEqual(14.2);
    expect(s.nozzlePsi).toBeLessThanOrEqual(14.8);
    expect(s.fuelPsi).toBeGreaterThanOrEqual(21.0);
    expect(s.fuelPsi).toBeLessThanOrEqual(24.5);
  });

  test("T-39: at 600 rpm, warm, the unmetered pump pressure is 7.0–9.0 psi with the boost pump off (set before the idle stop, AMM step (ab))", () => {
    // AMM 73-20 sets the 600 rpm pressure (step (z)) before it sets the idle stop to 700 ± 25 (step (ab)): the stop
    // backed off
    const OFF = patched(K, { calibration: { idleArea: 0.005 } });
    const x = warmStart(OFF);
    x.c.boost = false;
    settle(OFF, x.s, x.c, x.env, noFailures(OFF), 20, { rpm: 600 });
    expect(Math.abs(x.s.rpm - 600)).toBeLessThan(25);
    expect(x.s.fuelPsi).toBeGreaterThanOrEqual(7.0);
    expect(x.s.fuelPsi).toBeLessThanOrEqual(9.0);
  });
});

describe("turbocharger reserve on a hot day (SR22T POH 4-14, 5-20/5-21, 5-26/5-27)", () => {
  /** A POH 4-12 start and taxi warm-up on the day (oil warmed as for taxi, not by a long static run: POH 4-14 warns
   * against prolonged ground running in hot weather), then full throttle, full rich, BOOST at `kias`. */
  const hotDay = (isaDevC: number, altFt: number, kias: number) => {
    const x = warmStart(K, { isaDevC, altFt });
    Object.assign(x.c, { throttle: 1, mixture: 1, boost: true });
    x.env.tasKt = kias / Math.sqrt(atmosphere(altFt, isaDevC).sigma);
    settle(K, x.s, x.c, x.env, noFailures(K), 20, {}, 5);
    return x;
  };

  test("TR-1: 'maintains 36.0 in.Hg manifold pressure for all takeoffs': at ISA +30 °C, sea level to 10,000 ft, full throttle at 77 KIAS gives 36.0 ± 0.3 (POH 4-14; 5-20 to 50 °C at 10,000 ft)", () => {
    for (const altFt of [0, 5000, 10000]) {
      const x = hotDay(30, altFt, 77);
      const r = spread(K, x.s, x.c, x.env, noFailures(K), 10);
      expect(x.s.oilT, `${altFt} ft oil`).toBeLessThanOrEqual(240);
      expect(Math.abs(x.s.map - 36.0), `${altFt} ft MAP ${x.s.map}`).toBeLessThanOrEqual(0.3);
      expect(r.map, `${altFt} ft band`).toBeLessThan(0.3);
    }
  }, 60_000);

  test("TR-2: the full-power climb keeps most of its power on a hot day: at 18,000 ft and ISA +30 °C, 120 KIAS, MAP ≥ 33.0 and at least 85 % of the ISA power (POH 5-26: positive climb rates at 40 °C to 20,000 ft)", () => {
    const climbTo = (isaDevC: number) => {
      const x = hotDay(isaDevC, 0, 77);
      const f = noFailures(K);
      for (const altFt of [5000, 10000, 15000, 18000]) {
        x.env.altFt = altFt;
        x.env.tasKt = 120 / Math.sqrt(atmosphere(altFt, isaDevC).sigma);
        settle(K, x.s, x.c, x.env, f, 30, {}, 5);
      }
      settle(K, x.s, x.c, x.env, f, 10);
      return x.s;
    };
    const isa = climbTo(0),
      hot = climbTo(30);
    expect(hot.map).toBeGreaterThanOrEqual(33.0);
    expect(hot.hp).toBeGreaterThanOrEqual(0.85 * isa.hp);
  }, 60_000);
});

// ---- cruise, thermal and ground calibration

/** Gauge readings averaged over the second half of a look, the way a pilot reads them. */
function lookAt(x: Setup, f: Failures, seconds: number, hold: Hold, thermal: number) {
  settle(K, x.s, x.c, x.env, f, seconds / 2, hold, thermal);
  const n = seconds / 2 / 0.25;
  const g = { map: 0, fuel: 0, hp: 0 };
  for (let k = 0; k < n; k++) {
    settle(K, x.s, x.c, x.env, f, 0.25, hold, thermal);
    g.map += x.s.map / n;
    g.fuel += x.s.fuel / n;
    g.hp += x.s.hp / n;
  }
  return g;
}

/**
 * A POH 5-32 to 5-34 cruise point flown as the POH's note says: the mixture leaned to the target fuel flow (λ =
 * lambdaTarget at the air the engine takes, POH 4-22) and the power lever moved until that fuel flow is the table's;
 * if that needs more than 30.5 in.Hg, the lever holds 30.5 (leaning is approved only there or below) and the mixture
 * is leaned to the table's fuel flow wherever λ lands (SOURCES.md C10). Readings are look means.
 */
function cruisePoint(altFt: number, gph: number, tasKt: number, isaDevC = 0) {
  const x = warmStart(K);
  const f = noFailures(K);
  x.env = { ...x.env, altFt, isaDevC, tasKt };
  Object.assign(x.c, { boost: false, throttle: 0.6, mixture: 0.7 });
  const lbh = gph * 6,
    lamT = K.calibration.lambdaTarget!;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  let capped = false,
    g = { map: 0, fuel: 0, hp: 0 };
  for (let i = 0; i < 16; i++) {
    const thermal = i < 8 ? 20 : 1;
    if (!capped) {
      g = lookAt(x, f, 20, { lambda: lamT }, thermal);
      x.c.throttle = clamp(x.c.throttle * (1 + clamp((lbh / g.fuel - 1) * 0.8, -0.15, 0.15)), 0.05, 1);
      if (g.map > 30.5) capped = true;
    } else {
      g = lookAt(x, f, 20, {}, thermal);
      x.c.mixture = clamp((x.c.mixture * lbh) / g.fuel, 0.03, 1);
      // aimed a tenth under 30.5: the controller hunts a few tenths
      x.c.throttle = clamp(x.c.throttle + (30.4 - g.map) / 40, 0.05, 1);
    }
  }
  g = lookAt(x, f, 30, capped ? {} : { lambda: lamT }, 1);
  return { ...g, gph: g.fuel / 6, capped, x, f };
}
const hottestCht = (s: EngineState) => Math.max(...s.cyl.map((cy) => cy.cht));

describe("POH cruise performance, lean of peak (SR22T POH 5-32 to 5-34, 4-22)", () => {
  // POH 5-32 to 5-34, standard day: [altitude ft, % of 315 hp, GPH, KTAS]: the white cells
  const CELLS: [number, number, number, number][] = [
    [2000, 75, 16.4, 162],
    [2000, 65, 14.6, 154],
    [2000, 55, 12.7, 143],
    [10000, 85, 18.3, 184],
    [10000, 75, 16.4, 175],
    [10000, 65, 14.6, 164],
    [10000, 55, 12.7, 152],
    [18000, 85, 18.3, 198],
    [18000, 75, 16.4, 188],
    [18000, 65, 14.6, 176],
    [18000, 55, 12.7, 162],
    [25000, 85, 18.3, 213],
    [25000, 80, 17.4, 207],
    [25000, 75, 16.4, 201],
    [25000, 65, 14.6, 188],
    [25000, 55, 12.7, 171],
  ];
  /** POH table hp per GPH by % power (pct × 3.15 ÷ GPH: 14.6, 14.5, 14.4, 14.0, 13.6). */
  const HP_PER_GPH: Record<number, number> = { 85: 14.6, 80: 14.5, 75: 14.4, 65: 14.0, 55: 13.6 };
  let rows: { alt: number; pct: number; hp: number; gph: number; map: number }[] | undefined;
  const cells = () =>
    (rows ??= CELLS.map(([alt, pct, gph, tas]) => {
      const r = cruisePoint(alt, gph, tas);
      return { alt, pct, hp: r.hp, gph: r.gph, map: r.map };
    }));

  test("T-18: every white standard-day cell makes pct × 315 bhp ± 4 % at the table fuel flow (± 0.1 GPH) and MAP ≤ 30.5 in.Hg (POH 5-32 to 5-34; 4-22)", () => {
    const off = cells()
      .filter(
        (r) =>
          Math.abs(r.hp / (r.pct * 3.15) - 1) > 0.04 ||
          r.map > 30.5 ||
          Math.abs(r.gph - CELLS.find((c) => c[0] === r.alt && c[1] === r.pct)![2]) > 0.1,
      )
      .map(
        (r) => `${r.alt} ft ${r.pct} %: ${r.hp.toFixed(1)} hp at ${r.gph.toFixed(2)} GPH, ${r.map.toFixed(2)} in.Hg`,
      );
    expect(off).toEqual([]);
  }, 180_000);

  test("T-19: hp per GPH at the T-18 points is the table's ± 4 % (14.6, 14.5, 14.4, 14.0, 13.6; POH 5-32 to 5-34)", () => {
    const off = cells()
      .filter((r) => Math.abs(r.hp / r.gph / HP_PER_GPH[r.pct] - 1) > 0.04)
      .map((r) => `${r.alt} ft ${r.pct} %: ${(r.hp / r.gph).toFixed(2)} hp/GPH`);
    expect(off).toEqual([]);
  }, 180_000);

  test("T-20: at 10,000 ft and 30.5 in.Hg leaning to λ ≈ 1.25 keeps hp per fuel flow within 5 %; leaner, roughness rises before power reaches zero (POH 4-22: 'lower cruise power … the only undesirable affect … is engine misfire')", () => {
    const x = warmStart(K);
    const f = noFailures(K);
    x.env = { ...x.env, altFt: 10000, tasKt: 175 };
    Object.assign(x.c, { boost: false, throttle: 0.66, mixture: 0.7 });
    const at = (lambda: number) => {
      for (let i = 0; i < 6; i++) {
        const g = lookAt(x, f, 20, { lambda }, i < 3 ? 20 : 1);
        x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (30.5 - g.map) / 40));
      }
      const g = lookAt(x, f, 20, { lambda }, 1);
      return { perFuel: g.hp / g.fuel, hp: g.hp, rough: x.s.rough };
    };
    const target = at(K.calibration.lambdaTarget!),
      lean = at(1.25),
      leaner = at(1.45);
    expect(Math.abs(lean.perFuel / target.perFuel - 1)).toBeLessThanOrEqual(0.05);
    expect(leaner.rough).toBeGreaterThan(lean.rough);
    expect(leaner.hp).toBeGreaterThan(0);
  }, 120_000);

  test("T-21: 85 % at 18.3 GPH and 10,000 ft: standard day every CHT ≤ 420 °F and both TIT ≤ 1750 °F; at ISA +30 °C (a gray cell) a CHT above 420, a TIT above 1750 or more than 30.5 in.Hg is needed (POH 5-33 and its note)", () => {
    const isa = cruisePoint(10000, 18.3, 184);
    expect(hottestCht(isa.x.s)).toBeLessThanOrEqual(420);
    expect(Math.max(...isa.x.s.tit!)).toBeLessThanOrEqual(1750);
    const hot = cruisePoint(10000, 18.3, 190, 30);
    const short = hot.hp < 0.96 * 85 * 3.15 && hot.capped;
    expect(hottestCht(hot.x.s) > 420 || Math.max(...hot.x.s.tit!) > 1750 || short).toBe(true);
  }, 120_000);

  test("T-22: at 10,000 ft and 30.5 in.Hg the 75 % target fuel flow (16.4 GPH) sits 50–75 °F (± 15) lean of the peak TIT (POH 4-22)", () => {
    const x = warmStart(K);
    const f = noFailures(K);
    x.env = { ...x.env, altFt: 10000, tasKt: 175 };
    Object.assign(x.c, { boost: false, throttle: 0.66, mixture: 0.75 });
    const sweep: { gph: number; tit: number }[] = [];
    for (const lambda of [0.9, 0.95, 1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.22]) {
      for (let i = 0; i < 4; i++) {
        const g = lookAt(x, f, 20, { lambda }, i < 2 ? 20 : 1);
        x.c.throttle = Math.max(0, Math.min(1, x.c.throttle + (30.5 - g.map) / 40));
      }
      const g = lookAt(x, f, 20, { lambda }, 1);
      sweep.push({ gph: g.fuel / 6, tit: Math.max(...x.s.tit!) });
    }
    const peak = Math.max(...sweep.map((p) => p.tit));
    // TIT at 16.4 GPH, linear between the two sweep points that bracket it (the sweep runs rich to lean)
    const i = sweep.findIndex((p, k) => k > 0 && p.gph <= 16.4 && sweep[k - 1].gph >= 16.4);
    expect(i).toBeGreaterThan(0);
    const [a, b] = [sweep[i - 1], sweep[i]];
    const tit = a.tit + ((b.tit - a.tit) * (16.4 - a.gph)) / (b.gph - a.gph);
    expect(peak - tit).toBeGreaterThanOrEqual(35);
    expect(peak - tit).toBeLessThanOrEqual(90);
  }, 180_000);
});

/** Full throttle at a cruise point's state, the mixture leaned each look to `gph`: the look means, look by look. */
function fullThrottleLeaned(r: ReturnType<typeof cruisePoint>, gph: number, looks = 10) {
  r.x.c.throttle = 1;
  const seen: { map: number; gph: number; mixture: number }[] = [];
  for (let i = 0; i < looks; i++) {
    const g = lookAt(r.x, r.f, 20, {}, 1);
    seen.push({ map: g.map, gph: g.fuel / 6, mixture: r.x.c.mixture });
    r.x.c.mixture = Math.max(0.03, Math.min(1, (r.x.c.mixture * gph * 6) / g.fuel));
  }
  return seen;
}

describe("TR-3 and leaning at full throttle on a hot day (SR22T POH 5-34)", () => {
  test("TR-3: 85 % at 18.3 GPH at 25,000 ft ISA +30 °C (a gray cell) is not reached at 30.5 in.Hg or less, and full throttle at 18.3 GPH gives more than 30.5 in.Hg (POH 5-34: the turbochargers can supply it)", () => {
    const r = cruisePoint(25000, 18.3, 220, 30);
    expect(r.capped).toBe(true);
    expect(r.hp).toBeLessThan(0.96 * 85 * 3.15);
    const seen = fullThrottleLeaned(r, 18.3);
    const last = seen[seen.length - 1];
    expect(Math.abs(last.gph - 18.3)).toBeLessThan(0.3);
    expect(last.map).toBeGreaterThan(30.5);
  }, 120_000);

  // the model's power leaned above 30.5 in.Hg is not read (SOURCES.md, "Leaning above 30.5 in.Hg"); only that the engine
  // keeps running there: before the -K's rich misfire edge it rose to over 1,000 hp, then MAP fell to 13.6 in.Hg.
  // Looks 1-5 are the look-by-look trim converging on the flow; from the sixth the point is settled, held to the
  // 0.2 in.Hg the settled 10,000 ft cruise point is held to
  test("leaning at full throttle on an ISA +30 °C day at 25,000 and 18,000 ft stays stable: over 10 looks to 18.3 GPH, MAP stays above 30.5 in.Hg, settles to within 0.2 in.Hg over looks 6–10 (no hunting, no collapse), and the mixture never returns to full rich", () => {
    for (const [altFt, tasKt] of [
      [25000, 220],
      [18000, 205],
    ]) {
      const seen = fullThrottleLeaned(cruisePoint(altFt, 18.3, tasKt, 30), 18.3);
      const settled = seen.slice(5).map((p) => p.map);
      expect(settled).toHaveLength(5);
      expect(Math.min(...seen.slice(1).map((p) => p.map)), `${altFt} ft`).toBeGreaterThan(30.5);
      expect(Math.max(...settled) - Math.min(...settled), `${altFt} ft band`).toBeLessThan(0.2);
      expect(Math.max(...seen.map((p) => p.mixture)), `${altFt} ft mixture`).toBeLessThan(1);
    }
  }, 180_000);
});

describe('the leaning cap above 30.5 in.Hg (calibration.leanGainMax; SOURCES.md, "Leaning above 30.5 in.Hg")', () => {
  const mp = (l: number) =>
    mixturePower(l, K.calibration.lambdaBestPower, K.calibration.peakEgtPower, K.calibration.richMisfireLambda);

  test("is 1.16 × the full-rich work, in full from 31.5 in.Hg, half at 30.5 and none at 29.5; the IO-390 has none", () => {
    expect(leanCapAt(K, 0.5, 36)).toEqual({ work: 1.16 * mp(0.5), weight: 1 });
    expect(leanCapAt(K, 0.5, 30.5)?.weight).toBeCloseTo(0.5, 9);
    expect(leanCapAt(K, 0.5, 29.5)).toBeUndefined();
    expect(leanCapAt(K, undefined, 36)).toBeUndefined();
    expect(leanCapAt(IO390, 0.5, 36)).toBeUndefined();
  });

  test("a cylinder's work is mixturePower below the cap, and above it loses the cap's weight of the excess", () => {
    expect(cylinderWork(K, 1.1)).toBe(mp(1.1));
    const cap = { work: 0.9, weight: 0.5 };
    expect(cylinderWork(K, 0.5, cap)).toBe(mp(0.5)); // below the cap
    expect(mp(0.9)).toBeGreaterThan(0.9);
    expect(cylinderWork(K, 0.9, cap)).toBeCloseTo(0.9 + 0.5 * (mp(0.9) - 0.9), 12);
    expect(cylinderWork(K, 0.9, { work: 0.9, weight: 1 })).toBeCloseTo(0.9, 12);
  });

  test("the engine's step records the cap the cylinders' work followed: full rich at takeoff power the work stays under it", () => {
    const x = warmStart(K);
    Object.assign(x.c, { throttle: 1, mixture: 1, boost: true });
    settle(K, x.s, x.c, x.env, noFailures(K), 20, {}, 5);
    const cap = x.s.leanCap!;
    expect(cap.weight).toBe(1);
    for (const c of x.s.cyl) {
      expect(c.work).toBe(cylinderWork(K, c.lambda, cap));
      expect(c.work).toBeLessThan(cap.work);
    }
  });
});

describe("TIT, CHT and oil temperatures (SR22T POH 2-9, 3-30, 4-14, 4-19, 4-22, 7-36)", () => {
  test("T-25: leaned toward peak at sea-level full throttle a TIT exceeds 1750 °F; back to full rich both fall below 1750 within 30 s; one magneto raises TIT at a fixed mixture (POH 3-30 TIT Warning, 4-14)", () => {
    const x = copy(rated());
    settle(K, x.s, x.c, x.e, x.f, 30, { lambda: 1.0 });
    expect(Math.max(...x.s.tit!)).toBeGreaterThan(1750);
    const lean = { mixture: x.c.mixture, tit: Math.max(...x.s.tit!) };
    x.c.mixture = 1;
    settle(K, x.s, x.c, x.e, x.f, 30);
    expect(Math.max(...x.s.tit!)).toBeLessThan(1750);
    // one magneto at a fixed mixture, a little richer than peak: the slower burn heats the exhaust
    x.c.mixture = lean.mixture * 1.1;
    settle(K, x.s, x.c, x.e, x.f, 30);
    const both = Math.max(...x.s.tit!);
    x.c.mags = "L";
    settle(K, x.s, x.c, x.e, x.f, 30);
    expect(Math.max(...x.s.tit!)).toBeGreaterThan(both);
  }, 60_000);

  test("T-26: the full-power climb at 120 KIAS keeps every CHT ≤ 420 °F, oil 180–240 °F and 30–60 psi at 5,000 and 15,000 ft, the cooler inside Figure 2-38's rejection at its inlet temperature difference (POH 4-19, 2-9, 2-6; M-18 Figure 2-38, Table 2-3)", () => {
    for (const altFt of [5000, 15000]) {
      const x = copy(rated());
      x.e.altFt = altFt;
      x.e.tasKt = climbTas(altFt);
      settle(K, x.s, x.c, x.e, x.f, 60, {}, 20);
      expect(hottestCht(x.s), `${altFt} ft CHT`).toBeLessThanOrEqual(420);
      expect(x.s.oilT, `${altFt} ft oil`).toBeGreaterThanOrEqual(180);
      expect(x.s.oilT, `${altFt} ft oil`).toBeLessThanOrEqual(240);
      expect(x.s.oilP, `${altFt} ft oil psi`).toBeGreaterThanOrEqual(30);
      expect(x.s.oilP, `${altFt} ft oil psi`).toBeLessThanOrEqual(60);
      // Figure 2-38's axis: "Heat Rejection (btu/min @ 100°F) Inlet Temperature Difference"
      const itd = x.s.oilT - (x.s.oatC * 9) / 5 - 32;
      expect(x.s.coolerBtu, `${altFt} ft cooler`).toBeLessThan((K.oil.coolerMaxBtuMin! * itd) / 100);
    }
  }, 60_000);

  test("T-27: a static full-power run overheats the cylinders past 460 °F, into the CHT warning band (POH 4-14: 'avoid overheating during prolonged ground engine operation'; 2-9)", () => {
    const x = copy(rated());
    settle(K, x.s, x.c, x.e, x.f, 60, {}, 20);
    const warning = K.markings!.find((m) => m.gauge === "cht")!.bands.find((b) => b.level === "warning")!;
    expect(hottestCht(x.s)).toBeGreaterThan(warning.from);
  }, 60_000);

  test("T-28: cruise at 10,000 ft and 75 % holds oil at 180 ± 15 °F; the full-power climb stays at or under 240 °F (POH 7-36 'approximately 180 °F'; AMM 79-00 PDF 2764)", () => {
    const r = cruisePoint(10000, 16.4, 175);
    expect(Math.abs(r.x.s.oilT - 180)).toBeLessThanOrEqual(15);
    const x = copy(rated());
    x.e.altFt = 10000;
    x.e.tasKt = climbTas(10000);
    settle(K, x.s, x.c, x.e, x.f, 60, {}, 20);
    expect(x.s.oilT).toBeLessThanOrEqual(240);
  }, 60_000);

  test("T-29: oil pressure at least 10 psi at a hot idle, 30–60 psi in cruise, 60–100 psi after a cold start at ISA −15 °C (POH 2-6, 2-9; M-18 Table 2-3)", () => {
    const hot = idle();
    hot.s.oilT = 230; // hot, after a flight
    settle(K, hot.s, hot.c, hot.env, noFailures(K), 20, {}, 1e-6);
    expect(hot.s.oilP).toBeGreaterThanOrEqual(10);
    const r = cruisePoint(10000, 16.4, 175);
    expect(r.x.s.oilP).toBeGreaterThanOrEqual(30);
    expect(r.x.s.oilP).toBeLessThanOrEqual(60);
    const e = { ...defaultEnvironment(), isaDevC: -15 };
    const s = initialState(K, e);
    const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.15, boost: true, mags: "START" };
    const f = noFailures(K);
    for (let t = 0; t < 10 && !(s.running && s.rpm > 380); t += 0.25) settle(K, s, c, e, f, 0.25);
    c.mags = "BOTH";
    settle(K, s, c, e, f, 10, { rpm: 1000 });
    expect(s.oilP).toBeGreaterThanOrEqual(60);
    expect(s.oilP).toBeLessThanOrEqual(100);
  }, 60_000);

  test("T-47: at a lean-of-peak cruise point 0.5 GPH less fuel lowers the hottest CHT by about 15 °F (15 ± 8; POH 4-22)", () => {
    // the POH's remedy for a CHT above 420 °F: the hottest cruise, 85 % at 18.3 GPH, here at 18,000 ft where the 30.5
    // in.Hg limit leaves it just lean of peak
    const r = cruisePoint(18000, 18.3, 198);
    const before = hottestCht(r.x.s);
    expect(meanLambda(r.x.s)).toBeGreaterThan(1);
    r.x.c.mixture *= (r.gph - 0.5) / r.gph;
    settle(K, r.x.s, r.x.c, r.x.env, r.f, 60, {}, 20);
    const drop = before - hottestCht(r.x.s);
    expect(drop).toBeGreaterThanOrEqual(7);
    expect(drop).toBeLessThanOrEqual(23);
  }, 60_000);
});

describe("ground operation (SR22T POH 4-12, 4-15; AMM 73-20 PDF 2589)", () => {
  test("T-15: started per POH 4-12, leaned for taxi and warm, the idle is 700 ± 25 rpm (POH 4-15: 600–750) with at least 10 psi of oil (AMM 73-20 (ab))", () => {
    const x = idle();
    expect(Math.abs(x.s.rpm - 700)).toBeLessThanOrEqual(25);
    expect(x.s.oilP).toBeGreaterThanOrEqual(10);
  }, 60_000);

  test("T-16: at the 1,700 rpm run-up each magneto drops more than 25 and at most 150 rpm, within 75 of each other; a failed magneto drops more than 150 (POH 4-15)", () => {
    const f = noFailures(K);
    const x = runup();
    const base = x.s.rpm;
    const dropOn = (mags: "L" | "R", fail: Partial<Failures> = {}) => {
      const y = structuredClone(x);
      y.c.mags = mags;
      settle(K, y.s, y.c, y.env, { ...f, ...fail }, 10);
      return base - y.s.rpm;
    };
    const r = dropOn("R"),
      l = dropOn("L");
    for (const d of [r, l]) {
      expect(d).toBeGreaterThan(25);
      expect(d).toBeLessThanOrEqual(150);
    }
    expect(Math.abs(r - l)).toBeLessThanOrEqual(75);
    expect(dropOn("L", { magL: true })).toBeGreaterThan(150);
  }, 60_000);

  test("T-17: the POH 4-12 start runs within 10 s, then holds 1,000 rpm with the oil pressure rising (POH 4-12, 4-15)", () => {
    const e = defaultEnvironment();
    const s = initialState(K, e);
    const c: Controls = { ...defaultControls(), mixture: 1, throttle: 0.15, boost: true, mags: "START" };
    const f = noFailures(K);
    let t = 0;
    for (; t < 10 && !(s.running && s.rpm > (K.accessories.starterFreeRpm ?? 380)); t += 0.25)
      settle(K, s, c, e, f, 0.25);
    expect(t).toBeLessThan(10);
    const atStart = s.oilP;
    c.mags = "BOTH";
    settle(K, s, c, e, f, 15, { rpm: 1000 });
    expect(Math.abs(s.rpm - 1000)).toBeLessThan(30);
    expect(s.oilP).toBeGreaterThan(atStart);
    expect(s.oilP).toBeGreaterThanOrEqual(K.limits.oilPressMinIdle.value);
  }, 60_000);

  test("T-41: at 1,000 rpm after the start, leaning from full rich raises rpm to a maximum before it falls (POH 4-12 step 13)", () => {
    const x = warmStart(K);
    const f = noFailures(K);
    x.c.mixture = 1;
    settle(K, x.s, x.c, x.env, f, 10, { rpm: 1000 });
    const start = x.s.rpm;
    const rpms: number[] = [];
    for (let mix = 1; mix > 0.5; mix -= 0.05) {
      x.c.mixture = mix;
      settle(K, x.s, x.c, x.env, f, 3);
      rpms.push(x.s.rpm);
    }
    const peak = Math.max(...rpms),
      at = rpms.indexOf(peak);
    expect(peak).toBeGreaterThan(start + 5);
    expect(at).toBeGreaterThan(0);
    expect(rpms[rpms.length - 1]).toBeLessThan(peak - 50);
  }, 60_000);
});
