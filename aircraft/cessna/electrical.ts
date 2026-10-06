/**
 * Cessna NAV III (G1000) electrical system — shared by the 172S and 182T (POH §7 "Electrical System",
 * Figure 7-7 Sheets 1–3 in both handbooks). Pure: `solveNav3(state, cfg, loads, rpm)` → bus voltages,
 * ammeters, powered breakers and the electrical annunciation triggers.
 *
 * Topology (Fig 7-7):
 *   Main battery ─ Battery Relay (MASTER BAT) ─┬─ Starter Relay ─ Starter
 *                                              └─ Current shunt (M BATT) ─ main node
 *   Alternator ─ ACU (field via MASTER ALT + ALT FIELD breaker on the CROSSFEED BUS) ─ Alt Relay ─ main node
 *   External power ─ Ext Pwr Relay ─ battery side of the Battery Relay
 *   main node ─ feeder C/B "B" ─ ELECTRICAL BUS 1,  feeder C/B "A" ─ ELECTRICAL BUS 2   (in the J-box)
 *   BUS 1 ─diode─┐                  BUS 1 ─diode─┐
 *   BUS 2 ─diode─┴─ CROSSFEED BUS   BUS 2 ─diode─┴─ ESSENTIAL BUS ─ STDBY BATT cb ─ STBY BATT sw ─ 25 A fuse ─ standby battery
 *   BUS 1 ─ AVN 1 cb ─ AVIONICS (BUS 1) ─ AVIONICS BUS 1;  BUS 2 ─ AVN 2 cb ─ AVIONICS (BUS 2) ─ AVIONICS BUS 2
 *
 * Voltages, the alternator's low-RPM capacity, battery curves and load currents are illustrative
 * (the POH gives thresholds, not curves): 28.0 V regulated, LOW VOLTS < 24.5 V, HIGH VOLTS > 32.0 V,
 * ACU over-voltage trip ≈ 31.75 V, standby battery takes the essential bus when M BUS < 20 V.
 */

export type Nav3Bus = "E1" | "E2" | "XF" | "ESS" | "AV1" | "AV2";
export const NAV3_BUS_NAME: Record<Nav3Bus, string> = {
  E1: "ELECTRICAL BUS 1", E2: "ELECTRICAL BUS 2", XF: "CROSSFEED BUS", ESS: "ESSENTIAL BUS", AV1: "AVIONICS BUS 1", AV2: "AVIONICS BUS 2",
};
/** Rows for the electrical panel: [bus, name, fed from] (POH Figure 7-7). */
export const NAV3_BUSES: [Nav3Bus, string, string][] = ([
  ["E1", "J-box feeder C/B “B”"],
  ["E2", "J-box feeder C/B “A”"],
  ["XF", "Bus 1 and Bus 2 through diodes"],
  ["ESS", "Bus 1 and Bus 2 through diodes · standby battery (ARM)"],
  ["AV1", "Bus 1 · AVN 1 breaker · AVIONICS (BUS 1)"],
  ["AV2", "Bus 2 · AVN 2 breaker · AVIONICS (BUS 2)"],
] as [Nav3Bus, string][]).map(([b, from]) => [b, NAV3_BUS_NAME[b], from]);
/** "All circuit breakers on ESSENTIAL BUS, AVIONICS BUS 1 and AVIONICS BUS 2 are capable of being opened" (POH 7-57). */
export const PULLABLE: Record<Nav3Bus, boolean> = { E1: false, E2: false, XF: false, ESS: true, AV1: true, AV2: true };

/** One panel breaker. `key` = "BUS:LABEL" (labels repeat across buses, e.g. PFD on ESS and AVN 1). */
export interface Breaker {
  bus: Nav3Bus; label: string;
  /** Rating (A) where a source gives it, and that source; `unverified` = not from the POH (shown as "5?"). */
  amps?: number; src?: string; unverified?: boolean;
  /** Load text from Fig 7-7 Sheet 2. */
  feeds: string;
}
export const cbKey = (b: Pick<Breaker, "bus" | "label">) => `${b.bus}:${b.label}`;

/** Breakers inside the power distribution module (J-box): bus feeders, push-to-reset. */
export const FEEDER = { E1: "PDM:FEEDER B", E2: "PDM:FEEDER A" } as const;

export type StbySw = "ARM" | "OFF" | "TEST";
export interface Nav3Elec {
  /** MASTER switch halves (ALT can't be ON without BAT: enforce in the UI) and AVIONICS BUS 1 / BUS 2. */
  bat: boolean; alt: boolean; avn1: boolean; avn2: boolean;
  stby: StbySw;
  /** Ground power plugged in (28 V regulated). */
  ext: boolean;
  /** Breakers that are out (pulled or tripped), by key. */
  cb: Record<string, boolean>;
  /** State of charge 0..1 (updated by the airplane's tick). */
  socMain: number; socStby: number;
  fail: {
    /** Alternator produces nothing (belt / brushes / diode). */
    alt: boolean;
    /** Regulator runaway: alternator output climbs above 32 V. */
    ov: boolean;
    /** ACU over-voltage sensor inoperative (so `ov` is not tripped automatically → HIGH VOLTS). */
    ovSense: boolean;
    /** Main battery failed (open). */
    bat: boolean;
    /** Standby battery weak / cold (test lamp goes out). */
    stby: boolean;
  };
}

export const nav3Init = (p: Partial<Nav3Elec> = {}): Nav3Elec => ({
  bat: true, alt: true, avn1: true, avn2: true, stby: "ARM", ext: false, cb: {}, socMain: 0.92, socStby: 1,
  fail: { alt: false, ov: false, ovSense: false, bat: false, stby: false }, ...p,
});

export interface Nav3Cfg {
  /** Alternator rating (A): 60 standard, 95 optional on the 182T. */
  altAmps: number;
  /** Main and standby battery capacity (Ah) used for the depletion clock. */
  mainAh: number; stbyAh: number;
  breakers: Breaker[];
}

export interface Nav3Solution {
  v: Record<Nav3Bus, number>;
  /** J-box main node (LOW VOLTS sensing point), and the EIS readouts. null = measuring breaker out (no reading). */
  node: number; mBus: number | null; eBus: number | null;
  /** Ammeters (A): main battery (+ charge), standby battery (+ charge), alternator output, total bus load. */
  mBatt: number; sBatt: number; altAmps: number; load: number;
  altOn: boolean; stbyOnline: boolean;
  /** STBY BATT TEST: green lamp stays lit (battery healthy). */
  testLamp: boolean;
  lowVolts: boolean; highVolts: boolean;
  /** ACU over-voltage sensor fires: the airplane's tick opens the ALT FIELD breaker. */
  acuTrip: boolean;
  /** Breaker key → breaker in and its bus powered. */
  on: Record<string, boolean>;
  /** Breaker key → current drawn (A). */
  amps: Record<string, number>;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Main battery terminal voltage under light load vs state of charge (illustrative lead-acid curve): it collapses toward 0 V
 *  as the battery goes flat, so a dead battery drops the loads instead of holding the buses up forever. */
export const vMain = (soc: number) => (soc > 0.1 ? 23.0 + 2.2 * ((soc - 0.1) / 0.9) : 23.0 * Math.sqrt(Math.max(0, soc) / 0.1));
/** Standby battery voltage: ~25 V full, 20 V = "little or no capacity remaining" (POH 7-51). */
export const vStby = (soc: number) => (soc <= 0.002 ? 0 : 20.4 + 4.7 * Math.pow(soc, 0.35));
/** Below this a G1000 unit / load drops out. */
const LIVE = 16;
const DIODE = 0.25;

/**
 * Solve the network. `loads` gives each breaker's demand (A) when powered (0 = switched off);
 * `rpm` sets the alternator's capacity (it can't hold 28 V at low RPM with a high load — POH 3-19).
 */
export function solveNav3(e: Nav3Elec, cfg: Nav3Cfg, loads: Record<string, number>, rpm: number): Nav3Solution {
  const out = (k: string) => !!e.cb[k];
  const batV = e.fail.bat ? 0 : vMain(e.socMain);
  // battery relay closes with MASTER BAT; ground power and the battery meet upstream of it
  const relay = e.bat;
  const source = Math.max(batV, e.ext ? 28.0 : 0);
  const altSet = e.fail.ov ? 33.6 : 28.0;
  const busesAt = (node: number) => {
    const e1 = out(FEEDER.E1) ? 0 : node, e2 = out(FEEDER.E2) ? 0 : node;
    const dor = Math.max(e1, e2) > 0 ? Math.max(e1, e2) - DIODE : 0;
    const av1 = e.avn1 && !out("E1:AVN 1") ? e1 : 0, av2 = e.avn2 && !out("E2:AVN 2") ? e2 : 0;
    return { E1: e1, E2: e2, XF: dor, ESS: dor, AV1: av1, AV2: av2 } as Record<Nav3Bus, number>;
  };
  // the field is powered through the ALT FIELD breaker on the CROSSFEED BUS: it needs that bus alive (battery or ground power
  // through a feeder, or the alternator itself once it is turning fast enough to self-excite)
  const selfEx = !e.fail.alt && rpm > 1500;
  const fieldOk = relay && e.alt && !out("XF:ALT FIELD") && busesAt(Math.max(source, selfEx ? altSet : 0)).XF >= LIVE;
  const altCap = cfg.altAmps * Math.max(0, Math.min(1, (rpm - 550) / 1100));
  const altCan = fieldOk && !e.fail.alt && rpm > 500 && (source > 8 || rpm > 1500);
  // first pass: nominal voltages to find which loads are live
  const nodeNom = !relay ? 0 : Math.max(source, altCan ? altSet : 0);
  const stbyArm = e.stby === "ARM" && !out("ESS:STDBY BATT");
  const sV = vStby(e.socStby);
  const sumLoads = (v: Record<Nav3Bus, number>) => {
    let t = 0, ess = 0;
    for (const b of cfg.breakers) {
      const k = cbKey(b);
      if (out(k) || v[b.bus] < LIVE) continue;
      const a = loads[k] ?? 0;
      t += a; if (b.bus === "ESS") ess += a;
    }
    return { t, ess };
  };
  let v = busesAt(nodeNom);
  const L1 = sumLoads(v);
  // charging current into the batteries (tapering with state of charge)
  const chargeMain0 = relay && !e.fail.bat ? Math.min(14, 0.4 + 26 * Math.pow(1 - e.socMain, 1.6)) : 0;
  const chargeStby = stbyArm && sV > 0 ? Math.min(1.2, 0.08 + 3 * Math.pow(1 - e.socStby, 1.5)) : 0;
  // alternator holds regulation only if it can carry the loads (low RPM sag → battery voltage → LOW VOLTS)
  const altOn = altCan && altCap >= L1.t + 2;
  // a runaway regulator forces a heavy charge into the battery (M BATT > 40 A — the HIGH VOLTS checklist's second trigger, POH 3-17)
  const chargeMain = chargeMain0 + (altOn && chargeMain0 > 0 ? Math.max(0, altSet - 28.5) * 8.5 : 0);
  // battery terminal voltage sags under load (≈ 0.12 Ω battery + contactor + wiring, illustrative): MASTER ON with the
  // engine stopped shows LOW VOLTS (POH 4-6) and the bus recovers once the alternator comes on line
  const batTerm = batV > 0 ? Math.max(0, batV - 0.12 * Math.min(L1.t, 25)) : 0;
  const node = !relay ? 0 : Math.max(e.ext ? 28.0 : 0, altOn ? altSet : batTerm);
  v = busesAt(node);
  // standby battery: automatically takes the essential bus when M BUS < 20 V (POH 3-17)
  const stbyOnline = stbyArm && sV > 0 && v.ESS < 20;
  if (stbyOnline) v.ESS = sV;
  const L = sumLoads(v);
  const essFromStby = stbyOnline ? L.ess : 0;
  const mainLoad = L.t - essFromStby;
  let altAmps = 0, mBatt = 0;
  if (altOn) {
    // a flat (but not failed) battery still takes a charge
    altAmps = Math.min(cfg.altAmps, mainLoad + chargeMain + (stbyArm && !stbyOnline ? chargeStby : 0));
    mBatt = chargeMain;
  } else if (relay && e.ext) {
    mBatt = chargeMain;
  } else if (relay && batV > 0) {
    mBatt = -(mainLoad + (stbyArm && !stbyOnline ? chargeStby : 0));
  }
  const sBatt = !stbyArm || sV <= 0 ? 0 : stbyOnline ? -L.ess : v.ESS > sV ? chargeStby : 0;
  const on: Record<string, boolean> = {}, amps: Record<string, number> = {};
  for (const b of cfg.breakers) {
    const k = cbKey(b);
    on[k] = !out(k) && v[b.bus] >= LIVE;
    amps[k] = on[k] ? loads[k] ?? 0 : 0;
  }
  const mBus = out("XF:WARN") ? null : r1(v.XF);
  const eBus = out("ESS:NAV 1 ENG") ? null : r1(v.ESS);
  const hi = Math.max(v.E1, v.E2, v.ESS);
  return {
    v: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r1(x)])) as Record<Nav3Bus, number>,
    node: r1(node), mBus, eBus,
    mBatt: Math.round(mBatt * 10) / 10, sBatt: Math.round(sBatt * 10) / 10, altAmps: Math.round(altAmps * 10) / 10, load: Math.round(L.t * 10) / 10,
    altOn, stbyOnline,
    testLamp: e.stby === "TEST" && !e.fail.stby && e.socStby > 0.55,
    lowVolts: node > 0 ? node < 24.5 : stbyOnline, // ACU signal; with the master off the ACU is unpowered but the PFD shows LOW VOLTS on the standby battery
    highVolts: hi > 32.0,
    acuTrip: altOn && altSet > 31.75 && !e.fail.ovSense,
    on, amps,
  };
}

/** Advance both batteries' state of charge by `dtMin` minutes using the solved ammeter readings. */
export function stepNav3Soc(e: Nav3Elec, cfg: Nav3Cfg, E: Pick<Nav3Solution, "mBatt" | "sBatt">, dtMin: number) {
  const dm = (E.mBatt / 60) * dtMin / cfg.mainAh, ds = (E.sBatt / 60) * dtMin / cfg.stbyAh;
  return {
    socMain: Math.max(0, Math.min(1, e.socMain + dm * (E.mBatt > 0 ? 0.85 : 1))),
    socStby: Math.max(0, Math.min(1, e.socStby + ds * (E.sBatt > 0 ? 0.85 : 1))),
  };
}

/** EIS ELECTRICAL colours (POH 7-53/7-54): volts red > 32.0 or < 24.5; M BATT white > −1.5 A; S BATT amber when negative. */
/** Ammeter text with a sign: +3.2 / −1.5. */
export const amp = (a: number) => (a > 0 ? "+" : "") + a.toFixed(1);
export const voltsAlert = (v: number | null) => (v == null ? null : v > 32 || v < 24.5 ? ("warning" as const) : null);
export const mBattAlert = (a: number) => (a < -1.5 ? ("caution" as const) : null);
export const sBattAlert = (a: number) => (a < 0 ? ("caution" as const) : null);
