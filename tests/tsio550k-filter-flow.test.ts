// vitest: isolate
/** Automatic alternate air under induction failures (POH 3-27, 3A-11, 7-37). */
import { afterEach, expect, test, vi } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { noFailures, step } from "@/engines/model/engine";
import { LB_KG } from "@/engines/model/atmosphere";
import { limitFlags } from "@/engines/model/alerts";
import { scenarioById } from "@/engines/model/scenarios";
import * as turbo from "@/engines/model/turbo";
import { createEngineSimulation, replaceState } from "@/components/engine/store";

afterEach(() => vi.restoreAllMocks());

test.each(["induction", "intercooler"])(
  "a blocked filter with an %s leak opens alternate air without chatter (POH 3A-11)",
  (kind) => {
    const x = scenarioById(K, "cruise")!.run(K),
      f = noFailures(K);
    f.filter = true;
    if (kind === "induction") f.inductionLeak = true;
    else f.intercoolerLeak = [true, true];
    for (let i = 0; i < 400; i++) step(K, x.s, x.c, x.env, f, 0.05);
    expect(x.s.altAirOpen).toBe(true);
    expect(limitFlags(K, x.s, x.env).some((flag) => flag.cas === "ALT AIR OPEN")).toBe(true);
    for (let i = 0; i < 200; i++) {
      step(K, x.s, x.c, x.env, f, 0.05);
      expect(x.s.altAirOpen).toBe(true);
    }
  },
);

test("the next filter balance includes relief and deck leakage, excluding internal recirculation (AMM 71-60)", () => {
  const x = scenarioById(K, "takeoff")!.run(K),
    f = noFailures(K);
  f.filter = true;
  f.inductionLeak = true;
  x.s.deckInHg = 42;
  const relief = vi.spyOn(turbo, "reliefFlow"),
    power = vi.spyOn(turbo, "equilibriumPR"),
    filter = vi.spyOn(turbo, "filterOutletInHg");
  step(K, x.s, x.c, x.env, f, 0.001);
  expect(relief.mock.results[0].value).toBeGreaterThan(0);
  expect(x.s.deckLossKgS).toBeGreaterThan(relief.mock.results[0].value);
  const flow = (x.s.air * LB_KG) / 3600 + x.s.deckLossKgS!;
  filter.mockClear();
  step(K, x.s, x.c, x.env, f, 0.001);
  expect(filter.mock.calls[0][3]).toBe(flow);
  expect(power.mock.calls.length).toBeGreaterThan(0);
});

test("saved filter-flow history survives restore and fork, while legacy and cold replacement clear it", () => {
  const sim = createEngineSimulation(K);
  try {
    const cold = sim.checkpoint();
    sim.s.deckLossKgS = 0.1;
    const saved = sim.serialize();
    sim.restore(cold);
    expect(sim.s.deckLossKgS).toBeUndefined();
    sim.restoreSerialized(saved);
    expect(sim.s.deckLossKgS).toBe(0.1);
    const fork = sim.fork();
    try {
      expect(fork.s.deckLossKgS).toBe(0.1);
      fork.s.deckLossKgS = 0.2;
      expect(sim.s.deckLossKgS).toBe(0.1);
    } finally {
      fork.dispose();
    }
    sim.useUi.getState().setFailures({ inductionLeak: true });
    sim.useUi.getState().setFailures({ inductionLeak: false });
    expect(sim.s.deckLossKgS).toBe(0.1);
    replaceState(sim, cold.s);
    expect(sim.s.deckLossKgS).toBeUndefined();
    sim.advance(1 / 120);
    expect(Number.isFinite(sim.s.map)).toBe(true);
  } finally {
    sim.dispose();
  }
});
