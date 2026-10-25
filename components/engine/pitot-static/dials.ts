/**
 * The three pitot-static instrument faces, drawn on a canvas: the airspeed indicator with the 172S POH's markings
 * (Figure 2-2), the three-pointer altimeter and the vertical speed indicator (PHAK Figure 8-5's face). The airspeed and
 * altimeter faces are the shared standby instruments'; the VSI's is drawn here. Faces are schematic.
 */
import { drawStandbyAirspeed, drawStandbyAltimeter } from "@/lib/avionics/g1000/standby";
import { D2R, WHITE, clamp, line, poly, txt } from "@/lib/avionics/g1000/draw";
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
