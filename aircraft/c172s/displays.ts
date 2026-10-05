/**
 * Live G1000 displays for the C172S, drawn with the shared lib/avionics G1000 code: PFD, MFD (EIS strip
 * with this airplane's Section 2 markings), reversionary mode, and the mechanical standby airspeed,
 * vacuum attitude and altimeter (Figure 7-2 Sheet 1 cluster).
 */
import { flightData, type FlightState } from "@/lib/avionics/flight";
import { gfc700Annunc } from "@/lib/avionics/gfc700";
import { drawMFD, drawPFD, drawStandbyAirspeed, drawStandbyAltimeter, drawStandbyAttitude, type FlightData, type Gauge, type MfdData, type PfdData, type SpeedBands } from "@/lib/avionics/g1000";
import { nav3ElecGauges } from "../cessna/annunciations";
import { AFCS_CFG, annunciations, fuelInd, live, type Elec, type Sim } from "./model";

export { drawOff } from "@/lib/canvas";

/** Airspeed indicator markings (POH Figure 2-2): red 20–40 (G1000 only), white 40–85, green 48–129, yellow 129–163, red line 163; Vr 55 (POH 4-18), Vx 62, Vy 74, best glide 68 KIAS. */
export const SPEEDS: SpeedBands = { white: [40, 85], green: [48, 129], yellow: [129, 163], red: 163, vr: 55, vx: 62, vy: 74, vg: 68 };

const clock = (t: number) => { const s = Math.floor(14 * 3600 + 5 * 60 + t); return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, "0")).join(":"); };

/** Air data as the instruments see it: pitot/static blockages and the alternate static source (POH 3-15, Fig. 5-1 Sheet 2). */
export function indicated(s: Sim, fs: FlightState) {
  let ias = fs.ias, alt = fs.alt, vs = fs.vs;
  if (s.pitot.pitotBlocked) ias = 0;
  if (s.pitot.staticBlocked && !s.pitot.altStatic) { alt = live.staticAlt ?? fs.alt; vs = 0; }
  if (s.pitot.altStatic) { ias += 2; alt += 30; }
  return { ias, alt, vs };
}

function data(s: Sim, E: Elec): FlightData {
  const fs = live.fs, ind = indicated(s, fs);
  const dash: [string, string] = ["------", "------"];
  return flightData({ ...fs, ias: ind.ias, alt: ind.alt, vs: ind.vs }, {
    com1: E.on["ESS:COMM 1"] ? ["118.000", "136.975"] : dash, com2: E.on["AV2:COMM 2"] ? ["121.500", "132.450"] : dash,
    nav1: E.gia1 ? ["117.95", "108.00"] : dash, nav2: E.gia2 ? ["110.50", "113.40"] : dash,
    xpdr: E.xpdr ? "1200" : "----", xpdrMode: E.xpdr ? (s.ground ? "GND" : "ALT") : "OFF", time: clock(fs.t),
  });
}

/** EIS strip: ENGINE page items for the 172S (CRG p. 5; POH Figure 2-3, 7-30 … 7-40). Red X when the GEA 71 has no power. */
export function eisGauges(s: Sim, E: Elec): Gauge[] {
  const ok = E.gia1, v = (x: number) => (ok ? x : null);
  const alt = live.fs.alt, top = alt < 5000 ? 2500 : alt < 10000 ? 2600 : 2700; // green arc top changes with altitude (POH 2-7)
  const iL = fuelInd(s.fuel.qL), iR = fuelInd(s.fuel.qR);
  const fuelAlert = iL <= 0.05 || iR <= 0.05 ? "warning" : s.ann.lowFuelL || s.ann.lowFuelR ? "caution" : null;
  return [
    { key: "rpm", label: "RPM", style: "dial", min: 0, max: 3000, bands: [[2100, top, "green"], [2700, 3000, "red"]], value: v(live.rpm), fmt: (x) => String(Math.round(x / 10) * 10), alert: live.rpm >= 2780 ? "warning" : null },
    { key: "ff", label: "FFLOW GPH", style: "bar", min: 0, max: 20, bands: [[0, 12, "green"]], value: v(live.ff), fmt: (x) => x.toFixed(1) },
    { key: "oilp", label: "OIL PRES", style: "bar", min: 0, max: 120, bands: [[0, 20, "red"], [50, 90, "green"], [115, 120, "red"]], value: v(live.oilP), fmt: (x) => String(Math.round(x)), alert: ok && (live.oilP <= 20 || live.oilP >= 115) ? "warning" : null },
    { key: "oilt", label: "OIL TEMP", style: "bar", min: 75, max: 250, bands: [[100, 245, "green"], [245, 250, "red"]], value: v(live.oilT), fmt: (x) => String(Math.round(x)), alert: live.oilT >= 245 ? "warning" : null },
    { key: "egt", label: "EGT", style: "bar", min: 1250, max: 1650, value: v(Math.max(1250, live.egt)), fmt: (x) => String(Math.round(x / 10) * 10) },
    { key: "vac", label: "VAC", style: "bar", min: 3, max: 7, bands: [[4.5, 5.5, "green"]], value: v(Math.max(3, live.vac)), fmt: (x) => (live.vac < 3 ? live.vac : x).toFixed(1) },
    { key: "fuel", label: "FUEL QTY GAL", style: "pair", min: 0, max: 26, bands: [[0, 0.5, "red"], [0.5, 5, "yellow"], [5, 24, "green"]], value: v(iL), value2: v(iR), alert: fuelAlert },
    { key: "hrs", label: "ENG HRS", style: "text", min: 0, max: 1, value: v(live.hobbs), text: ok ? live.hobbs.toFixed(1) : undefined },
    ...nav3ElecGauges({ ...E, mBus: ok ? E.mBus : null, eBus: ok ? E.eBus : null }),
  ];
}

function pfdData(s: Sim, E: Elec): PfdData {
  return { f: data(s, E), speeds: SPEEDS, alerts: annunciations(s, E), afcs: gfc700Annunc(live.afcs, live.fs, AFCS_CFG), t: live.fs.t };
}
const mfdData = (s: Sim, E: Elec, reversion: boolean): MfdData => ({ ...pfdData(s, E), eis: eisGauges(s, E), eisTitle: "ENGINE", reversion });

/** Reversion: either display shows PFD + EIS when the other is lost, or both with DISPLAY BACKUP (POH 7-11, 7-30; CRG 109). */
export const pfdReversion = (s: Sim, E: Elec) => E.pfd && (!E.mfd || s.avx.backup);
export const mfdReversion = (s: Sim, E: Elec) => E.mfd && (!E.pfd || s.avx.backup);

export function drawPfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  if (pfdReversion(s, E)) drawMFD(ctx, W, H, mfdData(s, E, true));
  else drawPFD(ctx, W, H, pfdData(s, E));
}
export function drawMfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  drawMFD(ctx, W, H, mfdData(s, E, mfdReversion(s, E)));
}

/* ---------- standby cluster (pneumatic / vacuum: no electrical power needed) ---------- */
export const drawSbyAsi = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) => drawStandbyAirspeed(ctx, W, H, indicated(s, live.fs).ias, SPEEDS, 180);
export const drawSbyAlt = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) => drawStandbyAltimeter(ctx, W, H, indicated(s, live.fs).alt, live.fs.baro);
/** Vacuum attitude indicator: the GYRO flag shows when vacuum is too low; a spinning-down rotor drifts (POH 7-65). */
export const drawSbyAi = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  const flag = live.vac < 3.5 || live.gyro < 0.7;
  drawStandbyAttitude(ctx, W, H, live.fs.pitch + live.drift * 0.4, live.fs.roll * live.gyro + live.drift, flag ? "GYRO" : null);
};
