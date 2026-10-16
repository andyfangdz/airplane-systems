"use client";
/**
 * The engine page's state. Controls, environment, failures and view settings live in a zustand store (React reads
 * them); the engine itself is a mutable `EngineState` per engine, advanced every animation frame by `useEngineLoop`
 * and read by the scene each frame and by panels through `useLiveSnapshot`.
 */
import { useEffect } from "react";
import { create } from "zustand";
import type { EngineSpec } from "@/engines/types";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import { SCENARIOS, type Setup } from "@/engines/model/scenarios";
import { refreshLiveSnapshot } from "@/lib/useLiveSnapshot";

export interface EngineView {
  /** Temperatures run this many times faster than real time. */
  thermal: number;
  /** Draw the crank turning slowly enough to follow the cycle (the simulation itself runs at full speed). */
  slow: boolean;
  xray: boolean;
  labels: boolean;
  prop: boolean;
  /** Cylinder index shown in the pressure chart. */
  cyl: number;
  paused: boolean;
  /** Part groups hidden from the 3D view (scene/parts.tsx GROUPS). */
  hidden: string[];
  /** The last "Start from" scenario, for its note. */
  scenario: string | null;
  /** A "Start from" scenario still being set up. */
  loading: string | null;
}

export interface EngineUi {
  controls: Controls;
  env: Environment;
  failures: Failures;
  view: EngineView;
  setControls: (p: Partial<Controls>) => void;
  setEnv: (p: Partial<Environment>) => void;
  setFailures: (p: Partial<Failures>) => void;
  setView: (p: Partial<EngineView>) => void;
}

export interface EngineSim {
  spec: EngineSpec;
  s: EngineState;
  /** Visual crank angle (follows the engine, or slowly in slow motion), degrees 0 … 720. */
  anim: { crank: number };
  /** Counts replacements of `s` (scenarios), so pages can drop what they held for the engine before. */
  resets: number;
  useUi: ReturnType<typeof createUi>;
}

/** The scenario worker, made on first use, and the number of the latest "Start from" request. */
let worker: Worker | null | undefined;
let seq = 0;

const createUi = (spec: EngineSpec) =>
  create<EngineUi>((set, get) => {
    // a change made while a "Start from" setup is still running wins: the setup is dropped, not applied over it
    const cancel = () => {
      if (get().view.loading) {
        seq++;
        set((x) => ({ view: { ...x.view, loading: null } }));
      }
    };
    return {
      controls: defaultControls(),
      env: defaultEnvironment(),
      failures: noFailures(spec),
      view: {
        thermal: 1,
        slow: false,
        xray: true,
        labels: true,
        prop: true,
        cyl: 0,
        paused: false,
        scenario: null,
        loading: null,
        hidden: [],
      },
      setControls: (p) => {
        cancel();
        set((x) => ({ controls: { ...x.controls, ...p } }));
      },
      setEnv: (p) => {
        cancel();
        set((x) => ({ env: { ...x.env, ...p } }));
      },
      setFailures: (p) => {
        cancel();
        set((x) => ({ failures: { ...x.failures, ...p } }));
      },
      setView: (p) => {
        if ("paused" in p) cancel();
        set((x) => ({ view: { ...x.view, ...p } }));
      },
    };
  });

const sims = new Map<string, EngineSim>();

/** The one simulation per engine: kept across remounts so leaving and coming back finds it as it was. */
export function simFor(spec: EngineSpec): EngineSim {
  let sim = sims.get(spec.id);
  if (!sim) {
    sim = { spec, s: initialState(spec), anim: { crank: 0 }, resets: 0, useUi: createUi(spec) };
    sims.set(spec.id, sim);
  }
  return sim;
}

/** Replace the engine state (a scenario), keeping the object identity the scene and panels hold. */
export function replaceState(sim: EngineSim, next: EngineState) {
  Object.assign(sim.s, structuredClone(next));
  sim.resets++;
  refreshLiveSnapshot(sim.s);
}

function scenarioWorker() {
  if (worker === undefined)
    try {
      worker =
        typeof Worker === "undefined"
          ? null
          : new Worker(new URL("./scenario.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker = null;
    }
  return worker;
}

/**
 * Set the engine up as a "Start from" scenario describes. Settling to cruise takes thousands of model steps, so a
 * worker does it while the page keeps running; without one it runs here. Only the latest request applies.
 */
export function startScenario(sim: EngineSim, id: string) {
  const failures = sim.useUi.getState().failures;
  const n = ++seq;
  const apply = (x: Setup) => {
    if (n !== seq) return;
    replaceState(sim, x.s);
    sim.useUi.setState((u) => ({
      controls: x.c,
      env: x.env,
      view: { ...u.view, scenario: id, loading: null, paused: false },
    }));
  };
  const runHere = () => {
    const sc = SCENARIOS.find((x) => x.id === id);
    if (sc) apply(sc.run(sim.spec, failures));
  };
  const w = scenarioWorker();
  if (!w) return runHere();
  sim.useUi.setState((u) => ({ view: { ...u.view, loading: id } }));
  w.onmessage = ({ data }: MessageEvent<{ seq: number; setup?: Setup; error?: string }>) => {
    if (data.seq !== n) return;
    if (data.setup) apply(data.setup);
    else {
      console.warn("Scenario worker failed; setting up here", data.error);
      runHere();
    }
  };
  w.onerror = (e) => {
    console.warn("Scenario worker unavailable; setting up here", e.message);
    w.terminate();
    worker = null;
    runHere();
  };
  w.postMessage({ seq: n, engine: sim.spec.id, scenario: id, failures });
}

/** Slow motion turns the drawn crank at this fraction of engine speed (at most ~20 rpm on screen). */
const slowRpm = (rpm: number) => Math.min(rpm, 20);

/** Advance one frame: the engine at real time, the drawn crank either with it or in slow motion. */
export function advance(sim: EngineSim, dt: number) {
  const ui = sim.useUi.getState();
  if (ui.view.paused) return;
  // keep real time on slow frames (step splits a long frame into short steps), but don't try to catch up a pause
  // such as a hidden tab; the first frame's timestamp can come before the loop's start, so never step backwards
  const d = Math.min(Math.max(dt, 0), 0.5);
  step(sim.spec, sim.s, ui.controls, ui.env, ui.failures, d, ui.view.thermal);
  sim.anim.crank = ui.view.slow ? (sim.anim.crank + slowRpm(sim.s.rpm) * 6 * d) % 720 : sim.s.crank;
}

/** Run the simulation on animation frames while the page is mounted (independent of the 3D view). */
export function useEngineLoop(sim: EngineSim) {
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      advance(sim, (now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
}
