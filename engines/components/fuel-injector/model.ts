/**
 * The RSA fuel injection system's insides, read off the engine simulation each frame (engines/model/fuel.ts meters
 * the fuel; this file only says what each part of the injector, flow divider and nozzles is doing while it does).
 *
 * How the parts work is from the FAA Aviation Maintenance Technician Handbook – Powerplant (FAA-H-8083-32B),
 * Chapter 2, "Bendix/Precision Fuel-Injection System", pp. 2-21 to 2-24:
 * - Airflow section: impact tubes sense inlet air pressure and the venturi throat senses venturi suction; the two
 *   act on opposite sides of the air diaphragm. Their difference times the diaphragm's area is the "air metering
 *   force", and it rises with the air flow (as its square: the venturi is an orifice).
 * - Regulator section: the fuel diaphragm sees fuel inlet (unmetered) pressure on one side and metered pressure on
 *   the other, the "fuel metering force". The ball valve on the fuel diaphragm opens until the two forces balance,
 *   so the pressure drop across the metering jet, and with it the fuel flow, follows the air flow. At low power a
 *   constant-head idle spring adds a small, fixed differential.
 * - Fuel metering section: inlet strainer, manual mixture control (a rotary plate), idle valve linked to the
 *   throttle, main metering jet.
 * - Flow divider: keeps the metered fuel under pressure, divides it at idle, opens fully once the flow rises, and
 *   shuts every nozzle line at idle cut-off. A gauge on it reads nozzle pressure, calibrated as fuel flow.
 * - Nozzles: one per cylinder, air-bleed type, a calibrated jet discharging into the intake port.
 *
 * Nothing here is a published pressure: the forces are given relative to rated air flow at sea level, and the valve
 * openings are drawn, not measured. The flows and the nozzle pressure are the engine model's (IOM Figure C-2).
 */
import type { Controls, EngineState, Failures } from "@/engines/model/engine";
import { ratedAirLbH } from "@/engines/model/engine";
import { RHO0, INHG_PA } from "@/engines/model/atmosphere";
import { distribution, IDLE_SPRING_LBH, nozzleFlow } from "@/engines/model/fuel";
import { AFR_STOICH } from "@/engines/model/mixture";
import type { EngineSpec } from "@/engines/types";

/**
 * IOM Figure C-2 (p. 58) also prints the high and low limits around the nominal curve; read from the figure's image
 * against its grid at whole and half psi (about ±0.3 lb/h). The nominal curve is the engine spec's.
 */
export const NOZZLE_LIMITS = {
  src: "IOM Figure C-2 (C-12855B), p. 58",
  high: [
    [0, 0],
    [0.5, 24.2],
    [1, 36.2],
    [1.5, 44.0],
    [2, 51.3],
    [2.5, 57.5],
    [3, 63.1],
    [3.5, 68.1],
    [4, 73.0],
    [5, 82.2],
    [6, 90.1],
    [7, 97.2],
    [8, 103.6],
    [9, 109.6],
    [10, 115.0],
    [11, 120.0],
  ] as [number, number][],
  low: [
    [0, 0],
    [0.5, 19.9],
    [1, 31.9],
    [1.5, 40.5],
    [2, 47.2],
    [2.5, 53.2],
    [3, 58.3],
    [3.5, 63.2],
    [4, 67.7],
    [5, 76.5],
    [6, 84.2],
    [7, 91.4],
    [8, 97.9],
    [9, 103.9],
    [10, 109.3],
    [11, 114.4],
    [11.5, 117.0],
  ] as [number, number][],
};

/** Flow (lb/h) above which the flow divider valve is drawn fully open: the handbook says only "above idle". */
export const DIVIDER_FULL_LBH = 25;

export interface InjectorView {
  /** Air metering force (impact minus venturi suction), relative to rated air flow at sea level (1). */
  airForce: number;
  /** Fuel metering force across the main jet: the air force it balances, plus the constant-head idle spring. */
  fuelForce: number;
  /** The constant-head idle spring's share of the fuel metering force. */
  springForce: number;
  /** Ball valve opening, 0 shut … 1 at rated flow. */
  ball: number;
  /** Mixture rotary plate, 0 idle cut-off … 1 full rich. */
  mixture: number;
  /** Idle valve opening (follows the throttle), 0 … 1. */
  idleValve: number;
  /** Throttle valve angle from closed, degrees. */
  throttleDeg: number;
  /** Idle cut-off: no metered fuel, the flow divider shut. */
  cutoff: boolean;
  /** Flow divider valve lift, 0 shut … 1 fully open. */
  divider: number;
  /** Fuel from each nozzle (lb/h), by cylinder index. */
  nozzles: number[];
  /** Metered fuel (lb/h), and what the nozzle-pressure gauge shows: the nominal flow for the pressure it reads. */
  metered: number;
  indicated: number;
  /** Nozzle pressure (psig) and the pressure at the injector inlet (psi). */
  nozzlePsi: number;
  inletPsi: number;
  /** Air through the throttle body, lb/h, and the overall fuel–air ratio. */
  air: number;
  far: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** What every part of the system is doing for an engine state, its controls and failures. */
export function injectorView(spec: EngineSpec, s: EngineState, c: Controls, f: Failures): InjectorView {
  const rated = ratedAirLbH(spec);
  const rho = (s.inletInHg * INHG_PA) / (287.05 * (s.inletC + 273.15));
  // the venturi's pressure drop goes as the square of the air flow over the density (Bernoulli)
  const airForce = (s.air / rated) ** 2 * (RHO0 / Math.max(rho, 0.2));
  const ratedFuel = rated / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const springForce = s.fuel > 0 ? (IDLE_SPRING_LBH / ratedFuel) ** 2 : 0;
  const cutoff = c.mixture <= 0.02;
  const metered = s.fuel;
  const { share } = distribution(spec, f.nozzle);
  return {
    airForce,
    fuelForce: metered > 0 ? airForce + springForce : 0,
    springForce,
    ball: clamp01(metered / ratedFuel),
    mixture: clamp01(c.mixture),
    idleValve: clamp01(0.08 + 0.92 * c.throttle),
    throttleDeg: 8 + 77 * clamp01(c.throttle),
    cutoff,
    divider: metered > 0.05 ? clamp01(0.15 + (0.85 * metered) / DIVIDER_FULL_LBH) : 0,
    nozzles: share.map((x) => metered * x),
    metered,
    indicated: nozzleFlow(spec, s.nozzlePsi),
    nozzlePsi: s.nozzlePsi,
    inletPsi: s.fuelPsi,
    air: s.air,
    far: s.air > 1 ? metered / s.air : 0,
  };
}

/** A chart curve at x (linear between points, extended along the last segment). */
export function curveAt(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++)
    if (x <= points[i][0])
      return (
        points[i - 1][1] +
        ((points[i][1] - points[i - 1][1]) * (x - points[i - 1][0])) / (points[i][0] - points[i - 1][0])
      );
  const [a, b] = [points[points.length - 2], points[points.length - 1]];
  return b[1] + ((b[1] - a[1]) * (x - b[0])) / (b[0] - a[0]);
}
