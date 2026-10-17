// vitest: isolate
/** The parallel induction paths join at the throttle body (AMM 71-60 PDF 2542). */
import { afterEach, expect, test, vi } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { noFailures, step } from "@/engines/model/engine";
import { scenarioById } from "@/engines/model/scenarios";
import { inductionCal } from "@/engines/model/induction";
import { atmosphere, ramPressure } from "@/engines/model/atmosphere";
import * as turbo from "@/engines/model/turbo";

afterEach(() => vi.restoreAllMocks());
test("the working intercooler passes the failed-path return flow included in compressor power (AMM 71-60)", () => {
  const x = scenarioById(K, "cruise")!.run(K),
    f = noFailures(K);
  f.turboInternal = [true, false];
  const power = vi.spyOn(turbo, "equilibriumPR"),
    drop = vi.spyOn(turbo, "intercoolerDrop");
  step(K, x.s, x.c, x.env, f, 0.25);
  const flow = power.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[2]);
  const cooled = drop.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[1]);
  expect(flow.length).toBeGreaterThan(0);
  expect(cooled).toEqual(flow);
});

// Each operating path has one intercooler with its own share of rated flow.
test.each([
  [true, false],
  [false, true],
  [false, false],
  [true, true],
])("intercooler drop uses the operating paths' rated flow for left/right failures %s/%s (AMM 71-60)", (left, right) => {
  const x = scenarioById(K, "cruise")!.run(K),
    f = noFailures(K);
  f.turboInternal = [left, right];
  const ref = turbo.turboRef(K, inductionCal(K).ve),
    drop = vi.spyOn(turbo, "intercoolerDrop"),
    power = vi.spyOn(turbo, "equilibriumPR");
  step(K, x.s, x.c, x.env, f, 0.25);
  const working = K.turbo!.count - Number(left) - Number(right);
  const calls = drop.mock.calls.filter((c) => c[0] === K.turbo);
  if (working === 0) {
    expect(calls.length).toBeGreaterThan(0);
    const flows = power.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[2]);
    calls.forEach((call, i) => {
      expect(call[1]).toBe(flows[i]);
      expect(call[2]).toBe(ref.mRef);
    });
    for (let i = 0; i < 800; i++) step(K, x.s, x.c, x.env, f, 0.05);
    const air = atmosphere(x.env.altFt, x.env.isaDevC);
    const source = ramPressure(air.p, air.t, x.env.tasKt, K.induction?.ramEta ?? 0.7);
    expect(x.s.deckInHg).toBeLessThan(source);
    expect(Number.isFinite(x.s.compressorOutC)).toBe(true);
    expect(x.s.turboRpm).toEqual([0, 0]);
    return;
  }
  const flows = power.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[2]);
  expect(calls.length).toBeGreaterThan(0);
  calls.forEach((call, i) => {
    expect(call[1]).toBe(flows[i]);
    expect(call[2]).toBe(ref.mRef * (working / K.turbo!.count));
    expect(drop.mock.results[i].value).toBeCloseTo(
      K.turbo!.intercooler.dpInHgRated *
        (flows[i] / working / (ref.mRef / K.turbo!.count)) ** 2 *
        (call[4] / Math.max(call[3], 1e-3)),
      12,
    );
  });
});
