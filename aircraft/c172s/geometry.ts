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
import { densify } from "@/lib/geometry";

export { box, cyl, sph, tubeGeo, pantGeo, loft, af, sided } from "@/lib/geometry";

export const SPEC: CessnaSpec = {
  fsRef: 100, hRef: 49.25,
  // [FS, halfWidth, top h, bottom h] (in)
  fuselage: [
    [-38.6, 8.5, 56.5, 41.5], [-37, 12.5, 58.6, 35.5], [-34, 15.4, 60.4, 32.0], [-29, 17.4, 62.0, 29.4], [-21, 18.9, 63.4, 27.2],
    [-11, 19.8, 64.3, 25.6], [0, 20.4, 65.0, 24.6], [8, 20.8, 65.9, 24.1], [14, 21.0, 67.6, 23.8], [20, 21.2, 70.6, 23.6],
    [26, 21.3, 74.4, 23.5], [32, 21.4, 77.3, 23.4], [44, 21.5, 77.8, 23.3], [60, 21.3, 77.8, 23.4], [75, 20.6, 77.6, 23.8],
    [88, 19.6, 76.6, 24.5], [100, 17.9, 72.2, 25.6], [112, 15.7, 67.4, 27.0], [124, 13.5, 64.0, 28.6], [145, 11.0, 63.0, 31.0],
    [170, 8.6, 62.0, 34.0], [195, 6.6, 61.0, 37.0], [220, 4.9, 60.0, 40.0], [240, 3.5, 59.4, 42.2], [252, 2.0, 59.0, 44.0], [257, 0.7, 58.6, 45.6],
  ],
  nTop: 3.2, nBot: 3.6, tumble: 0.22,
  wing: { le: 25, rootChord: 64, tipChord: 44.5, rootBL: 0, kinkBL: 100, tipBL: 213.5, leAft: 4, rootH: 80.2, dihedral: 1.73, t: [0.125, 0.115], m: 0.02 },
  stab: { le: 210, leSweep: 0.06, te: 252, halfSpan: 68, tipStart: 58, h: 43, t: 0.1 },
  fin: [
    [44, 251, 268], [59, 249, 271], [60, 200, 271.3], [61.5, 211, 271.8], [64, 215.5, 272.5], [70, 221.5, 274],
    [85, 236, 276.5], [100, 249.5, 278.6], [103, 252.5, 279], [104.4, 257, 278],
  ],
  rudderHinge: [[44, 254], [103, 263]],
  rudderBottom: 44.5,
};

export const AF = cessnaAirframe(SPEC);
export const {
  X, Y, Z, FS, H, groundY, P, skin, FUSE, fus, topY, botY, onSkin, fRing, inFus, planeRing, sectionSlab,
  wLE, wC, wY, wT, WING, wingP, wingSec, wingStations, wingLoft, kinkZ, tipZ, sLE, sC, SY, stabSec, stZ,
  fLE, fC, hingeX, finCut, finSec, strutGeo, springLegGeo, projectLoop, fuselageGeo, roundPoly,
} = AF;
export const GROUND_Y = groundY;
export const FW = X(0);

/** Wing stations (BL, in) used for the shells and surfaces. */
export const BL = {
  /** Flap: from the fuselage side to the kink (Fig 1-1 scale, ±5%). */
  flap0: 21.5, flap1: 99,
  /** Aileron: BL 105 → 207 (≈ 107 in long). */
  ail0: 105, ail1: 207,
};
/** Chord fractions of the flap cove and aileron hinge. */
export const FLAP_C = 0.7, AIL_C = 0.75;

/** Elevator hinge chord fraction and horn-balance tip. */
export const EF = 0.6, HZ = 60, HF = 0.14;

/* ---------- windows, doors (side outlines in [FS, h] inches) ---------- */
export const WIN = {
  /** Windshield side edge: cowl deck → A-pillar meets the roof under the wing LE. */
  windSide: [[15.5, 66.9], [24, 71.4], [31.5, 76.6]],
  doorWin: AF.roundPoly([[34.2, 73.4], [33.0, 56.2], [61.6, 55.8], [62.8, 73.0]], 0.12),
  rearSide: AF.roundPoly([[68.6, 73.0], [68.4, 56.2], [94.0, 58.6], [97.0, 65.5], [95.6, 71.0]], 0.16),
  /** Omni-Vision rear window, side portion (the rest wraps over the roof). */
  rearWrap: AF.roundPoly([[100.5, 70.6], [100.6, 61.0], [117.5, 63.0]], 0.18),
  door: AF.roundPoly([[31.8, 76.3], [30.2, 28.5], [64.6, 28.2], [65.3, 75.6]], 0.06, 1),
  /** Baggage door, left side only (15.25 × 22 in, POH Fig 6-6). */
  bagDoor: AF.roundPoly([[95.2, 52.4], [95.2, 30.6], [110.4, 30.9], [110.4, 51.8]], 0.08, 1),
};

/** Window / door outline loops projected onto the skin (WindowOutlines). */
export function windowOutlines(): THREE.Vector3[][] {
  const loops: THREE.Vector3[][] = [];
  [1, -1].forEach((s) => [WIN.doorWin, WIN.rearSide, WIN.rearWrap, WIN.door].forEach((w) => loops.push(projectLoop(w, s))));
  loops.push(projectLoop(WIN.bagDoor, -1));
  // windshield: both side edges joined across the roof (under the wing LE) and across the cowl deck
  const side = (s: number) => densify(WIN.windSide.map(([fs, h]) => [X(fs), Y(h)]), 0.03, false).map(([x, y]) => onSkin(x, y, s));
  const a = WIN.windSide[WIN.windSide.length - 1], b = WIN.windSide[0];
  const ta = FUSE.thetaAt(X(a[0]), Y(a[1])), tb = FUSE.thetaAt(X(b[0]), Y(b[1]));
  loops.push([...side(1), ...fRing(X(a[0]), 1.006, 40, ta, Math.PI - ta, false), ...side(-1).reverse(), ...fRing(X(b[0]), 1.006, 40, Math.PI - tb, tb, false)]);
  return loops;
}

/** Neutral livery: white with a slate stripe sweeping up the cowl; glass painted where the windows are. No markings. */
export function paintSkin(): THREE.CanvasTexture {
  const p = skinPainter(AF, 2048, 512), { g, path } = p;
  g.fillStyle = "#F4F6F7"; g.fillRect(0, 0, p.W, p.H);
  // cowl seam and access doors
  g.strokeStyle = "#B4BCC2"; g.lineWidth = 2;
  path([[-1.5, 66], [-1.5, 24]], false); g.stroke();
  path([[-30, 58], [-12, 58.5], [-12, 52], [-30, 52]]); g.stroke();
  // stripe: slate band with a thin accent, sweeping up toward the spinner
  path([[-36, 47.5], [-20, 46.5], [0, 45.2], [30, 44.6], [70, 45.2], [120, 47.6], [180, 51.0], [230, 54.0], [258, 55.4], [258, 52.4], [230, 51.2], [180, 48.0], [120, 44.6], [70, 42.0], [30, 41.4], [0, 42.0], [-20, 43.4], [-36, 44.6]]);
  g.fillStyle = "#3E5468"; g.fill();
  path([[-34, 41.6], [0, 39.6], [30, 39.0], [70, 39.6], [120, 42.2], [180, 45.8], [230, 49.2], [258, 50.6]], false);
  g.strokeStyle = "#8EA2B2"; g.lineWidth = 5; g.stroke();
  // windshield (wraps over the deck) and rear window (wraps over the roof behind the wing)
  path([[13.5, 66.6], [15.5, 66.9], [24, 71.4], [31.5, 76.6], [31.5, 84], [10, 84], [10, 67]]); g.fillStyle = p.glass(80, 66); g.fill();
  path([[88, 82], [88, 76.0], [98, 72.6], [110, 67.8], [121.5, 64.4], [121.5, 70], [104, 80]]); g.fillStyle = p.glass(78, 64); g.fill();
  [WIN.doorWin, WIN.rearSide, WIN.rearWrap].forEach((w) => { path(w); g.fillStyle = p.glass(73, 56); g.fill(); g.strokeStyle = "#0B1014"; g.lineWidth = 3; g.stroke(); });
  // door seams (both sides share the projection) and the recessed handle near the aft edge
  path(WIN.door); g.strokeStyle = "#9DA6AD"; g.lineWidth = 2; g.stroke();
  path([[58, 51.5], [62.5, 51.5], [62.5, 50.2], [58, 50.2]]); g.fillStyle = "#5C666E"; g.fill();
  return p.done();
}
