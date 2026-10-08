import { COWL_INLETS } from "../cowl-inlets";
import { drawLivery, liveryLabels, tailTexture } from "../liveries";
import { paintAtlas } from "@/lib/livery";
/**
 * Airframe geometry for the Cessna 172S NAV III (N6189Q, s/n 172S10738), built with the shared
 * Cessna high-wing builder (aircraft/cessna/airframe.ts).
 *
 * Coordinates: x forward, y up, z toward the right wing, metres.
 *   x = (100 − FS) × 0.0254   — FS in inches aft of the POH datum ("lower portion of front face of firewall", POH 2-9);
 *                               the firewall is at x = 2.54, the spinner tip (FS −47) at x = 3.73, the rudder (FS 279) at x = −4.55.
 *   y = (h − 49.25) × 0.0254  — h in inches above the ground in the normal ground attitude; y = 0 is the thrust line
 *                               (11.25 in prop clearance + 38 in prop radius, POH 1-4), so the ground is y = −1.251.
 *   z = BL × 0.0254.
 *
 * Checks against POH Figure 1-1: span 36'-1" (433 in with strobes: wing tip BL 213.5 + 3 in strobe lens),
 * length 27'-2" (FS −47 → 279), height 8'-11" max (fin top h 104 + beacon), horizontal tail span 11'-4"
 * (BL ±68), wheelbase 65.0 in (nose axle FS −6.8, main axles FS 58.2 — POH 6-21), prop 76 in.
 * Wing: 64 in constant chord to BL 100, tapering to 44.5 in at the tip (Jane's, via the research sheet),
 * LE at FS 25 (LEMAC FS 25.90, MAC 58.8 in — POH 6-5), dihedral 1°44', NACA 2412.
 * Fuselage heights come from POH Figure 6-6 cabin heights and a side photo of a 172S
 * (N793SP, Wikimedia Commons); the POH side view is not to scale vertically (research note).
 */
import * as THREE from "three";
import { cessnaAirframe, skinPainter, type CessnaSpec } from "../cessna/airframe";
import { densify, loft } from "@/lib/geometry";

export { box, cyl, sph, tubeGeo, loft, sided } from "@/lib/geometry";
export { taperTubeGeo, wheelFairingGeo } from "../cessna/airframe";

export const SPEC: CessnaSpec = {
  cowlInlets: COWL_INLETS.c172s,
  fsRef: 100,
  hRef: 49.25,
  // [FS, halfWidth, top h, bottom h] (in)
  // Blunt nose bowl round the spinner (face ≈ FS −33, h 28–61, N793SP photo); slab-sided cabin whose crown hides inside the
  // wing centre section (wing lower surface ≈ h 77.5–80 at the root), so the sides run nearly straight up to the wing root.
  fuselage: [
    [-37.6, 8.5, 56.5, 41.5],
    [-37.3, 12.4, 58.0, 37.5],
    [-36.6, 14.6, 59.6, 32.5],
    [-35.3, 16.0, 60.4, 29.5],
    [-33, 17.0, 61.0, 28.0],
    [-29, 18.3, 62.0, 27.6],
    [-21, 19.5, 63.4, 26.6],
    [-11, 20.0, 64.3, 25.4],
    [0, 20.4, 65.0, 24.6],
    [8, 20.8, 65.9, 24.1],
    [14, 21.0, 67.6, 23.8],
    [20, 21.2, 71.6, 23.6],
    [24, 21.3, 77.0, 23.5],
    [26, 21.3, 79.4, 23.5],
    [28, 21.4, 80.2, 23.4],
    [32, 21.4, 80.6, 23.4],
    [44, 21.5, 81.4, 23.3],
    [60, 21.3, 81.4, 23.4],
    [75, 20.6, 80.8, 23.8],
    [84, 20.0, 80.0, 24.2],
    [89, 19.5, 79.9, 24.6],
    [95, 18.7, 76.8, 25.0],
    [100, 17.9, 74.2, 25.6],
    [112, 15.7, 68.6, 27.0],
    [124, 13.5, 64.4, 28.6],
    [145, 11.0, 63.0, 31.0],
    // the tailcone top drops behind the fin root so the lower rudder (behind its raked hinge) stands clear of it
    [170, 8.6, 62.0, 34.0],
    [195, 6.6, 61.0, 37.0],
    [220, 4.9, 60.0, 40.0],
    [236, 3.8, 59.3, 41.8],
    [246, 2.6, 55.0, 43.0],
    [252, 1.8, 51.5, 44.0],
    [257, 0.7, 48.5, 45.6],
  ],
  nTop: 6.5,
  nBot: 4.2,
  tumble: 0.05,
  wing: {
    le: 25,
    rootChord: 64,
    tipChord: 44.5,
    rootBL: 0,
    kinkBL: 100,
    tipBL: 213.5,
    leAft: 4,
    rootH: 80.2,
    dihedral: 1.73,
    t: [0.125, 0.115],
    m: 0.02,
  },
  // Tapered planform from the POH Figure 1-1 top view: root ≈ FS 201–251 (50 in), tip ≈ 215–241, span 136 in
  stab: { le: 201, leSweep: 0.22, te: 251, teSweep: -0.15, halfSpan: 68, tipStart: 58, h: 43, t: 0.1 },
  // Raked fin and rudder (POH Figure 1-1 side view, D-EDDH photo): the hinge leans ≈ 27 in aft over the rudder's height and the
  // trailing edge ≈ 21 in, so the rudder is ≈ 20 in chord at the bottom and ≈ 14 in at the top
  fin: [
    [44, 236, 258],
    [59, 236, 262],
    [60, 200, 262.3],
    [61.5, 211, 262.7],
    [64, 215.5, 263.6],
    [70, 221.5, 266],
    [85, 236, 271],
    [100, 249.5, 277],
    [103, 252.5, 279],
    [104.4, 257, 278],
  ],
  rudderHinge: [
    [44, 238],
    [103, 265],
  ],
  rudderBottom: 44.5,
};

export const AF = cessnaAirframe(SPEC);
export const {
  X,
  Y,
  Z,
  FS,
  H,
  groundY,
  P,
  skin,
  FUSE,
  fus,
  topY,
  botY,
  onSkin,
  fRing,
  inFus,
  planeRing,
  sectionSlab,
  wLE,
  wC,
  wY,
  wT,
  WING,
  wingP,
  wingSec,
  wingStations,
  wingLoft,
  kinkZ,
  tipZ,
  sLE,
  sC,
  SY,
  stabSec,
  stZ,
  fLE,
  fC,
  hingeX,
  finCut,
  finSec,
  strutGeo,
  springLegGeo,
  projectLoop,
  fuselageGeo,
  roundPoly,
} = AF;
export const GROUND_Y = groundY;

/** Wing stations (BL, in) used for the shells and surfaces. */
export const BL = {
  /** Flap: from the fuselage side to the kink (Fig 1-1 scale, ±5%). */
  flap0: 21.5,
  flap1: 99,
  /** Aileron: BL 105 → 207 (≈ 107 in long). */
  ail0: 105,
  ail1: 207,
};
/** Chord fractions of the flap cove and aileron hinge. */
export const FLAP_C = 0.7,
  AIL_C = 0.75;

/** Elevator hinge chord fraction and horn-balance tip. */
export const EF = 0.6,
  HZ = 60,
  HF = 0.14;

/* ---------- windows, doors (side outlines in [FS, h] inches) ---------- */
export const WIN = {
  /** Windshield side edge: along the cowl deck line from the windshield base back to the forward door post, then up the
   *  near-vertical post to the wing root — the glass runs post to post (N793SP and D-EDDH photos). */
  windSide: [
    [13, 64.8],
    [22, 65.0],
    [30.5, 65.4],
    [31.5, 77.5],
  ],
  doorWin: AF.roundPoly(
    [
      [34.2, 73.4],
      [33.0, 56.2],
      [61.6, 55.8],
      [62.8, 73.0],
    ],
    0.12,
  ),
  rearSide: AF.roundPoly(
    [
      [68.6, 73.0],
      [68.4, 56.2],
      [94.0, 58.6],
      [97.0, 65.5],
      [95.6, 71.0],
    ],
    0.16,
  ),
  /** Omni-Vision rear window, side portion (the roof portion is a separate conformal mesh, `rearRoofGeo`). */
  rearWrap: AF.roundPoly(
    [
      [100.5, 70.6],
      [100.6, 61.0],
      [117.5, 63.0],
    ],
    0.18,
  ),
  /** Lower edge of the roof portion of the rear window on each side, [FS, h]: from under the wing trailing edge down aft. */
  rearRoof: [
    [89.5, 77.6],
    [100.5, 70.6],
    [110, 66.2],
    [117.5, 64.6],
    [121, 65.4],
  ],
  door: AF.roundPoly(
    [
      [31.8, 76.3],
      [30.2, 28.5],
      [64.6, 28.2],
      [65.3, 75.6],
    ],
    0.06,
    1,
  ),
  /** Baggage door, left side only (15.25 × 22 in, POH Fig 6-6). */
  bagDoor: AF.roundPoly(
    [
      [95.2, 52.4],
      [95.2, 30.6],
      [110.4, 30.9],
      [110.4, 51.8],
    ],
    0.08,
    1,
  ),
};

/** Window / door outline loops projected onto the skin (WindowOutlines). */
export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [];
  [1, -1].forEach((s) =>
    [WIN.doorWin, WIN.rearSide, WIN.rearWrap, WIN.door].forEach((w) => loops.push(projectLoop(w, s))),
  );
  loops.push(projectLoop(WIN.bagDoor, -1));
  // windshield: both side edges joined across the roof (under the wing LE) and across the cowl deck
  const side = (s: number) =>
    densify(
      WIN.windSide.map(([fs, h]) => [X(fs), Y(h)]),
      0.03,
      false,
    ).map(([x, y]) => onSkin(x, y, s));
  const a = WIN.windSide[WIN.windSide.length - 1],
    b = WIN.windSide[0];
  const ta = FUSE.thetaAt(X(a[0]), Y(a[1])),
    tb = FUSE.thetaAt(X(b[0]), Y(b[1]));
  loops.push([
    ...side(1),
    ...fRing(X(a[0]), 1.006, 40, ta, Math.PI - ta, false),
    ...side(-1).reverse(),
    ...fRing(X(b[0]), 1.006, 40, Math.PI - tb, tb, false),
  ]);
  return loops;
}

/** Roof portion of the Omni-Vision rear window: a glass skin conforming to the tailcone top between the `rearRoof` edges
 *  (painting it through the side-projected texture smears it across the roof). */
export function rearRoofGeo() {
  const pts = WIN.rearRoof,
    secs: THREE.Vector3[][] = [];
  const edgeH = (fs: number) => {
    let i = 0;
    while (i < pts.length - 2 && fs > pts[i + 1][0]) i++;
    const [f0, h0] = pts[i],
      [f1, h1] = pts[i + 1];
    return h0 + ((h1 - h0) * (fs - f0)) / (f1 - f0);
  };
  const f0 = pts[0][0],
    f1 = pts[pts.length - 1][0];
  for (let k = 0; k <= 24; k++) {
    const fs = f0 + ((f1 - f0) * k) / 24,
      x = X(fs),
      th = FUSE.thetaAt(x, Y(edgeH(fs)));
    secs.push(fRing(x, 1.004, 24, th, Math.PI - th, false));
  }
  return loft(secs.reverse(), { closed: false, caps: false }); // aft → forward: faces outward
}

/** Paints N6189Q’s burgundy/gold livery and tinted windows (browser only). */
export function paintSkin(): THREE.CanvasTexture {
  const p = skinPainter(AF, 2048, 512),
    { g, path } = p;
  g.fillStyle = "#F4F6F7";
  g.fillRect(0, 0, p.W, p.H);
  // cowl seam and access doors
  g.strokeStyle = "#B4BCC2";
  g.lineWidth = 2;
  path(
    [
      [-1.5, 66],
      [-1.5, 24],
    ],
    false,
  );
  g.stroke();
  path([
    [-30, 58],
    [-12, 58.5],
    [-12, 52],
    [-30, 52],
  ]);
  g.stroke();
  drawLivery("c172s", g, p.P);
  // windshield (wraps over the deck) and rear window (wraps over the roof behind the wing)
  // windshield: everything above the deck line between its base (FS 13) and the forward door posts
  path([...WIN.windSide, [31.5, 86], [13, 86]]);
  g.fillStyle = p.glass(80, 65);
  g.fill();
  [WIN.doorWin, WIN.rearSide, WIN.rearWrap].forEach((w) => {
    path(w);
    g.fillStyle = p.glass(73, 56);
    g.fill();
    g.strokeStyle = "#0B1014";
    g.lineWidth = 3;
    g.stroke();
  });
  // door seams (both sides share the projection) and the recessed handle near the aft edge
  path(WIN.door);
  g.strokeStyle = "#9DA6AD";
  g.lineWidth = 2;
  g.stroke();
  path([
    [58, 51.5],
    [62.5, 51.5],
    [62.5, 50.2],
    [58, 50.2],
  ]);
  g.fillStyle = "#5C666E";
  g.fill();
  return paintAtlas(p.c, p.P, liveryLabels("c172s", "fuselage"));
}

export const TAIL_PAINT_BOX = { x0: X(285), x1: X(190), y0: Y(40), y1: Y(112) };
export const paintTail = () => tailTexture("c172s", TAIL_PAINT_BOX, ([fs, h]) => [X(fs), Y(h)]);
