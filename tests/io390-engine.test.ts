/**
 * The standalone engine model against what Lycoming documents for the IO-390-C (IOM-IO-390-C, January 2017).
 * Chart values were digitized (engines/io390/SOURCES.md); tolerances allow for that and for model shape.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { ENGINES } from "@/engines";
import { atmosphere } from "@/engines/model/atmosphere";
import {
  firingAngle,
  phaseOf,
  pinAngle,
  pressureTrace,
  rodEnds,
  sideAngle,
  sparkBTC,
  stroke,
} from "@/engines/model/cycle";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  sparks,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import { egtOffset, mixturePower } from "@/engines/model/mixture";
import { chartHp, fullThrottleHp, fullThrottleMap, seaLevelHp } from "@/engines/model/performance";
import { meanLambda, settle } from "@/engines/model/trim";
import { SCENARIOS, scenariosFor, type Setup } from "@/engines/model/scenarios";
import { limitFlags } from "@/engines/model/alerts";

const S = IO390;
const propFor = (rpm: number) => (rpm - S.propeller.governorMinRpm) / (S.rating.rpm - S.propeller.governorMinRpm);

/** Start per the IOM (throttle cracked, boost pump on, mixture rich, starter), then warm up at 1,000 rpm. */
function warm(envPatch: Partial<Environment> = {}, f: Failures = noFailures(S)) {
  const e: Environment = { ...defaultEnvironment(), ...envPatch };
  const s = initialState(S, e);
  const c: Controls = { ...defaultControls(), throttle: 0.15, mixture: 1, boost: true, mags: "START" };
  settle(S, s, c, e, f, 3);
  c.mags = "BOTH";
  c.boost = false;
  settle(S, s, c, e, f, 60, { rpm: 1000 }, 20);
  return { s, c, e, f };
}

const gph = (s: EngineState) => s.fuel / 6;

describe("IO-390-C specifications (IOM Table A-1, p. 51; System Description p. 6)", () => {
  test("four cylinders, 389 cu in from 5.319 in bore and 4.375 in stroke", () => {
    const g = S.geometry;
    expect(g.cylinders).toHaveLength(4);
    const swept = (Math.PI / 4) * g.boreIn ** 2 * g.strokeIn * 4;
    expect(swept).toBeCloseTo(g.displacementIn3, -0.5);
  });

  test("firing order 1-3-2-4: one cylinder every 180°, each at top centre when its crankpin points at it", () => {
    const fired: number[] = [];
    for (let crank = 0; crank < 720; crank += 1)
      for (const c of S.geometry.cylinders) if (Math.round(phaseOf(S, c.n, crank)) === 0) fired.push(c.n);
    expect(fired).toEqual([1, 3, 2, 4]);
    for (const c of S.geometry.cylinders) expect(pinAngle(c, firingAngle(S, c.n)) % 360).toBe(sideAngle(c));
    // opposed pairs move in opposite directions (1 and 2 share a bank position, 180° apart)
    expect(Math.abs(S.geometry.cylinders[0].pin - S.geometry.cylinders[1].pin)).toBe(180);
  });

  test("each connecting rod stays one rod length from its crankpin to its piston pin, and the piston stays on its bore axis", () => {
    const rod = S.geometry.rodIn * 0.0254;
    for (const c of S.geometry.cylinders)
      for (let crank = 0; crank < 720; crank += 5) {
        const { pin, piston } = rodEnds(S, c, crank);
        expect(Math.hypot(piston.y - pin.y, piston.z - pin.z)).toBeCloseTo(rod, 9);
        expect(piston.y).toBeCloseTo(0, 9); // both banks are horizontal
        expect(Math.sign(piston.z)).toBe(c.side === "R" ? 1 : -1);
      }
  });

  test("strokes follow the phase: power, exhaust, intake, compression", () => {
    expect([10, 200, 400, 600].map(stroke)).toEqual(["power", "exhaust", "intake", "compression"]);
  });

  test("during START only the left (retard) magneto fires; the plain right magneto is grounded (p. 2)", () => {
    const f = noFailures(S);
    expect(sparks(S, "START", f, 200)).toEqual([1, 1, 1, 1]);
    expect(sparks(S, "BOTH", f, 200)).toEqual([2, 2, 2, 2]);
    expect(sparks(S, "BOTH", f, 20)).toEqual([0, 0, 0, 0]); // too slow for a spark (p. 30: below 50 rpm)
    expect(sparks(S, "OFF", f, 2000)).toEqual([0, 0, 0, 0]);
  });
});

describe("performance chart (IOM Figure C-1, curve 13601)", () => {
  test("rated power: 215 hp at 2,700 rpm, full throttle, sea level standard", () => {
    expect(seaLevelHp(S, 2700, 29.26)).toBeCloseTo(215, 0);
  });

  test("performance cruise 161 hp at 2,450 rpm and economy cruise 140 hp at 2,350 rpm are part-throttle points", () => {
    // both need less than full-throttle manifold pressure at sea level
    const map75 = solveMap(2450, 161),
      map65 = solveMap(2350, 140);
    expect(map75).toBeGreaterThan(24);
    expect(map75).toBeLessThan(27);
    expect(map65).toBeLessThan(map75);
  });

  test("full-throttle power falls with density altitude, and the chart's method agrees at full throttle", () => {
    for (const alt of [0, 4000, 8000, 12000]) {
      const map = fullThrottleMap(S, 2700, alt);
      expect(chartHp(S, 2700, map, alt, atmosphere(alt).t)).toBeCloseTo(fullThrottleHp(S, 2700, alt), 0);
    }
    expect(fullThrottleHp(S, 2700, 8000)).toBeLessThan(170);
    expect(fullThrottleHp(S, 2700, 8000)).toBeGreaterThan(150);
  });

  test("the same manifold pressure makes more power higher up (lower exhaust back pressure, Figure C-1 method)", () => {
    expect(chartHp(S, 2450, 20, 8000, atmosphere(8000).t)).toBeGreaterThan(chartHp(S, 2450, 20, 0, 15));
  });

  test("hot inlet air costs about 1 % per 10 °F (Figure C-1 note 4)", () => {
    const std = chartHp(S, 2450, 24, 0, 15),
      hot = chartHp(S, 2450, 24, 0, 15 + 50 / 1.8);
    expect(1 - hot / std).toBeGreaterThan(0.035);
    expect(1 - hot / std).toBeLessThan(0.06);
  });
});

function solveMap(rpm: number, hp: number) {
  let lo = 10,
    hi = 30;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (seaLevelHp(S, rpm, m) < hp) lo = m;
    else hi = m;
  }
  return lo;
}

describe("the running engine reproduces Table A-1 (p. 51)", () => {
  test("static full throttle at sea level: the governor holds 2,700 rpm at the chart's 29.26 inHg and ~215 hp", () => {
    const { s, c, e, f } = warm();
    c.prop = 1;
    settle(S, s, c, e, f, 30, { map: 40 }, 30); // throttle wide open
    expect(c.throttle).toBe(1);
    expect(s.rpm).toBeGreaterThan(2680);
    expect(s.rpm).toBeLessThan(2720);
    expect(s.map).toBeGreaterThan(29.1);
    expect(s.map).toBeLessThan(29.4);
    // full rich is a little past best power; warm oil
    expect(s.hp).toBeGreaterThan(205);
    expect(s.hp).toBeLessThan(220);
  });

  test("performance cruise, 75 %: 161 hp at 2,450 rpm, best-power mixture, burns 12.8 gph", () => {
    const { s, c, e, f } = warm({ tasKt: 140 });
    c.prop = propFor(2450);
    settle(S, s, c, e, f, 40, { map: 25.5, lambda: S.calibration.lambdaBestPower }, 30);
    for (let i = 0; i < 6; i++) settle(S, s, c, e, f, 15, { map: s.map + (161 - s.hp) / 8.6 });
    expect(s.rpm).toBeCloseTo(2450, -1.5);
    expect(s.hp).toBeCloseTo(161, 0);
    expect(gph(s)).toBeGreaterThan(12.8 * 0.97);
    expect(gph(s)).toBeLessThan(12.8 * 1.03);
  });

  test("economy cruise, 65 %: 140 hp at 2,350 rpm, peak EGT (best economy, p. 39), burns 9.8 gph", () => {
    const { s, c, e, f } = warm({ tasKt: 130 });
    c.prop = propFor(2350);
    settle(S, s, c, e, f, 40, { map: 24.5, lambda: 1.0 }, 30);
    for (let i = 0; i < 6; i++) settle(S, s, c, e, f, 15, { map: s.map + (140 - s.hp) / 8.2, lambda: 1.0 });
    expect(s.hp).toBeCloseTo(140, 0);
    expect(gph(s)).toBeGreaterThan(9.8 * 0.96);
    expect(gph(s)).toBeLessThan(9.8 * 1.04);
  });
});

describe("operation (IOM Engine Initiation and Operation)", () => {
  test("starts per the IOM procedure within the starter's 10 s and idles at 600–700 rpm (p. 26, p. 30)", () => {
    const e = defaultEnvironment(),
      f = noFailures(S);
    const s = initialState(S, e);
    const c: Controls = { ...defaultControls(), throttle: 0.15, mixture: 1, boost: true };
    settle(S, s, c, e, f, 3); // "until a slight but steady flow is indicated" (p. 30)
    c.mags = "START";
    let t = 0;
    while (!s.running && t < 10) {
      settle(S, s, c, e, f, 0.25);
      t += 0.25;
    }
    expect(s.running).toBe(true);
    expect(t).toBeLessThan(S.limits.starterMaxS!.value);
    c.mags = "BOTH";
    c.boost = false;
    settle(S, s, c, e, f, 60, { rpm: 1000 }, 20);
    c.throttle = 0;
    settle(S, s, c, e, f, 30, {}, 10);
    expect(s.rpm).toBeGreaterThanOrEqual(S.limits.idleRpm.min);
    expect(s.rpm).toBeLessThanOrEqual(S.limits.idleRpm.max);
    expect(s.oilP).toBeGreaterThan(S.limits.oilPressMinIdle.value);
  });

  test("magneto check at 2,100–2,200 rpm: each drop under 175 rpm and within 50 rpm of the other (pp. 31–32)", () => {
    const { s, c, e, f } = warm();
    settle(S, s, c, e, f, 20, { rpm: 2150 });
    const drop = (m: "L" | "R") => {
      c.mags = "BOTH";
      settle(S, s, c, e, f, 8);
      const before = s.rpm;
      c.mags = m;
      settle(S, s, c, e, f, 5);
      const d = before - s.rpm;
      c.mags = "BOTH";
      return d;
    };
    const l = drop("L"),
      r = drop("R");
    for (const d of [l, r]) {
      expect(d).toBeGreaterThan(25);
      expect(d).toBeLessThan(S.limits.magDropMax.value);
    }
    expect(Math.abs(l - r)).toBeLessThan(S.limits.magDiffMax.value);
  });

  test("a failed magneto shows as a large drop on that side and a dead engine on it alone", () => {
    const f = { ...noFailures(S), magR: true };
    const { s, c, e } = warm({}, f);
    settle(S, s, c, e, f, 20, { rpm: 2150 });
    const both = s.rpm;
    c.mags = "R";
    settle(S, s, c, e, f, 6);
    expect(both - s.rpm).toBeGreaterThan(S.limits.magDropMax.value);
    expect(s.running).toBe(false);
  });

  test("full-power climb stays inside the limits: CHT, oil temperature and pressure, cooler heat (Table A-2, Table 2)", () => {
    const { s, c, e, f } = warm({ tasKt: 100 });
    c.prop = 1;
    c.mixture = 1;
    settle(S, s, c, e, f, 60, { map: 40 }, 30);
    for (const cy of s.cyl) expect(cy.cht).toBeLessThan(S.limits.chtBestAbove75.value);
    expect(s.oilT).toBeLessThan(S.limits.oilTempMax.value);
    expect(s.oilT).toBeGreaterThan(S.limits.oilTempBest.value);
    expect(s.oilP).toBeGreaterThanOrEqual(S.limits.oilPressNormal.min);
    expect(s.oilP).toBeLessThanOrEqual(S.limits.oilPressNormal.max);
    expect(s.coolerBtu).toBeLessThan(S.oil.coolerMaxBtuMin!);
    expect(s.coolerValve).toBe(1); // above 185 °F the thermostat routes all oil through the cooler
  });

  test("a cold engine's oil pressure stays under the 115 psi starting limit", () => {
    const e = { ...defaultEnvironment(), isaDevC: -15 },
      f = noFailures(S);
    const s = initialState(S, e);
    const c: Controls = { ...defaultControls(), throttle: 0.15, mixture: 1, boost: true, mags: "START" };
    settle(S, s, c, e, f, 3);
    c.mags = "BOTH";
    settle(S, s, c, e, f, 20, { rpm: 1000 });
    expect(s.oilP).toBeGreaterThan(S.limits.oilPressNormal.max);
    expect(s.oilP).toBeLessThan(S.limits.oilPressMaxStart.value);
  });

  test("a long ground run at full power overheats the cylinders: the 465 °F limit needs airflow", () => {
    const { s, c, e, f } = warm();
    settle(S, s, c, e, f, 60, { map: 40 }, 30);
    expect(Math.max(...s.cyl.map((cy) => cy.cht))).toBeGreaterThan(S.limits.chtMax.value);
  });
});

describe("mixture", () => {
  test("power peaks at best power, is ~3.5 % lower at peak EGT, and falls with fuel lean of peak", () => {
    const { lambdaBestPower: bp, peakEgtPower } = S.calibration;
    expect(mixturePower(bp, bp, peakEgtPower)).toBe(1);
    expect(mixturePower(1, bp, peakEgtPower)).toBeCloseTo(peakEgtPower, 6);
    expect(mixturePower(0.75, bp, peakEgtPower)).toBeLessThan(1);
    expect(mixturePower(1.15, bp, peakEgtPower)).toBeLessThan(peakEgtPower / 1.1);
  });

  test("best power is at least 150 °F rich of peak: maximum-power cruise is never leaner than that (p. 39)", () => {
    const rop = -egtOffset(S.calibration.lambdaBestPower);
    expect(rop).toBeGreaterThanOrEqual(S.limits.leanMaxPowerROP.value);
    expect(rop).toBeLessThan(S.limits.leanMaxPowerROP.value + 25);
  });

  test("the servo richens as the air thins, so the same mixture setting is richer at altitude", () => {
    const sl = warm({ tasKt: 120 }),
      hi = warm({ tasKt: 120, altFt: 8000 });
    for (const w of [sl, hi]) {
      w.c.prop = propFor(2450);
      settle(S, w.s, w.c, w.e, w.f, 20, { map: 20 });
    }
    expect(meanLambda(hi.s)).toBeLessThan(meanLambda(sl.s) * 0.92);
  });

  test("leaning through peak: EGT rises to a peak near λ 1 and falls lean of it", () => {
    const { s, c, e, f } = warm({ tasKt: 140, altFt: 6000 });
    c.prop = propFor(2400);
    settle(S, s, c, e, f, 20, { map: 21 });
    const egtAt = (l: number) => {
      settle(S, s, c, e, f, 20, { lambda: l });
      return s.cyl.reduce((a, cy) => a + cy.egt, 0) / 4;
    };
    const rich = egtAt(0.85),
      peak = egtAt(1.0),
      lean = egtAt(1.12);
    expect(peak).toBeGreaterThan(rich + 75);
    expect(peak).toBeGreaterThan(lean + 30);
  });

  test("a partly blocked nozzle leans its own cylinder and raises nozzle pressure (a pressure gauge reads high)", () => {
    const { s, c, e, f } = warm({ tasKt: 140 });
    c.prop = propFor(2450);
    settle(S, s, c, e, f, 20, { map: 24, lambda: 0.85 });
    const nozzle = s.nozzlePsi,
      flow = s.fuel;
    f.nozzle[2] = 0.4;
    settle(S, s, c, e, f, 20);
    expect(s.cyl[2].lambda).toBeGreaterThan(s.cyl[0].lambda * 1.3);
    expect(s.nozzlePsi).toBeGreaterThan(nozzle * 1.2);
    expect(s.fuel).toBeCloseTo(flow, 0); // the servo meters the same total
  });
});

describe("cylinder pressure", () => {
  test("peak pressure comes 10–25° after top centre with 20° advance, later with one plug", () => {
    const { s, c, e, f } = warm({ tasKt: 140 });
    c.prop = propFor(2450);
    settle(S, s, c, e, f, 20, { map: 25.5, lambda: 0.85 });
    const work = ((s.gross / 4) * 745.7 * 120) / s.rpm;
    const both = pressureTrace(S, {
      map: s.map,
      exhaust: 30.5,
      grossWork: work,
      advance: 20,
      burnDeg: 55,
      firing: true,
    });
    const one = pressureTrace(S, {
      map: s.map,
      exhaust: 30.5,
      grossWork: work,
      advance: 20,
      burnDeg: 70,
      firing: true,
    });
    expect(both.peakAtdc).toBeGreaterThanOrEqual(10);
    expect(both.peakAtdc).toBeLessThanOrEqual(25);
    expect(one.peakAtdc).toBeGreaterThan(both.peakAtdc);
    expect(both.peakPsi).toBeGreaterThan(400);
    expect(both.peakPsi).toBeLessThan(1000);
  });
});

test("the registry lists the IO-390", () => {
  expect(ENGINES.map((x) => x.id)).toContain("io390");
});

describe("the page's starting points and limit flags", () => {
  const run = (id: string) => SCENARIOS.find((x) => x.id === id)!.run(S);

  test("each scenario lands where its note says: idle 600–700 rpm, 2,150 rpm run-up, Table A-1 cruise power and fuel flow", () => {
    expect(run("idle").s.rpm).toBeGreaterThanOrEqual(S.limits.idleRpm.min);
    expect(run("idle").s.rpm).toBeLessThanOrEqual(S.limits.idleRpm.max);
    expect(run("runup").s.rpm).toBeCloseTo(2150, -1.5);
    const p = run("cruise75").s,
      e = run("economy65").s;
    expect(p.hp).toBeCloseTo(161, 0);
    expect(gph(p)).toBeGreaterThan(12.8 * 0.97);
    expect(gph(p)).toBeLessThan(12.8 * 1.03);
    expect(e.hp).toBeCloseTo(140, 0);
    expect(gph(e)).toBeGreaterThan(9.8 * 0.96);
    expect(gph(e)).toBeLessThan(9.8 * 1.04);
  });

  test("a full-power climb raises no limit flag; a long full-power ground run flags CHT above 465 °F (Table A-2)", () => {
    const c = run("climb");
    expect(limitFlags(S, c.s, c.env)).toEqual([]);
    const { s, c: ctl, e, f } = warm();
    settle(S, s, ctl, e, f, 60, { map: 40 }, 30);
    expect(limitFlags(S, s, e).some((x) => x.level === "warn" && x.text.startsWith("CHT"))).toBe(true);
  });

  test("low oil quantity is flagged below the 3.5 qt minimum (Table A-1)", () => {
    const x = run("idle");
    expect(limitFlags(S, x.s, { ...x.env, oilQt: 3 }).map((f) => f.src)).toContain(S.limits.oilMinQt.src);
  });
});

describe("failures", () => {
  const FAILURES: [string, (f: Failures) => void][] = [
    ["left magneto", (f) => (f.magL = true)],
    ["both magnetos", (f) => ((f.magL = true), (f.magR = true))],
    ["engine-driven fuel pump", (f) => (f.fuelPump = true)],
    ["air filter", (f) => (f.filter = true)],
    ["starter", (f) => (f.starter = true)],
    ["every spark plug", (f) => f.plugs.forEach((p) => p.fill(true))],
    ["one nozzle", (f) => (f.nozzle[0] = 1)],
    ["every nozzle", (f) => f.nozzle.fill(1)],
    ["starter stuck engaged", (f) => (f.starterStuck = true)],
    ["intake leak", (f) => (f.intakeLeak[1] = 1)],
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

  // each scenario is set up once, then every failure starts from a copy of it
  let setups: { id: string; setup: Setup }[] = [];
  beforeAll(() => {
    setups = scenariosFor(S).map((sc) => ({ id: sc.id, setup: sc.run(S) }));
  }, 60_000);

  test.each(FAILURES)("every scenario keeps a finite state with this failure: %s", (_, fail) => {
    for (const sc of setups) {
      const { s, c, env } = structuredClone(sc.setup);
      const f = noFailures(S);
      fail(f);
      let first: string[] = [];
      for (let i = 0; i < 20 * 60 && !first.length; i++) {
        step(S, s, c, env, f, 1 / 60, 1);
        if (i % 6 === 0) first = nonFinite(s).map((p) => `${sc.id} at ${(i / 60).toFixed(1)} s: ${p}`);
      }
      expect(first).toEqual([]);
    }
  });

  test("a leaking intake runner leans its own cylinder at idle, which shows which one leaks", () => {
    const f = { ...noFailures(S), intakeLeak: [0, 0, 0.6, 0] };
    const { s, c, env } = SCENARIOS.find((x) => x.id === "idle")!.run(S, f);
    settle(S, s, c, env, f, 10);
    const lam = s.cyl.map((cy) => cy.lambda);
    expect(lam[2]).toBeGreaterThan(Math.max(lam[0], lam[1], lam[3]) * 1.3);
  });

  test("with every nozzle blocked no fuel flows, and the engine stops on the ground", () => {
    const { s, c, env } = SCENARIOS.find((x) => x.id === "runup")!.run(S);
    const f = noFailures(S);
    f.nozzle.fill(1);
    for (let i = 0; i < 20 * 60; i++) step(S, s, c, env, f, 1 / 60, 1);
    expect(s.fuel).toBe(0);
    expect(s.rpm).toBe(0);
  });

  test("the boost pump, switched on, keeps the engine running when the engine-driven pump fails", () => {
    const { s, c, env } = SCENARIOS.find((x) => x.id === "cruise75")!.run(S);
    const before = s.hp;
    const f = noFailures(S);
    f.fuelPump = true;
    c.boost = true;
    for (let i = 0; i < 20 * 60; i++) step(S, s, c, env, f, 1 / 60, 1);
    expect(s.hp).toBeGreaterThan(0.9 * before);
  });
});

describe("starter", () => {
  test("the starter is engaged only while the switch is held at START, and an inoperative one never", () => {
    const { s, c, e, f } = warm();
    expect(s.starterEngaged).toBe(false);
    c.mags = "START";
    step(S, s, c, e, f, 1 / 60, 1);
    expect(s.starterEngaged).toBe(true);
    c.mags = "BOTH";
    step(S, s, c, e, f, 1 / 60, 1);
    expect(s.starterEngaged).toBe(false);
    expect(s.starterS).toBe(0);
    f.starter = true;
    c.mags = "START";
    step(S, s, c, e, f, 1 / 60, 1);
    expect(s.starterEngaged).toBe(false);
  });

  test("a starter stuck engaged stays in after release; the running engine outruns it and the 10 s limit is flagged (IOM p. 30)", () => {
    const { s, c, e, f } = warm();
    const rpm = s.rpm;
    f.starterStuck = true;
    for (let i = 0; i < 15 * 60; i++) step(S, s, c, e, f, 1 / 60, 1);
    expect(c.mags).toBe("BOTH");
    expect(s.starterEngaged).toBe(true);
    expect(s.starterS).toBeGreaterThan(S.limits.starterMaxS!.value);
    expect(s.rpm).toBeCloseTo(rpm, -1);
    expect(limitFlags(S, s, e).map((x) => x.src)).toContain(S.limits.starterMaxS!.src);
  });
});

describe("ignition timing", () => {
  test("the spark is at 20° BTC normally and at the start retard while START is held (Table A-1; retard assumed)", () => {
    expect(sparkBTC(S, "BOTH")).toBe(S.ignition.advanceBTC);
    expect(sparkBTC(S, "START")).toBe(-S.ignition.startRetardATC);
    const t = pressureTrace(S, {
      map: 29.9,
      exhaust: 30.5,
      grossWork: 0,
      advance: sparkBTC(S, "START"),
      burnDeg: 55,
      firing: false,
    });
    expect(t.psi.every(Number.isFinite)).toBe(true);
  });
});
