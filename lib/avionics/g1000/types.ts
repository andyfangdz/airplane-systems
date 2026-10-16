/** Data the G1000 / Perspective+ drawing takes: everything it shows comes from these. */
import type { CasLevel } from "@/lib/systems";

/** HSI navigation source (CDI softkey). */
export type NavSrc = "GPS" | "VOR1" | "VOR2" | "LOC1" | "LOC2";

/** Everything the PFD shows about the airplane. `flightData()` in ../flight builds it from a FlightState. */
export interface FlightData {
  /** Attitude (deg): pitch + nose up, roll + right wing down; slip/skid ball −1..1 (+ = ball right). */
  pitch: number;
  roll: number;
  slip?: number;
  /** Indicated / true / ground speed (kt). */
  ias: number;
  tas?: number;
  gs?: number;
  /** Indicated altitude (ft) and vertical speed (fpm). */
  alt: number;
  vs: number;
  /** Heading and track (deg magnetic). */
  hdg: number;
  trk?: number;
  /** Altimeter setting (inHg) and outside air temperature (°C). */
  baro: number;
  oat: number;
  /** Heading bug and selected course (deg). */
  hdgBug: number;
  crs: number;
  /** Course deviation −1..1 of full scale (± 2 dots; + = course to the right). Undefined = no D-bar (invalid signal). */
  cdi?: number;
  /** Glideslope (LOC source) / glidepath (GPS source) deviation in dots (+ = path above, fly up). null = scale without diamond; undefined = hidden. */
  gsDev?: number | null;
  navSrc: NavSrc;
  /** Selected altitude (ft) — the cyan box and bug on the altimeter. */
  selAlt?: number;
  /** Radios as [active, standby]. Defaults are shown when omitted. */
  com1?: [string, string];
  com2?: [string, string];
  nav1?: [string, string];
  nav2?: [string, string];
  /** Transponder code and mode (e.g. "1200", "ALT"), clock text (e.g. "14:05:22": local time, UTC in the "perspective" style). */
  xpdr?: string;
  xpdrMode?: string;
  time?: string;
  /** Airspeed predicted 6 s ahead minus current (kt) — magenta trend vector. */
  iasTrend?: number;
  /** Turn rate (deg/s, + right) — magenta turn-rate vector above the HSI. */
  turnRate?: number;
  /** Navigation status box text (top centre). Default "<source> DTK nnn° TRK nnn°". */
  navStatus?: string;
  /** Position (nm east, nm north) and cross-track distance (nm right of course) for the moving map. */
  pos?: [number, number];
  xtk?: number;
  /** Failed instruments: red X over attitude (AHRS), heading/HSI, or airspeed/altitude/VSI (air data). */
  fail?: { att?: boolean; air?: boolean; hdg?: boolean };
}

/** Airspeed tape colour bands (kt) and V-speed bugs. */
export interface SpeedBands {
  /** Flap operating range (white), normal range (green), caution range (yellow). */
  white?: [number, number];
  green?: [number, number];
  yellow?: [number, number];
  /** Vne: red/white barber pole above it, red pointer at or beyond it. */
  red?: number;
  /** Low-speed awareness: red from 20 kt up to this speed, then yellow up to the bottom of the white/green band. Default: red all the way. */
  lowRed?: number;
  /** Cyan V-speed references on the tape: Vr, Vx, Vy, best glide. */
  vr?: number;
  vx?: number;
  vy?: number;
  vg?: number;
}

/** AFCS status bar content (GFC 700): `gfc700Annunc()` builds it. */
export interface AfcsAnnunc {
  /** Autopilot engaged (green AP), flight director on (modes shown), yaw damper (green YD, if installed). */
  ap: boolean;
  fd: boolean;
  yd?: boolean;
  /** CWS held with the AP engaged: white "CWS" replaces "AP". */
  cws?: boolean;
  /** Lateral active (green) and armed (white) modes, e.g. "HDG" / "GPS". */
  lat: string;
  latArm?: string;
  /** Vertical active (green) with its reference (e.g. "VS" + "↑500FPM", "ALT" + "6000FT", "FLC" + "90KT") and armed modes (white, e.g. "ALTS GS"). */
  vert: string;
  vertRef?: string;
  vertArm?: string;
  /** Active field flashing: "g" = automatic transition (green, 10 s), "y" = mode lost (yellow, 10 s; text is the lost mode). */
  latFlash?: "g" | "y" | null;
  vertFlash?: "g" | "y" | null;
  /** Flashing AP: "disc" = yellow (normal disconnect, 5 s), "abnormal" = red (until acknowledged). */
  apFlash?: "disc" | "abnormal" | null;
  /** AFCS system status annunciation left of the bar: PFT (white running / red failed), AFCS, PTCH, ROLL, PTRM (red), ↑ELE ↓ELE ←AIL AIL→ (yellow). */
  sys?: { text: string; level: CasLevel; flash?: boolean } | null;
  /** Disconnect tone sounding (for the panel UI; not drawn on the PFD). */
  tone?: boolean;
  /** FLC airspeed reference (cyan box + bug on the airspeed tape) and VS reference (cyan box + bug on the VSI). */
  iasRef?: number | null;
  vsRef?: number | null;
  /** Overspeed protection active: flashing yellow MAXSPD above the airspeed tape. */
  maxspd?: boolean;
  /** Flight director command bars (attitude, deg). */
  cmd?: { pitch: number; roll: number } | null;
}

/**
 * Display family. "g1000" (default): Garmin G1000 as in the Cessna NAV III and DA40. "perspective": Cirrus Perspective+
 * (Pilot's Guide 190-02183-03): a "% Power" box instead of the NAV box on the PFD and no COM box on the MFD (Fig 2-1, 3-1),
 * a Flight ID box under the COM box, mixed-case softkey labels with OBS subdued, GS beside TAS (p. 48), UTC clock, no
 * HDG / CRS readouts beside the heading box (shown only while being set, POH 7-21), a frameless left-aligned CAS window
 * right of the altimeter and VSI starting at the altitude pointer (Fig A-2), and OAT in °C and °F (p. 69). Everything
 * else is drawn the same.
 */
export type GduStyle = "g1000" | "perspective";

export interface PfdData {
  f: FlightData;
  speeds: SpeedBands;
  /** Display family; default "g1000". */
  style?: GduStyle;
  /** Perspective+ "% Power" box (top left of the PFD); null or undefined shows dashes. Not drawn in the "g1000" style. */
  pctPower?: number | null;
  /** Annunciation window right of the altimeter: [level, text] (red warnings, yellow cautions, white advisories). */
  alerts: [CasLevel, string][];
  /** GFC 700 status bar; omit (or null) for airplanes without it (e.g. KAP 140 C182T). */
  afcs?: AfcsAnnunc | null;
  /** Red "PITCH TRIM" annunciation (KAP 140 installations: `kap140Pfd()`), shown at the top of the annunciation window. */
  pitchTrim?: string | null;
  /** Sensor comparator annunciations, dual-sensor installations only; omit (or empty) for none. */
  comparators?: Comparator[];
  /** Reversionary sensor window text above the roll scale, e.g. "USING AHRS2" (PG 190-02183-01 Fig 2-48, Table 2-5). */
  reversionary?: string[];
  /** Clock (s) for flashing; defaults to the wall clock. */
  t?: number;
}

/**
 * A sensor comparator annunciation (Perspective+ PG 190-02183-01 Rev. A Fig 2-47, Table 2-4, p. 105–106): black text on a
 * white background when one or both sensed values are unavailable (no compare), on amber for a miscompare. `at` is the
 * compared value, which sets its place on the PFD as Fig 2-47 shows; `text` is what the box reads (e.g. "VDI NO COMP").
 */
export interface Comparator {
  at: "IAS" | "ALT" | "PIT" | "ROL" | "HDG" | "VDI";
  text: string;
  miscompare?: boolean;
}

/** One engine-indication item for the EIS strip. */
export interface Gauge {
  key: string;
  /** Label as printed on the G1000, e.g. "OIL PRES", "FUEL QTY GAL", "M BUS E BUS". */
  label: string;
  unit?: string;
  /**
   * dial (tach), horizontal bar, pair (L/R pointers on one bar, e.g. fuel), text row, head (section title), or tanks
   * (Perspective+ fuel: L/R vertical bars for value / value2, with `side` drawn as a vertical bar to their right).
   */
  style: "dial" | "bar" | "pair" | "text" | "head" | "tanks";
  min: number;
  max: number;
  /** Colour bands [from, to, colour]. */
  bands?: [number, number, "green" | "yellow" | "red" | "white"][];
  /**
   * Value; null = invalid → red X. `value2`: the R pointer of a pair, or the second column of a text row — the label
   * then holds both captions separated by two spaces ("M BUS  E BUS") and the row shows two readouts.
   */
  value: number | null;
  value2?: number | null;
  /** Digital readout format; omitted = no digits on bars. */
  fmt?: (v: number) => string;
  /** In a red range (flashing red readout) or yellow range (yellow readout). */
  alert?: "warning" | "caution" | null;
  /** Text-row content (overrides value/fmt), e.g. "1234.5". */
  text?: string;
  /** Shorter dial (60 px) or bar (30 px) so a long strip (e.g. two dials, MAN IN + RPM) fits the display. */
  compact?: boolean;
  /** Character drawn inside a bar's pointer, e.g. the hottest cylinder number on CHT / EGT. */
  ptrLabel?: string;
  /** "tanks" only: the vertical bar beside the tank pair (fuel flow), with its own label, range, bands, value and alert (readout colour). */
  side?: Gauge;
}

export interface MfdData extends PfdData {
  /** EIS strip items, top to bottom. */
  eis: Gauge[];
  /** Title above the strip, e.g. "ENGINE". */
  eisTitle?: string;
  /** Reversionary mode: PFD instruments plus the EIS strip on this display. */
  reversion: boolean;
  /** Page title over the map, default "MAP - NAVIGATION MAP". */
  page?: string;
}
