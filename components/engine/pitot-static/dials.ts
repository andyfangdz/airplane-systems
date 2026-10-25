/**
 * The pitot-static instrument faces, drawn on a canvas: the airspeed indicator with the 172S POH's markings
 * (Figure 2-2), the three-pointer altimeter and the vertical speed indicator (PHAK Figure 8-5's face), and the G1000
 * PFD with the air data computer's airspeed, altitude and vertical speed. The airspeed and altimeter faces are the
 * shared standby instruments' and the PFD the shared G1000 drawing; the VSI's face is drawn here. Faces are schematic.
 */
import { drawStandbyAirspeed, drawStandbyAltimeter } from "@/lib/avionics/g1000/standby";
import { D2R, WHITE, clamp, line, poly, txt } from "@/lib/avionics/g1000/draw";
import { drawPFD } from "@/lib/avionics/g1000/pfd";
import type { PfdData, SpeedBands } from "@/lib/avionics/g1000/types";
import type { Pfd, PSState } from "@/engines/components/pitot-static/model";
import { PITOT_STATIC } from "@/engines/components/pitot-static/spec";

type Ctx = CanvasRenderingContext2D;

const M = PITOT_STATIC.poh.markings;
/** Figure 2-2's arcs and red line; the red arc is on the G1000 tape only. */
const BANDS = {
  white: [M.white[0], M.white[1]] as [number, number],
  green: [M.green[0], M.green[1]] as [number, number],
  yellow: [M.yellow[0], M.yellow[1]] as [number, number],
  red: M.redLine,
};

export const drawAsi = (ctx: Ctx, W: number, H: number, ias: number) => drawStandbyAirspeed(ctx, W, H, ias, BANDS, 200);

export const drawAlt = (ctx: Ctx, W: number, H: number, alt: number, baro: number) =>
  drawStandbyAltimeter(ctx, W, H, alt, baro);

/** The VSI's full scale either way, fpm, and its sweep from zero at 9 o'clock, degrees. */
const FULL = PITOT_STATIC.model.vsiStop,
  SWEEP = 170;

/** Needle angle, clockwise from 12 o'clock: zero at 9 o'clock, up over the top, down under the bottom. */
const vsiAngle = (fpm: number) => (-90 + (clamp(fpm, -FULL, FULL) / FULL) * SWEEP) * D2R;

/** Vertical speed indicator, thousands of feet per minute; a broken glass draws cracks across it. */
export function drawVsi(ctx: Ctx, W: number, H: number, fpm: number, broken: boolean) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2,
    cy = H / 2,
    R = Math.min(W, H) / 2 - 2;
  const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, "#4A4F55");
  g.addColorStop(1, "#1A1D20");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  const r = R * 0.9,
    u = r / 100;
  ctx.fillStyle = "#0A0B0C";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  for (let v = -FULL; v <= FULL; v += 100) {
    const a = vsiAngle(v),
      big = v % 500 === 0;
    line(
      ctx,
      cx + Math.sin(a) * 92 * u,
      cy - Math.cos(a) * 92 * u,
      cx + Math.sin(a) * (big ? 76 : 84) * u,
      cy - Math.cos(a) * (big ? 76 : 84) * u,
      WHITE,
      (big ? 2 : 1.2) * u,
    );
    if (big) {
      const k = Math.abs(v) / 1000;
      const label = k === 0 ? "0" : k % 1 ? String(k).replace(/^0/, "") : String(k);
      txt(ctx, label, cx + Math.sin(a) * 63 * u, cy - Math.cos(a) * 63 * u, WHITE, 13 * u, "center");
    }
  }
  txt(ctx, "UP", cx - 34 * u, cy - 26 * u, WHITE, 9 * u, "center");
  txt(ctx, "DOWN", cx - 34 * u, cy + 26 * u, WHITE, 9 * u, "center");
  txt(ctx, "VERTICAL SPEED", cx + 10 * u, cy - 12 * u, WHITE, 7 * u, "center", 500);
  txt(ctx, "1000 FT PER MIN", cx + 10 * u, cy + 12 * u, WHITE, 7 * u, "center", 500);
  const a = vsiAngle(fpm),
    len = 86 * u,
    w = 4 * u,
    tail = len * 0.12;
  const dx = Math.sin(a),
    dy = -Math.cos(a);
  poly(
    ctx,
    [
      cx + dx * len,
      cy + dy * len,
      cx - dx * tail + dy * -w,
      cy - dy * tail + dx * w,
      cx - dx * tail - dy * -w,
      cy - dy * tail - dx * w,
    ],
    WHITE,
  );
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * u, 0, Math.PI * 2);
  ctx.fill();
  if (broken) {
    ctx.strokeStyle = "rgba(220,235,245,0.75)";
    ctx.lineWidth = 1.4 * u;
    const ox = cx + 18 * u,
      oy = cy - 22 * u;
    for (const [ang, len2, kink] of [
      [-2.6, 95, 0.3],
      [-1.2, 80, -0.25],
      [0.3, 100, 0.2],
      [1.5, 70, -0.3],
      [2.4, 90, 0.25],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      const mx = ox + Math.cos(ang) * len2 * 0.45 * u,
        my = oy + Math.sin(ang) * len2 * 0.45 * u;
      ctx.lineTo(mx, my);
      ctx.lineTo(mx + Math.cos(ang + kink) * len2 * 0.55 * u, my + Math.sin(ang + kink) * len2 * 0.55 * u);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- the G1000 PFD

/** The PFD's airspeed tape: Figure 2-2's arcs and red line, and the red low-airspeed arc from 20 kt to the white arc,
 * which only the G1000 shows. */
const TAPE: SpeedBands = { ...BANDS };

/** The PFD's attitude, which the AHRS would give: wings level, nose on the flight path (schematic). */
export const pitchOf = (x: Pick<PSState, "vs" | "ktas">) =>
  x.ktas > 30 ? (Math.atan2((x.vs * 0.3048) / 60, x.ktas * 0.514444) * 180) / Math.PI : 0;

export interface PfdView {
  pfd: Pfd;
  /** BARO setting, inHg, and the OAT probe, °C. */
  baro: number;
  oat: number;
  /** Pitch for the attitude indicator, degrees (the AHRS isn't modelled: the flight path angle stands in). */
  pitch: number;
}

const pfdData = (v: PfdView): PfdData => ({
  f: {
    pitch: v.pitch,
    roll: 0,
    ias: v.pfd.ias,
    tas: v.pfd.tas,
    alt: v.pfd.alt,
    vs: v.pfd.vs,
    hdg: 360,
    baro: v.baro,
    oat: v.oat,
    hdgBug: 360,
    crs: 360,
    navSrc: "GPS",
    iasTrend: v.pfd.iasTrend,
    // a red X over airspeed, altitude and vertical speed with no air data (Garmin 190-00498-07 p. 565)
    fail: v.pfd.valid ? undefined : { air: true },
  },
  speeds: TAPE,
  alerts: [],
  t: 0,
});

/** The whole PFD. */
export const drawPfd = (ctx: Ctx, W: number, H: number, v: PfdView) => drawPFD(ctx, W, H, pfdData(v));

/** Where the air data sits on the 640 × 480 PFD: the airspeed tape, and the altimeter with the VSI, between the boxes
 * above and below them. */
const CROPS = [
  [66, 142],
  [450, 562],
] as const;
const TOP = 60,
  BOTTOM = 298,
  GAP = 6;

/** The PFD's air data alone: a whole PFD drawn on `scratch` at this height, its tapes copied side by side. */
export function drawPfdTapes(ctx: Ctx, W: number, H: number, v: PfdView, scratch: HTMLCanvasElement) {
  const k = H / (BOTTOM - TOP);
  scratch.width = Math.round(640 * k);
  scratch.height = Math.round(480 * k);
  const sc = scratch.getContext("2d");
  if (!sc) return;
  drawPFD(sc, scratch.width, scratch.height, pfdData(v));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  let x = 0;
  for (const [a, b] of CROPS) {
    ctx.drawImage(scratch, a * k, TOP * k, (b - a) * k, H, x, 0, (b - a) * k, H);
    x += (b - a + GAP) * k;
  }
}
