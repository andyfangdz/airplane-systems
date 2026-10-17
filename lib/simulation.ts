import { createStore, type StoreApi } from "zustand/vanilla";
import { createSimulationClock } from "./simulationClock";
import type { SimStore } from "./simStore";
import { decodeCheckpoint, encodeCheckpoint } from "./checkpoint";

/** Inputs to a model step. No React, canvas, active-aircraft lookup or module-global state is needed. */
export interface SimulationContext<S, E, L extends object> {
  store: StoreApi<SimStore<S, E>>;
  readonly live: L;
}

export interface SimulationCheckpoint<S, L, M> {
  version: 1;
  model: string;
  s: S;
  live: L;
  /** Only physical memory (excitation, held controls…), never the complete derived solution. */
  memory: M;
  time: number;
  clock: ReturnType<ReturnType<typeof createSimulationClock>["checkpoint"]>;
}

export interface SimulationDefinition<S, E, L extends object, M, C> {
  id: string;
  initialState: () => S;
  initialLive: () => L;
  initialMemory: () => M;
  solve: (s: S, memory: M) => E;
  memoryFrom: (solution: E) => M;
  step: (context: SimulationContext<S, E, L>, dt: number) => void;
  command?: (context: SimulationContext<S, E, L>, command: C) => void;
}

export interface Simulation<S, E, L extends object, M, C = never> extends SimulationContext<S, E, L> {
  readonly id: string;
  readonly time: number;
  readonly disposed: boolean;
  /** Release subscriptions and reject further mutation. Safe to call more than once. */
  dispose: () => void;
  /** One integration step, also useful for source-based model tests. */
  step: (dt: number) => void;
  /** Wall time through this instance's fixed-step clock. */
  advance: (elapsed: number) => void;
  dispatch: (command: C) => void;
  transaction: (fn: (context: SimulationContext<S, E, L>) => void) => void;
  checkpoint: () => SimulationCheckpoint<S, L, M>;
  restore: (checkpoint: SimulationCheckpoint<S, L, M>) => void;
  /** JSON round-trip preserves unbounded annunciation timers (Infinity), unlike ordinary JSON.stringify. */
  serialize: () => string;
  restoreSerialized: (json: string) => void;
  fork: () => Simulation<S, E, L, M, C>;
  /** Presentation binding transfers ownership only at activation boundaries. */
  attachLive: (target: L) => void;
  detachLive: () => void;
  subscribeCommands: (listener: () => void) => () => void;
}

/** Replace a plain object's fields while keeping its root identity. Nested values transfer ownership. */
export function assignLive<T extends object>(target: T, source: T) {
  for (const key of Object.keys(target)) if (!(key in source)) delete (target as Record<string, unknown>)[key];
  Object.assign(target, source);
}

/**
 * A complete, independently step-able simulation. Continuous integration mutates owned state; discrete changes
 * solve immediately for subsequent phases but publish once per transaction. Checkpoints/forks are the copy boundary.
 */
export function createSimulation<S, E, L extends object, M, C = never>(
  definition: SimulationDefinition<S, E, L, M, C>,
): Simulation<S, E, L, M, C> {
  let live = definition.initialLive();
  let memory = definition.initialMemory();
  let time = 0;
  let depth = 0;
  let disposed = false;
  const subscriptions = new Set<() => void>();
  const assertActive = () => {
    if (disposed) throw new Error(`${definition.id} simulation is disposed`);
  };
  const commandListeners = new Set<() => void>();
  const initial = definition.initialState();
  const first = definition.solve(initial, memory);
  memory = definition.memoryFrom(first);
  const update = (fn: (draft: S) => void) => {
    assertActive();
    const s = structuredClone(current.s);
    fn(s);
    const E = definition.solve(s, memory);
    memory = definition.memoryFrom(E);
    current = { s, E, update };
    publish();
  };
  let current: SimStore<S, E> = { s: initial, E: first, update };
  const published = createStore<SimStore<S, E>>(() => current);
  const publish = () => {
    if (depth === 0 && published.getState() !== current) published.setState(current, true);
  };
  const store: StoreApi<SimStore<S, E>> = {
    ...published,
    getState: () => current,
    subscribe: (listener) => {
      assertActive();
      const unsubscribe = published.subscribe(listener);
      const release = () => {
        unsubscribe();
        subscriptions.delete(release);
      };
      subscriptions.add(release);
      return release;
    },
    // Existing tests and developer tooling may replace a discrete snapshot. Keep the physical memory in sync.
    setState: (next) => {
      assertActive();
      const patch = typeof next === "function" ? next(current) : next;
      const s = patch.s ?? current.s;
      const E = patch.E ?? definition.solve(s, memory);
      memory = definition.memoryFrom(E);
      current = { s, E, update };
      publish();
    },
  };
  const notifyCommand = () => commandListeners.forEach((listener) => listener());
  const transaction = (fn: (context: SimulationContext<S, E, L>) => void) => {
    assertActive();
    depth++;
    try {
      fn(runtime);
    } finally {
      depth--;
      publish();
    }
  };
  const clock = createSimulationClock((dt) => runtime.step(dt));
  const runtime: Simulation<S, E, L, M, C> = {
    id: definition.id,
    get disposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) return;
      live = { ...live };
      disposed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      commandListeners.clear();
    },
    store,
    get live() {
      return live;
    },
    get time() {
      return time;
    },
    step: (dt) => {
      assertActive();
      if (!Number.isFinite(dt) || dt <= 0) return;
      transaction((context) => {
        definition.step(context, dt);
        time += dt;
      });
    },
    advance: (elapsed) => transaction(() => clock.advance(elapsed)),
    transaction,
    dispatch: (command) => {
      if (!definition.command) throw new Error(`${definition.id} has no command handler`);
      transaction((context) => definition.command!(context, command));
      notifyCommand();
    },
    checkpoint: () =>
      structuredClone({
        version: 1 as const,
        model: definition.id,
        s: current.s,
        live,
        memory,
        time,
        clock: clock.checkpoint(),
      }),
    restore: (checkpoint) => {
      assertActive();
      if (checkpoint.version !== 1 || checkpoint.model !== definition.id)
        throw new Error(`Checkpoint does not belong to ${definition.id}`);
      if (!Number.isFinite(checkpoint.time) || checkpoint.time < 0) throw new Error("Invalid simulation time");
      const next = structuredClone(checkpoint);
      clock.restore(next.clock);
      memory = next.memory;
      time = next.time;
      assignLive(live, next.live);
      current = { s: next.s, E: definition.solve(next.s, memory), update };
      publish();
      notifyCommand();
    },
    serialize: () => encodeCheckpoint(runtime.checkpoint()),
    restoreSerialized: (json) => runtime.restore(decodeCheckpoint(json)),
    fork: () => {
      assertActive();
      const child = createSimulation(definition);
      child.restore(runtime.checkpoint());
      return child;
    },
    detachLive: () => {
      assertActive();
      live = { ...live };
    },
    attachLive: (target) => {
      assertActive();
      assignLive(target, live);
      live = target;
    },
    subscribeCommands: (listener) => {
      assertActive();
      commandListeners.add(listener);
      return () => {
        commandListeners.delete(listener);
      };
    },
  };
  return runtime;
}
