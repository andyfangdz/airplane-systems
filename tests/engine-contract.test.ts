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
 * The golden script's readings recorded on the model before the TSIO-550-K's chart, metering and turbocharger were
 * added (to 7 significant figures): the IO-390 and O-360 must still produce them.
 */
const GOLDEN: Record<string, number[][]> = {
  io390: [
    [1529.065, 18.25655, 396.0931, 34.00759, 46.06726, 823.2593, 62.27284, 59.73809, 95.92075],
    [1623.841, 17.3401, 399.7565, 34.31287, 43.571, 1006.953, 67.91071, 61.24825, 97.7435],
    [1590.358, 17.65467, 398.6938, 34.22431, 39.74821, 1057.214, 73.39752, 62.74989, 96.91801],
    [1580.131, 17.75329, 398.3189, 34.19307, 40.13833, 1092.512, 78.58459, 64.1818, 96.18958],
    [2703.386, 29.26036, 1289.18, 108.4311, 202.7887, 1280.385, 132.1129, 80.34109, 102.3187],
    [2700.046, 29.26233, 1287.296, 108.2741, 204.968, 1317.353, 181.8657, 97.36093, 96.48091],
    [2694.646, 29.26548, 1284.289, 86.41886, 199.0691, 1495.167, 191.6658, 100.5994, 95.18277],
    [2257.048, 29.48808, 1048.052, 53.00231, 116.6561, 1309.292, 191.885, 102.9588, 91.50538],
    [2490.392, 21.26241, 893.9405, 71.6645, 139.6525, 1298.384, 207.9345, 110.607, 91.04608],
    [2527.932, 21.2139, 908.8016, 72.84173, 142.2611, 1293.007, 221.4538, 117.2132, 90.07431],
    [2552.007, 21.18316, 918.0519, 73.57451, 144.2221, 1294.996, 234.0145, 123.7855, 88.87245],
    [2556.529, 21.97685, 957.8497, 70.95181, 152.5664, 1371.969, 238.6337, 125.976, 88.40861],
    [2559.101, 21.9978, 960.0348, 71.11368, 153.1597, 1387.908, 243.1606, 128.1497, 88.00957],
    [2525.937, 2.755381, 66.07377, 5.626294, -21.72864, 1000.003, 240.3669, 129.4138, 87.8402],
    [2556.881, 2.731695, 66.07377, 5.626294, -21.87301, 951.3511, 236.729, 130.6995, 87.52282],
    [2560.632, 2.746572, 63.23723, 5.585164, -21.37094, 913.8272, 233.1053, 131.9786, 87.30284],
    [2559.78, 3.883953, 115.6291, 5.626294, -25.97745, 833.1271, 228.2624, 133.2163, 87.08675],
    [2561.442, 3.88184, 115.6291, 5.626294, -25.87546, 784.4521, 223.514, 134.4388, 86.87593],
    [2530.712, 21.27802, 895.827, 57.408, 87.15556, 1031.635, 224.5295, 136.1884, 86.46634],
    [2556.34, 21.16622, 901.8307, 57.78747, 87.52061, 1077.175, 225.8806, 137.9278, 86.28254],
    [2123.749, 22.83004, 796.501, 0.0, -27.83045, 754.545, 219.9067, 138.612, 44.86939],
    [1890.723, 5.964326, 138.5046, 0.0, -31.21677, 539.524, 214.0727, 139.118, 49.08217],
    [1827.437, 6.137587, 138.5046, 0.0, -29.76288, 396.7957, 208.4182, 139.5098, 45.48772],
  ],
  o360: [
    [1324.227, 15.23671, 271.7499, 23.22637, 28.09933, 861.4417, 62.54194, 59.80901, 93.41842],
    [1361.451, 14.89603, 271.7499, 23.22637, 27.27559, 993.493, 67.49402, 61.03158, 94.42753],
    [1327.482, 15.20001, 271.7499, 23.22637, 24.882, 1034.757, 72.31968, 62.24089, 93.71165],
    [1323.247, 15.23989, 271.7499, 23.22637, 25.04305, 1068.553, 76.88724, 63.39609, 93.19835],
    [2428.118, 28.89674, 981.6739, 83.90332, 154.8832, 1244.15, 127.2195, 77.95976, 100.6791],
    [2440.011, 28.88894, 985.2615, 84.20995, 157.1324, 1277.09, 173.4221, 92.91783, 95.80023],
    [2425.496, 28.89844, 980.8872, 67.06887, 154.2203, 1458.912, 182.9255, 95.78411, 94.59184],
    [2061.858, 29.15543, 852.809, 43.73357, 94.71917, 1301.151, 183.6012, 97.90164, 91.26829],
    [2536.861, 20.04983, 741.3404, 60.23191, 111.0426, 1280.37, 198.9458, 105.2954, 92.88933],
    [2553.36, 20.02642, 744.2549, 60.4687, 112.1308, 1274.318, 212.6437, 112.297, 91.34534],
    [2558.208, 20.0196, 745.1005, 60.53741, 112.9244, 1273.627, 225.0815, 119.0787, 89.87614],
    [2558.264, 21.71911, 815.1109, 60.50782, 127.4641, 1367.95, 230.027, 121.3599, 89.32858],
    [2559.502, 21.71845, 815.3983, 60.52875, 127.7232, 1386.693, 234.8572, 123.6173, 88.88347],
    [2427.602, 2.985284, 61.02359, 8.029139, -30.23808, 679.9947, 231.3882, 125.025, 87.86722],
    [2425.456, 2.983348, 61.02359, 8.029485, -30.19582, 443.1952, 225.6392, 126.2147, 87.64655],
    [2429.298, 2.991025, 58.69169, 8.0922, -32.42146, 292.923, 219.7903, 127.3753, 87.4335],
    [2426.139, 3.839307, 91.53538, 7.874877, -27.31899, 475.5686, 214.4748, 128.551, 87.2241],
    [2430.338, 3.840401, 91.53538, 7.874677, -27.19903, 510.4932, 209.3355, 129.7134, 87.01859],
    [2557.977, 17.94059, 644.5949, 41.47519, 78.76761, 1213.294, 211.4125, 131.5837, 87.37454],
    [2559.007, 17.87213, 641.9919, 41.42715, 78.73907, 1358.853, 213.9527, 133.4703, 87.04691],
    [2561.476, 17.79811, 639.4659, 41.38195, 44.30844, 1295.32, 214.0246, 135.1309, 46.33044],
    [1755.274, 5.602673, 108.2736, 0.0, -26.62826, 883.8956, 208.4197, 135.6328, 48.89821],
    [1749.468, 5.612455, 108.2079, 0.0, -26.49207, 622.8716, 202.9318, 136.0109, 45.4949],
  ],
};

describe.each([IO390, O360])("$name: the golden run is unchanged", (spec) => {
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
