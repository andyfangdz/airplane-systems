/**
 * T-35: every documented TSIO-550-K Start-from setup remains finite under every modeled failure. Kept separate
 * from the engine calibration cases so CI can shard the long setup/failure matrix independently. Each case owns
 * a deep copy of its setup; the factory outputs are only read (SR22T POH 2-9; M-18 Table 2-1, Figure 2-41).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { limitFlags } from "@/engines/model/alerts";
import { noFailures, step, type Failures } from "@/engines/model/engine";
import { scenariosFor, type Setup } from "@/engines/model/scenarios";
import { TSIO550K } from "@/engines/tsio550k/spec";

const K = TSIO550K;

describe("T-35: the -K keeps a finite state in every Start-from setup under every failure", () => {
  const FAILURES: [string, (f: Failures) => void][] = [
    ["left magneto", (f) => (f.magL = true)],
    ["both magnetos", (f) => ((f.magL = true), (f.magR = true))],
    ["engine-driven fuel pump", (f) => (f.fuelPump = true)],
    ["induction filter", (f) => (f.filter = true)],
    ["starter", (f) => (f.starter = true)],
    ["every spark plug", (f) => f.plugs.forEach((p) => p.fill(true))],
    ["one nozzle", (f) => (f.nozzle[0] = 1)],
    ["every nozzle", (f) => f.nozzle.fill(1)],
    ["starter stuck engaged", (f) => (f.starterStuck = true)],
    ["intake leak", (f) => (f.intakeLeak[1] = 1)],
    ["wastegate seized open", (f) => (f.wastegateSeized = "open")],
    ["wastegate seized closed", (f) => (f.wastegateSeized = "closed")],
    ["wastegate actuator oil", (f) => (f.wastegateOil = true)],
    ["oil leak", (f) => (f.oilLeak = true)],
    ["induction leak", (f) => (f.inductionLeak = true)],
    ["left intercooler leak", (f) => (f.intercoolerLeak = [true, false])],
    ["right intercooler leak", (f) => (f.intercoolerLeak = [false, true])],
    ["exhaust leak", (f) => (f.exhaustLeak = true)],
    ["left turbocharger", (f) => (f.turboInternal = [true, false])],
    ["right turbocharger", (f) => (f.turboInternal = [false, true])],
    ["both turbochargers", (f) => (f.turboInternal = [true, true])],
    ["controller misadjusted", (f) => (f.controllerMisadjust = true)],
    ["left TIT probe", (f) => (f.titProbe = [true, false])],
    ["right TIT probe", (f) => (f.titProbe = [false, true])],
    [
      "every turbo-system failure at once",
      (f) =>
        Object.assign(f, {
          wastegateSeized: "closed",
          wastegateOil: true,
          oilLeak: true,
          inductionLeak: true,
          intercoolerLeak: [true, true],
          exhaustLeak: true,
          turboInternal: [true, true],
          controllerMisadjust: true,
          titProbe: [true, true],
        }),
    ],
  ];
  /** Paths of non-finite numbers in the state; a cylinder with no fuel has λ = ∞, which is the one allowed. */
  const nonFinite = (o: unknown, path = ""): string[] =>
    typeof o === "number"
      ? Number.isFinite(o) || (path.endsWith(".lambda") && o === Infinity)
        ? []
        : [`${path}=${o}`]
      : o && typeof o === "object"
        ? Object.entries(o).flatMap(([k, v]) => nonFinite(v, `${path}.${k}`))
        : [];

  // each Start-from setup is made once, then every failure starts from a copy of it
  let setups: { id: string; setup: Setup }[] = [];
  beforeAll(() => {
    setups = scenariosFor(K).map((sc) => ({ id: sc.id, setup: sc.run(K) }));
  }, 120_000);

  test.each(FAILURES)("20 s at 60 Hz in every setup: %s", (_, fail) => {
    for (const sc of setups) {
      const { s, c, env } = structuredClone(sc.setup);
      const f = noFailures(K);
      fail(f);
      let first: string[] = [];
      for (let i = 0; i < 20 * 60 && !first.length; i++) {
        step(K, s, c, env, f, 1 / 60, 1);
        if (i % 6 === 0) first = nonFinite(s).map((p) => `${sc.id} at ${(i / 60).toFixed(1)} s: ${p}`);
      }
      expect(first).toEqual([]);
      expect(nonFinite(s).map((p) => `${sc.id} at 20 s: ${p}`)).toEqual([]);
      expect(nonFinite(limitFlags(K, s, env, { failures: f, controls: c }))).toEqual([]);
    }
  });

  test("no -K Start-from setup raises a TIT, TIT-transient, turbine-speed or MAN PRESSURE flag (POH 2-9; M-18 Table 2-1, Figure 2-41)", () => {
    const bad = setups.flatMap(({ id, setup }) =>
      limitFlags(K, setup.s, setup.env, { failures: noFailures(K), controls: setup.c })
        .filter(
          (f) =>
            f.cas === "TIT" ||
            f.cas === "MAN PRESSURE" ||
            f.src === K.limits.titTransient!.src ||
            f.src === K.limits.turbineRpmMax!.src,
        )
        .map((f) => `${id}: ${f.text}`),
    );
    expect(bad).toEqual([]);
  });
});
