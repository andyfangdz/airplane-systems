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
 * Reference readings after the fuel-metering research corrections (7 significant figures): RSA spring head/take-up
 * and the carburetor's spring-driven, bypassing accelerator pump. This guards numerical reproducibility; the
 * independent IO-390/O-360 handbook tests validate performance. See engines/FUEL-METERING-RESEARCH.md.
 */
const GOLDEN: Record<string, number[][]> = {
  io390: [
    [1531.646, 18.23152, 396.2162, 33.01785, 46.3481, 851.8199, 62.40109, 59.74325, 95.95105],
    [1626.531, 17.31492, 399.8328, 33.31923, 43.78749, 1037.216, 68.24011, 61.2576, 97.77408],
    [1592.953, 17.63003, 398.7843, 33.23185, 39.94825, 1087.807, 73.91966, 62.76322, 96.94584],
    [1582.825, 17.7276, 398.4185, 33.20137, 40.34402, 1123.229, 79.28992, 64.19896, 96.21682],
    [2702.705, 29.26074, 1288.814, 107.4006, 203.0246, 1294.288, 133.1704, 80.3536, 102.3181],
    [2699.915, 29.26241, 1287.224, 107.2681, 205.2501, 1327.947, 183.4021, 97.37894, 96.4753],
    [2681.311, 29.2732, 1276.891, 85.12561, 196.1115, 1495.73, 192.9647, 100.5907, 95.09309],
    [2237.501, 29.49511, 1039.651, 51.98226, 113.5921, 1298.117, 192.8546, 102.9147, 91.3784],
    [2489.437, 21.26376, 893.5246, 70.78155, 139.6574, 1306.535, 209.0601, 110.5637, 91.04191],
    [2527.682, 21.21421, 908.7062, 71.98418, 142.3075, 1304.847, 222.7531, 117.1712, 90.08209],
    [2551.96, 21.18322, 918.034, 72.72309, 144.2802, 1307.365, 235.4695, 123.7455, 88.88009],
    [2556.533, 21.97684, 957.8513, 70.95195, 152.5625, 1374.457, 240.0429, 125.9365, 88.41617],
    [2559.099, 21.9978, 960.034, 71.11363, 153.1556, 1388.378, 244.5233, 128.1106, 88.01685],
    [2523.936, 2.756934, 66.07377, 5.56417, -21.68098, 1011.837, 241.7385, 129.3766, 87.84174],
    [2559.109, 2.732349, 66.07377, 5.56417, -21.82812, 962.8388, 238.0978, 130.663, 87.5296],
    [2558.751, 2.745651, 63.23723, 5.528745, -21.33065, 924.2445, 234.4731, 131.9428, 87.309],
    [2558.532, 3.881573, 115.6291, 5.56417, -26.23574, 834.2586, 229.5899, 133.1799, 87.09314],
    [2559.761, 3.883968, 115.6291, 5.56417, -26.09706, 783.1394, 224.8023, 134.4016, 86.88215],
    [2530.209, 21.28019, 895.7093, 57.24729, 86.82122, 1029.605, 225.7666, 136.1501, 86.4718],
    [2556.292, 21.16643, 901.8197, 57.63783, 87.19894, 1074.579, 227.0702, 137.8882, 86.28898],
    [2123.83, 22.82976, 796.5219, 0, -27.83492, 752.9631, 221.0593, 138.5731, 44.87265],
    [1890.669, 5.964467, 138.5046, 0, -31.21785, 538.6743, 215.1898, 139.0795, 49.08503],
    [1827.344, 6.137851, 138.5046, 0, -29.76297, 396.4228, 209.501, 139.4715, 45.49014],
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
