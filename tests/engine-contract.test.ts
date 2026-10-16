/**
 * The engine spec contract for turbocharged Continental engines (the TSIO-550-K): every new spec field is optional and
 * absent means the code path the IO-390 and O-360 always ran. The constants the model used to hard-code now read spec
 * fields whose defaults are those constants, so writing the defaults out changes nothing, and changing one changes the
 * run.
 */
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import type { EngineSpec, TurboSpec } from "@/engines/types";
import {
  defaultControls,
  defaultEnvironment,
  initialState,
  noFailures,
  prime,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import { cToF } from "@/engines/model/atmosphere";
import { patched, type Patch } from "./helpers";

/** One leg of the scripted run: controls, environment and failures carry over to later legs unless changed. */
interface Leg {
  s: number;
  c?: Partial<Controls>;
  env?: Partial<Environment>;
  f?: Partial<Failures>;
}

/**
 * 20 s that reach every moved constant: boost pump and starter, engine pump, blocked filter, alternate air (carburetor
 * heat on the O-360), ram air, slipstream and a low sump.
 */
const SCRIPT: Leg[] = [
  { s: 3, c: { mags: "START", boost: true, throttle: 0.15, mixture: 1 } },
  { s: 5, c: { mags: "BOTH", boost: false, throttle: 0.25 } },
  { s: 3, c: { throttle: 1, prop: 1 }, f: { filter: true } },
  { s: 3, c: { altAir: true, carbHeat: 1 } },
  {
    s: 6,
    c: { altAir: false, carbHeat: 0, throttle: 0.6, prop: 0.8, mixture: 0.8 },
    env: { tasKt: 120, oilQt: 2.5 },
    f: { filter: false },
  },
];

/** The engine state every half second through the script (the carbureted engine is primed first, OM p. 3-2). */
function run(spec: EngineSpec): EngineState[] {
  const c = defaultControls(),
    env = defaultEnvironment(),
    f = noFailures(spec);
  const s = prime(spec, initialState(spec, env), 2);
  const trace: EngineState[] = [];
  for (const leg of SCRIPT) {
    Object.assign(c, leg.c);
    Object.assign(env, leg.env);
    Object.assign(f, leg.f);
    for (let t = 0; t < leg.s; t += 0.5) trace.push(structuredClone(step(spec, s, c, env, f, 0.5)));
  }
  return trace;
}

/** The constants every engine's path reads, written out at their defaults, plus the new switches at theirs. */
const SHARED: Patch<EngineSpec> = {
  ignition: { startMags: "retard" },
  induction: { altAir: "manual", altAirDeltaC: 15, filterBlockedArea: 0.12, ramEta: 0.7 },
  propeller: { control: "lever" },
  accessories: { starterTorque: 230, starterFreeRpm: 380 },
  calibration: { slipKt: 55 },
  oil: { pickupQt: [1.5, 3] },
};

/** Each moved constant on the path every engine runs, set away from its default. */
const MOVED_SHARED: [string, Patch<EngineSpec>][] = [
  ["induction.ramEta", { induction: { ramEta: 0.9 } }],
  ["accessories.starterTorque", { accessories: { starterTorque: 200 } }],
  ["accessories.starterFreeRpm", { accessories: { starterFreeRpm: 300 } }],
  ["calibration.slipKt", { calibration: { slipKt: 70 } }],
  ["oil.pickupQt", { oil: { pickupQt: [1, 2] } }],
];

const CASES: { name: string; spec: EngineSpec; defaults: Patch<EngineSpec>; moved: [string, Patch<EngineSpec>][] }[] = [
  {
    name: "IO-390 (servo injection)",
    spec: IO390,
    defaults: { ...SHARED, fuelSystem: { kind: "injected", pumpPsi: 28, boostPsi: 26 } },
    moved: [
      ...MOVED_SHARED,
      ["fuelSystem.pumpPsi", { fuelSystem: { kind: "injected", pumpPsi: 22 } }],
      ["fuelSystem.boostPsi", { fuelSystem: { kind: "injected", boostPsi: 20 } }],
      ["induction.altAirDeltaC", { induction: { altAirDeltaC: 30 } }],
      ["induction.filterBlockedArea", { induction: { filterBlockedArea: 0.3 } }],
    ],
  },
  { name: "O-360 (float carburetor)", spec: O360, defaults: SHARED, moved: MOVED_SHARED },
];

describe.each(CASES)("$name: absent fields keep today's constants", ({ spec, defaults, moved }) => {
  const absent = run(spec);

  test("the scripted run is the same with every default written out", () => {
    const explicit = run(patched(spec, defaults));
    expect(explicit).toHaveLength(absent.length);
    explicit.forEach((s, i) => expect(s).toStrictEqual(absent[i]));
    // the script is not vacuous: the engine started and reached high power
    expect(Math.max(...absent.map((s) => s.rpm))).toBeGreaterThan(2000);
  });

  test("each moved constant is read from the spec", () => {
    for (const [field, patch] of moved) expect(run(patched(spec, patch)), field).not.toStrictEqual(absent);
  });
});

describe("turbocharged state and failures", () => {
  test("an engine without a turbocharger starts with the neutral turbo state", () => {
    const s = initialState(IO390);
    expect(IO390.turbo).toBeUndefined();
    expect(s.gate).toBe(1);
    expect(s.deckInHg).toBe(s.inletInHg);
    expect(s.reliefOpen).toBe(false);
    expect(s.altAirOpen).toBe(false);
    expect(s.highBoostOn).toBe(false);
    expect(s.turboRpm).toEqual([0, 0]);
    expect(s.tit).toEqual([cToF(s.oatC), cToF(s.oatC)]);
    expect(s.compressorOutC).toBe(s.inletC);
    expect(s.matC).toBe(s.inletC);
    expect(s.turbineInletInHg).toBe(s.map);
    expect([s.bleed, s.pActPsi, s.titOverS, s.oilLossQt]).toEqual([0, 0, 0, 0]);
  });

  test("noFailures has the turbo members only for a spec with a turbocharger", () => {
    const turboKeys = [
      "wastegateSeized",
      "wastegateOil",
      "oilLeak",
      "inductionLeak",
      "intercoolerLeak",
      "exhaustLeak",
      "turboInternal",
      "controllerMisadjust",
      "titProbe",
    ];
    for (const spec of [IO390, O360]) {
      const plain = noFailures(spec);
      for (const k of turboKeys) expect(plain, `${spec.id} ${k}`).not.toHaveProperty(k);
    }

    // shape only: noFailures reads whether `turbo` exists, not its values
    const turbo: TurboSpec = {
      count: 2,
      etaCompressor: 0,
      etaTurbine: 0,
      turbineArea: 0,
      spoolTauS: 0,
      rpmRef: 0,
      prRef: 0,
      wastegate: { pCrackPsi: 0, pFullPsi: 0, tauS: 0, area: 0 },
      controller: { c0: 0, c1: 0, deckRef: 0, kBleed: 0, b0: 0, ratio: 0, misadjustInHg: 0 },
      intercooler: { effectiveness: 0, dpInHgRated: 0, coolRiseC: 0 },
      overboost: { crackInHg: 0, hystInHg: 0, area: 0 },
      leaks: { inductionArea: 0, intercoolerArea: 0, exhaustArea: 0 },
      oil: { bearingHeatK: 0, bleedPsi: 0, leakQtPerMin: 0 },
    };
    expect(noFailures(patched(IO390, { turbo }))).toStrictEqual({
      ...noFailures(IO390),
      wastegateSeized: null,
      wastegateOil: false,
      oilLeak: false,
      inductionLeak: false,
      intercoolerLeak: [false, false],
      exhaustLeak: false,
      turboInternal: [false, false],
      controllerMisadjust: false,
      titProbe: [false, false],
    });
  });
});
