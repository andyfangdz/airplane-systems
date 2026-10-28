/**
 * The attitude indicator over the foot of the view, drawn on a canvas: sky over ground, the horizon turned by the bank
 * and moved by the pitch, a pitch ladder every 5°, the bank scale with its pointer, and the fixed airplane symbol.
 * Instrument colours, the same in either theme.
 */
const D2R = Math.PI / 180;
/** Degrees of pitch from the centre to the edge of the face. */
const FACE_DEG = 32;
const BANK_MARKS = [10, 20, 30, 45, 60];

export function drawAdi(c: CanvasRenderingContext2D, W: number, H: number, pitch: number, bank: number) {
  const r = Math.min(W, H) / 2 - 2,
    cx = W / 2,
    cy = H / 2,
    ppd = r / FACE_DEG,
    lw = Math.max(1, r / 45);
  c.clearRect(0, 0, W, H);
  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.clip();
  c.translate(cx, cy);
  c.rotate(-bank * D2R);
  // the bank pointer turns with the sky
  c.save();
  c.translate(0, pitch * ppd);
  c.fillStyle = "#3a83c3";
  c.fillRect(-3 * r, -12 * r, 6 * r, 12 * r);
  c.fillStyle = "#86592f";
  c.fillRect(-3 * r, 0, 6 * r, 12 * r);
  c.strokeStyle = "#fff";
  c.fillStyle = "#fff";
  c.lineWidth = lw * 1.3;
  c.beginPath();
  c.moveTo(-3 * r, 0);
  c.lineTo(3 * r, 0);
  c.stroke();
  c.lineWidth = lw;
  c.font = `${Math.round(r / 7)}px ui-monospace, monospace`;
  c.textBaseline = "middle";
  for (let p = -90; p <= 90; p += 5) {
    if (!p) continue;
    const y = -p * ppd,
      w = p % 10 ? r * 0.16 : r * 0.36;
    c.beginPath();
    c.moveTo(-w, y);
    c.lineTo(w, y);
    c.stroke();
    if (p % 10 === 0) {
      c.textAlign = "right";
      c.fillText(String(Math.abs(p)), -w - r * 0.04, y);
      c.textAlign = "left";
      c.fillText(String(Math.abs(p)), w + r * 0.04, y);
    }
  }
  c.restore();
  c.fillStyle = "#fff";
  c.beginPath();
  c.moveTo(0, -r * 0.8);
  c.lineTo(-r * 0.07, -r * 0.68);
  c.lineTo(r * 0.07, -r * 0.68);
  c.closePath();
  c.fill();
  c.restore();

  // the bank scale, fixed to the case
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = "#fff";
  c.lineWidth = lw;
  for (const b of [0, ...BANK_MARKS, ...BANK_MARKS.map((m) => -m), 90, -90]) {
    const a = (b - 90) * D2R,
      long = b % 30 === 0;
    c.beginPath();
    c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a) * r * (long ? 0.84 : 0.9), Math.sin(a) * r * (long ? 0.84 : 0.9));
    c.stroke();
  }
  // the airplane symbol
  c.strokeStyle = "#f2a13a";
  c.lineWidth = lw * 2.4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-r * 0.55, 0);
  c.lineTo(-r * 0.2, 0);
  c.lineTo(-r * 0.1, r * 0.08);
  c.moveTo(r * 0.55, 0);
  c.lineTo(r * 0.2, 0);
  c.lineTo(r * 0.1, r * 0.08);
  c.stroke();
  c.fillStyle = "#f2a13a";
  c.beginPath();
  c.arc(0, 0, lw * 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.strokeStyle = "#2b3842";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();
}
