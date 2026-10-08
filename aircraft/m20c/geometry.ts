/**
 * Airframe geometry for the 1967 Mooney M20C model.
 *
 * Axes: x forward, y up, z toward the right wing. Units: metres.
 * Stations: x = 2.3 − FS, where FS is the Mooney fuselage station in metres aft of the datum — the nose-gear attaching
 * bolt centreline, 33 in forward of the wing leading edge at WS 59.25 (Ranger OM §IV weight & balance). The spinner tip
 * is at FS ≈ −0.98 (x 3.28) and the rudder trailing edge at FS ≈ 6.08 (x −3.78); the CG range 42.0–49.0 in sits at
 * x ≈ 1.05–1.23. y = 0 on the propeller axis; the airplane stands on its wheels with the ground at y = −1.25.
 *
 * Stations checked against TCDS 2A3 arms (fuel +48.4, front seats +36.5 to +44, rear seats +70, baggage +93, hat shelf +114,
 * propeller −30.16, vacuum pump 0.0, battery +2.5, electric fuel pump +19).
 * Profile, planform and tail traced from the 1968 Ranger Owner's Manual dimensioned three-view (Fig. 1-1: span 35 ft 0 in,
 * length 23 ft 2 in, height 8 ft 4 in, stabilizer span 11 ft 9 in, wheelbase 5 ft 6-9/16 in, tread 9 ft 0-3/4 in, propeller
 * 6 ft 2 in with 9.5 in clearance), checked against side photos of N6947N (two side windows a side, overhead scoop, no
 * dorsal fin — the 1968 model dropped the small dorsal fin of 1962–67). The short-body M20C fuselage was otherwise unchanged 1962–77. Wing area 167 ft² (TCDS 2A3), MAC 59.18 in.
 */
import * as THREE from "three";
import { densify, finSurface, fuselage, liftingSurface, roundPoly, type Ring } from "@/lib/geometry";
import { clamp, lerp } from "@/lib/math";

export { box, cyl, sph, tubeGeo, loft, af } from "@/lib/geometry";

/** Fuselage station (m aft of the datum) → model x. */
export const fs = (station: number) => 2.3 - station;
export const IN = 0.0254;
export const GROUND_Y = -1.25;

/* ---------- fuselage ---------- */

/** Firewall (cowl / cabin seam), instrument panel face, aft cabin bulkhead (baggage), tail-cone bulkhead (empennage pivot). */
export const FW = 1.95,
  PANEL_X = 1.5,
  CABIN_AFT = -0.5,
  TAIL_BH = -2.45;

// x, halfWidth, halfHeight, centerY — traced from the three-view side and top views
const FUS: number[][] = [
  [3.0, 0.2, 0.2, -0.05],
  [2.82, 0.4, 0.26, -0.06],
  [2.56, 0.45, 0.33, -0.1],
  [2.26, 0.5, 0.42, -0.15],
  [1.95, 0.53, 0.45, -0.2],
  [1.7, 0.56, 0.48, -0.21],
  [1.55, 0.57, 0.55, -0.15],
  [1.42, 0.58, 0.6, -0.1],
  [1.3, 0.585, 0.6, -0.11],
  [1.1, 0.59, 0.61, -0.12],
  [0.82, 0.59, 0.61, -0.12],
  [0.5, 0.575, 0.605, -0.125],
  [0.22, 0.55, 0.6, -0.13],
  [-0.22, 0.5, 0.565, -0.155],
  [-0.6, 0.44, 0.5, -0.19],
  [-0.87, 0.4, 0.48, -0.19],
  [-1.2, 0.34, 0.42, -0.21],
  [-1.52, 0.3, 0.38, -0.22],
  [-1.85, 0.26, 0.335, -0.235],
  [-2.17, 0.22, 0.285, -0.265],
  [-2.5, 0.18, 0.23, -0.3],
  [-2.82, 0.15, 0.195, -0.325],
  [-3.1, 0.12, 0.165, -0.37],
  [-3.34, 0.1, 0.14, -0.42],
  [-3.6, 0.07, 0.1, -0.47],
  [-3.78, 0.03, 0.05, -0.5],
];
// Rounded top with a little tumblehome; flat, squarish belly
export const FUSE = fuselage({ table: FUS, nTop: 2.3, nBot: 3.2, tumble: 0.18 });
export const { fus, topY, botY, onSkin } = FUSE;
export const fRing = FUSE.ring;
export const inFus = FUSE.inside;
export const planeRing = FUSE.plate;
export const sectionSlab = FUSE.slab;

/** Skin UV box (side projection) for the painted texture. */
export const SK = { x0: -3.9, x1: 3.4, y0: -0.9, y1: 0.75, W: 2048, H: 512 };

/* ---------- wing: laminar flow (NACA 63-215 root / 64-412 tip), 5.5° dihedral, straight trailing edge ---------- */
/** Root rib at the fuselage side, tip. The 1967 wing has a near-straight trailing edge and a tapered leading edge. */
export const WR = 0.57,
  WTIP = 5.33;
export const WING_TE = -0.32;
export const ROOT_C = 1.75,
  TIP_C = 1.0;
export const wC = (z: number) => lerp(ROOT_C, TIP_C, clamp((Math.abs(z) - WR) / (WTIP - WR), 0, 1)) - tipCut(z);
const tipCut = (z: number) => {
  const a = Math.abs(z);
  return a > 5.05 ? 0.35 * Math.pow((a - 5.05) / 0.28, 2) : 0;
};
/** Straight trailing edge: the leading edge carries all the taper and curves aft around the rounded tip. */
export const wLE = (z: number) => WING_TE + wC(z);
/** Chord-line height: root low on the fuselage, 5.5° dihedral. */
export const wY = (z: number) => -0.5 + Math.max(0, Math.abs(z) - WR) * 0.0963;
export const wT = (z: number) => 0.15 - clamp((Math.abs(z) - WR) / (WTIP - WR), 0, 1) * 0.03;
const WING = liftingSurface({ le: wLE, chord: wC, y: wY, t: wT, m: 0.015 });
export const wingP = WING.p;
export const wingSec = WING.sec;
/** Flaps WS 0.6–2.95 ("wide span"), ailerons 3.0–5.1; hinges at 74 % and 76 % chord. Main spar ≈ 33 %, aux spar ≈ 68 %. */
export const FLAP = { z0: 0.62, z1: 2.95, hinge: 0.74 },
  AIL = { z0: 3.02, z1: 5.1, hinge: 0.76 };
/** Fixed skin and moving surfaces share their actual chord boundary. */
export const wingCut = (z: number) =>
  lerp(FLAP.hinge, AIL.hinge, clamp((Math.abs(z) - FLAP.z1) / (AIL.z0 - FLAP.z1), 0, 1));
export const MAIN_SPAR = 0.33,
  AUX_SPAR = 0.68;

/* ---------- empennage: the whole tail pivots on the tail-cone bulkhead for trim ---------- */
/** Empennage pivot (two attachment points on the tail cone, OM p. 6): just below the stabilizer at the aft bulkhead. */
export const TAIL_PIVOT: [number, number, number] = [-2.55, -0.28, 0];
/** Stabilizer: span 3.58 m, straight leading edge, trailing edge tapering forward to the tips. */
export const SSPAN = 1.79,
  SY = -0.1;
export const sLE = () => -2.58;
export const sC = (z: number) => 1.15 - (Math.abs(z) / SSPAN) * 0.55;
/** A one-piece elevator needs one straight hinge. Preserve the previous approximate
 * elevator area (45% of the trapezoid), rather than sweeping its split at 55% of each chord.
 * The manual does not dimension the hinge; this is a consistent schematic fit. */
export const ELEV_HINGE_X = sLE() - (0.55 * (sC(0) + sC(SSPAN))) / 2;
export const EF = (z: number) => (sLE() - ELEV_HINGE_X) / sC(z);
export const stab = liftingSurface({ le: sLE, chord: sC, y: () => SY, t: () => 0.1, m: 0 });
export const stabSec = stab.sec;

/**
 * Fin: narrow fixed fin ahead of a near-vertical hinge, large rudder whose trailing edge sweeps aft toward the bottom —
 * the leading edge rakes slightly forward from root to tip (M20 trademark). [height y, LE x, TE x].
 */
export const FIN = [
  [-0.22, -2.56, -3.76],
  [-0.1, -2.57, -3.7],
  [0.1, -2.58, -3.6],
  [0.4, -2.6, -3.46],
  [0.7, -2.615, -3.35],
  [0.95, -2.625, -3.28],
  [1.08, -2.63, -3.25],
  [1.14, -2.64, -3.2],
];
const finAt = (h: number) => {
  let i = 0;
  while (i < FIN.length - 2 && h > FIN[i + 1][0]) i++;
  const [h0, a0, b0] = FIN[i],
    [h1, a1, b1] = FIN[i + 1],
    t = clamp((h - h0) / (h1 - h0), 0, 1);
  return [lerp(a0, a1, t), lerp(b0, b1, t)];
};
export const fLE = (h: number) => finAt(h)[0];
export const fC = (h: number) => finAt(h)[0] - finAt(h)[1];
export const FIN_TOP = 1.14,
  RUD_BOT = -0.22;
/** Rudder hinge line x at height h: almost vertical. */
export const hingeX = (h: number) => lerp(-2.78, -2.84, (h - RUD_BOT) / (FIN_TOP - RUD_BOT));
export const finCut = (h: number) => clamp((fLE(h) - hingeX(h)) / fC(h), 0.05, 0.95);
export const finSec = finSurface({ le: fLE, chord: fC, t: (h) => Math.min(0.12, 0.09 / Math.max(fC(h), 0.4)) }).sec;
export const finHs = [-0.22, -0.1, 0.1, 0.4, 0.7, 0.95, 1.08, FIN_TOP];
export const rudHs = [RUD_BOT, -0.1, 0.1, 0.4, 0.7, 0.95, 1.08, FIN_TOP];

/* ---------- windows, doors & painted skin ---------- */
export const WIN = {
  /** Windshield side edge: base at the cowl seam up the post to the roof. */
  windLower: [
    [1.68, 0.28],
    [1.5, 0.22],
    [1.38, 0.6],
  ],
  /** Door / pilot's window: forward edge parallel to the windshield post, flat top under the roofline, vertical aft edge (N6947N photo). */
  front: roundPoly(
    [
      [1.49, 0.1],
      [1.37, 0.46],
      [0.77, 0.47],
      [0.75, 0.1],
    ],
    0.08,
    1,
  ),
  /** Rear window: near-rectangular with a rounded aft-bottom corner, same sill line. */
  rear: roundPoly(
    [
      [0.66, 0.1],
      [0.66, 0.46],
      [0.18, 0.44],
      [0.17, 0.1],
    ],
    0.1,
    1,
  ),
  /** Cabin door (right side): from the windshield post to behind the front seats, down to the wing-root fairing. */
  door: roundPoly(
    [
      [1.52, -0.3],
      [1.5, 0.5],
      [0.72, 0.5],
      [0.7, -0.3],
    ],
    0.08,
    1,
  ),
  /** Baggage door (right side), just behind the rear window: between the window sill and the cheat line (photo). */
  bag: roundPoly(
    [
      [0.1, -0.17],
      [0.1, 0.13],
      [-0.22, 0.13],
      [-0.22, -0.17],
    ],
    0.08,
    1,
  ),
};

export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [];
  [1, -1].forEach((s) => [WIN.front, WIN.rear].forEach((w) => loops.push(densify(w).map(([x, y]) => onSkin(x, y, s)))));
  loops.push(densify(WIN.door).map(([x, y]) => onSkin(x, y, 1, 1.008)));
  loops.push(densify(WIN.bag).map(([x, y]) => onSkin(x, y, 1, 1.008)));
  const side = (s: number) => densify(WIN.windLower, 0.03, false).map(([x, y]) => onSkin(x, y, s));
  const ta = FUSE.thetaAt(1.38, 0.6),
    tb = FUSE.thetaAt(1.68, 0.28);
  loops.push([
    ...side(1),
    ...fRing(1.38, 1.006, 40, ta, Math.PI - ta, false),
    ...side(-1).reverse(),
    ...fRing(1.68, 1.006, 40, Math.PI - tb, tb, false),
  ] as Ring);
  loops.push(fRing(FW + 0.02, 1.004, 48));
  return loops;
}

/** Fuselage loft with side-projected UVs for the painted skin texture. */
export const fuselageGeo = () => FUSE.geo({ step: 0.06, N: 48, uv: SK });

export const NAVY = "#1B2A5E",
  LIGHT_BLUE = "#7FA9D6";
/** One-colour texture for shells and surfaces painted a solid colour (geometry gets a dummy UV set). */
export function flatPaint(hex: string): () => THREE.CanvasTexture {
  return () => {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    const g = c.getContext("2d")!;
    g.fillStyle = hex;
    g.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
}
/** Gives a geometry a zero UV set so a flat painted material can be used on it. */
export function withUv(g: THREE.BufferGeometry) {
  if (!g.attributes.uv)
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/** Paints N6947N's scheme: white with a navy nose, a light-blue and navy cheat line, windows and door seams (browser only). */
export function paintSkin(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = SK.W;
  c.height = SK.H;
  const g = c.getContext("2d")!;
  const P = ([x, y]: number[]) => [((x - SK.x0) / (SK.x1 - SK.x0)) * SK.W, (1 - (y - SK.y0) / (SK.y1 - SK.y0)) * SK.H];
  const path = (pts: number[][], close = true) => {
    g.beginPath();
    pts.forEach((q, i) => {
      const [a, b] = P(q);
      if (i) g.lineTo(a, b);
      else g.moveTo(a, b);
    });
    if (close) g.closePath();
  };
  g.fillStyle = "#F3F5F6";
  g.fillRect(0, 0, SK.W, SK.H);
  // navy nose: the whole upper cowl from the spinner back to the cowl seam, tapering to a point on the sides (N6947N photo)
  path([
    [3.4, -0.2],
    [2.9, -0.08],
    [2.3, 0.02],
    [FW, 0.1],
    [FW, 0.75],
    [3.4, 0.75],
  ]);
  g.fillStyle = NAVY;
  g.fill();
  // cheat line from the cowl seam to the tail: a light-blue band under the window sills with a thin navy line beneath it
  path([
    [FW, 0.02],
    [0.4, 0.02],
    [-1.2, -0.02],
    [-2.6, -0.08],
    [-3.5, -0.14],
    [-3.5, -0.24],
    [-2.6, -0.18],
    [-1.2, -0.12],
    [0.4, -0.08],
    [FW, -0.08],
  ]);
  g.fillStyle = LIGHT_BLUE;
  g.fill();
  path([
    [FW, -0.1],
    [0.4, -0.1],
    [-1.2, -0.14],
    [-2.6, -0.2],
    [-3.5, -0.26],
    [-3.5, -0.3],
    [-2.6, -0.24],
    [-1.2, -0.18],
    [0.4, -0.14],
    [FW, -0.14],
  ]);
  g.fillStyle = NAVY;
  g.fill();
  // door and baggage-door seams
  [WIN.door, WIN.bag].forEach((w) => {
    path(w);
    g.strokeStyle = "#9AA3AA";
    g.lineWidth = 2;
    g.stroke();
  });
  const glass = () => {
    const gr = g.createLinearGradient(0, P([0, 0.6])[1], 0, P([0, 0.1])[1]);
    gr.addColorStop(0, "#3A4C5A");
    gr.addColorStop(1, "#131C24");
    return gr;
  };
  path([
    [1.68, 0.28],
    [1.5, 0.22],
    [1.38, 0.6],
    [1.37, 1.0],
    [1.7, 1.0],
  ]);
  g.fillStyle = glass();
  g.fill();
  [WIN.front, WIN.rear].forEach((w) => {
    path(w);
    g.fillStyle = glass();
    g.fill();
    g.strokeStyle = "#0B1014";
    g.lineWidth = 3;
    g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
