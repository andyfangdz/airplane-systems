/**
 * Live G1000 displays for the DA40: PFD, MFD with the DA40 EIS strip (CRG 190-00324-07 Fig. 3-1, markings from
 * AFMS 190-00492-10 §2.4–2.5) and the standby airspeed / attitude / altimeter. Drawing is the shared lib/avionics.
 */
import { flightData } from "@/lib/avionics/flight";
import { drawMFD, drawPFD, drawStandbyAirspeed, drawStandbyAltimeter, drawStandbyAttitude, type Gauge, type MfdData, type PfdData, type SpeedBands } from "@/lib/avionics/g1000";
import { gfc700Annunc } from "@/lib/avionics/gfc700";
import { drawOff } from "@/lib/canvas";
import { BUSES, SPARE_CB, annunciations, displays, live, type Elec, type Sim } from "./model";
import { AFCS_CFG } from "./tick";

export { drawOff };

/**
 * G1000 airspeed tape (AFMS p. 17): low-speed awareness red 20–53 and yellow 53–58, white 58–91, green 58–129, yellow
 * 129–178, red 178; cyan references Vr 59, Vy 67 (T/O flaps), best glide 76 KIAS at 1,200 kg (AFM 4A-2, 3-4).
 */
export const SPEEDS: SpeedBands = { white: [58, 91], green: [58, 129], yellow: [129, 178], red: 178, lowRed: 53, vr: 59, vy: 67, vg: 76 };
/** Standby airspeed indicator markings (basic AFM 2-4): white 49–91, green 52–129, yellow 129–178, red 178. */
export const STBY_SPEEDS: SpeedBands = { white: [49, 91], green: [52, 129], yellow: [129, 178], red: 178 };

type Band = [number, number, "green" | "yellow" | "red" | "white"];
const level = (v: number | null, bands: Band[]): "warning" | "caution" | null => {
  if (v == null) return null;
  for (const [a, b, c] of bands) if (v >= a && v <= b) return c === "red" ? "warning" : c === "yellow" ? "caution" : null;
  return null;
};
const f0 = (v: number) => String(Math.round(v)), f1 = (v: number) => v.toFixed(1);

/** EIS strip items, top to bottom (CRG Fig. 3-1). Values are null (red X) when the GEA 71 or both GIAs are lost. */
export function eisGauges(s: Sim, E: Elec): Gauge[] {
  const ok = E.gea && (E.gia1 || E.gia2);
  const v = (x: number) => (ok ? x : null);
  const rpm = Math.round(live.rpm / 10) * 10;
  const g = (key: string, label: string, style: Gauge["style"], min: number, max: number, bands: Band[], value: number | null, fmt?: (n: number) => string, alert?: Gauge["alert"], unit?: string): Gauge =>
    ({ key, label, style, min, max, bands, value, fmt, alert: alert === undefined ? level(value, bands) : alert, unit });
  const rpmV = v(rpm);
  const fuelBands: Band[] = [[0, 0.6, "red"], [0.6, 3, "yellow"], [3, 16, "green"], [19, 24, "green"]];
  const qL = ok ? live.gaugeL : null, qR = ok ? live.gaugeR : null;
  const qAlert = qL == null || qR == null ? null : Math.min(qL, qR) < 0.6 ? "warning" : Math.min(qL, qR) < 3 ? "caution" : null;
  return [
    g("map", "MAN IN", "dial", 10, 31, [[13, 30, "green"]], v(live.map), f1),
    // RPM legend only turns red/flashes above 2,780 (AFMS Note 3)
    g("rpm", "RPM", "dial", 0, 3000, [[500, 2700, "green"], [2700, 3000, "red"]], rpmV, f0, rpmV != null && rpmV > 2780 ? "warning" : null),
    g("ff", "FUEL FLOW", "bar", 0, 25, [[1, 20, "green"], [20, 25, "red"]], v(live.ff), f1, undefined, "GPH"),
    g("fp", "FUEL PRES", "bar", 0, 40, [[0, 14, "red"], [14, 35, "green"], [35, 40, "red"]], v(live.fuelP), f0, undefined, "PSI"),
    g("cht", "CHT", "bar", 100, 525, [[150, 475, "green"], [475, 500, "yellow"], [500, 525, "red"]], v(live.cht), f0, undefined, "°F"),
    g("oilt", "OIL TEMP", "bar", 75, 260, [[149, 230, "green"], [230, 245, "yellow"], [245, 260, "red"]], v(live.oilT), f0, undefined, "°F"),
    g("oilp", "OIL PRES", "bar", 0, 115, [[0, 25, "red"], [25, 55, "yellow"], [55, 95, "green"], [95, 97, "yellow"], [97, 115, "red"]], v(live.oilP), f0, undefined, "PSI"),
    g("amps", "AMPS", "bar", 0, 80, [[2, 75, "green"]], v(E.amps), f0, ok && s.eng.running && E.amps === 0 ? "warning" : null),
    g("volts", "VOLTS", "bar", 20, 34, [[20, 24.1, "red"], [24.1, 25, "yellow"], [25, 30, "green"], [30, 32, "yellow"], [32, 34, "red"]], v(E.volts), f1),
    { key: "fuel", label: "FUEL QTY GAL", style: "pair", min: 0, max: 25, bands: fuelBands, value: qL, value2: qR, fmt: f0, alert: qAlert },
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

/** PFD data from the flight state, annunciations and AFCS status. */
export function pfdData(s: Sim, E: Elec): PfdData {
  const fs = live.fs;
  const f = flightData(fs, {
    time: clock(), xpdr: "1200", xpdrMode: !E.xpdr ? "FAIL" : fs.onGround ? "GND" : "ALT",
    com1: E.com1 ? ["119.100", "121.900"] : ["----", "----"], com2: E.com2 ? ["132.025", "120.600"] : ["----", "----"],
    nav1: E.gia1 ? ["115.70", "108.50"] : ["----", "----"], nav2: E.gia2 ? ["117.40", "110.30"] : ["----", "----"],
    ...(fs.onGround ? { gs: 0, ias: 0, tas: 0 } : {}),
  });
  return { f, speeds: SPEEDS, alerts: annunciations(s, E), afcs: gfc700Annunc(live.afcs, fs, AFCS_CFG), t: fs.t };
}

export function mfdData(s: Sim, E: Elec, reversion: boolean): MfdData {
  return { ...pfdData(s, E), eis: eisGauges(s, E), eisTitle: "ENGINE", reversion, page: "MAP - NAVIGATION MAP" };
}

export function drawPfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  const d = displays(s, E);
  if (!d.pfd) return drawOff(ctx, W, H);
  if (d.pfdRev) drawMFD(ctx, W, H, mfdData(s, E, true));
  else drawPFD(ctx, W, H, pfdData(s, E));
}
export function drawMfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  const d = displays(s, E);
  if (!d.mfd) return drawOff(ctx, W, H);
  drawMFD(ctx, W, H, mfdData(s, E, d.mfdRev));
}

/** Standby instruments: airspeed and altimeter are pneumatic; the attitude indicator is electric (OFF flag unpowered). */
const altStaticErr = (s: Sim) => (s.pitot.altStatic ? { kt: 3, ft: 40 } : { kt: 0, ft: 0 });
export const drawStbyAsi = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) =>
  drawStandbyAirspeed(ctx, W, H, live.fs.onGround ? 0 : live.fs.ias + altStaticErr(s).kt, STBY_SPEEDS, 200);
export const drawStbyAlt = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) =>
  drawStandbyAltimeter(ctx, W, H, live.fs.alt + altStaticErr(s).ft, live.fs.baro);
let lastAtt = { p: 0, r: 0 };
export function drawStbyAtt(ctx: CanvasRenderingContext2D, W: number, H: number, E: Elec) {
  if (E.stbyAtt) lastAtt = { p: live.fs.pitch, r: live.fs.roll };
  drawStandbyAttitude(ctx, W, H, lastAtt.p, lastAtt.r, E.stbyAtt ? null : "OFF");
}

/* ---------- panel face plates (canvas textures) ---------- */

/** Circuit-breaker panel face: ESSENTIAL / MAIN / AVIONICS rows; pulled breakers show their white collar. */
export function drawBreakers(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) {
  ctx.fillStyle = "#2F3439"; ctx.fillRect(0, 0, W, H);
  const cols = 6, dx = W / cols;
  let y = 4;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [, name, , loads] of BUSES) {
    ctx.fillStyle = "#D8DCDF"; ctx.font = "bold 10px sans-serif";
    ctx.fillText(name.replace("MAIN AVIONICS", "AVIONICS"), W / 2, y + 6);
    y += 14;
    loads.forEach(([n], i) => {
      const cx = dx * (i % cols) + dx / 2, cy = y + Math.floor(i / cols) * 30 + 9;
      const pulled = !!s.cb[n], spare = SPARE_CB.includes(n);
      if (pulled) { ctx.fillStyle = "#F4F6F8"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = spare ? "#3A3F44" : "#121518"; ctx.beginPath(); ctx.arc(cx, cy, pulled ? 7 : 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = spare ? "#7C858C" : "#C9CED2"; ctx.font = "7px sans-serif";
      ctx.fillText(n.length > 9 ? n.slice(0, 9) : n, cx, cy + 15);
    });
    y += Math.ceil(loads.length / cols) * 30 + 2;
  }
}

const GMA_KEYS = ["COM1 MIC", "COM1", "COM2 MIC", "COM2", "COM3 MIC", "COM3", "COM 1/2", "PA", "SPKR", "MKR/MUTE", "DME", "NAV1", "ADF", "NAV2", "AUX", "MAN SQ", "PILOT", "COPLT", "PLAY"];
/** GMA 1347 audio panel face: two columns of keys with annunciator bars (lit when powered), volume knob and DISPLAY BACKUP. */
export function drawGma(ctx: CanvasRenderingContext2D, W: number, H: number, powered: boolean) {
  ctx.fillStyle = "#1B1F23"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const on = new Set(["COM1 MIC", "COM1", "COM2", "SPKR", "PILOT"]);
  GMA_KEYS.forEach((k, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 6 + col * 45, y = 10 + row * 25;
    ctx.fillStyle = "#3A4148"; ctx.fillRect(x, y, 39, 19);
    ctx.fillStyle = powered && on.has(k) ? "#3BE05A" : "#20262B"; ctx.fillRect(x + 12, y + 2, 15, 3);
    ctx.fillStyle = "#E3E7EA"; ctx.font = "7px sans-serif"; ctx.fillText(k, x + 19.5, y + 12);
  });
  ctx.fillStyle = "#3A4148"; ctx.beginPath(); ctx.arc(W / 2, H - 46, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#B53A3A"; ctx.beginPath(); ctx.arc(W / 2, H - 16, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#E3E7EA"; ctx.font = "6px sans-serif"; ctx.fillText("DISPLAY BACKUP", W / 2, H - 4);
}
