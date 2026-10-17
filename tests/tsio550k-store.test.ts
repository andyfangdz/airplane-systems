// vitest: isolate
/**
 * "Start from" setups per engine: the IO-390 keeps its list, the TSIO-550-K gets its own POH setups, and the page and
 * its worker resolve an id through the engine's list. Where each -K setup settles (rpm, manifold pressure, power) is
 * the calibration's test in tests/tsio550k-engine.test.ts; these check the lists, the resolution and the setups'
 * controls.
 */
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { noFailures, step } from "@/engines/model/engine";
import { labelOf, scenarioById, scenariosFor, type Setup } from "@/engines/model/scenarios";
import { O360 } from "@/engines/o360/spec";
import { tasFor } from "@/engines/tsio550k/scenarios";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";

const K = TSIO550K;
const K_IDS = [
  "cold",
  "idle",
  "runup",
  "takeoff",
  "coldoil",
  "climb",
  "cruiseclimb",
  "cruise",
  "highcruise",
  "descent",
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/engines");
  vi.restoreAllMocks();
});

/** Paths of non-finite numbers; a cylinder with no fuel has λ = ∞, which is the one allowed. */
const nonFinite = (o: unknown, path = ""): string[] =>
  typeof o === "number"
    ? Number.isFinite(o) || (path.endsWith(".lambda") && o === Infinity)
      ? []
      : [`${path}=${o}`]
    : o && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) => nonFinite(v, `${path}.${k}`))
      : [];

describe("the lists", () => {
  const listed = (spec: EngineSpec) => scenariosFor(spec).map((x) => [x.id, labelOf(x, spec)]);
  const GENERAL = [
    ["cold", "Cold and stopped"],
    ["idle", "Warm idle"],
    ["runup", "Magneto check"],
    ["takeoff", "Takeoff"],
    ["climb", "Full-power climb"],
    ["cruise75", "Performance cruise, 75 %"],
    ["economy65", "Economy cruise, 65 %"],
  ];

  // passes before this change too: the IO-390's and O-360's lists stay as they were
  test("the IO-390 and the O-360 keep their setups", () => {
    expect(listed(IO390)).toEqual(GENERAL);
    expect(listed(O360)).toEqual([...GENERAL, ["carbice", "Carburetor icing"]]);
  });

  test("the TSIO-550-K lists the ten POH setups", () => {
    expect(scenariosFor(K).map((x) => x.id)).toEqual(K_IDS);
  });

  test("every TSIO-550-K note cites a POH page and no Lycoming document", () => {
    for (const sc of scenariosFor(K)) {
      expect(sc.note(K), sc.id).toMatch(/POH \d+A?-\d+/);
      expect(`${labelOf(sc, K)} ${sc.note(K)}`, sc.id).not.toMatch(/IOM|Lycoming/);
    }
  });

  test("scenario ids resolve per engine", () => {
    expect(scenarioById(K, "cruise")?.label).toBe("Cruise, 75 % at 16.4 gph");
    expect(scenarioById(K, "runup")?.note(K)).toMatch(/full rich/); // the -K's own run-up, not the general one
    expect(scenarioById(IO390, "cruise")).toBeUndefined();
    expect(scenarioById(K, "cruise75")).toBeUndefined();
    expect(labelOf(scenarioById(IO390, "cruise75")!, IO390)).toBe("Performance cruise, 75 %");
  });

  test("the TSIO-550-K spec has every value the setups read (POH 2-6, 4-22, 4-23, 5-33)", () => {
    expect(K.limits.leanMaxMap?.value).toBe(30.5);
    expect(K.limits.chtMinDescent?.value).toBe(240);
    expect(K.calibration.lambdaTarget).toBeGreaterThan(1);
    expect(K.rating.cruise.find((p) => p.pct === 75)?.gph).toBe(16.4);
  });

  test("indicated airspeed converts to true airspeed on a standard day", () => {
    expect(tasFor(120, 0)).toBeCloseTo(120, 2);
    expect(tasFor(120, 18000)).toBeCloseTo(159, -0.5);
  });
});

describe("the worker", () => {
  /** Load the worker module with `self` and `postMessage` stubbed; returns its message handler and the posts. */
  async function worker() {
    vi.resetModules();
    const self: { onmessage?: (e: { data: unknown }) => void } = {};
    const posted = vi.fn();
    vi.stubGlobal("self", self);
    vi.stubGlobal("postMessage", posted);
    await import("@/components/engine/scenario.worker");
    return { send: (data: unknown) => self.onmessage!({ data }), posted };
  }

  test("the worker sets up the TSIO-550-K's own scenario for an id both lists use", async () => {
    const { send, posted } = await worker();
    // "runup" is also a general setup; the -K's keeps the fuel pump on BOOST at full rich (POH 4-14 steps 8, 9),
    // where the general one switches the boost pump off after the start
    send({ seq: 7, engine: K.id, scenario: "runup", failures: noFailures(K) });
    expect(posted).toHaveBeenCalledTimes(1);
    const reply = posted.mock.calls[0][0] as { seq: number; setup?: Setup; error?: string };
    expect(reply.error).toBeUndefined();
    expect(reply.seq).toBe(7);
    expect(reply.setup?.c.boost).toBe(true);
    expect(reply.setup?.c.mixture).toBe(1);
  });

  test("an id the engine doesn't list takes the worker's error path", async () => {
    const { send, posted } = await worker();
    send({ seq: 3, engine: IO390.id, scenario: "cruise", failures: noFailures(IO390) });
    expect(posted).toHaveBeenCalledWith({ seq: 3, error: expect.stringMatching(/Unknown engine or scenario/) });
  });
});

describe("the page", () => {
  /** A worker that always fails, so the page sets the scenario up itself. */
  class FailingWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: { message: string }) => void) | null = null;
    postMessage(data: { seq: number }) {
      this.onmessage?.({ data: { seq: data.seq, error: "test" } });
    }
    terminate() {}
  }

  async function freshSim() {
    vi.resetModules();
    vi.stubGlobal("Worker", FailingWorker);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await import("@/components/engine/store");
    return { store, sim: store.simFor(K), warn };
  }

  test("the page sets up a TSIO-550-K scenario itself when the worker fails", async () => {
    const { store, sim, warn } = await freshSim();
    store.startScenario(sim, "cold");
    expect(warn).toHaveBeenCalled();
    const ui = sim.useUi.getState();
    expect(ui.view.scenario).toBe("cold");
    expect(ui.view.loading).toBeNull();
  });

  test("an id the engine doesn't list applies nothing", async () => {
    const { store, sim } = await freshSim();
    expect(() => store.startScenario(sim, "cruise75")).toThrow("Unknown engine scenario cruise75");
    expect(sim.useUi.getState().view.scenario).toBeNull();
    expect(sim.s.rpm).toBe(0);
  });
});

describe("the TSIO-550-K setups", () => {
  const runs = new Map<string, Setup>();
  beforeAll(() => {
    for (const sc of scenariosFor(K)) runs.set(sc.id, sc.run(K));
  }, 120_000);
  const run = (id: string) => runs.get(id)!;
  /**
   * Manifold pressure and fuel flow (gph) averaged over 30 s with the setup's controls held. Lean of peak at cruise
   * manifold pressure the engine model does not sit still (rpm, manifold pressure and fuel flow swing together), so
   * the setups aim the gauges' middle; a copy runs, the cached setup stays as it was.
   */
  const held = (id: string) => {
    const { s, c, env } = structuredClone(run(id));
    let map = 0,
      gph = 0;
    for (let i = 0; i < 120; i++) {
      step(K, s, c, env, noFailures(K), 0.25);
      map += s.map / 120;
      gph += s.fuel / AVGAS_LB_GAL / 120;
    }
    return { map, gph };
  };

  test("restoring or selecting cold clears the previous takeoff's optional leaning cap", async () => {
    const { createEngineSimulation, replaceState } = await import("@/components/engine/store");
    const sim = createEngineSimulation(K);
    try {
      const cold = sim.checkpoint();
      replaceState(sim, run("takeoff").s);
      expect(sim.s.leanCap).toBeDefined();
      sim.restore(cold);
      expect(sim.checkpoint()).toEqual(cold);
      replaceState(sim, run("takeoff").s);
      replaceState(sim, run("cold").s);
      expect(sim.s).toEqual(run("cold").s);
    } finally {
      sim.dispose();
    }
  });

  test("a cold checkpoint clears oil loss and the leaning timer after a turbo oil leak (POH 3-28, 4-22)", async () => {
    const { createEngineSimulation, replaceState } = await import("@/components/engine/store");
    const sim = createEngineSimulation(K);
    try {
      const root = sim.s;
      const cold = sim.checkpoint();
      // Older cold checkpoints omit optional failure state entirely.
      delete cold.s.oilLossQt;
      delete cold.s.leanOverS;
      delete cold.s.leanOver;
      replaceState(sim, run("takeoff").s);
      const takeoff = run("takeoff");
      sim.useUi.getState().setControls(takeoff.c);
      sim.useUi.getState().setEnv(takeoff.env);
      sim.useUi.getState().setFailures({ oilLeak: true });
      sim.useUi.getState().setControls({ mixture: 0.8 });
      for (let i = 0; i < 600; i++) sim.advance(1 / 120);
      expect(sim.s.oilLossQt).toBeGreaterThan(0);
      expect(sim.s.leanOverS).toBeGreaterThan(0);
      sim.restore(cold);
      expect(sim.s).toBe(root);
      for (const key of ["oilLossQt", "leanOverS", "leanOver"]) expect(Object.hasOwn(sim.s, key), key).toBe(false);
      expect(sim.s.running).toBe(false);
      expect(sim.s.rpm).toBe(0);
      expect(sim.checkpoint()).toEqual(cold);
    } finally {
      sim.dispose();
    }
  });

  test("every TSIO-550-K setup runs to completion with a finite state", () => {
    for (const id of K_IDS) expect(nonFinite(run(id)), id).toEqual([]);
  });

  test("the TSIO-550-K setups leave the propeller control alone (POH 7-32)", () => {
    for (const id of K_IDS) expect(run(id).c.prop, id).toBe(1);
  });

  test("after the POH 4-12 start the fuel pump stays on BOOST and the mixture is leaned for taxi", () => {
    const { c, s } = run("idle");
    expect(c.mags).toBe("BOTH");
    expect(c.boost).toBe(true);
    expect(c.mixture).toBeLessThan(1);
    expect(c.throttle).toBe(0);
    expect(s.running).toBe(true);
  });

  test("run-up, takeoff and the full-power climb are full rich with BOOST (POH 4-14, 4-20)", () => {
    for (const id of ["runup", "takeoff", "coldoil", "climb"]) {
      expect(run(id).c.mixture, id).toBe(1);
      expect(run(id).c.boost, id).toBe(true);
    }
    expect(run("runup").env.altFt).toBe(0);
    for (const id of ["takeoff", "coldoil", "climb"]) expect(run(id).c.throttle, id).toBe(1);
    expect(run("takeoff").env).toMatchObject({ altFt: 0, tasKt: 77 }); // POH 4-18: rotate at 77–80 KIAS
  });

  test("the cold-oil takeoff has the oil near 100 °F, above the 75 °F minimum (POH 4-14, 2-6)", () => {
    const oil = run("coldoil").s.oilT;
    expect(oil).toBeGreaterThanOrEqual(100);
    expect(oil).toBeLessThanOrEqual(120);
    expect(oil).toBeGreaterThan(K.limits.oilTempMinTakeoff!.value);
  });

  test("climb and cruise settings come from the POH (4-20, 4-21, 5-33, 5-34)", () => {
    expect(run("climb").env).toMatchObject({ altFt: 18000, tasKt: tasFor(120, 18000) });
    expect(run("cruiseclimb").env).toMatchObject({ altFt: 10000, tasKt: tasFor(130, 10000) });
    expect(run("cruiseclimb").c.boost).toBe(true);
    expect(run("cruise").env).toMatchObject({ altFt: 10000, tasKt: 175 });
    expect(run("highcruise").env).toMatchObject({ altFt: 25000, tasKt: 201 });
    for (const id of ["cruise", "highcruise", "descent"]) expect(run(id).c.boost, id).toBe(false);
  });

  test("cruise and high cruise are leaned to the table's 16.4 gph (POH 5-33, 5-34)", () => {
    expect(held("cruise").gph).toBeCloseTo(16.4, 0.5);
    expect(held("highcruise").gph).toBeCloseTo(16.4, 0.5);
  });

  test("leaned setups stay at or below 30.5 in.Hg (POH 4-22)", () => {
    for (const id of ["cruiseclimb", "cruise", "highcruise", "descent"])
      expect(held(id).map, id).toBeLessThanOrEqual(K.limits.leanMaxMap!.value + 0.2);
  });
});
