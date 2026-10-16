/** PFD: attitude, airspeed and altitude tapes, VSI, HSI, AFCS bar, annunciations, top bar and softkeys. */
import type { CasLevel } from "@/lib/systems";
import type { AfcsAnnunc, FlightData, PfdData } from "./types";
import {
  WHITE,
  CYAN,
  MAG,
  GREEN,
  YEL,
  RED,
  TAPE,
  D2R,
  FONT,
  BAND,
  clamp,
  pad3,
  now,
  blinkOn,
  txt,
  rect,
  poly,
  line,
  clip,
  redX,
  frame,
} from "./draw";

type Ctx = CanvasRenderingContext2D;

/* ---------- PFD layout ---------- */

export const TOP = 40,
  BOT = 464,
  TT = 86,
  TB = 272,
  YC = (TT + TB) / 2;
interface Lay {
  x0: number;
  w: number;
  cx: number;
  cy: number;
  asX: number;
  altX: number;
  vsiX: number;
  ann: { x: number; y: number; w: number };
  hy: number;
  hr: number;
}
/** Instrument positions for a PFD occupying x0…x0+w (full width, or right of the EIS strip in reversion). */
export function layout(x0: number, w: number): Lay {
  const full = w >= 600,
    cx = full ? x0 + w / 2 : x0 + 254;
  return {
    x0,
    w,
    cx,
    cy: YC,
    asX: cx - 248,
    altX: cx + 136,
    vsiX: cx + 208,
    hy: 393,
    hr: 70,
    ann: full ? { x: cx + 240, y: TT - 20, w: x0 + w - cx - 243 } : { x: x0 + w - 114, y: 338, w: 110 },
  };
}

export const PFD_KEYS = ["", "INSET", "", "PFD", "OBS", "CDI", "DME", "XPDR", "IDENT", "TMR/REF", "NRST", "ALERTS"];
/** Perspective+ level-1 softkeys (PG Fig 2-1, 3-1); OBS is subdued (unavailable) in the default picture. */
export const PP_PFD_KEYS = [
  "",
  "Map/HSI",
  "TFC Map",
  "PFD Opt",
  "OBS",
  "CDI",
  "DME",
  "XPDR",
  "Ident",
  "TMR/REF",
  "Nearest",
  "Alerts",
];
export const PP_SUBDUED = new Set(["OBS"]);
export const isPP = (d: PfdData) => d.style === "perspective";

/** Primary flight display. */
export function drawPFD(ctx: Ctx, W: number, H: number, d: PfdData) {
  const pp = isPP(d);
  frame(ctx, W, H, () => {
    pfdBody(ctx, d, layout(0, 640));
    topBar(ctx, d.f, false, !pp);
    if (pp) {
      // Cirrus percent-power box where the G1000 has its NAV box (PG Fig 2-1 item 1)
      const p = d.pctPower;
      txt(ctx, `${p == null ? "--" : Math.round(p)}% Power`, 85, 20, WHITE, 15, "center");
    }
    softkeys(ctx, pp ? PP_PFD_KEYS : PFD_KEYS, pp ? PP_SUBDUED : undefined);
  });
}

export function pfdBody(ctx: Ctx, d: PfdData, L: Lay) {
  const t = d.t ?? now(),
    pp = isPP(d);
  attitude(ctx, d, L);
  airspeed(ctx, d, L, t);
  altimeter(ctx, d, L);
  vsi(ctx, d, L);
  hsi(ctx, d.f, L, pp);
  if (d.afcs) afcsBar(ctx, d.afcs, L, t);
  sensorAnn(ctx, d, L);
  annWindow(ctx, d, L);
  // OAT, transponder, time
  if (pp) {
    rect(ctx, L.x0 + 4, 444, 136, 18, "#000", "#3A4046");
    txt(ctx, `OAT ${Math.round(d.f.oat)}°C`, L.x0 + 9, 453, WHITE, 12);
    txt(ctx, `OAT ${Math.round(d.f.oat * 1.8 + 32)}°F`, L.x0 + 135, 453, WHITE, 12, "right");
    // Flight ID box under the COM box (PG Fig A-2); no ID entered
    rect(ctx, 562, TOP + 3, 74, 16, "#000", "#3A4046");
    txt(ctx, "ID", 566, TOP + 11, WHITE, 10);
    txt(ctx, "--------", 632, TOP + 11, WHITE, 11, "right");
  } else {
    rect(ctx, L.x0 + 4, 444, 78, 18, "#000", "#3A4046");
    txt(ctx, `OAT ${Math.round(d.f.oat)}°C`, L.x0 + 9, 453, WHITE, 12);
  }
  rect(ctx, 540, 426, 96, 18, "#000", "#3A4046");
  txt(ctx, "XPDR", 545, 435, WHITE, 10);
  txt(ctx, d.f.xpdr ?? "1200", 575, 435, WHITE, 12);
  txt(ctx, d.f.xpdrMode ?? "ALT", 631, 435, GREEN, 11, "right");
  rect(ctx, 540, 444, 96, 18, "#000", "#3A4046");
  txt(ctx, pp ? "UTC" : "LCL", 545, 453, WHITE, 10);
  txt(ctx, d.f.time ?? "12:00:00", 631, 453, WHITE, 12, "right");
}

/* attitude indicator */
function attitude(ctx: Ctx, d: PfdData, L: Lay) {
  const { cx, cy } = L,
    f = d.f,
    ppd = 5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.x0, TOP, L.w, BOT - TOP);
  ctx.clip();
  if (f.fail?.att) {
    ctx.fillStyle = "#06090C";
    ctx.fillRect(L.x0, TOP, L.w, BOT - TOP);
    redX(ctx, L.asX + 72, TT + 4, L.altX - L.asX - 92, 176);
    ctx.restore();
    return;
  }
  const roll = f.roll * D2R;
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  ctx.translate(0, f.pitch * ppd);
  const sky = ctx.createLinearGradient(0, -420, 0, 0);
  sky.addColorStop(0, "#0A2E86");
  sky.addColorStop(1, "#4F8FEA");
  ctx.fillStyle = sky;
  ctx.fillRect(-900, -1400, 1800, 1400);
  const gnd = ctx.createLinearGradient(0, 0, 0, 420);
  gnd.addColorStop(0, "#9A6229");
  gnd.addColorStop(1, "#4D2E0F");
  ctx.fillStyle = gnd;
  ctx.fillRect(-900, 0, 1800, 1400);
  line(ctx, -900, 0, 900, 0, WHITE, 1.5);
  ctx.restore();

  // pitch ladder, clipped to the area between the tapes
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.asX + 72, TT + 2, L.altX - L.asX - 96, 188);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  ctx.translate(0, f.pitch * ppd);
  for (let p = -50; p <= 50; p += 2.5) {
    if (!p) continue;
    const y = -p * ppd,
      major = p % 10 === 0,
      mid = !major && p % 5 === 0,
      hw = major ? 40 : mid ? 20 : 10;
    if (Math.abs(p - f.pitch) > 26) continue;
    line(ctx, -hw, y, hw, y, WHITE, 1.5);
    if (major) {
      txt(ctx, String(Math.abs(p)), -hw - 13, y, WHITE, 13, "center");
      txt(ctx, String(Math.abs(p)), hw + 13, y, WHITE, 13, "center");
    }
  }
  ctx.restore();

  // roll scale (rotates with the horizon) and fixed roll pointer + slip/skid
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.x0, TOP, L.w, BOT - TOP);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const R = 112;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, R, -150 * D2R, -30 * D2R);
  ctx.stroke();
  for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const len = Math.abs(a) === 30 || Math.abs(a) === 60 ? 14 : 8,
      r = (a - 90) * D2R;
    if (Math.abs(a) === 45)
      poly(
        ctx,
        [
          Math.cos(r) * R,
          Math.sin(r) * R,
          Math.cos(r - 0.03) * (R + 8),
          Math.sin(r - 0.03) * (R + 8),
          Math.cos(r + 0.03) * (R + 8),
          Math.sin(r + 0.03) * (R + 8),
        ],
        WHITE,
      );
    else line(ctx, Math.cos(r) * R, Math.sin(r) * R, Math.cos(r) * (R + len), Math.sin(r) * (R + len), WHITE, 1.6);
  }
  poly(ctx, [0, -R, -7, -R - 11, 7, -R - 11], WHITE); // roll index zero
  ctx.restore();
  poly(ctx, [cx, cy - R + 1, cx - 8, cy - R + 13, cx + 8, cy - R + 13], WHITE); // roll pointer
  const sk = clamp(f.slip ?? 0, -1, 1) * 16;
  poly(
    ctx,
    [cx - 9 + sk, cy - R + 15, cx + 9 + sk, cy - R + 15, cx + 11 + sk, cy - R + 20, cx - 11 + sk, cy - R + 20],
    WHITE,
  );

  // flight director command bars (magenta) and the single-cue aircraft symbol (yellow). The bars show the commanded
  // attitude relative to the airplane: up for more pitch, banked right (clockwise) for a right-turn command.
  const cmd = d.afcs?.fd ? d.afcs.cmd : null;
  if (cmd) {
    ctx.save();
    ctx.translate(cx, cy - (cmd.pitch - f.pitch) * ppd);
    ctx.rotate((cmd.roll - f.roll) * D2R);
    poly(ctx, [0, -3, -74, 24, -74, 31, 0, 6, 74, 31, 74, 24], MAG, "#000", 1);
    ctx.restore();
  }
  poly(
    ctx,
    [cx, cy, cx - 62, cy + 25, cx - 36, cy + 25, cx, cy + 11, cx + 36, cy + 25, cx + 62, cy + 25],
    YEL,
    "#000",
    1.5,
  );
}

/* airspeed tape */
function airspeed(ctx: Ctx, d: PfdData, L: Lay, t: number) {
  const x = L.asX,
    w = 64,
    ppk = 3.2,
    f = d.f,
    s = d.speeds,
    a = d.afcs;
  rect(ctx, x, TT, w, TB - TT, TAPE);
  // above the tape: MAXSPD (flashing yellow) or the FLC airspeed reference
  if (a?.maxspd) {
    if (blinkOn(t)) {
      rect(ctx, x, TT - 20, w, 18, YEL);
      txt(ctx, "MAXSPD", x + w / 2, TT - 11, "#000", 12, "center");
    }
  } else if (a?.iasRef != null && a.fd) {
    rect(ctx, x, TT - 20, w, 18, "#000", "#4A5056");
    txt(ctx, `${a.iasRef}KT`, x + w / 2, TT - 11, CYAN, 14, "center");
  }
  rect(ctx, x, TB + 2, w, 16, "#000", "#3A4046");
  if (isPP(d)) {
    // Perspective+ ground speed (GPS): left of TAS on the full PFD (PG p. 48), under it in reversion (Fig 3-19)
    const full = L.w >= 600,
      gx = full ? x - 66 : x,
      gy = full ? TB + 2 : TB + 20;
    rect(ctx, gx, gy, w, 16, "#000", "#3A4046");
    txt(ctx, `GS ${Math.round(f.gs ?? f.tas ?? f.ias)}KT`, gx + w / 2, gy + 8, WHITE, 11, "center");
  }
  if (f.fail?.air) {
    redX(ctx, x, TT, w, TB - TT);
    txt(ctx, "TAS ---KT", x + w / 2, TB + 10, WHITE, 11, "center");
    return;
  }
  txt(ctx, `TAS ${Math.round(f.tas ?? f.ias)}KT`, x + w / 2, TB + 10, WHITE, 11, "center");
  const ias = Math.max(f.ias, 20),
    y = (v: number) => YC - (v - ias) * ppk;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, TT, w + 30, TB - TT);
  ctx.clip();
  // colour bands along the right edge
  const bx = x + w - 7,
    band = (a0: number, a1: number, c: string, bw = 7, dx = 0) => {
      const y0 = y(a1),
        y1 = y(a0);
      rect(ctx, bx + dx, y0, bw, y1 - y0, c);
    };
  const low = s.white?.[0] ?? s.green?.[0];
  if (low) {
    const lr = s.lowRed != null && s.lowRed < low ? s.lowRed : low;
    band(20, lr, RED);
    if (lr < low) band(lr, low, BAND.yellow);
  }
  if (s.green) band(s.green[0], s.green[1], BAND.green);
  if (s.yellow) band(s.yellow[0], s.yellow[1], BAND.yellow);
  if (s.white) band(s.white[0], s.white[1], WHITE, 3, -4);
  if (s.red) for (let v = s.red; v < ias + 40; v += 4) (band(v, v + 2, RED), band(v + 2, v + 4, WHITE));
  // ticks and numbers
  for (let v = Math.floor((ias - 32) / 5) * 5; v <= ias + 32; v += 5) {
    if (v < 20) continue;
    const yy = y(v);
    line(ctx, x + w - 17 - (v % 10 ? 0 : 6), yy, x + w - 9, yy, WHITE, 1.5);
    if (v % 10 === 0) txt(ctx, String(v), x + w - 27, yy, WHITE, 15, "right");
  }
  // V-speed references and FLC bug (cyan)
  for (const [k, v] of [
    ["R", s.vr],
    ["X", s.vx],
    ["Y", s.vy],
    ["G", s.vg],
  ] as const) {
    if (v == null || Math.abs(v - ias) > 30) continue;
    line(ctx, x + w - 2, y(v), x + w + 4, y(v), CYAN, 2);
    txt(ctx, k, x + w + 6, y(v), CYAN, 12);
  }
  if (a?.fd && a.iasRef != null) {
    const yy = clamp(y(a.iasRef), TT + 4, TB - 4);
    poly(ctx, [x + w - 1, yy - 6, x + w + 6, yy - 6, x + w + 6, yy + 6, x + w - 1, yy + 6, x + w + 4, yy], CYAN);
  }
  // trend vector
  if (f.iasTrend && Math.abs(f.iasTrend) > 1)
    rect(ctx, x + w - 12, Math.min(YC, YC - f.iasTrend * ppk), 3, Math.abs(f.iasTrend * ppk), MAG);
  ctx.restore();
  // pointer
  const over = s.red != null && f.ias >= s.red;
  poly(
    ctx,
    [
      x + 4,
      YC - 15,
      x + w - 12,
      YC - 15,
      x + w - 12,
      YC - 7,
      x + w - 3,
      YC,
      x + w - 12,
      YC + 7,
      x + w - 12,
      YC + 15,
      x + 4,
      YC + 15,
    ],
    over ? RED : "#000",
    WHITE,
    1.5,
  );
  txt(ctx, f.ias < 20 ? "---" : String(Math.round(f.ias)), x + w - 15, YC + 1, WHITE, 21, "right");
}

/* altimeter */
function altimeter(ctx: Ctx, d: PfdData, L: Lay) {
  const x = L.altX,
    w = 70,
    ppf = 0.32,
    f = d.f;
  rect(ctx, x, TT, w, TB - TT, TAPE);
  // selected altitude box (cyan) above, baro box below
  rect(ctx, x, TT - 20, w, 18, "#000", "#4A5056");
  if (f.selAlt != null) {
    txt(ctx, String(Math.round(f.selAlt)), x + w - 22, TT - 11, CYAN, 15, "right");
    txt(ctx, "FT", x + w - 4, TT - 10, CYAN, 9, "right");
  }
  rect(ctx, x, TB + 2, w, 16, "#000", "#3A4046");
  txt(ctx, `${f.baro.toFixed(2)}IN`, x + w / 2, TB + 10, CYAN, 13, "center");
  // glideslope / glidepath indicator left of the tape
  if (f.gsDev !== undefined) {
    const gx = x - 15,
      gp = f.navSrc === "GPS";
    rect(ctx, gx, YC - 70, 12, 140, TAPE);
    txt(ctx, "G", gx + 6, YC - 78, gp ? MAG : GREEN, 11, "center");
    for (const k of [-2, -1, 1, 2]) {
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(gx + 6, YC - k * 30, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    line(ctx, gx, YC, gx + 12, YC, WHITE, 1.5);
    if (f.gsDev != null) {
      const yy = YC - clamp(f.gsDev, -2.4, 2.4) * 30;
      poly(ctx, [gx + 6, yy - 7, gx + 12, yy, gx + 6, yy + 7, gx, yy], gp ? MAG : GREEN, "#000", 1);
    }
  }
  if (f.fail?.air) {
    redX(ctx, x, TT, w, TB - TT);
    return;
  }
  const alt = f.alt,
    y = (v: number) => YC - (v - alt) * ppf;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, TT, w + 8, TB - TT);
  ctx.clip();
  for (let v = Math.floor((alt - 320) / 20) * 20; v <= alt + 320; v += 20) {
    const yy = y(v),
      big = v % 100 === 0;
    line(ctx, x, yy, x + (big ? 12 : 6), yy, WHITE, 1.5);
    if (big) txt(ctx, String(v), x + 16, yy, WHITE, 14);
  }
  if (Math.abs(f.vs) > 50) rect(ctx, x + 2, Math.min(YC, YC - f.vs * 0.1 * ppf), 3, Math.abs(f.vs * 0.1 * ppf), MAG); // 6 s trend
  if (f.selAlt != null) {
    // selected altitude bug
    const yy = clamp(y(f.selAlt), TT + 6, TB - 6);
    poly(
      ctx,
      [x - 1, yy - 9, x + 8, yy - 9, x + 8, yy + 9, x - 1, yy + 9, x - 1, yy + 4, x + 4, yy, x - 1, yy - 4],
      CYAN,
    );
  }
  ctx.restore();
  // pointer with rolling last two digits (20 ft steps)
  poly(
    ctx,
    [x - 7, YC, x + 2, YC - 7, x + 2, YC - 16, x + w + 2, YC - 16, x + w + 2, YC + 16, x + 2, YC + 16, x + 2, YC + 7],
    "#000",
    WHITE,
    1.5,
  );
  const a20 = Math.round(alt / 20) * 20,
    hi = Math.trunc(a20 / 100),
    lo = Math.abs(a20 % 100);
  txt(ctx, String(hi), x + 42, YC + 1, WHITE, 21, "right");
  txt(ctx, String(lo).padStart(2, "0"), x + 44, YC + 2, WHITE, 15);
}

/* vertical speed indicator */
function vsi(ctx: Ctx, d: PfdData, L: Lay) {
  const x = L.vsiX,
    w = 26,
    k = 88 / 2000,
    f = d.f,
    ref = d.afcs?.fd ? d.afcs.vsRef : null;
  poly(ctx, [x, TT + 8, x + w, TT + 22, x + w, TB - 22, x, TB - 8], TAPE);
  if (ref != null) {
    rect(ctx, x - 4, TT - 20, w + 10, 18, "#000", "#4A5056");
    txt(ctx, String(ref), x + w / 2 + 1, TT - 11, CYAN, 12, "center");
  }
  if (f.fail?.air) {
    redX(ctx, x, TT + 8, w, TB - TT - 16);
    return;
  }
  for (let v = -2000; v <= 2000; v += 500) {
    const yy = YC - v * k,
      big = v % 1000 === 0;
    line(ctx, x, yy, x + (big ? 9 : 5), yy, WHITE, 1.4);
    if (big && v) txt(ctx, String(Math.abs(v / 1000)), x + 15, yy, WHITE, 12, "center");
  }
  if (ref != null) {
    const yy = YC - clamp(ref, -2000, 2000) * k;
    poly(ctx, [x, yy - 5, x + 6, yy - 5, x + 6, yy + 5, x, yy + 5, x + 3, yy], CYAN);
  }
  const yy = YC - clamp(f.vs, -2150, 2150) * k;
  poly(ctx, [x + 2, yy, x + 10, yy - 9, x + 40, yy - 9, x + 40, yy + 9, x + 10, yy + 9], "#000", WHITE, 1.2);
  if (Math.abs(f.vs) >= 100) txt(ctx, String(Math.round(f.vs / 50) * 50), x + 39, yy + 1, WHITE, 11, "right");
}

/* HSI. `pp`: Perspective+ shows the selected heading / course readouts only for ~3 s after setting (POH 7-21, 7-22), so they're left off. */
function hsi(ctx: Ctx, f: FlightData, L: Lay, pp: boolean) {
  const cx = L.cx,
    cy = L.hy,
    r = L.hr;
  const gps = f.navSrc === "GPS",
    cc = gps ? MAG : GREEN;
  // selected heading and course boxes
  if (!pp) {
    rect(ctx, cx - 116, cy - r - 2, 74, 18, "#000", "#3A4046");
    txt(ctx, "HDG", cx - 111, cy - r + 7, WHITE, 11);
    txt(ctx, `${pad3(f.hdgBug)}°`, cx - 46, cy - r + 7, CYAN, 14, "right");
    rect(ctx, cx + 42, cy - r - 2, 74, 18, "#000", "#3A4046");
    txt(ctx, "CRS", cx + 47, cy - r + 7, WHITE, 11);
    txt(ctx, `${pad3(f.crs)}°`, cx + 112, cy - r + 7, cc, 14, "right");
  }
  // rose
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(18,20,24,0.88)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5D656C";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (f.fail?.hdg) {
    ctx.restore();
    redX(ctx, cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5);
    headingBox("---");
    return;
  }
  // turn-rate indicator: ticks at half-standard / standard rate (heading in 6 s), magenta trend
  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, -24 * D2R, 24 * D2R);
  ctx.stroke();
  for (const a of [-18, -9, 9, 18])
    line(
      ctx,
      Math.cos(a * D2R) * (r + 5),
      Math.sin(a * D2R) * (r + 5),
      Math.cos(a * D2R) * (r + 11),
      Math.sin(a * D2R) * (r + 11),
      WHITE,
      1.4,
    );
  const tr = clamp((f.turnRate ?? 0) * 6, -24, 24);
  if (Math.abs(tr) > 0.5) {
    ctx.strokeStyle = MAG;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, Math.min(0, tr * D2R), Math.max(0, tr * D2R));
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(-f.hdg * D2R);
  for (let a = 0; a < 360; a += 5) {
    const big = a % 10 === 0,
      rr = a * D2R;
    line(
      ctx,
      Math.sin(rr) * r,
      -Math.cos(rr) * r,
      Math.sin(rr) * (r - (big ? 10 : 5)),
      -Math.cos(rr) * (r - (big ? 10 : 5)),
      WHITE,
      1.3,
    );
  }
  for (let a = 0; a < 360; a += 30) {
    ctx.save();
    ctx.rotate(a * D2R);
    const lab = a === 0 ? "N" : a === 90 ? "E" : a === 180 ? "S" : a === 270 ? "W" : String(a / 10);
    txt(ctx, lab, 0, -r + 19, WHITE, a % 90 ? 12 : 14, "center");
    ctx.restore();
  }
  // heading bug
  ctx.save();
  ctx.rotate(f.hdgBug * D2R);
  poly(ctx, [-8, -r - 1, 8, -r - 1, 8, -r + 7, 3, -r + 7, 0, -r + 3, -3, -r + 7, -8, -r + 7], CYAN);
  ctx.restore();
  // course pointer + CDI
  ctx.save();
  ctx.rotate(f.crs * D2R);
  const dot = r * 0.2;
  for (const k of [-2, -1, 1, 2]) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(k * dot, 0, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  line(ctx, 0, -r + 26, 0, -r * 0.48, cc, 4);
  poly(ctx, [0, -r + 14, -8, -r + 28, 8, -r + 28], cc);
  line(ctx, 0, r * 0.48, 0, r - 12, cc, 4);
  if (f.cdi != null)
    line(ctx, clamp(f.cdi, -1.25, 1.25) * 2 * dot, -r * 0.42, clamp(f.cdi, -1.25, 1.25) * 2 * dot, r * 0.42, cc, 4);
  ctx.restore(); // course
  ctx.restore(); // card
  ctx.restore(); // centre
  // airplane symbol, lubber line, source label, heading box
  ctx.save();
  ctx.translate(cx, cy);
  poly(
    ctx,
    [
      0, -14, 2, -6, 13, 0, 13, 3, 2, 1, 2, 9, 6, 12, 6, 14, 0, 12, -6, 14, -6, 12, -2, 9, -2, 1, -13, 3, -13, 0, -2,
      -6,
    ],
    WHITE,
  );
  ctx.restore();
  poly(ctx, [cx, cy - r + 9, cx - 5, cy - r + 1, cx + 5, cy - r + 1], WHITE);
  txt(ctx, f.navSrc, cx - 36, cy - 18, cc, 12, "center");
  headingBox(pad3(f.hdg) + "°");
  function headingBox(s: string) {
    rect(ctx, cx - 26, cy - r - 24, 52, 20, "#000", WHITE, 1.5);
    txt(ctx, s, cx, cy - r - 13, WHITE, 16, "center");
  }
}

/* sensor comparator (PG Fig 2-47) and reversionary sensor (PG Fig 2-48) annunciations; places approximate */
function sensorAnn(ctx: Ctx, d: PfdData, L: Lay) {
  /** A box of `s` with its left (or, `right`, its right) edge at `x`; returns its left edge. */
  const box = (s: string, x: number, y: number, bg: string, right = false) => {
    ctx.font = `700 11px ${FONT}`;
    const w = ctx.measureText(s).width + 8,
      left = right ? x - w : x;
    rect(ctx, left, y, w, 14, bg);
    txt(ctx, s, left + 4, y + 7.5, "#000", 11);
    return left;
  };
  // right column: left of the altimeter's vertical deviation scale
  const xr = L.altX - 18;
  let rolX = xr;
  for (const c of d.comparators ?? []) {
    const bg = c.miscompare ? YEL : WHITE;
    if (c.at === "IAS") box(c.text, L.asX + 66, YC + 16, bg);
    else if (c.at === "ALT") box(c.text, xr, YC + 16, bg, true);
    else if (c.at === "VDI") box(c.text, xr, TB - 20, bg, true);
    else if (c.at === "HDG") box(c.text, L.cx + 30, L.hy - L.hr - 21, bg);
    // PIT at the top right, ROL to its left
    else if (c.at === "PIT") rolX = box(c.text, xr, TT + 4, bg, true) - 3;
  }
  for (const c of d.comparators ?? []) if (c.at === "ROL") box(c.text, rolX, TT + 4, c.miscompare ? YEL : WHITE, true);
  const rev = d.reversionary ?? [];
  if (rev.length) {
    // white on blue, top left of the attitude display above the roll scale
    rect(ctx, L.asX + 70, TOP + 25, 86, rev.length * 13 + 4, "#1B2C78");
    rev.forEach((s, i) => txt(ctx, s, L.asX + 74, TOP + 32 + i * 13, WHITE, 11));
  }
}

/* AFCS status bar */
function afcsBar(ctx: Ctx, a: AfcsAnnunc, L: Lay, t: number) {
  const x0 = L.asX,
    y = TOP + 1,
    h = 21,
    cy = y + h / 2,
    on = blinkOn(t);
  const ws = [54, 62, 70, 86, 142, 68],
    xs: number[] = [];
  ws.reduce((acc, w) => (xs.push(acc), acc + w), x0);
  const total = ws.reduce((p, q) => p + q, 0);
  rect(ctx, x0, y, total, h, "#000", "#4A5056");
  for (let i = 1; i < ws.length; i++) if (i !== 2 && i !== 5) line(ctx, xs[i], y + 3, xs[i], y + h - 3, "#4A5056", 1);
  // system status annunciation (PFT, AFCS, PTCH, ROLL, PTRM, ELE/AIL mistrim)
  if (a.sys && (!a.sys.flash || on)) {
    const c = a.sys.level === "w" ? RED : a.sys.level === "c" ? YEL : WHITE;
    rect(ctx, xs[0] + 4, y + 2, ws[0] - 8, h - 4, null, c, 1.5);
    txt(ctx, a.sys.text, xs[0] + ws[0] / 2, cy + 1, c, 13, "center");
  }
  if (a.fd) {
    if (a.latArm) txt(ctx, a.latArm, xs[1] + ws[1] / 2, cy + 1, WHITE, 15, "center");
    if (a.lat && (!a.latFlash || on))
      txt(ctx, a.lat, xs[2] + ws[2] / 2, cy + 1, a.latFlash === "y" ? YEL : GREEN, 15, "center");
    if (a.vert && (!a.vertFlash || on)) {
      const c = a.vertFlash === "y" ? YEL : GREEN;
      if (a.vertRef) {
        txt(ctx, a.vert, xs[4] + 8, cy + 1, c, 15);
        txt(ctx, a.vertRef, xs[4] + ws[4] - 8, cy + 1, c, 14, "right");
      } else txt(ctx, a.vert, xs[4] + ws[4] / 2, cy + 1, c, 15, "center");
    }
    if (a.vertArm) {
      // fitted to its field ("ALTS GP/V")
      ctx.font = `700 15px ${FONT}`;
      const px = Math.max(9, Math.min(15, (15 * (ws[5] - 6)) / ctx.measureText(a.vertArm).width));
      txt(ctx, a.vertArm, xs[5] + ws[5] / 2, cy + 1, WHITE, px, "center");
    }
  }
  // autopilot status in the centre
  const mid = xs[3] + ws[3] / 2,
    items: [string, string][] = [];
  if (a.cws) items.push(["CWS", WHITE]);
  else if (a.ap) items.push(["AP", GREEN]);
  else if (a.apFlash && on) items.push(["AP", a.apFlash === "abnormal" ? RED : YEL]);
  if (a.yd) items.push(["YD", GREEN]);
  items.forEach(([s, c], i) => txt(ctx, s, mid + (i - (items.length - 1) / 2) * 34, cy + 1, c, 15, "center"));
}

/* annunciation / alerts window */
function annWindow(ctx: Ctx, d: PfdData, L: Lay) {
  const order = { w: 0, c: 1, a: 2 };
  // up to 12 annunciations at once, on the PFD or (reversion) the MFD (DA40 CRG 190-00324-07 p. 12-1)
  const list: [CasLevel, string][] = [
    ...(d.pitchTrim ? [["w", d.pitchTrim] as [CasLevel, string]] : []),
    ...[...d.alerts].sort((p, q) => order[p[0]] - order[q[0]]),
  ].slice(0, 12);
  if (!list.length) return;
  // rows that fit above the transponder box (y 426): the reversion window would otherwise run into it and the softkeys
  const fit = (y: number, rh: number) => list.slice(0, Math.floor((426 - y - 6) / rh));
  if (isPP(d)) {
    // Perspective+ CAS window: black, no frame, left-aligned, one narrow font for every row (PG Fig A-2). Full PFD: right of
    // the VSI, top just below the altitude pointer. Reversion: right of the HSI, below the baro box. The widest message sets
    // a common horizontal squeeze (down to 0.75, like Garmin's condensed face), then a common smaller size (down to 8 px).
    const full = L.w >= 600,
      x = full ? L.vsiX + 29 : L.ann.x,
      w = full ? L.x0 + L.w - x - 2 : L.ann.w,
      y = full ? YC + 18 : TB + 22;
    const room = w - 6,
      widest = (px: number) => {
        ctx.font = `700 ${px}px ${FONT}`;
        return Math.max(...list.map(([, s]) => ctx.measureText(s).width));
      };
    let px = 12,
      k = Math.min(1, room / widest(px));
    if (k < 0.75) {
      px = Math.max(8, Math.floor((px * k) / 0.75));
      k = Math.min(1, room / widest(px));
    }
    k = Math.max(k, 0.75);
    const rh = px + 4,
      rows = fit(y, rh);
    rect(ctx, x, y, w, rows.length * rh + 6, "#000");
    rows.forEach(([lv, s], i) => {
      ctx.save();
      ctx.translate(x + 3, y + 3 + i * rh + rh / 2 + 1);
      ctx.scale(k, 1);
      txt(ctx, clip(ctx, s, room / k, px), 0, 0, lv === "w" ? RED : lv === "c" ? YEL : WHITE, px);
      ctx.restore();
    });
    return;
  }
  // full PFD: right of the VSI, 16 px rows; reversion: right of the HSI from just below the baro box, rows shrunk to fit
  const full = L.w >= 600,
    { x, w } = L.ann,
    y = full ? L.ann.y : TB + 22;
  const rh = full ? 16 : Math.max(10, Math.min(16, Math.floor((426 - y - 6) / list.length)));
  const rows = fit(y, rh);
  rect(ctx, x, y, w, rows.length * rh + 6, "#000", WHITE, 1);
  rows.forEach(([lv, s], i) => {
    const c = lv === "w" ? RED : lv === "c" ? YEL : WHITE;
    ctx.font = `700 12px ${FONT}`;
    const px = Math.max(7, Math.min(12, rh - 3, (12 * (w - 8)) / ctx.measureText(s).width)); // shrink to fit
    txt(ctx, s, x + w / 2, y + 3 + i * rh + rh / 2 + 1, c, px, "center");
  });
}

/* top bars: NAV left, COM right (either can be left off), navigation status / data centre */
export function topBar(ctx: Ctx, f: FlightData, mfd: boolean, nav = true, com = true) {
  rect(ctx, 0, 0, 640, TOP, "#000");
  line(ctx, 0, TOP - 0.5, 640, TOP - 0.5, "#5A6168", 1);
  const n1 = f.nav1 ?? ["117.95", "108.00"],
    n2 = f.nav2 ?? ["110.50", "113.40"],
    c1 = f.com1 ?? ["118.000", "136.975"],
    c2 = f.com2 ?? ["121.500", "132.450"];
  const navOn = (i: 1 | 2) => f.navSrc === `VOR${i}` || f.navSrc === `LOC${i}`;
  const navRow = (lab: string, [act, sby]: [string, string], yy: number, tune: boolean, on: boolean) => {
    txt(ctx, lab, 4, yy, WHITE, 11);
    if (tune) rect(ctx, 37, yy - 8, 50, 16, null, CYAN, 1.2);
    txt(ctx, sby, 62, yy, WHITE, 14, "center");
    txt(ctx, "↔", 95, yy, CYAN, 12, "center");
    txt(ctx, act, 128, yy, on ? GREEN : WHITE, 14, "center");
  };
  if (nav) {
    navRow("NAV1", n1, 10, true, navOn(1));
    navRow("NAV2", n2, 30, false, navOn(2));
  }
  const comRow = (lab: string, [act, sby]: [string, string], yy: number, tune: boolean, on: boolean) => {
    txt(ctx, act, 498, yy, on ? GREEN : WHITE, 13, "center");
    txt(ctx, "↔", 534, yy, CYAN, 12, "center");
    if (tune) rect(ctx, 545, yy - 8, 56, 16, null, CYAN, 1.2);
    txt(ctx, sby, 573, yy, WHITE, 13, "center");
    txt(ctx, lab, 637, yy, WHITE, 10, "right");
  };
  if (com) {
    comRow("COM1", c1, 10, true, true);
    comRow("COM2", c2, 30, false, false);
  }
  line(ctx, 170, 4, 170, TOP - 4, "#3A4046");
  line(ctx, 466, 4, 466, TOP - 4, "#3A4046");
  if (mfd) {
    const cells: [string, string][] = [
      ["GS", `${Math.round(f.gs ?? f.tas ?? f.ias)}KT`],
      ["DTK", `${pad3(f.crs)}°`],
      ["TRK", `${pad3(f.trk ?? f.hdg)}°`],
      ["ETE", "--:--"],
    ];
    cells.forEach(([k, v], i) => {
      const xx = 182 + i * 72;
      txt(ctx, k, xx, 20, WHITE, 11);
      txt(ctx, v, xx + 64, 20, MAG, 13, "right");
    });
  } else {
    const s = f.navStatus ?? `${f.navSrc}  DTK ${pad3(f.crs)}°  TRK ${pad3(f.trk ?? f.hdg)}°`;
    txt(ctx, s, 318, 20, f.navSrc === "GPS" ? MAG : GREEN, 14, "center");
  }
}

/** Softkey labels along the bottom; keys in `subdued` are greyed out (unavailable). */
export function softkeys(ctx: Ctx, keys: string[], subdued?: Set<string>) {
  rect(ctx, 0, BOT, 640, 480 - BOT, "#0B0D0F");
  const w = 640 / keys.length;
  keys.forEach((k, i) => {
    if (i) line(ctx, i * w, BOT + 3, i * w, 478, "#3A4046");
    if (k) txt(ctx, k, i * w + w / 2, BOT + 8, subdued?.has(k) ? "#5E666C" : "#E8ECEE", 10, "center");
  });
}
