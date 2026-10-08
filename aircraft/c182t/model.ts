/**
 * C182T NAV III (KAP 140) sim state, the pure solver `solve(s) → E` (NAV III electrical network, powered loads, fuel availability)
 * and the G1000 annunciations. Continuous values (RPM, MAP, temperatures, flap angle, flight state, KAP 140 state) live in the
 * mutable `live` object, advanced by tick.ts.
 *
 * Sources: POH/AFM 182TPHAUS-04 Revision 4 (22 Dec 2005; this copy issued for s/n 18281780) Figure 7-7 Sheets 1–3 (electrical),
 * Figure 7-6 (fuel), Section 2 limitations; Supplement 3 (KAP 140, 182TPHAUS-S3-02), effective for serials 18281228, 18281318–18281868
 * and 18281870–18281875, which includes N8050J s/n 18281633 and N21200 s/n 18281732; G1000 Cockpit Reference Guide 190-00384-13 Rev. B; the 2007 GFC 700 edition
 * (182TPHBUS-01) only where the 2005 text is silent, and marked as such.
 */
import type { CasLevel } from "../types";
import {
  nav3Init,
  solveNav3,
  type Breaker,
  type Nav3Cfg,
  type Nav3Elec,
  type Nav3Solution,
} from "../cessna/electrical";
import { nav3Annunciations, type Nav3AnnDef } from "../cessna/annunciations";
import { FLIGHT_DEFAULT, initFlight, type FlightCfg } from "@/lib/avionics/flight";
import { kap140Init, kap140Pfd, type Kap140State } from "@/lib/avionics/kap140";

export type Mags = "OFF" | "R" | "L" | "BOTH" | "START";
/** Dual-stack four-position selector: BOTH, RIGHT, LEFT, OFF (push down to rotate to OFF) — POH 7-44. */
export type FuelSel = "BOTH" | "LEFT" | "RIGHT" | "OFF";
/** Flap lever positions: UP, 10°, 20° and FULL (38° per TCDS 3A13; the POH never states the FULL angle). */
export type FlapCmd = 0 | 10 | 20 | 38;
export type EisPage = "ENGINE" | "SYSTEM";
export type Elt = "AUTO" | "ON" | "RESET";

export interface Sim {
  /** On the ramp (flight state frozen) or flying. */
  ground: boolean;
  eng: {
    running: boolean;
    mags: Mags;
    /** Engine RPM rounded to 50 (set by tick.ts from the tach value): sizes the alternator's low-RPM capacity in the solver. */
    rpm: number;
    /** Throttle 0 (closed, full out) … 1 (full in); PROPELLER 0 (pulled out, low RPM) … 1 (pushed in, HIGH RPM); mixture 0 (IDLE CUTOFF) … 1 (FULL RICH). */
    throttle: number;
    prop: number;
    mix: number;
    /** Cowl flaps 0 (CLOSED) … 1 (OPEN), lever on the right side of the pedestal (POH 7-37). */
    cowl: number;
    /** Too much prime: won't start until cleared (POH 4-13 flooded start). */
    flooded: boolean;
    /** Induction filter blocked (ice/dust): the alternate air door opens, ≈10% power loss at full throttle (POH 7-35). */
    filter: boolean;
    /** gov = governor oil lost: the blades go to low pitch / high RPM (inference from POH 7-37). */
    fail: { edp: boolean; magL: boolean; magR: boolean; oil: boolean; gov: boolean };
  };
  elec: Nav3Elec;
  /** Alternator fitted: 60 A standard (24-01-R) or 95 A optional (24-02-O) — which the club airplanes have is NOT IN the POH. */
  altAmps: 60 | 95;
  /** Time compression for battery endurance (1 = real time). */
  warp: number;
  fuel: {
    sel: FuelSel;
    pump: boolean;
    /** Usable gallons per tank (43.5 max). */
    qL: number;
    qR: number;
    /** Prolonged slip or skid (uncoordinated flight): can unport a low or dry tank (POH 2-14, 7-39). */
    slip: boolean;
  };
  flaps: { cmd: FlapCmd; moving: boolean };
  /** Pilot's control wheel and rudder pedals, −1 … 1 (pitch + = pull); rudder trim wheel −1 (nose left) … 1 (nose right). */
  ctrl: { pitch: number; roll: number; yaw: number; rudTrim: number };
  /** Differential toe braking −1 (left) … 1 (right), parking brake, speed fairings fitted (optional in 2005, POH 7-21). */
  gear: { diff: number; park: boolean; fairings: boolean };
  lights: {
    beacon: boolean;
    land: boolean;
    taxi: boolean;
    nav: boolean;
    strobe: boolean;
    cabinPwr: boolean;
    /** Overhead push button: rear dome + under-wing courtesy lights (POH 7-57, 7-58). */
    dome: boolean;
    /** Overhead front FLOOD light dimmer and the four DIMMING knobs (0 = off). One front flood light below s/n 18281742. */
    flood: number;
    swcb: number;
    pedestal: number;
    avionics: number;
    stbyInd: number;
  };
  /** CABIN HT and CABIN AIR push-pull knobs (0 = in … 1 = full out), DEFROST rotary knob (0 = OFF … 1 = full clockwise), cabin vents.
   *  coAck: CO LVL HIGH acknowledged with the WARNING softkey; cleared by tick.ts below 50 PPM. */
  env: { heat: number; air: number; defrost: number; vents: boolean; coLeak: boolean; coAck: boolean };
  pitot: {
    heat: boolean;
    heaterFail: boolean;
    altStatic: boolean;
    staticBlocked: boolean;
    pitotBlocked: boolean;
    oat: number;
  };
  /** Electric vane-type stall warning: vane stuck = no horn. */
  stall: { vaneStuck: boolean };
  vac: { fail: boolean };
  avx: {
    backup: boolean;
    pfdFail: boolean;
    mfdFail: boolean;
    ahrsFail: boolean;
    adcFail: boolean;
    /** EIS page selected with the ENGINE softkey (the LEAN page's cylinder bar graphs are not drawn). */
    eisPage: EisPage;
    /** DC electric turn coordinator behind the panel (KAP 140 roll-rate sensor) failed. */
    tcFail: boolean;
  };
  /** Latched annunciation timers (set by tick.ts): LOW FUEL needs 60 s, STBY BATT 10 s. */
  ann: { lowFuelL: boolean; lowFuelR: boolean; stbyBatt: boolean };
  cabin: { lock: boolean; elt: Elt };
}

export const initialSim: Sim = {
  ground: false,
  eng: {
    running: true,
    mags: "BOTH",
    rpm: 2300,
    throttle: 0.82,
    prop: 0.89,
    mix: 0.69,
    cowl: 0,
    flooded: false,
    filter: false,
    fail: { edp: false, magL: false, magR: false, oil: false, gov: false },
  },
  elec: nav3Init({ socMain: 0.93 }),
  altAmps: 60,
  warp: 1,
  fuel: { sel: "BOTH", pump: false, qL: 34, qR: 33, slip: false },
  flaps: { cmd: 0, moving: false },
  ctrl: { pitch: 0, roll: 0, yaw: 0, rudTrim: 0 },
  gear: { diff: 0, park: false, fairings: false },
  lights: {
    beacon: true,
    land: false,
    taxi: false,
    nav: true,
    strobe: true,
    cabinPwr: false,
    dome: false,
    flood: 0,
    swcb: 0,
    pedestal: 0,
    avionics: 0,
    stbyInd: 0,
  },
  env: { heat: 0.15, air: 0.5, defrost: 0.3, vents: true, coLeak: false, coAck: false },
  pitot: { heat: false, heaterFail: false, altStatic: false, staticBlocked: false, pitotBlocked: false, oat: 3 },
  stall: { vaneStuck: false },
  vac: { fail: false },
  avx: {
    backup: false,
    pfdFail: false,
    mfdFail: false,
    ahrsFail: false,
    adcFail: false,
    eisPage: "ENGINE",
    tcFail: false,
  },
  ann: { lowFuelL: false, lowFuelR: false, stbyBatt: false },
  cabin: { lock: false, elt: "AUTO" },
};

/* ---------- flight model ---------- */
/** Teaching flight model for the 182T: ≈ 113 KIAS (126 KTAS at 6,000 ft) at 60% power; ≈ 920 fpm at Vy 80 KIAS with full power at sea level. */
export const C182_FLIGHT: FlightCfg = { ...FLIGHT_DEFAULT, v0: 58, vp: 92, fpmPerKt: 13.2, vMin: 45, maxBank: 30 };

/** KAP 140 already through its self-test (cruise start state). */
export const kapReady = (): Kap140State => ({
  ...kap140Init(),
  powered: true,
  on: -100,
  ready: true,
  baroSet: true,
  selAlt: 6000,
});

/** Fast-changing values advanced every frame; kept out of React state on purpose. */
export const live = {
  rpm: 2300,
  map: 21.0,
  oilP: 72,
  oilT: 190,
  cht: 385,
  egt: 1380,
  ff: 11.8,
  vac: 5.0,
  /** Blade angle at the 30-in station (°): 14.9 low-pitch stop … 31.7 high pitch (POH 2-6). */
  blade: 29,
  /** Hottest cylinder (1–6) for the EIS CHT / EGT pointers. */
  hotCyl: 3,
  /** Standby attitude gyro rotor speed 0..1 and its drift (deg). */
  gyro: 1,
  drift: 0,
  flapAng: 0,
  /** Fuel in the cylinders from priming (0 dry … >1.9 flooded) and engine warmth 0..1. */
  wet: 0,
  hot: 1,
  crankT: 0,
  crankTotal: 0,
  starve: 0,
  primeRun: 0,
  restartT: 0,
  unport: 0,
  fs: initFlight({ ias: 113, alt: 6000, selAlt: 6000, hdg: 90, hdgBug: 90, crs: 90, power: 0.59, oat: 3 }),
  kap: kapReady(),
  /** Effective control positions (pilot or KAP 140 servos) used by the surfaces, yokes and cables. */
  ctl: { pitch: 0, roll: 0, yaw: 0 },
  timers: { lowL: 0, lowR: 0, stby: 0, trimRun: 0, outOfTrim: 0 },
  burnL: 0,
  burnR: 0,
  /** Totalizer (SYSTEM page FUEL CALC, CRG 10): GAL USED since reset and GAL REM from the pilot-set start value. */
  galUsed: 0,
  galStart: 67,
  /** Battery state of charge integrated every frame (fractional), and the store values last seen / pushed. */
  soc: { m: 0.93, s: 1, pm: 0.93, ps: 1 },
  /** Hobbs meter (oil pressure > 20 PSI and WARN breaker power, POH 7-12) and the SYSTEM page ENG HRS. */
  hobbs: 2186.4,
  engHrs: 2186.4,
  coPpm: 0,
  horn: false,
  stallDemo: false,
  /** Altitude frozen in the static system when the static ports block. */
  staticAlt: null as number | null,
  /** STBY BATT TEST held (s). */
  testHeld: 0,
  /** KAP 140 voice messages (S3-16) and when they were last spoken. */
  voice: "" as "" | "TRIM IN MOTION" | "CHECK PITCH TRIM",
  voiceT: -99,
  /** Disconnect horn sounding until (s) after the KAP 140 lost power while engaged (the horn is on WARN, not the AUTO PILOT breaker). */
  discTone: -99,
  /** An EIS exceedance was present last frame (the SYSTEM page returns to ENGINE when one starts). */
  eisEx: false,
};

/* ---------- breakers: POH Figure 7-7 Sheet 2 (182TPHAUS-04), labels and order as drawn ---------- */
/**
 * Only five panel ratings appear in the documents: FLAP 10 A (POH 7-20), PITOT HEAT 10 A (POH 7-62), WARN 5 A and AUTO PILOT 5 A
 * (Supplement 3 S3-10); "STALL WARN 5 A" in POH 7-65 is the same WARN breaker (Fig 7-7). Every other rating is NOT IN the POH and is
 * left blank rather than guessed. Optional equipment is marked "(if installed)" as in the figure.
 */
export const BREAKERS: Breaker[] = [
  { bus: "E1", label: "FUEL PUMP", feeds: "To aux fuel pump (through the FUEL PUMP switch)" },
  { bus: "E1", label: "BCN LT", feeds: "To flashing beacon" },
  { bus: "E1", label: "LAND LT", feeds: "To landing light" },
  { bus: "E1", label: "CABIN LTS/PWR", feeds: "To overhead lights, to 12V cabin power" },
  {
    bus: "E1",
    label: "FLAPS",
    amps: 10,
    src: "POH 7-20 (“10-ampere circuit breaker, labeled FLAP”)",
    feeds: "To flaps",
  },
  { bus: "E1", label: "AVN 1", feeds: "AVIONICS BUS 1 via the AVIONICS switch (BUS 1)" },
  { bus: "XF", label: "ALT FIELD", feeds: "To alt master switch (opened automatically by the ACU)" },
  {
    bus: "XF",
    label: "WARN",
    amps: 5,
    src: "Supplement 3 S3-10 (POH 7-65 calls it STALL WARN)",
    feeds:
      "To stall warning, autopilot warning, ELT warning, main bus voltmeter, hourmeter, starter relay, stdby battery, and main bus sense",
  },
  { bus: "ESS", label: "PFD", feeds: "To primary flight display" },
  { bus: "ESS", label: "ADC AHRS", feeds: "To air data computer, to attitude heading reference system" },
  { bus: "ESS", label: "NAV 1 ENG", feeds: "To navigation #1, engine/airframe unit, and essential bus voltmeter" },
  { bus: "ESS", label: "COMM 1", feeds: "To VHF communication #1" },
  { bus: "ESS", label: "STDBY IND LTS", feeds: "To standby indicator lights" },
  { bus: "ESS", label: "STDBY BATT", feeds: "To and from standby battery system" },
  { bus: "E2", label: "AVN 2", feeds: "AVIONICS BUS 2 via the AVIONICS switch (BUS 2)" },
  { bus: "E2", label: "PITOT HEAT", amps: 10, src: "POH 7-62", feeds: "To pitot heat and stall detector heaters" },
  { bus: "E2", label: "NAV LTS", feeds: "To NAV and control wheel map lights" },
  { bus: "E2", label: "TAXI LT", feeds: "To taxi light" },
  { bus: "E2", label: "STROBE LTS", feeds: "To wing strobe lights" },
  { bus: "E2", label: "PANEL LTS", feeds: "To panel lights" },
  { bus: "AV1", label: "PFD", feeds: "To primary flight display, to deckskin and PFD cooling fans" },
  { bus: "AV1", label: "ADC AHRS", feeds: "To air data computer and attitude heading reference system" },
  { bus: "AV1", label: "NAV 1 ENG", feeds: "To navigation #1 and engine/airframe unit" },
  { bus: "AV1", label: "STORM SCOPE", feeds: "To stormscope (WX-500, if installed)" },
  { bus: "AV1", label: "FIS", feeds: "To flight information system (if installed)" },
  { bus: "AV1", label: "TAS", feeds: "To traffic avoidance system (if installed)" },
  { bus: "AV1", label: "ADF DME", feeds: "To automatic direction finder, distance measure equipment (if installed)" },
  { bus: "AV2", label: "MFD", feeds: "To multi-function display and MFD fan" },
  { bus: "AV2", label: "XPNDR", feeds: "To transponder" },
  { bus: "AV2", label: "NAV 2", feeds: "To navigation #2 and aft avionics cooling fan" },
  { bus: "AV2", label: "COMM 2", feeds: "To VHF communication #2" },
  { bus: "AV2", label: "AUDIO", feeds: "To audio panel" },
  {
    bus: "AV2",
    label: "AUTO PILOT",
    amps: 5,
    src: "Supplement 3 S3-10",
    feeds: "To autopilot system (KAP 140 computer, roll, pitch and pitch trim servos)",
  },
];
/**
 * Main battery 24 V 12.75 Ah in the tailcone (equipment list 24-04-R, POH 6-20; the 2007 edition lists 8 Ah). Standby battery
 * capacity is not in the 2005 POH: 6.2 Ah from the 2007 edition for the same part number (AVT 200413) — an inference.
 */
export const elecCfg = (s: Pick<Sim, "altAmps">): Nav3Cfg => ({
  altAmps: s.altAmps,
  mainAh: 12.75,
  stbyAh: 6.2,
  breakers: BREAKERS,
});

/* ---------- engine helpers (pure) ---------- */
/** Ambient pressure (in.Hg) at a pressure altitude (ft), standard atmosphere. */
export const pAmb = (alt: number) => 29.92 * Math.pow(1 - 6.8756e-6 * Math.max(-1000, alt), 5.2559);
/** Relative fuel/air (λ ≈ 1 at peak EGT): full rich gets richer with altitude. */
export const lambda = (mix: number, alt: number) => mix * 1.22 * (1 + Math.max(0, alt) / 25000);
/** Power multiplier from mixture: best power ~λ 1.12 (≈ 125 °F rich of peak, POH Fig 4-4). */
export function mixPower(l: number) {
  if (l < 0.5) return 0;
  const p09 = 1 - 0.55 * (0.9 - 1.12) ** 2;
  return l < 0.9 ? p09 * ((l - 0.5) / 0.4) : 1 - 0.55 * (l - 1.12) ** 2;
}
const magOk = (g: Sim["eng"], m: "L" | "R") => !(m === "L" ? g.fail.magL : g.fail.magR);
/** Magnetos producing sparks for the selected switch position (0, 1 or 2). */
export const magsLive = (g: Sim["eng"]) =>
  g.mags === "BOTH" || g.mags === "START"
    ? (magOk(g, "L") ? 1 : 0) + (magOk(g, "R") ? 1 : 0)
    : g.mags === "L"
      ? magOk(g, "L")
        ? 1
        : 0
      : g.mags === "R"
        ? magOk(g, "R")
          ? 1
          : 0
        : 0;
/**
 * Manifold pressure (in.Hg): ambient with the engine stopped; with it running, the throttle sets it from ≈ 1/3 of ambient at idle to
 * ambient less ≈ 0.5 in at full throttle. A blocked filter (alternate air door open) costs ≈ 10% power at full throttle (POH 7-35).
 */
export function manifold(s: Sim, rpm: number, alt: number) {
  const pa = pAmb(alt);
  if (!s.eng.running || rpm < 200) return pa;
  let m = pa * (0.33 + 0.67 * Math.pow(s.eng.throttle, 0.85)) - 0.5 * (rpm / 2400);
  if (s.eng.filter) m -= 0.1 * Math.max(0, m - 7.6) * s.eng.throttle;
  return Math.max(8, Math.min(pa, m));
}
/**
 * Fraction of rated power (230 BHP) from MAP and RPM, fitted to the 2007 edition's cruise table (2,400 RPM: 25 in ≈ 81%, 23 in ≈ 71%,
 * 20 in ≈ 58%; 2,200/23 ≈ 66%; 2,000/20 ≈ 49% — GFC Fig 5-9), times the mixture and magneto factors.
 */
export function powerFrac(s: Sim, map: number, rpm: number, alt: number) {
  const m = magsLive(s.eng),
    magF = m === 2 ? 1 : m === 1 ? 0.93 : 0;
  return Math.max(
    0,
    0.046 * (map - 7.6) * Math.pow(Math.max(rpm, 0) / 2400, 0.84) * mixPower(lambda(s.eng.mix, alt)) * magF,
  );
}
/** Governor setting from the PROPELLER knob: full in 2,400 RPM (red line, POH 2-6) … full out ≈ 1,500 RPM (bottom of range assumed). */
export const govRpm = (prop: number) => 1500 + 900 * Math.max(0, Math.min(1, prop));
/** RPM the engine would turn with the blades on the low-pitch stop (14.9°): power at 2,400 RPM plus windmilling with airspeed. */
export const rpmFine = (p2400: number, ias: number) =>
  300 + 2150 * Math.pow(Math.max(p2400, 0), 0.8) + 9 * Math.max(0, ias);
/**
 * Blade angle (°, 30-in station) while governing: grows with the advance ratio (TAS per 1,000 RPM) and power — near the 14.9° stop
 * at the start of the takeoff roll, mid-range in the climb, highest in fast cruise (illustrative; capped at the 31.7° high-pitch stop).
 */
export const bladeGov = (tas: number, rpm: number, power: number) =>
  Math.min(31.7, 14.9 + 0.22 * (tas / Math.max(rpm / 1000, 0.5)) + 4 * power);
/** Fuel flow (GPH) from airflow and mixture: ≈ 21 GPH full rich at full power, sea level (Maximum Power Fuel Flow placard 20.5 minimum, GFC 4-32). */
export const fuelFlowGph = (map: number, rpm: number, l: number) => 0.6 + 17 * (map / 29.92) * (rpm / 2400) * l;

/* ---------- solver ---------- */
export interface Elec extends Nav3Solution {
  pfd: boolean;
  mfd: boolean;
  ahrs: boolean;
  adc: boolean;
  gia1: boolean;
  gia2: boolean;
  gea: boolean;
  com1: boolean;
  com2: boolean;
  audio: boolean;
  xpdr: boolean;
  /** KAP 140 computer and servos (AUTO PILOT breaker, AVIONICS BUS 2); WARN feeds the PITCH TRIM annunciation and disconnect horn (S3-10). */
  kapPwr: boolean;
  warnPwr: boolean;
  starterPwr: boolean;
  fuelPumpOn: boolean;
  flapsPwr: boolean;
  pitotHeating: boolean;
  /** Forward + PFD fans (AVN 1 PFD breaker), MFD fan (MFD breaker), aft tailcone fan (NAV 2 breaker) — POH 7-49, 7-69. */
  fwdFan: boolean;
  mfdFan: boolean;
  aftFan: boolean;
  /** 12 V cabin power outlet live (CABIN PWR 12V switch, CABIN LTS/PWR breaker). */
  outlet12: boolean;
  lit: {
    beacon: boolean;
    land: boolean;
    taxi: boolean;
    nav: boolean;
    strobe: boolean;
    dome: boolean;
    flood: boolean;
    panel: boolean;
    stbyInd: boolean;
    map: boolean;
  };
  /** Fuel can reach the engine from the selected tank(s). */
  fuelOk: boolean;
  /** Engine-driven or aux pump pressure available (engine turning or FUEL PUMP running). */
  fuelPress: boolean;
}

export function breakerLoads(s: Sim): Record<string, number> {
  const L = s.lights,
    k = (bus: string, label: string) => `${bus}:${label}`,
    out = (key: string) => !!s.elec.cb[key];
  return {
    [k("E1", "FUEL PUMP")]: s.fuel.pump ? 2.5 : 0,
    [k("E1", "BCN LT")]: L.beacon ? 1.4 : 0,
    [k("E1", "LAND LT")]: L.land ? 4.6 : 0,
    [k("E1", "CABIN LTS/PWR")]: (L.dome ? 0.6 : 0) + L.flood * 0.4 + (L.cabinPwr ? 1.5 : 0),
    [k("E1", "FLAPS")]: s.flaps.moving ? 9.0 : 0,
    [k("XF", "ALT FIELD")]: s.elec.alt ? 2.5 : 0,
    [k("XF", "WARN")]: 0.4,
    [k("ESS", "PFD")]: 2.2,
    [k("ESS", "ADC AHRS")]: 0.6,
    [k("ESS", "NAV 1 ENG")]: 0.9,
    [k("ESS", "COMM 1")]: 0.5,
    [k("ESS", "STDBY IND LTS")]: L.stbyInd > 0 ? 0.1 : 0,
    [k("E2", "PITOT HEAT")]: s.pitot.heat && !s.pitot.heaterFail ? 7.5 : 0,
    [k("E2", "NAV LTS")]: L.nav ? 1.4 : 0,
    [k("E2", "TAXI LT")]: L.taxi ? 4.6 : 0,
    [k("E2", "STROBE LTS")]: L.strobe ? 2.0 : 0,
    [k("E2", "PANEL LTS")]: (L.swcb + L.pedestal) * 0.25,
    // dual-fed units draw from the essential bus unless its breaker is out
    [k("AV1", "PFD")]: 0.7 + (out(k("ESS", "PFD")) ? 2.2 : 0),
    [k("AV1", "ADC AHRS")]: out(k("ESS", "ADC AHRS")) ? 0.6 : 0,
    [k("AV1", "NAV 1 ENG")]: out(k("ESS", "NAV 1 ENG")) ? 0.9 : 0,
    [k("AV1", "FIS")]: 0.4,
    [k("AV2", "MFD")]: 2.5,
    [k("AV2", "XPNDR")]: 1.2,
    [k("AV2", "NAV 2")]: 1.4,
    [k("AV2", "COMM 2")]: 0.5,
    [k("AV2", "AUDIO")]: 0.8,
    [k("AV2", "AUTO PILOT")]: 1.0,
  };
}

export const tankHas = (s: Sim, side: "L" | "R") => (side === "L" ? s.fuel.qL : s.fuel.qR) > 0.02;
/** Fuel reaches the selector outlet from the selected tank(s) (the dual-stack selector's bottom, supply section). */
export function fuelOk(s: Sim) {
  const f = s.fuel;
  if (f.sel === "OFF") return false;
  return f.sel === "BOTH" ? tankHas(s, "L") || tankHas(s, "R") : tankHas(s, f.sel === "LEFT" ? "L" : "R");
}

export function solve(s: Sim, prev?: Elec): Elec {
  const N = solveNav3(s.elec, elecCfg(s), breakerLoads(s), s.eng.rpm, prev?.altOn);
  const on = (bus: string, label: string) => !!N.on[`${bus}:${label}`];
  const either = (label: string) => on("ESS", label) || on("AV1", label);
  const gia1 = either("NAV 1 ENG"),
    gia2 = on("AV2", "NAV 2");
  const pfd = either("PFD") && !s.avx.pfdFail,
    mfd = on("AV2", "MFD") && !s.avx.mfdFail;
  const L = s.lights,
    warnPwr = on("XF", "WARN");
  const fuelPumpOn = s.fuel.pump && on("E1", "FUEL PUMP");
  return {
    ...N,
    pfd,
    mfd,
    ahrs: either("ADC AHRS") && !s.avx.ahrsFail,
    adc: either("ADC AHRS") && !s.avx.adcFail,
    // NAV 1 ENG feeds GIA 1's NAV side and the GEA 71; COMM 1 (GIA 1's COM side) is essential-bus only
    gia1,
    gia2,
    gea: gia1,
    com1: on("ESS", "COMM 1"),
    com2: on("AV2", "COMM 2"),
    audio: on("AV2", "AUDIO"),
    xpdr: on("AV2", "XPNDR"),
    kapPwr: on("AV2", "AUTO PILOT"),
    warnPwr,
    // starter relay: coil from MAGNETOS START through the WARN breaker; contacts on the battery side of the current shunt (Fig 7-7 Sh 1)
    starterPwr: s.elec.bat && warnPwr && (s.elec.ext || (!s.elec.fail.bat && s.elec.socMain > 0.08)),
    outlet12: L.cabinPwr && on("E1", "CABIN LTS/PWR"),
    fuelPumpOn,
    flapsPwr: on("E1", "FLAPS"),
    pitotHeating: s.pitot.heat && on("E2", "PITOT HEAT") && !s.pitot.heaterFail,
    fwdFan: on("AV1", "PFD"),
    mfdFan: on("AV2", "MFD"),
    aftFan: on("AV2", "NAV 2"),
    lit: {
      beacon: L.beacon && on("E1", "BCN LT"),
      land: L.land && on("E1", "LAND LT"),
      taxi: L.taxi && on("E2", "TAXI LT"),
      nav: L.nav && on("E2", "NAV LTS"),
      strobe: L.strobe && on("E2", "STROBE LTS"),
      // the overhead console is on CABIN LTS/PWR ("To overhead lights") — an inference, the POH names no breaker for it
      dome: L.dome && on("E1", "CABIN LTS/PWR"),
      flood: L.flood > 0 && on("E1", "CABIN LTS/PWR"),
      panel: (L.swcb > 0 || L.pedestal > 0) && on("E2", "PANEL LTS"),
      stbyInd: L.stbyInd > 0 && on("ESS", "STDBY IND LTS"),
      map: L.nav && on("E2", "NAV LTS"),
    },
    fuelOk: fuelOk(s),
    fuelPress: (s.eng.running || s.eng.mags === "START") && !s.eng.fail.edp ? true : fuelPumpOn,
  };
}

/* ---------- indications ---------- */
/** Fuel quantity indication: 0 at the 2.5 gal unusable level; the float travel ends at ≈ 35–36 gal, the top of the green arc (POH 7-40, 2-7). */
export const fuelInd = (usable: number) => Math.min(35.5, Math.max(0, usable));
export const oilPressSwitch = () => live.oilP <= 20;
/**
 * An engine limit in the red: RPM ≥ 2,472, oil pressure ≤ 20 or ≥ 115 PSI, oil temperature ≥ 245 °F or CHT ≥ 500 °F. When one
 * starts while the SYSTEM (or LEAN) page is shown, the EIS returns to the ENGINE page (POH 7-29 – 7-33); tick.ts flips the page as
 * the G1000 does, so the pilot can select SYSTEM again afterwards (e.g. on the ground with the engine stopped).
 */
export const eisExceedance = (E: Pick<Elec, "gea">) =>
  E.gea &&
  (Math.round(live.rpm / 10) * 10 >= 2472 ||
    live.oilP <= 20 ||
    live.oilP >= 115 ||
    live.oilT >= 245 ||
    live.cht >= 500);

/** The 182T annunciation window (POH 7-51 list, CRG 115–116 levels and tones), warnings first. */
export const C182T_ANN: Nav3AnnDef[] = [
  {
    text: "OIL PRESSURE",
    level: "w",
    tone: "Continuous",
    trigger: "Separate low oil pressure switch at 0–20 PSI — shown before start",
    cite: "POH 7-31",
  },
  {
    text: "LOW VOLTS",
    level: "w",
    tone: "Continuous (inhibited on the ground)",
    trigger: "ACU: main bus voltage in the J-box below 24.5 V",
    cite: "POH 7-54",
  },
  {
    text: "PITCH TRIM",
    level: "w",
    tone: "No",
    trigger:
      "KAP 140 pitch trim fault from the self-test or the continuous monitor; lit as a lamp check at the end of the self-test. Powered by WARN",
    cite: "S3-11, CRG 115",
  },
  {
    text: "HIGH VOLTS",
    level: "w",
    tone: "Continuous",
    trigger:
      "Main or essential bus above 32.0 V — the ACU's automatic alternator shutdown has failed (threshold from the 2007 edition)",
    cite: "POH 3-15; GFC 7-60",
  },
  {
    text: "CO LVL HIGH",
    level: "w",
    tone: "Continuous until the WARNING softkey",
    trigger: "CO detector (if installed) ≥ 50 PPM; flashes until acknowledged",
    cite: "POH 7-75",
  },
  {
    text: "LOW VACUUM",
    level: "c",
    tone: "Single",
    trigger: "Engine-driven pump vacuum below 3.5 in.Hg — shown with the engine stopped",
    cite: "POH 7-63",
  },
  {
    text: "LOW FUEL L",
    level: "c",
    tone: "Single",
    trigger: "Left tank < 8 gal indicated for more than 60 s",
    cite: "POH 7-41",
  },
  {
    text: "LOW FUEL R",
    level: "c",
    tone: "Single",
    trigger: "Right tank < 8 gal indicated for more than 60 s",
    cite: "POH 7-41",
  },
  {
    text: "STBY BATT",
    level: "c",
    tone: "Single",
    trigger:
      "Standby battery discharging more than 0.5 A for more than 10 s (trigger from the 2007 edition; the 2005 list prints “STBY BAT”)",
    cite: "POH 7-51; GFC 7-58",
  },
];

/** PITCH TRIM shows when the KAP 140 reports a trim fault (or its display test), and the WARN breaker powers the annunciator (S3-6). */
export const pitchTrimOn = (E: Pick<Elec, "warnPwr">) => E.warnPwr && kap140Pfd(live.kap, live.fs.t) != null;

/** G1000 annunciation window for this airplane. `withPitchTrim` false = leave PITCH TRIM out (the PFD draws it separately, top right). */
export function annunciations(s: Sim, E: Elec, withPitchTrim = true): [CasLevel, string][] {
  return nav3Annunciations(
    {
      oilPress: oilPressSwitch(),
      lowFuelL: s.ann.lowFuelL,
      lowFuelR: s.ann.lowFuelR,
      vac: live.vac,
      lowVolts: E.lowVolts,
      highVolts: E.highVolts,
      stbyBatt: s.ann.stbyBatt,
      co: live.coPpm >= 50,
      pitchTrim: withPitchTrim && pitchTrimOn(E),
    },
    C182T_ANN,
  );
}

/** Stall speed (KIAS, power off, wings level, 3,100 lb, most rearward CG — POH Figure 5-4) by flap angle; 10° interpolated. */
export const stallKias = (flapDeg: number) => (flapDeg < 5 ? 50 : flapDeg < 15 ? 47 : flapDeg < 29 ? 43 : 40);
