/**
 * The 1968 M20C instrument panel, drawn live on one canvas: round pneumatic and gyro flight instruments (miles per hour),
 * the tachometer and manifold-pressure / fuel-pressure gauges, the engine cluster (fuel L/R, oil temperature and
 * pressure, cylinder-head temperature, load meter), gear and vacuum lights, the switch-breaker row and the ignition switch.
 * Markings follow the 1965 Owner's Manual Part V and the 1963 AFM (189 mph red line, 150–189 yellow, 70–150 green,
 * flaps 63–125 white for the 1968 airplane per TCDS 2A3). Layout is approximate.
 */
import { D2R, clamp } from "@/lib/math";
import { PUSH_CB, SWITCH_CB, VAC, gearLights, mph, type Elec, type Sim } from "./model";
import { live } from "./model";

type Ctx = CanvasRenderingContext2D;
const FONT = `Arial, "Liberation Sans", "DejaVu Sans", Helvetica, sans-serif`;
const WHITE = "#F2F4F6",
  GREEN = "#2FD35A",
  YELLOW = "#F2C12E",
  RED = "#FF3B30";

const txt = (
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  c = WHITE,
  px = 10,
  align: CanvasTextAlign = "center",
  bold = false,
) => {
  ctx.font = `${bold ? 700 : 500} ${px}px ${FONT}`;
  ctx.fillStyle = c;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
};
const line = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, c: string, w: number) => {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};
const poly = (ctx: Ctx, pts: number[], c: string) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
};

/** Black dial with a bezel; returns the usable radius. */
function dial(ctx: Ctx, cx: number, cy: number, r: number) {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, "#5A5F65");
  g.addColorStop(1, "#1C1F22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0A0B0C";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  return r * 0.9;
}
/** Tapered needle from the centre toward angle a (clockwise from 12 o'clock). */
const needle = (ctx: Ctx, cx: number, cy: number, a: number, len: number, w: number, c = WHITE) => {
  const dx = Math.sin(a),
    dy = -Math.cos(a),
    px = Math.cos(a),
    py = Math.sin(a),
    tail = len * 0.14;
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
const hub = (ctx: Ctx, cx: number, cy: number, r: number) => {
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
};
const arc = (ctx: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, c: string, w: number) => {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
};
const flag = (ctx: Ctx, cx: number, cy: number, r: number, text: string) => {
  ctx.save();
  ctx.translate(cx - r * 0.4, cy - r * 0.4);
  ctx.rotate(-0.4);
  ctx.fillStyle = "#E2401C";
  ctx.fillRect(-r * 0.25, -r * 0.1, r * 0.5, r * 0.2);
  txt(ctx, text, 0, 1, WHITE, r * 0.14, "center", true);
  ctx.restore();
};

/** Generic scalar gauge: value → angle over a sweep, with coloured bands and major ticks. */
function gauge(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  label: string,
  min: number,
  max: number,
  v: number | null,
  bands: [number, number, string][],
  ticks: number[],
  fmt: (n: number) => string,
  a0 = -135,
  a1 = 135,
  sub?: string,
) {
  const R = dial(ctx, cx, cy, r),
    u = R / 100;
  const ang = (x: number) => (a0 + ((clamp(x, min, max) - min) / (max - min)) * (a1 - a0)) * D2R;
  bands.forEach(([x0, x1, c]) => arc(ctx, cx, cy, 86 * u, ang(x0), ang(x1), c, 6 * u));
  ticks.forEach((t) => {
    const a = ang(t);
    line(
      ctx,
      cx + Math.sin(a) * 92 * u,
      cy - Math.cos(a) * 92 * u,
      cx + Math.sin(a) * 78 * u,
      cy - Math.cos(a) * 78 * u,
      WHITE,
      1.6 * u,
    );
    txt(ctx, fmt(t), cx + Math.sin(a) * 62 * u, cy - Math.cos(a) * 62 * u, WHITE, 11 * u);
  });
  txt(ctx, label, cx, cy - 30 * u, WHITE, 8.5 * u);
  if (sub) txt(ctx, sub, cx, cy + 32 * u, "#B8BEC4", 7.5 * u);
  if (v != null) needle(ctx, cx, cy, ang(v), 84 * u, 3.5 * u);
  hub(ctx, cx, cy, 6 * u);
}

function airspeed(ctx: Ctx, cx: number, cy: number, r: number, ias: number) {
  // OM Part V: red line 189, yellow 150–189, green 70–150, white 63–125 (1968 Vfe)
  const R = dial(ctx, cx, cy, r),
    u = R / 100,
    max = 220;
  const ang = (v: number) => (20 + (clamp(v, 0, max) / max) * 320) * D2R;
  arc(ctx, cx, cy, 80 * u, ang(63), ang(125), WHITE, 5 * u);
  arc(ctx, cx, cy, 88 * u, ang(70), ang(150), GREEN, 7 * u);
  arc(ctx, cx, cy, 88 * u, ang(150), ang(189), YELLOW, 7 * u);
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
    if (big) txt(ctx, String(v), cx + Math.sin(a) * 64 * u, cy - Math.cos(a) * 64 * u, WHITE, 10 * u);
  }
  const a = ang(189);
  line(
    ctx,
    cx + Math.sin(a) * 94 * u,
    cy - Math.cos(a) * 94 * u,
    cx + Math.sin(a) * 74 * u,
    cy - Math.cos(a) * 74 * u,
    RED,
    3 * u,
  );
  txt(ctx, "AIRSPEED", cx, cy - 28 * u, WHITE, 8 * u);
  txt(ctx, "MPH", cx, cy + 28 * u, WHITE, 8 * u);
  needle(ctx, cx, cy, ang(Math.max(ias, 0)), 86 * u, 4 * u);
  hub(ctx, cx, cy, 6 * u);
}

function attitude(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  pitch: number,
  roll: number,
  vacLo: boolean,
  vacHi: boolean,
  ok: boolean,
) {
  const R = dial(ctx, cx, cy, r),
    u = R / 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll * D2R);
  const ppd = 2.6 * u;
  ctx.translate(0, pitch * ppd);
  ctx.fillStyle = ok ? "#2F7AD8" : "#4A5666";
  ctx.fillRect(-2 * R, -3 * R, 4 * R, 3 * R);
  ctx.fillStyle = ok ? "#7A4A1F" : "#3A3230";
  ctx.fillRect(-2 * R, 0, 4 * R, 3 * R);
  line(ctx, -2 * R, 0, 2 * R, 0, WHITE, 2 * u);
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
  poly(ctx, [cx, cy - 80 * u, cx - 6 * u, cy - 70 * u, cx + 6 * u, cy - 70 * u], "#FF8A00");
  line(ctx, cx - 50 * u, cy, cx - 16 * u, cy, "#FF8A00", 4 * u);
  line(ctx, cx + 16 * u, cy, cx + 50 * u, cy, "#FF8A00", 4 * u);
  ctx.fillStyle = "#FF8A00";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * u, 0, Math.PI * 2);
  ctx.fill();
  // the two red vacuum lights on the horizon's face (OM p. 10)
  [
    [-1, "LO", vacLo],
    [1, "HI", vacHi],
  ].forEach(([s, t, on]) => {
    const x = cx + (s as number) * 70 * u,
      y = cy + 70 * u;
    ctx.fillStyle = on ? RED : "#3A1F1F";
    ctx.beginPath();
    ctx.arc(x, y, 7 * u, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, t as string, x, y + 14 * u, "#B8BEC4", 7 * u);
  });
  if (!ok) flag(ctx, cx, cy, R, "GYRO");
}

function altimeter(ctx: Ctx, cx: number, cy: number, r: number, alt: number, baro: number) {
  const R = dial(ctx, cx, cy, r),
    u = R / 100;
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
    if (big) txt(ctx, String(i / 5), cx + Math.sin(a) * 68 * u, cy - Math.cos(a) * 68 * u, WHITE, 14 * u);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(cx + 30 * u, cy - 8 * u, 36 * u, 16 * u);
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 30 * u, cy - 8 * u, 36 * u, 16 * u);
  txt(ctx, baro.toFixed(2), cx + 48 * u, cy, WHITE, 9 * u);
  txt(ctx, "ALT", cx, cy - 32 * u, WHITE, 9 * u);
  const a100 = ((alt % 1000) / 1000) * Math.PI * 2,
    a1k = ((alt % 10000) / 10000) * Math.PI * 2;
  needle(ctx, cx, cy, a1k, 52 * u, 6 * u);
  needle(ctx, cx, cy, a100, 84 * u, 3.5 * u);
  hub(ctx, cx, cy, 6 * u);
}

function turnCoordinator(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  rate: number,
  slip: number,
  ok: boolean,
  rollTrim: number,
) {
  const R = dial(ctx, cx, cy, r),
    u = R / 100;
  txt(ctx, "TURN COORDINATOR", cx, cy - 60 * u, WHITE, 7 * u);
  [
    [-1, "L"],
    [1, "R"],
  ].forEach(([s, t]) => {
    const a = (s as number) * 25 * D2R;
    line(
      ctx,
      cx + Math.sin(a) * 90 * u,
      cy - Math.cos(a) * 90 * u + 55 * u,
      cx + Math.sin(a) * 70 * u,
      cy - Math.cos(a) * 70 * u + 55 * u,
      WHITE,
      3 * u,
    );
    txt(ctx, t as string, cx + (s as number) * 50 * u, cy - 36 * u, WHITE, 9 * u);
  });
  // airplane symbol banks with the turn rate (standard rate = the index)
  ctx.save();
  ctx.translate(cx, cy + 8 * u);
  ctx.rotate(ok ? clamp(rate / 3, -1.6, 1.6) * 25 * D2R : 0);
  line(ctx, -60 * u, 0, 60 * u, 0, WHITE, 5 * u);
  line(ctx, 0, -12 * u, 0, 10 * u, WHITE, 4 * u);
  line(ctx, -16 * u, 6 * u, 16 * u, 6 * u, WHITE, 4 * u);
  ctx.restore();
  // slip ball
  ctx.fillStyle = "#1A1C1E";
  ctx.fillRect(cx - 40 * u, cy + 48 * u, 80 * u, 16 * u);
  line(ctx, cx - 8 * u, cy + 48 * u, cx - 8 * u, cy + 64 * u, WHITE, 1.5 * u);
  line(ctx, cx + 8 * u, cy + 48 * u, cx + 8 * u, cy + 64 * u, WHITE, 1.5 * u);
  ctx.fillStyle = "#E8E8E8";
  ctx.beginPath();
  ctx.arc(cx + clamp(slip, -1, 1) * 28 * u, cy + 56 * u, 6 * u, 0, Math.PI * 2);
  ctx.fill();
  // PC roll-trim knob at the lower left of the face
  ctx.fillStyle = "#2A2E33";
  ctx.beginPath();
  ctx.arc(cx - 70 * u, cy + 70 * u, 11 * u, 0, Math.PI * 2);
  ctx.fill();
  const ka = rollTrim * 1.4;
  line(
    ctx,
    cx - 70 * u,
    cy + 70 * u,
    cx - 70 * u + Math.sin(ka) * 9 * u,
    cy + 70 * u - Math.cos(ka) * 9 * u,
    WHITE,
    2 * u,
  );
  txt(ctx, "ROLL TRIM", cx - 70 * u, cy + 88 * u, "#B8BEC4", 6 * u);
  if (!ok) flag(ctx, cx, cy, R, "OFF");
}

function headingGyro(ctx: Ctx, cx: number, cy: number, r: number, hdg: number, ok: boolean) {
  const R = dial(ctx, cx, cy, r),
    u = R / 100;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-hdg * D2R);
  for (let d = 0; d < 360; d += 5) {
    const a = d * D2R,
      big = d % 30 === 0;
    line(
      ctx,
      Math.sin(a) * 90 * u,
      -Math.cos(a) * 90 * u,
      Math.sin(a) * (big ? 76 : 84) * u,
      -Math.cos(a) * (big ? 76 : 84) * u,
      WHITE,
      (big ? 2 : 1) * u,
    );
    if (big) {
      ctx.save();
      ctx.translate(Math.sin(a) * 62 * u, -Math.cos(a) * 62 * u);
      ctx.rotate(a);
      txt(
        ctx,
        d === 0 ? "N" : d === 90 ? "E" : d === 180 ? "S" : d === 270 ? "W" : String(d / 10),
        0,
        0,
        WHITE,
        10 * u,
      );
      ctx.restore();
    }
  }
  ctx.restore();
  poly(ctx, [cx, cy - 92 * u, cx - 6 * u, cy - 80 * u, cx + 6 * u, cy - 80 * u], "#FF8A00");
  line(ctx, cx - 30 * u, cy, cx + 30 * u, cy, "#FF8A00", 3 * u);
  line(ctx, cx, cy - 20 * u, cx, cy + 14 * u, "#FF8A00", 3 * u);
  txt(ctx, "DG", cx, cy + 34 * u, "#B8BEC4", 8 * u);
  if (!ok) flag(ctx, cx, cy, R, "GYRO");
}

const lamp = (ctx: Ctx, x: number, y: number, r: number, on: boolean, c: string, label: string) => {
  ctx.fillStyle = on ? c : "#2A2E33";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.stroke();
  txt(ctx, label, x, y + r + 9, "#B8BEC4", 7);
};

/** The whole panel. */
export function drawPanel(ctx: Ctx, W: number, H: number, s: Sim, E: Elec) {
  ctx.save();
  ctx.scale(W / 1024, H / 400);
  ctx.fillStyle = "#2A2F34";
  ctx.fillRect(0, 0, 1024, 400);
  // shock-mounted flight panel (pilot's side)
  ctx.fillStyle = "#23272B";
  ctx.fillRect(14, 20, 372, 262);
  const fs = live.fs,
    gnd = fs.onGround;
  const ias = gnd ? 0 : mph(fs.ias) + (s.pitot.altStatic ? 3 : 0);
  airspeed(ctx, 78, 84, 56, ias);
  attitude(
    ctx,
    200,
    84,
    56,
    gnd ? 0 : fs.pitch,
    gnd ? 0 : fs.roll,
    E.vacWarn && live.vac < VAC.lo,
    E.vacWarn && live.vac > VAC.hi,
    live.vac >= 3.0,
  );
  altimeter(ctx, 322, 84, 56, fs.alt + (s.pitot.altStatic ? 40 : 0), fs.baro);
  const rate = gnd ? 0 : (1091 * Math.tan(fs.roll * D2R)) / Math.max(fs.ias * 1.15, 40);
  turnCoordinator(ctx, 78, 212, 56, rate, gnd ? 0 : fs.slip, E.turnBank || live.vac >= 3.0, s.pc.rollTrim);
  headingGyro(ctx, 200, 212, 56, fs.hdg, live.vac >= 3.0);
  gauge(
    ctx,
    322,
    212,
    56,
    "CLIMB",
    -2000,
    2000,
    gnd ? 0 : fs.vs,
    [],
    [-2000, -1000, 0, 1000, 2000],
    (n) => String(Math.abs(n) / 100),
    -160,
    160,
    "100 FT/MIN",
  );
  // gear lights beside the Johnson bar's down socket, under the panel centre
  const gl = gearLights(s, E);
  lamp(ctx, 410, 40, 9, gl.green, GREEN, "GEAR DOWN");
  lamp(ctx, 410, 80, 9, gl.red, RED, "UNSAFE");
  // tachometer and manifold / fuel pressure
  gauge(
    ctx,
    480,
    90,
    58,
    "RPM",
    0,
    3500,
    E.gaugesPwr || live.rpm > 0 ? live.rpm : 0,
    [
      [2300, 2700, GREEN],
      [2000, 2250, RED],
      [2700, 2750, RED],
    ],
    [0, 500, 1000, 1500, 2000, 2500, 3000, 3500],
    (n) => String(n / 100),
    -140,
    140,
    "× 100",
  );
  gauge(
    ctx,
    600,
    90,
    58,
    "MAN PRESS",
    10,
    35,
    live.map,
    [[15, 29.5, GREEN]],
    [10, 15, 20, 25, 30, 35],
    String,
    -140,
    100,
    "IN HG",
  );
  gauge(ctx, 600, 90, 58, "", 0, 8, null, [], [], String);
  // small fuel-pressure gauge in the lower half of the MP instrument face
  gauge(
    ctx,
    600,
    118,
    24,
    "FUEL PSI",
    0,
    8,
    E.gaugesPwr ? live.fuelP : 0,
    [
      [0.5, 6, GREEN],
      [2.5, 3.5, "#1F9E3C"],
      [6, 8, RED],
    ],
    [0, 2, 4, 6, 8],
    String,
    -120,
    120,
  );
  // engine cluster
  ctx.fillStyle = "#1C1F22";
  ctx.fillRect(660, 20, 190, 230);
  txt(ctx, "ENGINE CLUSTER", 755, 30, "#B8BEC4", 8);
  const q = (
    x: number,
    y: number,
    label: string,
    v: number | null,
    min: number,
    max: number,
    bands: [number, number, string][],
    ticks: number[],
    unit: string,
  ) => gauge(ctx, x, y, 28, label, min, max, v, bands, ticks, String, -120, 120, unit);
  q(700, 70, "FUEL L", E.gaugesPwr ? s.fuel.qL : null, 0, 26, [[0, 3, RED]], [0, 13, 26], "GAL");
  q(810, 70, "FUEL R", E.gaugesPwr ? s.fuel.qR : null, 0, 26, [[0, 3, RED]], [0, 13, 26], "GAL");
  q(
    700,
    140,
    "OIL TEMP",
    E.gaugesPwr ? live.oilT : null,
    50,
    250,
    [
      [100, 225, GREEN],
      [245, 250, RED],
    ],
    [50, 150, 250],
    "°F",
  );
  q(
    810,
    140,
    "OIL PRESS",
    live.oilP,
    0,
    100,
    [
      [25, 60, YELLOW],
      [60, 90, GREEN],
      [90, 100, YELLOW],
    ],
    [0, 50, 100],
    "PSI",
  );
  q(
    700,
    210,
    "CYL TEMP",
    E.gaugesPwr ? live.cht : null,
    100,
    500,
    [
      [350, 450, GREEN],
      [495, 500, RED],
    ],
    [100, 300, 500],
    "°F",
  );
  q(
    810,
    210,
    "AMMETER",
    E.gaugesPwr ? E.amps : null,
    -60,
    60,
    [
      [-60, -2, RED],
      [2, 60, GREEN],
    ],
    [-60, 0, 60],
    "CHG / DISCH",
  );
  // right: radios and the breaker cover
  ctx.fillStyle = "#121416";
  ctx.fillRect(868, 20, 140, 150);
  txt(ctx, "NAV / COM", 938, 32, "#B8BEC4", 8);
  [0, 1, 2].forEach((i) => {
    ctx.fillStyle = "#0A0B0C";
    ctx.fillRect(876, 42 + i * 40, 124, 32);
    txt(
      ctx,
      E.radios ? ["121.90  110.30", "119.10  115.70", "1200  ALT"][i] : "",
      938,
      58 + i * 40,
      E.radios ? "#FFB347" : "#333",
      11,
      "center",
      true,
    );
  });
  // bottom row: master, ignition, switch-breakers
  ctx.fillStyle = "#1C1F22";
  ctx.fillRect(14, 296, 500, 90);
  lamp(ctx, 40, 326, 7, E.bus > 0, "#D9960F", "MASTER");
  ctx.fillStyle = s.elec.master ? "#C9D2D8" : "#56626B";
  ctx.fillRect(34, s.elec.master ? 298 : 330, 12, 20);
  ctx.fillStyle = "#3A4148";
  ctx.beginPath();
  ctx.arc(90, 330, 18, 0, Math.PI * 2);
  ctx.fill();
  const ka = { OFF: -110, R: -55, L: 0, BOTH: 55, START: 110 }[s.eng.key] * D2R;
  line(ctx, 90, 330, 90 + Math.sin(ka) * 15, 330 - Math.cos(ka) * 15, WHITE, 3);
  ["OFF", "R", "L", "BOTH", "START"].forEach((k, i) => {
    const a = (-110 + i * 55) * D2R;
    txt(ctx, k, 90 + Math.sin(a) * 30, 330 - Math.cos(a) * 30, s.eng.key === k ? WHITE : "#8A9299", 6);
  });
  txt(ctx, "MAGNETO / START", 90, 364, "#B8BEC4", 7);
  const SWK: (keyof Sim["sw"])[] = ["fuelPump", "pitotHeat", "beacon", "nav", "landing"];
  SWITCH_CB.forEach(([name], i) => {
    const x = 160 + i * 64,
      on = s.sw[SWK[i]] && !s.cb[name];
    ctx.fillStyle = "#1A2127";
    ctx.fillRect(x - 10, 310, 20, 34);
    ctx.fillStyle = on ? "#C9D2D8" : "#56626B";
    ctx.fillRect(x - 7, on ? 312 : 326, 14, 16);
    txt(ctx, name, x, 356, s.cb[name] ? RED : "#B8BEC4", 7);
    if (s.cb[name]) txt(ctx, "TRIPPED", x, 366, RED, 6);
  });
  // placards
  txt(ctx, "MOONEY M20C · N6947N", 940, 196, "#B8BEC4", 8);
  txt(ctx, "VNE 189 MPH · VLO/VLE 120 · VFE 125 · VA 132", 940, 210, "#8A9299", 7);
  txt(
    ctx,
    "THIS AIRPLANE MUST BE OPERATED AS A NORMAL CATEGORY AIRPLANE — NO ACROBATIC MANEUVERS INCLUDING SPINS",
    940,
    224,
    "#8A9299",
    5,
  );
  ctx.restore();
}

/** The push-to-reset breaker cover: buttons out when tripped / pulled. */
export function drawBreakerCover(ctx: Ctx, W: number, H: number, s: Sim) {
  ctx.fillStyle = "#2F3439";
  ctx.fillRect(0, 0, W, H);
  const cols = 4,
    dx = W / cols;
  txt(ctx, "PUSH TO RESET", W / 2, 8, "#D8DCDF", 8, "center", true);
  PUSH_CB.forEach(([n], i) => {
    const cx = dx * (i % cols) + dx / 2,
      cy = 24 + Math.floor(i / cols) * 32,
      out = !!s.cb[n];
    if (out) {
      ctx.fillStyle = "#F4F6F8";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#121518";
    ctx.beginPath();
    ctx.arc(cx, cy, out ? 5.5 : 6.5, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, n.length > 10 ? n.slice(0, 10) : n, cx, cy + 14, "#C9CED2", 5.5);
  });
}
