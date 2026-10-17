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
