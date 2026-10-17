/** Discrete subscription surface of an owned simulation (lib/simulation.ts). */
export interface SimStore<S, E> {
  /** Discrete systems state (switches, levers, selections, failures). */
  s: S;
  /** Derived solution (electrical buses, powered loads…) from the state and explicit physical memory. */
  E: E;
  /** Mutate a draft of the state; the derived solution is recomputed. */
  update: (fn: (d: S) => void) => void;
}
