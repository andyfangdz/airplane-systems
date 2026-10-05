/**
 * Live G1000 displays for the DA40: PFD, MFD with the DA40 EIS strip (CRG 190-00324-07 Fig. 3-1, markings from
 * AFMS 190-00492-10 §2.4–2.5) and the standby airspeed / attitude / altimeter. Drawing is the shared lib/avionics.
 */
import { flightData } from "@/lib/avionics/flight";
import { drawMFD, drawPFD, drawStandbyAirspeed, drawStandbyAltimeter, drawStandbyAttitude, type Gauge, type MfdData, type PfdData, type SpeedBands } from "@/lib/avionics/g1000";
import { gfc700Annunc } from "@/lib/avionics/gfc700";
import { drawOff } from "@/lib/canvas";
import { annunciations, displays, live, type Elec, type Sim } from "./model";
import { AFCS_CFG } from "./tick";

export { drawOff };

/** G1000 airspeed tape (AFMS p. 17) with cyan references Vr 59, Vy 67 (T/O flaps), best glide 76 KIAS at 1,200 kg (AFM 4A-2, 3-4). */
export const SPEEDS: SpeedBands = { white: [58, 91], green: [58, 129], yellow: [129, 178], red: 178, vr: 59, vy: 67, vg: 76 };
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
