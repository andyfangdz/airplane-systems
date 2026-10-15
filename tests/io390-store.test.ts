// vitest: isolate
/**
 * The engine page's "Start from" setups run in a worker; anything the user changes while one is running wins over it.
 */
import { afterEach, expect, test, vi } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { SCENARIOS } from "@/engines/model/scenarios";

/** A worker that holds each request until the test answers it with the real setup. */
class HeldWorker {
  static last: HeldWorker;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  request: { seq: number; scenario: string } | null = null;
  constructor() {
    HeldWorker.last = this;
  }
  postMessage(data: { seq: number; scenario: string }) {
    this.request = data;
  }
  answer() {
    const r = this.request!;
    const setup = SCENARIOS.find((x) => x.id === r.scenario)!.run(IO390);
    this.onmessage?.({ data: { seq: r.seq, setup } });
  }
  terminate() {}
}

afterEach(() => vi.unstubAllGlobals());

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
