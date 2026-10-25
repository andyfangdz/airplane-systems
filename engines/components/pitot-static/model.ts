/**
 * The pitot-static system as pure functions of the spec and a mutable state.
 *
 * Three lumped air volumes: the pitot side (pitot chamber, line and the ASI's diaphragm), the static side (static
 * line, ASI and altimeter cases, the VSI's diaphragm and the encoder) and the VSI's case. Restrictions join them to
 * the pressures around the airplane: the ram inlet to total pressure, the drain hole to outside air, the static port to
 * the pressure at the fuselage side, the ALT STATIC AIR selector to the cabin, the VSI's calibrated leak from the
 * static side to its case, and any leaks or a broken VSI glass to the cabin. Each volume's pressure moves toward the
 * pressures it is open to, as fast as its restrictions let air through (PHAK pp. 8-2 to 8-11).
 *
 * The instruments read those volumes the way the handbooks describe: the ASI the difference between its diaphragm and
 * its case, calibrated to the standard sea-level atmosphere; the altimeter the static side's pressure against the
 * standard atmosphere from the barometric scale's setting; the VSI the difference between its diaphragm and its
 * lagging case; the encoder the static pressure from 29.92 inHg.
 *
 * With the G1000 (the NAV III panel) there is no VSI case or encoder: the air data computer reads the same two
 * volumes and gives the PFD airspeed, true airspeed, altitude from the BARO setting and vertical speed from the rate
 * its pressure altitude changes, and the standby airspeed indicator and altimeter share its lines (POH p. 7-12).
 *
 * The airplane flies a commanded airspeed and altitude in an atmosphere set by the sea-level pressure and its
 * deviation from standard temperature. The static port and the cabin see the free-stream pressure plus a position
 * error taken from the 172S POH's airspeed calibration (Figure 5-1): the whole of each sheet's KIAS–KCAS difference is
 * put on the static source, so a healthy system reads exactly the POH's KIAS. See the spec for which numbers are
 * published and which are model constants.
 */
import { GAMMA, INHG_PA, KT_MS, R_AIR } from "@/engines/model/atmosphere";
import type { Calibration, Flaps, PitotStaticSpec } from "./spec";

const G0 = 9.80665;
/** Standard lapse rate (K/m), sea-level temperature (K) and pressure (Pa). */
const LAPSE = 0.0065;
const T0 = 288.15;
export const P0 = 101325;
const EXP = G0 / (R_AIR * LAPSE);
const FT = 0.3048;
/** Speed of sound at sea level, standard day, kt. */
const A0 = Math.sqrt(GAMMA * R_AIR * T0) / KT_MS;
const FPM = 60 / FT;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- atmosphere and air data

export interface Weather {
  /** Sea-level pressure (what a correct altimeter setting is), inHg. */
  qnh: number;
  /** Deviation from standard temperature, °C (the same at every altitude). */
  isaDev: number;
  /** In cloud or precipitation: visible moisture. */
  moisture: boolean;
}

export interface Air {
  /** Static pressure, Pa. */
  p: number;
  /** Temperature, K, and outside air temperature, °C. */
  T: number;
  oat: number;
  /** Density, kg/m³. */
  rho: number;
}

/** The air at a true altitude (ft): a standard lapse rate from the sea-level pressure and temperature. */
export function ambient(hFt: number, w: Weather): Air {
  const Tsl = T0 + w.isaDev;
  const T = Tsl - LAPSE * hFt * FT;
  const p = w.qnh * INHG_PA * Math.pow(T / Tsl, EXP);
  return { p, T, oat: T - 273.15, rho: p / (R_AIR * T) };
}

/** What a standard altimeter set to `settingInHg` reads at static pressure `p` (Pa), ft. */
export const altitudeFor = (p: number, settingInHg: number) =>
  ((T0 / LAPSE) * (1 - Math.pow(Math.max(p, 1) / (settingInHg * INHG_PA), 1 / EXP))) / FT;

/** Pressure altitude (ft): the altimeter at 29.92 inHg. */
export const pressureAltitude = (p: number) => altitudeFor(p, P0 / INHG_PA);

/** Static pressure (Pa) at a pressure altitude (ft). */
export const pressureAt = (pa: number) => P0 * Math.pow(1 - (LAPSE * pa * FT) / T0, EXP);

/** Standard-atmosphere density at a static pressure: what the VSI is calibrated for. */
const rhoStd = (p: number) => p / (R_AIR * (T0 - LAPSE * pressureAltitude(p) * FT));

/** Impact pressure (Pa) at a calibrated airspeed (kt): the ASI's sea-level standard calibration, subsonic. */
export const qcFromCas = (kt: number) => P0 * (Math.pow(1 + 0.2 * (Math.max(kt, 0) / A0) ** 2, 3.5) - 1);

/** Calibrated airspeed (kt) for an impact pressure (Pa); none below zero. */
export const casFromQc = (qc: number) => (qc > 0 ? A0 * Math.sqrt(5 * (Math.pow(qc / P0 + 1, 2 / 7) - 1)) : 0);

/** True airspeed (kt) from calibrated airspeed in the air at `a`. */
export function tasFromCas(kt: number, a: Air) {
  const m = Math.sqrt(5 * (Math.pow(qcFromCas(kt) / a.p + 1, 2 / 7) - 1));
  return (m * Math.sqrt(GAMMA * R_AIR * a.T)) / KT_MS;
}

// ---------------------------------------------------------------- the POH's airspeed calibration

/** KCAS for a KIAS on one sheet of Figure 5-1, interpolated (and held at the ends' offset beyond them). */
export function toKcas(cal: Calibration, kias: number) {
  return interp(
    cal.map((r) => r[0]),
    cal.map((r) => r[1]),
    kias,
  );
}

/** KIAS for a KCAS on one sheet of Figure 5-1. */
export function toKias(cal: Calibration, kcas: number) {
  return interp(
    cal.map((r) => r[1]),
    cal.map((r) => r[0]),
    kcas,
  );
}

function interp(xs: number[], ys: number[], x: number) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0] + (x - xs[0]);
  if (x >= xs[n - 1]) return ys[n - 1] + (x - xs[n - 1]);
  let i = 1;
  while (xs[i] < x) i++;
  const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + f * (ys[i] - ys[i - 1]);
}

/**
 * Static-source pressure coefficient for a KCAS: the fraction of impact pressure the source reads above free-stream
 * static, so that a perfect ASI reads the sheet's KIAS. Interpolated in KCAS between the sheet's rows and held beyond.
 */
export function sourceCp(cal: Calibration, kcas: number) {
  const cps = cal.map(([kias, cas]) => 1 - qcFromCas(kias) / qcFromCas(cas));
  const cas = cal.map((r) => r[1]);
  if (kcas <= cas[0]) return cps[0];
  if (kcas >= cas[cas.length - 1]) return cps[cps.length - 1];
  let i = 1;
  while (cas[i] < kcas) i++;
  const f = (kcas - cas[i - 1]) / (cas[i] - cas[i - 1]);
  return cps[i - 1] + f * (cps[i] - cps[i - 1]);
}

// ---------------------------------------------------------------- inputs

export interface Controls {
  /** Calibrated airspeed the airplane flies, kt. */
  kcas: number;
  /** Altitude it climbs or descends to, ft MSL (true altitude). */
  alt: number;
  /** Rate it climbs or descends at, fpm. */
  rate: number;
  flaps: Flaps;
  /** Sideslip, degrees: + with the relative wind from the left (the left side windward). */
  slip: number;
}

/**
 * The panel: conventional instruments ("six-pack"), or the NAV III's G1000, whose air data computer feeds the PFD, with
 * the standby airspeed indicator and altimeter on the same pitot and static lines.
 */
export type Avionics = "six-pack" | "g1000";

export interface Cockpit {
  pitotHeat: boolean;
  /** ALT STATIC AIR valve pulled ON. */
  altStatic: boolean;
  /** Cabin vents or a window open. */
  ventsOpen: boolean;
  /** CABIN HT and CABIN AIR pulled ON. */
  heatAir: boolean;
  /** Barometric scale (Kollsman window) of the altimeter, the G1000's standby altimeter included, inHg. */
  kollsman: number;
  /** G1000: the PFD's barometric setting (BARO knob), inHg. */
  baro: number;
}

export type Ports = "single" | "paired";
export type Leak = "none" | "seep" | "cracked" | "disconnected";

export interface Failures {
  /** Pitot ram inlet blocked (insects, debris; ice is modelled separately). */
  ram: boolean;
  /** Pitot drain hole blocked. */
  drain: boolean;
  /** Static port blocked: the 172S's one port, or the left of a pair. */
  portL: boolean;
  /** The right port of a pair blocked. */
  portR: boolean;
  /** Water in the static line (freezes at or below 0 °C). */
  water: boolean;
  /** Pitot heater element open. */
  heater: boolean;
  /** Static system leak into the cabin. */
  leak: Leak;
  /** Pitot line leak into the cabin. */
  pitotLeak: boolean;
  /** VSI glass broken: its case open to the cabin (six-pack only). */
  vsiGlass: boolean;
  /** G1000: the air data computer has failed, or its circuit breaker is open. */
  adc: boolean;
}

export type Mode = "flight" | "test";

/** A pitot-static test set on the ramp: adapters over the pitot head and the static port. */
export interface TestSet {
  /** Altitude above the field it takes the static side to, ft. */
  alt: number;
  /** Airspeed it puts on the pitot side, kt. */
  kt: number;
  /** Its valves closed: the system sealed. */
  sealed: boolean;
}

export interface Inputs {
  mode: Mode;
  avionics: Avionics;
  controls: Controls;
  cockpit: Cockpit;
  weather: Weather;
  ports: Ports;
  failures: Failures;
  test: TestSet;
}

export const defaultControls = (): Controls => ({ kcas: 110, alt: 5500, rate: 700, flaps: "up", slip: 0 });
export const defaultCockpit = (): Cockpit => ({
  pitotHeat: false,
  altStatic: false,
  ventsOpen: false,
  heatAir: false,
  kollsman: 29.92,
  baro: 29.92,
});
export const defaultWeather = (): Weather => ({ qnh: 29.92, isaDev: 0, moisture: false });
export const noFailures = (): Failures => ({
  ram: false,
  drain: false,
  portL: false,
  portR: false,
  water: false,
  heater: false,
  leak: "none",
  pitotLeak: false,
  vsiGlass: false,
  adc: false,
});
export const defaultTest = (): TestSet => ({ alt: 0, kt: 0, sealed: false });

export const defaultInputs = (): Inputs => ({
  mode: "flight",
  avionics: "six-pack",
  controls: defaultControls(),
  cockpit: defaultCockpit(),
  weather: defaultWeather(),
  ports: "single",
  failures: noFailures(),
  test: defaultTest(),
});

// ---------------------------------------------------------------- state

export interface History {
  t: number[];
  kcas: number[];
  ias: number[];
  h: number[];
  alt: number[];
  vs: number[];
  vsi: number[];
}

/** Air flowing into the system's volumes (+) or out (−) through each opening, Pa/s of the volume it feeds. */
export interface Flows {
  ram: number;
  drain: number;
  pitotLeak: number;
  portL: number;
  portR: number;
  alt: number;
  leak: number;
  /** Through the VSI's calibrated leak, into its case. */
  vsi: number;
  /** Through the broken VSI glass, into the case. */
  glass: number;
  testPitot: number;
  testStatic: number;
}

/** G1000: what the air data computer gives the PFD. */
export interface Pfd {
  /** Its data is valid: a G1000 panel with the ADC working (no red X). */
  valid: boolean;
  ias: number;
  tas: number;
  alt: number;
  vs: number;
  /** Airspeed six seconds ahead at the present acceleration, less now (kt): the trend vector. */
  iasTrend: number;
  /** The pressure altitude it last sensed, ft (its vertical speed is the rate this changes). */
  pa: number;
}

export interface LeakTest {
  /** When the system was sealed, s; null while open. */
  t0: number | null;
  /** Altimeter and ASI when sealed. */
  alt0: number;
  ias0: number;
  /** When sealed: the test set's altitude above the field, and how far above it the static side had got, ft. */
  testFt: number;
  staticFt: number;
  /** Change since sealed: altitude lost (ft), airspeed lost (kt). */
  altLoss: number;
  iasLoss: number;
  /** The minute is up. */
  done: boolean;
}

export interface PSState {
  t: number;
  // ---- the airplane
  /** True altitude, ft MSL. */
  h: number;
  /** Vertical speed, fpm. */
  vs: number;
  kcas: number;
  ktas: number;
  /** Outside air temperature, °C. */
  oat: number;
  /** Pressure altitude, ft. */
  pa: number;
  // ---- pressures around the airplane, Pa
  pInf: number;
  /** Total pressure at the pitot inlet. */
  pt: number;
  /** At each static port, in the cabin. */
  portL: number;
  portR: number;
  cabin: number;
  // ---- inside the system, Pa
  pitot: number;
  stat: number;
  vsiCase: number;
  // ---- the pitot head
  /** Heater warmth, 0 (cold) … 1 (fully warm). */
  heat: number;
  /** Pitot head temperature, °C. */
  headC: number;
  /** Ice closing the ram inlet and the drain hole, 0 … 1. */
  iceRam: number;
  iceDrain: number;
  /** Ice in the static line's water, 0 … 1. */
  waterIce: number;
  // ---- the instruments
  ias: number;
  alt: number;
  vsi: number;
  /** Encoder output: pressure altitude in 100-ft steps. */
  modeC: number;
  /** The VSI needle is on a stop. */
  vsiPegged: boolean;
  /** G1000: the PFD's air data. */
  pfd: Pfd;
  flows: Flows;
  // ---- the ramp test set
  testAlt: number;
  testKt: number;
  leakTest: LeakTest;
  hist: History;
}

const noFlows = (): Flows => ({
  ram: 0,
  drain: 0,
  pitotLeak: 0,
  portL: 0,
  portR: 0,
  alt: 0,
  leak: 0,
  vsi: 0,
  glass: 0,
  testPitot: 0,
  testStatic: 0,
});

const emptyHistory = (): History => ({ t: [], kcas: [], ias: [], h: [], alt: [], vs: [], vsi: [] });

const noLeakTest = (): LeakTest => ({
  t0: null,
  alt0: 0,
  ias0: 0,
  testFt: 0,
  staticFt: 0,
  altLoss: 0,
  iasLoss: 0,
  done: false,
});

/** Seconds of history kept for the charts, and how often it is sampled. */
export const HIST_S = 60;
const HIST_DT = 0.2;

// ---------------------------------------------------------------- the sources around the system

export interface Sources {
  air: Air;
  qc: number;
  pt: number;
  /** At the fuselage side, without sideslip: what the pitot head's drain hole also vents to. */
  local: number;
  portL: number;
  portR: number;
  cabin: number;
}

/** The free-stream conditions and the pressures the pitot head, the static ports and the cabin present. */
export function sources(spec: PitotStaticSpec, h: number, kcas: number, i: Inputs): Sources {
  const air = ambient(h, i.weather);
  const qc = qcFromCas(kcas);
  // the drain hole's share of the healthy pitot side's openings
  const share = spec.model.drainRatio / (1 + spec.model.drainRatio);
  // a source coefficient such that, with that share lost through the drain, a perfect ASI reads the sheet's KIAS
  const at = (cp: number) => 1 - (1 - cp) / (1 - share);
  const { controls: c, cockpit: k } = i;
  const cpN = at(sourceCp(spec.poh.normal[c.flaps], kcas));
  const cpA = at(sourceCp(spec.poh.alternate[c.flaps], kcas));
  const local = air.p + qc * cpN;
  const slip = spec.model.slipCp * clamp(c.slip, -30, 30) * qc;
  // the cabin: Sheet 2's suction in its conditions, more with a vent open or the heat and air off
  const f = 1 + (k.ventsOpen ? spec.model.cabin.vents : 0) + (k.heatAir ? 0 : spec.model.cabin.heatOff);
  const cabin = air.p + qc * (cpN + f * (cpA - cpN));
  return { air, qc, pt: air.p + qc, local, portL: local + slip, portR: local - slip, cabin };
}

// ---------------------------------------------------------------- state set-up

/** The system at rest in steady flight (or on the ramp): every volume at the pressure its openings give it. */
export function initialState(spec: PitotStaticSpec, i: Inputs = defaultInputs()): PSState {
  const ramp = i.mode === "test";
  const s: PSState = {
    t: 0,
    h: ramp ? 0 : i.controls.alt,
    vs: 0,
    kcas: ramp ? 0 : i.controls.kcas,
    ktas: 0,
    oat: 15,
    pa: 0,
    pInf: P0,
    pt: P0,
    portL: P0,
    portR: P0,
    cabin: P0,
    pitot: P0,
    stat: P0,
    vsiCase: P0,
    heat: i.cockpit.pitotHeat && !i.failures.heater ? 1 : 0,
    headC: 15,
    iceRam: 0,
    iceDrain: 0,
    waterIce: 0,
    ias: 0,
    alt: 0,
    vsi: 0,
    modeC: 0,
    vsiPegged: false,
    pfd: { valid: false, ias: 0, tas: 0, alt: 0, vs: 0, iasTrend: 0, pa: 0 },
    flows: noFlows(),
    testAlt: 0,
    testKt: 0,
    leakTest: noLeakTest(),
    hist: emptyHistory(),
  };
  settle(spec, s, i);
  return s;
}

/**
 * Put every volume at its steady pressure for the airplane where it is now, and the needles on their readings: the
 * state a system that has been flying like this for a while is in. Blockages trap what was there, so a scenario sets up
 * steady flight first and fails parts after.
 */
export function settle(spec: PitotStaticSpec, s: PSState, i: Inputs) {
  const src = sources(spec, s.h, s.kcas, i);
  record(s, src);
  const healthy = noFailures();
  const n = network(spec, s, src, { ...i, failures: healthy }, 0);
  s.pitot = n.pitotSteady;
  s.stat = n.staticSteady;
  s.vsiCase = s.stat;
  readInstruments(spec, s, i, 0);
}

// ---------------------------------------------------------------- the network

interface Link {
  g: number;
  p: number;
}

/** Implicit update of a volume (capacity 1) open to sources through conductances g (1/s); returns its new pressure. */
function relax(p: number, links: Link[], dt: number) {
  let gs = 0,
    gp = 0;
  for (const l of links) {
    gs += l.g;
    gp += l.g * l.p;
  }
  return (p + dt * gp) / (1 + dt * gs);
}

/** Static-line conductance with water in it: sloshing between `min` and `max` (intermittent), none once frozen. */
export function waterFactor(spec: PitotStaticSpec, t: number, ice: number) {
  const w = spec.model.water;
  const a = (2 * Math.PI * t) / w.periodS;
  const slosh = 0.5 + 0.5 * Math.sin(a + 1.7 * Math.sin(a * 2.7));
  return (w.min + (w.max - w.min) * slosh) * (1 - ice);
}

/** The conductances open on the pitot side, the static side and the VSI case, and their steady pressures. */
function network(spec: PitotStaticSpec, s: PSState, src: Sources, i: Inputs, t: number) {
  const m = spec.model,
    f = i.failures;
  const gRam = 1 / m.tauRam,
    gDrain = gRam * m.drainRatio;
  const test = i.mode === "test";
  // ---- pitot side: ram inlet to total pressure, drain hole to outside air; on the ramp, the test set's adapter
  const ramOpen = f.ram ? 0 : (1 - s.iceRam) ** 2;
  const drainOpen = f.drain ? 0 : (1 - s.iceDrain) ** 2;
  const testOpen = test && !i.test.sealed;
  const pTestStatic = pressureAt(pressureAltitude(src.air.p) + s.testAlt);
  const pTestPitot = pTestStatic + qcFromCas(s.testKt);
  const pitot: Record<"ram" | "drain" | "pitotLeak" | "testPitot", Link> = {
    ram: { g: test ? 0 : gRam * ramOpen, p: src.pt },
    drain: { g: test ? 0 : gDrain * drainOpen, p: src.local },
    pitotLeak: { g: f.pitotLeak ? 1 / m.pitotLeakTau : 0, p: src.cabin },
    // the adapter seals over the whole head: its pressure gets in through whichever holes are open
    testPitot: { g: testOpen ? (ramOpen + m.drainRatio * drainOpen) / m.testSet.tau : 0, p: pTestPitot },
  };
  // ---- static side: the port(s) through the line (water in it), or the cabin through the ALT STATIC AIR selector
  const water = f.water ? waterFactor(spec, t, s.waterIce) : 1;
  const ext = i.cockpit.altStatic ? 0 : water / m.tauPort;
  const paired = i.ports === "paired";
  const gPort = paired ? ext / 2 : ext;
  // the G1000 has no mechanical VSI on the static line
  const sixPack = i.avionics === "six-pack";
  const gV = sixPack ? m.vsiCase / m.tauVsi : 0;
  // on the ramp the test set's adapters seal over the port (both of a pair): it reaches the line through open ports
  const reach = (paired ? (f.portL ? 0 : 0.5) + (f.portR ? 0 : 0.5) : f.portL ? 0 : 1) * water;
  const stat: Record<"portL" | "portR" | "alt" | "leak" | "testStatic", Link> = {
    portL: { g: test || f.portL ? 0 : gPort, p: src.portL },
    portR: { g: test || !paired || f.portR ? 0 : gPort, p: src.portR },
    alt: { g: i.cockpit.altStatic ? 1 / m.tauAlt : 0, p: src.cabin },
    leak: { g: f.leak === "none" ? 0 : 1 / m.leakTau[f.leak], p: src.cabin },
    testStatic: { g: testOpen && !i.cockpit.altStatic ? reach / m.testSet.tau : 0, p: pTestStatic },
  };
  const steady = (links: Link[], fallback: number) => {
    let gs = 0,
      gp = 0;
    for (const l of links) {
      gs += l.g;
      gp += l.g * l.p;
    }
    return gs > 0 ? gp / gs : fallback;
  };
  return {
    pitot,
    stat,
    gV,
    gGlass: f.vsiGlass && sixPack ? m.glass * gV : 0,
    pitotSteady: steady(Object.values(pitot), s.pitot),
    staticSteady: steady(Object.values(stat), s.stat),
  };
}

// ---------------------------------------------------------------- stepping

/** Advance the state by dt seconds (split into steps no longer than the spec's). */
export function step(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  // a repeated frame time passes no time
  if (!(dt > 0)) return;
  const n = Math.max(1, Math.ceil(dt / spec.model.maxStep - 1e-9));
  for (let k = 0; k < n; k++) substep(spec, s, i, dt / n);
}

/** Run for `seconds` (tests and set-ups). */
export function run(spec: PitotStaticSpec, s: PSState, i: Inputs, seconds: number) {
  const dt = spec.model.maxStep;
  for (let t = 0; t < seconds - 1e-9; t += dt) step(spec, s, i, Math.min(dt, seconds - t));
  return s;
}

function flyAirplane(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  const a = spec.model.airplane;
  if (i.mode === "test") {
    // on the ramp, engine off
    s.kcas = 0;
    s.vs = 0;
    return;
  }
  const c = i.controls;
  s.kcas += clamp(c.kcas - s.kcas, -a.ktPerS * dt, a.ktPerS * dt);
  const onGround = s.h <= 0 && s.kcas < a.liftOffKcas;
  const rate = Math.abs(c.rate);
  const cmd = onGround ? 0 : clamp((c.alt - s.h) * a.levelOff, -rate, rate);
  s.vs += (cmd - s.vs) * Math.min(1, dt / a.vsTau);
  s.h += (s.vs / 60) * dt;
  if (s.h <= 0) {
    s.h = 0;
    if (s.vs < 0) s.vs = 0;
  }
}

function icePitot(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  const ice = spec.model.ice;
  const on = i.cockpit.pitotHeat && !i.failures.heater && i.mode === "flight";
  s.heat += ((on ? 1 : 0) - s.heat) * Math.min(1, dt / ice.heaterTau);
  s.headC = s.oat + ice.heatRiseC * s.heat;
  if (s.headC <= 0 && i.weather.moisture && s.ktas > 30) {
    // supercooled droplets freeze on the head, faster the faster it meets them
    const r = ice.rate * (s.ktas / 100) * dt;
    s.iceRam = Math.min(1, s.iceRam + r);
    if (s.iceRam > ice.drainAfter) s.iceDrain = Math.min(1, s.iceDrain + r * ice.drainRate);
  } else if (s.headC > 0) {
    const melt = s.headC * ice.meltPerDegS * dt;
    s.iceRam = Math.max(0, s.iceRam - melt);
    s.iceDrain = Math.max(0, s.iceDrain - melt);
  }
  // water in the static line freezes below 0 °C and thaws above
  const w = spec.model.water;
  if (i.failures.water) s.waterIce = clamp(s.waterIce + (s.oat <= 0 ? dt / w.freezeS : -dt / w.thawS), 0, 1);
  else s.waterIce = 0;
}

function moveTestSet(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  const ts = spec.model.testSet;
  if (i.mode !== "test") {
    s.testAlt = 0;
    s.testKt = 0;
    s.leakTest = noLeakTest();
    return;
  }
  const lt = s.leakTest;
  if (i.test.sealed) {
    const t0 = lt.t0 ?? s.t;
    if (lt.t0 === null) {
      const staticFt = pressureAltitude(s.stat) - s.pa;
      Object.assign(lt, {
        t0,
        alt0: s.alt,
        ias0: s.ias,
        testFt: s.testAlt,
        staticFt,
        altLoss: 0,
        iasLoss: 0,
        done: false,
      });
    }
    if (!lt.done) {
      lt.altLoss = lt.alt0 - s.alt;
      lt.iasLoss = lt.ias0 - s.ias;
      lt.done = s.t - t0 >= spec.handbook.leakTest.s - 1e-9;
    }
    return;
  }
  if (lt.t0 !== null) s.leakTest = noLeakTest();
  // applied and released slowly (AMT p. 10-81)
  s.testAlt += clamp(i.test.alt - s.testAlt, (-ts.ftPerMin / 60) * dt, (ts.ftPerMin / 60) * dt);
  s.testKt += clamp(i.test.kt - s.testKt, -ts.ktPerS * dt, ts.ktPerS * dt);
}

/**
 * The instruments indicated the test set's altitude when it was sealed, so the leak test measures them: through a taped
 * port, with ALT STATIC AIR on or with a line off, the test set gets there and the instruments don't, or stay where a
 * blockage trapped them (AMT p. 10-81: the system is taken to "indicate 1,000 feet on the altimeter").
 */
export const leakTestReached = (spec: PitotStaticSpec, lt: LeakTest) =>
  lt.t0 !== null && Math.abs(lt.testFt - lt.staticFt) <= spec.model.testSet.reachFt;

function substep(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  s.t += dt;
  flyAirplane(spec, s, i, dt);
  const src = sources(spec, s.h, s.kcas, i);
  record(s, src);
  icePitot(spec, s, i, dt);
  moveTestSet(spec, s, i, dt);

  // ---- air through the openings
  const n = network(spec, s, src, i, s.t);
  s.pitot = relax(s.pitot, Object.values(n.pitot), dt);
  // the static side also feeds the VSI case through the calibrated leak (its pressure taken from the last step)
  s.stat = relax(s.stat, [...Object.values(n.stat), { g: n.gV, p: s.vsiCase }], dt);
  // the case: from the static side through the leak, from the cabin through broken glass
  const cv = spec.model.vsiCase;
  s.vsiCase = relax(
    s.vsiCase,
    [
      { g: n.gV / cv, p: s.stat },
      { g: n.gGlass / cv, p: src.cabin },
    ],
    dt,
  );

  // flows, from the pressures after the step (implicit): positive into the volume
  const fl = s.flows;
  const into = (l: Link, p: number) => l.g * (l.p - p);
  fl.ram = into(n.pitot.ram, s.pitot);
  fl.drain = into(n.pitot.drain, s.pitot);
  fl.pitotLeak = into(n.pitot.pitotLeak, s.pitot);
  fl.testPitot = into(n.pitot.testPitot, s.pitot);
  fl.portL = into(n.stat.portL, s.stat);
  fl.portR = into(n.stat.portR, s.stat);
  fl.alt = into(n.stat.alt, s.stat);
  fl.leak = into(n.stat.leak, s.stat);
  fl.testStatic = into(n.stat.testStatic, s.stat);
  fl.vsi = (n.gV / cv) * (s.stat - s.vsiCase);
  fl.glass = (n.gGlass / cv) * (src.cabin - s.vsiCase);

  if (i.avionics !== "six-pack") s.vsiCase = s.stat;

  readInstruments(spec, s, i, dt);
  sample(s, i);
}

function record(s: PSState, src: Sources) {
  s.pInf = src.air.p;
  s.pt = src.pt;
  s.portL = src.portL;
  s.portR = src.portR;
  s.cabin = src.cabin;
  s.oat = src.air.oat;
  s.pa = pressureAltitude(src.air.p);
  s.ktas = tasFromCas(s.kcas, src.air);
}

/** Raw instrument readings for the system's pressures. */
export function readings(spec: PitotStaticSpec, pitot: number, stat: number, vsiCase: number, kollsman: number) {
  const vsi = ((vsiCase - stat) / (spec.model.tauVsi * rhoStd(stat) * G0)) * FPM;
  return { ias: casFromQc(pitot - stat), alt: altitudeFor(stat, kollsman), vsi };
}

function readInstruments(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  const r = readings(spec, s.pitot, s.stat, s.vsiCase, i.cockpit.kollsman);
  const p = spec.model.pointer,
    stop = spec.model.vsiStop;
  const lag = (v: number, to: number, tau: number) => (dt > 0 ? v + (to - v) * Math.min(1, dt / tau) : to);
  s.ias = lag(s.ias, r.ias, p.asi);
  s.alt = lag(s.alt, r.alt, p.alt);
  s.vsiPegged = Math.abs(r.vsi) > stop;
  s.vsi = lag(s.vsi, clamp(r.vsi, -stop, stop), p.vsi);
  const step100 = spec.handbook.modeCft;
  s.modeC = Math.round(pressureAltitude(s.stat) / step100) * step100;
  readAdc(spec, s, i, dt);
}

/**
 * The air data computer: airspeed from the pitot side against the static side, altitude from the static side and the
 * PFD's BARO setting, vertical speed from the rate its pressure altitude changes, true airspeed from its airspeed,
 * the static pressure it senses and the OAT probe (POH p. 7-70; Garmin 190-00498-07 p. 2).
 */
function readAdc(spec: PitotStaticSpec, s: PSState, i: Inputs, dt: number) {
  const a = spec.model.adc,
    p = s.pfd;
  p.valid = i.avionics === "g1000" && !i.failures.adc;
  const pa = pressureAltitude(s.stat);
  const ias = casFromQc(s.pitot - s.stat);
  const alt = altitudeFor(s.stat, i.cockpit.baro);
  if (dt > 0) {
    const before = p.ias;
    p.ias += (ias - p.ias) * Math.min(1, dt / a.tau);
    p.alt += (alt - p.alt) * Math.min(1, dt / a.tau);
    p.vs += (((pa - p.pa) / dt) * 60 - p.vs) * Math.min(1, dt / a.vsTau);
    p.iasTrend += (((p.ias - before) / dt) * 6 - p.iasTrend) * Math.min(1, dt / a.trendTau);
  } else Object.assign(p, { ias, alt, vs: 0, iasTrend: 0 });
  p.pa = pa;
  const T = s.oat + 273.15;
  p.tas = tasFromCas(p.ias, { p: s.stat, T, oat: s.oat, rho: s.stat / (R_AIR * T) });
}

/** The primary instruments' readings: the six-pack's, or the PFD's (none while it shows a red X). */
export function primary(s: PSState, i: Pick<Inputs, "avionics">) {
  if (i.avionics === "six-pack") return { ias: s.ias, alt: s.alt, vs: s.vsi };
  return s.pfd.valid ? { ias: s.pfd.ias, alt: s.pfd.alt, vs: s.pfd.vs } : { ias: NaN, alt: NaN, vs: NaN };
}

function sample(s: PSState, i: Inputs) {
  const h = s.hist;
  if (h.t.length && s.t - h.t[h.t.length - 1] < HIST_DT) return;
  const r = primary(s, i);
  h.t.push(s.t);
  h.kcas.push(s.kcas);
  h.ias.push(r.ias);
  h.h.push(s.h);
  h.alt.push(r.alt);
  h.vs.push(s.vs);
  h.vsi.push(r.vs);
  while (h.t.length && s.t - h.t[0] > HIST_S) for (const k of Object.keys(h) as (keyof History)[]) h[k].shift();
}

// ---------------------------------------------------------------- what the POH says

/** The KIAS the POH's Figure 5-1 gives for the airplane's KCAS, with the source in use. */
export function pohKias(spec: PitotStaticSpec, kcas: number, flaps: Flaps, alternate: boolean) {
  return toKias((alternate ? spec.poh.alternate : spec.poh.normal)[flaps], kcas);
}

/** Inches of mercury. */
export const inHg = (pa: number) => pa / INHG_PA;
