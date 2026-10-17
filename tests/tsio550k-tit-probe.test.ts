// vitest: isolate
/** Failed TIT probes contribute neither readings nor transient dwell (POH 3-31; M-18 Table 2-1). */
import { afterEach, expect, test, vi } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { defaultControls, defaultEnvironment, initialState, noFailures, step } from "@/engines/model/engine";
import { limitFlags } from "@/engines/model/alerts";
import { encodeCheckpoint } from "@/lib/checkpoint";
import { createEngineSimulation, replaceState } from "@/components/engine/store";
import * as turbo from "@/engines/model/turbo";

afterEach(() => vi.restoreAllMocks());
test.each([0, 1])(
  "a failed TIT probe on side %i cannot supply the working side transient dwell (POH 3-31)",
  (failed) => {
    const env = defaultEnvironment(),
      c = defaultControls(),
      f = noFailures(K),
      s = initialState(K, env);
    f.titProbe = [failed === 0, failed === 1];
    const target: [number, number] = [1700, 1700];
    target[failed] = 1800;
    vi.spyOn(turbo, "titTargets").mockImplementation(() => target);
    const advance = (seconds: number) => {
      s.tit = [...target];
      for (let t = 0; t < seconds; t += 0.25) step(K, s, c, env, f, 0.25);
    };
    const transient = () =>
      limitFlags(K, s, env, { failures: f, controls: c }).filter((x) => x.src === K.limits.titTransient!.src);
    advance(40);
    expect(s.titOverS).toBeGreaterThan(K.limits.titTransient!.seconds);
    expect(transient()).toEqual([]);
    target[1 - failed] = 1760;
    advance(1);
    expect(transient()).toEqual([]);
    advance(28);
    expect(transient()).toEqual([]);
    advance(2);
    expect(transient().map((x) => x.level)).toEqual(["warn"]);
    target[1 - failed] = 1700;
    advance(1);
    expect(transient()).toEqual([]);
  },
);

test.each([0, 1])(
  "failing the other probe preserves side %i's existing 35-second dwell (M-18 Table 2-1)",
  (healthy) => {
    const env = defaultEnvironment(),
      c = defaultControls(),
      f = noFailures(K),
      s = initialState(K, env);
    const target: [number, number] = [1700, 1700];
    target[healthy] = 1760;
    vi.spyOn(turbo, "titTargets").mockImplementation(() => target);
    const advance = (seconds: number) => {
      s.tit = [...target];
      for (let t = 0; t < seconds; t += 0.25) step(K, s, c, env, f, 0.25);
    };
    const transient = () =>
      limitFlags(K, s, env, { failures: f, controls: c }).filter((x) => x.src === K.limits.titTransient!.src);
    advance(35);
    expect(transient().map((x) => x.level)).toEqual(["warn"]);
    f.titProbe = [healthy === 1, healthy === 0];
    expect(transient().map((x) => x.level)).toEqual(["warn"]);
    advance(1);
    expect(transient().map((x) => x.level)).toEqual(["warn"]);
    expect(s.titProbeOverS?.[healthy]).toBeGreaterThanOrEqual(35);
    f.titProbe = [false, false];
    expect(transient().map((x) => x.level)).toEqual(["warn"]);
  },
);

test.each([0, 1])("repairing side %i cannot borrow the other side's old transient dwell (POH 3-31)", (repaired) => {
  const env = defaultEnvironment(),
    c = defaultControls(),
    f = noFailures(K),
    s = initialState(K, env);
  f.titProbe = [repaired === 0, repaired === 1];
  const target: [number, number] = [1800, 1800];
  target[repaired] = 1700;
  vi.spyOn(turbo, "titTargets").mockImplementation(() => target);
  const advance = (seconds: number) => {
    s.tit = [...target];
    for (let t = 0; t < seconds; t += 0.25) step(K, s, c, env, f, 0.25);
  };
  const transient = () =>
    limitFlags(K, s, env, { failures: f, controls: c }).filter((x) => x.src === K.limits.titTransient!.src);
  advance(35);
  expect(transient().map((x) => x.level)).toEqual(["warn"]);
  target[1 - repaired] = 1700;
  target[repaired] = 1760;
  advance(1);
  expect(transient()).toEqual([]);
  f.titProbe = [false, false];
  expect(transient()).toEqual([]);
  advance(28);
  expect(transient()).toEqual([]);
  advance(2);
  expect(transient().map((x) => x.level)).toEqual(["warn"]);
});

test.each([0, 1])("repairing side %i reveals its own tracked over-temperature dwell (POH 3-31)", (repaired) => {
  const env = defaultEnvironment(),
    c = defaultControls(),
    f = noFailures(K),
    s = initialState(K, env);
  f.titProbe = [repaired === 0, repaired === 1];
  const target: [number, number] = [1700, 1700];
  target[repaired] = 1760;
  vi.spyOn(turbo, "titTargets").mockImplementation(() => target);
  s.tit = [...target];
  for (let t = 0; t < 35; t += 0.25) step(K, s, c, env, f, 0.25);
  const transient = () =>
    limitFlags(K, s, env, { failures: f, controls: c }).filter((x) => x.src === K.limits.titTransient!.src);
  expect(transient()).toEqual([]);
  expect(s.titProbeOverS?.[repaired]).toBeCloseTo(35, 8);
  f.titProbe = [false, false];
  expect(transient().map((x) => x.level)).toEqual(["warn"]);
});

test.each([undefined, 0, 1])(
  "legacy checkpoint dwell survives stepping with failed probe %s (M-18 Table 2-1)",
  (failed) => {
    const sim = createEngineSimulation(K);
    try {
      const saved = sim.checkpoint();
      saved.s.tit = [1760, 1760];
      saved.s.titOverS = 35;
      delete saved.s.titProbeOverS;
      saved.ui.failures.titProbe = [failed === 0, failed === 1];
      vi.spyOn(turbo, "titTargets").mockReturnValue([1760, 1760]);
      sim.restore(saved);
      const transient = () => {
        const ui = sim.useUi.getState();
        return limitFlags(K, sim.s, ui.env, ui).filter((x) => x.src === K.limits.titTransient!.src);
      };
      for (let i = 0; i < 4; i++) {
        sim.advance(0.25);
        expect(transient().map((x) => x.level)).toEqual(["warn"]);
        expect(sim.s.titProbeOverS?.[0]).toBeCloseTo(35 + (i + 1) * 0.25, 8);
        expect(sim.s.titProbeOverS?.[1]).toBeCloseTo(35 + (i + 1) * 0.25, 8);
      }
      if (failed !== undefined) {
        // Cooling the healthy side must leave no warning from the still-hot failed side.
        const target: [number, number] = [1700, 1700];
        target[failed] = 1760;
        sim.s.tit = [...target];
        vi.mocked(turbo.titTargets).mockReturnValue(target);
        sim.advance(0.25);
        expect(sim.s.titProbeOverS?.[1 - failed]).toBe(0);
        expect(transient()).toEqual([]);
      }
    } finally {
      sim.dispose();
    }
  },
);

test.each([0, 1])("legacy checkpoint resets cooled side %i without inventing dwell (M-18 Table 2-1)", (cooled) => {
  const sim = createEngineSimulation(K);
  try {
    const saved = sim.checkpoint();
    const target: [number, number] = [1760, 1760];
    target[cooled] = 1700;
    saved.s.tit = [...target];
    saved.s.titOverS = 35;
    delete saved.s.titProbeOverS;
    vi.spyOn(turbo, "titTargets").mockReturnValue(target);
    sim.restore(saved);
    sim.advance(0.25);
    expect(sim.s.titProbeOverS?.[cooled]).toBe(0);
    expect(sim.s.titProbeOverS?.[1 - cooled]).toBeCloseTo(35.25, 8);
    target[cooled] = 1760;
    target[1 - cooled] = 1700;
    sim.s.tit = [...target];
    sim.advance(0.25);
    expect(sim.s.titProbeOverS?.[cooled]).toBeCloseTo(0.25, 8);
    const ui = sim.useUi.getState();
    expect(limitFlags(K, sim.s, ui.env, ui).filter((x) => x.src === K.limits.titTransient!.src)).toEqual([]);
  } finally {
    sim.dispose();
  }
});

test.each([false, true])("checkpoint boundaries preserve optional history presence = %s", (present) => {
  const sim = createEngineSimulation(K);
  const fields = ["oilLossQt", "leanOverS", "leanOver", "titProbeOverS"] as const;
  try {
    const saved = sim.checkpoint();
    if (present) {
      Object.assign(saved.s, { oilLossQt: 0.5, leanOverS: 12, leanOver: true, titProbeOverS: [35, 2] });
    } else {
      for (const key of fields) delete saved.s[key];
    }
    Object.assign(sim.s, { oilLossQt: 1, leanOverS: 20, leanOver: true, titProbeOverS: [40, 40] });
    sim.restoreSerialized(encodeCheckpoint(saved));
    expect(sim.s).toEqual(saved.s);
    const child = sim.fork();
    try {
      expect(child.s).toEqual(saved.s);
      if (present) {
        child.s.titProbeOverS![0] = 99;
        expect(sim.s.titProbeOverS).toEqual([35, 2]);
      }
    } finally {
      child.dispose();
    }
    sim.useUi.getState().setFailures({ oilLeak: true, titProbe: [true, false] });
    expect(sim.s).toEqual(saved.s);
    sim.useUi.getState().setFailures(noFailures(K));
    expect(sim.s).toEqual(saved.s);
    const cold = initialState(K);
    replaceState(sim, cold);
    expect(sim.s).toEqual(cold);
    expect(sim.s.titProbeOverS).toBeUndefined();
    sim.advance(0.25);
    expect(sim.s.titProbeOverS).toEqual([0, 0]);
    expect(sim.s.leanOverS).toBe(0);
    expect(sim.s.leanOver).toBe(false);
  } finally {
    sim.dispose();
  }
});
