/**
 * Shared "flight state" for the avionics layer: a tiny deterministic integrator so the autopilots
 * (GFC 700, KAP 140) have something to fly and the PFD something to show. A teaching visual, not a
 * flight model: coordinated turns, first-order vertical-speed and airspeed response, one straight
 * selected course (cross-track error) and an optional glideslope / glidepath and VNAV path.
 *
 * Pure: `stepFlight` returns a new object. Keep the state outside React (e.g. in the airplane's
 * `live` object), advance it in the airplane's tick, and turn it into PFD data with `flightData`.
 */
import type { FlightData, NavSrc } from "./g1000";

export type { NavSrc };

/** Model constants (defaults ≈ a 172/DA40 at cruise power). */
export interface FlightCfg {
  /** Trimmed level-flight IAS (kt) = v0 + vp × power. */
  v0: number; vp: number;
  /** Climb rate (fpm) that costs one knot of airspeed at a given power. */
  fpmPerKt: number;
  /** Lowest airspeed the model reaches (kt): asking for more climb than power allows just bleeds speed to here. */
  vMin: number;
  /** Max bank flown (deg) and roll rate (deg/s). */
  maxBank: number; rollRate: number;
  /** Vertical-speed and airspeed response time constants (s). */
  tauVs: number; tauIas: number;
}
export const FLIGHT_DEFAULT: FlightCfg = { v0: 55, vp: 75, fpmPerKt: 22, vMin: 48, maxBank: 30, rollRate: 6, tauVs: 1.5, tauIas: 7 };

export interface FlightState {
  /** Sim clock (s). Autopilot timers and annunciation flashing run on it. */
  t: number;
  /** Magnetic heading (deg); track = heading (no wind). */
  hdg: number;
  /** Pitch (deg, + nose up) — derived from VS and angle of attack. */
  pitch: number;
  /** Bank (deg, + right wing down). */
  roll: number;
  /** Slip/skid ball (-1..1, + ball right). */
  slip: number;
  /** Indicated airspeed (kt) and its rate (kt/s, for the trend vector). */
  ias: number; iasDot: number;
  /** Indicated altitude (ft) and vertical speed (fpm). */
  alt: number; vs: number;
  /** Throttle 0..1: sets the trimmed airspeed (pilot's job in VS/PIT/ALT; FLC trades it for climb). */
  power: number;
  /** Position (nm east / north of an arbitrary origin) — only for the moving map. */
  x: number; y: number;
  /** G1000 selections: heading bug, selected course (CRS knob / GPS DTK), selected altitude (ALT knob). */
  hdgBug: number; crs: number; selAlt: number;
  /** HSI navigation source (CDI softkey). */
  navSrc: NavSrc;
  /** The selected source has a usable signal. False = no D-bar on the HSI (the "flag"); NAV/APR modes drop. */
  navValid: boolean;
  /** Cross-track distance (nm) right (+) of the selected course line. */
  xtk: number;
  /** Height (ft) above the ILS glideslope (LOC source) or WAAS glidepath (GPS source); null = no vertical signal. Intercepting from below: start negative (e.g. −400). */
  gsErr: number | null;
  /**
   * VNAV profile: height (ft) above the descent path and the path's vertical speed (fpm, negative); null = no VNAV
   * flight plan. Level before top of descent you are below the path's extension (err < 0) and it comes down to meet you.
   */
  vpath: { err: number; vs: number } | null;
  /** Altimeter setting (inHg) and OAT (°C). */
  baro: number; oat: number;
  /** On the ground: nothing moves; GA gives TO instead of GA. */
  onGround: boolean;
  /** Sensor failures: att = AHRS attitude, hdg = AHRS heading/magnetometer, air = air data computer. */
  fail: { att?: boolean; hdg?: boolean; air?: boolean };
}

/** Roll / pitch command from the autopilot (or from the pilot's yoke). Give either `vs` or `pitch`; neither = hold VS. */
export interface FlightCmd { bank: number; vs?: number; pitch?: number }

/** G1000 selections the panels may change directly. */
export type FlySet = Partial<Pick<FlightState, "hdgBug" | "crs" | "selAlt" | "navSrc" | "power" | "baro">>;

const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrap360 = (a: number) => ((a % 360) + 360) % 360;
export const wrap180 = (a: number) => { const w = wrap360(a); return w > 180 ? w - 360 : w; };
export const isLoc = (s: NavSrc) => s === "LOC1" || s === "LOC2";

/** True airspeed (kt): +2 % per 1,000 ft. */
export const tasOf = (fs: Pick<FlightState, "ias" | "alt">) => fs.ias * (1 + fs.alt * 0.00002);
/** Angle of attack (deg) at an airspeed — a smooth made-up curve. */
const aoa = (ias: number) => 0.5 + 250 / Math.max(ias, 30);
/** Pitch attitude (deg) that gives `vs` at the current speed. */
export const pitchFor = (fs: FlightState, vs: number) => aoa(fs.ias) + Math.atan2(vs, tasOf(fs) * 101.27) / D2R;
/** Vertical speed (fpm) a pitch attitude gives at the current speed. */
export const vsForPitch = (fs: FlightState, pitch: number) => tasOf(fs) * 101.27 * Math.tan(clamp(pitch - aoa(fs.ias), -30, 30) * D2R);
/** Trimmed level-flight airspeed at the current power. */
export const trimIas = (fs: FlightState, cfg = FLIGHT_DEFAULT) => cfg.v0 + cfg.vp * fs.power;
/** Steady vertical speed at which the airplane holds `ias` with the current power (what FLC flies). */
export const vsForIas = (fs: FlightState, ias: number, cfg = FLIGHT_DEFAULT) => (trimIas(fs, cfg) - ias) * cfg.fpmPerKt;
/** Bank (deg) for a standard-rate (3°/s) turn at the current TAS. */
export const stdRateBank = (fs: FlightState) => Math.atan((3 * tasOf(fs)) / 1091) / D2R;
/** Turn rate (deg/s, + right) from bank and TAS. */
export const turnRate = (fs: FlightState) => (1091 * Math.tan(fs.roll * D2R)) / Math.max(tasOf(fs), 40);
/** Vertical speed (fpm) of a 3° glideslope / glidepath at the current ground speed. */
export const pathVs = (fs: FlightState) => -tasOf(fs) * 5.31;

/** CDI full-scale deflection (nm): GPS terminal 1.0, VOR ~2.0 (angular in reality), LOC ~0.35 near the runway. */
export const cdiFullScale = (s: NavSrc) => (s === "GPS" ? 1 : isLoc(s) ? 0.35 : 2);
/** CDI deflection in dots (2 = full scale; + = course is to the right, fly right); null = no signal. */
export const navDots = (fs: FlightState): number | null => (fs.navValid ? (-fs.xtk / cdiFullScale(fs.navSrc)) * 2 : null);
/** Glideslope / glidepath deflection in dots (+ = path above the airplane, fly up); null = no signal. 100 ft per dot. */
export const gsDots = (fs: FlightState): number | null => (fs.gsErr == null ? null : -fs.gsErr / 100);

/** Bank (deg) to turn onto heading `tgt`: 2° of bank per degree of error, limited to `maxBank`. */
export const bankToHdg = (fs: FlightState, tgt: number, maxBank: number) => clamp(wrap180(tgt - fs.hdg) * 2, -maxBank, maxBank);
/** Intercept / tracking heading for the selected course (`back` = localizer back course), up to 40° of intercept. */
export function trackHdg(fs: FlightState, back = false): number {
  const corr = clamp(fs.xtk * (60 / cdiFullScale(fs.navSrc)), -40, 40);
  return back ? wrap360(fs.crs + 180 + corr) : wrap360(fs.crs - corr);
}

/** CDI softkey: GPS → NAV1 → NAV2 → GPS. `loc1/loc2` = that NAV radio is tuned to a localizer. */
export const nextCdi = (s: NavSrc, loc1 = false, loc2 = false): NavSrc =>
  s === "GPS" ? (loc1 ? "LOC1" : "VOR1") : s === "VOR1" || s === "LOC1" ? (loc2 ? "LOC2" : "VOR2") : "GPS";

export function initFlight(p: Partial<FlightState> = {}): FlightState {
  const fs: FlightState = {
    t: 0, hdg: 90, pitch: 0, roll: 0, slip: 0, ias: 110, iasDot: 0, alt: 4500, vs: 0, power: 0.73, x: 0, y: 0,
    hdgBug: 90, crs: 90, selAlt: 4500, navSrc: "GPS", navValid: true, xtk: 0, gsErr: null, vpath: null,
    baro: 29.92, oat: 8, onGround: false, fail: {}, ...p,
  };
  return { ...fs, pitch: p.pitch ?? pitchFor(fs, fs.vs) };
}

/**
 * Advance the flight state by `dt` seconds following `cmd`: bank toward cmd.bank at the roll rate (heading
 * changes as a coordinated turn), VS toward cmd.vs (or the VS that cmd.pitch gives), airspeed toward the
 * trimmed speed for that climb rate, then the course, glideslope and VNAV path geometry.
 */
export function stepFlight(fs: FlightState, cmd: FlightCmd, dt: number, cfg = FLIGHT_DEFAULT): FlightState {
  if (!(dt > 0)) return fs;
  const n: FlightState = { ...fs, t: fs.t + dt };
  if (fs.onGround) return { ...n, roll: 0, vs: 0, iasDot: 0 };
  const rr = cfg.rollRate * dt;
  n.roll = fs.roll + clamp(clamp(cmd.bank, -cfg.maxBank, cfg.maxBank) - fs.roll, -rr, rr);
  n.slip = clamp(((fs.roll - n.roll) / dt) * 0.04, -1, 1);
  n.hdg = wrap360(fs.hdg + turnRate(n) * dt);
  let vsT = cmd.vs ?? (cmd.pitch != null ? vsForPitch(fs, cmd.pitch) : fs.vs);
  if (fs.ias <= cfg.vMin) vsT = Math.min(vsT, vsForIas(fs, cfg.vMin, cfg)); // out of climb authority: mush at vMin
  n.vs = fs.vs + clamp((clamp(vsT, -4000, 3000) - fs.vs) / cfg.tauVs, -600, 600) * dt;
  n.alt = fs.alt + (n.vs / 60) * dt;
  n.iasDot = (trimIas(fs, cfg) - n.vs / cfg.fpmPerKt - fs.ias) / cfg.tauIas;
  n.ias = Math.max(cfg.vMin - 3, fs.ias + n.iasDot * dt);
  n.pitch = pitchFor(n, n.vs);
  const g = tasOf(n) / 3600; // nm/s
  n.x = fs.x + g * Math.sin(n.hdg * D2R) * dt;
  n.y = fs.y + g * Math.cos(n.hdg * D2R) * dt;
  n.xtk = fs.xtk + g * Math.sin((n.hdg - fs.crs) * D2R) * dt;
  if (fs.gsErr != null) n.gsErr = fs.gsErr + ((n.vs - pathVs(n)) / 60) * dt;
  if (fs.vpath) n.vpath = { ...fs.vpath, err: fs.vpath.err + ((n.vs - fs.vpath.vs) / 60) * dt };
  return n;
}

/** Pilot's yoke → command: roll −1..1 → bank ±30°, pitch −1..1 → ±10° around `trimPitch`. */
export const yokeCmd = (roll: number, pitch: number, trimPitch = 2): FlightCmd => ({ bank: roll * 30, pitch: trimPitch + pitch * 10 });

/** Flight state → PFD/MFD data. `extra` adds radios, transponder, time, nav status or overrides. */
export function flightData(fs: FlightState, extra: Partial<FlightData> = {}): FlightData {
  const dots = navDots(fs), gs = gsDots(fs), tas = tasOf(fs);
  const vdev = isLoc(fs.navSrc) || (fs.navSrc === "GPS" && fs.gsErr != null);
  return {
    pitch: fs.pitch, roll: fs.roll, slip: fs.slip, ias: fs.ias, tas, gs: tas, alt: fs.alt, vs: fs.vs, hdg: fs.hdg, trk: fs.hdg,
    baro: fs.baro, oat: fs.oat, hdgBug: fs.hdgBug, crs: fs.crs, cdi: dots == null ? undefined : clamp(dots / 2, -1.25, 1.25),
    gsDev: vdev ? gs : undefined, navSrc: fs.navSrc, selAlt: fs.selAlt, iasTrend: fs.iasDot * 6, turnRate: turnRate(fs),
    pos: [fs.x, fs.y], xtk: fs.xtk, fail: fs.fail, ...extra,
  };
}
