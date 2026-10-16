/** Palette and drawing primitives shared by the G1000 / Perspective+ PFD, MFD and standby instruments. */

type Ctx = CanvasRenderingContext2D;

/* ---------- palette & helpers ---------- */

export const WHITE = "#FFFFFF",
  CYAN = "#00F0FF",
  MAG = "#FF2EFF",
  GREEN = "#2BFF2B",
  YEL = "#FFE000",
  RED = "#FF2020",
  GRAY = "#8E979E";
export const TAPE = "rgba(20,24,28,0.55)",
  D2R = Math.PI / 180;
export const FONT = `Arial, "Liberation Sans", "DejaVu Sans", Helvetica, sans-serif`;
export const BAND: Record<string, string> = { green: "#14D21E", yellow: "#FFD400", red: RED, white: WHITE };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrap360 = (a: number) => ((a % 360) + 360) % 360;
export const pad3 = (h: number) => String(Math.round(wrap360(h)) || 360).padStart(3, "0");
export const now = () => (typeof performance !== "undefined" ? performance.now() / 1000 : 0);
export const blinkOn = (t: number, hz = 2) => Math.floor(t * hz * 2) % 2 === 0;

export function txt(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  c: string,
  px: number,
  align: CanvasTextAlign = "left",
  w = 700,
) {
  ctx.font = `${w} ${px}px ${FONT}`;
  ctx.fillStyle = c;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}
export function rect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: string | null,
  stroke?: string | null,
  lw = 1,
) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }
}
export function poly(ctx: Ctx, pts: number[], fill?: string | null, stroke?: string | null, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, c: string, lw = 1) {
  ctx.strokeStyle = c;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
/** `s` cut to `maxW` at a bold `px` font, ending in "…" when it had to be cut. */
export function clip(ctx: Ctx, s: string, maxW: number, px: number) {
  ctx.font = `700 ${px}px ${FONT}`;
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}
/** Red X across a failed field. */
export function redX(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + w - 3, y + h - 3);
  ctx.moveTo(x + w - 3, y + 3);
  ctx.lineTo(x + 3, y + h - 3);
  ctx.stroke();
  ctx.restore();
}

/** Black background, uniform scale of the 640×480 design grid, clipped. */
export function frame(ctx: Ctx, W: number, H: number, body: () => void) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const k = Math.min(W / 640, H / 480);
  ctx.translate((W - 640 * k) / 2, (H - 480 * k) / 2);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.rect(0, 0, 640, 480);
  ctx.clip();
  ctx.lineJoin = "round";
  body();
  ctx.restore();
}
