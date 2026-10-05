"use client";
import { create } from "zustand";

export interface SimStore<S, E> {
  /** Discrete systems state (switches, levers, selections, failures). */
  s: S;
  /** Derived solution (electrical buses, powered loads…) recomputed on every update. */
  E: E;
  /** Mutate a draft of the state; the derived solution is recomputed. */
  update: (fn: (d: S) => void) => void;
}

/** One zustand store per airplane: immutable discrete state plus a pure derived solution. */
export function createSimStore<S, E>(initial: S, solve: (s: S) => E) {
  return create<SimStore<S, E>>((set, get) => ({
    s: initial,
    E: solve(initial),
    update: (fn) => {
      const d = structuredClone(get().s);
      fn(d);
      set({ s: d, E: solve(d) });
    },
  }));
}
