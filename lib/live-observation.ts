/** Detached snapshots with stable unchanged branches; the source remains mutable simulation state. */
function snapshotValue(previous: unknown, value: unknown): unknown {
  if (Object.is(previous, value) || value === null || typeof value !== "object") return value;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) {
    if (value instanceof Date && previous instanceof Date && value.getTime() === previous.getTime()) return previous;
    return structuredClone(value);
  }
  const old = previous && typeof previous === "object" && Array.isArray(previous) === array ? previous : undefined;
  const keys = Object.keys(value);
  let same =
    !!old &&
    keys.length === Object.keys(old).length &&
    (!array || (old as unknown[]).length === (value as unknown[]).length);
  const next: Record<string, unknown> = array
    ? (new Array((value as unknown[]).length) as unknown as Record<string, unknown>)
    : {};
  for (const key of keys) {
    const before = (old as Record<string, unknown> | undefined)?.[key];
    next[key] = snapshotValue(before, (value as Record<string, unknown>)[key]);
    if (!old || !Object.hasOwn(old, key) || !Object.is(next[key], before)) same = false;
  }
  return same ? old : next;
}

export interface ObservationChannel<T> {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

/** One scheduler per source; consumers due together receive the same coherent snapshot. */
export function createLiveObservation<T extends object>(source: T) {
  let snapshot = structuredClone(source);
  let timer: ReturnType<typeof setTimeout> | undefined;
  type Channel = ObservationChannel<T> & {
    listeners: Set<() => void>;
    due: number;
    ms: number;
    prepare: (next: T) => boolean;
    notify: () => void;
  };
  const channels = new Map<number, Channel>();
  const read = () => {
    snapshot = snapshotValue(snapshot, source) as T;
  };
  const publish = (due: Iterable<Channel>) => {
    // Advance every channel before a listener can read another rate or synchronously render React consumers.
    const changed = [...due].filter((channel) => channel.prepare(snapshot));
    changed.forEach((channel) => channel.notify());
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = undefined;
    const active = [...channels.values()].filter((channel) => channel.listeners.size);
    if (!active.length) return;
    const due = Math.min(...active.map((channel) => channel.due));
    timer = setTimeout(
      () => {
        const now = performance.now();
        read();
        const due: Channel[] = [];
        for (const channel of active) {
          if (!channel.listeners.size || channel.due > now) continue;
          channel.due = now + channel.ms;
          due.push(channel);
        }
        publish(due);
        schedule();
      },
      Math.max(0, due - performance.now()),
    );
  };
  return {
    channel(ms: number): ObservationChannel<T> {
      if (!Number.isFinite(ms) || ms <= 0) throw new Error("Observation interval must be positive");
      const existing = channels.get(ms);
      if (existing) return existing;
      let current = snapshot;
      const initial = current;
      const listeners = new Set<() => void>();
      const channel: Channel = {
        ms,
        due: 0,
        listeners,
        getSnapshot: () => current,
        getServerSnapshot: () => initial,
        prepare(next) {
          if (Object.is(current, next)) return false;
          current = next;
          return true;
        },
        notify() {
          listeners.forEach((listener) => listener());
        },
        subscribe(listener) {
          listeners.add(listener);
          if (listeners.size === 1) {
            read();
            publish([channel]);
            channel.due = performance.now() + ms;
            schedule();
          }
          return () => {
            listeners.delete(listener);
            if (!listeners.size) schedule();
          };
        },
      };
      channels.set(ms, channel);
      return channel;
    },
    refresh() {
      read();
      publish(channels.values());
    },
  };
}
