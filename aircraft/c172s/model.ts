/**
 * C172S NAV III sim state, the pure solver `solve(s) → E` (NAV III electrical network, powered loads,
 * engine/fuel availability) and the G1000 annunciations. Continuous values (RPM, temperatures, flap
 * angle, flight state, GFC 700 state) live in the mutable `live` object, advanced by tick.ts.
 *
 * Sources: POH/AFM 172SPHBUS-04 (serials 172S10468, 10507, 10640, 10656 and on — N6189Q is 172S10738),
 * Figure 7-7 Sheets 1–3 (electrical), Figure 7-6 (fuel), Section 2 limitations; G1000 CRG 190-00384-13.
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
import { GFC700_BASE, gfc700Init, type Gfc700Cfg } from "@/lib/avionics/gfc700";

export type Mags = "OFF" | "R" | "L" | "BOTH" | "START";
export type FuelSel = "BOTH" | "LEFT" | "RIGHT";
export type FlapCmd = 0 | 10 | 20 | 30;

export interface Sim {
  /** On the ramp (flight state frozen) or flying. */
  ground: boolean;
  eng: {
    running: boolean;
    mags: Mags;
    /** Engine RPM rounded to 50 (set by tick.ts from the tach value): sizes the alternator's low-RPM capacity in the solver. */
    rpm: number;
    /** Throttle 0 (IDLE, full out) … 1 (FULL, full in); mixture 0 (IDLE CUTOFF) … 1 (FULL RICH). */
    throttle: number;
    mix: number;
    /** Too much prime: won't start until cleared (POH 4-12 flooded start). */
    flooded: boolean;
    /** Induction filter blocked (ice/dust): alternate air door opens, ~10% power loss at full throttle (POH 7-36). */
    filter: boolean;
    fail: { edp: boolean; magL: boolean; magR: boolean; oil: boolean };
  };
  elec: Nav3Elec;
  /** Time compression for battery endurance (1 = real time). */
  warp: number;
  fuel: {
    sel: FuelSel;
    /** FUEL SHUTOFF valve ON (pushed in). */ shutoff: boolean;
    pump: boolean;
    /** Usable gallons per tank (26.5 max). */ qL: number;
    qR: number;
  };
  flaps: { cmd: FlapCmd; moving: boolean };
  /** Pilot's control wheel and rudder pedals, −1 … 1 (pitch + = pull). */
  ctrl: { pitch: number; roll: number; yaw: number };
  /** Differential toe braking −1 (left) … 1 (right), parking brake. */
  gear: { diff: number; park: boolean };
  lights: {
    beacon: boolean;
    land: boolean;
    taxi: boolean;
    nav: boolean;
    strobe: boolean;
    cabinPwr: boolean;
    /** Overhead push button: rear dome + under-wing courtesy lights. */
    dome: boolean;
    /** Overhead FLOOD LIGHT knobs and the DIMMING knobs (0 = off). */
    flood: number;
    swcb: number;
    pedestal: number;
    avionics: number;
    stbyInd: number;
  };
  /** CABIN HT and CABIN AIR knobs (0 = pushed in/off … 1 = pulled full out), defroster slides, cabin vents.
   *  coAck: CO LVL HIGH acknowledged with the WARNING softkey (it flashes until then, POH 7-80); cleared by tick.ts below 50 PPM. */
  env: { heat: number; air: number; defrost: number; vents: boolean; coLeak: boolean; coAck: boolean };
  pitot: {
    heat: boolean;
    heaterFail: boolean;
    altStatic: boolean;
    staticBlocked: boolean;
    pitotBlocked: boolean;
    oat: number;
  };
  stall: { inletBlocked: boolean };
  vac: { fail: boolean };
  avx: { backup: boolean; pfdFail: boolean; mfdFail: boolean; ahrsFail: boolean; adcFail: boolean };
  /** Latched annunciation timers (set by tick.ts): LOW FUEL needs 60 s, STBY BATT 10 s. */
  ann: { lowFuelL: boolean; lowFuelR: boolean; stbyBatt: boolean };
  cabin: { doorL: boolean; doorR: boolean; bag: boolean; lock: boolean; elt: "ARM" | "ON" | "TEST" };
}

export const initialSim: Sim = {
  ground: false,
  eng: {
    running: true,
    mags: "BOTH",
    rpm: 2400,
    throttle: 0.86,
    mix: 0.82,
    flooded: false,
    filter: false,
    fail: { edp: false, magL: false, magR: false, oil: false },
  },
  elec: nav3Init(),
  warp: 1,
  fuel: { sel: "BOTH", shutoff: true, pump: false, qL: 20, qR: 19 },
  flaps: { cmd: 0, moving: false },
  ctrl: { pitch: 0, roll: 0, yaw: 0 },
  gear: { diff: 0, park: false },
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
  env: { heat: 0.2, air: 0.5, defrost: 0.5, vents: true, coLeak: false, coAck: false },
  pitot: { heat: false, heaterFail: false, altStatic: false, staticBlocked: false, pitotBlocked: false, oat: 8 },
  stall: { inletBlocked: false },
  vac: { fail: false },
  avx: { backup: false, pfdFail: false, mfdFail: false, ahrsFail: false, adcFail: false },
  ann: { lowFuelL: false, lowFuelR: false, stbyBatt: false },
  cabin: { doorL: false, doorR: false, bag: false, lock: false, elt: "ARM" },
};

/* ---------- flight model and autopilot configuration ---------- */
/** Teaching flight model for the 172S: 110 KIAS at 75% power, ~730 fpm at Vy 74 KIAS with full power. */
export const C172_FLIGHT: FlightCfg = { ...FLIGHT_DEFAULT, v0: 50, vp: 80, fpmPerKt: 13, vMin: 40, maxBank: 30 };
/**
 * GFC 700 configuration: keys on both the PFD and MFD bezels including BC, A/P TRIM DISC and MET on the pilot's wheel.
 * The 172S documents give only the 70–150 KIAS engagement limits (POH 2-21), so FLC references stop at 150 KIAS; there is no
 * autopilot maximum operating speed, so the overspeed protection (MAXSPD) is not modelled (GFC700_BASE leaves `vmo` open).
 * Bank limit, GA pitch and the NOSE UP/DN reference ranges are the CRG values (NOT IN DOCS for the 172S).
 * FLC solves for speed with the 172S flight model.
 */
export const AFCS_CFG: Gfc700Cfg = {
  ...GFC700_BASE,
  flcMax: 150,
  discLabel: "A/P TRIM DISC",
  trimLabel: "MET",
  flight: C172_FLIGHT,
};

/** Fast-changing values advanced every frame; kept out of React state on purpose. */
export const live = {
  rpm: 2400,
  oilP: 74,
  oilT: 186,
  cht: 372,
  egt: 1360,
  ff: 9.0,
  vac: 5.0,
  /** Standby attitude gyro rotor speed 0..1 and its drift (deg). */
  gyro: 1,
  drift: 0,
  flapAng: 0,
  /** Fuel in the cylinders from priming (0 dry … >1.8 flooded) and engine warmth 0..1. */
  wet: 0,
  hot: 1,
  crankT: 0,
  crankTotal: 0,
  starve: 0,
  primeRun: 0,
  restartT: 0,
  fs: initFlight({ ias: 110, alt: 4500, selAlt: 4500, hdg: 90, hdgBug: 90, crs: 90, power: 0.75, oat: 8 }),
  afcs: gfc700Init(),
  /** Effective control positions (pilot or servos) used by the surfaces, yokes and cables. */
  ctl: { pitch: 0, roll: 0, yaw: 0 },
  timers: { lowL: 0, lowR: 0, stby: 0 },
  burnL: 0,
  burnR: 0,
  /** Battery state of charge integrated every frame (fractional), and the store values last seen / pushed. */
  soc: { m: 0.92, s: 1, pm: 0.92, ps: 1 },
  /** Hobbs meter (oil pressure > 20 PSI and WARN breaker power) and the separate EIS ENG HRS counter (GEA 71 powered, engine running). */
  hobbs: 3304.6,
  engHrs: 3304.6,
  coPpm: 0,
  horn: false,
  stallDemo: false,
  /** The AUTO PILOT breaker / servo power was lost and the GFC 700 shows AFCS; `sysUser` keeps the pilot-selected AFCS failure. */
  servoLost: false,
  sysUser: false,
  /** Altitude frozen in the static system when the static port blocks. */
  staticAlt: null as number | null,
  /** STBY BATT TEST held (s). */
  testHeld: 0,
};

/* ---------- breakers: POH Figure 7-7 Sheet 2 (rev -04), N6189Q configuration (no STBY ADI: s/n 12701+) ---------- */
/** Ratings read off a photo of another 172S NAV III breaker panel (Wikimedia Commons, “C172S G1000 in flight”): not in the POH and not verified for N6189Q. */
const PHOTO =
  "read from a photo of another 172S NAV III breaker panel (Wikimedia Commons) — not in the POH, unverified for N6189Q";
export const BREAKERS: Breaker[] = [
  { bus: "E1", label: "FUEL PUMP", amps: 5, src: PHOTO, unverified: true, feeds: "To aux fuel pump" },
  { bus: "E1", label: "BCN LT", amps: 5, src: PHOTO, unverified: true, feeds: "To flashing beacon" },
  { bus: "E1", label: "LAND LT", amps: 10, src: PHOTO, unverified: true, feeds: "To landing light" },
  {
    bus: "E1",
    label: "CABIN LTS/PWR",
    amps: 5,
    src: PHOTO,
    unverified: true,
    feeds: "To overhead lights, to 12V cabin power",
  },
  {
    bus: "E1",
    label: "FLAPS",
    amps: 10,
    src: "from POH 7-23 (“10-ampere circuit breaker, labeled FLAP”)",
    feeds: "To flaps",
  },
  { bus: "E1", label: "AVN 1", feeds: "AVIONICS BUS 1 via the AVIONICS switch (BUS 1)" },
  {
    bus: "XF",
    label: "ALT FIELD",
    amps: 5,
    src: PHOTO,
    unverified: true,
    feeds: "To alt master switch (opened automatically by the ACU)",
  },
  {
    bus: "XF",
    label: "WARN",
    amps: 5,
    src: PHOTO,
    unverified: true,
    feeds:
      "To stall warning, autopilot warning, ELT warning, main bus voltmeter, hourmeter, starter relay, stdby battery, and main bus sense",
  },
  { bus: "ESS", label: "PFD", feeds: "To primary flight display" },
  { bus: "ESS", label: "ADC AHRS", feeds: "To air data computer, to attitude heading reference system" },
  { bus: "ESS", label: "NAV 1 ENG", feeds: "To navigation #1, engine/airframe unit, and essential bus voltmeter" },
  { bus: "ESS", label: "COMM 1", amps: 5, src: PHOTO, unverified: true, feeds: "To VHF communication #1" },
  { bus: "ESS", label: "STDBY IND LTS", amps: 5, src: PHOTO, unverified: true, feeds: "To standby indicator lights" },
  {
    bus: "ESS",
    label: "STDBY BATT",
    amps: 20,
    src: PHOTO,
    unverified: true,
    feeds: "To and from standby battery system",
  },
  { bus: "E2", label: "AVN 2", feeds: "AVIONICS BUS 2 via the AVIONICS switch (BUS 2)" },
  {
    bus: "E2",
    label: "PITOT HEAT",
    amps: 10,
    src: "from the KAP 140 edition POH 172SPHAUS 7-59 (rev -04 gives no rating)",
    feeds: "To pitot heat",
  },
  { bus: "E2", label: "NAV LTS", feeds: "To NAV and control wheel map lights" },
  { bus: "E2", label: "TAXI LT", feeds: "To taxi light" },
  { bus: "E2", label: "STROBE LTS", feeds: "To wing strobe lights" },
  { bus: "E2", label: "PANEL LTS", feeds: "To panel lights" },
  { bus: "AV1", label: "PFD", feeds: "To primary flight display, to deckskin and PFD cooling fans" },
  { bus: "AV1", label: "ADC AHRS", feeds: "To air data computer and attitude heading reference system" },
  { bus: "AV1", label: "NAV 1 ENG", feeds: "To navigation #1 and engine/airframe unit" },
  { bus: "AV1", label: "FIS", feeds: "To flight information system (if installed)" },
  {
    bus: "AV1",
    label: "ADF DME",
    amps: 5,
    src: PHOTO,
    unverified: true,
    feeds: "To automatic direction finder, distance measure equipment (if installed)",
  },
  { bus: "AV2", label: "MFD", feeds: "To multi-function display and MFD fan" },
  { bus: "AV2", label: "XPNDR", feeds: "To transponder" },
  { bus: "AV2", label: "NAV 2", feeds: "To navigation #2 and aft avionics cooling fan" },
  { bus: "AV2", label: "COMM 2", feeds: "To VHF communication #2" },
  { bus: "AV2", label: "AUDIO", feeds: "To audio panel" },
  { bus: "AV2", label: "AUTO PILOT", feeds: "To autopilot system (GFC 700 servos and trim)" },
];
/** Main battery 24 V 8.0 Ah (POH 6-19; the KAP 140 edition lists 12.75 Ah). Standby capacity is not given; sized so a ~3.5 A essential load lasts well over the POH's "at least 30 minutes". */
export const ELEC_CFG: Nav3Cfg = { altAmps: 60, mainAh: 8, stbyAh: 2.4, breakers: BREAKERS };

/* ---------- engine helpers (pure) ---------- */
/** Engine RPM for the alternator's low-RPM capacity: the tach value (rounded to 50 RPM by tick.ts), so cranking, idle and a windmilling engine all count. */
export const rpmEstimate = (s: Sim) => s.eng.rpm;
/** Relative fuel/air (λ ≈ 1 at peak EGT): full rich gets richer with altitude. */
export const lambda = (mix: number, alt: number) => mix * 1.22 * (1 + Math.max(0, alt) / 25000);
/** Power multiplier from mixture: best power ~λ 1.12 (≈ 100 °F rich of peak). */
export function mixPower(l: number) {
  if (l < 0.5) return 0;
  const p09 = 1 - 0.55 * (0.9 - 1.12) ** 2;
  return l < 0.9 ? p09 * ((l - 0.5) / 0.4) : 1 - 0.55 * (l - 1.12) ** 2;
}
export const densityFactor = (alt: number) => Math.max(0.55, 1 - Math.max(0, alt) / 30000);
/** Fraction of rated power (180 BHP) the engine makes. */
export function enginePower(s: Sim, alt: number) {
  const g = s.eng;
  const air = Math.max(0.025, Math.pow(g.throttle, 0.85)) * densityFactor(alt);
  const magOk = (m: "L" | "R") => !(m === "L" ? g.fail.magL : g.fail.magR);
  const magsLive =
    g.mags === "BOTH" || g.mags === "START"
      ? (magOk("L") ? 1 : 0) + (magOk("R") ? 1 : 0)
      : g.mags === "L"
        ? magOk("L")
          ? 1
          : 0
        : g.mags === "R"
          ? magOk("R")
            ? 1
            : 0
          : 0;
  const magF = magsLive === 2 ? 1 : magsLive === 1 ? 0.88 : 0; // single magneto: ~50–150 RPM drop at 1,800 (limit 175, POH 4-16)
  const filterF = g.filter ? 1 - 0.1 * g.throttle : 1;
  return Math.min(1, air * mixPower(lambda(g.mix, alt)) * magF * filterF);
}
/** Fixed-pitch propeller: static RPM ∝ ∛power (2,300–2,400 static at full throttle, ~675 idle — POH 2-6, 4-30), plus windmilling with airspeed. */
export const rpmFor = (P: number, ias: number) => 2350 * Math.cbrt(Math.max(P, 0)) + 3.76 * Math.max(0, ias);
export const fuelFlowGph = (s: Sim, alt: number) => {
  const air = Math.max(0.025, Math.pow(s.eng.throttle, 0.85)) * densityFactor(alt);
  return 0.6 + 11.5 * air * lambda(s.eng.mix, alt);
};

/* ---------- solver ---------- */
export interface Elec extends Nav3Solution {
  pfd: boolean;
  mfd: boolean;
  ahrs: boolean;
  adc: boolean;
  gia1: boolean;
  gia2: boolean;
  audio: boolean;
  xpdr: boolean;
  afcsPwr: boolean;
  starterPwr: boolean;
  fuelPumpOn: boolean;
  flapsPwr: boolean;
  pitotHeating: boolean;
  fwdFan: boolean;
  aftFan: boolean;
  /** GFC 700 flight director (runs in GIA 1, shown on the PFD) and the servo / trim power (AUTO PILOT breaker, AVIONICS BUS 2). */
  fdPwr: boolean;
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
  /** Fuel can reach the engine from the selected tank(s) with the shutoff ON. */
  fuelOk: boolean;
  /** Engine-driven or aux pump pressure available (engine turning or FUEL PUMP running). */
  fuelPress: boolean;
}

export function breakerLoads(s: Sim): Record<string, number> {
  const L = s.lights,
    k = (bus: string, label: string) => `${bus}:${label}`,
    out = (key: string) => !!s.elec.cb[key];
  return {
    [k("E1", "FUEL PUMP")]: s.fuel.pump ? 2.0 : 0,
    [k("E1", "BCN LT")]: L.beacon ? 1.4 : 0,
    [k("E1", "LAND LT")]: L.land ? 3.6 : 0,
    [k("E1", "CABIN LTS/PWR")]: (L.dome ? 0.5 : 0) + L.flood * 0.4 + (L.cabinPwr ? 1.5 : 0),
    [k("E1", "FLAPS")]: s.flaps.moving ? 8.0 : 0,
    [k("XF", "ALT FIELD")]: s.elec.alt ? 2.5 : 0,
    [k("XF", "WARN")]: 0.3,
    [k("ESS", "PFD")]: 2.2,
    [k("ESS", "ADC AHRS")]: 0.5,
    [k("ESS", "NAV 1 ENG")]: 0.8,
    [k("ESS", "COMM 1")]: 0.5,
    [k("ESS", "STDBY IND LTS")]: L.stbyInd > 0 ? 0.1 : 0,
    [k("E2", "PITOT HEAT")]: s.pitot.heat && !s.pitot.heaterFail ? 6.5 : 0,
    [k("E2", "NAV LTS")]: L.nav ? 1.4 : 0,
    [k("E2", "TAXI LT")]: L.taxi ? 3.6 : 0,
    [k("E2", "STROBE LTS")]: L.strobe ? 2.0 : 0,
    [k("E2", "PANEL LTS")]: (L.swcb + L.pedestal) * 0.25,
    // dual-fed units draw from the essential bus unless its breaker is out
    [k("AV1", "PFD")]: 0.6 + (out(k("ESS", "PFD")) ? 2.2 : 0),
    [k("AV1", "ADC AHRS")]: out(k("ESS", "ADC AHRS")) ? 0.5 : 0,
    [k("AV1", "NAV 1 ENG")]: out(k("ESS", "NAV 1 ENG")) ? 0.8 : 0,
    [k("AV1", "FIS")]: 0.4,
    [k("AV1", "ADF DME")]: 0.6,
    [k("AV2", "MFD")]: 2.4,
    [k("AV2", "XPNDR")]: 1.2,
    [k("AV2", "NAV 2")]: 1.3,
    [k("AV2", "COMM 2")]: 0.5,
    [k("AV2", "AUDIO")]: 0.8,
    [k("AV2", "AUTO PILOT")]: 1.2,
  };
}

export const tankHas = (s: Sim, side: "L" | "R") => (side === "L" ? s.fuel.qL : s.fuel.qR) > 0.02;
export function fuelOk(s: Sim) {
  const f = s.fuel;
  if (!f.shutoff) return false;
  return f.sel === "BOTH" ? tankHas(s, "L") || tankHas(s, "R") : tankHas(s, f.sel === "LEFT" ? "L" : "R");
}

export function solve(s: Sim, prev?: Elec): Elec {
  const N = solveNav3(s.elec, ELEC_CFG, breakerLoads(s), rpmEstimate(s), prev?.altOn);
  const on = (bus: string, label: string) => !!N.on[`${bus}:${label}`];
  const either = (label: string) => on("ESS", label) || on("AV1", label);
  const gia1 = either("NAV 1 ENG"),
    gia2 = on("AV2", "NAV 2");
  const pfd = either("PFD") && !s.avx.pfdFail,
    mfd = on("AV2", "MFD") && !s.avx.mfdFail;
  const L = s.lights;
  const fuelPumpOn = s.fuel.pump && on("E1", "FUEL PUMP");
  return {
    ...N,
    pfd,
    mfd,
    ahrs: either("ADC AHRS") && !s.avx.ahrsFail,
    adc: either("ADC AHRS") && !s.avx.adcFail,
    gia1,
    gia2,
    audio: on("AV2", "AUDIO"),
    xpdr: on("AV2", "XPNDR"),
    // Figure 7-10: all three servos take power from the AUTO PILOT breaker; the flight director is computed in the GIAs
    afcsPwr: on("AV2", "AUTO PILOT") && gia1 && gia2,
    fdPwr: gia1 && pfd,
    // starter relay: coil from MAGNETOS START through the WARN breaker; its contacts are fed from the bus side of the battery
    // relay (between the master contactor and the M BATT shunt, Fig 7-7 Sheet 1), so ground power cranks with MASTER BAT on
    starterPwr: s.elec.bat && on("XF", "WARN") && (s.elec.ext || (!s.elec.fail.bat && s.elec.socMain > 0.08)),
    outlet12: L.cabinPwr && on("E1", "CABIN LTS/PWR"),
    fuelPumpOn,
    flapsPwr: on("E1", "FLAPS"),
    pitotHeating: s.pitot.heat && on("E2", "PITOT HEAT") && !s.pitot.heaterFail,
    fwdFan: on("AV1", "PFD"),
    aftFan: on("AV2", "NAV 2"),
    lit: {
      beacon: L.beacon && on("E1", "BCN LT"),
      land: L.land && on("E1", "LAND LT"),
      taxi: L.taxi && on("E2", "TAXI LT"),
      nav: L.nav && on("E2", "NAV LTS"),
      strobe: L.strobe && on("E2", "STROBE LTS"),
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
/** Fuel quantity indication: 0 at the unusable level, sensor range ends at ~24 gal (POH 7-39). */
export const fuelInd = (usable: number) => Math.min(24, Math.max(0, usable));
export const oilPressSwitch = () => live.oilP <= 20;

/** The 172S annunciation set with exact text, level, aural and trigger (POH 7-51; levels and tones CRG 190-00384-13 pp. 115–116). */
export const C172S_ANN: Nav3AnnDef[] = [
  {
    text: "OIL PRESSURE",
    level: "w",
    tone: "Continuous",
    trigger: "Low oil pressure switch: 0–20 PSI (shown with the engine stopped)",
    cite: "POH 7-33",
  },
  {
    text: "LOW VOLTS",
    level: "w",
    tone: "Continuous (inhibited on the ground)",
    trigger: "ACU: main bus voltage in the power distribution module below 24.5 V",
    cite: "POH 7-55",
  },
  {
    text: "HIGH VOLTS",
    level: "w",
    tone: "Continuous",
    trigger: "Main or essential bus above 32.0 V (ACU automatic shutdown not working)",
    cite: "POH 7-56",
  },
  {
    text: "CO LVL HIGH",
    level: "w",
    tone: "Continuous until the WARNING softkey",
    trigger: "CO ≥ 50 PPM; flashes until acknowledged, steady until below 50 PPM",
    cite: "POH 7-80",
  },
  {
    text: "LOW FUEL L",
    level: "c",
    tone: "Single",
    trigger: "Left tank < 5 gal indicated for more than 60 s",
    cite: "POH 7-40",
  },
  {
    text: "LOW FUEL R",
    level: "c",
    tone: "Single",
    trigger: "Right tank < 5 gal indicated for more than 60 s",
    cite: "POH 7-40",
  },
  {
    text: "LOW VACUUM",
    level: "c",
    tone: "Single",
    trigger: "Engine-driven pump vacuum below 3.5 in.Hg (shown with the engine stopped)",
    cite: "POH 7-65",
  },
  {
    text: "STBY BATT",
    level: "c",
    tone: "Single",
    trigger: "Standby battery discharging more than 0.5 A for more than 10 s",
    cite: "POH 7-54",
  },
];

/** G1000 annunciation window (POH 7-51) for this airplane. Needs a powered display. */
export function annunciations(s: Sim, E: Elec): [CasLevel, string][] {
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
    },
    C172S_ANN,
  );
}

/** Stall speed (KIAS, power idle, wings level, 2550 lb, most rearward CG — POH Figure 5-3) by flap angle. */
export const stallKias = (flapDeg: number) => (flapDeg < 5 ? 48 : flapDeg < 15 ? 42 : flapDeg < 25 ? 41 : 40);
