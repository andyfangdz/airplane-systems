/**
 * Mid-Continent MD302 standby attitude module in its horizontal mounting, as fitted to the Cirrus SR20 and SR22T G6:
 * attitude on the left screen, air data on the right. Pure: everything comes from the data passed in. Drawn on the
 * 420×180 grid of the bezel, scaled to the canvas.
 */
import { D2R } from "@/lib/math";

type Ctx = CanvasRenderingContext2D;

/** What the MD302 shows. Each airplane fills it from its own sim and POH markings. */
export interface Md302Data {
  /** Attitude (deg): pitch + nose up, roll + right wing down. */
  pitch: number;
  roll: number;
  /** Indicated airspeed (kt); 0 shows dashes. */
  ias: number;
  /** Altitude (ft) and barometric setting (inHg). */
  alt: number;
  baro: number;
  /** Airspeed tape colour bars (KIAS): white flap range, green and yellow arcs, red line. */
  bands: { white: [number, number]; green: [number, number]; yellow: [number, number]; red: number };
}

const MD_FONT = `Arial, "Liberation Sans", "DejaVu Sans", Helvetica, sans-serif`;
function mdText(ctx: Ctx, s: string, x: number, y: number, c: string, px: number, align: CanvasTextAlign = "center") {
  ctx.font = `700 ${px}px ${MD_FONT}`;
  ctx.fillStyle = c;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}
const tri = (ctx: Ctx, pts: number[], c: string) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
};
const seg = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

/** The two LCDs: 2.4 in. diagonal each (MD302 Installation Manual), ≈49 × 37 mm, on the 420×180 grid of the 5.5 × 2.37 in. bezel. */
const LCD_W = 147,
  LCD_H = 111,
  LCD_Y = 28,
  LCD_L = 30,
  LCD_R = 243;

/**
 * MD302 SAM in its horizontal mounting (MD302 Pilot's Guide Image 2; POH 7-18 … 7-21): two LCDs in one bezel with the
 * control knob between them. Left: attitude (blue sky over dark red ground, roll scale with 45° triangles, yellow airplane
 * symbol, slip indicator at the bottom). Right: airspeed tape with its colour bars on the left edge and the boxed IAS window,
 * altitude tape with the boxed altitude window, and a white BARO box at the top. The altitude trend bar isn't drawn: the
 * model's air data is a level cruise picture.
 */
export function drawMd302(ctx: Ctx, W: number, H: number, d: Md302Data) {
  ctx.save();
  ctx.fillStyle = "#16191C";
  ctx.fillRect(0, 0, W, H);
  ctx.scale(W / 420, H / 180);
  const lcd = (x: number) => {
    ctx.fillStyle = "#26292C";
    ctx.fillRect(x - 4, LCD_Y - 4, LCD_W + 8, LCD_H + 8);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, LCD_Y, LCD_W, LCD_H);
  };
  const clipTo = (x: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, LCD_Y, LCD_W, LCD_H);
    ctx.clip();
  };

  // left LCD: attitude
  lcd(LCD_L);
  clipTo(LCD_L);
  const cx = LCD_L + LCD_W / 2,
    cy = LCD_Y + 50,
    roll = d.roll,
    pitch = d.pitch,
    ppd = 2.6,
    R = 42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll * D2R);
  ctx.translate(0, pitch * ppd);
  ctx.fillStyle = "#3AA0E0";
  ctx.fillRect(-300, -400, 600, 400);
  ctx.fillStyle = "#7A1E14";
  ctx.fillRect(-300, 0, 600, 400);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  seg(ctx, -300, 0, 300, 0);
  for (let p = -30; p <= 30; p += 5) {
    if (!p || Math.abs(p - pitch) > 15) continue; // ±15° around the current pitch, clear of the slip indicator
    const y = -p * ppd,
      major = p % 10 === 0,
      hw = major ? 18 : 8;
    seg(ctx, -hw, y, hw, y);
    if (major) {
      mdText(ctx, String(Math.abs(p)), -hw - 8, y, "#fff", 9);
      mdText(ctx, String(Math.abs(p)), hw + 8, y, "#fff", 9);
    }
  }
  ctx.translate(0, -pitch * ppd);
  // roll scale (moves with the horizon): 10, 20, 30, 60° ticks, small triangles at 45° (POH 7-18), zero index
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, R, -150 * D2R, -30 * D2R);
  ctx.stroke();
  for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const r = (a - 90) * D2R,
      c = Math.cos(r),
      sn = Math.sin(r);
    if (Math.abs(a) === 45)
      tri(
        ctx,
        [
          c * R,
          sn * R,
          Math.cos(r - 0.06) * (R + 7),
          Math.sin(r - 0.06) * (R + 7),
          Math.cos(r + 0.06) * (R + 7),
          Math.sin(r + 0.06) * (R + 7),
        ],
        "#fff",
      );
    else {
      const len = Math.abs(a) % 30 ? 5 : 9;
      seg(ctx, c * R, sn * R, c * (R + len), sn * (R + len));
    }
  }
  tri(ctx, [0, -R, -5, -R - 8, 5, -R - 8], "#fff");
  ctx.restore();
  // fixed roll pointer and yellow airplane symbol
  tri(ctx, [cx, cy - R + 1, cx - 5, cy - R + 9, cx + 5, cy - R + 9], "#fff");
  ctx.fillStyle = "#FFD200";
  ctx.fillRect(cx - 46, cy - 2, 20, 4);
  ctx.fillRect(cx + 26, cy - 2, 20, 4);
  tri(ctx, [cx, cy, cx - 18, cy + 8, cx + 18, cy + 8], "#FFD200");
  // slip indicator at the bottom of the screen
  const sy = LCD_Y + LCD_H - 9;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(cx - 30, sy - 6, 60, 12);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  seg(ctx, cx - 7, sy - 5, cx - 7, sy + 5);
  seg(ctx, cx + 7, sy - 5, cx + 7, sy + 5);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // right LCD: airspeed tape (left) and altitude tape (right), BARO at the top
  lcd(LCD_R);
  clipTo(LCD_R);
  const x0 = LCD_R,
    ty = LCD_Y + 58,
    kts = d.ias,
    v0 = Math.max(kts, 20),
    ppk = 1.5,
    ppf = 0.16;
  const ky = (v: number) => ty - (v - v0) * ppk,
    fy = (a: number) => ty - (a - d.alt) * ppf;
  const clear = (y: number) => y < ty - 19 || y > ty + 29; // tape numbers clear of the readout windows and their KTS / FEET captions
  // colour bars along the tape's left edge: green, yellow, red from the red line up, white flap range inboard of them
  const bar = (a: number, b: number, c: string, x: number, w: number) => {
    const y0 = ky(b),
      y1 = ky(a);
    ctx.fillStyle = c;
    ctx.fillRect(x, y0, w, y1 - y0);
  };
  const sb = d.bands;
  bar(...sb.green, "#14D21E", x0 + 2, 4);
  bar(...sb.yellow, "#FFD400", x0 + 2, 4);
  bar(sb.red, 400, "#FF2020", x0 + 2, 4);
  bar(...sb.white, "#FFFFFF", x0 + 7, 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.2;
  for (let v = Math.ceil((v0 - 40) / 5) * 5; v <= v0 + 40; v += 5) {
    if (v < 20) continue;
    const y = ky(v),
      big = v % 10 === 0;
    seg(ctx, x0 + 10, y, x0 + (big ? 17 : 14), y);
    if (big && clear(y)) mdText(ctx, String(v), x0 + 20, y, "#fff", 11, "left");
  }
  for (let a = Math.ceil((d.alt - 360) / 20) * 20; a <= d.alt + 360; a += 20) {
    const y = fy(a),
      big = a % 100 === 0;
    seg(ctx, x0 + LCD_W - 2, y, x0 + LCD_W - (big ? 9 : 5), y);
    if (big && clear(y)) mdText(ctx, String(a), x0 + LCD_W - 12, y, "#fff", 11, "right");
  }
  const box = (x: number, w: number, v: string, unit: string) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(x, ty - 12, w, 24);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, ty - 12, w, 24);
    mdText(ctx, v, x + w / 2, ty + 1, "#fff", 19);
    mdText(ctx, unit, x + w / 2, ty + 19, "#fff", 8);
  };
  box(x0 + 13, 42, kts ? String(kts) : "---", "KTS");
  box(x0 + 62, 74, String(d.alt), "FEET");
  // BARO: white caption over the boxed setting
  ctx.fillStyle = "#000";
  ctx.fillRect(x0 + 52, LCD_Y + 2, 42, 27);
  mdText(ctx, "BARO", x0 + 73, LCD_Y + 8, "#fff", 8);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 54, LCD_Y + 14, 38, 13);
  mdText(ctx, d.baro.toFixed(2), x0 + 73, LCD_Y + 21, "#fff", 11);
  ctx.restore();

  // control knob between the screens
  ctx.fillStyle = "#3A4046";
  ctx.beginPath();
  ctx.arc(210, 150, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5A6168";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
