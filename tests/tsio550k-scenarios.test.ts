/**
 * Where each TSIO-550-K "Start from" setup lands (engines/tsio550k/scenarios.ts) against the targets its note gives
 * from the SR22T POH 13772-007 (Sections 4 and 5). The lists, the controls each setup leaves and the page's worker are
 * in tests/tsio550k-store.test.ts.
 */
import { describe, expect, test } from "vitest";
import { LEAN_DWELL_S, leanGaugeAbove, limitFlags } from "@/engines/model/alerts";
import { noFailures, step, type EngineState } from "@/engines/model/engine";
import { egtOffset } from "@/engines/model/mixture";
import { scenarioById, scenariosFor } from "@/engines/model/scenarios";
import { meanLambda } from "@/engines/model/trim";
import { TSIO550K } from "@/engines/tsio550k/spec";

const K = TSIO550K;
const hottestCht = (s: EngineState) => Math.max(...s.cyl.map((c) => c.cht));

describe("TSIO-550-K scenarios", () => {
  test("every scenariosFor run ends in a finite state: a fixed governor has no 0/0 propeller setting", () => {
    const bad = scenariosFor(K).flatMap((sc) => {
      const { s } = sc.run(K);
      return (["rpm", "map", "fuel", "govRpm"] as const)
        .filter((k) => !Number.isFinite(s[k]))
        .map((k) => `${sc.id}: ${k} = ${s[k]}`);
    });
    expect(bad).toEqual([]);
  }, 120_000);
});

describe("each -K scenario lands where its note says (POH 4-12 to 4-23, 5-33, 5-34)", () => {
  /**
   * A scenario's landing, then a minute at real time in the page's 1/60 s frames: the readings' means, the rpm and MAP
   * ranges, the monitor's Peak reading (°F below peak EGT at the mean λ, components/engine/Monitor.tsx) and how often
   * the "Leaned at" flag came or went. Each scenario lands once for the describe; the results are only read.
   */
  const land = (id: string) => {
    const x = scenarioById(K, id)!.run(K);
    const f = noFailures(K);
    const leanFlag = () =>
      limitFlags(K, x.s, x.env, { failures: f, controls: x.c }).some((fl) => fl.src === K.limits.leanMaxMap!.src);
    let map = 0,
      fuel = 0,
      hp = 0,
      peak = 0,
      rLo = Infinity,
      rHi = -Infinity,
      mLo = Infinity,
      mHi = -Infinity,
      rpmWarn = false,
      leanWas = leanFlag(),
      leanOn = leanWas,
      leanFlips = 0;
    const n = 60 * 60;
    for (let i = 0; i < n; i++) {
      step(K, x.s, x.c, x.env, f, 1 / 60);
      map += x.s.map / n;
      fuel += x.s.fuel / n;
      hp += x.s.hp / n;
      peak += -egtOffset(meanLambda(x.s), K.calibration.richMisfireLambda) / n;
      rLo = Math.min(rLo, x.s.rpm);
      rHi = Math.max(rHi, x.s.rpm);
      mLo = Math.min(mLo, x.s.map);
      mHi = Math.max(mHi, x.s.map);
      if (i % 30 === 0) rpmWarn ||= limitFlags(K, x.s, x.env).some((fl) => fl.cas === "RPM");
      const lean = leanFlag();
      if (lean !== leanWas) leanFlips++;
      leanWas = lean;
      leanOn ||= lean;
    }
    return { x, map, gph: fuel / 6, hp, peak, rLo, rHi, mHi, band: mHi - mLo, rpmWarn, leanOn, leanFlips };
  };
  const landings = new Map<string, ReturnType<typeof land>>();
  const landed = (id: string) => landings.get(id) ?? landings.set(id, land(id)).get(id)!;
  // the fixed governor holds 2,500 rpm (POH 7-32), never into the RPM warning (POH 2-9)
  const governs = (r: ReturnType<typeof landed>) => r.rLo >= 2480 && r.rHi <= 2520 && !r.rpmWarn;

  test("idle 600–750 rpm (fit 700 ± 25) and run-up at 1,700 rpm (POH 4-12, 4-15)", () => {
    const idle = landed("idle"),
      runup = landed("runup");
    expect(Math.abs(idle.x.s.rpm - 700)).toBeLessThanOrEqual(25);
    expect(Math.abs(runup.x.s.rpm - 1700)).toBeLessThanOrEqual(25);
  }, 120_000);

  test("takeoff: about 2,500 rpm and 36.0 in.Hg, fuel flow in the AMM band; cold oil 36.0–37.0 in.Hg, the MAN PRESSURE caution only above 36.5 (POH 4-14, 4-17, 3A-9)", () => {
    const t = landed("takeoff");
    expect(governs(t)).toBe(true);
    expect(Math.abs(t.map - 36.0)).toBeLessThanOrEqual(0.3);
    expect(t.gph).toBeGreaterThanOrEqual(36.65);
    expect(t.gph).toBeLessThanOrEqual(39.8);
    const c = landed("coldoil");
    expect(c.map).toBeGreaterThan(36.0);
    expect(c.map).toBeLessThanOrEqual(37.0);
    const caution = limitFlags(K, c.x.s, c.x.env).some((fl) => fl.cas === "MAN PRESSURE");
    expect(caution).toBe(c.x.s.map > 36.5);
  }, 120_000);

  test("climb: MAP holds 36.0 to about 18,000 ft, every CHT ≤ 420 °F, full-rich fuel flow 36 ± 1.5 GPH (POH 4-14, 4-19, 5-28)", () => {
    const r = landed("climb");
    expect(governs(r)).toBe(true);
    expect(Math.abs(r.map - 36.0)).toBeLessThanOrEqual(0.3);
    expect(hottestCht(r.x.s)).toBeLessThanOrEqual(420);
    expect(Math.abs(r.gph - 36.08)).toBeLessThanOrEqual(1.5);
  }, 120_000);

  test("cruise climb, cruise and high cruise: MAP at or under 30.5 in.Hg (above 18,000 ft not under 15), the cruises at 16.4 GPH and 75 % ± 4 %, CHT under 420 °F, the governor steady (POH 4-21, 4-22, 5-33, 5-34, 2-6)", () => {
    for (const id of ["cruiseclimb", "cruise", "highcruise"]) {
      const r = landed(id);
      expect(governs(r), `${id} rpm ${r.rLo}–${r.rHi}`).toBe(true);
      expect(r.map, `${id} MAP`).toBeLessThanOrEqual(30.5);
      expect(r.band, `${id} MAP band`).toBeLessThan(1.0);
      expect(hottestCht(r.x.s), `${id} CHT`).toBeLessThan(420);
      if (id !== "cruiseclimb") {
        expect(Math.abs(r.gph - 16.4), `${id} GPH`).toBeLessThanOrEqual(0.1);
        expect(Math.abs(r.hp / (75 * 3.15) - 1), `${id} power`).toBeLessThanOrEqual(0.04);
      }
      if (id === "highcruise") expect(r.map).toBeGreaterThanOrEqual(15);
    }
  }, 180_000);

  // Lean of peak means at least 35 °F below peak: POH 4-22's "50-75 °F less than its peak" less a 15 °F reading
  // tolerance. About peak means within 10 °F of it, a fifth of the POH's 50 °F. At 25,000 ft no mixture holds
  // 16.4 ± 0.1 GPH and sits lean of peak (engines/tsio550k/SOURCES.md), so the high-cruise note says it reads at about
  // peak.
  test("the leaned setups sit on the side of peak their notes give: cruise climb and cruise at least 35 °F lean of peak, high cruise at 16.4 GPH within 10 °F of peak (POH 4-22, 5-32, 5-34)", () => {
    const says = (id: string) => {
      const sc = scenarioById(K, id)!;
      return `${sc.label}. ${sc.note(K)}`;
    };
    for (const id of ["cruiseclimb", "cruise"]) {
      const r = landed(id);
      expect(says(id), id).toContain("lean of peak");
      expect(r.peak, `${id} °F below peak EGT`).toBeGreaterThanOrEqual(35);
      expect(meanLambda(r.x.s), `${id} λ (the monitor's LOP side)`).toBeGreaterThan(1.01);
    }
    const h = landed("highcruise");
    expect(says("highcruise")).toContain("16.4 gph reads at about peak");
    expect(Math.abs(h.peak), "highcruise °F from peak EGT").toBeLessThanOrEqual(10);
  }, 180_000);

  test("the leaned setups remain below 30.5 in.Hg and raise no 'Leaned at' flag for a minute (POH 4-22; engines/model/alerts.ts LEAN_DWELL_S)", () => {
    for (const id of ["cruiseclimb", "cruise", "highcruise"]) {
      const r = landed(id);
      expect(leanGaugeAbove(r.mHi, K.limits.leanMaxMap!.value), `${id} MAP up to ${r.mHi}`).toBe(false);
      expect(r.leanFlips, `${id} flag set/clear transitions`).toBe(0);
      expect(r.leanOn, id).toBe(false);
    }
  }, 180_000);

  test("descent: MAP 18–20 in.Hg with every CHT at 240 °F or above (POH 4-23)", () => {
    const r = landed("descent");
    expect(r.map).toBeGreaterThanOrEqual(18);
    expect(r.map).toBeLessThanOrEqual(20);
    expect(Math.min(...r.x.s.cyl.map((cy) => cy.cht))).toBeGreaterThanOrEqual(240);
  }, 120_000);
});

describe("the leaning flag in a real violation (POH 4-22; engines/model/alerts.ts LEAN_DWELL_S)", () => {
  /**
   * The cruise setup (10,000 ft, leaned to 16.4 GPH at 30.4 in.Hg), on a day `isaDevC` from standard, with the lever
   * full forward for `fullS` seconds and then back to the cruise setting, the mixture left where it was: a minute in
   * the page's 1/60 s frames. When the gauge first reads above 30.5, when the flag first shows, and how often it came
   * or went.
   */
  const push = (isaDevC: number, fullS: number) => {
    const x = scenarioById(K, "cruise")!.run(K);
    const f = noFailures(K);
    x.env = { ...x.env, isaDevC };
    const cruise = x.c.throttle;
    const flag = () =>
      limitFlags(K, x.s, x.env, { failures: f, controls: x.c }).some((fl) => fl.src === K.limits.leanMaxMap!.src);
    let crossed = NaN,
      raised = NaN,
      flips = 0,
      was = flag();
    for (let i = 0; i < 60 * 60; i++) {
      const t = i / 60;
      x.c.throttle = t < fullS ? 1 : cruise;
      step(K, x.s, x.c, x.env, f, 1 / 60);
      const now = flag();
      if (Number.isNaN(crossed) && leanGaugeAbove(x.s.map, K.limits.leanMaxMap!.value)) crossed = t + 1 / 60;
      if (Number.isNaN(raised) && now) raised = t + 1 / 60;
      if (now !== was) flips++;
      was = now;
    }
    return { crossed, raised, flips, x };
  };

  test("leaned at full throttle on an ISA +30 °C day the flag shows within LEAN_DWELL_S of the gauge passing 30.5 and stays", () => {
    const r = push(30, 60);
    expect(r.crossed).toBeLessThan(1);
    // the dwell plus one frame: the cruise setting leaves nothing on the timer
    expect(r.raised - r.crossed).toBeLessThanOrEqual(LEAN_DWELL_S + 1 / 60);
    expect(r.raised - r.crossed).toBeGreaterThan(LEAN_DWELL_S - 0.5);
    expect(r.flips).toBe(1);
    expect(r.x.s.map).toBeGreaterThan(35);
  }, 60_000);

  test("on a standard day the lever past 30.5 for 1 s raises no flag; for 20 s it raises one, cleared once back at the cruise setting", () => {
    const blip = push(0, 1);
    expect(blip.crossed).toBeLessThan(1);
    expect(blip.flips).toBe(0);
    const held = push(0, 20);
    expect(held.raised - held.crossed).toBeLessThanOrEqual(LEAN_DWELL_S + 1 / 60);
    expect(held.raised - held.crossed).toBeGreaterThan(LEAN_DWELL_S - 0.5);
    expect(held.flips).toBe(2);
    expect(held.x.s.leanOver).toBe(false);
  }, 60_000);
});
