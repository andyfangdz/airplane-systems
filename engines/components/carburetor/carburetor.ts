/**
 * The float carburetor on its own: a Marvel-Schebler MA-4-5 on a running Lycoming O-360-A1D. The engine is the
 * O-360's own simulation (`engines/model/`, calibrated to the OM); this file reads the carburetor's side of it each
 * frame: how the fuel it meters splits between the main nozzle and the idle jet, where the float and its needle sit,
 * the accelerator pump plunger, and the positions of the throttle valve, the mixture metering valve and the heat
 * valve the 3D cutaway draws.
 *
 * Documented numbers carry their source (SOURCES.md): the MA-4-5 overhaul instructions (OI), the O-360 Operator's
 * Manual (OM) and the FAA's AMT Handbook—Powerplant (AMT). Everything else here is a drawing or display constant.
 */
import { carbFuelFlow, mainSystem } from "@/engines/model/carburetor";
import { INHG_PA } from "@/engines/model/atmosphere";
import { ratedAirLbH, type Controls, type EngineState } from "@/engines/model/engine";
import type { Carburetor, EngineSpec } from "@/engines/types";

const OI = "MA-4-5 Overhaul Instructions";
const AMT = "FAA-H-8083-32B";

/** Published facts about the MA-4-5 and float carburetors, each with where it is printed. */
export const MA45 = {
  floatSetting: { value: "13/64 in", src: `${OI} ¶2-27 y and ¶3-2 e (float toes to the throttle body gasket)` },
  floatValveTest: {
    value:
      "0.4 psi for at least 15 min, then 6.0 psi for at least 5 min: no fuel to the parting surface or out of the nozzle",
    src: `${OI} ¶3-2`,
  },
  pumpTube: { value: "A 11/64 in, B 1/4 in", src: `${OI} ¶3-3 a, Figure 3-2 (pump discharge tube location)` },
  pumpTest: {
    value: "close, then fully open the throttle: a solid stream that dies away as the plunger spring reaches its limit",
    src: `${OI} ¶3-3 b`,
  },
  fuelBelowNozzle: { value: "about 1/8 in below the discharge nozzle holes", src: `${AMT} p. 2-10` },
  liftToNozzle: { value: "0.5 inHg", src: `${AMT} p. 2-11 (to raise fuel to the discharge level)` },
  icingRange: { value: "20 to 90 °F outside air, humidity 50 % or more", src: "OM p. 3-8" },
} as const;

/** What the carburetor is doing, read from the running engine. */
export interface CarbReading {
  /** Air through the bore, lb/h. */
  air: number;
  /** Fuel the carburetor meters: from the main nozzle, from the idle jet, lb/h. */
  main: number;
  idle: number;
  /** How far the main metering system is in (0: the idle jet carries the engine … 1: the main nozzle does). */
  mainShare: number;
  /** Fuel-air ratio of the metered charge. */
  far: number;
  /** Float bowl contents (0 … 1 of full) and float drop below its set level (0 … 1, drawing scale). */
  bowl: number;
  floatDrop: number;
  /** Float valve: needle lift (0 seated … 1 fully open) and whether fuel is coming in (pressure at the inlet). */
  needle: number;
  inflow: boolean;
  /** Throttle valve angle from closed, mixture metering valve opening (0 cut-off … 1 rich), heat valve (0 … 1). */
  throttleDeg: number;
  mixture: number;
  heat: number;
  /** Manifold vacuum the idle jet sees: (inlet − manifold) / inlet. */
  vacuum: number;
}

/** Air density at the carburetor inlet, kg/m³. */
const inletRho = (s: EngineState) => (s.inletInHg * INHG_PA) / (287.05 * (s.inletC + 273.15));

/**
 * The float valve's largest flow (lb/h) at an inlet pressure (psi): the bowl refills at this rate when it is low
 * (the engine model's refill, `engines/model/engine.ts`).
 */
const needleCapacity = (carb: Carburetor, psi: number) =>
  0.05 * 3600 * Math.sqrt(Math.max(psi, 0) / carb.inletPsi.desired);

export function readCarb(spec: EngineSpec, s: EngineState, c: Controls): CarbReading {
  if (spec.fuelSystem.kind !== "carburetor") throw new Error(`${spec.id} has no carburetor`);
  const carb = spec.fuelSystem;
  const rated = ratedAirLbH(spec);
  // the model's two circuits for this air; the engine may meter less (an empty bowl), so scale them to what it did
  const flow = carbFuelFlow(spec, carb, s.air, rated, c.mixture, inletRho(s), s.map, s.inletInHg, s.ice);
  const sum = flow.main + flow.idle;
  const k = sum > 1e-6 ? s.fuel / sum : 0;
  const bowl = Math.min(1, Math.max(0, s.bowl / carb.bowlLb));
  const inflow = s.fuelPsi > 0.3;
  // the bowl refills in proportion to how low it is (the engine model's refill), up to what the needle passes
  const refill = inflow ? Math.min((((1 - bowl) * carb.bowlLb) / 0.5) * 3600, needleCapacity(carb, s.fuelPsi)) : 0;
  const open = inflow ? refill / needleCapacity(carb, s.fuelPsi) : 0;
  return {
    air: s.air,
    main: flow.main * k,
    idle: flow.idle * k,
    mainShare: mainSystem(s.air, rated),
    far: s.air > 1 ? s.fuel / s.air : 0,
    bowl,
    floatDrop: 1 - bowl,
    // the float holds the needle as far off its seat as the inflow needs; a dropped float pulls it fully open
    needle: Math.min(1, Math.max(open, 1 - bowl)),
    inflow,
    throttleDeg: Math.max(0, Math.min(1, c.throttle)) * 90,
    mixture: Math.max(0, Math.min(1, c.mixture)),
    heat: Math.max(0, Math.min(1, c.carbHeat)),
    vacuum: s.inletInHg > 0 ? Math.max(0, (s.inletInHg - s.map) / s.inletInHg) : 0,
  };
}

/** The accelerator pump plunger, linked to the throttle through a spring (drawing and display state). */
export interface Pump {
  /** Plunger travel, 0 (up, cylinder full) … 1 (bottomed). */
  plunger: number;
  /** Fuel it is discharging, lb/h. */
  squirt: number;
}

/**
 * Advance the pump by `dt` seconds. Opening the throttle drives the plunger down through its spring, so the stream
 * dies away as the spring reaches its limit (OI ¶3-3 b); closing it lifts the plunger and refills the cylinder through
 * the inlet check valve. A full stroke discharges the carburetor's `accelLb`, the same fuel the engine model adds at
 * once when the throttle opens; here it is spread over the spring's travel for the drawing. The spring's time constant
 * is a display constant, not published.
 */
export function pumpStep(carb: Carburetor, p: Pump, throttle: number, dt: number): Pump {
  if (!(dt > 0)) return p;
  const target = Math.max(0, Math.min(1, throttle));
  const tau = target > p.plunger ? 0.6 : 0.15;
  const plunger = p.plunger + (target - p.plunger) * (1 - Math.exp(-dt / tau));
  const down = Math.max(0, plunger - p.plunger);
  return { plunger, squirt: ((carb.accelLb * down) / dt) * 3600 };
}
