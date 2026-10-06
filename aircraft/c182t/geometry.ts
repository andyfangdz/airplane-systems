/**
 * Airframe geometry for the Cessna 182T Skylane NAV III (Paramus Flying Club N8050J, s/n 18281633, and N21200,
 * s/n 18281732), built with the shared Cessna high-wing builder (aircraft/cessna/airframe.ts).
 *
 * Coordinates: x forward, y up, z toward the right wing, metres. Origin: FS 100 on the thrust line, on the centreline.
 *   x = (100 − FS) × 0.0254   — FS in inches aft of the POH datum ("front face of firewall", POH 2-8; Fig 6-1: "firewall,
 *                               front face, lower portion"); the firewall is at x = 2.54, the spinner tip (FS −64) at x = 4.17,
 *                               the rudder trailing edge (FS 284) at x = −4.67.
 *   y = (h − 50.375) × 0.0254 — h in inches above the ground in the normal ground attitude; y = 0 is the thrust line
 *                               (10 7/8 in propeller ground clearance + 39.5 in propeller radius, POH 1-4), so the ground is y = −1.280.
 *   z = BL × 0.0254.
 *
 * Checks against POH Figure 1-1: span 36'-0" (432 in with strobes: tip BL 213 + 3 in strobe lens), length 29'-0" (FS −64 → 284,
 * spinner-tip station scaled from the drawing), height 9'-4" (fin top h 109.6 + beacon), horizontal tail span 11'-8" (BL ±70),
 * track 9'-0" (main wheels BL ±54), wheelbase 66.5 in (nose axle FS −7.6, main axles FS 58.9 — POH 6-22), prop 79 in.
 * Wing: same planform family as the 172 (MAC 58.80 in, LEMAC FS 25.98 — POH 6-5): 64 in chord to BL 102.5 (chord break scaled
 * from the Fig 1-1 top view), tapering to 41.5 in at the tip with the leading edge 8.5 in aft; LE at FS 24 gives the POH LEMAC.
 * Dihedral (1°44′) and airfoil (NACA 2412) are web values, NOT IN the POH. Horizontal tail planform scaled from the Fig 1-1 top view
 * (root chord 48 in, LE FS 207 — the stabilizer abrasion boots are at arm 206.0, POH 6-24; straight hinge line; horn-balanced tips).
 * Fuselage heights, fin and window outlines are scaled from a side photo of N775CP (182T s/n 18281779, Wikimedia Commons), corrected
 * for the camera's view from below, and fitted to POH Fig 6-6 cabin heights (48 in floor to headliner); the POH side view is
 * schematic vertically. Cabin landmarks: panel face ≈ FS 17, forward doorpost ≈ FS 28, rear doorpost bulkhead FS 65.30 (POH 6-15).
 */
import * as THREE from "three";
import { cessnaAirframe, skinPainter, type CessnaSpec } from "../cessna/airframe";
import { densify, loft } from "@/lib/geometry";

export { box, cyl, sph, tubeGeo, loft, sided } from "@/lib/geometry";
export { taperTubeGeo, wheelFairingGeo } from "../cessna/airframe";

export const SPEC: CessnaSpec = {
  fsRef: 100, hRef: 50.375,
  // [FS, halfWidth, top h, bottom h] (in). A deep cowl with a pronounced chin (induction filter below the spinner), a slab-sided
  // cabin whose crown hides inside the wing centre section, and a tailcone that drops behind the fin root so the lower rudder clears it.
  fuselage: [
    [-44.6, 8.5, 55.6, 44.0], [-44.3, 12.2, 57.0, 40.0], [-43.6, 14.6, 58.0, 37.4], [-42.2, 16.2, 58.6, 35.6], [-39.5, 17.4, 59.1, 33.8],
    [-34, 18.6, 59.7, 31.6], [-26, 19.6, 60.3, 29.0], [-16, 20.5, 61.0, 26.0], [-6, 21.2, 61.7, 23.4], [0, 21.6, 62.2, 22.3],
    [4, 21.8, 63.0, 22.0], [10, 22.0, 64.6, 21.9], [16, 22.1, 67.6, 21.8], [20, 22.2, 71.2, 21.8], [24, 22.3, 76.8, 21.8], [26, 22.3, 79.4, 21.8],
    [28, 22.4, 80.4, 21.8], [32, 22.5, 80.9, 21.8], [44, 22.6, 81.6, 21.9], [60, 22.4, 81.6, 22.1], [75, 21.7, 81.0, 22.5],
    [84, 21.1, 80.3, 22.9], [89, 20.6, 80.0, 23.3], [95, 19.8, 77.3, 23.8], [100, 19.0, 74.8, 24.4], [112, 16.8, 69.8, 25.9],
    [124, 14.6, 66.6, 27.5], [145, 12.1, 65.1, 29.9], [170, 9.5, 64.7, 32.9], [195, 7.3, 64.3, 35.9], [220, 5.4, 63.4, 38.4],
    [234, 4.3, 62.3, 39.9], [240, 3.5, 58.0, 40.6], [246, 2.6, 50.5, 41.6], [252, 1.6, 47.6, 43.0], [258.5, 0.5, 46.2, 45.0],
  ],
  nTop: 6.5, nBot: 4.0, tumble: 0.05,
  wing: { le: 24, rootChord: 64, tipChord: 41.5, rootBL: 0, kinkBL: 102.5, tipBL: 213, leAft: 8.5, rootH: 80.6, dihedral: 1.73, t: [0.125, 0.115], m: 0.02 },
  // Fig 1-1 top view: straight leading edge swept ≈ 7 in over the half span, trailing edge coming forward ≈ 8 in, squared tips
  stab: { le: 207, leSweep: 0.097, te: 255.4, teSweep: -0.12, halfSpan: 70, tipStart: 66.5, h: 46, t: 0.1 },
  // Tall swept fin with a long dorsal fillet from FS ≈ 188 (N775CP photo): LE ≈ 39° from vertical above h 74
  fin: [
    [46.5, 239.5, 253.6], [61.8, 239.5, 261.1], [63.0, 182, 261.8], [64.3, 188, 262.4], [66.0, 206.6, 263.3], [69.5, 219, 265.0],
    [74.2, 228.3, 267.3], [85, 236.7, 272.6], [100, 248.4, 280.0], [106, 253.1, 283.0], [108.4, 256.0, 284.2], [109.6, 259.5, 283.6],
  ],
  rudderHinge: [[46.5, 240.5], [107, 271.5]],
  rudderBottom: 46.5,
};

export const AF = cessnaAirframe(SPEC);
export const {
  X, Y, Z, FS, H, groundY, P, skin, FUSE, fus, topY, botY, onSkin, fRing, inFus, planeRing, sectionSlab,
  wLE, wC, wY, wT, WING, wingP, wingSec, wingStations, wingLoft, kinkZ, tipZ, sLE, sC, SY, stabSec, stZ,
  fLE, fC, hingeX, finCut, finSec, strutGeo, springLegGeo, projectLoop, fuselageGeo, roundPoly,
} = AF;
export const GROUND_Y = groundY;

/** Wing stations (BL, in) for the shells and surfaces (Fig 1-1 top view, ±5%). */
export const BL = {
  /** Flap: from the fuselage side to the chord break. */
  flap0: 23.5, flap1: 102,
  /** Aileron: chord break → BL 208. */
  ail0: 104, ail1: 208,
};
/** Chord fractions of the flap cove and aileron hinge. */
export const FLAP_C = 0.68, AIL_C = 0.75;

/** Elevator hinge chord fraction (straight hinge at FS ≈ 234), horn-balance start BL and its LE chord fraction (Fig 1-1 top view). */
export const EF = 0.58, HZ = 62, HF = 0.3;

/* ---------- windows, doors (side outlines in [FS, h] inches) ---------- */
export const WIN = {
  /** Windshield side edge: from its base on the cowl deck (FS ≈ 4) back along the deck to the forward door post, then up the post
   *  to the wing root — the 182's windshield is longer than the 172's (N775CP photo). */
  windSide: [[4, 63.0], [14, 63.7], [27, 64.4], [28.6, 77.0]],
  doorWin: AF.roundPoly([[33.4, 69.8], [32.4, 52.6], [63.0, 52.2], [63.8, 69.4]], 0.12),
  /** Fixed rear side window: vertical front edge at the rear door post, teardrop pointing aft under the wing trailing edge. */
  rearSide: AF.roundPoly([[67.6, 69.6], [67.4, 53.2], [94.5, 57.0], [99.0, 63.0], [96.5, 68.6]], 0.16),
  /** Wraparound rear window, side portion (the roof portion is a separate conformal mesh, `rearRoofGeo`). */
  rearWrap: AF.roundPoly([[101.0, 71.4], [101.2, 63.0], [118.5, 65.4]], 0.18),
  /** Lower edge of the roof portion of the rear window on each side, [FS, h]: from under the wing trailing edge down aft. */
  rearRoof: [[89.5, 79.4], [101, 71.4], [110, 67.6], [118.5, 66.0], [122, 66.3]],
  /** Cabin door outline (opening 32–36.5 in wide, 41/38.5 in high — POH Fig 6-6). */
  door: AF.roundPoly([[30.6, 76.4], [29.6, 26.8], [64.8, 26.5], [65.4, 75.8]], 0.06, 1),
  /** Baggage door, left side only: 15.75 in wide, 22.0 in high at the front and 20.5 at the rear (POH Fig 6-6). */
  bagDoor: AF.roundPoly([[95.0, 49.5], [95.0, 27.8], [110.8, 28.4], [110.8, 48.0]], 0.08, 1),
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

/** Roof portion of the wraparound rear window: a glass skin conforming to the tailcone top between the `rearRoof` edges. */
export function rearRoofGeo() {
  const pts = WIN.rearRoof, secs: THREE.Vector3[][] = [];
  const edgeH = (fs: number) => { let i = 0; while (i < pts.length - 2 && fs > pts[i + 1][0]) i++; const [f0, h0] = pts[i], [f1, h1] = pts[i + 1]; return h0 + ((h1 - h0) * (fs - f0)) / (f1 - f0); };
  const f0 = pts[0][0], f1 = pts[pts.length - 1][0];
  for (let k = 0; k <= 24; k++) {
    const fs = f0 + ((f1 - f0) * k) / 24, x = X(fs), th = FUSE.thetaAt(x, Y(edgeH(fs)));
    // 1 % proud of the skin: closer than that and the skin z-fights through it at overview distances
    secs.push(fRing(x, 1.01, 24, th, Math.PI - th, false));
  }
  return loft(secs.reverse(), { closed: false, caps: false }); // aft → forward: faces outward
}

/** Neutral livery: white with a navy band and a thin warm-grey accent sweeping up from the cowl chin; glass painted on. No markings. */
export function paintSkin(): THREE.CanvasTexture {
  const p = skinPainter(AF, 2048, 512), { g, path } = p;
  g.fillStyle = "#F4F6F7"; g.fillRect(0, 0, p.W, p.H);
  // cowl seams and access doors (oil door on the left-centre upper cowl, POH 7-34)
  g.strokeStyle = "#B4BCC2"; g.lineWidth = 2;
  path([[-1.5, 63], [-1.5, 22]], false); g.stroke();
  path([[-40, 48], [-6, 47.5]], false); g.stroke();
  path([[-30, 59.5], [-14, 60], [-14, 54], [-30, 53.5]]); g.stroke();
  // band: navy, sweeping up from under the spinner to the tailcone
  path([[-43, 43.5], [-30, 41.0], [-10, 40.0], [20, 40.0], [60, 41.0], [110, 44.0], [170, 48.2], [220, 51.0], [258, 52.6],
    [258, 49.4], [220, 47.8], [170, 44.8], [110, 40.4], [60, 37.2], [20, 36.0], [-10, 36.2], [-30, 37.2], [-43, 39.6]]);
  g.fillStyle = "#2E4766"; g.fill();
  path([[-40, 34.0], [-10, 32.6], [20, 32.4], [60, 33.6], [110, 37.0], [170, 41.6], [220, 45.0], [258, 46.6]], false);
  g.strokeStyle = "#A8A196"; g.lineWidth = 5; g.stroke();
  // windshield: everything above the deck line between its base and the forward door posts
  path([...WIN.windSide, [28.6, 86], [4, 86]]); g.fillStyle = p.glass(80, 63); g.fill();
  [WIN.doorWin, WIN.rearSide, WIN.rearWrap].forEach((w) => { path(w); g.fillStyle = p.glass(70, 53); g.fill(); g.strokeStyle = "#0B1014"; g.lineWidth = 3; g.stroke(); });
  // door seams (both sides share the projection) and the recessed outside handle near the door's aft edge
  path(WIN.door); g.strokeStyle = "#9DA6AD"; g.lineWidth = 2; g.stroke();
  path([[58, 49.0], [62.6, 49.0], [62.6, 47.6], [58, 47.6]]); g.fillStyle = "#5C666E"; g.fill();
  return p.done();
}
