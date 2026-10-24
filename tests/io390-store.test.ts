// vitest: isolate
/**
 * The engine page's "Start from" setups run in a worker; anything the user changes while one is running wins over it.
 */
import { afterEach, expect, test, vi } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { SCENARIOS } from "@/engines/model/scenarios";

/** A worker that holds each request until the test answers it with the real setup. */
class HeldWorker {
  static last: HeldWorker;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  request: { seq: number; scenario: string } | null = null;
  requests: { seq: number; scenario: string; engine: string }[] = [];
  constructor() {
    HeldWorker.last = this;
  }
  postMessage(data: { seq: number; scenario: string; engine: string }) {
    this.request = data;
    this.requests.push(data);
  }
  answer(index = this.requests.length - 1) {
    const r = this.requests[index];
    const setup = SCENARIOS.find((x) => x.id === r.scenario)!.run(r.engine === O360.id ? O360 : IO390);
    this.onmessage?.({ data: { seq: r.seq, setup } });
  }
  terminate() {}
}

afterEach(() => vi.unstubAllGlobals());

test("a carburetor pump stroke resumes identically after serialization and stays independent in a fork", async () => {
  const { createEngineSimulation } = await import("@/components/engine/store");
  const parent = createEngineSimulation(O360);
  parent.useUi.getState().setControls({ throttle: 1 });
  parent.advance(0.1);
  const child = parent.fork();
  try {
    child.restoreSerialized(parent.serialize());
    expect(child.s.accelerator!.squirt).toBeGreaterThan(0);
    expect(child.s.accelerator).not.toBe(parent.s.accelerator);
    parent.advance(0.2);
    child.advance(0.2);
    expect(child.checkpoint()).toEqual(parent.checkpoint());
    const before = parent.checkpoint();
    child.useUi.getState().setControls({ throttle: 0 });
    child.advance(0.2);
    expect(parent.checkpoint()).toEqual(before);
    expect(child.s.accelerator!.plunger).toBeLessThan(parent.s.accelerator!.plunger);
  } finally {
    child.dispose();
    parent.dispose();
  }
});

async function freshSim() {
  vi.resetModules();
  vi.stubGlobal("Worker", HeldWorker);
  const store = await import("@/components/engine/store");
  return { store, sim: store.simFor(IO390) };
}

test("a setup applies its controls once the worker answers", async () => {
  const { store, sim } = await freshSim();
  store.startScenario(sim, "idle");
  expect(sim.useUi.getState().view.loading).toBe("idle");
  HeldWorker.last.answer();
  const ui = sim.useUi.getState();
  expect(ui.view.loading).toBeNull();
  expect(ui.view.scenario).toBe("idle");
  expect(sim.s.rpm).toBeGreaterThan(500);
});

test("moving a control or pausing while a setup runs drops the setup", async () => {
  const { store, sim } = await freshSim();
  store.startScenario(sim, "cruise75");
  sim.useUi.getState().setControls({ throttle: 0.42 });
  sim.useUi.getState().setView({ paused: true });
  HeldWorker.last.answer();
  const ui = sim.useUi.getState();
  expect(ui.controls.throttle).toBe(0.42);
  expect(ui.view.paused).toBe(true);
  expect(ui.view.loading).toBeNull();
  expect(sim.s.rpm).toBe(0);
});

test.each([
  [0, 1],
  [1, 0],
])("routes simultaneous engine setups to their owner when replies arrive %s then %s", async (first, second) => {
  const { store, sim: a } = await freshSim();
  const b = store.simFor(O360);
  store.startScenario(a, "cold");
  store.startScenario(b, "cold");
  HeldWorker.last.answer(first);
  HeldWorker.last.answer(second);
  for (const sim of [a, b]) {
    expect(sim.useUi.getState().view.loading).toBeNull();
    expect(sim.useUi.getState().view.scenario).toBe("cold");
    expect(sim.resets).toBe(1);
  }
});

test("canceling one engine's setup leaves another engine's request active", async () => {
  const { store, sim: a } = await freshSim();
  const b = store.simFor(O360);
  store.startScenario(a, "cold");
  store.startScenario(b, "cold");
  a.useUi.getState().setControls({ throttle: 0.42 });
  HeldWorker.last.answer(0);
  HeldWorker.last.answer(1);
  expect(a.resets).toBe(0);
  expect(a.useUi.getState().controls.throttle).toBe(0.42);
  expect(a.useUi.getState().view.loading).toBeNull();
  expect(b.resets).toBe(1);
  expect(b.useUi.getState().view.loading).toBeNull();
});

test("a newer request supersedes only the previous request in the same session", async () => {
  const { store, sim } = await freshSim();
  store.startScenario(sim, "cold");
  store.startScenario(sim, "cold");
  HeldWorker.last.answer(0);
  expect(sim.resets).toBe(0);
  expect(sim.useUi.getState().view.loading).toBe("cold");
  HeldWorker.last.answer(1);
  expect(sim.resets).toBe(1);
  expect(sim.useUi.getState().view.loading).toBeNull();
});

test("disposing a session cancels only its request and clears its step listeners", async () => {
  const { store, sim: a } = await freshSim();
  const b = store.simFor(O360);
  const observer = vi.fn();
  a.subscribeSteps(observer);
  store.startScenario(a, "cold");
  store.startScenario(b, "cold");
  a.dispose();
  a.dispose();
  HeldWorker.last.answer(0);
  HeldWorker.last.answer(1);
  expect(a.resets).toBe(0);
  expect(a.useUi.getState().view.loading).toBeNull();
  expect(b.resets).toBe(1);
  expect(() => a.advance(0.1)).toThrow(/disposed/);
  expect(observer).not.toHaveBeenCalled();
  expect(store.simFor(IO390)).not.toBe(a);
});

test("worker transport failure finishes the owning request through the local fallback", async () => {
  const { store, sim } = await freshSim();
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const post = vi.spyOn(HeldWorker.prototype, "postMessage").mockImplementation(() => {
    throw new Error("transport");
  });
  try {
    store.startScenario(sim, "cold");
    expect(sim.useUi.getState().view.loading).toBeNull();
    expect(sim.useUi.getState().view.scenario).toBe("cold");
    expect(sim.resets).toBe(1);
  } finally {
    post.mockRestore();
    warning.mockRestore();
  }
});

test("an unavailable worker settles every pending owner without leaving a loading flag", async () => {
  const { store, sim: a } = await freshSim();
  const b = store.simFor(O360);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    store.startScenario(a, "cold");
    store.startScenario(b, "cold");
    HeldWorker.last.onerror?.({ message: "unavailable" });
    for (const sim of [a, b]) {
      expect(sim.useUi.getState().view.loading).toBeNull();
      expect(sim.useUi.getState().view.scenario).toBe("cold");
      expect(sim.resets).toBe(1);
    }
  } finally {
    warning.mockRestore();
  }
});

test("engine sessions own their clocks, state and composed accessory step boundaries", async () => {
  const { store } = await freshSim();
  const create = () => {
    const sim = store.createEngineSimulation(IO390);
    sim.useUi.getState().setControls({ mags: "START", throttle: 0.2 });
    return sim;
  };
  const results = [5, 20, 60].map((fps) => {
    const sim = create();
    const accessory = vi.fn();
    const off = sim.subscribeSteps(accessory);
    for (let i = 0; i < fps; i++) sim.advance(1 / fps);
    expect(accessory).toHaveBeenCalledTimes(120);
    expect(accessory).toHaveBeenLastCalledWith(1 / 120);
    off();
    return sim.checkpoint();
  });
  expect(results[1]).toEqual(results[0]);
  expect(results[2]).toEqual(results[0]);
  const parent = create();
  parent.advance(0.013);
  const before = parent.checkpoint();
  const child = parent.fork();
  child.restoreSerialized(parent.serialize());
  child.advance(0.257);
  expect(parent.checkpoint()).toEqual(before);
  parent.advance(0.257);
  expect(child.checkpoint()).toEqual(parent.checkpoint());
});
