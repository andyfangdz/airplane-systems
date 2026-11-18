import type { EngineSpec, SeaLevelLine } from "../types";
import { IO390 } from "../io390/spec";
import { RSA5_NOZZLE } from "../model/rsa-nozzle";

const limit = (value: number, unit: string, src: string) => ({ value, unit, src });
export const line = (rpm: number, hp20: number, hp28: number, ftMap: number, hp20k: number): SeaLevelLine => ({
  rpm,
  a: [20, hp20],
  b: [28, hp28],
  ftMap,
  hp20k,
});
export const flows = (rows: [number, number][]) => rows.map(([rpm, base]) => ({ rpm, base }));
export const common = {
  geometry: {
    cylinders: IO390.geometry.cylinders,
    firingOrder: [1, 3, 2, 4],
    boreIn: 5.125,
    strokeIn: 4.375,
    displacementIn3: 361,
    compressionRatio: 8.5,
    rodIn: 6.75,
    valves: IO390.geometry.valves,
    pendulumCounterweights: false,
  },
  ignition: {
    advanceBTC: 25,
    retardMag: "L",
    startMags: "both",
    startRetardATC: 0,
    minStartRpm: 50,
    topPlugMag: { 1: "R", 2: "L", 3: "R", 4: "L" },
  },
  fuelSystem: {
    kind: "injected",
    unit: "RSA-5AD1",
    // The flow-versus-pressure plot in 390 IOM Fig. C-2 explicitly identifies the RSA-5AD1.
    nozzle: RSA5_NOZZLE,
  },
  oil: { thermostatF: 180, thermostatAssumed: true, pistonCoolingJets: false },
  calibration: IO390.calibration,
} satisfies Pick<EngineSpec, "ignition" | "oil" | "calibration" | "fuelSystem"> & {
  geometry: Omit<EngineSpec["geometry"], "envelopeIn">;
};

export function limits(isCessna: boolean, handbook: string, manual: string): EngineSpec["limits"] {
  const airframe = isCessna ? handbook + " 2-6, 2-8" : handbook + " 2-5";
  const runup = isCessna ? handbook + " 4-16" : handbook + " 4A, before take-off";
  const cruise = isCessna ? manual + " 3-14" : manual + " p. 18";
  const rpm = isCessna ? 1800 : 2000;
  return {
    rpmMax: limit(2700, "rpm", isCessna ? airframe : "DA40 AFMS SA06-52 pp. 2–3"),
    idleRpm: isCessna
      ? { min: 600, max: 600, src: handbook + " 4-29, approximate warm idle" }
      : { min: 600, max: 800, src: handbook + " 4A-19" },
    oilPressMinIdle: limit(isCessna ? 20 : 25, "psi", airframe),
    oilPressNormal: { min: isCessna ? 50 : 55, max: isCessna ? 90 : 95, unit: "psi", src: airframe },
    oilPressMaxStart: { ...limit(isCessna ? 115 : 98, "psi", airframe), allPhases: true },
    oilTempMax: limit(245, "°F", airframe),
    oilTempBest: isCessna
      ? { ...limit(160, "°F", manual + " 3-11"), max: 180, ambientDependent: true }
      : { ...limit(165, "°F", manual + " p. 18"), max: 200 },
    chtMax: limit(500, "°F", airframe),
    chtBestAbove75: limit(
      400,
      "°F",
      isCessna ? manual + " 3-14, continuous operation" : manual + " p. 18, continuous operation",
    ),
    chtBestAt75: limit(400, "°F", cruise),
    magDropMax: limit(isCessna ? 150 : 175, "rpm", runup),
    magDiffMax: limit(50, "rpm", runup),
    magCheckRpm: { min: rpm, max: rpm, src: runup },
    oilSumpQt: limit(8, "qt", isCessna ? handbook + " 8-14" : airframe),
    oilMinQt: limit(isCessna ? 5 : 4, "qt", isCessna ? handbook + " 8-14" : airframe),
  };
}

export const drawingNote =
  "The exploded view follows the moving crank, rods, pistons, parallel-valve cylinders and accessories. The parts catalogs establish the assemblies. Casting contours, hardware spacing, hose bends and separation distances are schematic.";
export const physicsNote =
  "Throttle, air density and mixture set cylinder work and fuel flow. The pressure trace, valve timing, cooling, friction, and propeller aerodynamic coefficients are illustrative.";
