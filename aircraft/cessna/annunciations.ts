/**
 * G1000 NAV III annunciation window and EIS helpers shared by the Cessna NAV III singles.
 *
 * "All system alerts, cautions and warnings are shown on the right side of the PFD screen adjacent to the
 * vertical speed indicator. The following annunciations are supported: OIL PRESSURE, LOW VACUUM (if
 * installed), LOW FUEL L, LOW FUEL R, LOW VOLTS, HIGH VOLTS, STBY BATT, CO LVL HIGH" (172S POH 7-51;
 * 182T POH says the same). Levels and tones: G1000 Cessna NAV III CRG 190-00384-13 pp. 115–116.
 * PITCH TRIM (red, no tone) is KAP 140 installations only (CRG 115) and is drawn by `kap140Pfd()`.
 */
import type { CasLevel } from "../types";
import type { Gauge } from "@/lib/avionics/g1000";
import { amp, mBattAlert, sBattAlert, voltsAlert, type Nav3Solution } from "./electrical";

export interface Nav3AnnDef { text: string; level: CasLevel; tone: string; trigger: string; cite: string }

/** The annunciation set with exact text, level, aural and trigger. */
export const NAV3_ANN: Nav3AnnDef[] = [
  { text: "OIL PRESSURE", level: "w", tone: "Continuous", trigger: "Low oil pressure switch: 0–20 PSI (shown with the engine stopped)", cite: "POH 7-33" },
  { text: "LOW VOLTS", level: "w", tone: "Continuous (inhibited on the ground)", trigger: "ACU: main bus voltage in the power distribution module below 24.5 V", cite: "POH 7-55" },
  { text: "HIGH VOLTS", level: "w", tone: "Continuous", trigger: "Main or essential bus above 32.0 V (ACU automatic shutdown not working)", cite: "POH 7-56" },
  { text: "CO LVL HIGH", level: "w", tone: "Continuous until the WARNING softkey", trigger: "CO ≥ 50 PPM; flashes until acknowledged, steady until below 50 PPM", cite: "POH 7-80" },
  { text: "LOW FUEL L", level: "c", tone: "Single", trigger: "Left tank < 5 gal indicated for more than 60 s", cite: "POH 7-40" },
  { text: "LOW FUEL R", level: "c", tone: "Single", trigger: "Right tank < 5 gal indicated for more than 60 s", cite: "POH 7-40" },
  { text: "LOW VACUUM", level: "c", tone: "Single", trigger: "Engine-driven pump vacuum below 3.5 in.Hg (shown with the engine stopped)", cite: "POH 7-65" },
  { text: "STBY BATT", level: "c", tone: "Single", trigger: "Standby battery discharging more than 0.5 A for more than 10 s", cite: "POH 7-54" },
];

export interface Nav3AnnIn {
  oilPress: boolean; lowFuelL: boolean; lowFuelR: boolean;
  /** Vacuum (in.Hg); undefined = no vacuum system installed. */
  vac?: number;
  lowVolts: boolean; highVolts: boolean; stbyBatt: boolean; co: boolean;
  /** KAP 140 installations only: red PITCH TRIM (needs a "PITCH TRIM" entry in the airplane's own definition list). */
  pitchTrim?: boolean;
}

/**
 * Active annunciations, warnings first, in the POH 7-51 order within each level. `defs` lets an airplane pass its own
 * list (its POH page cites, thresholds and extra items such as the KAP 140 PITCH TRIM); it defaults to the 172S set.
 */
export function nav3Annunciations(i: Nav3AnnIn, defs: Nav3AnnDef[] = NAV3_ANN): [CasLevel, string][] {
  const on: Record<string, boolean> = {
    "OIL PRESSURE": i.oilPress, "LOW VOLTS": i.lowVolts, "HIGH VOLTS": i.highVolts, "CO LVL HIGH": i.co,
    "LOW FUEL L": i.lowFuelL, "LOW FUEL R": i.lowFuelR, "LOW VACUUM": i.vac != null && i.vac < 3.5, "STBY BATT": i.stbyBatt,
    "PITCH TRIM": !!i.pitchTrim,
  };
  return defs.filter((a) => on[a.text]).map((a) => [a.level, a.text]);
}

/** EIS "ELECTRICAL" block: M BUS / E BUS volts and M BATT / S BATT amps with the POH 7-53/7-54 colours. */
export function nav3ElecGauges(E: Pick<Nav3Solution, "mBus" | "eBus" | "mBatt" | "sBatt">): Gauge[] {
  const va = [voltsAlert(E.mBus), voltsAlert(E.eBus)].find(Boolean) ?? null;
  const aa = mBattAlert(E.mBatt) ?? sBattAlert(E.sBatt);
  return [
    { key: "elec", label: "ELECTRICAL", style: "head", min: 0, max: 1, value: 0 },
    { key: "volts", label: "M BUS V  E BUS V", style: "text", min: 0, max: 40, value: E.mBus, value2: E.eBus, fmt: (v) => v.toFixed(1), alert: va },
    { key: "amps", label: "M BATT A  S BATT A", style: "text", min: -60, max: 60, value: E.mBatt, value2: E.sBatt, fmt: amp, alert: aa },
  ];
}

/** Engine-driven vacuum pump through the regulator: 0 stopped, regulated to ~5.0 in.Hg above ~750 RPM (illustrative). */
export const vacuumInHg = (rpm: number, failed: boolean) => (failed ? 0 : Math.round(5.0 * Math.max(0, Math.min(1, (rpm - 300) / 450)) * 10) / 10);
