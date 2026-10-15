/**
 * A float carburetor (Marvel-Schebler MA-4-5 type): the venturi meters fuel, an idle circuit feeds the engine with the
 * throttle nearly closed, an accelerator pump squirts fuel when the throttle opens, and the mixture chamber runs cold
 * enough to ice in moist air.
 *
 * Main metering: the venturi depression is ∝ ṁ²/ρ and the main jet's flow ∝ √depression, so fuel tracks air mass
 * × √(ρ_ref / ρ), like the servo injector (fuel.ts): richer as the air thins or is heated. The mixture control scales
 * the jet; idle cut-off stops all fuel (OM p. 1-2). The main nozzle only flows once the venturi pulls hard enough;
 * below that the idle circuit, fed by manifold vacuum at the throttle edge, carries the engine.
 *
 * Icing (OM pp. 3-8–3-9): fuel evaporation and the pressure drop past the venturi and throttle cool the mixture, up to
 * 70 °F below the incoming air; once that is below freezing, water the cooled air can no longer hold freezes near the
 * butterfly. Ice narrows the throttle bore: with a constant-speed propeller the sign is a fall in manifold pressure.
 * Heat melts it. The shapes are physics; the constants (how much sticks, how much blocks the bore) are illustrative.
 */
import type { Carburetor, EngineSpec } from "../types";
import { RHO0 } from "./atmosphere";
import { AFR_STOICH } from "./mixture";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Fraction of the main jet's flow at an air flow (lb/h): the main nozzle starts once the venturi pulls enough. */
export const mainSystem = (airLbH: number, ratedAirLbH: number) => clamp((airLbH / ratedAirLbH - 0.03) / 0.12, 0, 1);

/**
 * Fuel the carburetor meters (lb/h): main jet plus idle circuit, for the air through its venturi (lb/h), mixture
 * position 0 (idle cut-off) … 1 (full rich), inlet density (kg/m³), manifold and source pressure (inHg), and the
 * fraction of the bore ice blocks (which raises the venturi's pull for the same air, so richens).
 */
export function carbFuelFlow(
  spec: EngineSpec,
  carb: Carburetor,
  airLbH: number,
  ratedAirLbH: number,
  mixture: number,
  inletRho: number,
  map: number,
  source: number,
  ice: number,
) {
  if (mixture <= 0.02) return { main: 0, idle: 0 };
  const valve = Math.min(1, mixture);
  const on = mainSystem(airLbH, ratedAirLbH);
  const far = 1 / (AFR_STOICH * spec.calibration.lambdaFullRich);
  const main = airLbH * far * valve * Math.sqrt(RHO0 / Math.max(inletRho, 0.2)) * (1 + 0.5 * ice) * on;
  const vacuum = clamp((source - map) / source, 0, 1);
  const idle = carb.idleLbH * valve * Math.sqrt(vacuum) * (1 - on);
  return { main, idle };
}

/**
 * Mixture-chamber temperature (°C): the inlet air less the cooling from fuel evaporation (about three quarters of the
 * fuel flashes off in the carburetor, latent heat ~350 kJ/kg) and from the expansion past the throttle (half of the
 * ideal adiabatic drop, the rest recovered), limited to the manual's 70 °F.
 */
export function mixtureChamberC(carb: Carburetor, inletC: number, far: number, map: number, source: number) {
  const evap = (0.75 * 349 * far) / 1.005;
  const expand = 0.5 * (inletC + 273.15) * (1 - Math.pow(clamp(map / source, 0.05, 1), 0.2857));
  return inletC - Math.min(evap + expand, carb.maxDropF / 1.8);
}

/** Saturation vapour pressure over water (kPa), Magnus formula. */
export const saturationKPa = (tC: number) => 0.61094 * Math.exp((17.625 * tC) / (tC + 243.04));

/** Water vapour per unit of dry air (kg/kg) at a pressure (kPa) and partial vapour pressure (kPa). */
const mixingRatio = (pKPa: number, eKPa: number) => (0.622 * eKPa) / Math.max(pKPa - eKPa, 1);

/**
 * Water (kg per kg of air) the air brings in at outside temperature and relative humidity that it can no longer hold
 * in the mixture chamber, at its temperature and manifold pressure.
 */
export function condensedWater(oatC: number, humidity: number, ambientKPa: number, chamberC: number, mapKPa: number) {
  const win = mixingRatio(ambientKPa, clamp(humidity, 0, 1) * saturationKPa(oatC));
  const wsat = mixingRatio(mapKPa, saturationKPa(chamberC));
  return Math.max(0, win - wsat);
}

/**
 * Rate the ice fraction changes (per second): freezing water builds it while the chamber is below 0 °C; warm inlet
 * air (carburetor heat) or a chamber above freezing melts it. Below about 20 °F outside (−7 °C) the air's moisture is already ice crystals that don't stick (OM p. 3-8:
 * icing from 20 to 90 °F).
 */
export function iceRate(
  carb: Carburetor,
  airKgS: number,
  condensed: number,
  chamberC: number,
  inletC: number,
  oatC: number,
) {
  const sticks = clamp(-chamberC / 2, 0, 1) * clamp((oatC + 7) / 3, 0, 1);
  const build = (airKgS * condensed * carb.iceCapture * sticks) / carb.iceKg;
  // the ice sits where the incoming air meets it, so hot inlet air melts it even while the fuel still cools the charge
  const warmth = Math.max(chamberC, inletC - 20, 0);
  return build - warmth / 15 / 40;
}
