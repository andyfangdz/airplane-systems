import { cutCowlInlets } from "@/lib/cowl";
import { COWL_INLETS } from "../cowl-inlets";
import { drawLivery, liveryLabels, tailTexture } from "../liveries";
import { paintAtlas, sidePaintUV } from "@/lib/livery";
/**
 * Airframe geometry for the SR20 G6 model.
 *
 * Axes: x forward, y up, z toward the right wing. Units: metres.
 * Fuselage profile traced from POH Figure 1-1 (three view); tailcone, fin and window
 * outlines traced from a G6 side photo (OO-CBB, s/n 2347, Wikimedia Commons).
 */
import * as THREE from "three";
import { densify, finSurface, fuselage, liftingSurface, roundPoly, type Ring } from "@/lib/geometry";
import { clamp, lerp } from "@/lib/math";

export { box, cyl, sph, tubeGeo, pantGeo, loft, af } from "@/lib/geometry";

/* ---------- fuselage ---------- */

/** Firewall (FS 100) and aft baggage bulkhead (FS 222) stations. */
export const FW = 2.61,
  AB = -0.49;
export const GROUND_Y = -1.39;

// x, halfWidth, halfHeight, centerY — cowl & cabin from POH Fig. 1-1, tailcone from the G6 side photo
const FUS = [
  [3.74, 0.32, 0.155, -0.125],
  [3.66, 0.42, 0.24, -0.16],
  [3.52, 0.5, 0.3, -0.19],
  [3.3, 0.55, 0.35, -0.2],
  [2.96, 0.6, 0.4, -0.22],
  [2.61, 0.62, 0.45, -0.23],
  [2.31, 0.625, 0.575, -0.13],
  [2.01, 0.635, 0.654, -0.06],
  [1.71, 0.64, 0.7, -0.02],
  [1.26, 0.65, 0.718, 0.0],
  [0.65, 0.645, 0.69, -0.006],
  [0.05, 0.61, 0.623, -0.015],
  [-0.25, 0.54, 0.56, -0.03],
  [-0.55, 0.47, 0.485, -0.045],
  [-0.85, 0.39, 0.443, -0.047],
  [-1.15, 0.31, 0.398, -0.063],
  [-1.6, 0.2, 0.368, -0.062],
  [-2.05, 0.145, 0.355, -0.045],
  [-2.4, 0.12, 0.33, -0.05],
  [-2.8, 0.1, 0.27, -0.07],
  [-3.1, 0.08, 0.2, -0.1],
  [-3.3, 0.04, 0.09, -0.11],
  [-3.36, 0.015, 0.03, -0.11],
];
// Cross-section: rounder top (n 2.4) with tumblehome, flatter belly (n 3)
export const FUSE = fuselage({ table: FUS, nTop: 2.4, nBot: 3.0, tumble: 0.2 });
export const { fus, topY, botY, onSkin } = FUSE;
export const fRing = FUSE.ring;
export const inFus = FUSE.inside;
export const planeRing = FUSE.plate;
export const sectionSlab = FUSE.slab;

/* ---------- wing: root buried at z 0.35, rounded tip from z 5.2, ~5° dihedral ---------- */
export const WR = 0.35,
  WTIP = 5.84,
  WSPAN = WTIP - WR;
const tipCut = (z: number) => {
  const a = Math.abs(z);
  // POH Fig 1-1: nearly straight LE until the last 0.29 m, then a rounded end cap.
  const u = clamp((a - 5.55) / (WTIP - 5.55), 0, 1);
  return 0.76 * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
};
export const wLE = (z: number) => 1.75 - (Math.abs(z) - WR) * 0.025 - tipCut(z);
export const wC = (z: number) => 1.5 - ((Math.abs(z) - WR) / WSPAN) * 0.7 - tipCut(z);
export const wY = (z: number) => -0.6 + (Math.abs(z) - WR) * 0.09;
export const wT = (z: number) => 0.15 - ((Math.abs(z) - WR) / WSPAN) * 0.04;
const WING = liftingSurface({ le: wLE, chord: wC, y: wY, t: wT, m: 0.02 });

/** Point on the wing at span z and chord fraction xc; up = +1 upper, -1 lower, 0 mean line. */
export const wingP = WING.p;
export const wingSec = WING.sec;

/*
 * ---------- horizontal tail: planform scaled from AMM 13773-002 Fig 6-00-2 (SR22/SR22T; the SR20 POH Fig 1-1 plan view
 * shows the same shape): LE FS 294.5 at BL 10 to 301.3 at BL 70, TE FS 324.3 to 321.3, tip at BL 77.3 ----------
 */
export const SY = -0.02,
  SSPAN = 1.963,
  /** Elevator chord fraction: a straight, unswept hinge line at FS 315.2 (AMM Fig 6-00-2). */
  EF = 0.694;
/** Elevator tip (horn balance): outboard of HZ (BL 72) the elevator is full chord with a rounded leading corner (AMM Fig 55-20-2). */
export const HZ = 1.83;
/** How far the rounded elevator tip cuts back the leading edge outboard of HZ (the trailing edge stays straight). */
const hTip = (z: number) => {
  const a = Math.abs(z);
  return a > HZ ? 0.45 * (1 - Math.sqrt(Math.max(0, 1 - ((a - HZ) / (SSPAN - HZ)) ** 2))) : 0;
};
export const sLE = (z: number) => -2.302 - Math.abs(z) * 0.113 - hTip(z);
export const sC = (z: number) => 0.798 - Math.abs(z) * 0.163 - hTip(z);
/** Fin height calibrated to the SR20 G6's 8.9 ft overall height (POH Fig 1-1).
 * The old vertical stations came from an SR22/SR22T AMM and made this SR20 0.21 m too tall.
 * Retain the photo-fitted x stations; map all fin/rudder attachments with the same vertical scale. */
export const FIN_TOP = GROUND_Y + 8.9 * 0.3048;
export const finHeight = (oldY: number) => -0.18 + ((oldY + 0.18) * (FIN_TOP + 0.18)) / (1.534 + 0.18);
/** Full-chord rudder horn starts above the fixed fin. */
export const HH = finHeight(1.4);
export const stabSec = liftingSurface({ le: sLE, chord: sC, y: () => SY, t: () => 0.1, m: 0 }).sec;

/* ---------- fin: dorsal fillet from x -1.95, swept LE, flat top ---------- */
// [height, leading edge x, trailing edge x]: leading edge traced from the G6 side photo; trailing edge and top scaled from
// the SR22/SR22T AMM for longitudinal proportions only; vertical stations are calibrated by finHeight to SR20 POH Fig 1-1.
export const FIN = [
  [-0.25, -2.95, -3.2],
  [-0.1, -2.7, -3.4],
  [0.05, -2.45, -3.455],
  [0.2, -2.15, -3.48],
  [0.31, -1.95, -3.5],
  [0.35, -2.14, -3.505],
  [0.4, -2.29, -3.515],
  [0.45, -2.42, -3.525],
  [0.52, -2.56, -3.535],
  [0.8, -2.7, -3.585],
  [1.1, -2.88, -3.64],
  [1.32, -3.0, -3.68],
  [1.42, -3.15, -3.7],
  [1.47, -3.29, -3.715],
  [1.51, -3.45, -3.73],
  [1.534, -3.62, -3.745],
].map(([h, le, te]) => [finHeight(h), le, te]);
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
// rudder hinge line (height, x): the rudder/fin split line, FS 320.7 at WL 98 to FS 339.3 at WL 155 (AMM Fig 6-00-2)
const RH = [
  [finHeight(-0.18), -3.0],
  [finHeight(1.44), -3.52],
];
export const hingeX = (h: number) => lerp(RH[0][1], RH[1][1], (h - RH[0][0]) / (RH[1][0] - RH[0][0]));
/** Chord fraction of the rudder hinge below the horn. */
export const finCut = (h: number) => (h < RH[0][0] || h > RH[1][0] ? 1 : clamp((fLE(h) - hingeX(h)) / fC(h), 0.05, 1));
export const finSec = finSurface({ le: fLE, chord: fC, t: (h) => Math.min(0.11, 0.1 / fC(h)) }).sec;
/** Fin section heights: the fin ends at the horn joint. */
export const finHs = [...FIN.map((r) => r[0]).filter((h) => h < HH), HH];

/* ---------- windows & painted skin ---------- */
export const SK = { x0: -3.45, x1: 4.2, y0: -0.95, y1: 1.0, W: 2048, H: 512 };

export const WIN = {
  /** Gull-wing door window: slanted front edge parallel to the A-pillar, near-vertical rear edge. */
  front: roundPoly(
    [
      [1.64, 0.12],
      [1.43, 0.575],
      [0.93, 0.59],
      [0.99, 0.11],
    ],
    0.16,
  ),
  /** Fixed rear window: straight front edge, top follows the roof, large rounded aft edge. */
  rear: roundPoly(
    [
      [0.79, 0.11],
      [0.78, 0.4],
      [0.72, 0.5],
      [0.62, 0.535],
      [0.4, 0.505],
      [0.18, 0.44],
      [0.06, 0.38],
      [0.015, 0.3],
      [0.04, 0.22],
      [0.12, 0.16],
      [0.3, 0.125],
      [0.6, 0.1],
    ],
    0.3,
    2,
  ),
  /** Wrap-around windshield: lower side edge then A-pillar up to the roof. */
  windLower: [
    [2.45, 0.24],
    [1.93, 0.12],
    [1.73, 0.6],
  ],
};

/** Cabin door seam (x, y), painted on the skin. */
export const DOOR = roundPoly(
  [
    [1.96, -0.3],
    [1.94, 0.12],
    [1.74, 0.64],
    [0.84, 0.67],
    [0.8, -0.3],
  ],
  0.12,
);

/** Window outline loops projected onto the skin (both sides + windshield). */
export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [];
  [1, -1].forEach((s) => [WIN.front, WIN.rear].forEach((w) => loops.push(densify(w).map(([x, y]) => onSkin(x, y, s)))));
  const side = (s: number) => densify(WIN.windLower, 0.03, false).map(([x, y]) => onSkin(x, y, s));
  const ta = FUSE.thetaAt(1.73, 0.6),
    tb = FUSE.thetaAt(2.45, 0.24);
  loops.push([
    ...side(1),
    ...fRing(1.73, 1.006, 40, ta, Math.PI - ta, false),
    ...side(-1).reverse(),
    ...fRing(2.45, 1.006, 40, Math.PI - tb, tb, false),
  ] as Ring);
  return loops;
}

/** Fuselage loft with side-projected UVs for the painted skin texture. */
export const fuselageGeo = () => sidePaintUV(cutCowlInlets(FUSE.geo({ step: 0.06, N: 48 }), COWL_INLETS.sr20), SK);

/** Paints N800KP’s photo-referenced stripes, window shapes and door seams (browser only). */
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
  path(DOOR);
  g.strokeStyle = "#A9B2B9";
  g.lineWidth = 2;
  g.stroke();
  drawLivery("sr20", g, P);
  const glass = () => {
    const gr = g.createLinearGradient(0, P([0, 0.7])[1], 0, P([0, 0.1])[1]);
    gr.addColorStop(0, "#3A4C5A");
    gr.addColorStop(1, "#131C24");
    return gr;
  };
  path([
    [2.45, 0.24],
    [1.93, 0.12],
    [1.73, 0.6],
    [1.72, 1.0],
    [2.47, 1.0],
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
  return paintAtlas(c, P, liveryLabels("sr20", "fuselage"));
}

export const TAIL_PAINT_BOX = { x0: -3.9, x1: -1.8, y0: -0.3, y1: 1.6 };
export const paintTail = () => tailTexture("sr20", TAIL_PAINT_BOX);
