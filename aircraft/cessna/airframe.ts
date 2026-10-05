/**
 * Strut-braced high-wing airframe builder shared by the Cessna NAV III singles (172S, 182T).
 *
 * Everything is specified the way the POH gives it: fuselage stations (FS, inches aft of the
 * firewall datum), butt lines (BL, inches right of centre) and heights above the ground in the
 * normal ground attitude (inches). The builder converts to scene metres:
 *
 *   x = (fsRef − FS) × 0.0254   (x forward)
 *   y = (h − hRef) × 0.0254     (y up; hRef = height of the thrust line, so the prop hub is y = 0)
 *   z = BL × 0.0254             (z toward the right wing)
 *
 * It returns the fuselage loft (lib/geometry `fuselage()`), wing, horizontal tail and fin functions
 * (`liftingSurface()` / `finSurface()`), and a few Cessna-specific helpers (streamlined wing strut,
 * spring-steel gear leg, window projection and a skin painter).
 */
import * as THREE from "three";
import { densify, finSurface, fuselage, liftingSurface, loft, mergeGeos, roundPoly, sided, type Ring } from "@/lib/geometry";
import { V, clamp, lerp, type Vec3 } from "@/lib/math";

export const IN = 0.0254;

export interface CessnaSpec {
  /** FS (in) placed at x = 0, and the height (in, above ground) of y = 0 (thrust line). */
  fsRef: number; hRef: number;
  /** Fuselage rows [FS, halfWidth, top h, bottom h] in inches, nose first (ascending FS). */
  fuselage: number[][];
  /** Superellipse exponents (upper/lower half) and roof tumblehome. */
  nTop: number; nBot: number; tumble: number;
  wing: {
    /** FS of the inboard leading edge, inboard (constant) chord and tip chord (in). */
    le: number; rootChord: number; tipChord: number;
    /** BL where the root rib meets the cabin, where the taper starts, and of the tip (in). */
    rootBL: number; kinkBL: number; tipBL: number;
    /** How far (in) the leading edge moves aft between the kink and the tip. */
    leAft: number;
    /** Chord-line height (in AGL) at the root and dihedral (deg). */
    rootH: number; dihedral: number;
    /** Thickness/chord at root and tip, camber. */
    t: [number, number]; m: number;
  };
  stab: {
    /** LE FS at the centreline and its sweep (in of FS per in of BL); TE FS at the centreline and its sweep (negative = the
     *  trailing edge comes forward toward the tips, giving the tapered planform). */
    le: number; leSweep: number; te: number; teSweep?: number;
    /** Half span and where the rounded tip starts (in); chord-line height (in AGL); t/c. */
    halfSpan: number; tipStart: number; h: number; t: number;
  };
  /** Fin rows [h AGL, LE FS, TE FS] from the dorsal fillet up to the top (in). */
  fin: number[][];
  /** Rudder hinge line: two points [h AGL, FS] (in). */
  rudderHinge: [[number, number], [number, number]];
  /** Below this height the fin "TE" belongs to the rudder (rudder extends to the tailcone). */
  rudderBottom: number;
}

export function cessnaAirframe(S: CessnaSpec) {
  const X = (fs: number) => (S.fsRef - fs) * IN;
  const Y = (h: number) => (h - S.hRef) * IN;
  const Z = (bl: number) => bl * IN;
  const FS = (x: number) => S.fsRef - x / IN;
  const H = (y: number) => y / IN + S.hRef;
  const groundY = Y(0);

  /* ---------- fuselage ---------- */
  const table = S.fuselage.map(([fs, hw, top, bot]) => [X(fs), hw * IN, ((top - bot) / 2) * IN, Y((top + bot) / 2)]);
  const FUSE = fuselage({ table, nTop: S.nTop, nBot: S.nBot, tumble: S.tumble });

  /* ---------- wing ---------- */
  const W = S.wing;
  const rootZ = Z(W.rootBL), kinkZ = Z(W.kinkBL), tipZ = Z(W.tipBL);
  const out = (z: number) => clamp((Math.abs(z) - kinkZ) / (tipZ - kinkZ), 0, 1);
  // conical-camber tip: the last ~4 in round off from both edges
  const tipRound = (z: number) => { const a = Math.abs(z), r = tipZ - Z(4); return a > r ? Math.pow((a - r) / (tipZ - r), 2) : 0; };
  const wC0 = (z: number) => lerp(W.rootChord, W.tipChord, out(z)) * IN;
  const wLE = (z: number) => X(W.le + W.leAft * out(z)) - wC0(z) * 0.18 * tipRound(z);
  const wC = (z: number) => wC0(z) * (1 - 0.55 * tipRound(z));
  const tanD = Math.tan((W.dihedral * Math.PI) / 180);
  const wY = (z: number) => Y(W.rootH) + (Math.abs(z) - rootZ) * tanD;
  const wT = (z: number) => lerp(W.t[0], W.t[1], clamp((Math.abs(z) - rootZ) / (tipZ - rootZ), 0, 1)) * (1 - 0.5 * tipRound(z));
  const WING = liftingSurface({ le: wLE, chord: wC, y: wY, t: wT, m: W.m });

  /* ---------- horizontal tail ---------- */
  const T = S.stab;
  const stZ = Z(T.halfSpan), stR = Z(T.tipStart);
  const sRound = (z: number) => { const a = Math.abs(z); return a > stR ? Math.pow((a - stR) / (stZ - stR), 2) : 0; };
  const sLE0 = (z: number) => X(T.le + T.leSweep * Math.abs(z) / IN);
  const sTE0 = (z: number) => X(T.te + (T.teSweep ?? 0) * Math.abs(z) / IN);
  // rounded/raked tip: the LE comes aft faster than the TE comes forward
  const sLE = (z: number) => sLE0(z) - (sLE0(z) - sTE0(z)) * 0.42 * sRound(z);
  const sC = (z: number) => (sLE0(z) - sTE0(z)) * (1 - 0.62 * sRound(z));
  const SY = Y(T.h);
  const STAB = liftingSurface({ le: sLE, chord: sC, y: () => SY, t: () => T.t, m: 0 });

  /* ---------- fin + rudder ---------- */
  const FIN = S.fin.map(([h, le, te]) => [Y(h), X(le), X(te)]);
  const finAt = (y: number) => {
    let i = 0;
    while (i < FIN.length - 2 && y > FIN[i + 1][0]) i++;
    const [h0, a0, b0] = FIN[i], [h1, a1, b1] = FIN[i + 1], t = clamp((y - h0) / (h1 - h0), 0, 1);
    return [lerp(a0, a1, t), lerp(b0, b1, t)];
  };
  const fLE = (y: number) => finAt(y)[0];
  const fC = (y: number) => finAt(y)[0] - finAt(y)[1];
  const [[ha, fa], [hb, fb]] = S.rudderHinge;
  const hingeX = (y: number) => lerp(X(fa), X(fb), (y - Y(ha)) / (Y(hb) - Y(ha)));
  /** Chord fraction of the rudder hinge at height y (1 = no rudder at this height). */
  const finCut = (y: number) => (y < Y(S.rudderBottom) ? 1 : clamp((fLE(y) - hingeX(y)) / fC(y), 0.02, 1));
  const FINS = finSurface({ le: fLE, chord: fC, t: (y) => Math.min(0.12, 0.09 / Math.max(fC(y), 0.3)) });

  /* ---------- helpers ---------- */
  const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
  /** Point on the fuselage side skin at FS / height (in), side ±1. */
  const skin = (fs: number, h: number, side: number, push = 1.006) => FUSE.onSkin(X(fs), Y(h), side, push);

  /** Streamlined (teardrop-section) strut from a to b; `chord` and `thick` in metres, chord aligned with x. */
  function strutGeo(a: Vec3, b: Vec3, chord = 0.15, thick = 0.042, n = 14) {
    const A = V(...a), B = V(...b), secs: Ring[] = [];
    for (let k = 0; k <= 6; k++) {
      const c = A.clone().lerp(B, k / 6), r: Ring = [];
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2, u = (1 - Math.cos(th)) / 2; // 0 at LE → 1 at TE
        const half = (thick / 2) * Math.sqrt(Math.max(0, u * (1 - u)) * 4) * (1 - 0.35 * u);
        r.push(V(c.x + chord * 0.35 - u * chord, c.y, c.z + Math.sign(Math.sin(th)) * half));
      }
      secs.push(r);
    }
    return loft(secs);
  }

  /** Flat tapered spring-steel gear leg (width × thickness tapering toward the axle), a → b. */
  function springLegGeo(a: Vec3, b: Vec3, w0 = 0.075, w1 = 0.05, t0 = 0.03, t1 = 0.022) {
    const A = V(...a), B = V(...b), d = B.clone().sub(A).normalize();
    const side = V(1, 0, 0).cross(d).normalize(), fwd = d.clone().cross(side).normalize();
    const secs: Ring[] = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4, c = A.clone().lerp(B, u), w = lerp(w0, w1, u) / 2, t = lerp(t0, t1, u) / 2;
      secs.push([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => c.clone().addScaledVector(fwd, i * w).addScaledVector(side, j * t)));
    }
    return loft(secs);
  }

  /** Wing shells: inboard (root → kink) and outboard panels as two lofts, split at chord fractions. */
  const wingStations = (z0: number, z1: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lerp(z0, z1, i / n));
  const wingLoft = (s: number, zs: number[], c0: number, c1: number, scale = 1) =>
    loft(sided(zs.map((z) => WING.sec(s * z, c0, c1, scale)), s));

  /** Window outline (list of [FS, h] in inches) projected onto both sides of the skin. */
  const projectLoop = (pts: number[][], side: number, step = 0.03) =>
    densify(pts.map(([fs, h]) => [X(fs), Y(h)]), step).map(([x, y]) => FUSE.onSkin(x, y, side));

  /** Fuselage loft with side-projected UVs over the given FS/h box (for a painted skin). */
  const SK = { fs0: S.fuselage[0][0] - 2, fs1: S.fuselage[S.fuselage.length - 1][0] + 2, h0: 0, h1: Math.max(...S.fuselage.map((r) => r[2])) + 4 };
  const UV = { x0: X(SK.fs1), x1: X(SK.fs0), y0: Y(SK.h0), y1: Y(SK.h1) };
  const fuselageGeo = () => FUSE.geo({ step: 0.05, N: 56, uv: UV });

  /** Canvas painter helper: maps [FS, h] (in) to texture pixels for a W×H canvas. */
  const texP = (W2: number, H2: number) => ([fs, h]: number[]) => [((X(fs) - UV.x0) / (UV.x1 - UV.x0)) * W2, (1 - (Y(h) - UV.y0) / (UV.y1 - UV.y0)) * H2];

  return {
    S, X, Y, Z, FS, H, groundY, P, skin,
    FUSE, fus: FUSE.fus, topY: FUSE.topY, botY: FUSE.botY, onSkin: FUSE.onSkin, fRing: FUSE.ring, inFus: FUSE.inside, planeRing: FUSE.plate, sectionSlab: FUSE.slab,
    rootZ, kinkZ, tipZ, wLE, wC, wY, wT, WING, wingP: WING.p, wingSec: WING.sec, wingStations, wingLoft,
    sLE, sC, SY, STAB, stabSec: STAB.sec, stZ,
    FIN, fLE, fC, hingeX, finCut, finSec: FINS.sec, finP: FINS.p,
    strutGeo, springLegGeo, projectLoop, fuselageGeo, UV, texP, mergeGeos, roundPoly,
  };
}
export type CessnaAirframe = ReturnType<typeof cessnaAirframe>;

/** Tapered round tube a → b (radius r0 at a, r1 at b), e.g. the tubular spring-steel main gear strut. */
export function taperTubeGeo(a: Vec3, b: Vec3, r0: number, r1: number, n = 14) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A).normalize();
  const u = Math.abs(d.y) < 0.9 ? V(0, 1, 0).cross(d).normalize() : V(1, 0, 0).cross(d).normalize(), w = d.clone().cross(u).normalize();
  const secs: Ring[] = [];
  for (let k = 0; k <= 6; k++) {
    const c = A.clone().lerp(B, k / 6), r = lerp(r0, r1, k / 6);
    secs.push(Array.from({ length: n }, (_, i) => { const th = (i / n) * Math.PI * 2; return c.clone().addScaledVector(u, Math.cos(th) * r).addScaledVector(w, Math.sin(th) * r); }));
  }
  return loft(secs.reverse()); // b → a keeps the faces outward for single-sided part materials
}

/**
 * Cessna speed fairing ("wheel pant"), inches in, metres out. A rounded pill, widest at the axle, with a blunt elliptical
 * nose and a tapering tail, cut flat underneath so the bottom of the tire shows. Origin at the axle, x forward, y up.
 * `axle` = fraction of the length from the nose to the axle; `lift` = centre height above the axle; `cut` = height of the
 * flat bottom relative to the axle (negative).
 */
export function wheelFairingGeo(o: { len: number; height: number; width: number; axle: number; lift: number; cut: number }) {
  const L = o.len * IN, a = o.axle, x0 = a * L, N = 32, M = 28, ne = 2.6;
  const prof = (t: number) => (t <= a ? Math.sqrt(Math.max(0, 1 - Math.pow((a - t) / a, 2))) : Math.pow(Math.max(0, 1 - Math.pow((t - a) / (1 - a), 2.3)), 0.62));
  const secs: Ring[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, f = Math.max(0.03, prof(t)), x = x0 - t * L;
    const hh = (o.height / 2) * IN * f, hw = (o.width / 2) * IN * Math.pow(f, 0.85);
    // the top line droops a little toward the tail
    const cy = (o.lift - (t > a ? 1.6 * (t - a) / (1 - a) : 0)) * IN;
    const r: Ring = [];
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const y = cy + hh * Math.sign(s) * Math.pow(Math.abs(s), 2 / ne), z = hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / ne);
      r.push(V(x, Math.max(y, o.cut * IN), z));
    }
    secs.push(r);
  }
  return loft(secs.reverse()); // tail → nose keeps the faces outward for single-sided part materials
}

/** Paint helpers for the skin canvas: path from [FS, h] points and a glass gradient. */
export function skinPainter(af: CessnaAirframe, W = 2048, H = 512) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const P = af.texP(W, H);
  const path = (pts: number[][], close = true) => {
    g.beginPath();
    pts.forEach((q, i) => { const [a, b] = P(q); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
    if (close) g.closePath();
  };
  const glass = (hTop: number, hBot: number) => {
    const gr = g.createLinearGradient(0, P([0, hTop])[1], 0, P([0, hBot])[1]);
    gr.addColorStop(0, "#3A4C5A"); gr.addColorStop(1, "#131C24");
    return gr;
  };
  const done = () => {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { c, g, P, path, glass, done, W, H };
}
