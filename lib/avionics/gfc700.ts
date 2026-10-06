/**
 * Garmin GFC 700 AFCS logic for the G1000 airplanes (C172S NAV III, DA40) — pure functions.
 * Mode names, colours and transitions follow the G1000 CRGs (Cessna NAV III 190-00384-13, DA40
 * 190-00324-07 §6) and the DA40 GFC 700 AFMS 190-00492-00:
 * - FD/AP engage in ROL + PIT; other keys activate the FD in their mode with the default for the other axis.
 * - Mode keys are alternate action (press on, press off → default mode for that axis).
 * - Armed modes white, active green; automatic armed→active transitions flash green 10 s;
 *   a lost mode flashes yellow 10 s while the axis reverts to ROL (wings level) / PIT.
 * - ALTS arms automatically in PIT, VS, FLC, GA (and VPTH); ALTS → ALT at 50 ft from the Selected Altitude.
 * - NAV/APR capture immediately with the CDI ≤ 1 dot, otherwise arm (white).
 * - AP off by AP key / AP DISC / MET / GA: yellow "AP" flashes 5 s + 2 s tone. Automatic (failure)
 *   disconnect: red flashing "AP" + continuous tone until AP DISC (or MET) acknowledges.
 * Keep the state with the flight state (outside React), call `gfc700Tick` every frame and
 * `gfc700Key` on key presses; both return the same object when nothing changed. Every function takes the
 * airplane's `Gfc700Cfg` (built from GFC700_BASE in the airplane's model.ts).
 */
import type { AfcsAnnunc } from "./g1000";
import {
  bankToHdg, gsDots, isLoc, navDots, pathVs, pitchFor, stdRateBank, trackHdg, vsForIas, vsForPitch, wrap180,
  type FlightCfg, type FlightCmd, type FlightState, type NavSrc,
} from "./flight";

export type Gfc700Lat = "ROL" | "HDG" | "GPS" | "VOR" | "LOC" | "BC" | "VAPP" | "GA" | "TO";
export type Gfc700Vert = "PIT" | "ALT" | "ALTS" | "VS" | "FLC" | "VPTH" | "GS" | "GP" | "GA" | "TO";

/**
 * Keys, buttons and switches. Bezel: AP FD YD HDG NAV APR BC ALT VS FLC VNV NOSE_UP NOSE_DN.
 * Elsewhere: GA (go-around button), AP_DISC (control-wheel A/P TRIM DISC / AP DISC; also acknowledges a
 * disconnect), CWS / CWS_UP (press / release), TRIM_UP / TRIM_DN (manual electric pitch trim, both halves).
 */
export type Gfc700Key =
  | "AP" | "FD" | "YD" | "HDG" | "NAV" | "APR" | "BC" | "ALT" | "VS" | "FLC" | "VNV" | "NOSE_UP" | "NOSE_DN"
  | "GA" | "AP_DISC" | "CWS" | "CWS_UP" | "TRIM_UP" | "TRIM_DN";

/** Per-airplane configuration. */
export interface Gfc700Cfg {
  /** Yaw damper installed (neither the C172S nor the DA40 has one). */
  hasYD: boolean;
  /** Dedicated BC key (Cessna NAV III bezel). Without it (DA40) NAV on a localizer annunciates LOC until the course is more than `bcAngle` from the heading, then BC. */
  bcKey: boolean;
  /** Course-to-heading angle (deg) beyond which NAV on a localizer is back course (airplanes without a BC key). */
  bcAngle: number;
  /** NOSE UP/DN reference ranges: VS (fpm), FLC IAS (kt), PIT (deg). */
  vsMin: number; vsMax: number; flcMin: number; flcMax: number; pitMin: number; pitMax: number;
  /** Max autopilot airspeed (kt): above it in PIT/VS/FLC/VPTH the FD pitches up and MAXSPD flashes. Infinity = not modelled. */
  vmo: number;
  /** FD bank limit (deg) and GA / TO pitch (deg). */
  maxBank: number; gaPitch: number;
  /** Preflight test duration (s). */
  pftSec: number;
  /** Labels for the panel UI: the disconnect switch and the MET switch. */
  discLabel: string; trimLabel: string;
  /** The airplane's flight-state model (as passed to stepFlight), so FLC and MAXSPD solve for its speeds. Default FLIGHT_DEFAULT. */
  flight?: FlightCfg;
}

/**
 * Starting point for an airplane's configuration: the G1000 CRG mode references (VS +1,500 / −3,000 fpm, FLC 70–165 KIAS,
 * PIT +20° / −15°, 22° bank, 7° GA pitch; BC beyond 105°). No overspeed protection until the airplane sets `vmo` from its
 * own documents. Airplane configs live in aircraft/<id>/model.ts.
 */
export const GFC700_BASE: Gfc700Cfg = {
  hasYD: false, bcKey: true, bcAngle: 105, vsMin: -3000, vsMax: 1500, flcMin: 70, flcMax: 165, pitMin: -15, pitMax: 20,
  vmo: Number.POSITIVE_INFINITY, maxBank: 22, gaPitch: 7, pftSec: 5, discLabel: "AP DISC", trimLabel: "AP TRIM",
};

/** AFCS system status annunciations (shown left of the mode bar), in increasing priority. */
export type Gfc700Mistrim = "AIL→" | "←AIL" | "↓ELE" | "↑ELE";
/** Injected failures. trim = pitch trim (PTRM), sys = AFCS system (AP & MET lost, FD available), pft = preflight test will fail. */
export interface Gfc700Fail { pitch?: boolean; roll?: boolean; trim?: boolean; sys?: boolean; pft?: boolean; mistrim?: Gfc700Mistrim | null }

/** A flashing annunciation: text, colour (green = automatic transition, yellow = mode lost) and end time. */
export interface Gfc700Flash { text: string; c: "g" | "y"; until: number }

export interface Gfc700State {
  powered: boolean;
  /** Preflight test: "run" (white PFT) until pftEnd, then "pass"; "fail" latches (red PFT). */
  pft: "off" | "run" | "pass" | "fail";
  pftEnd: number;
  ap: boolean; fd: boolean; yd: boolean;
  /** CWS button held: servos released, references resync to the airplane on release. */
  cws: boolean;
  /** Active lateral mode and armed lateral mode. */
  lat: Gfc700Lat; latArm: Gfc700Lat | null;
  /** The lateral nav mode came from the APR key (approach: arms GS / GP). */
  apr: boolean;
  /** Navigation source the nav mode was selected on (switching it manually drops the mode). */
  src: NavSrc | null;
  /** Active vertical mode and armed vertical modes in display order (e.g. ["ALTS"], ["ALT"], ["ALTS", "GS"]). */
  vert: Gfc700Vert; vertArm: Gfc700Vert[];
  /** References: pitch (deg), roll hold bank (deg), VS (fpm), FLC IAS (kt), ALT/ALTS altitude (ft). */
  ref: { pit: number; rol: number; vs: number; ias: number; alt: number };
  latFlash: Gfc700Flash | null; vertFlash: Gfc700Flash | null;
  /** Flashing AP: yellow "disc" (normal, 5 s) or red "abnormal" (until acknowledged). */
  apFlash: { kind: "disc" | "abnormal"; until: number } | null;
  /** Autopilot disconnect tone sounds until this time (s); Infinity = continuous until acknowledged. */
  tone: number;
  fail: Gfc700Fail;
  /** Pitch trim position −1 (nose down) … +1 (nose up): MET and autotrim, for animating the trim wheel. */
  trim: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r10 = (v: number) => Math.round(v / 10) * 10;
const r100 = (v: number) => Math.round(v / 100) * 100;
const NAV_MODES: Gfc700Lat[] = ["GPS", "VOR", "LOC", "BC", "VAPP"];
const isNav = (m: Gfc700Lat | null) => !!m && NAV_MODES.includes(m);
/** Roll Hold: < 6° rolls wings level, 6–22° holds the bank, > 22° limits to 22° (CRG Table 6-3). */
const holdBank = (roll: number, max: number) => (Math.abs(roll) < 6 ? 0 : clamp(roll, -max, max));
const withoutPath = (a: Gfc700Vert[]) => a.filter((m) => m !== "GS" && m !== "GP");
const pathArm = (a: Gfc700Vert[]) => a.filter((m) => m === "GS" || m === "GP");
const ALTS_MODES: Gfc700Vert[] = ["PIT", "VS", "FLC", "GA", "VPTH"];

/** Unpowered AFCS. */
export function gfc700Init(): Gfc700State {
  return {
    powered: false, pft: "off", pftEnd: 0, ap: false, fd: false, yd: false, cws: false, lat: "ROL", latArm: null, apr: false, src: null,
    vert: "PIT", vertArm: [], ref: { pit: 0, rol: 0, vs: 0, ias: 0, alt: 0 }, latFlash: null, vertFlash: null, apFlash: null, tone: 0, fail: {}, trim: 0,
  };
}

/** Power the AFCS on/off (AVIONICS + AUTO PILOT / AFCS breaker). Idempotent — call it every tick. Power-up starts the preflight test. */
export function gfc700Power(st: Gfc700State, on: boolean, now: number, cfg: Gfc700Cfg): Gfc700State {
  if (on === st.powered) return st;
  if (!on) return { ...gfc700Init(), fail: st.fail, trim: st.trim };
  return { ...gfc700Init(), fail: st.fail, trim: st.trim, powered: true, pft: "run", pftEnd: now + cfg.pftSec };
}

/** Set or clear failures. Pitch/roll/system failures with the AP engaged cause an automatic (red) disconnect. */
export function gfc700Fail(st: Gfc700State, f: Gfc700Fail, now: number): Gfc700State {
  const s: Gfc700State = { ...st, fail: { ...st.fail, ...f } };
  if (s.ap && (s.fail.pitch || s.fail.roll || s.fail.sys)) disconnect(s, now, "abnormal");
  return s;
}

/** The servos are flying the airplane: feed `gfc700Command` to stepFlight instead of the pilot's yoke. */
export const gfc700Engaged = (st: Gfc700State) => st.ap && !st.cws;

function canAp(s: Gfc700State, fs: FlightState) {
  const f = s.fail;
  return s.powered && s.pft === "pass" && !f.pitch && !f.roll && !f.sys && !f.trim && !fs.fail.att && !fs.fail.air;
}

function disconnect(s: Gfc700State, now: number, kind: "disc" | "abnormal") {
  s.ap = false; s.cws = false;
  s.apFlash = { kind, until: kind === "disc" ? now + 5 : Infinity };
  s.tone = kind === "disc" ? now + 2 : Infinity;
}

/** Turn the FD on (if off) in the default modes, references synced to the airplane. */
function activateFd(s: Gfc700State, fs: FlightState, cfg: Gfc700Cfg) {
  if (s.fd) return;
  s.fd = true; s.lat = "ROL"; s.latArm = null; s.apr = false; s.src = null; s.vert = "PIT"; s.vertArm = ["ALTS"];
  s.ref = { ...s.ref, pit: clamp(fs.pitch, cfg.pitMin, cfg.pitMax), rol: holdBank(fs.roll, cfg.maxBank) };
  s.latFlash = null; s.vertFlash = null;
}

function setVert(s: Gfc700State, m: Gfc700Vert, fs: FlightState, cfg: Gfc700Cfg) {
  const path = pathArm(s.vertArm);
  s.vert = m; s.vertFlash = null;
  if (m === "PIT") s.ref.pit = clamp(fs.pitch, cfg.pitMin, cfg.pitMax);
  if (m === "VS") s.ref.vs = clamp(r100(fs.vs), cfg.vsMin, cfg.vsMax);
  if (m === "FLC") s.ref.ias = clamp(Math.round(fs.ias), cfg.flcMin, cfg.flcMax);
  if (m === "ALT") s.ref.alt = r10(fs.alt);
  s.vertArm = [...(ALTS_MODES.includes(m) ? (["ALTS"] as Gfc700Vert[]) : []), ...path];
}

function setLat(s: Gfc700State, m: Gfc700Lat, fs: FlightState, cfg: Gfc700Cfg) {
  s.lat = m; s.latFlash = null;
  if (m === "ROL") s.ref.rol = holdBank(fs.roll, cfg.maxBank);
}

/** A selected mode became unavailable (nav signal/source, or heading): flash it yellow 10 s and roll wings level in ROL. */
function loseLat(s: Gfc700State, now: number, what: "nav" | "hdg") {
  if (what === "nav") {
    if (isNav(s.latArm)) { s.latArm = null; s.vertArm = withoutPath(s.vertArm); }
    s.apr = false; s.src = null;
  }
  if (what === "nav" ? isNav(s.lat) : s.lat === "HDG") { s.latFlash = { text: s.lat, c: "y", until: now + 10 }; s.lat = "ROL"; s.ref.rol = 0; }
}
function loseVert(s: Gfc700State, fs: FlightState, now: number, cfg: Gfc700Cfg) {
  const was = s.vert;
  setVert(s, "PIT", fs, cfg);
  s.vertFlash = { text: was, c: "y", until: now + 10 };
}

/** Without a BC key, NAV on a localizer is back course once the course is more than `bcAngle` from the heading. */
const navLocMode = (fs: FlightState, cfg: Gfc700Cfg): Gfc700Lat => (!cfg.bcKey && Math.abs(wrap180(fs.crs - fs.hdg)) > cfg.bcAngle ? "BC" : "LOC");

/** The nav mode the NAV / APR / BC key would select on the current source. */
function navModeFor(fs: FlightState, key: "NAV" | "APR" | "BC", cfg: Gfc700Cfg): Gfc700Lat | null {
  if (!fs.navValid) return null;
  const src = fs.navSrc;
  if (key === "BC") return isLoc(src) ? "BC" : null;
  if (src === "GPS") return "GPS";
  if (!isLoc(src)) return key === "APR" ? "VAPP" : "VOR";
  return key === "NAV" ? navLocMode(fs, cfg) : "LOC";
}

/** NAV / APR / BC key; false when it can't do anything (no valid signal). */
function navKey(s: Gfc700State, key: "NAV" | "APR" | "BC", fs: FlightState, cfg: Gfc700Cfg): boolean {
  const apr = key === "APR";
  // Alternate action applies to the key that selected the mode: with a BC key, BC belongs to it and NAV goes to LOC.
  const bc = s.lat === "BC" || s.latArm === "BC";
  const fromThisKey = s.apr === apr && (key === "BC" ? bc : !(cfg.bcKey && bc));
  if (s.latArm && isNav(s.latArm) && fromThisKey) { s.latArm = null; s.apr = false; s.vertArm = withoutPath(s.vertArm); return true; }
  if (isNav(s.lat) && fromThisKey) { setLat(s, "ROL", fs, cfg); s.apr = false; s.src = null; s.vertArm = withoutPath(s.vertArm); return true; }
  const m = navModeFor(fs, key, cfg);
  if (!m) return false; // needs a valid VOR/LOC signal or an active GPS course
  activateFd(s, fs, cfg);
  s.apr = apr; s.src = fs.navSrc;
  s.vertArm = withoutPath(s.vertArm);
  if (apr && fs.gsErr != null && (m === "LOC" || m === "GPS")) s.vertArm = [...s.vertArm, m === "LOC" ? "GS" : "GP"];
  const dots = navDots(fs) ?? 9;
  if (Math.abs(dots) <= 1) { s.latArm = null; setLat(s, m, fs, cfg); } else s.latArm = m;
  return true;
}

/** Apply a key / button / switch. Returns the same state when the key does nothing. */
export function gfc700Key(st: Gfc700State, key: Gfc700Key, fs: FlightState, cfg: Gfc700Cfg): Gfc700State {
  if (!st.powered) return st;
  const s: Gfc700State = { ...st, ref: { ...st.ref }, vertArm: [...st.vertArm] };
  const now = fs.t;
  switch (key) {
    case "AP":
      if (s.ap) disconnect(s, now, "disc");
      else {
        if (!canAp(s, fs)) return st;
        activateFd(s, fs, cfg);
        s.ap = true; s.apFlash = null; s.tone = 0;
        if (cfg.hasYD) s.yd = true;
      }
      break;
    case "FD":
      if (s.ap) return st; // FD key is disabled while the AP is engaged
      if (s.fd) { s.fd = false; s.lat = "ROL"; s.latArm = null; s.apr = false; s.src = null; s.vert = "PIT"; s.vertArm = []; s.latFlash = null; s.vertFlash = null; }
      else activateFd(s, fs, cfg);
      break;
    case "YD":
      if (!cfg.hasYD) return st;
      s.yd = !s.yd;
      break;
    case "HDG":
      if (fs.fail.hdg) return st;
      activateFd(s, fs, cfg);
      setLat(s, st.fd && s.lat === "HDG" ? "ROL" : "HDG", fs, cfg);
      break;
    case "NAV": case "APR": case "BC":
      if ((key === "BC" && !cfg.bcKey) || !navKey(s, key, fs, cfg)) return st;
      break;
    case "ALT": case "VS": case "FLC": {
      if (fs.fail.air) return st;
      const m: Gfc700Vert = key;
      activateFd(s, fs, cfg);
      setVert(s, st.fd && s.vert === m ? "PIT" : m, fs, cfg);
      break;
    }
    case "VNV":
      if (s.vert === "VPTH") setVert(s, "PIT", fs, cfg);
      else if (s.vertArm.includes("VPTH")) s.vertArm = s.vertArm.filter((m) => m !== "VPTH");
      else if (fs.vpath) { activateFd(s, fs, cfg); s.vertArm = [...s.vertArm.filter((m) => m !== "VPTH"), "VPTH"]; }
      else return st; // a VNAV flight plan must be active
      break;
    case "NOSE_UP": case "NOSE_DN": {
      if (!s.fd) return st;
      const d = key === "NOSE_UP" ? 1 : -1;
      if (s.vert === "PIT") s.ref.pit = clamp(s.ref.pit + 0.5 * d, cfg.pitMin, cfg.pitMax);
      else if (s.vert === "VS") s.ref.vs = clamp(s.ref.vs + 100 * d, cfg.vsMin, cfg.vsMax);
      else if (s.vert === "FLC") s.ref.ias = clamp(s.ref.ias - d, cfg.flcMin, cfg.flcMax); // NOSE UP = slower
      else if (s.vert === "GA" || s.vert === "TO") { setVert(s, "PIT", fs, cfg); setLat(s, "ROL", fs, cfg); }
      else return st;
      break;
    }
    case "GA":
      if (s.ap) disconnect(s, now, "disc");
      s.fd = true; s.apr = false; s.src = null; s.latArm = null; s.latFlash = null; s.vertFlash = null;
      s.lat = s.vert = fs.onGround ? "TO" : "GA"; s.vertArm = ["ALTS"];
      break;
    case "AP_DISC":
      if (s.pft === "run") { s.pft = "fail"; break; } // pressing AP DISC during the preflight test can fail it (CRG)
      if (s.ap) disconnect(s, now, "disc");
      else if (s.apFlash || s.tone > now) { s.apFlash = null; s.tone = 0; } // acknowledge
      else return st;
      break;
    case "CWS":
      activateFd(s, fs, cfg);
      s.cws = true;
      break;
    case "CWS_UP":
      if (!st.cws) return st;
      s.cws = false;
      if (s.vert === "PIT") s.ref.pit = clamp(fs.pitch, cfg.pitMin, cfg.pitMax);
      if (s.vert === "VS") s.ref.vs = clamp(r100(fs.vs), cfg.vsMin, cfg.vsMax);
      if (s.vert === "FLC") s.ref.ias = clamp(Math.round(fs.ias), cfg.flcMin, cfg.flcMax);
      if (s.vert === "ALT") s.ref.alt = r10(fs.alt);
      if (s.lat === "ROL") s.ref.rol = holdBank(fs.roll, cfg.maxBank);
      if (s.vert === "GA" || s.vert === "TO") { setVert(s, "PIT", fs, cfg); setLat(s, "ROL", fs, cfg); }
      break;
    case "TRIM_UP": case "TRIM_DN":
      if (s.ap) disconnect(s, now, "disc"); // MET use disconnects the AP
      else if (s.apFlash || s.tone > now) { s.apFlash = null; s.tone = 0; }
      if (s.pft !== "pass" || s.fail.sys || s.fail.trim) break; // MET unavailable
      s.trim = clamp(s.trim + (key === "TRIM_UP" ? 0.04 : -0.04), -1, 1);
      break;
  }
  return s;
}

/** Per-frame logic: preflight test, sensor/nav losses, armed → active captures. Same object back when nothing changed. */
export function gfc700Tick(st: Gfc700State, fs: FlightState, cfg: Gfc700Cfg): Gfc700State {
  if (!st.powered) return st;
  const now = fs.t;
  let s: Gfc700State | null = null;
  const w = () => (s ??= { ...st, ref: { ...st.ref }, vertArm: [...st.vertArm] });

  if (st.pft === "run" && now >= st.pftEnd) { w().pft = st.fail.pft ? "fail" : "pass"; w().tone = now + 2; }
  if (st.ap && (st.fail.pitch || st.fail.roll || st.fail.sys || fs.fail.att || fs.fail.air)) disconnect(w(), now, "abnormal");
  if (st.fd && fs.fail.att) { const x = w(); x.fd = false; x.lat = "ROL"; x.latArm = null; x.vert = "PIT"; x.vertArm = []; }
  const c = s ?? st;
  if (!c.fd) return s ?? st;

  // sensor and navigation losses
  if (fs.fail.air && ["ALT", "ALTS", "VS", "FLC", "VPTH"].includes(c.vert)) loseVert(w(), fs, now, cfg);
  if (fs.fail.hdg && c.lat === "HDG") loseLat(w(), now, "hdg");
  const navLost = !fs.navValid || fs.navSrc !== c.src;
  if ((isNav(c.lat) || isNav(c.latArm)) && navLost) loseLat(w(), now, "nav");
  const c2 = s ?? st;
  if ((c2.vert === "GS" || c2.vert === "GP") && fs.gsErr == null) loseVert(w(), fs, now, cfg);

  // no BC key: NAV on a localizer shows LOC until the course is bcAngle from the heading, then BC (DA40 AFMS back-course note)
  const b = s ?? st;
  if (!cfg.bcKey && !b.apr) {
    const m = navLocMode(fs, cfg);
    if ((b.lat === "LOC" || b.lat === "BC") && b.lat !== m) w().lat = m;
    if ((b.latArm === "LOC" || b.latArm === "BC") && b.latArm !== m) w().latArm = m;
  }

  // lateral capture
  const c3 = s ?? st;
  if (c3.latArm && isNav(c3.latArm)) {
    const d = navDots(fs);
    if (d != null && Math.abs(d) <= 1) { const x = w(); x.lat = c3.latArm; x.latArm = null; x.latFlash = { text: x.lat, c: "g", until: now + 10 }; }
  }

  // vertical captures
  const v = s ?? st;
  const err = fs.selAlt - fs.alt;
  if (v.vertArm.includes("ALTS") && ALTS_MODES.includes(v.vert) && Math.sign(fs.vs) === Math.sign(err) && Math.abs(err) <= Math.max(50, Math.abs(fs.vs) / 5)) {
    const x = w();
    x.vert = "ALTS"; x.ref.alt = fs.selAlt; x.vertArm = ["ALT", ...pathArm(x.vertArm)];
    x.vertFlash = { text: "ALTS", c: "g", until: now + 10 };
  } else if (v.vert === "ALTS") {
    if (fs.selAlt !== v.ref.alt) { const x = w(); setVert(x, "PIT", fs, cfg); } // ALT knob turned during capture
    else if (Math.abs(fs.alt - v.ref.alt) < 50) {
      const x = w(); x.vert = "ALT"; x.vertArm = pathArm(x.vertArm); x.vertFlash = { text: "ALT", c: "g", until: now + 10 };
    }
  }
  const p = s ?? st;
  const path: Gfc700Vert | null = p.vertArm.includes("GS") ? "GS" : p.vertArm.includes("GP") ? "GP" : null;
  const latOk = path === "GS" ? p.lat === "LOC" : p.lat === "GPS";
  const g = gsDots(fs);
  if (path && latOk && p.apr && g != null && g >= -0.15 && g <= 0.3) {
    const x = w(); x.vert = path; x.vertArm = []; x.vertFlash = { text: path, c: "g", until: now + 10 };
  }
  const q = s ?? st;
  if (q.vertArm.includes("VPTH") && fs.vpath && Math.abs(fs.vpath.err) < 40 && fs.selAlt < fs.alt - 75) {
    const x = w(); x.vert = "VPTH"; x.vertArm = ["ALTS", ...pathArm(x.vertArm)]; x.vertFlash = { text: "VPTH", c: "g", until: now + 10 };
  }
  return s ?? st;
}

/** Overspeed protection active (MAXSPD). */
const overspeed = (st: Gfc700State, fs: FlightState, cfg: Gfc700Cfg) =>
  st.fd && fs.ias > cfg.vmo && ["PIT", "VS", "FLC", "VPTH"].includes(st.vert);

/** Flight director command (what the command bars show and the servos fly when engaged); null with the FD off. */
export function gfc700Command(st: Gfc700State, fs: FlightState, cfg: Gfc700Cfg): FlightCmd | null {
  if (!st.powered || !st.fd) return null;
  const maxB = Math.min(cfg.maxBank, Math.max(stdRateBank(fs), 12));
  let bank = 0;
  switch (st.lat) {
    case "ROL": bank = st.ref.rol; break;
    case "HDG": bank = bankToHdg(fs, fs.hdgBug, maxB); break;
    case "BC": bank = bankToHdg(fs, trackHdg(fs, true), maxB); break;
    case "GPS": case "VOR": case "LOC": case "VAPP": bank = bankToHdg(fs, trackHdg(fs), maxB); break;
    default: bank = 0; // GA / TO: wings level
  }
  let vs: number | undefined, pitch: number | undefined;
  switch (st.vert) {
    case "PIT": pitch = st.ref.pit; break;
    case "VS": vs = st.ref.vs; break;
    case "FLC": {
      const up = fs.selAlt > fs.alt;
      vs = vsForIas(fs, st.ref.ias, cfg.flight) + (fs.ias - st.ref.ias) * 40;
      vs = up ? Math.max(0, vs) : Math.min(0, vs); // never away from the Selected Altitude
      break;
    }
    case "ALT": case "ALTS": vs = clamp((st.ref.alt - fs.alt) * 5, -1500, 1500); break;
    case "GS": case "GP": vs = pathVs(fs) - clamp((fs.gsErr ?? 0) * 6, -600, 600); break;
    case "VPTH": vs = fs.vpath ? fs.vpath.vs - clamp(fs.vpath.err * 4, -500, 500) : 0; break;
    default: pitch = cfg.gaPitch; // GA / TO
  }
  if (overspeed(st, fs, cfg)) {
    const lim = vsForIas(fs, cfg.vmo, cfg.flight) + (fs.ias - cfg.vmo) * 60;
    vs = Math.max(vs ?? vsForPitch(fs, pitch ?? 0), lim); pitch = undefined;
  }
  if (pitch != null) pitch = clamp(pitch, cfg.pitMin, cfg.pitMax);
  return { bank, vs, pitch };
}

const blank = (f: Gfc700Flash | null, now: number) => (f && f.until > now ? f : null);

/** Mode annunciations for the PFD AFCS status bar (null when unpowered). */
export function gfc700Annunc(st: Gfc700State, fs: FlightState, cfg: Gfc700Cfg): AfcsAnnunc | null {
  if (!st.powered) return null;
  const now = fs.t, f = st.fail;
  const sys: AfcsAnnunc["sys"] =
    st.pft === "run" ? { text: "PFT", level: "a" } : st.pft === "fail" ? { text: "PFT", level: "w" } :
    f.sys ? { text: "AFCS", level: "w" } : f.pitch ? { text: "PTCH", level: "w" } : f.roll ? { text: "ROLL", level: "w" } :
    f.trim ? { text: "PTRM", level: "w", flash: true } : f.mistrim ? { text: f.mistrim, level: "c" } : null;
  const apF = st.apFlash && st.apFlash.until > now ? st.apFlash.kind : null;
  const base: AfcsAnnunc = { ap: st.ap, fd: st.fd, yd: cfg.hasYD ? st.yd : undefined, cws: st.cws && st.ap, lat: "", vert: "", apFlash: apF, sys, tone: st.tone > now };
  if (!st.fd) return base;
  const lf = blank(st.latFlash, now), vf = blank(st.vertFlash, now);
  const cmd = gfc700Command(st, fs, cfg);
  const ref = st.vert === "ALT" || st.vert === "ALTS" ? `${Math.round(st.ref.alt)}FT`
    : st.vert === "VS" ? `${st.ref.vs > 0 ? "↑" : st.ref.vs < 0 ? "↓" : ""}${Math.abs(st.ref.vs)}FPM`
    : st.vert === "FLC" ? `${st.ref.ias}KT` : undefined;
  return {
    ...base,
    lat: lf?.c === "y" ? lf.text : st.lat, latFlash: lf?.c ?? null, latArm: st.latArm ?? undefined,
    vert: vf?.c === "y" ? vf.text : st.vert, vertFlash: vf?.c ?? null, vertRef: vf?.c === "y" ? undefined : ref,
    vertArm: st.vertArm.length ? st.vertArm.join(" ") : undefined,
    iasRef: st.vert === "FLC" ? st.ref.ias : null, vsRef: st.vert === "VS" ? st.ref.vs : null,
    maxspd: overspeed(st, fs, cfg),
    // command bars; during CWS the FD is synchronized to the airplane's attitude
    cmd: !cmd || fs.fail.att ? null : st.cws ? { roll: fs.roll, pitch: fs.pitch } : { roll: cmd.bank, pitch: cmd.pitch ?? pitchFor(fs, cmd.vs ?? fs.vs) },
  };
}
