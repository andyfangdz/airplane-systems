/**
 * Perspective+ display plumbing shared by the SR20 and SR22T (`displays.ts` in each): the fixed-cruise flight picture with
 * the radios powered from their breakers, the UTC clock, reversionary mode and the PFD / MFD screens. Each airplane keeps
 * its own airspeed markings, Engine Strip and % power, which come from its own POH.
 */
import { drawMFD, drawPFD, type FlightData, type Gauge, type MfdData, type PfdData } from "@/lib/avionics/g1000";

type Ctx = CanvasRenderingContext2D;

/** Buses the radios hang off (GIA 1 on ESS BUS 1, GIA 2 on MAIN BUS 2, the transponder on the AVIONICS BUS). */
type RadioBus = "ess1" | "main2" | "avx";

/** A breaker-fed load has power: its bus is live and its breaker is in. */
export const pw = <B extends string>(
  s: { cb: Record<string, boolean | undefined> },
  E: Record<B, number>,
  bus: B,
  cb: string,
) => E[bus] > 0 && !s.cb[cb];

const pad = (n: number) => String(n).padStart(2, "0");
/** The Perspective+ PFD clock shows UTC (PG Fig 2-1). */
export const utcClock = () => {
  const d = new Date();
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

/** The fixed cruise picture an airplane without a flight model shows, and which ADAHRS data has failed (red X's). */
export interface CruisePicture {
  ias: number;
  tas: number;
  alt: number;
  hdg: number;
  baro: number;
  fail: FlightData["fail"];
}

/**
 * Flight data with no flight model or autopilot sim: attitude follows the yokes, air data is the airplane's fixed cruise
 * picture, and the COM, NAV and transponder windows dash out when their GIA or transponder loses power.
 */
export function cruiseFlight(
  s: { ctrl: { pitch: number; roll: number }; pitot: { oat: number }; cb: Record<string, boolean | undefined> },
  E: Record<RadioBus, number>,
  pic: CruisePicture,
): FlightData {
  const dash: [string, string] = ["----", "----"];
  const xpdr = pw(s, E, "avx", "XPONDER");
  return {
    pitch: s.ctrl.pitch * 10,
    roll: s.ctrl.roll * 25,
    slip: 0,
    ias: pic.ias,
    tas: pic.tas,
    gs: pic.tas,
    alt: pic.alt,
    vs: 0,
    hdg: pic.hdg,
    trk: pic.hdg,
    baro: pic.baro,
    oat: s.pitot.oat,
    hdgBug: pic.hdg,
    crs: pic.hdg,
    cdi: 0,
    navSrc: "GPS",
    selAlt: pic.alt,
    pos: [0, 0],
    xtk: 0,
    // GIA 1: COM 1 + GPS NAV GIA 1 on ESS BUS 1; GIA 2: COM 2 + GPS NAV GIA 2 on MAIN BUS 2
    com1: pw(s, E, "ess1", "COM 1") ? undefined : dash,
    com2: pw(s, E, "main2", "COM 2") ? undefined : dash,
    nav1: pw(s, E, "ess1", "GPS NAV GIA 1") ? undefined : dash,
    nav2: pw(s, E, "main2", "GPS NAV GIA 2") ? undefined : dash,
    xpdr: xpdr ? "1200" : "----",
    xpdrMode: xpdr ? "ALT" : "FAIL",
    time: utcClock(),
    fail: pic.fail,
  };
}

type DisplaySim = { avx: { backup: boolean } };
type DisplayElec = { pfd: boolean; mfd: boolean };

/**
 * Reversionary mode: losing one display puts PFD symbology plus the Engine Strip on the other automatically (SR20 POH 7-72,
 * SR22T POH 7-74), and DISPLAY BACKUP puts both displays in reversionary mode (PG p. 12, Fig 1-6). `E.pfd` is false when
 * the PFD has failed.
 */
export const pfdReversion = (s: DisplaySim, E: DisplayElec) => E.pfd && (s.avx.backup || !E.mfd);
export const mfdReversion = (s: DisplaySim, E: DisplayElec) => E.mfd && (s.avx.backup || !E.pfd);

/** The PFD and MFD screens from the airplane's PFD data and Engine Strip; reversionary mode draws the MFD layout. */
export function perspectiveScreens<S extends DisplaySim, E extends DisplayElec>(
  pfdData: (s: S, E: E) => PfdData,
  eisGauges: (s: S, E: E) => Gauge[],
) {
  const mfdData = (s: S, E: E, reversion: boolean): MfdData => ({
    ...pfdData(s, E),
    eis: eisGauges(s, E),
    reversion,
    page: "Map - Navigation Map",
  });
  return {
    drawPfdScreen(ctx: Ctx, W: number, H: number, s: S, E: E) {
      if (pfdReversion(s, E)) drawMFD(ctx, W, H, mfdData(s, E, true));
      else drawPFD(ctx, W, H, pfdData(s, E));
    },
    drawMfdScreen(ctx: Ctx, W: number, H: number, s: S, E: E) {
      drawMFD(ctx, W, H, mfdData(s, E, mfdReversion(s, E)));
    },
  };
}
