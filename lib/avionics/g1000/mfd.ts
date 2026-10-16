/** MFD: EIS strip, engine gauges and the moving map; reversionary mode adds the PFD instruments. */
import type { Gauge, MfdData } from "./types";
import {
  WHITE,
  MAG,
  YEL,
  RED,
  GRAY,
  D2R,
  FONT,
  BAND,
  clamp,
  now,
  blinkOn,
  txt,
  rect,
  poly,
  line,
  redX,
  frame,
} from "./draw";
import { BOT, PFD_KEYS, PP_PFD_KEYS, PP_SUBDUED, TOP, isPP, layout, pfdBody, softkeys, topBar } from "./pfd";

type Ctx = CanvasRenderingContext2D;

/* ---------- MFD ---------- */

const EIS_W = 130;
const MFD_KEYS = ["ENGINE", "", "MAP", "", "", "", "", "", "", "DCLTR", "SHW CHRT", "CHKLIST"];
const PP_MFD_KEYS = ["Engine", "", "Map Opt", "", "", "", "", "", "", "Detail", "Charts", "Checklist"];

/** Multi-function display: EIS strip + navigation map, or (reversion) PFD + EIS strip. */
export function drawMFD(ctx: Ctx, W: number, H: number, d: MfdData) {
  frame(ctx, W, H, () => {
    const t = d.t ?? now(),
      pp = isPP(d);
    if (d.reversion) {
      pfdBody(ctx, d, layout(EIS_W, 640 - EIS_W));
      topBar(ctx, d.f, false);
    } else {
      navMap(ctx, d);
      topBar(ctx, d.f, true, true, !pp);
    }
    eisStrip(ctx, 0, TOP, EIS_W, BOT - TOP, d, t);
    const mfdKeys = pp ? PP_MFD_KEYS : MFD_KEYS;
    softkeys(
      ctx,
      d.reversion ? [mfdKeys[0], ...(pp ? PP_PFD_KEYS : PFD_KEYS).slice(1)] : mfdKeys,
      pp ? PP_SUBDUED : undefined,
    );
  });
}

function eisStrip(ctx: Ctx, x: number, y: number, w: number, h: number, d: MfdData, t: number) {
  rect(ctx, x, y, w, h, "#05070A");
  line(ctx, x + w - 0.5, y, x + w - 0.5, y + h, "#5A6168");
  let yy = y + 4;
  if (d.eisTitle) {
    txt(ctx, d.eisTitle, x + w / 2, yy + 7, WHITE, 12, "center");
    yy += 16;
  }
  for (const g of d.eis) yy += gauge(ctx, g, x, yy, w, t);
}

const H_OF = { dial: 78, bar: 36, pair: 50, text: 17, text2: 30, head: 18, tanks: 100 } as const;
const H_COMPACT = { dial: 60, bar: 30 } as const;

function gauge(ctx: Ctx, g: Gauge, x: number, y: number, w: number, t: number): number {
  const on = blinkOn(t),
    warn = g.alert === "warning",
    caut = g.alert === "caution";
  const valC = warn ? (on ? WHITE : RED) : caut ? YEL : WHITE;
  const frac = (v: number) => clamp((v - g.min) / (g.max - g.min), 0, 1);
  const fmt = (v: number) => (g.fmt ? g.fmt(v) : String(Math.round(v)));
  const readout = (s: string, xx: number, yy: number, px: number, align: CanvasTextAlign) => {
    if (warn && on) {
      ctx.font = `700 ${px}px ${FONT}`;
      const tw = ctx.measureText(s).width;
      rect(ctx, align === "right" ? xx - tw - 3 : xx - tw / 2 - 3, yy - px / 2 - 1, tw + 6, px + 2, RED);
    }
    txt(ctx, s, xx, yy, valC, px, align);
  };
  switch (g.style) {
    case "head":
      txt(ctx, g.label, x + w / 2, y + 9, GRAY, 11, "center");
      line(ctx, x + 6, y + 9, x + 24, y + 9, "#3A4046");
      line(ctx, x + w - 24, y + 9, x + w - 6, y + 9, "#3A4046");
      return H_OF.head;
    case "text": {
      if (g.value2 !== undefined && g.text == null) {
        // two columns: "M BUS  E BUS" over value / value2
        const labs = g.label.split(/\s{2,}/),
          cols = [x + w * 0.28, x + w * 0.74];
        [g.value, g.value2].forEach((v, i) => {
          txt(ctx, labs[i] ?? "", cols[i], y + 7, GRAY, 10, "center");
          if (v == null) redX(ctx, cols[i] - 18, y + 14, 36, 14);
          else readout(fmt(v), cols[i], y + 21, 13, "center");
        });
        return H_OF.text2;
      }
      txt(ctx, g.label, x + 6, y + 8, WHITE, 11);
      if (g.value === null && g.text == null) redX(ctx, x + w - 46, y + 1, 40, 14);
      else readout(g.text ?? fmt(g.value ?? 0), x + w - 6, y + 8, 12, "right");
      return H_OF.text;
    }
    case "dial": {
      const k = g.compact,
        hh = k ? H_COMPACT.dial : H_OF.dial;
      const cx = x + w / 2,
        cy = y + (k ? 32 : 42),
        r = k ? 26 : 33,
        a0 = 150 * D2R,
        sw = 240 * D2R,
        ang = (v: number) => a0 + frac(v) * sw;
      ctx.lineWidth = 6;
      for (const [b0, b1, c] of g.bands ?? []) {
        ctx.strokeStyle = BAND[c];
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, ang(b0), ang(b1));
        ctx.stroke();
      }
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1, a0, a0 + sw);
      ctx.stroke();
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * sw;
        line(
          ctx,
          cx + Math.cos(a) * (r + 1),
          cy + Math.sin(a) * (r + 1),
          cx + Math.cos(a) * (r - 6),
          cy + Math.sin(a) * (r - 6),
          WHITE,
          1.2,
        );
      }
      txt(ctx, g.label, cx, cy + (k ? 9 : 12), WHITE, k ? 10 : 11, "center");
      if (g.value == null) {
        redX(ctx, cx - r, cy - r, 2 * r, 2 * r);
        return hh;
      }
      const a = ang(g.value),
        pc = warn ? RED : caut ? YEL : WHITE;
      poly(
        ctx,
        [
          cx + Math.cos(a) * (r - 1),
          cy + Math.sin(a) * (r - 1),
          cx + Math.cos(a + 1.5) * 4,
          cy + Math.sin(a + 1.5) * 4,
          cx + Math.cos(a - 1.5) * 4,
          cy + Math.sin(a - 1.5) * 4,
        ],
        pc,
        "#000",
        1,
      );
      readout(fmt(g.value), cx, cy + (k ? 20 : 27), k ? 14 : 15, "center");
      return hh;
    }
    case "bar":
    case "pair": {
      const pair = g.style === "pair",
        bx = x + (pair ? 15 : 9),
        bw = w - (pair ? 30 : 18),
        by = y + (pair ? 26 : g.compact ? 21 : 25);
      if (pair) txt(ctx, g.label, x + w / 2, y + 8, WHITE, 11, "center");
      else {
        txt(ctx, g.label + (g.unit ? " " + g.unit : ""), x + 6, y + 8, WHITE, 11);
        if (g.value != null && g.fmt) readout(fmt(g.value), x + w - 6, y + 8, 12, "right");
      }
      rect(ctx, bx, by, bw, 6, "#3B4147");
      for (const [b0, b1, c] of g.bands ?? [])
        rect(ctx, bx + frac(b0) * bw, by, (frac(b1) - frac(b0)) * bw, 6, BAND[c]);
      const ptr = (v: number, up: boolean, lab?: string) => {
        const px = bx + frac(v) * bw,
          pc = warn ? RED : caut ? YEL : WHITE;
        if (up) poly(ctx, [px, by - 1, px - 6, by - 11, px + 6, by - 11], pc, "#000", 1);
        else poly(ctx, [px, by + 7, px - 6, by + 17, px + 6, by + 17], pc, "#000", 1);
        if (lab) txt(ctx, lab, px, up ? by - 7 : by + 13, "#000", 8, "center");
      };
      if (g.value == null) redX(ctx, bx, by - 10, bw, 22);
      else ptr(g.value, true, pair ? "L" : g.ptrLabel);
      if (pair) {
        if (g.value2 === null) redX(ctx, bx, by - 4, bw, 22);
        else if (g.value2 != null) ptr(g.value2, false, "R");
        txt(ctx, fmt(g.min), x + 4, by + 3, GRAY, 9);
        txt(ctx, "F", x + w - 4, by + 3, GRAY, 9, "right");
        return H_OF.pair;
      }
      return g.compact ? H_COMPACT.bar : H_OF.bar;
    }
    case "tanks": {
      // Perspective+ fuel block (PG Fig 3-2): L/R vertical tank bars with a scale between them, fuel flow bar on the right
      const top = y + 12,
        hh = 62,
        bot = top + hh;
      // each pointer takes the colour of the band it sits in (red / yellow), so one low tank doesn't colour the other
      const vbar = (bx: number, gg: Gauge, v: number | null | undefined, ptrLeft: boolean) => {
        const fr = (u: number) => clamp((u - gg.min) / (gg.max - gg.min), 0, 1);
        rect(ctx, bx, top, 6, hh, "#3B4147");
        for (const [b0, b1, c] of gg.bands ?? []) rect(ctx, bx, bot - fr(b1) * hh, 6, (fr(b1) - fr(b0)) * hh, BAND[c]);
        if (v == null) {
          redX(ctx, bx - 7, top, 20, hh);
          return;
        }
        const band = gg.bands?.find(([b0, b1]) => v >= b0 && v <= b1)?.[2];
        const py = bot - fr(v) * hh,
          pc = band === "red" ? RED : band === "yellow" ? YEL : WHITE;
        if (ptrLeft) poly(ctx, [bx - 1, py, bx - 10, py - 5, bx - 10, py + 5], pc, "#000", 1);
        else poly(ctx, [bx + 7, py, bx + 16, py - 5, bx + 16, py + 5], pc, "#000", 1);
      };
      line(ctx, x + 4, y + 1, x + w - 4, y + 1, "#3A4046");
      const lx = x + 18,
        rx = x + 46,
        sc = x + 35;
      vbar(lx, g, g.value, true);
      vbar(rx, g, g.value2, false);
      txt(ctx, "F", sc, top - 5, GRAY, 8, "center");
      for (let v = g.min; v < g.max - 2; v += 5) txt(ctx, String(v), sc, bot - frac(v) * hh, GRAY, 8, "center");
      txt(ctx, "L", lx + 3, bot + 8, WHITE, 10, "center");
      txt(ctx, "R", rx + 3, bot + 8, WHITE, 10, "center");
      txt(ctx, g.label, sc, bot + 20, WHITE, 11, "center");
      const sd = g.side;
      if (sd) {
        const sx = x + w - 26,
          sv = sd.value,
          sc2 = sd.alert === "warning" ? RED : sd.alert === "caution" ? YEL : WHITE;
        vbar(sx, sd, sv, true);
        if (sv != null) txt(ctx, sd.fmt ? sd.fmt(sv) : String(Math.round(sv)), x + w - 6, bot + 8, sc2, 13, "right");
        txt(ctx, sd.label, x + w - 6, bot + 20, WHITE, 10, "right");
      }
      return H_OF.tanks;
    }
  }
}

/* moving map (heading up) */
const WPT = ["KOLAY", "DEMIE", "TRAXX", "PIKKE", "OSHEA", "LUNIX", "MORRA", "VIKKO", "BEENO", "ZAPPA"];
function hash(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function navMap(ctx: Ctx, d: MfdData) {
  const f = d.f,
    X0 = EIS_W,
    Y0 = TOP + 18,
    MW = 640 - X0,
    MH = BOT - Y0,
    mx = X0 + MW / 2,
    my = Y0 + MH * 0.68,
    s = 15; // px per nm
  const [px, py] = f.pos ?? [0, 0],
    h = (f.trk ?? f.hdg) * D2R,
    sh = Math.sin(h),
    ch = Math.cos(h);
  const scr = (wx: number, wy: number): [number, number] => {
    const dx = wx - px,
      dy = wy - py;
    return [mx + (dx * ch - dy * sh) * s, my - (dx * sh + dy * ch) * s];
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, Y0, MW, MH);
  ctx.clip();
  ctx.fillStyle = "#17301A";
  ctx.fillRect(X0, Y0, MW, MH);
  // terrain / water blobs on a 4 nm world grid
  const R = 26,
    c = 4;
  for (let i = Math.floor((px - R) / c); i <= Math.ceil((px + R) / c); i++)
    for (let j = Math.floor((py - R) / c); j <= Math.ceil((py + R) / c); j++) {
      const v = hash(i, j),
        [sx, sy] = scr(i * c + hash(j, i) * c, j * c + hash(i + 7, j) * c),
        rad = (1.6 + 2.6 * hash(i + 3, j - 5)) * s;
      const col = v < 0.07 ? "#1E4F9A" : v < 0.45 ? "#24452A" : v < 0.75 ? "#3D5A2C" : v < 0.92 ? "#6B6436" : "#7E5634";
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      gr.addColorStop(0, col);
      gr.addColorStop(1, "rgba(23,48,26,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  // airports on a 9 nm grid
  for (let i = Math.floor((px - R) / 9); i <= Math.ceil((px + R) / 9); i++)
    for (let j = Math.floor((py - R) / 9); j <= Math.ceil((py + R) / 9); j++) {
      if (hash(i + 11, j + 13) > 0.3) continue;
      const [sx, sy] = scr(i * 9 + 4, j * 9 + 4);
      ctx.strokeStyle = "#3FA0FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.stroke();
      line(ctx, sx - 7, sy, sx + 7, sy, "#3FA0FF", 2);
      txt(
        ctx,
        "K" +
          String.fromCharCode(
            65 + Math.floor(hash(i, j + 1) * 26),
            65 + Math.floor(hash(i + 2, j) * 26),
            65 + Math.floor(hash(i, j + 3) * 26),
          ),
        sx + 9,
        sy - 7,
        WHITE,
        10,
      );
    }
  // active course (magenta) through the airplane's cross-track offset, with waypoints every 12 nm
  const cr = f.crs * D2R,
    ux = Math.sin(cr),
    uy = Math.cos(cr),
    xt = f.xtk ?? 0; // nm right of course
  const ox = px - xt * uy,
    oy = py + xt * ux,
    along = ox * ux + oy * uy,
    bx = ox - ux * along,
    by = oy - uy * along;
  const [ax, ay] = scr(bx + ux * (along - 60), by + uy * (along - 60)),
    [ex, ey] = scr(bx + ux * (along + 60), by + uy * (along + 60));
  line(ctx, ax, ay, ex, ey, MAG, 3.5);
  const n0 = Math.floor(along / 12);
  for (let n = n0 - 2; n <= n0 + 3; n++) {
    const [sx, sy] = scr(bx + ux * n * 12, by + uy * n * 12),
      act = n === n0 + 1;
    poly(
      ctx,
      [sx, sy - 6, sx + 2, sy - 2, sx + 6, sy, sx + 2, sy + 2, sx, sy + 6, sx - 2, sy + 2, sx - 6, sy, sx - 2, sy - 2],
      WHITE,
    );
    txt(ctx, WPT[((n % WPT.length) + WPT.length) % WPT.length], sx + 9, sy + 1, act ? MAG : WHITE, 11);
  }
  // compass ring and range
  const rr = 150;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(mx, my, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let a = 0; a < 360; a += 30) {
    const ra = (a - (f.trk ?? f.hdg)) * D2R,
      sx = mx + Math.sin(ra) * rr,
      sy = my - Math.cos(ra) * rr;
    line(ctx, mx + Math.sin(ra) * (rr - 6), my - Math.cos(ra) * (rr - 6), sx, sy, WHITE, 1.2);
    const lab = a === 0 ? "N" : a === 90 ? "E" : a === 180 ? "S" : a === 270 ? "W" : String(a / 10);
    txt(ctx, lab, mx + Math.sin(ra) * (rr + 10), my - Math.cos(ra) * (rr + 10), WHITE, 12, "center");
  }
  rect(ctx, mx + rr * 0.7 - 2, my + rr * 0.7 - 8, 38, 16, "#000");
  txt(ctx, "10NM", mx + rr * 0.7 + 17, my + rr * 0.7, WHITE, 11, "center");
  // ownship
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(1.3, 1.3);
  poly(
    ctx,
    [
      0, -14, 2, -6, 13, 0, 13, 3, 2, 1, 2, 9, 6, 12, 6, 14, 0, 12, -6, 14, -6, 12, -2, 9, -2, 1, -13, 3, -13, 0, -2,
      -6,
    ],
    WHITE,
    "#000",
    1,
  );
  ctx.restore();
  ctx.restore();
  // page title and map orientation
  rect(ctx, X0, TOP, MW, 18, "#22272C");
  txt(ctx, d.page ?? "MAP - NAVIGATION MAP", X0 + MW / 2, TOP + 9, WHITE, 12, "center");
  rect(ctx, X0 + 4, Y0 + 4, 54, 16, "#000");
  txt(ctx, "TRK UP", X0 + 31, Y0 + 12, WHITE, 11, "center");
}
