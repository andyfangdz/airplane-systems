/** AFMS 190-00492-10 §2.5: red below 14 or above 35 psi; green includes both limits. */
export const FUEL_PRESSURE = { low: 14, high: 35 } as const;
export const fuelPressureState = (pressure: number): "low" | "normal" | "high" =>
  pressure < FUEL_PRESSURE.low ? "low" : pressure > FUEL_PRESSURE.high ? "high" : "normal";
