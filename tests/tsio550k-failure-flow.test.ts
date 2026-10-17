// vitest: isolate
/** The parallel induction paths join at the throttle body (AMM 71-60 PDF 2542). */
import { afterEach, expect, test, vi } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { noFailures, step } from "@/engines/model/engine";
import { scenarioById } from "@/engines/model/scenarios";
import * as turbo from "@/engines/model/turbo";

afterEach(() => vi.restoreAllMocks());
test("the working intercooler passes the failed-path return flow included in compressor power (AMM 71-60)", () => {
  const x = scenarioById(K, "cruise")!.run(K),
    f = noFailures(K);
  f.turboInternal = [true, false];
  const power = vi.spyOn(turbo, "equilibriumPR"),
    drop = vi.spyOn(turbo, "intercoolerDrop");
  step(K, x.s, x.c, x.env, f, 0.25);
  const flow = power.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[2]);
  const cooled = drop.mock.calls.filter((c) => c[0] === K.turbo).map((c) => c[1]);
  expect(flow.length).toBeGreaterThan(0);
  expect(cooled).toEqual(flow);
});
