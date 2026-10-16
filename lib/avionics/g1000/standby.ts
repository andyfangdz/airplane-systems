/** Round, analog standby instruments: airspeed, altimeter (also the M20C's panel altimeter dial) and attitude. */
import type { SpeedBands } from "./types";
import { WHITE, RED, D2R, BAND, clamp, txt, rect, poly, line } from "./draw";

type Ctx = CanvasRenderingContext2D;

/* ---------- standby instruments (round, analog) ---------- */

function dialFrame(ctx: Ctx, W: number, H: number): [number, number, number] {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2,
    cy = H / 2,
    r = Math.min(W, H) / 2 - 2;
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, "#4A4F55");
  g.addColorStop(1, "#1A1D20");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0A0B0C";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  return [cx, cy, r * 0.9];
}
/** Tapered needle from the centre toward angle `a` (clockwise from 12 o'clock). */
const needle = (ctx: Ctx, cx: number, cy: number, a: number, len: number, w: number, c = WHITE) => {
  const dx = Math.sin(a),
    dy = -Math.cos(a),
    px = Math.cos(a),
    py = Math.sin(a),
    tail = len * 0.12;
  poly(
    ctx,
    [
      cx + dx * len,
      cy + dy * len,
      cx - dx * tail + px * w,
      cy - dy * tail + py * w,
      cx - dx * tail - px * w,
      cy - dy * tail - py * w,
    ],
    c,
  );
};

/** Round standby airspeed indicator (kt) with white/green/yellow arcs and red Vne line. */
export function drawStandbyAirspeed(ctx: Ctx, W: number, H: number, ias: number, b: SpeedBands = {}, max = 200) {
  const [cx, cy, r] = dialFrame(ctx, W, H),
    u = r / 100;
  const ang = (v: number) => (15 + (clamp(v, 0, max) / max) * 320) * D2R; // clockwise from 12 o'clock
  const arc = (v0: number, v1: number, c: string, rr: number, lw: number) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw * u;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * u, ang(v0) - Math.PI / 2, ang(v1) - Math.PI / 2);
    ctx.stroke();
  };
  if (b.white) arc(b.white[0], b.white[1], WHITE, 80, 5);
  if (b.green) arc(b.green[0], b.green[1], BAND.green, 88, 7);
  if (b.yellow) arc(b.yellow[0], b.yellow[1], BAND.yellow, 88, 7);
  for (let v = 40; v <= max; v += 10) {
    const a = ang(v),
      big = v % 20 === 0;
    line(
      ctx,
      cx + Math.sin(a) * 92 * u,
      cy - Math.cos(a) * 92 * u,
      cx + Math.sin(a) * (big ? 78 : 84) * u,
      cy - Math.cos(a) * (big ? 78 : 84) * u,
      WHITE,
      1.4 * u,
    );
    if (big) txt(ctx, String(v), cx + Math.sin(a) * 64 * u, cy - Math.cos(a) * 64 * u, WHITE, 11 * u, "center");
  }
  if (b.red) {
    const a = ang(b.red);
    line(
      ctx,
      cx + Math.sin(a) * 94 * u,
      cy - Math.cos(a) * 94 * u,
      cx + Math.sin(a) * 74 * u,
      cy - Math.cos(a) * 74 * u,
      RED,
      3 * u,
    );
  }
  txt(ctx, "AIRSPEED", cx, cy - 26 * u, WHITE, 8 * u, "center");
  txt(ctx, "KNOTS", cx, cy + 28 * u, WHITE, 8 * u, "center");
  needle(ctx, cx, cy, ang(Math.max(ias, 0)), 86 * u, 4 * u);
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * u, 0, Math.PI * 2);
  ctx.fill();
}

/** Round standby altimeter: 100 ft, 1,000 ft and 10,000 ft hands, Kollsman window (inHg). */
export function drawStandbyAltimeter(ctx: Ctx, W: number, H: number, alt: number, baro: number) {
  const [cx, cy, r] = dialFrame(ctx, W, H);
  drawAltimeterDial(ctx, cx, cy, r, alt, baro);
}

/** Three-hand sensitive-altimeter face, reusable inside an aircraft-specific bezel. `r` is the face radius. */
export function drawAltimeterDial(ctx: Ctx, cx: number, cy: number, r: number, alt: number, baro: number) {
  const u = r / 100;
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2,
      big = i % 5 === 0;
    line(
      ctx,
      cx + Math.sin(a) * 92 * u,
      cy - Math.cos(a) * 92 * u,
      cx + Math.sin(a) * (big ? 80 : 86) * u,
      cy - Math.cos(a) * (big ? 80 : 86) * u,
      WHITE,
      (big ? 2 : 1) * u,
    );
    if (big) txt(ctx, String(i / 5), cx + Math.sin(a) * 68 * u, cy - Math.cos(a) * 68 * u, WHITE, 14 * u, "center");
  }
  rect(ctx, cx + 30 * u, cy - 8 * u, 36 * u, 16 * u, "#000", "#777", 1);
  txt(ctx, baro.toFixed(2), cx + 48 * u, cy, WHITE, 9 * u, "center");
  txt(ctx, "ALT", cx, cy - 32 * u, WHITE, 9 * u, "center");
  const a100 = ((alt % 1000) / 1000) * Math.PI * 2,
    a1k = ((alt % 10000) / 10000) * Math.PI * 2,
    a10k = ((alt % 100000) / 100000) * Math.PI * 2;
  needle(ctx, cx, cy, a10k, 92 * u, 1.5 * u, "#BBB");
  needle(ctx, cx, cy, a1k, 52 * u, 6 * u);
  needle(ctx, cx, cy, a100, 84 * u, 3.5 * u);
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * u, 0, Math.PI * 2);
  ctx.fill();
}

/** Round standby attitude indicator. `flag` shows a red/orange warning flag, e.g. "GYRO" (vacuum) or "OFF" (electric). */
export function drawStandbyAttitude(ctx: Ctx, W: number, H: number, pitch: number, roll: number, flag?: string | null) {
  const [cx, cy, r] = dialFrame(ctx, W, H),
    u = r / 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll * D2R);
  const ppd = 2.6 * u;
  ctx.translate(0, pitch * ppd);
  ctx.fillStyle = "#2F7AD8";
  ctx.fillRect(-2 * r, -3 * r, 4 * r, 3 * r);
  ctx.fillStyle = "#7A4A1F";
  ctx.fillRect(-2 * r, 0, 4 * r, 3 * r);
  line(ctx, -2 * r, 0, 2 * r, 0, WHITE, 2 * u);
  for (const p of [-20, -10, 10, 20])
    line(
      ctx,
      -(Math.abs(p) === 10 ? 22 : 34) * u,
      -p * ppd,
      (Math.abs(p) === 10 ? 22 : 34) * u,
      -p * ppd,
      WHITE,
      1.5 * u,
    );
  ctx.translate(0, -pitch * ppd);
  for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) {
    const ra = a * D2R,
      l = a === 0 ? 0 : Math.abs(a) % 30 === 0 ? 14 : 8;
    if (a === 0) poly(ctx, [0, -92 * u, -6 * u, -82 * u, 6 * u, -82 * u], WHITE);
    else
      line(
        ctx,
        Math.sin(ra) * 92 * u,
        -Math.cos(ra) * 92 * u,
        Math.sin(ra) * (92 - l) * u,
        -Math.cos(ra) * (92 - l) * u,
        WHITE,
        2 * u,
      );
  }
  ctx.restore();
  poly(ctx, [cx, cy - 92 * u + 12 * u, cx - 6 * u, cy - 92 * u + 22 * u, cx + 6 * u, cy - 92 * u + 22 * u], "#FF8A00");
  line(ctx, cx - 50 * u, cy, cx - 16 * u, cy, "#FF8A00", 4 * u);
  line(ctx, cx + 16 * u, cy, cx + 50 * u, cy, "#FF8A00", 4 * u);
  ctx.fillStyle = "#FF8A00";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * u, 0, Math.PI * 2);
  ctx.fill();
  if (flag) {
    ctx.save();
    ctx.translate(cx - 44 * u, cy - 40 * u);
    ctx.rotate(-0.5);
    rect(ctx, -22 * u, -10 * u, 44 * u, 20 * u, "#E2401C", "#000", 1);
    txt(ctx, flag, 0, 1, WHITE, 11 * u, "center");
    ctx.restore();
  }
}
