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
  /** The last "Start from" scenario, for its note. */
  scenario: string | null;
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
  useUi: ReturnType<typeof createUi>;
}

const createUi = (spec: EngineSpec) =>
  create<EngineUi>((set) => ({
    controls: defaultControls(),
    env: defaultEnvironment(),
    failures: noFailures(spec),
    view: { thermal: 1, slow: false, xray: true, labels: true, prop: true, cyl: 0, paused: false, scenario: null },
    setControls: (p) => set((x) => ({ controls: { ...x.controls, ...p } })),
    setEnv: (p) => set((x) => ({ env: { ...x.env, ...p } })),
    setFailures: (p) => set((x) => ({ failures: { ...x.failures, ...p } })),
    setView: (p) => set((x) => ({ view: { ...x.view, ...p } })),
  }));

const sims = new Map<string, EngineSim>();

/** The one simulation per engine: kept across remounts so leaving and coming back finds it as it was. */
export function simFor(spec: EngineSpec): EngineSim {
  let sim = sims.get(spec.id);
  if (!sim) {
    sim = { spec, s: initialState(spec), anim: { crank: 0 }, useUi: createUi(spec) };
    sims.set(spec.id, sim);
  }
  return sim;
}

/** Replace the engine state (a scenario), keeping the object identity the scene and panels hold. */
export function replaceState(sim: EngineSim, next: EngineState) {
  Object.assign(sim.s, structuredClone(next));
  refreshLiveSnapshot(sim.s);
}

/** Slow motion turns the drawn crank at this fraction of engine speed (at most ~20 rpm on screen). */
const slowRpm = (rpm: number) => Math.min(rpm, 20);

/** Advance one frame: the engine at real time, the drawn crank either with it or in slow motion. */
export function advance(sim: EngineSim, dt: number) {
  const ui = sim.useUi.getState();
  if (ui.view.paused) return;
  const d = Math.min(dt, 0.1);
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
