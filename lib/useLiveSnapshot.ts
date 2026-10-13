"use client";
import { useSyncExternalStore } from "react";

/** React reads detached, low-rate snapshots; animation continues to mutate the source every frame. */
function createSampler<T extends object>(source: T, ms: number) {
  let snapshot = structuredClone(source);
  const initial = snapshot;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const sample = () => {
    snapshot = structuredClone(source);
    listeners.forEach((notify) => notify());
  };
  return {
    sample,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      if (listeners.size === 1) {
        // The source may have advanced while this panel was unmounted.
        sample();
        timer = setInterval(sample, ms);
      }
      return () => {
        listeners.delete(notify);
        if (!listeners.size) clearInterval(timer);
      };
    },
  };
}

const samplers = new WeakMap<object, Map<number, ReturnType<typeof createSampler>>>();
/** Publish event-handler changes immediately, including controlled inputs between animation samples. */
export function refreshLiveSnapshot(source: object) {
  samplers.get(source)?.forEach((sampler) => sampler.sample());
}
function samplerFor<T extends object>(source: T, ms: number) {
  let rates = samplers.get(source);
  if (!rates) samplers.set(source, (rates = new Map()));
  let sampler = rates.get(ms);
  if (!sampler) rates.set(ms, (sampler = createSampler(source, ms)));
  return sampler as ReturnType<typeof createSampler<T>>;
}

/**
 * Use snapshots in render and pass them explicitly to calculations. Event handlers and useFrame callbacks still
 * read/write the original source. A shared sampler runs only while at least one UI consumer subscribes at this rate.
 */
export function useLiveSnapshot<T extends object>(source: T, ms = 200): T {
  const sampler = samplerFor(source, ms);
  return useSyncExternalStore(sampler.subscribe, sampler.getSnapshot, sampler.getServerSnapshot);
}
