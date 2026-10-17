// vitest: isolate
import { describe, expect, it, vi } from "vitest";
import type { Simulation } from "@/lib/simulation";
import { bindSimulation } from "@/lib/simulationBinding";
import { createC172Simulation } from "@/aircraft/c172s/simulation";
import { c172Runtime } from "@/aircraft/c172s/store";
import { createC182Simulation } from "@/aircraft/c182t/simulation";
import { createDA40Simulation } from "@/aircraft/da40/simulation";
import { createM20CSimulation } from "@/aircraft/m20c/simulation";
import { createSR20Simulation } from "@/aircraft/sr20/simulation";
import { createSR22TSimulation } from "@/aircraft/sr22t/simulation";
import { live as presentedC172 } from "@/aircraft/c172s/model";

/** These invariants exercise real model integration, not a mock tick or an elapsed-time counter. */
function runtimeCases<S, E, L extends { rpm: number }, M, C>(name: string, create: () => Simulation<S, E, L, M, C>) {
  describe(`${name} owned runtime`, () => {
    it("can step an independent instance and fork without touching another instance", () => {
      const a = create(),
        b = create();
      const before = b.checkpoint();
      a.live.rpm = 0;
      a.advance(0.2);
      expect(b.checkpoint()).toEqual(before);
      const child = a.fork();
      const parent = a.checkpoint();
      child.live.rpm = 1;
      child.advance(0.3);
      expect(a.checkpoint()).toEqual(parent);
      expect(child.live.rpm).not.toBe(a.live.rpm);
    });

    it("restores all physical memory and the substep remainder before continuing", () => {
      const original = create();
      original.advance(0.013);
      const checkpoint = original.checkpoint();
      original.advance(0.527);
      const restored = create();
      restored.restore(checkpoint);
      restored.advance(0.527);
      expect(restored.checkpoint()).toEqual(original.checkpoint());
      expect(restored.store.getState().E).toEqual(original.store.getState().E);
      checkpoint.live.rpm = -100;
      expect(restored.live.rpm).not.toBe(-100);
    });

    it("integrates identical states at 5, 20 and 60 rendering frames per second", () => {
      const results = [5, 20, 60].map((fps) => {
        const runtime = create();
        runtime.live.rpm = 0;
        for (let frame = 0; frame < fps; frame++) runtime.advance(1 / fps);
        return runtime.checkpoint();
      });
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
    });
  });
}

runtimeCases("C172S", createC172Simulation);
runtimeCases("C182T", createC182Simulation);
runtimeCases("DA40", createDA40Simulation);
runtimeCases("M20C", createM20CSimulation);
runtimeCases("SR20", createSR20Simulation);
runtimeCases("SR22T", createSR22TSimulation);

it("keeps the original C172 session and references untouched while a child owns the presentation", () => {
  const original = c172Runtime.current();
  const before = original.checkpoint();
  const { s, E } = original.store.getState();
  const fs = original.live.fs;
  const child = original.fork();
  const release = c172Runtime.activate(child);
  try {
    c172Runtime.dispatch({ type: "scenario", name: "coldDark" });
    c172Runtime.advance(0.2);
    expect(presentedC172.rpm).toBe(0);
    expect(original.checkpoint()).toEqual(before);
    expect(original.live).not.toBe(presentedC172);
  } finally {
    release();
  }
  expect(c172Runtime.current()).toBe(original);
  expect(original.live).toBe(presentedC172);
  expect(original.live.fs).toBe(fs);
  expect(original.store.getState().s).toBe(s);
  expect(original.store.getState().E).toBe(E);
  expect(original.checkpoint()).toEqual(before);
});

it("publishes a scenario once after its discrete and continuous state agree", () => {
  const runtime = createC172Simulation();
  const listener = vi.fn(() => {
    expect(runtime.live.rpm).toBe(0);
    expect(runtime.store.getState().s.eng.running).toBe(false);
  });
  runtime.store.subscribe(listener);
  runtime.dispatch({ type: "scenario", name: "coldDark" });
  expect(listener).toHaveBeenCalledTimes(1);
});

it("serializes unbounded AFCS annunciation timers without changing their meaning", () => {
  const runtime = createDA40Simulation();
  runtime.live.afcs.tone = Infinity;
  runtime.live.afcs.apFlash = { kind: "abnormal", until: Infinity };
  runtime.advance(0.013);
  const restored = createDA40Simulation();
  restored.restoreSerialized(runtime.serialize());
  expect(restored.checkpoint()).toEqual(runtime.checkpoint());
  restored.advance(0.02);
  runtime.advance(0.02);
  expect(restored.checkpoint()).toEqual(runtime.checkpoint());
});

it("forks and restores a pending propeller-cycle command using simulation time", () => {
  const original = createC182Simulation();
  original.dispatch({ type: "propCycle", active: true });
  original.advance(1);
  const child = original.fork();
  child.advance(1);
  child.advance(0.5);
  expect(child.store.getState().s.eng.prop).toBe(1);
  expect(original.store.getState().s.eng.prop).toBe(0);
  expect(original.live.propCycleRemaining).toBeCloseTo(1.5);
  const restored = createC182Simulation();
  restored.restoreSerialized(original.serialize());
  restored.advance(1);
  restored.advance(0.5);
  expect(restored.checkpoint()).toEqual(child.checkpoint());
});

it("restores alternator excitation without storing derived output in the checkpoint (DA40 AFM 7.11)", () => {
  const runtime = createDA40Simulation();
  runtime.store.getState().update((s) => {
    s.elec.bat = false;
  });
  expect(runtime.store.getState().E.altOn).toBe(true);
  const checkpoint = runtime.checkpoint();
  expect(checkpoint.memory).toEqual({ altOn: true });
  expect(checkpoint).not.toHaveProperty("E");
  const restored = createDA40Simulation();
  restored.restore(checkpoint);
  restored.store.getState().update((s) => {
    s.lights.landing = true;
  });
  expect(restored.store.getState().E.altOn).toBe(true);
  restored.store.getState().update((s) => {
    s.elec.alt = false;
  });
  restored.store.getState().update((s) => {
    s.elec.alt = true;
  });
  expect(restored.store.getState().E.altOn).toBe(false);
});

describe("SR22T oxygen exposure commands (POH 3A-24)", () => {
  it("starts a new scenario with zero exposure even when the published minute was still zero", () => {
    const runtime = createSR22TSimulation();
    runtime.dispatch({ type: "oxygenScenario", index: 1 });
    for (let i = 0; i < 600; i++) runtime.step(0.05);
    expect(runtime.live.above12k5Min).toBeCloseTo(0.5);
    expect(runtime.store.getState().s.oxy.above12k5Min).toBe(0);
    runtime.dispatch({ type: "oxygenScenario", index: 2 });
    runtime.step(0.05);
    expect(runtime.live.above12k5Min).toBeCloseTo(0.05 / 60);
  });

  it("honors a same-value exposure reset between telemetry publications", () => {
    const runtime = createSR22TSimulation();
    runtime.dispatch({ type: "oxygenScenario", index: 1 });
    runtime.step(0.05);
    runtime.dispatch({ type: "oxygenExposure", minutes: 0 });
    expect(runtime.live.above12k5Min).toBe(0);
    runtime.step(0.05);
    expect(runtime.live.above12k5Min).toBeCloseTo(0.05 / 60);
  });
});

it("publishes a raw step's state with its new simulation time", () => {
  const runtime = createC172Simulation();
  runtime.store.getState().update((s) => {
    s.eng.running = true;
    s.eng.mags = "OFF";
  });
  let publishedTime = -1;
  runtime.store.subscribe(() => {
    publishedTime = runtime.time;
  });
  runtime.step(1 / 120);
  expect(publishedTime).toBe(runtime.time);
  expect(publishedTime).toBeGreaterThan(0);
});

it("disposes a runtime idempotently and rejects future mutations and subscriptions", () => {
  const runtime = createC172Simulation();
  const command = vi.fn();
  runtime.subscribeCommands(command);
  runtime.dispose();
  runtime.dispose();
  expect(runtime.disposed).toBe(true);
  expect(() => runtime.advance(0.1)).toThrow(/disposed/);
  expect(() => runtime.dispatch({ type: "scenario", name: "cruise" })).toThrow(/disposed/);
  expect(() =>
    runtime.store.getState().update((s) => {
      s.ground = true;
    }),
  ).toThrow(/disposed/);
  expect(() => runtime.store.subscribe(() => {})).toThrow(/disposed/);
  expect(command).not.toHaveBeenCalled();
});

it("rejects a disposed activation before transferring presentation ownership or subscriptions", () => {
  const base = createC172Simulation();
  const shown = structuredClone(base.live);
  const binding = bindSimulation(base, shown);
  const child = base.fork();
  child.dispose();
  const before = base.checkpoint();
  const listener = vi.fn();
  const off = binding.useStore.subscribe(listener);
  expect(() => binding.activate(child)).toThrow(/disposed/);
  expect(binding.current()).toBe(base);
  expect(base.live).toBe(shown);
  expect(base.checkpoint()).toEqual(before);
  binding.dispatch({ type: "scenario", name: "coldDark" });
  expect(listener).toHaveBeenCalledTimes(1);
  off();
  base.dispose();
});

it("a release to a disposed previous runtime fails without corrupting the current child", () => {
  const base = createC172Simulation();
  const shown = structuredClone(base.live);
  const binding = bindSimulation(base, shown);
  const child = base.fork();
  const release = binding.activate(child);
  base.dispose();
  expect(() => release()).toThrow(/disposed/);
  expect(binding.current()).toBe(child);
  expect(child.live).toBe(shown);
  binding.advance(0.1);
  expect(child.time).toBeGreaterThan(0);
  child.dispose();
});

it("SR22T door motion belongs to headless simulation time and survives a mid-travel fork", () => {
  const runtime = createSR22TSimulation();
  runtime.store.getState().update((s) => {
    s.doors.L = "open";
  });
  runtime.advance(0.2);
  expect(runtime.live.doors.L).toBeCloseTo(0.36);
  const fork = runtime.fork();
  runtime.advance(0.4);
  fork.advance(0.4);
  expect(runtime.live.doors.L).toBe(1);
  expect(fork.checkpoint()).toEqual(runtime.checkpoint());
});
