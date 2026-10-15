/** ICAO standard atmosphere below the tropopause, and the unit conversions the engine model uses. */

export const INHG_PA = 3386.389;
export const PSI_PA = 6894.757;
export const HP_W = 745.6999;
export const LB_KG = 0.45359237;
export const IN_M = 0.0254;
export const KT_MS = 0.514444;
/** Avgas density used by Lycoming's tables (Table A-1: 12.8 gph ⇔ 76.8 lb/h). */
export const AVGAS_LB_GAL = 6;
export const R_AIR = 287.05;
export const GAMMA = 1.4;

export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToK = (f: number) => fToC(f) + 273.15;

export interface Air {
  /** Static pressure, inHg. */
  p: number;
  /** Outside air temperature, °C. */
  t: number;
  /** Standard temperature at this pressure altitude, °C. */
  ts: number;
  /** Density, kg/m³, and ratio to sea-level standard. */
  rho: number;
  sigma: number;
}

export const RHO0 = 1.225;

/** Pressure altitude (ft) and the ISA deviation (°C) give the air the engine breathes. */
export function atmosphere(altFt: number, isaDevC = 0): Air {
  const h = altFt * 0.3048;
  const ts = 15 - 0.0065 * h;
  const p = 29.92126 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
  const t = ts + isaDevC;
  const rho = (p * INHG_PA) / (R_AIR * (t + 273.15));
  return { p, t, ts, rho, sigma: rho / RHO0 };
}

/** Density ratio at a pressure altitude on a standard day: the abscissa of Lycoming's altitude charts. */
export const sigmaStd = (altFt: number) => atmosphere(altFt).sigma;

/** Total pressure recovered by a forward-facing inlet (inHg), with a fraction `eta` of the ideal ram rise. */
export function ramPressure(p: number, tC: number, tasKt: number, eta = 0.7) {
  const a = Math.sqrt(GAMMA * R_AIR * (tC + 273.15));
  const m = (tasKt * KT_MS) / a;
  const ideal = p * Math.pow(1 + ((GAMMA - 1) / 2) * m * m, GAMMA / (GAMMA - 1));
  return p + eta * (ideal - p);
}
