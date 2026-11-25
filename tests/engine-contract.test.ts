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
  sparks,
  startFiringMags,
  step,
  type Controls,
  type EngineState,
  type Environment,
  type Failures,
} from "@/engines/model/engine";
import { cToF } from "@/engines/model/atmosphere";
import { settle, type Hold } from "@/engines/model/trim";
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
  calibration: { slipKt: 55, oilSlipKt: 55, richMisfireLambda: 0.55 },
  oil: { pickupQt: [1.5, 3] },
};

/** Each moved constant on the path every engine runs, set away from its default. */
const MOVED_SHARED: [string, Patch<EngineSpec>][] = [
  ["induction.ramEta", { induction: { ramEta: 0.9 } }],
  ["accessories.starterTorque", { accessories: { starterTorque: 200 } }],
  ["accessories.starterFreeRpm", { accessories: { starterFreeRpm: 300 } }],
  ["calibration.slipKt", { calibration: { slipKt: 70 } }],
  ["calibration.oilSlipKt", { calibration: { oilSlipKt: 30 } }],
  ["calibration.richMisfireLambda", { calibration: { richMisfireLambda: 0.9 } }],
  ["oil.pickupQt", { oil: { pickupQt: [1, 2] } }],
];

const CASES: { name: string; spec: EngineSpec; defaults: Patch<EngineSpec>; moved: [string, Patch<EngineSpec>][] }[] = [
  {
    name: "IO-390 (servo injection)",
    spec: patched(IO390, { fuelSystem: { kind: "injected", boostPsi: undefined } }), // exercise the generic pump fallback
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

describe("START magnetos", () => {
  test("START fires the retard magneto alone without startMags 'both' (IOM System Description p. 2)", () => {
    for (const spec of [IO390, O360]) {
      expect(startFiringMags(spec, "START")).toEqual([spec.ignition.retardMag]);
      expect(sparks(spec, "START", noFailures(spec), 200)).toEqual(spec.geometry.cylinders.map(() => 1));
    }
    expect(startFiringMags(IO390, "OFF")).toEqual([]);
    expect(startFiringMags(IO390, "L")).toEqual(["L"]);
    expect(startFiringMags(IO390, "R")).toEqual(["R"]);
    expect(startFiringMags(IO390, "BOTH")).toEqual(["L", "R"]);
  });
});

/**
 * A longer scripted run that also reaches the throttle and mixture holds (trim.ts), magneto checks, altitude, the
 * failures each engine runs and a shutdown. Each leg's `hold`, if any, is run with `settle`; otherwise with `step`.
 */
interface GoldenLeg extends Omit<Leg, "f"> {
  f?: (f: Failures) => void;
  hold?: Hold;
  thermal?: number;
}
const GOLDEN_SCRIPT: GoldenLeg[] = [
  { s: 4, c: { mags: "START", boost: true, throttle: 0.2, mixture: 1 } },
  { s: 10, c: { mags: "BOTH", boost: false, throttle: 0.25 } },
  { s: 3, c: { mags: "L" } },
  { s: 3, c: { mags: "R" } },
  { s: 10, c: { mags: "BOTH", throttle: 1, prop: 1 }, thermal: 5 },
  { s: 5, c: { mixture: 0.8 } },
  { s: 5, c: { mixture: 0.6 } },
  { s: 15, c: { throttle: 0.7, prop: 0.8, mixture: 0.85 }, env: { altFt: 8000, tasKt: 120 }, thermal: 3 },
  { s: 10, hold: { map: 22, lambda: 0.9 } },
  { s: 10, hold: { rpm: 2000 } },
  { s: 5, c: { altAir: true, carbHeat: 1 }, f: (f) => (f.filter = true) },
  {
    s: 10,
    c: { altAir: false, carbHeat: 0 },
    f: (f) => {
      f.filter = false;
      f.nozzle[0] = 0.5;
      f.plugs[1][0] = true;
      f.intakeLeak[2] = 0.5;
    },
  },
  { s: 10, env: { humidity: 0.9, isaDevC: -10, altFt: 3000, tasKt: 90 }, c: { throttle: 0.45 } },
  { s: 5, env: { oilQt: 2.5 }, f: (f) => ((f.magL = true), (f.fuelPump = true)) },
  { s: 10, c: { mixture: 0, throttle: 0 } },
];

/** Every 5 s of the golden script: rpm, MAP, air and fuel flow, brake hp, mean EGT and CHT, oil temperature and pressure. */
function goldenRun(spec: EngineSpec) {
  const c = defaultControls(),
    env = defaultEnvironment(),
    f = noFailures(spec);
  const s = prime(spec, initialState(spec, env), 2);
  const rows: number[][] = [];
  let n = 0;
  for (const leg of GOLDEN_SCRIPT) {
    Object.assign(c, leg.c);
    Object.assign(env, leg.env);
    leg.f?.(f);
    for (let t = 0; t < leg.s; t += 0.25) {
      if (leg.hold) settle(spec, s, c, env, f, 0.25, leg.hold, leg.thermal ?? 1);
      else step(spec, s, c, env, f, 0.25, leg.thermal ?? 1);
      if (++n % 20 === 0) {
        const mean = (k: "egt" | "cht") => s.cyl.reduce((a, cy) => a + cy[k], 0) / s.cyl.length;
        rows.push([s.rpm, s.map, s.air, s.fuel, s.hp, mean("egt"), mean("cht"), s.oilT, s.oilP]);
      }
    }
  }
  return rows;
}

/**
 * Reference readings (7 significant figures) include the IO-390's cylinder-by-cylinder start and RSA spring
 * head/take-up, and the carburetor's spring-driven, bypassing accelerator pump. This guards numerical reproducibility; the
 * independent IO-390/O-360 handbook tests validate performance. See engines/FUEL-METERING-RESEARCH.md.
 */
const GOLDEN: Record<string, number[][]> = {
  io390: [
    [1529.677, 18.25091, 396.1209, 33.00991, 46.39366, 820.0664, 62.24516, 59.70232, 95.90553],
    [1626.5, 17.31521, 399.832, 33.31916, 43.78514, 1031.201, 68.08721, 61.21674, 97.78825],
    [1592.923, 17.63032, 398.7833, 33.23177, 39.94594, 1086.671, 73.76998, 62.72267, 96.95946],
    [1582.796, 17.72788, 398.4174, 33.20128, 40.34176, 1123.015, 79.14336, 64.15872, 96.22991],
    [2702.722, 29.26073, 1288.823, 107.4014, 203.0202, 1294.246, 133.0411, 80.31549, 102.3328],
    [2699.918, 29.26241, 1287.225, 107.2682, 205.2454, 1327.939, 183.2886, 97.34319, 96.48607],
    [2681.28, 29.27322, 1276.873, 85.12446, 196.1047, 1495.726, 192.8541, 100.5553, 95.1028],
    [2237.473, 29.49512, 1039.638, 51.98164, 113.5877, 1298.114, 192.7466, 102.8797, 91.38657],
    [2489.447, 21.26374, 893.5286, 70.78187, 139.6542, 1306.535, 208.9625, 110.53, 91.04975],
    [2527.684, 21.21421, 908.707, 71.98424, 142.3042, 1304.847, 222.6649, 117.1388, 90.08909],
    [2551.96, 21.18322, 918.0341, 72.7231, 144.277, 1307.365, 235.3897, 123.7142, 88.88631],
    [2556.533, 21.97684, 957.8514, 70.95195, 152.5594, 1374.457, 239.9657, 125.9055, 88.42211],
    [2559.099, 21.9978, 960.034, 71.11363, 153.1525, 1388.378, 244.4487, 128.0801, 88.02255],
    [2523.889, 2.756971, 66.07377, 5.56417, -21.6836, 1011.835, 241.6663, 129.3463, 87.84708],
    [2559.14, 2.732325, 66.07377, 5.56417, -21.83135, 962.8384, 238.0279, 130.6332, 87.53505],
    [2558.721, 2.745673, 63.23723, 5.528745, -21.33332, 924.2444, 234.4054, 131.9133, 87.31426],
    [2558.335, 3.881823, 115.6291, 5.56417, -26.2367, 834.2559, 229.5244, 133.1507, 87.09833],
    [2559.411, 3.884414, 115.6291, 5.56417, -26.09614, 783.1344, 224.7389, 134.3727, 86.887],
    [2530.15, 21.28044, 895.6956, 57.24642, 86.81816, 1029.604, 225.7052, 136.1216, 86.47651],
    [2556.289, 21.16644, 901.8189, 57.63777, 87.19624, 1074.579, 227.0108, 137.8601, 86.29361],
    [2123.784, 22.82992, 796.51, 0, -27.83594, 752.953, 221.0018, 138.5452, 44.87466],
    [1890.606, 5.964635, 138.5046, 0, -31.21806, 538.6579, 215.1341, 139.0518, 49.08699],
    [1827.269, 6.138062, 138.5046, 0, -29.76285, 396.4027, 209.447, 139.444, 45.49186],
  ],
  o360: [
    [1324.214, 15.23684, 271.7499, 23.22637, 28.10163, 862.708, 62.55175, 59.80945, 93.41702],
    [1361.452, 14.89602, 271.7499, 23.22637, 27.27561, 993.736, 67.5037, 61.03202, 94.4274],
    [1327.482, 15.20001, 271.7499, 23.22637, 24.88202, 1034.803, 72.32917, 62.24133, 93.71152],
    [1323.247, 15.23988, 271.7499, 23.22637, 25.04307, 1068.561, 76.89653, 63.39652, 93.19822],
    [2428.061, 28.89678, 981.6566, 83.90185, 154.8731, 1242.542, 126.9057, 77.89663, 100.7019],
    [2439.966, 28.88897, 985.2479, 84.20879, 157.1238, 1276.783, 173.1457, 92.85794, 95.81773],
    [2425.452, 28.89847, 980.8741, 67.06797, 154.2121, 1458.851, 182.6561, 95.72483, 94.60811],
    [2061.811, 29.15546, 852.7926, 43.73273, 94.7127, 1301.136, 183.3382, 97.84288, 91.28216],
    [2536.864, 20.04982, 741.3409, 60.23195, 111.0366, 1280.368, 198.708, 105.2389, 92.90368],
    [2553.36, 20.02642, 744.255, 60.46871, 112.1252, 1274.317, 212.4286, 112.2427, 91.35794],
    [2558.208, 20.0196, 745.1006, 60.53741, 112.9192, 1273.627, 224.887, 119.0264, 89.88722],
    [2558.264, 21.71911, 815.1109, 60.50781, 127.459, 1367.972, 229.8395, 121.3083, 89.33912],
    [2559.502, 21.71845, 815.3983, 60.52875, 127.7182, 1386.697, 234.676, 123.5663, 88.89357],
    [2427.488, 2.98535, 61.02359, 8.029127, -30.24103, 679.997, 231.2128, 124.9745, 87.87649],
    [2425.155, 2.983522, 61.02359, 8.029454, -30.19506, 443.1951, 225.4694, 126.1648, 87.65568],
    [2428.736, 2.991354, 58.69168, 8.092139, -32.41357, 292.9255, 219.626, 127.326, 87.44228],
    [2430.688, 3.840096, 91.53538, 7.874733, -27.30798, 475.5685, 214.3157, 128.5023, 87.23348],
    [2429.191, 3.841375, 91.53538, 7.874499, -27.18568, 510.4939, 209.1816, 129.6653, 87.02701],
    [2558.125, 17.94007, 644.6034, 41.47572, 78.7643, 1212.697, 211.2625, 131.5341, 87.38352],
    [2559.005, 17.87215, 641.9922, 41.42715, 78.73464, 1358.74, 213.8075, 133.4213, 87.05543],
    [2561.476, 17.79812, 639.4663, 41.38196, 44.3041, 1295.281, 213.8839, 135.0824, 46.33485],
    [1755.219, 5.602789, 108.2737, 0, -26.6296, 883.8481, 208.2834, 135.5848, 48.90173],
    [1749.412, 5.612576, 108.2079, 0, -26.49334, 622.8175, 202.7997, 135.9632, 45.49812],
  ],
};

describe.each([IO390, O360])("$name: the reviewed fuel-metering reference run", (spec) => {
  test("every reading matches the recorded run to 1 part in a million", () => {
    const rows = goldenRun(spec);
    const golden = GOLDEN[spec.id];
    expect(rows).toHaveLength(golden.length);
    rows.forEach((row, i) =>
      row.forEach((v, j) =>
        expect(Math.abs(v - golden[i][j]), `row ${i} column ${j}: ${v} vs ${golden[i][j]}`).toBeLessThanOrEqual(
          1e-6 * Math.max(1, Math.abs(golden[i][j])),
        ),
      ),
    );
  });
});
