/** Helpers for building EIS strip items (`Gauge`s): colour bands, the alert they imply, and readout formats. */
import type { Gauge } from "./types";

/** A colour band [from, to, colour]. */
export type GaugeBand = NonNullable<Gauge["bands"]>[number];

/** The alert a value's band implies: red is a warning, yellow a caution; null for an invalid value or no band. */
export const bandAlert = (v: number | null, bands: GaugeBand[]): Gauge["alert"] => {
  if (v == null) return null;
  for (const [a, b, c] of bands)
    if (v >= a && v <= b) return c === "red" ? "warning" : c === "yellow" ? "caution" : null;
  return null;
};

/** An EIS item whose alert follows its bands. */
export const gauge = (
  key: string,
  label: string,
  style: Gauge["style"],
  min: number,
  max: number,
  bands: GaugeBand[],
  value: number | null,
  fmt: (n: number) => string,
): Gauge => ({ key, label, style, min, max, bands, value, fmt, alert: bandAlert(value, bands) });

/** Readout formats: whole numbers, one decimal, signed whole numbers. */
export const f0 = (v: number) => String(Math.round(v)),
  f1 = (v: number) => v.toFixed(1),
  sgn = (v: number) => (v > 0 ? "+" : "") + Math.round(v);
