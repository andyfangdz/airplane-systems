"use client";
/**
 * The engine page's state. Controls, environment, failures and view settings live in a zustand store (React reads
 * them); the engine itself is a mutable `EngineState` per engine, advanced every animation frame by `useEngineLoop`
 * and read by the scene each frame and by panels through `useLiveSnapshot`.
 */
import { useCallback } from "react";
import { decodeCheckpoint, encodeCheckpoint } from "@/lib/checkpoint";
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
import { useSimLoop } from "./sim";
import { createSimulationClock, type SimulationClockCheckpoint } from "@/lib/simulationClock";

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

export interface EngineCheckpoint {
  version: 1;
  engine: string;
  s: EngineState;
  anim: { crank: number };
  ui: Pick<EngineUi, "controls" | "env" | "failures" | "view">;
  clock: SimulationClockCheckpoint;
}

export interface EngineSim {
  readonly disposed: boolean;
  readonly clock: ReturnType<typeof createSimulationClock>;
  advance: (elapsed: number) => void;
  checkpoint: () => EngineCheckpoint;
  restore: (checkpoint: EngineCheckpoint) => void;
  serialize: () => string;
  restoreSerialized: (json: string) => void;
  fork: () => EngineSim;
  /** Composed accessories run after every integration step on the same clock. */
  subscribeSteps: (listener: (dt: number) => void) => () => void;
  dispose: () => void;
  spec: EngineSpec;
  s: EngineState;
  /** Visual crank angle (follows the engine, or slowly in slow motion), degrees 0 … 720. */
  anim: { crank: number };
  /** Counts replacements of `s` (scenarios), so pages can drop what they held for the engine before. */
  resets: number;
  useUi: ReturnType<typeof createUi>;
  /** Scenario request owned by this simulation, independent of requests from other pages. */
  scenarioRequest: { id: number | null };
}

/** One worker can serve several retained sessions; replies are routed to their request owner. */
let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, { apply: (setup: Setup) => void; fallback: () => void }>();

const createUi = (spec: EngineSpec, request: EngineSim["scenarioRequest"]) =>
  create<EngineUi>((set, get) => {
    // a change made while a "Start from" setup is still running wins: the setup is dropped, not applied over it
    const cancel = () => {
      if (get().view.loading) {
        if (request.id !== null) pending.delete(request.id);
        request.id = null;
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

/**
 * The one simulation per engine: kept across remounts so leaving and coming back finds it as it was. A component page
 * (`/components/<id>`) runs its own copy of its engine under its own `key`.
 */
export function simFor(spec: EngineSpec, key = spec.id): EngineSim {
  let sim = sims.get(key);
  if (!sim || sim.disposed) {
    sim = createEngineSimulation(spec);
    sims.set(key, sim);
  }
  return sim;
}

/** An independently owned engine session. The route cache above is only a presentation convenience. */
export function createEngineSimulation(spec: EngineSpec): EngineSim {
  let disposed = false;
  const assertActive = () => {
    if (disposed) throw new Error(`${spec.id} engine simulation is disposed`);
  };
  const scenarioRequest = { id: null as number | null };
  const listeners = new Set<(dt: number) => void>();
  const clock = createSimulationClock(
    (dt) => {
      advanceStep(sim, dt);
      listeners.forEach((listener) => listener(dt));
    },
    { maxCatchUp: ENGINE_MAX_DT },
  );
  const sim: EngineSim = {
    spec,
    s: initialState(spec),
    anim: { crank: 0 },
    resets: 0,
    useUi: createUi(spec, scenarioRequest),
    scenarioRequest,
    clock,
    get disposed() {
      return disposed;
    },
    advance: (elapsed) => {
      assertActive();
      if (!sim.useUi.getState().view.paused) clock.advance(elapsed);
    },
    checkpoint: () => {
      const { controls, env, failures, view } = sim.useUi.getState();
      return structuredClone({
        version: 1,
        engine: spec.id,
        s: sim.s,
        anim: sim.anim,
        ui: { controls, env, failures, view: { ...view, loading: null } },
        clock: clock.checkpoint(),
      });
    },
    restore: (checkpoint) => {
      assertActive();
      if (checkpoint.version !== 1 || checkpoint.engine !== spec.id)
        throw new Error(`Checkpoint does not belong to ${spec.id}`);
      const next = structuredClone(checkpoint);
      clock.restore(next.clock);
      cancelScenario(sim);
      Object.assign(sim.s, next.s);
      Object.assign(sim.anim, next.anim);
      sim.useUi.setState(next.ui);
      sim.resets++;
      refreshLiveSnapshot(sim.s);
    },
    serialize: () => encodeCheckpoint(sim.checkpoint()),
    restoreSerialized: (json) => sim.restore(decodeCheckpoint(json)),
    fork: () => {
      assertActive();
      const child = createEngineSimulation(spec);
      child.restore(sim.checkpoint());
      return child;
    },
    subscribeSteps: (listener) => {
      assertActive();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      cancelScenario(sim);
      listeners.clear();
      disposed = true;
      for (const [key, cached] of sims) if (cached === sim) sims.delete(key);
    },
  };
  return sim;
}

/** Drop this session's queued work without canceling another engine's request. */
export function cancelScenario(sim: EngineSim) {
  if (sim.scenarioRequest.id !== null) pending.delete(sim.scenarioRequest.id);
  sim.scenarioRequest.id = null;
  sim.useUi.setState((u) => ({ view: { ...u.view, loading: null } }));
}

/** Replace the engine state (a scenario), keeping the object identity the scene and panels hold. */
export function replaceState(sim: EngineSim, next: EngineState) {
  if (sim.disposed) throw new Error("Engine simulation is disposed");
  sim.clock.reset();
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
      if (worker) {
        const w = worker;
        w.onmessage = ({ data }: MessageEvent<{ seq: number; setup?: Setup; error?: string }>) => {
          const request = pending.get(data.seq);
          if (!request) return;
          pending.delete(data.seq);
          if (data.setup) request.apply(data.setup);
          else {
            console.warn("Scenario worker failed; setting up here", data.error);
            request.fallback();
          }
        };
        w.onerror = (e) => {
          console.warn("Scenario worker unavailable; setting up here", e.message);
          w.terminate();
          worker = null;
          const requests = [...pending.values()];
          pending.clear();
          requests.forEach((request) => request.fallback());
        };
      }
    } catch {
      worker = null;
    }
  return worker;
}

/**
 * Set the engine up as a "Start from" scenario describes. Settling to cruise takes thousands of model steps, so a
 * worker does it while the page keeps running; without one it runs here. Only this session's latest request applies.
 */
export function startScenario(sim: EngineSim, id: string) {
  if (sim.disposed) throw new Error("Engine simulation is disposed");
  const sc = SCENARIOS.find((x) => x.id === id);
  if (!sc) throw new Error(`Unknown engine scenario ${id}`);
  if (sim.scenarioRequest.id !== null) pending.delete(sim.scenarioRequest.id);
  const failures = sim.useUi.getState().failures;
  const n = ++seq;
  sim.scenarioRequest.id = n;
  const apply = (x: Setup) => {
    if (sim.scenarioRequest.id !== n) return;
    sim.scenarioRequest.id = null;
    replaceState(sim, x.s);
    sim.useUi.setState((u) => ({
      controls: x.c,
      env: x.env,
      view: { ...u.view, scenario: id, loading: null, paused: false },
    }));
  };
  const runHere = () => {
    if (sim.scenarioRequest.id !== n) return;
    try {
      apply(sc.run(sim.spec, failures));
    } catch (error) {
      sim.scenarioRequest.id = null;
      sim.useUi.setState((u) => ({ view: { ...u.view, loading: null } }));
      console.error("Unable to set up engine scenario", error);
    }
  };
  const w = scenarioWorker();
  if (!w) return runHere();
  sim.useUi.setState((u) => ({ view: { ...u.view, loading: id } }));
  pending.set(n, { apply, fallback: runHere });
  try {
    w.postMessage({ seq: n, engine: sim.spec.id, scenario: id, failures });
  } catch (error) {
    pending.delete(n);
    console.warn("Scenario worker could not accept the request; setting up here", error);
    runHere();
  }
}

/** Slow motion turns the drawn crank at this fraction of engine speed (at most ~20 rpm on screen). */
const slowRpm = (rpm: number) => Math.min(rpm, 20);

/** The longest frame the engine runs in one go, s (`step` splits it into short steps). */
export const ENGINE_MAX_DT = 0.5;

/** One fixed integration step; accessories subscribe to this same step boundary. */
function advanceStep(sim: EngineSim, dt: number) {
  const ui = sim.useUi.getState();
  if (ui.view.paused) return;
  step(sim.spec, sim.s, ui.controls, ui.env, ui.failures, dt, ui.view.thermal);
  sim.anim.crank = ui.view.slow ? (sim.anim.crank + slowRpm(sim.s.rpm) * 6 * dt) % 720 : sim.s.crank;
}

/** Advance elapsed time using the session's owned clock. */
export const advance = (sim: EngineSim, elapsed: number) => sim.advance(elapsed);

/** Run the simulation on animation frames while the page is mounted (independent of the 3D view). */
export function useEngineLoop(sim: EngineSim) {
  const tick = useCallback((dt: number) => advance(sim, dt), [sim]);
  useSimLoop(tick, ENGINE_MAX_DT);
}
