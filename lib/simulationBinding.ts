"use client";
import { useStore, type StoreApi, type UseBoundStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { SimStore } from "./simStore";
import type { Simulation } from "./simulation";
import { refreshLiveSnapshot } from "./useLiveSnapshot";

/** One presentation can select a runtime; independently owned runtimes do not depend on this binding. */
export interface SimulationBinding<S, E, L extends object, M, C = never> {
  useStore: UseBoundStore<StoreApi<SimStore<S, E>>>;
  current: () => Simulation<S, E, L, M, C>;
  fork: () => Simulation<S, E, L, M, C>;
  activate: (runtime: Simulation<S, E, L, M, C>) => () => void;
  step: (dt: number) => void;
  advance: (elapsed: number) => void;
  dispatch: (command: C) => void;
}

/**
 * A bridge for existing aircraft views that hold a plain `live` root and a bound store. Activation transfers the root
 * to the child. The detached original keeps its own state and nested references; closing the child transfers it back.
 * No recursive reference capture, global clone hooks or frame-by-frame copying is involved.
 */
export function bindSimulation<S, E, L extends object, M, C>(
  initial: Simulation<S, E, L, M, C>,
  live: L,
): SimulationBinding<S, E, L, M, C> {
  if (initial.disposed) throw new Error(`Cannot bind disposed ${initial.id} simulation`);
  let active = initial;
  active.attachLive(live);
  const published = createStore<SimStore<S, E>>(() => active.store.getState());
  let unsubscribe = active.store.subscribe((state) => published.setState(state, true));
  let unsubscribeCommands = active.subscribeCommands(() => refreshLiveSnapshot(live));
  const api: StoreApi<SimStore<S, E>> = {
    getState: () => active.store.getState(),
    getInitialState: published.getInitialState,
    setState: (next) => active.store.setState(next),
    subscribe: published.subscribe,
  };
  const useBound = Object.assign(
    <T = SimStore<S, E>>(selector?: (state: SimStore<S, E>) => T) => useStore(api, selector ?? ((state) => state as T)),
    api,
  ) as UseBoundStore<StoreApi<SimStore<S, E>>>;
  const switchTo = (next: Simulation<S, E, L, M, C>) => {
    if (next.disposed) throw new Error(`Cannot activate disposed ${next.id} simulation`);
    unsubscribe();
    unsubscribeCommands();
    if (!active.disposed) active.detachLive();
    active = next;
    active.attachLive(live);
    unsubscribe = active.store.subscribe((state) => published.setState(state, true));
    unsubscribeCommands = active.subscribeCommands(() => refreshLiveSnapshot(live));
    published.setState(active.store.getState(), true);
    refreshLiveSnapshot(live);
  };
  return {
    useStore: useBound,
    current: () => active,
    fork: () => active.fork(),
    activate: (next) => {
      if (next.id !== initial.id) throw new Error(`Cannot bind ${next.id} to ${initial.id}`);
      const previous = active;
      switchTo(next);
      let released = false;
      return () => {
        if (released) return;
        if (active !== next) throw new Error("Simulation bindings must be released in reverse activation order");
        switchTo(previous);
        released = true;
      };
    },
    step: (dt) => active.step(dt),
    advance: (elapsed) => active.advance(elapsed),
    dispatch: (command) => active.dispatch(command),
  };
}
