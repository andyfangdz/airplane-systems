/**
 * Bendix/King KAP 140 two-axis autopilot with altitude preselect (C182T NAV III, POH Supplement 3) —
 * pure logic plus `drawKap140` for its LCD. Behaviour from the supplement:
 * - Power-up: preflight self-test "PFT 1…", then display test (all segments + PITCH TRIM on the PFD) and the
 *   disconnect tone. The red P may stay on ~30 s (pitch axis can't engage meanwhile). BARO then flashes until set.
 * - AP (press & hold ~0.25 s) engages ROL + VS at the current vertical speed. HDG toggles HDG/ROL.
 * - NAV / APR / REV: capture at once with the D-bar within ~2–3 dots, otherwise "ARM" while the AP flies the
 *   heading bug (the intercept heading, S3-11 item 15; from ROL it goes to HDG) and HDG flashes 5 s to remind
 *   you to set it (S3-18). APR on an ILS arms GS at localizer capture; REV (back course) works only on a
 *   LOC/ILS (S3-9 item 7) and locks the glideslope out. Selected with a flagged source: ROL, symbol flashing.
 * - UP/DN: VS ±100 fpm per press (300 fpm/s held); in ALT ±20 ft per press (held: 500 fpm, new ALT on release).
 *   VS limits +1500 / −2000 fpm.
 * - Knobs set the alerter / preselect altitude (arms ALT automatically with the AP engaged); ARM toggles ALT ARM.
 *   ALERT: steady 1000→200 ft approaching, flashing 200→1000 ft leaving, flashes 2 s at the first crossing.
 * - A/P DISC/TRIM INT, MET use or AP button: AP flashes + 2 s tone. Nav source switched or signal lost in
 *   NAV/APR/REV: reverts to ROL with the old mode symbol flashing — no chime, no PFD annunciation.
 * - PT arrows show autotrim direction; solid PT without arrow = trim fault (red PITCH TRIM on the PFD).
 */
import {
  bankToHdg,
  gsDots,
  isLoc,
  navDots,
  pathVs,
  stdRateBank,
  trackHdg,
  type FlightCmd,
  type FlightState,
  type NavSrc,
} from "./flight";

export type Kap140Lat = "ROL" | "HDG" | "NAV" | "APR" | "REV";
export type Kap140Vert = "VS" | "ALT" | "GS";
/**
 * Buttons and switches. UP/DN = one momentary press; UP_HOLD/DN_HOLD = still held after ~0.5 s; RELEASE = let go.
 * BARO_HOLD = BARO held 2 s (IN HG ↔ HPA). INNER_* ±100 ft (or ±0.01 inHg / 1 hPa), OUTER_* ±1000 ft (±0.10 inHg / 10 hPa).
 * DISC = A/P DISC/TRIM INT on the left yoke; MET_UP/MET_DN = manual electric trim (both halves).
 */
export type Kap140Key =
  | "AP"
  | "HDG"
  | "NAV"
  | "APR"
  | "REV"
  | "ALT"
  | "UP"
  | "DN"
  | "UP_HOLD"
  | "DN_HOLD"
  | "RELEASE"
  | "ARM"
  | "BARO"
  | "BARO_HOLD"
  | "INNER_INC"
  | "INNER_DEC"
  | "OUTER_INC"
  | "OUTER_DEC"
  | "DISC"
  | "MET_UP"
  | "MET_DN";

/** Injected failures: P / R = pitch / roll axis (red P / R, AP disengages and can't engage), trim = pitch trim fault. */
export interface Kap140Fail {
  p?: boolean;
  r?: boolean;
  trim?: boolean;
}

export interface Kap140State {
  powered: boolean;
  /** Power-on time (s). PFT 1…5 runs 5 s, display test 2 s, then `ready`. */
  on: number;
  ready: boolean;
  ap: boolean;
  lat: Kap140Lat;
  latArm: "NAV" | "APR" | "REV" | null;
  vert: Kap140Vert;
  gsArm: boolean;
  /** ALT ARM: capture the preselect altitude while climbing/descending in VS. */
  altArm: boolean;
  /** VS reference (fpm) and ALT hold reference (ft). */
  vsRef: number;
  altRef: number;
  /** Alerter / preselect altitude set on the KAP 140 knobs — independent of the G1000 ALT SEL. */
  selAlt: number;
  /** Autopilot baro setting (inHg), shown in hPa when `hpa`. `baroSet` false = BARO flashes after power-up. */
  baro: number;
  hpa: boolean;
  baroSet: boolean;
  /** Right-hand display: preselect altitude, VS reference (3 s after UP/DN) or baro (3 s after BARO). */
  disp: "alt" | "vs" | "baro";
  dispUntil: number;
  /** UP/DN held (after UP_HOLD/DN_HOLD) — continuous VS change or 500 fpm altitude change. */
  hold: "UP" | "DN" | null;
  /** Navigation source the nav mode was selected on. */
  src: NavSrc | null;
  /** Flash ends (s): AP after a disconnect, HDG after NAV/APR/REV selection. */
  apFlash: number;
  hdgFlash: number;
  /** Mode symbol left flashing after a reversion (until the next mode selection). */
  lostLat: Kap140Lat | null;
  lostGs: boolean;
  /** Altitude alerter memory: zone (at ≤ 200 ft, near 200–1000 ft, out), where `near` was entered from, first crossing done, flash end. */
  alert: { zone: "at" | "near" | "out"; from: "at" | "out"; side: number; crossed: boolean; flashUntil: number };
  /** Aural: tone sounding until (s), and which. */
  tone: number;
  toneKind: "disc" | "alert" | "pft" | null;
  fail: Kap140Fail;
  /** Autotrim direction (PT arrow) while engaged. */
  pt: "up" | "dn" | null;
  /** Pitch trim position −1…+1 (MET / autotrim visual). */
  trim: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r10 = (v: number) => Math.round(v / 10) * 10;
const r100 = (v: number) => Math.round(v / 100) * 100;
const VS_MIN = -2000,
  VS_MAX = 1500;
const PFT_S = 5,
  TEST_S = 2,
  P_S = 30;

export function kap140Init(): Kap140State {
  return {
    powered: false,
    on: 0,
    ready: false,
    ap: false,
    lat: "ROL",
    latArm: null,
    vert: "VS",
    gsArm: false,
    altArm: false,
    vsRef: 0,
    altRef: 0,
    selAlt: 0,
    baro: 29.92,
    hpa: false,
    baroSet: false,
    disp: "alt",
    dispUntil: 0,
    hold: null,
    src: null,
    apFlash: 0,
    hdgFlash: 0,
    lostLat: null,
    lostGs: false,
    alert: { zone: "out", from: "out", side: 0, crossed: false, flashUntil: 0 },
    tone: 0,
    toneKind: null,
    fail: {},
    pt: null,
    trim: 0,
  };
}

/** Power on/off (AVIONICS BUS 2 + AUTO PILOT breaker). Idempotent — call every tick. Keeps the preselect altitude and baro. */
export function kap140Power(st: Kap140State, on: boolean, now: number): Kap140State {
  if (on === st.powered) return st;
  const keep = { selAlt: st.selAlt, baro: st.baro, hpa: st.hpa, fail: st.fail, trim: st.trim };
  return on ? { ...kap140Init(), ...keep, powered: true, on: now } : { ...kap140Init(), ...keep };
}

/** Self-test phase: "pft" (with step 1…5), "test" (display test), "ready". */
export function kap140Phase(st: Kap140State, now: number): { ph: "off" | "pft" | "test" | "ready"; step: number } {
  if (!st.powered) return { ph: "off", step: 0 };
  const t = now - st.on;
  return t < PFT_S
    ? { ph: "pft", step: Math.floor(t) + 1 }
    : t < PFT_S + TEST_S && !st.ready
      ? { ph: "test", step: 0 }
      : { ph: "ready", step: 0 };
}
/** Red P lit: pitch axis failed, or within ~30 s of power-up. */
export const kap140P = (st: Kap140State, now: number) => st.powered && (!!st.fail.p || now - st.on < P_S);
/** Red R lit: roll axis failed. */
export const kap140R = (st: Kap140State) => st.powered && !!st.fail.r;
/** Text for the PFD's red PITCH TRIM annunciation (trim fault, or during the display test); null when off. */
export function kap140Pfd(st: Kap140State, now: number): string | null {
  return st.powered && (st.fail.trim || kap140Phase(st, now).ph === "test") ? "PITCH TRIM" : null;
}

function disengage(s: Kap140State, now: number) {
  s.ap = false;
  s.hold = null;
  s.pt = null;
  s.apFlash = now + 5;
  s.tone = now + 2;
  s.toneKind = "disc";
}

/** Set or clear failures; any of them with the AP engaged disengages it. */
export function kap140Fail(st: Kap140State, f: Kap140Fail, now: number): Kap140State {
  const s: Kap140State = { ...st, fail: { ...st.fail, ...f } };
  if (s.ap && (s.fail.p || s.fail.r || s.fail.trim)) disengage(s, now);
  return s;
}

/** NAV / APR / REV key; false when it does nothing. */
function navSelect(s: Kap140State, m: "NAV" | "APR" | "REV", fs: FlightState, now: number): boolean {
  if (s.lat === m || s.latArm === m) {
    if (s.lat === m) s.lat = "ROL";
    s.latArm = null;
    s.gsArm = false;
    return true;
  }
  if (m === "REV" && !isLoc(fs.navSrc)) return false; // REV is active only with a LOC/ILS tuned (S3-9 item 7)
  // flagged source: the symbol flashes and the autopilot is in its default lateral mode, ROL (S3-18)
  if (!fs.navValid) {
    s.lostLat = m;
    s.lat = "ROL";
    s.latArm = null;
    s.gsArm = false;
    return true;
  }
  s.src = fs.navSrc;
  s.lostLat = null;
  s.gsArm = false;
  s.hdgFlash = now + 5;
  const d = navDots(fs) ?? 9;
  if (Math.abs(d) < 2.5) {
    s.lat = m;
    s.latArm = null;
    if (m === "APR" && isLoc(fs.navSrc) && fs.gsErr != null) s.gsArm = true;
  } else {
    s.latArm = m;
    if (s.lat === "ROL") s.lat = "HDG";
  } // armed: the heading bug is the datum (S3-11 item 15)
  return true;
}

/** Apply a button / knob / switch. Returns the same state when it does nothing. */
export function kap140Key(st: Kap140State, key: Kap140Key, fs: FlightState): Kap140State {
  if (!st.powered) return st;
  const now = fs.t,
    s: Kap140State = { ...st, alert: { ...st.alert } };
  const ready = kap140Phase(st, now).ph === "ready";
  if (!ready && key !== "DISC") return st;
  switch (key) {
    case "AP":
      if (s.ap) {
        disengage(s, now);
        break;
      }
      if (kap140P(st, now) || kap140R(st) || st.fail.trim || fs.fail.att) return st;
      Object.assign(s, {
        ap: true,
        lat: "ROL",
        latArm: null,
        vert: "VS",
        gsArm: false,
        vsRef: clamp(r100(fs.vs), VS_MIN, VS_MAX),
        apFlash: 0,
        tone: 0,
        lostLat: null,
        lostGs: false,
      });
      break;
    case "HDG":
      if (!s.ap) return st;
      s.lat = s.lat === "HDG" ? "ROL" : "HDG";
      s.lostLat = null;
      break;
    case "NAV":
    case "APR":
    case "REV":
      if (!s.ap || !navSelect(s, key, fs, now)) return st;
      break;
    case "ALT":
      if (!s.ap) return st;
      if (s.vert === "ALT") {
        s.vert = "VS";
        s.vsRef = clamp(r100(fs.vs), VS_MIN, VS_MAX);
      } else {
        s.vert = "ALT";
        s.altRef = r10(fs.alt);
      }
      s.lostGs = false;
      break;
    case "UP":
    case "DN": {
      if (!s.ap) return st;
      const d = key === "UP" ? 1 : -1;
      if (s.vert === "VS") {
        s.vsRef = clamp(s.vsRef + 100 * d, VS_MIN, VS_MAX);
        s.disp = "vs";
        s.dispUntil = now + 3;
      } else if (s.vert === "ALT") s.altRef += 20 * d;
      else return st;
      break;
    }
    case "UP_HOLD":
    case "DN_HOLD":
      if (!s.ap || s.vert === "GS") return st;
      s.hold = key === "UP_HOLD" ? "UP" : "DN";
      break;
    case "RELEASE":
      if (!s.hold) return st;
      if (s.vert === "ALT") s.altRef = r10(fs.alt);
      s.hold = null;
      break;
    case "ARM":
      s.altArm = !s.altArm;
      break;
    case "BARO":
      s.disp = "baro";
      s.dispUntil = now + 3;
      s.baroSet = true;
      break;
    case "BARO_HOLD":
      s.hpa = !s.hpa;
      s.disp = "baro";
      s.dispUntil = now + 3;
      s.baroSet = true;
      break;
    case "INNER_INC":
    case "INNER_DEC":
    case "OUTER_INC":
    case "OUTER_DEC": {
      const d = key.endsWith("INC") ? 1 : -1,
        big = key.startsWith("OUTER");
      if ((s.disp === "baro" && now < s.dispUntil) || !s.baroSet) {
        const step = s.hpa ? (big ? 10 : 1) / 33.8639 : big ? 0.1 : 0.01;
        s.baro = clamp(Math.round((s.baro + d * step) * 1000) / 1000, 27.5, 31.5);
        s.disp = "baro";
        s.dispUntil = now + 3;
        s.baroSet = true;
      } else {
        s.selAlt = clamp(s.selAlt + d * (big ? 1000 : 100), 0, 35000);
        s.disp = "alt";
        s.dispUntil = 0;
        s.alert = { zone: "out", from: "out", side: Math.sign(fs.alt - s.selAlt), crossed: false, flashUntil: 0 };
        if (s.ap && s.vert !== "GS") s.altArm = true; // selecting an altitude arms ALT with the AP engaged
      }
      break;
    }
    case "DISC":
      if (!s.ap) return st;
      disengage(s, now);
      break;
    case "MET_UP":
    case "MET_DN":
      if (s.ap) disengage(s, now); // MET use disengages the autopilot
      if (!s.fail.trim) s.trim = clamp(s.trim + (key === "MET_UP" ? 0.04 : -0.04), -1, 1);
      break;
  }
  return s;
}

/** Per-frame logic: self-test, holds, captures, reversions, alerter, PT arrow. Same object back when nothing changed. */
export function kap140Tick(st: Kap140State, fs: FlightState, dt: number): Kap140State {
  if (!st.powered) return st;
  const now = fs.t;
  let s: Kap140State | null = null;
  const w = () => (s ??= { ...st, alert: { ...st.alert } });
  const c = () => s ?? st;

  if (!st.ready && now - st.on >= PFT_S + TEST_S) {
    const x = w();
    x.ready = true;
    x.tone = now + 2;
    x.toneKind = "pft";
  }
  if (st.ap && (kap140P(st, now) || kap140R(st) || st.fail.trim || fs.fail.att)) disengage(w(), now);
  if (!c().ready) return c();

  // continuous UP/DN
  if (c().ap && c().hold && c().vert === "VS") {
    const x = w();
    x.vsRef = clamp(x.vsRef + (x.hold === "UP" ? 300 : -300) * dt, VS_MIN, VS_MAX);
    x.disp = "vs";
    x.dispUntil = now + 3;
  }
  // reversions: nav source switched / signal lost → ROL, old symbol flashes
  const a = c();
  if (
    a.ap &&
    (a.lat === "NAV" || a.lat === "APR" || a.lat === "REV" || a.latArm) &&
    (!fs.navValid || fs.navSrc !== a.src)
  ) {
    const x = w();
    x.lostLat = x.latArm ?? x.lat;
    x.lat = "ROL";
    x.latArm = null;
    x.gsArm = false;
    if (x.vert === "GS") {
      x.vert = "VS";
      x.vsRef = clamp(r100(fs.vs), VS_MIN, VS_MAX);
      x.lostGs = true;
    }
  }
  if (c().ap && c().vert === "GS" && fs.gsErr == null) {
    const x = w();
    x.vert = "VS";
    x.vsRef = clamp(r100(fs.vs), VS_MIN, VS_MAX);
    x.lostGs = true;
    x.gsArm = true;
  }
  if (c().lostGs && c().gsArm && fs.gsErr != null && c().vert !== "GS") w().lostGs = false;
  // lateral capture, then GS arming at localizer lock-on
  const b = c(),
    d = navDots(fs);
  if (b.ap && b.latArm && d != null && Math.abs(d) < 2) {
    const x = w();
    x.lat = b.latArm;
    x.latArm = null;
    if (x.lat === "APR" && isLoc(fs.navSrc) && fs.gsErr != null) x.gsArm = true;
  }
  // glideslope capture (locks out the preselect)
  const g = gsDots(fs),
    e = c();
  if (e.ap && e.gsArm && e.lat === "APR" && g != null && g >= -0.15 && g <= 0.3) {
    const x = w();
    x.vert = "GS";
    x.gsArm = false;
    x.altArm = false;
  }
  // altitude preselect capture
  const f = c(),
    err = f.selAlt - fs.alt;
  if (
    f.ap &&
    f.altArm &&
    f.vert === "VS" &&
    !f.hold &&
    Math.sign(fs.vs) === Math.sign(err) &&
    Math.abs(err) <= Math.max(30, Math.abs(fs.vs) * 0.15)
  ) {
    const x = w();
    x.vert = "ALT";
    x.altRef = f.selAlt;
    x.altArm = false;
  }
  // altitude alerter
  const al = c().alert,
    dist = Math.abs(fs.alt - c().selAlt),
    side = Math.sign(fs.alt - c().selAlt);
  const zone = dist <= 200 ? "at" : dist <= 1000 ? "near" : "out";
  if (zone !== al.zone || (side !== al.side && side !== 0)) {
    const x = w(),
      n = { ...al, zone } as Kap140State["alert"];
    if (zone === "near" && al.zone !== "near") {
      n.from = al.zone === "at" ? "at" : "out";
      x.tone = now + 1.5;
      x.toneKind = "alert";
    }
    if (side !== al.side && side !== 0 && al.side !== 0 && !al.crossed) {
      n.crossed = true;
      n.flashUntil = now + 2;
    }
    if (side !== 0) n.side = side;
    x.alert = n;
  }
  // PT arrow: autotrim follows the commanded pitch change
  const h = c();
  const cmd = kap140Command(h, fs);
  const pt = !cmd || h.fail.trim ? null : cmd.vs! - fs.vs > 80 ? "up" : cmd.vs! - fs.vs < -80 ? "dn" : null;
  if (pt !== h.pt) w().pt = pt;
  if (pt) {
    const x = w();
    x.trim = clamp(x.trim + (pt === "up" ? 0.02 : -0.02) * dt, -1, 1);
  }
  return c();
}

/** What the servos fly while engaged (null when disengaged). Standard-rate turns, limited to ~18°; ALT holds with ±20 ft steps, held UP/DN = ±500 fpm. */
export function kap140Command(st: Kap140State, fs: FlightState): FlightCmd | null {
  if (!st.powered || !st.ap) return null;
  // "the KAP 140 limits bank angle in the 182T to approximately 18°" — Supplement 3 as bound in the N780CP POH
  // (182TPHAUS-S3-01) p. S3-35; Rev 2 (S3-02) gives no figure
  const maxB = Math.min(stdRateBank(fs), 18);
  const bank =
    st.lat === "HDG"
      ? bankToHdg(fs, fs.hdgBug, maxB)
      : st.lat === "NAV" || st.lat === "APR"
        ? bankToHdg(fs, trackHdg(fs), maxB)
        : st.lat === "REV"
          ? bankToHdg(fs, trackHdg(fs, true), maxB)
          : 0;
  const held = st.hold ? (st.hold === "UP" ? 500 : -500) : null;
  const vs =
    st.vert === "VS"
      ? st.vsRef
      : st.vert === "ALT"
        ? (held ?? clamp((st.altRef - fs.alt) * 5, -1000, 1000))
        : pathVs(fs) - clamp((fs.gsErr ?? 0) * 6, -600, 600);
  return { bank, vs };
}

/* ---------- LCD ---------- */

const LIT = "#ECEFE6",
  RED = "#FF3B30",
  GHOST = "rgba(236,239,230,0.07)";
const font = (px: number, w = "bold") =>
  `${w} ${px}px "DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, monospace`;
const sfont = (px: number, w = "bold") => `${w} ${px}px Arial, "Liberation Sans", Helvetica, sans-serif`;

/**
 * Draw the KAP 140 display (≈ 4:1 canvas, e.g. 400×100). Lateral mode and ARM on the left, AP and PT in the
 * middle, vertical mode and ARM, ALERT and the altitude / VS / baro readout on the right, R and P bottom left.
 */
export function drawKap140(ctx: CanvasRenderingContext2D, W: number, H: number, st: Kap140State, now: number) {
  const k = Math.min(W / 400, H / 100);
  ctx.save();
  ctx.fillStyle = "#050606";
  ctx.fillRect(0, 0, W, H);
  ctx.translate((W - 400 * k) / 2, (H - 100 * k) / 2);
  ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 0, 100);
  g.addColorStop(0, "#121614");
  g.addColorStop(1, "#0A0D0C");
  ctx.fillStyle = g;
  ctx.fillRect(2, 2, 396, 96);
  ctx.textBaseline = "alphabetic";
  const blink = Math.floor(now * 2.5) % 2 === 0;
  const t = (s: string, x: number, y: number, px: number, c = LIT, align: CanvasTextAlign = "left", f = sfont) => {
    ctx.font = f(px);
    ctx.fillStyle = c;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const ph = kap140Phase(st, now);
  // ghost digits (unlit LCD segments)
  t("88888", 356, 62, 27, GHOST, "right", font);
  if (ph.ph === "off") {
    ctx.restore();
    return;
  }
  if (ph.ph === "pft") {
    t("PFT", 196, 62, 26);
    t(String(ph.step), 356, 62, 27, LIT, "right", font);
    dotsRP(true);
    ctx.restore();
    return;
  }
  const test = ph.ph === "test";

  // lateral
  const lostL = st.lostLat && blink ? st.lostLat : null;
  const latTxt = test
    ? "HDG"
    : st.ap
      ? st.lostLat
        ? (lostL ?? "")
        : st.lat === "HDG" && st.hdgFlash > now && !blink
          ? ""
          : st.lat
      : "";
  if (latTxt) t(latTxt, 14, 40, 27);
  const armL = test ? "NAV" : st.ap && st.latArm ? st.latArm : "";
  if (armL) {
    t(armL, 14, 74, 20);
    t("ARM", 64, 74, 13);
  }
  // AP
  const apOn = test || st.ap || (st.apFlash > now && blink);
  if (apOn) t("AP", 150, 40, 27);
  // PT
  if (test || st.pt || st.fail.trim) {
    t("PT", 150, 74, 18, RED);
    if (test || st.pt === "up") tri(186, 60, -1);
    if (test || st.pt === "dn") tri(186, 70, 1);
  }
  // vertical
  const vTxt = test ? "ALT" : st.ap ? (st.lostGs && st.vert !== "GS" && blink ? "GS" : st.lostGs ? "" : st.vert) : "";
  if (vTxt) t(vTxt, 200, 40, 27);
  const vArm = test ? "GS" : st.ap && st.gsArm ? "GS" : st.altArm ? "ALT" : "";
  if (vArm) {
    t(vArm, 200, 74, 20);
    t("ARM", vArm === "GS" ? 232 : 241, 74, 13);
  }
  // ALERT
  const a = st.alert;
  const alertOn = test || (now < a.flashUntil ? blink : a.zone === "near" ? (a.from === "at" ? blink : true) : false);
  if (alertOn) t("ALERT", 300, 22, 13);
  // right-hand readout
  if (test) {
    t("88888", 356, 62, 27, LIT, "right", font);
    t("FT", 362, 62, 12);
    t("FPM", 362, 76, 10);
    t("IN HG", 362, 88, 9);
  } else {
    const mode = !st.baroSet ? "baro" : now < st.dispUntil ? st.disp : "alt";
    if (mode === "baro") {
      if (st.baroSet || blink) {
        t(st.hpa ? String(Math.round(st.baro * 33.8639)) : st.baro.toFixed(2), 356, 62, 27, LIT, "right", font);
        t(st.hpa ? "HPA" : "IN HG", 362, 62, 11);
      }
    } else if (mode === "vs") {
      t((st.vsRef > 0 ? "+" : "") + Math.round(st.vsRef), 356, 62, 27, LIT, "right", font);
      t("FPM", 362, 62, 11);
    } else {
      t(st.selAlt.toLocaleString("en-US"), 356, 62, 27, LIT, "right", font);
      t("FT", 362, 62, 12);
    }
  }
  dotsRP(test);
  ctx.restore();

  function tri(x: number, y: number, dir: number) {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4 * dir);
    ctx.lineTo(x + 6, y - 4 * dir);
    ctx.lineTo(x, y + 5 * dir);
    ctx.closePath();
    ctx.fill();
  }
  function dotsRP(all: boolean) {
    if (all || kap140R(st)) t("R", 14, 94, 14, RED);
    if (all || kap140P(st, now)) t("P", 32, 94, 14, RED);
  }
}
