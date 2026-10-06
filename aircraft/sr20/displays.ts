/**
 * Live Perspective+ displays for the SR20 G6: PFD, MFD (Engine Strip + map) and reversionary mode drawn with the shared
 * Garmin renderer (lib/avionics/g1000.ts, Perspective+ style), plus the MD302 standby (its own drawing).
 *
 * The SR20 has no flight model or autopilot sim: attitude follows the yokes and the air data is a fixed cruise picture
 * (124 KIAS, 4,500 ft, heading 360°). Engine and electrical readings come from the sim (`live`, the electrical solution).
 */
import { drawMFD as gduMFD, drawPFD as gduPFD, type AfcsAnnunc, type FlightData, type Gauge, type MfdData, type PfdData, type SpeedBands } from "@/lib/avionics/g1000";
import { D2R } from "@/lib/math";
import { casMessages, live, mapInHg, type BusId, type Elec, type Sim } from "./model";

export { drawOff } from "@/lib/canvas";

type Ctx = CanvasRenderingContext2D;
type Band = [number, number, "green" | "yellow" | "red" | "white"];

/**
 * Airspeed tape, POH 2-5 markings: white 62–110, green 71–164, yellow 164–201, red line 201 KIAS. Cyan references:
 * Vr 71 (short-field rotation, 4-16), Vx 81 (best angle, 50% flaps, 4-22), Vy 96 (sea level, 4-3), best glide 100 KIAS (3,150 lb, 3-8).
 */
export const SPEEDS: SpeedBands = { white: [62, 110], green: [71, 164], yellow: [164, 201], red: 201, vr: 71, vx: 81, vy: 96, vg: 100 };

/** Fixed cruise picture the SR20 displays have always shown. */
const IAS = 124, TAS = 131, ALT = 4500, HDG = 360, BARO = 29.92;

/** A breaker-fed load has power: its bus is live and its breaker is in. */
const pw = (s: Sim, E: Elec, bus: BusId, cb: string) => E[bus] > 0 && !s.cb[cb];
const pad = (n: number) => String(n).padStart(2, "0");
const clock = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
/** Under the CAPS canopy the airspeed shows dashes. */
const ias = () => (live.capsT >= 0 ? 0 : IAS);

function flight(s: Sim, E: Elec): FlightData {
  const dash: [string, string] = ["----", "----"];
  // ADAHRS 1 (ESS BUS 1) or 2 (MAIN BUS 2) feeds attitude, heading and air data; with both lost they show red X's
  const adahrs = pw(s, E, "ess1", "ADAHRS 1") || pw(s, E, "main2", "ADAHRS 2");
  const xpdr = pw(s, E, "avx", "XPONDER");
  return {
    pitch: s.ctrl.pitch * 10, roll: s.ctrl.roll * 25, slip: 0,
    ias: ias(), tas: TAS, gs: TAS, alt: ALT, vs: 0, hdg: HDG, trk: HDG, baro: BARO, oat: s.pitot.oat,
    hdgBug: HDG, crs: HDG, cdi: 0, navSrc: "GPS", selAlt: ALT, pos: [0, 0], xtk: 0,
    // GIA 1: COM 1 + GPS NAV GIA 1 on ESS BUS 1; GIA 2: COM 2 + GPS NAV GIA 2 on MAIN BUS 2
    com1: pw(s, E, "ess1", "COM 1") ? undefined : dash, com2: pw(s, E, "main2", "COM 2") ? undefined : dash,
    nav1: pw(s, E, "ess1", "GPS NAV GIA 1") ? undefined : dash, nav2: pw(s, E, "main2", "GPS NAV GIA 2") ? undefined : dash,
    xpdr: xpdr ? "1200" : "----", xpdrMode: xpdr ? "ALT" : "FAIL", time: clock(),
    fail: adahrs ? undefined : { att: true, air: true, hdg: true },
  };
}

/** GFC 700 status bar, disengaged: the model has no autopilot sim. */
const AFCS_OFF: AfcsAnnunc = { ap: false, fd: false, lat: "", vert: "" };

const pfdData = (s: Sim, E: Elec): PfdData => ({ f: flight(s, E), speeds: SPEEDS, alerts: casMessages(s, E), afcs: AFCS_OFF, style: "perspective" });

const level = (v: number | null, bands: Band[]): Gauge["alert"] => {
  if (v == null) return null;
  for (const [a, b, c] of bands) if (v >= a && v <= b) return c === "red" ? "warning" : c === "yellow" ? "caution" : null;
  return null;
};
const f0 = (v: number) => String(Math.round(v)), f1 = (v: number) => v.toFixed(1), sgn = (v: number) => (v > 0 ? "+" : "") + Math.round(v);

/**
 * Engine Strip (PG 190-02183-03 Fig 3-2; markings POH 2-9, 2-10), top to bottom, for what the sim computes: RPM, Man "Hg,
 * fuel quantity, fuel flow, Batt 1 A and Ess Bus V. % Power, GAL Used, oil, CHT and EGT aren't simulated and are left off.
 * Below them the model adds the ENGINE page's main-bus volts and alternator amps (POH 7-53: on the real strip only
 * Batt 1 A and Ess Bus V show). Everything comes through the Engine Airframe Unit (POH 7-33, 7-42, 7-53), so every item
 * shows a red X when it loses ENGINE INSTR power.
 */
export function eisGauges(s: Sim, E: Elec): Gauge[] {
  const ok = E.eisPwr, v = (x: number) => (ok ? x : null);
  const g = (key: string, label: string, style: Gauge["style"], min: number, max: number, bands: Band[], value: number | null, fmt: (n: number) => string): Gauge =>
    ({ key, label, style, min, max, bands, value, fmt, alert: level(value, bands) });
  const mBus: Band[] = [[0, 24.4, "yellow"], [24.5, 32, "green"], [32, 36, "red"]], altA: Band[] = [[0, 1, "yellow"], [2, 100, "green"]];
  const rpm = Math.round(live.rpm / 10) * 10;
  // fuel quantity: float sensors on the FUEL QTY breaker (MAIN BUS 1); red 0, yellow 0–10, green 10–28 gal
  const fq = ok && pw(s, E, "main1", "FUEL QTY"), qL = fq ? s.fuel.qL : null, qR = fq ? s.fuel.qR : null;
  const qMin = qL == null || qR == null ? null : Math.min(qL, qR);
  const fuel: Gauge = { key: "fuel", label: "Fuel Qty GAL", style: "pair", min: 0, max: 28, bands: [[0, 0.5, "red"], [0.5, 10, "yellow"], [10, 28, "green"]], value: qL, value2: qR, fmt: f0,
    alert: qMin == null ? null : qMin <= 0.5 ? "warning" : qMin < 10 ? "caution" : null };
  const ff = s.eng.running ? 3 + s.eng.lever * 13 * s.eng.mix : 0; // illustrative fuel flow (no fuel-flow model)
  return [
    // RPM warning above 2,730 (POH 2-9 note a; the sim never gets there)
    { ...g("rpm", "RPM", "dial", 0, 3000, [[500, 2700, "green"], [2700, 3000, "red"]], v(rpm), f0), alert: ok && rpm > 2730 ? "warning" : null },
    g("map", "Man \"Hg", "bar", 10, 35, [[15, 29.5, "green"]], v(mapInHg(s, live.rpm)), f1),
    fuel,
    g("ff", "FFlow GPH", "bar", 0, 25, [[0, 21, "green"]], v(ff), f1),
    g("b1", "Batt 1 A", "text", -59, 59, [[-59, -5, "yellow"], [-4, 59, "green"]], v(E.b1), sgn),
    g("ess", "Ess Bus V", "text", 0, 36, [[0, 24.4, "red"], [24.5, 32, "green"], [32, 36, "red"]], v(E.ess1), f1),
    { key: "elec", label: "ELECTRICAL", style: "head", min: 0, max: 1, value: null },
    g("m1", "M Bus 1 V", "text", 0, 36, mBus, v(E.mdb1), f1),
    g("m2", "M Bus 2 V", "text", 0, 36, mBus, v(E.mdb2), f1),
    g("a1", "Alt 1 A", "text", 0, 100, altA, v(E.a1), f0),
    g("a2", "Alt 2 A", "text", 0, 100, altA, v(E.a2), f0),
  ];
}

const mfdData = (s: Sim, E: Elec, reversion: boolean): MfdData => ({ ...pfdData(s, E), eis: eisGauges(s, E), reversion, page: "Map - Navigation Map" });

/**
 * Reversionary mode: losing one display puts PFD symbology plus the Engine Strip on the other automatically (POH 7-72), and
 * DISPLAY BACKUP puts both displays in reversionary mode (PG p. 12, Fig 1-6). `E.pfd` is false when the PFD has failed.
 */
export const pfdReversion = (s: Sim, E: Elec) => E.pfd && (s.avx.backup || !E.mfd);
export const mfdReversion = (s: Sim, E: Elec) => E.mfd && (s.avx.backup || !E.pfd);

export function drawPFD(ctx: Ctx, W: number, H: number, s: Sim, E: Elec) {
  if (pfdReversion(s, E)) gduMFD(ctx, W, H, mfdData(s, E, true));
  else gduPFD(ctx, W, H, pfdData(s, E));
}

export function drawMFD(ctx: Ctx, W: number, H: number, s: Sim, E: Elec) {
  gduMFD(ctx, W, H, mfdData(s, E, mfdReversion(s, E)));
}

/* ---------- MD302 standby attitude module: attitude on the left screen, air data on the right ---------- */

const MD_FONT = `Arial, "Liberation Sans", "DejaVu Sans", Helvetica, sans-serif`;
function mdText(ctx: Ctx, s: string, x: number, y: number, c: string, px: number, align: CanvasTextAlign = "center") {
  ctx.font = `700 ${px}px ${MD_FONT}`; ctx.fillStyle = c; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
}

/**
 * MD302 SAM in its horizontal mounting (MD302 Pilot's Guide Image 2; POH 7-18 … 7-21): two LCDs in one bezel, attitude
 * (roll scale, airplane symbol, slip bar) on the left and airspeed / altitude tapes with BARO on the right, control knob between.
 * Drawn on a 420×180 grid (the unit's 5.5 × 2.37 in. bezel).
 */
export function drawStandby(ctx: Ctx, W: number, H: number, s: Sim) {
  ctx.save();
  ctx.fillStyle = "#16191C"; ctx.fillRect(0, 0, W, H);
  ctx.scale(W / 420, H / 180);
  const lcd = (x: number) => { ctx.fillStyle = "#000"; ctx.fillRect(x, 16, 170, 130); };
  // left LCD: attitude
  lcd(12);
  ctx.save();
  ctx.beginPath(); ctx.rect(12, 16, 170, 130); ctx.clip();
  const cx = 97, cy = 86, roll = s.ctrl.roll * 25, pitch = s.ctrl.pitch * 10, ppd = 3;
  ctx.translate(cx, cy); ctx.rotate(-roll * D2R); ctx.translate(0, pitch * ppd);
  ctx.fillStyle = "#2F6FC8"; ctx.fillRect(-300, -400, 600, 400);
  ctx.fillStyle = "#7A4A22"; ctx.fillRect(-300, 0, 600, 400);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-300, 0); ctx.lineTo(300, 0); ctx.stroke();
  for (const p of [-10, -5, 5, 10]) { const w = p % 10 ? 10 : 20; ctx.beginPath(); ctx.moveTo(-w, -p * ppd); ctx.lineTo(w, -p * ppd); ctx.stroke(); }
  ctx.translate(0, -pitch * ppd);
  // roll scale (moves with the horizon): 10, 20, 30, 45, 60°
  const R = 52;
  ctx.beginPath(); ctx.arc(0, 0, R, -150 * D2R, -30 * D2R); ctx.stroke();
  for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const r = (a - 90) * D2R, len = Math.abs(a) % 30 ? 5 : 9;
    ctx.beginPath(); ctx.moveTo(Math.cos(r) * R, Math.sin(r) * R); ctx.lineTo(Math.cos(r) * (R + len), Math.sin(r) * (R + len)); ctx.stroke();
  }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-6, -R - 9); ctx.lineTo(6, -R - 9); ctx.fill();
  ctx.restore();
  // fixed roll pointer, slip bar and yellow airplane symbol
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx, cy - R + 1); ctx.lineTo(cx - 6, cy - R + 10); ctx.lineTo(cx + 6, cy - R + 10); ctx.fill();
  ctx.fillRect(cx - 7, cy - R + 12, 14, 4);
  ctx.fillStyle = "#FFD200";
  ctx.fillRect(cx - 52, cy - 3, 30, 6); ctx.fillRect(cx + 22, cy - 3, 30, 6);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 20, cy + 10); ctx.lineTo(cx + 20, cy + 10); ctx.fill();

  // right LCD: airspeed (left) and altitude (right) with boxed readouts, BARO at the top
  lcd(238);
  const box = (x: number, w: number, v: string, unit: string) => {
    ctx.fillStyle = "#000"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.fillRect(x, 70, w, 32); ctx.strokeRect(x, 70, w, 32);
    mdText(ctx, v, x + w / 2, 87, "#fff", 26);
    mdText(ctx, unit, x + w / 2, 113, "#C9CED2", 12);
  };
  // airspeed colour bands beside the airspeed box (POH 2-5), 1 px per kt around the current speed
  const v0 = ias() || IAS, band = (a: number, b: number, c: string, x: number, w: number) => {
    const y0 = Math.max(46, 86 - (b - v0)), y1 = Math.min(140, 86 - (a - v0));
    if (y1 > y0) { ctx.fillStyle = c; ctx.fillRect(x, y0, w, y1 - y0); }
  };
  band(71, 164, "#14D21E", 310, 5); band(164, 201, "#FFD400", 310, 5); band(62, 110, "#FFFFFF", 316, 3);
  box(244, 62, ias() ? String(ias()) : "---", "KTS");
  box(324, 80, String(ALT), "FEET");
  mdText(ctx, `BARO ${BARO.toFixed(2)}`, 323, 32, "#00F0FF", 14);
  // control knob between the screens
  ctx.fillStyle = "#3A4046"; ctx.beginPath(); ctx.arc(210, 150, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5A6168"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
