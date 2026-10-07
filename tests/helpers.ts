/** Helpers shared by the airplane model tests. */

/** A deep partial of a state object: plain objects merge key by key, anything else (arrays, primitives) replaces. */
export type Patch<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Patch<T[K]> : T[K];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const merge = (t: Record<string, unknown>, p: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(p)) {
    const cur = t[k];
    if (isObj(v) && isObj(cur)) merge(cur, v);
    else t[k] = v;
  }
};

/** `structuredClone(base)` with `patch` deep-merged into it, e.g. `patched(initialSim, { elec: { fail: { alt: true } } })`. */
export function patched<T>(base: T, patch: Patch<T> = {}): T {
  const out = structuredClone(base);
  merge(out as Record<string, unknown>, patch as Record<string, unknown>);
  return out;
}
