// vitest: isolate
/** Failed TIT probes contribute neither readings nor transient dwell (POH 3-31; M-18 Table 2-1). */
import { afterEach, expect, test, vi } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { defaultControls, defaultEnvironment, initialState, noFailures, step } from "@/engines/model/engine";
import { limitFlags } from "@/engines/model/alerts";
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
