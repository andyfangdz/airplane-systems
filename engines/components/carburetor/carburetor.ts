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
import { prime, ratedAirLbH, type Controls, type EngineState } from "@/engines/model/engine";
import type { Carburetor, EngineSpec } from "@/engines/types";
export { pumpStep, type Pump } from "@/engines/model/accelerator-pump";

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
  primer: {
    value: "provision for a primer system on all engines with a carburetor; fuel-injected engines need none",
    src: "OM p. 1-3",
  },
  priming: { value: "1 to 3 strokes of the manual priming pump", src: "OM p. 3-1 (starting, float carburetor)" },
  primerUse: {
    value:
      "draws fuel from the tanks and vaporizes it directly into the cylinders before starting; lock it when not in use, or it can vibrate out and richen the mixture",
    src: "FAA-H-8083-25B p. 7-25",
  },
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
  const flow = carbFuelFlow(spec, carb, s.meteredAir, rated, c.mixture, inletRho(s), s.map, s.inletInHg, s.ice);
  const sum = flow.main + flow.idle;
  const k = sum > 1e-6 ? s.fuel / sum : 0;
  const bowl = Math.min(1, Math.max(0, s.bowl / carb.bowlLb));
  const inflow = s.fuelPsi > 0.3;
  // the bowl refills in proportion to how low it is (the engine model's refill), up to what the needle passes
  const refill = inflow ? Math.min((((1 - bowl) * carb.bowlLb) / 0.5) * 3600, needleCapacity(carb, s.fuelPsi)) : 0;
  const open = inflow ? refill / needleCapacity(carb, s.fuelPsi) : 0;
  return {
    air: s.meteredAir,
    main: flow.main * k,
    idle: flow.idle * k,
    mainShare: mainSystem(s.meteredAir, rated),
    far: s.meteredAir > 1 ? s.fuel / s.meteredAir : 0,
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

/**
 * The manual primer: a plunger in a barrel on the panel. Pulling the knob out draws fuel into the barrel from the
 * fuel line; pushing it in sends that fuel down the primer lines to the cylinders (FAA-H-8083-25B p. 7-25), and the
 * knob is locked in. Strokes asked for while one is under way follow it. The stroke's timing is a display constant.
 */
export interface Primer {
  /** Seconds into the current stroke (< 0: none under way). */
  t: number;
  /** Strokes still to make after this one. */
  queued: number;
  /** Knob travel, 0 (in, locked) … 1 (pulled out). */
  knob: number;
  /** The plunger is pushing fuel to the cylinders. */
  discharging: boolean;
}

export const PRIMER_IDLE: Primer = { t: -1, queued: 0, knob: 0, discharging: false };

/** Pull out, hold, push in, seconds (display). */
const STROKE = { out: 0.5, hold: 0.25, push: 0.9 } as const;
const STROKE_S = STROKE.out + STROKE.hold + STROKE.push;

/** Ask for one more stroke. */
export const primerStroke = (p: Primer): Primer => (p.t < 0 ? { ...p, t: 0 } : { ...p, queued: p.queued + 1 });

/**
 * Advance the primer by `dt` seconds. `fire` is true on the frame the plunger starts pushing, when the stroke's fuel
 * goes to the cylinders (the engine model's `prime`).
 */
export function primerStep(p: Primer, dt: number): { primer: Primer; fire: boolean } {
  if (p.t < 0 || !(dt > 0)) return { primer: p, fire: false };
  const pushAt = STROKE.out + STROKE.hold;
  let t = p.t + dt,
    queued = p.queued;
  const fire = p.t < pushAt && t >= pushAt;
  if (t >= STROKE_S) {
    t = queued > 0 ? 0 : -1;
    queued = Math.max(0, queued - 1);
  }
  const knob =
    t < 0 ? 0 : t < STROKE.out ? t / STROKE.out : t < pushAt ? 1 : Math.max(0, 1 - (t - pushAt) / STROKE.push);
  return { primer: { t, queued, knob, discharging: t >= pushAt }, fire };
}

/** Advance the primer and, as each stroke's plunger starts in, put its fuel into the engine's cylinders. */
export function runPrimer(spec: EngineSpec, s: EngineState, p: Primer, dt: number): Primer {
  const r = primerStep(p, dt);
  if (r.fire) prime(spec, s);
  return r.primer;
}
