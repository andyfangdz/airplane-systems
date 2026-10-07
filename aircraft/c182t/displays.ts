/**
 * Live G1000 displays for the C182T, drawn with the shared lib/avionics G1000 code: PFD (no AFCS status bar — the KAP 140 has its
 * own display; only the red PITCH TRIM annunciation reaches the PFD), MFD with the 182T EIS (ENGINE or SYSTEM page, CRG pp. 5 and 11,
 * POH Figure 2-3 markings), reversionary mode, the KAP 140 LCD, and the mechanical standby airspeed, vacuum attitude and altimeter.
 */
import { flightData, type FlightState } from "@/lib/avionics/flight";
import {
  drawMFD,
  drawPFD,
  drawStandbyAirspeed,
  drawStandbyAltimeter,
  drawStandbyAttitude,
  type FlightData,
  type Gauge,
  type MfdData,
  type PfdData,
  type SpeedBands,
} from "@/lib/avionics/g1000";
import { drawKap140, kap140Pfd } from "@/lib/avionics/kap140";
import { lin } from "@/lib/geometry";
import { nav3ElecGauges } from "../cessna/annunciations";
import { annunciations, fuelInd, live, type Elec, type Sim } from "./model";

export { drawOff } from "@/lib/canvas";

/**
 * Airspeed indicator markings (POH Figure 2-2): red 20–41 (low-airspeed awareness, G1000 only), white 41–100, green 51–140, yellow
 * 140–175, red line 175; nosewheel lift-off 50–60 KIAS (POH 4-31), Vx 65, Vy 80 (POH 4-3), best glide 76 KIAS at 3,100 lb (POH 3-5).
 */
export const SPEEDS: SpeedBands = {
  white: [41, 100],
  green: [51, 140],
  yellow: [140, 175],
  red: 175,
  vr: 55,
  vx: 65,
  vy: 80,
  vg: 76,
};

const clock = (t: number) => {
  const s = Math.floor(14 * 3600 + 5 * 60 + t);
  return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
};
/** Alternate static source, flaps UP (POH Fig 5-1 Sheet 2): normal KIAS → alternate KIAS. */
const ALT_KIAS = [
  [55, 53],
  [60, 58],
  [70, 70],
  [80, 81],
  [90, 91],
  [100, 101],
  [120, 121],
  [140, 141],
  [160, 161],
];
/** Altimeter correction with the alternate static source, flaps UP, sea level to 4,000 ft (POH Fig 5-2): indicated = true + correction. */
const ALT_FT = [
  [60, 30],
  [80, 10],
  [100, -20],
  [120, -30],
  [140, -50],
  [160, -50],
];

/** Air data as the instruments see it: pitot/static blockages and the alternate static source (POH 3-13, 3-30, Figs 5-1, 5-2). */
export function indicated(s: Sim, fs: FlightState) {
  let ias = fs.ias,
    alt = fs.alt,
    vs = fs.vs;
  if (s.pitot.pitotBlocked) ias = 0;
  if (s.pitot.staticBlocked && !s.pitot.altStatic) {
    alt = live.staticAlt ?? fs.alt;
    vs = 0;
  }
  if (s.pitot.altStatic && ias > 40) {
    ias = lin(ALT_KIAS, ias)[0];
    alt += lin(ALT_FT, fs.ias)[0];
  }
  return { ias, alt, vs };
}

function data(s: Sim, E: Elec): FlightData {
  const fs = live.fs,
    ind = indicated(s, fs);
  const dash: [string, string] = ["------", "------"];
  return flightData(
    { ...fs, ias: ind.ias, alt: ind.alt, vs: ind.vs },
    {
      com1: E.com1 ? ["118.000", "136.975"] : dash,
      com2: E.com2 ? ["121.500", "132.450"] : dash,
      nav1: E.gia1 ? ["117.95", "108.10"] : dash,
      nav2: E.gia2 ? ["110.50", "113.40"] : dash,
      xpdr: E.xpdr ? "1200" : "----",
      xpdrMode: E.xpdr ? (s.ground ? "GND" : "ALT") : "OFF",
      time: clock(fs.t),
    },
  );
}

const f0 = (x: number) => String(Math.round(x)),
  f1 = (x: number) => x.toFixed(1);
/**
 * EIS strip for the 182T (CRG p. 5 ENGINE page, p. 11 SYSTEM page; POH Figure 2-3, 7-28 – 7-41). Red X when the GEA 71 has no power.
 * ENGINE: MAN IN, RPM, FFLOW, OIL PRES, OIL TEMP, CHT and EGT (pointers carry the hottest cylinder), FUEL QTY, ELECTRICAL — no VAC.
 * SYSTEM: MAN IN, RPM, OIL PSI, OIL °F, ENG HRS, VAC, FUEL CALC (FFLOW GPH, GAL USED, GAL REM), FUEL QTY, ELECTRICAL.
 */
export function eisGauges(s: Sim, E: Elec): Gauge[] {
  const ok = E.gea,
    v = (x: number) => (ok ? x : null);
  const iL = fuelInd(s.fuel.qL),
    iR = fuelInd(s.fuel.qR);
  const fuelAlert = iL <= 0.05 || iR <= 0.05 ? "warning" : s.ann.lowFuelL || s.ann.lowFuelR ? "caution" : null;
  const rpm = Math.round(live.rpm / 10) * 10;
  const top: Gauge[] = [
    // MAN IN green 15–23 (POH 2-6); the white arcs 10–15 and 23–35 are from the 2007 edition only (GFC 7-31)
    {
      key: "map",
      label: "MAN IN",
      style: "dial",
      compact: true,
      min: 10,
      max: 35,
      bands: [
        [10, 15, "white"],
        [15, 23, "green"],
        [23, 35, "white"],
      ],
      value: v(live.map),
      fmt: f1,
    },
    // RPM pointer, value and label turn red and flash at 2,472 RPM or more (POH 7-29)
    {
      key: "rpm",
      label: "RPM",
      style: "dial",
      compact: true,
      min: 0,
      max: 2700,
      bands: [
        [2000, 2400, "green"],
        [2400, 2700, "red"],
      ],
      value: v(rpm),
      fmt: f0,
      alert: rpm >= 2472 ? "warning" : null,
    },
  ];
  const oilPAlert = ok && (live.oilP <= 20 || live.oilP >= 115) ? "warning" : null,
    oilTAlert = live.oilT >= 245 ? "warning" : null,
    chtAlert = live.cht >= 500 ? "warning" : null;
  const fuel: Gauge = {
    key: "fuel",
    label: "FUEL QTY GAL",
    style: "pair",
    min: 0,
    max: 40,
    bands: [
      [0, 0.6, "red"],
      [0.6, 8, "yellow"],
      [8, 35, "green"],
    ],
    value: v(iL),
    value2: v(iR),
    alert: fuelAlert,
  };
  const elec = nav3ElecGauges({ ...E, mBus: ok ? E.mBus : null, eBus: ok ? E.eBus : null });
  // an exceedance starting on SYSTEM switches the page back to ENGINE (tick.ts, POH 7-29 – 7-33): the page and its title stay in step
  if (s.avx.eisPage === "SYSTEM") {
    const rem = Math.max(0, live.galStart - live.galUsed);
    return [
      ...top,
      {
        key: "oilp",
        label: "OIL PSI",
        style: "text",
        min: 0,
        max: 120,
        value: v(live.oilP),
        fmt: f0,
        alert: oilPAlert,
      },
      {
        key: "oilt",
        label: "OIL °F",
        style: "text",
        min: 75,
        max: 250,
        value: v(live.oilT),
        fmt: f0,
        alert: oilTAlert,
      },
      {
        key: "hrs",
        label: "ENG HRS",
        style: "text",
        min: 0,
        max: 1,
        value: v(live.engHrs),
        text: ok ? live.engHrs.toFixed(1) : undefined,
      },
      {
        key: "vac",
        label: "VAC",
        style: "bar",
        compact: true,
        min: 3,
        max: 7,
        bands: [[4.5, 5.5, "green"]],
        value: v(Math.max(3, live.vac)),
      },
      { key: "calc", label: "FUEL CALC", style: "head", min: 0, max: 1, value: 0 },
      { key: "ffs", label: "FFLOW GPH", style: "text", min: 0, max: 22, value: v(live.ff), fmt: f1 },
      { key: "used", label: "GAL USED", style: "text", min: 0, max: 99, value: v(live.galUsed), fmt: f1 },
      { key: "rem", label: "GAL REM", style: "text", min: 0, max: 99, value: v(rem), fmt: f0 },
      fuel,
      ...elec,
    ];
  }
  return [
    ...top,
    {
      key: "ff",
      label: "FFLOW GPH",
      style: "bar",
      compact: true,
      min: 0,
      max: 22,
      bands: [[0, 15, "green"]],
      value: v(live.ff),
      fmt: f1,
    },
    {
      key: "oilp",
      label: "OIL PRES",
      style: "bar",
      compact: true,
      min: 0,
      max: 120,
      bands: [
        [0, 20, "red"],
        [50, 90, "green"],
        [115, 120, "red"],
      ],
      value: v(live.oilP),
      alert: oilPAlert,
    },
    {
      key: "oilt",
      label: "OIL TEMP",
      style: "bar",
      compact: true,
      min: 75,
      max: 250,
      bands: [
        [100, 245, "green"],
        [245, 250, "red"],
      ],
      value: v(live.oilT),
      alert: oilTAlert,
    },
    {
      key: "cht",
      label: "CHT",
      style: "bar",
      compact: true,
      min: 100,
      max: 500,
      bands: [[200, 500, "green"]],
      value: v(Math.max(100, live.cht)),
      alert: chtAlert,
      ptrLabel: String(live.hotCyl),
    },
    {
      key: "egt",
      label: "EGT",
      style: "bar",
      compact: true,
      min: 1100,
      max: 1500,
      value: v(Math.min(1500, Math.max(1100, live.egt))),
      ptrLabel: String(live.hotCyl),
    },
    fuel,
    ...elec,
  ];
}

/** The PFD's red PITCH TRIM box (KAP 140 trim fault or self-test lamp check; WARN breaker power). */
const pitchTrim = (E: Elec) => (E.warnPwr ? kap140Pfd(live.kap, live.fs.t) : null);
function pfdData(s: Sim, E: Elec): PfdData {
  return {
    f: data(s, E),
    speeds: SPEEDS,
    alerts: annunciations(s, E, false),
    afcs: null,
    pitchTrim: pitchTrim(E),
    t: live.fs.t,
  };
}
const mfdData = (s: Sim, E: Elec, reversion: boolean): MfdData => ({
  ...pfdData(s, E),
  eis: eisGauges(s, E),
  eisTitle: s.avx.eisPage === "SYSTEM" ? "SYSTEM" : "ENGINE",
  reversion,
});

/** Reversion: either display shows PFD + EIS when the other is lost, or both with DISPLAY BACKUP (POH 7-28, 7-66; CRG 109). */
export const pfdReversion = (s: Sim, E: Elec) => E.pfd && (!E.mfd || s.avx.backup);
export const mfdReversion = (s: Sim, E: Elec) => E.mfd && (!E.pfd || s.avx.backup);

export function drawPfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  if (pfdReversion(s, E)) drawMFD(ctx, W, H, mfdData(s, E, true));
  else drawPFD(ctx, W, H, pfdData(s, E));
}
export function drawMfdScreen(ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim, E: Elec) {
  drawMFD(ctx, W, H, mfdData(s, E, mfdReversion(s, E)));
}

/** KAP 140 LCD (blank when the AUTO PILOT breaker or AVIONICS BUS 2 is off). */
export const drawKapScreen = (ctx: CanvasRenderingContext2D, W: number, H: number) =>
  drawKap140(ctx, W, H, live.kap, live.fs.t);

/* ---------- standby cluster (pneumatic / vacuum: no electrical power needed) ---------- */
export const drawStbyAsi = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) =>
  drawStandbyAirspeed(ctx, W, H, indicated(s, live.fs).ias, SPEEDS, 200);
export const drawStbyAlt = (ctx: CanvasRenderingContext2D, W: number, H: number, s: Sim) =>
  drawStandbyAltimeter(ctx, W, H, indicated(s, live.fs).alt, live.fs.baro);
/** Vacuum attitude indicator: the GYRO flag shows when vacuum is too low for reliable gyro operation; a spinning-down rotor drifts (POH 7-63). */
export const drawStbyAtt = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  const flag = live.vac < 3.5 || live.gyro < 0.7;
  drawStandbyAttitude(
    ctx,
    W,
    H,
    live.fs.pitch + live.drift * 0.4,
    live.fs.roll * live.gyro + live.drift,
    flag ? "GYRO" : null,
  );
};
