/**
 * G1000 NAV III annunciation window and EIS helpers shared by the Cessna NAV III singles. Each airplane keeps its own
 * annunciation list (Nav3AnnDef[]) with its POH cites in its model.ts.
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

export interface Nav3AnnIn {
  oilPress: boolean; lowFuelL: boolean; lowFuelR: boolean;
  /** Vacuum (in.Hg); undefined = no vacuum system installed. */
  vac?: number;
  lowVolts: boolean; highVolts: boolean; stbyBatt: boolean; co: boolean;
  /** KAP 140 installations only: red PITCH TRIM (needs a "PITCH TRIM" entry in the airplane's own definition list). */
  pitchTrim?: boolean;
}

/**
 * Active annunciations, warnings first, in the POH 7-51 order within each level. `defs` is the airplane's own list
 * (its POH page cites, thresholds and extra items such as the KAP 140 PITCH TRIM).
 */
export function nav3Annunciations(i: Nav3AnnIn, defs: Nav3AnnDef[]): [CasLevel, string][] {
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
