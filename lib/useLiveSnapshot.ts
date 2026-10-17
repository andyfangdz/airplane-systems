"use client";
import { useMemo, useSyncExternalStore } from "react";
import { createLiveObservation } from "./live-observation";

const publishers = new WeakMap<object, ReturnType<typeof createLiveObservation>>();
function publisherFor<T extends object>(source: T) {
  let publisher = publishers.get(source);
  if (!publisher) publishers.set(source, (publisher = createLiveObservation(source)));
  return publisher as ReturnType<typeof createLiveObservation<T>>;
}

/** Publish a completed command immediately, including controlled inputs between animation samples. */
export function refreshLiveSnapshot(source: object) {
  publishers.get(source)?.refresh();
}

/** Select a stable observation; changes elsewhere in the source do not invalidate this consumer. */
export function useLiveSelector<T extends object, S>(
  source: T,
  select: (snapshot: T) => S,
  ms = 200,
  equal: (a: S, b: S) => boolean = Object.is,
): S {
  const channel = publisherFor(source).channel(ms);
  const get = useMemo(() => {
    let previous = channel.getSnapshot();
    let value = select(previous);
    const initial = select(channel.getServerSnapshot());
    return {
      current: () => {
        const next = channel.getSnapshot();
        if (next !== previous) {
          const selected = select(next);
          if (!equal(value, selected)) value = selected;
          previous = next;
        }
        return value;
      },
      server: () => initial,
    };
  }, [channel, select, equal]);
  return useSyncExternalStore(channel.subscribe, get.current, get.server);
}

const identity = <T>(value: T) => value;

/** React reads detached, low-rate observations; animation reads original runtime values each frame. */
export function useLiveSnapshot<T extends object>(source: T, ms = 200): T {
  return useLiveSelector(source, identity, ms);
}
