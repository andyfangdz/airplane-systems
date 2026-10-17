import { afterEach, expect, it, vi } from "vitest";
import { createLiveObservation } from "@/lib/live-observation";

afterEach(() => vi.useRealTimers());

it("shares one scheduler across rates and one snapshot for simultaneous observations", () => {
  vi.useFakeTimers();
  const source = { engine: { rpm: 1000 }, fuel: { left: 20 } };
  const publisher = createLiveObservation(source);
  const fast = publisher.channel(100);
  const slow = publisher.channel(200);
  const removeFast = fast.subscribe(() => {});
  const removeSlow = slow.subscribe(() => {});
  expect(vi.getTimerCount()).toBe(1);
  const old = slow.getSnapshot();
  source.engine.rpm = 2000;
  vi.advanceTimersByTime(100);
  expect(fast.getSnapshot().engine.rpm).toBe(2000);
  expect(slow.getSnapshot()).toBe(old);
  vi.advanceTimersByTime(100);
  expect(slow.getSnapshot()).toBe(fast.getSnapshot());
  expect(slow.getSnapshot().fuel).toBe(old.fuel);
  expect(old.engine.rpm).toBe(1000);
  removeFast();
  expect(vi.getTimerCount()).toBe(1);
  removeSlow();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not notify unchanged observations and immediately publishes an atomic command", () => {
  vi.useFakeTimers();
  const source: { engine: { rpm: number }; lamps: boolean[]; temporary?: boolean } = {
    engine: { rpm: 0 },
    lamps: [false],
    temporary: true,
  };
  const publisher = createLiveObservation(source);
  const channel = publisher.channel(100);
  const notify = vi.fn();
  const unsubscribe = channel.subscribe(notify);
  vi.advanceTimersByTime(500);
  expect(notify).not.toHaveBeenCalled();
  const before = channel.getSnapshot();
  source.engine.rpm = 1500;
  source.lamps[0] = true;
  delete source.temporary;
  publisher.refresh();
  expect(notify).toHaveBeenCalledTimes(1);
  expect(channel.getSnapshot()).toEqual({ engine: { rpm: 1500 }, lamps: [true] });
  expect(before).toEqual({ engine: { rpm: 0 }, lamps: [false], temporary: true });
  unsubscribe();
  source.engine.rpm = 2400;
  const stop = channel.subscribe(notify);
  expect(channel.getSnapshot().engine.rpm).toBe(2400);
  stop();
});

it.each(["sample", "command"])("publishes all due channels before notifying a %s observer", (trigger) => {
  vi.useFakeTimers();
  const source = { revision: 0 };
  const publisher = createLiveObservation(source);
  const fast = publisher.channel(100);
  const slow = publisher.channel(200);
  const observed: number[][] = [];
  const stopFast = fast.subscribe(() => observed.push([fast.getSnapshot().revision, slow.getSnapshot().revision]));
  const stopSlow = slow.subscribe(() => observed.push([fast.getSnapshot().revision, slow.getSnapshot().revision]));
  if (trigger === "sample") vi.advanceTimersByTime(100);
  source.revision = 1;
  if (trigger === "sample") vi.advanceTimersByTime(100);
  else publisher.refresh();
  expect(observed).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect(fast.getSnapshot()).toBe(slow.getSnapshot());
  stopFast();
  stopSlow();
  expect(vi.getTimerCount()).toBe(0);
});

it("retains sparse array shape and observes length-only changes without mutating previous snapshots", () => {
  const source = { lamps: [true] as boolean[] };
  const publisher = createLiveObservation(source);
  const channel = publisher.channel(100);
  const initial = channel.getSnapshot();
  source.lamps.length = 4;
  publisher.refresh();
  const expanded = channel.getSnapshot();
  expect(expanded.lamps).toHaveLength(4);
  expect(Object.keys(expanded.lamps)).toEqual(["0"]);
  expect(initial.lamps).toEqual([true]);
  publisher.refresh();
  expect(channel.getSnapshot()).toBe(expanded);
  source.lamps.length = 2;
  publisher.refresh();
  const reduced = channel.getSnapshot();
  expect(reduced.lamps).toHaveLength(2);
  expect(Object.keys(reduced.lamps)).toEqual(["0"]);
  expect(expanded.lamps).toHaveLength(4);
  delete source.lamps[0];
  publisher.refresh();
  expect(channel.getSnapshot().lamps).toHaveLength(2);
  expect(Object.keys(channel.getSnapshot().lamps)).toEqual([]);
  expect(reduced.lamps[0]).toBe(true);
});
