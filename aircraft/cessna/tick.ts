/** Per-frame models shared by the Cessna NAV III airplanes' tick.ts. */

/** Engine-driven vacuum pump through the regulator: 0 stopped, regulated to ~5.0 in.Hg above ~750 RPM (illustrative). */
export const vacuumInHg = (rpm: number, failed: boolean) =>
  failed ? 0 : Math.round(5.0 * Math.max(0, Math.min(1, (rpm - 300) / 450)) * 10) / 10;
