/** SR20 G6 bonded wing and wet bay. Wing stations are inches from the centreline
 * (AMM 6-00, 51-10 Fig 51-10-8). Chord positions, sections and fitting sizes are schematic. */
import * as THREE from "three";
import { loft, mergeGeos } from "@/lib/geometry";
import { clamp, lerp, toVec3 } from "@/lib/math";
import { WR, wingP, wingSec } from "./geometry";

export const ws = (inches: number) => inches * 0.0254;
export const TANK_CHORD = [0.3, 0.6] as const;
// Fit the three access bays of Fig 6-00-7 to the rib stations of Fig 51-10-8.
export const TANK_SPAN = [ws(61), ws(140)] as const;
export const BAFFLES = [
  { key: "inner", z: ws(87) },
  { key: "outer", z: ws(110) },
] as const;
const [front, rear] = TANK_CHORD;
const [inner, outer] = TANK_SPAN;

function sectionPoint(z: number, chord: number, height: number) {
  const span = Math.max(WR, Math.abs(z));
  const p = wingP(span, chord).lerp(wingP(span, chord, Math.sign(height)), Math.abs(height));
  p.z = z;
  return p;
}

function band(z: number, c0: number, c1: number, bottom: number, top: number) {
  return [sectionPoint(z, c0, top), sectionPoint(z, c1, top), sectionPoint(z, c1, bottom), sectionPoint(z, c0, bottom)];
}

// Three convex lofts leave the C open. A fan cap across a concave section would close the channel.
export function mainSpar() {
  const half = [WR, inner, outer, ws(213), 5.55, 5.7, 5.78];
  const stations = [...half.map((z) => -z).reverse(), ...half];
  const strip = (c0: number, c1: number, h0: number, h1: number) => loft(stations.map((z) => band(z, c0, c1, h0, h1)));
  return mergeGeos([
    strip(front - 0.009, front, -0.82, 0.82),
    strip(front - 0.065, front, 0.82, 0.94),
    strip(front - 0.065, front, -0.94, -0.82),
  ]);
}

export function attachPoint(side: number, aft: boolean) {
  return aft ? new THREE.Vector3(0.015, -0.43, side * 0.43) : sectionPoint(side * 0.4, front, 0);
}

export const rearWebChord = (span: number) => lerp(0.74, rear, clamp((span - ws(27.25)) / (inner - ws(27.25)), 0, 1));

export function rearWeb(side: number) {
  // Sweep the root end up to the aft sidewall attachment.
  const fitting = attachPoint(side, true);
  const end = band(fitting.z, rear, rear + 0.012, -0.52, 0.52);
  const offset = fitting.clone().sub(sectionPoint(fitting.z, rear, 0));
  return loft([
    end.map((p) => p.add(offset)),
    band(side * 0.44, 0.86, 0.872, -0.65, 0.65),
    ...[ws(27.25), ws(37), inner, outer, ws(213), 5.55, 5.7, 5.78].map((span) => {
      const chord = rearWebChord(span);
      return band(side * span, chord, chord + 0.012, -0.92, 0.92);
    }),
  ]);
}

/** A rib cut from the local airfoil. Baffles leave a passage between adjacent wet bays. */
export function wingRib(z: number, c0: number, c1: number, type: "solid" | "baffle" | "outlet" = "solid") {
  const edge = wingSec(z, c0, c1, 0.92);
  if (type === "baffle") {
    // A scallop at the foot keeps the bays communicating below the central opening.
    const foot = sectionPoint(z, 0.34, -0.92);
    for (const p of edge) {
      const offset = (p.x - foot.x) / 0.035;
      if (p.y < foot.y + 0.01 && Math.abs(offset) < 1) p.y += 0.02 * (1 - offset * offset);
    }
  }
  const profile = new THREE.Shape(edge.map((p) => new THREE.Vector2(p.x, p.y)));
  if (type === "outlet") {
    for (const chord of STRAINER_CHORDS) {
      const p = wingP(z, chord);
      const hole = new THREE.Path();
      hole.absarc(p.x, p.y, 0.022, 0, Math.PI * 2, true);
      profile.holes.push(hole);
    }
  }
  if (type === "baffle") {
    const middle = sectionPoint(z, (c0 + c1) / 2, -0.2);
    const hole = new THREE.Path();
    hole.absellipse(
      middle.x,
      middle.y,
      (sectionPoint(z, c0, 0).x - sectionPoint(z, c1, 0).x) * 0.28,
      (sectionPoint(z, 0.45, 0.55).y - middle.y) * 0.7,
      0,
      Math.PI * 2,
      true,
      0,
    );
    profile.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(profile, { depth: 0.012, bevelEnabled: false, curveSegments: 12 }).translate(
    0,
    0,
    z - 0.006,
  );
}

export function wingFuelVolume(side: number) {
  return loft([inner, ...BAFFLES.map((b) => b.z), outer].map((z) => wingSec(side * z, front, rear, 0.85)));
}

const FILLER_SPAN = 2.7;
export const fillerCap = (side: number) => toVec3(wingP(side * FILLER_SPAN, 0.38, 1));
export const TAB_DEPTH = 0.045;

// The visible liquid and both sender arms use the same level-flight surface. Its three anchors
// are an empty bay, the POH 13-gallon tab and a full bay. Intermediate heights are illustrative.
const emptyY = Math.min(...wingSec(inner, front, rear, 0.85).map((p) => p.y));
const fullY = Math.max(...wingSec(outer, front, rear, 0.85).map((p) => p.y));
const tabY = fillerCap(1)[1] - TAB_DEPTH;
export function fuelHeight(fraction: number) {
  const gal = 28 * clamp(fraction, 0, 1);
  return gal <= 13 ? lerp(emptyY, tabY, gal / 13) : lerp(tabY, fullY, (gal - 13) / 15);
}

export const STRAINER_CHORDS = [0.37, 0.53] as const;
export const FLOAT_ARM = 0.16;
export function senderPivot(side: number, outboard: boolean) {
  return toVec3(wingP(side * (outboard ? outer : inner), 0.48));
}

export function floatPose(side: number, outboard: boolean) {
  const pivot = senderPivot(side, outboard);
  const inward = outboard ? -side : side;
  // Keep the float off the skins at both travel stops, including its radius and wing dihedral.
  const floatZ = pivot[2] + inward * FLOAT_ARM;
  const low = sectionPoint(floatZ, 0.48, -0.6).y;
  const high = sectionPoint(floatZ, 0.48, 0.6).y;
  return (fraction: number) => -inward * Math.asin((clamp(fuelHeight(fraction), low, high) - pivot[1]) / FLOAT_ARM);
}

export const ACCESS_BAYS = [
  { key: "root", number: 3, span: 0.79, chord: 0.6 },
  { key: "inboard", number: 6, span: (inner + BAFFLES[0].z) / 2, chord: 0.45 },
  { key: "mid", number: 7, span: (BAFFLES[0].z + BAFFLES[1].z) / 2, chord: 0.45 },
  { key: "outboard", number: 8, span: (BAFFLES[1].z + outer) / 2, chord: 0.45 },
] as const;

/** A thin cover following the lower mould line, with a visible rim under the X-ray skin. */
export function accessCover(side: number, span: number, chord: number, root: boolean) {
  const rings = [0.003, -0.003].map((dy) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (2 * Math.PI * i) / 32;
      const p = wingP(
        side * (span + (root ? 0.095 : 0.16) * Math.sin(a)),
        chord + (root ? 0.05 : 0.093) * Math.cos(a),
        -1,
      );
      p.y += dy;
      return p;
    }),
  );
  return loft(rings);
}
