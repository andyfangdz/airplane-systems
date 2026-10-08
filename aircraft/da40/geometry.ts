import { cutCowlInlets } from "@/lib/cowl";
import { COWL_INLETS } from "../cowl-inlets";
import { drawLivery, liveryLabels, tailTexture } from "../liveries";
import { paintAtlas, sidePaintUV } from "@/lib/livery";
/**
 * Airframe geometry for the DA40 XLS model.
 *
 * Axes: x forward, y up, z toward the right wing. Units: metres.
 * Origin and station mapping:
 *   x = 3.0 − FS, where FS is the AFM fuselage station (metres aft of the Datum Plane, which lies
 *   2.194 m forward of the root-rib leading edge — AFM 6.4 / 2-13). The spinner tip sits at FS ≈ 0.06
 *   (x ≈ 2.94) and the rudder trailing edge at FS ≈ 8.0 (x ≈ −5.0).
 *   y = 0 on the propeller axis. The airplane sits on its wheels in the ground attitude with the
 *   ground at y = −1.235 (AFM three-view: spinner axis 1.24 m above the ground).
 *
 * Profile and planform were traced from the AFM §1.7 three-view (side view de-skewed by 3.6°,
 * 4.41 mm/px) and checked against the AMM Fig. 2-6 stations (panel FS 1775, jack point FS 2410,
 * remote avionics FS 3832) and side photos of DA40 XLS N877US (s/n 40.877) and VH-DIV.
 * Overall: span 11.94 m, length 8.01 m, height 1.97 m, track 2.97 m, propeller Ø 1.83 m.
 */
import * as THREE from "three";
import { densify, finSurface, fuselage, liftingSurface, loft, roundPoly, type Ring } from "@/lib/geometry";
import { V, clamp, lerp } from "@/lib/math";

export { box, cyl, sph, tubeGeo, pantGeo, loft, af } from "@/lib/geometry";

/** Fuselage station (m aft of the datum) → model x. */
export const fs = (station: number) => 3.0 - station;
export const GROUND_Y = -1.235;

/* ---------- fuselage ---------- */

/** Firewall (≈FS 1.35, inference), instrument panel (FS 1.78, AFM 6.5 arm of all panel items), roll bar and baggage frame. */
export const FW = fs(1.35),
  PANEL_X = fs(1.78),
  ROLLBAR_X = fs(2.78),
  BAG_FRAME = fs(4.05);

// FS, halfWidth, top y, bottom y — from the de-skewed AFM side view and top view
const PROFILE: number[][] = [
  [0.46, 0.37, 0.205, -0.2],
  [0.52, 0.405, 0.212, -0.235],
  [0.62, 0.44, 0.218, -0.29],
  [0.75, 0.465, 0.22, -0.36],
  [0.9, 0.485, 0.218, -0.44],
  [1.1, 0.5, 0.212, -0.52],
  [1.3, 0.515, 0.205, -0.565],
  [1.41, 0.522, 0.195, -0.585],
  [1.55, 0.532, 0.27, -0.6],
  [1.67, 0.54, 0.35, -0.612],
  [1.89, 0.553, 0.44, -0.63],
  [2.15, 0.567, 0.515, -0.645],
  [2.42, 0.577, 0.548, -0.655],
  [2.64, 0.58, 0.555, -0.66],
  [2.86, 0.576, 0.535, -0.665],
  [3.1, 0.566, 0.505, -0.67],
  [3.3, 0.55, 0.475, -0.67],
  [3.55, 0.525, 0.42, -0.67],
  [3.74, 0.5, 0.36, -0.665],
  [3.96, 0.465, 0.27, -0.645],
  [4.18, 0.42, 0.18, -0.615],
  [4.4, 0.355, 0.08, -0.59],
  [4.62, 0.29, -0.02, -0.57],
  [4.85, 0.255, -0.085, -0.56],
  [5.07, 0.232, -0.14, -0.55],
  [5.51, 0.18, -0.21, -0.535],
  [5.95, 0.155, -0.24, -0.53],
  [6.39, 0.13, -0.265, -0.53],
  [6.9, 0.112, -0.29, -0.525],
  [7.2, 0.095, -0.31, -0.52],
  [7.4, 0.07, -0.33, -0.515],
  [7.47, 0.025, -0.37, -0.48],
];
const FUS = PROFILE.map(([st, hw, top, bot]) => [fs(st), hw, (top - bot) / 2, (top + bot) / 2]);
// Rounded top, fuller belly, slight tumblehome toward the canopy
export const FUSE = fuselage({ table: FUS, nTop: 2.25, nBot: 2.7, tumble: 0.16 });
export const { fus, topY, botY, onSkin } = FUSE;
export const fRing = FUSE.ring;
export const inFus = FUSE.inside;
export const planeRing = FUSE.plate;
export const sectionSlab = FUSE.slab;

/** Canopy / rear-door split line (side sill). */
export const SILL_Y = -0.06;
/** Rear-door hinge line along the left roof edge, a little below the roof crown. */
export const doorHingeY = (x: number) => Math.min(0.46, topY(x) - 0.04);
/** Front canopy: windshield base (front hinge) to the roll bar. Rear door: roll bar to the baggage frame. */
export const CANOPY = { x0: fs(1.41), x1: ROLLBAR_X, hinge: [fs(1.44), 0.17, 0] as [number, number, number] };
export const DOOR = { x0: fs(2.8), x1: fs(3.78) };

/** Skin UV box (side projection) for the painted texture. */
export const SK = { x0: -4.6, x1: 2.6, y0: -0.75, y1: 0.62, W: 2048, H: 512 };

/** Ring angle on the right side (0 = side, π/2 = top) where the upper skin passes height y. */
const thetaAt = (x: number, y: number) => {
  const { hh, cy } = fus(x);
  const py = (y - cy) / hh;
  if (py >= 0) return FUSE.thetaAt(x, y);
  // lower half: superellipse with nBot
  return -Math.asin(Math.pow(clamp(-py, 0, 1), FUSE.nBot / 2));
};

/** Loft of open ring arcs th0(x)..th1(x) between stations x0 > x1, with side-projected UVs. */
function arcLoft(x0: number, x1: number, th: (x: number) => [number, number], step = 0.05, N = 40) {
  const secs: Ring[] = [];
  const n = Math.max(2, Math.ceil((x0 - x1) / step));
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n),
      [a, b] = th(x);
    secs.push(fRing(x, 1, N, a, b, false));
  }
  const g = loft(secs, { closed: false, caps: false });
  // Ring arcs run nose to tail: reverse the inward winding before lighting.
  const ix = g.index!;
  for (let i = 0; i < ix.count; i += 3) {
    const b = ix.getX(i + 1);
    ix.setX(i + 1, ix.getX(i + 2));
    ix.setX(i + 2, b);
  }
  g.computeVertexNormals();
  return sidePaintUV(g, SK);
}

const PI = Math.PI;
const sill = (x: number) => thetaAt(x, SILL_Y);
const hingeTh = (x: number) => thetaAt(x, doorHingeY(x));

/** Fixed fuselage skin: nose, cabin lower half, rear cabin minus the left rear door, tailcone. */
export function fuselageGeos() {
  const nose = arcLoft(FUSE.xNose, CANOPY.x0, () => [0, 2 * PI]);
  const lower = arcLoft(CANOPY.x0, CANOPY.x1, (x) => [PI - sill(x), 2 * PI + sill(x)]);
  // between the roll bar and the door front post the skin is closed
  const post = arcLoft(CANOPY.x1, DOOR.x0, () => [0, 2 * PI]);
  // around the door: from the left sill down under the belly, up the right side, over the roof to the left hinge
  const rear = arcLoft(DOOR.x0, DOOR.x1, (x) => [PI - sill(x), 3 * PI - hingeTh(x)]);
  const tail = arcLoft(DOOR.x1, FUSE.xTail, () => [0, 2 * PI]);
  return [nose, lower, post, rear, tail];
}
/** Front canopy shell (world coordinates): over the top from the right sill to the left sill. */
export const canopyGeo = () => arcLoft(CANOPY.x0, CANOPY.x1, (x) => [sill(x), PI - sill(x)], 0.04, 40);
/** Rear passenger door (left side): from the roof hinge line down to the sill. */
export const doorGeo = () => arcLoft(DOOR.x0, DOOR.x1, (x) => [PI - hingeTh(x), PI - sill(x)], 0.04, 16);

/* ---------- wing: Wortmann FX 63-137, 5° dihedral, ~1° LE sweep (AFM 1.4) ---------- */
/** Stub-wing joint (root rib, FS 2.194), end of the straight outer panel, wing tip. */
export const WR = 0.35,
  WJ = 1.1,
  WOUT = 5.56,
  WTIP = 5.97;
const LE_STUB = 2.1,
  ROOT_LE = 2.194;
/** Leading-edge station (FS) and chord (m) along the span. */
function leFS(z: number) {
  const a = Math.abs(z);
  if (a <= 0.58) return LE_STUB;
  if (a <= WJ) return lerp(LE_STUB, ROOT_LE, (a - 0.58) / (WJ - 0.58));
  const base = ROOT_LE + (a - WJ) * 0.0175;
  return a <= 5.67 ? base : base + ((a - 5.67) / 0.3) * 0.55; // raked tip
}
function teFS(z: number) {
  const a = Math.abs(z);
  if (a <= 0.58) return LE_STUB + 1.48;
  if (a <= WJ) return lerp(LE_STUB + 1.48, ROOT_LE + 1.26, (a - 0.58) / (WJ - 0.58));
  return ROOT_LE + 1.26 - (a - WJ) * 0.0632;
}
export const wLE = (z: number) => fs(leFS(Math.min(Math.abs(z), WTIP)));
export const wC = (z: number) => Math.max(0.12, teFS(Math.min(Math.abs(z), WTIP)) - leFS(Math.min(Math.abs(z), WTIP)));
/** Chord-line height: 5° dihedral from the root, tips turned up. */
export const wY = (z: number) => {
  const a = Math.abs(z);
  return -0.55 + (a - WR) * 0.0875 + (a > WOUT ? Math.pow(a - WOUT, 1.5) * 0.34 : 0);
};
export const wT = (z: number) => 0.137 - ((Math.abs(z) - WR) / (WTIP - WR)) * 0.012;
const WING = liftingSurface({ le: wLE, chord: wC, y: wY, t: wT, m: 0.04 });
/** Point on the wing at span z and chord fraction xc; up = +1 upper, −1 lower, 0 mean line. */
export const wingP = WING.p;
export const wingSec = WING.sec;
/** Flap and aileron spans (top view): flap z 1.20–3.92, aileron 3.92–5.53; hinge at 78 % chord. */
export const FLAP = { z0: 1.2, z1: 3.9, hinge: 0.78 },
  AIL = { z0: 3.94, z1: 5.53, hinge: 0.8 };
/** Fixed skin must reach the actual hinge: using the flap cut outboard left a 2%-chord hole ahead of each aileron. */
export const wingCut = (z: number) =>
  lerp(FLAP.hinge, AIL.hinge, clamp((Math.abs(z) - FLAP.z1) / (AIL.z0 - FLAP.z1), 0, 1));

/* ---------- T-tail horizontal stabilizer (span ≈ 3.25 m, AFM area 2.34 m²) ---------- */
export const SSPAN = 1.625,
  SY = 0.7;
/** Root LE FS 7.15, root chord 0.90, swept LE, straight TE at FS 8.05. */
export const sLE = (z: number) => fs(7.15 + (Math.abs(z) / SSPAN) * 0.35);
export const sC = (z: number) => 0.9 - (Math.abs(z) / SSPAN) * 0.35;
/** Elevator hinge line FS 7.83 (elevator ≈ 0.665 m², AFM 1.4); horn balance outboard of HZ reaching forward to HF chord. */
export const ELEV_HINGE_X = fs(7.83);
export const EF = (z: number) => clamp((sLE(z) - ELEV_HINGE_X) / sC(z), 0.3, 0.9);
export const HZ = 1.47,
  HF = 0.18;
export const stab = liftingSurface({ le: sLE, chord: sC, y: () => SY, t: () => 0.085, m: 0 });
export const stabSec = stab.sec;

/* ---------- fin and rudder (rudder area ≈ 0.47 m²) ---------- */
// [height y, leading-edge FS, trailing-edge FS] — dorsal fillet from FS 6.28, straight LE swept ≈ 28°
const FIN_FS = [
  [-0.53, 7.3, 7.97],
  [-0.45, 7.05, 7.98],
  [-0.3, 6.28, 7.985],
  [-0.2, 6.5, 7.988],
  [-0.1, 6.66, 7.99],
  [0.0, 6.76, 7.992],
  [0.1, 6.83, 7.994],
  [0.3, 6.938, 7.996],
  [0.5, 7.046, 7.998],
  [0.665, 7.135, 8.0],
];
export const FIN = FIN_FS.map(([h, a, b]) => [h, fs(a), fs(b)]);
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
export const FIN_TOP = 0.665,
  RUD_BOT = -0.53;
/** Rudder hinge line: FS 7.40 at the bottom to FS 7.70 at the top (swept ≈ 14°, photos). */
export const hingeX = (h: number) => lerp(fs(7.4), fs(7.7), (h - RUD_BOT) / (FIN_TOP - RUD_BOT));
export const finCut = (h: number) => clamp((fLE(h) - hingeX(h)) / fC(h), 0.02, 0.98);
export const finSec = finSurface({ le: fLE, chord: fC, t: (h) => Math.min(0.12, 0.085 / Math.max(fC(h), 0.3)) }).sec;
export const finHs = [-0.3, -0.25, -0.2, -0.1, 0, 0.1, 0.3, 0.5, 0.6, FIN_TOP];
export const rudHs = [RUD_BOT, -0.49, -0.45, -0.38, -0.3, -0.2, -0.1, 0, 0.1, 0.3, 0.5, 0.6, FIN_TOP];

/* ---------- windows & painted skin ---------- */
export const WIN = {
  /** One-piece front canopy: everything above the glass line is transparent. */
  canopy: [
    [fs(1.41), 0.19],
    [fs(1.71), -0.0],
    [fs(2.7), 0.0],
    [fs(2.72), 0.08],
    [fs(2.72), 0.8],
    [fs(1.38), 0.8],
  ],
  /** Rear side window (in the left rear door; fixed on the right). */
  rear: roundPoly(
    [
      [fs(2.86), 0.0],
      [fs(2.86), 0.43],
      [fs(3.3), 0.41],
      [fs(3.6), 0.33],
      [fs(3.72), 0.22],
      [fs(3.71), 0.08],
      [fs(3.58), -0.01],
    ],
    0.22,
    2,
  ),
  /** Opening emergency / vent window in the left side of the canopy (AFM 7.8). */
  vent: roundPoly(
    [
      [fs(2.15), 0.08],
      [fs(2.15), 0.3],
      [fs(2.55), 0.32],
      [fs(2.6), 0.08],
    ],
    0.2,
    2,
  ),
};

/** Static outlines on the fixed skin: right rear window and the cowling / firewall seam. */
export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [densify(WIN.rear).map(([x, y]) => onSkin(x, y, 1))];
  loops.push(fRing(FW + 0.04, 1.004, 48));
  return loops;
}
/** Outlines that ride on the left rear door (world coordinates): its window and the door seam. */
export function doorOutlines(): THREE.Vector3[][] {
  const seam = roundPoly(
    [
      [DOOR.x0 - 0.01, SILL_Y + 0.01],
      [DOOR.x0 - 0.01, doorHingeY(DOOR.x0) - 0.01],
      [(DOOR.x0 + DOOR.x1) / 2, doorHingeY((DOOR.x0 + DOOR.x1) / 2) - 0.01],
      [DOOR.x1 + 0.01, doorHingeY(DOOR.x1) - 0.01],
      [DOOR.x1 + 0.01, SILL_Y + 0.01],
    ],
    0.06,
    1,
  );
  return [densify(WIN.rear).map(([x, y]) => onSkin(x, y, -1)), densify(seam).map(([x, y]) => onSkin(x, y, -1, 1.008))];
}
/** Outlines that ride on the canopy: the left emergency window. */
export const canopyOutlines = (): THREE.Vector3[][] => [densify(WIN.vent).map(([x, y]) => onSkin(x, y, -1, 1.01))];

/** Fuselage geometries merged for the fixed shell. */
export const fixedFuselageGeo = () => {
  const gs = fuselageGeos();
  const pos: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  let off = 0;
  gs.forEach((g) => {
    const p = g.attributes.position,
      u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(u.getX(i), u.getY(i));
      const n = g.attributes.normal;
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  });
  gs.forEach((g) => g.dispose());
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return cutCowlInlets(out, COWL_INLETS.da40);
};

/** Paints N949KC’s gray sweeping graphics, canopy and rear windows (browser only). */
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
  g.fillStyle = "#F4F6F7";
  g.fillRect(0, 0, SK.W, SK.H);
  drawLivery("da40", g, P);
  const glass = () => {
    const gr = g.createLinearGradient(0, P([0, 0.6])[1], 0, P([0, 0])[1]);
    gr.addColorStop(0, "#2E4252");
    gr.addColorStop(1, "#111A22");
    return gr;
  };
  path(WIN.canopy);
  g.fillStyle = glass();
  g.fill();
  path(WIN.rear);
  g.fillStyle = glass();
  g.fill();
  g.strokeStyle = "#0B1014";
  g.lineWidth = 3;
  g.stroke();
  // canopy frame line along the glass edge
  path(WIN.canopy.slice(0, 4), false);
  g.strokeStyle = "#0B1014";
  g.lineWidth = 3;
  g.stroke();
  return paintAtlas(c, P, liveryLabels("da40", "fuselage"));
}

export { V };

export const TAIL_PAINT_BOX = { x0: -4.9, x1: -3.0, y0: -0.6, y1: 0.75 };
export const paintTail = () => tailTexture("da40", TAIL_PAINT_BOX);
