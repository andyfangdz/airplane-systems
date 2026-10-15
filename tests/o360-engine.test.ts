/**
 * The standalone engine model against what Lycoming documents for the O-360-A1D (Operator's Manual 60297-12).
 * Chart values were digitized (engines/o360/SOURCES.md); tolerances allow for that and for model shape.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { O360 } from "@/engines/o360/spec";
import { ENGINES } from "@/engines";
import { limitFlags } from "@/engines/model/alerts";
import { mixtureChamberC } from "@/engines/model/carburetor";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  prime,
  sparks,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import { minimumFuelFlow, seaLevelHp } from "@/engines/model/performance";
import { scenariosFor, SCENARIOS, warmStart, type Setup } from "@/engines/model/scenarios";
import { meanLambda, settle } from "@/engines/model/trim";

const S = O360;
const carb = S.fuelSystem.kind === "carburetor" ? S.fuelSystem : null!;
const gph = (s: EngineState) => s.fuel / 6;
const run = (id: string, f?: Failures) => SCENARIOS.find((x) => x.id === id)!.run(S, f);
const warm = (env: Partial<Environment> = {}, f: Failures = noFailures(S)) => ({ ...warmStart(S, env, f), f });

describe("O-360-A specifications (OM pp. 1-1–1-3, 2-1)", () => {
  test("four cylinders, 361 cu in from 5.125 in bore and 4.375 in stroke, 8.5:1, 25° BTC", () => {
    const g = S.geometry;
    expect(g.cylinders).toHaveLength(4);
    expect((Math.PI / 4) * g.boreIn ** 2 * g.strokeIn * 4).toBeCloseTo(g.displacementIn3, -0.5);
    expect(g.compressionRatio).toBe(8.5);
    expect(S.ignition.advanceBTC).toBe(25);
  });

  test("the A1D has a float carburetor (MA-4-5) and a retard-breaker left magneto (Table 1)", () => {
    expect(S.fuelSystem.kind).toBe("carburetor");
    expect(S.fuelSystem.unit).toBe("Marvel-Schebler MA-4-5");
    expect(S.ignition.retardMag).toBe("L");
    // at START only the retard magneto fires
    expect(sparks(S, "START", noFailures(S), 150)).toEqual([1, 1, 1, 1]);
  });

  test("the registry lists the O-360 after the IO-390", () => {
    expect(ENGINES.map((x) => x.id)).toEqual(["io390", "o360"]);
  });
});

describe("power (curve 13358, OM Figure 3-42) and fuel (OM p. 3-12, Figure 3-39)", () => {
  test("rated power: 180 hp at 2,700 rpm at the chart's full-throttle manifold pressure", () => {
    const l = S.performance.lines.find((x) => x.rpm === 2700)!;
    expect(seaLevelHp(S, 2700, l.ftMap)).toBeCloseTo(180, -0.5);
  });

  test("takeoff: full throttle, full rich at 70 kt governs 2,700 rpm and makes ~180 hp", () => {
    const { s } = run("takeoff");
    expect(s.rpm).toBeCloseTo(2700, -1.5);
    expect(s.hp).toBeGreaterThan(174);
    expect(s.hp).toBeLessThan(184);
    expect(s.governing).toBe(true);
  });

  test("full rich at full power burns at least the minimum allowable fuel flow (Figure 3-39)", () => {
    const { s } = run("takeoff");
    expect(gph(s)).toBeGreaterThan(minimumFuelFlow(S, s.pct)!);
  });

  test("performance cruise, 75 %: 135 hp at 2,450 rpm at best power burns 10.5 gph (p. 3-12, p. 3-6)", () => {
    const { s } = run("cruise75");
    expect(s.hp).toBeCloseTo(135, 0);
    expect(s.rpm).toBeCloseTo(2450, -1.5);
    expect(gph(s)).toBeGreaterThan(10.5 * 0.97);
    expect(gph(s)).toBeLessThan(10.5 * 1.04);
    expect(s.map).toBeLessThan(28); // part throttle
  });

  test("economy cruise, 65 %: 117 hp at 2,350 rpm at peak EGT burns the Figure 3-39 minimum, under the table's 9.5 gph", () => {
    const { s } = run("economy65");
    expect(s.hp).toBeCloseTo(117, 0);
    expect(meanLambda(s)).toBeCloseTo(1, 1);
    expect(Math.abs(gph(s) - minimumFuelFlow(S, 65)!)).toBeLessThan(0.4);
    expect(gph(s)).toBeLessThan(9.5);
  });

  test("the carburetor richens as the air thins: the same mixture setting is richer at altitude (OM p. 3-6)", () => {
    const lam = (altFt: number) => {
      const x = warm({ altFt, tasKt: 120 });
      x.c.prop = 0.6;
      settle(S, x.s, x.c, x.env, x.f, 30, { map: 20 });
      return meanLambda(x.s);
    };
    expect(lam(8000)).toBeLessThan(lam(0) * 0.95);
  });
});

describe("starting, idle and the run-up", () => {
  const crank = (strokes: number) => {
    const e = defaultEnvironment(),
      f = noFailures(S);
    const s = initialState(S, e);
    // float type (OM p. 3-1): mixture full rich, boost pump on, throttle a quarter open, prime, starter
    const c: Controls = { ...defaultControls(), throttle: 0.25, mixture: 1, boost: true, mags: "START" };
    s.lastThrottle = c.throttle;
    prime(S, s, strokes);
    let t = 0;
    while (!(s.running && s.rpm > 400) && t < 10) {
      step(S, s, c, e, f, 0.05);
      t += 0.05;
    }
    return t;
  };

  test("primed with one to three strokes it fires within a second; unprimed it takes longer; overprimed floods (p. 3-2)", () => {
    for (const n of [1, 2, 3]) expect(crank(n)).toBeLessThan(1);
    expect(crank(0)).toBeGreaterThan(crank(2) + 1);
    expect(crank(8)).toBeGreaterThan(crank(2) + 1);
  });

  test("warm idle, throttle closed, sits in the model's 600–700 rpm with oil pressure above the 25 psi idling minimum", () => {
    const { s } = run("idle");
    expect(s.rpm).toBeGreaterThanOrEqual(S.limits.idleRpm.min);
    expect(s.rpm).toBeLessThanOrEqual(S.limits.idleRpm.max);
    expect(s.oilP).toBeGreaterThan(S.limits.oilPressMinIdle.value);
  });

  test("idle mixture check: pulling the mixture slowly to cut-off gives a pick-up of up to about 50 rpm before it quits (p. 5-4)", () => {
    const x = run("idle");
    const r0 = x.s.rpm;
    let peak = r0;
    for (let m = 1; m > 0.02 && x.s.running; m -= 0.01) {
      x.c.mixture = m;
      settle(S, x.s, x.c, x.env, noFailures(S), 0.6);
      peak = Math.max(peak, x.s.rpm);
    }
    expect(peak - r0).toBeGreaterThan(20);
    expect(peak - r0).toBeLessThanOrEqual(50);
    x.c.mixture = 0;
    settle(S, x.s, x.c, x.env, noFailures(S), 10);
    expect(x.s.running).toBe(false);
  });

  test("magneto check at 1,800–2,000 rpm: each drop under 175 rpm and within 50 rpm of the other (p. 3-5)", () => {
    const x = run("runup");
    const f = noFailures(S);
    const drop = (m: "L" | "R") => {
      x.c.mags = "BOTH";
      settle(S, x.s, x.c, x.env, f, 8);
      const before = x.s.rpm;
      x.c.mags = m;
      settle(S, x.s, x.c, x.env, f, 5);
      x.c.mags = "BOTH";
      return before - x.s.rpm;
    };
    const l = drop("L"),
      r = drop("R");
    for (const d of [l, r]) {
      expect(d).toBeGreaterThan(25);
      expect(d).toBeLessThan(S.limits.magDropMax.value);
    }
    expect(Math.abs(l - r)).toBeLessThan(S.limits.magDiffMax.value);
  });

  test("a fine-pitch propeller turns faster on the ground at full throttle than the run-up, below rated rpm", () => {
    const x = run("runup");
    x.c.throttle = 1;
    settle(S, x.s, x.c, x.env, noFailures(S), 15);
    expect(x.s.rpm).toBeGreaterThan(2200);
    expect(x.s.rpm).toBeLessThan(S.rating.rpm);
  });
});

describe("limits (OM pp. 3-11–3-12)", () => {
  test("a full-power climb stays inside the limits and raises no flag", () => {
    const x = run("climb");
    expect(Math.max(...x.s.cyl.map((c) => c.cht))).toBeLessThan(S.limits.chtMax.value);
    expect(x.s.oilT).toBeLessThan(S.limits.oilTempMax.value);
    expect(x.s.oilP).toBeGreaterThan(S.limits.oilPressNormal.min);
    expect(x.s.oilP).toBeLessThan(S.limits.oilPressNormal.max);
    expect(limitFlags(S, x.s, x.env)).toEqual([]);
  });

  test("low oil quantity is flagged below the 2 qt minimum safe quantity", () => {
    const x = run("idle");
    expect(limitFlags(S, x.s, { ...x.env, oilQt: 1.5 }).map((f) => f.src)).toContain(S.limits.oilMinQt.src);
  });
});

describe("carburetor heat and icing (OM pp. 3-8–3-9)", () => {
  test("the mixture chamber runs colder than the incoming air, never by more than the manual's 70 °F", () => {
    for (const map of [8, 15, 22, 29])
      for (const far of [0, 0.06, 0.09]) {
        const drop = (15 - mixtureChamberC(carb, 15, far, map, 29.9)) * 1.8;
        expect(drop).toBeGreaterThanOrEqual(0);
        expect(drop).toBeLessThanOrEqual(70 + 1e-9);
      }
    const { s } = run("cruise75");
    expect(s.carbC).toBeLessThan(s.inletC - 10);
  });

  test("carburetor heat warms the induction air, richens the mixture and costs a little manifold pressure and power", () => {
    const x = run("cruise75");
    const f = noFailures(S);
    const before = { map: x.s.map, hp: x.s.hp, lam: meanLambda(x.s), inlet: x.s.inletC };
    x.c.carbHeat = 1;
    settle(S, x.s, x.c, x.env, f, 20);
    expect(x.s.inletC).toBeGreaterThan(before.inlet + 25);
    expect(meanLambda(x.s)).toBeLessThan(before.lam);
    expect(x.s.map).toBeLessThan(before.map);
    expect(before.map - x.s.map).toBeLessThan(1.5);
    expect(x.s.hp).toBeLessThan(before.hp);
  });

  test("in moist air ice builds at part throttle and manifold pressure falls at constant rpm; full heat melts it and recovers", () => {
    const x = run("carbice");
    const f = noFailures(S);
    const start = x.s.map;
    settle(S, x.s, x.c, x.env, f, 180);
    expect(x.s.ice).toBeGreaterThan(0.2);
    expect(x.s.map).toBeLessThan(start - 1);
    expect(x.s.rpm).toBeCloseTo(2350, -1.5); // the governor holds rpm: manifold pressure is the sign
    expect(limitFlags(S, x.s, x.env).some((l) => l.text.startsWith("Carburetor ice"))).toBe(true);
    const iced = x.s.map;
    x.c.carbHeat = 1;
    settle(S, x.s, x.c, x.env, f, 60);
    expect(x.s.ice).toBe(0);
    expect(x.s.map).toBeGreaterThan(iced + 1);
  });

  test("no ice forms in dry air, or when it is colder than about 20 °F outside (p. 3-8: 20 to 90 °F)", () => {
    const dry = run("carbice");
    dry.env.humidity = 0;
    dry.s.ice = 0;
    settle(S, dry.s, dry.c, dry.env, noFailures(S), 120);
    expect(dry.s.ice).toBe(0);
    const cold = warm({ tasKt: 130, altFt: 3000, isaDevC: -25, humidity: 0.9 });
    cold.c.prop = 0.4;
    settle(S, cold.s, cold.c, cold.env, cold.f, 120, { map: 19 });
    expect(cold.s.ice).toBe(0);
  });
});

describe("fuel supply and failures", () => {
  test("a parked engine keeps its float bowl full, even if a frame's time step comes out zero or negative", () => {
    const e = defaultEnvironment();
    const s = initialState(S, e);
    for (const dt of [1 / 60, 0, -0.01, 0.5]) step(S, s, defaultControls(), e, noFailures(S), dt);
    expect(s.bowl).toBe(S.fuelSystem.kind === "carburetor" ? S.fuelSystem.bowlLb : 0);
  });

  test("with the engine-driven pump failed the float bowl runs dry and the engine quits; the boost pump keeps it running", () => {
    const f = { ...noFailures(S), fuelPump: true };
    const x = run("cruise75");
    settle(S, x.s, x.c, x.env, f, 60);
    expect(x.s.bowl).toBe(0);
    expect(x.s.fuel).toBe(0);
    expect(x.s.running).toBe(false);
    const y = run("cruise75");
    const before = y.s.hp;
    y.c.boost = true;
    settle(S, y.s, y.c, y.env, f, 60);
    expect(y.s.hp).toBeGreaterThan(0.95 * before);
  });

  test("a leaking intake pipe leans its own cylinder at idle and runs rough, and hardly matters at full throttle", () => {
    const f = { ...noFailures(S), intakeLeak: [0, 0, 0.6, 0] };
    const idle = run("idle", f);
    const lam = idle.s.cyl.map((c) => c.lambda);
    expect(lam[2]).toBeGreaterThan(Math.max(lam[0], lam[1], lam[3]) * 1.3);
    expect(idle.s.rough).toBeGreaterThan(run("idle").s.rough + 0.1);
    const to = run("takeoff", f);
    expect(to.s.hp).toBeGreaterThan(0.95 * run("takeoff").s.hp);
  });

  test("pumping the throttle with the engine stopped puts fuel into the intake (the accelerator pump)", () => {
    const e = defaultEnvironment();
    const s = initialState(S, e);
    const c = defaultControls();
    for (const t of [1, 0, 1, 0]) {
      c.throttle = t;
      step(S, s, c, e, noFailures(S), 0.1);
    }
    expect(s.cyl.every((cy) => cy.puddle > 0)).toBe(true);
    expect(s.bowl).toBeLessThan(carb.bowlLb);
  });

  const FAILURES: [string, (f: Failures) => void][] = [
    ["left magneto", (f) => (f.magL = true)],
    ["both magnetos", (f) => ((f.magL = true), (f.magR = true))],
    ["engine-driven fuel pump", (f) => (f.fuelPump = true)],
    ["air filter", (f) => (f.filter = true)],
    ["every spark plug", (f) => f.plugs.forEach((p) => p.fill(true))],
    ["intake leak", (f) => (f.intakeLeak[1] = 1)],
    ["starter stuck engaged", (f) => (f.starterStuck = true)],
  ];
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
      c.carbHeat = 0.5;
      let first: string[] = [];
      for (let i = 0; i < 20 * 60 && !first.length; i++) {
        step(S, s, c, env, f, 1 / 60, 1);
        if (i % 6 === 0) first = nonFinite(s).map((p) => `${sc.id} at ${(i / 60).toFixed(1)} s: ${p}`);
      }
      expect(first).toEqual([]);
    }
  });
});
