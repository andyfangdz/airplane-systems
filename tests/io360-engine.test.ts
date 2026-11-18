import { expect, test } from "vitest";
import { IO360_C172S as cessna } from "@/engines/io360-l2a/spec";
import { IO360_DA40 as diamond } from "@/engines/io360-m1a/spec";
import { limitFlags } from "@/engines/model/alerts";
import { governedRpm, noFailures } from "@/engines/model/engine";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { settle } from "@/engines/model/trim";
import { scenarioById, warmStart, propFor } from "@/engines/model/scenarios";

test("C172S POH 2-6 and Fig. 5-8: fixed-pitch RPM balances torque at static and cruise conditions", () => {
  const f = noFailures(cessna);
  const { s, c, env } = warmStart(cessna);
  c.throttle = 1;
  settle(cessna, s, c, env, f, 45, { lambda: cessna.calibration.lambdaBestPower });
  expect(s.rpm).toBeGreaterThanOrEqual(2300);
  expect(s.rpm).toBeLessThanOrEqual(2400);
  const pitch = s.beta,
    staticRpm = s.rpm;
  const reference = structuredClone(s);
  settle(cessna, reference, { ...c }, env, f, 15);
  c.prop = 0;
  settle(cessna, s, c, env, f, 15);
  expect(s.rpm).toBe(reference.rpm);
  expect(governedRpm(cessna, 1)).toBe(0);
  env.tasKt = 70;
  settle(cessna, s, c, env, f, 30);
  expect(s.rpm).toBeGreaterThan(staticRpm + 80);
  expect(s.beta).toBe(pitch);
  expect(s.governing).toBe(false);
  for (const [id, rpm, hp, gph] of [
    ["cruise75", 2550, 131.4, 9.9],
    ["economy65", 2500, 117, 9],
  ] as const) {
    const x = scenarioById(cessna, id)!.run(cessna);
    expect(x.s.rpm).toBeCloseTo(rpm, 0);
    expect(Math.abs(x.s.hp - hp)).toBeLessThan(4);
    expect(Math.abs(x.s.fuel / AVGAS_LB_GAL - gph)).toBeLessThan(0.35);
  }
});

test("DA40 AFMS SA06-52 pp. 2–3 and M1A IOM p. 18: governed pitch, 2700 RPM and published cruise settings", () => {
  const { s, c, env } = scenarioById(diamond, "takeoff")!.run(diamond);
  expect(Math.abs(s.rpm - 2700)).toBeLessThan(8);
  const beta = s.beta;
  c.prop = propFor(diamond, 2450);
  settle(diamond, s, c, env, noFailures(diamond), 30);
  expect(Math.abs(s.rpm - 2450)).toBeLessThan(8);
  expect(s.governing).toBe(true);
  expect(s.beta).toBeGreaterThan(beta);
  for (const [id, rpm, hp, gph] of [
    ["cruise75", 2450, 135, 11],
    ["economy65", 2350, 117, 8.5],
  ] as const) {
    const x = scenarioById(diamond, id)!.run(diamond);
    expect(x.s.rpm).toBeCloseTo(rpm, 0);
    expect(x.s.hp).toBeCloseTo(hp, 0);
    expect(Math.abs(x.s.fuel / AVGAS_LB_GAL - gph)).toBeLessThan(0.35);
    expect(x.s.beta).toBeGreaterThan(11);
    expect(x.s.beta).toBeLessThan(30);
  }
});
test("C172S POH 7-36 and DA40 AMM 71-60: a blocked filter opens the Cessna door, the Diamond requires its lever", () => {
  for (const spec of [cessna, diamond]) {
    const f = noFailures(spec);
    const { s, c, env } = scenarioById(spec, "takeoff")!.run(spec);
    f.filter = true;
    settle(spec, s, c, env, f, 10);
    expect(s.altAirOpen).toBe(spec === cessna);
    if (spec === diamond) {
      const blocked = s.map;
      c.altAir = true;
      settle(spec, s, c, env, f, 10);
      expect(s.map).toBeGreaterThan(blocked + 3);
    }
  }
});

test("C172S POH 4-16, 4-29 and DA40 AFM 4A-19–21: warm idle and magneto checks", () => {
  for (const [spec, target, rpm, limit] of [
    [cessna, 600, 1800, 150],
    [diamond, 700, 2000, 175],
  ] as const) {
    const idle = scenarioById(spec, "idle")!.run(spec);
    expect(Math.abs(idle.s.rpm - target)).toBeLessThan(spec === cessna ? 20 : 100);
    const runup = scenarioById(spec, "runup")!.run(spec);
    expect(Math.abs(runup.s.rpm - rpm)).toBeLessThan(5);
    const drops = (["L", "R"] as const).map((mags) => {
      const state = structuredClone(runup.s);
      settle(spec, state, { ...runup.c, mags }, runup.env, noFailures(spec), 6);
      return runup.s.rpm - state.rpm;
    });
    for (const drop of drops) {
      expect(drop).toBeGreaterThan(0);
      expect(drop).toBeLessThanOrEqual(limit);
    }
    expect(Math.abs(drops[0] - drops[1])).toBeLessThanOrEqual(50);
  }
});

test("C172S POH 2-6 and DA40 AFM 2-5: installed oil pressure maxima apply in cruise", () => {
  for (const [spec, maximum] of [
    [cessna, 115],
    [diamond, 98],
  ] as const) {
    const { s, env } = scenarioById(spec, "cruise75")!.run(spec);
    s.oilP = maximum + 1;
    expect(limitFlags(spec, s, env)).toContainEqual({
      level: "warn",
      text: `Oil pressure ${maximum + 1} psi: above the ${maximum} psi maximum`,
      src: spec.limits.oilPressMaxStart.src,
    });
  }
});
