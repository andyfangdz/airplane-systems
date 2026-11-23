import { finSurface, fuselage, liftingSurface, lin } from "@/lib/geometry";

// Metres, +X nose, +Y up, +Z starboard. The envelope and approximate stations
// follow the Falcon 6X Facts & Figures (September 2023), three-view on p. 3.
// Section shapes, glazing contours and hinge positions are visual approximations.
export const GROUND_Y = -2.45;
// Nose and cabin stations sampled from the orthographic side and plan artwork on
// p. 7 of the June 2026 Overview. The table records roof and keel separately so
// the drooped radome, windshield rake and rising aft keel retain their outlines.
const bodyStations = [
  // x, half-width, roof, keel (metres).
  [12.84, 0.022, -0.68, -0.72],
  [12.77, 0.12, -0.58, -0.82],
  [12.6, 0.24, -0.45, -0.91],
  [12.25, 0.45, -0.23, -1.02],
  [11.75, 0.71, -0.03, -1.11],
  [11.25, 0.9, 0.19, -1.17],
  [11.06, 0.97, 0.29, -1.2],
  [10.8, 1.04, 0.52, -1.22],
  [10.4, 1.14, 0.85, -1.24],
  [10.0, 1.21, 1.05, -1.26],
  [9.7, 1.26, 1.16, -1.27],
  [9.35, 1.29, 1.25, -1.28],
  [9.0, 1.32, 1.29, -1.3],
  [8.6, 1.34, 1.34, -1.3],
  [8.0, 1.35, 1.38, -1.31],
  [6.0, 1.35, 1.38, -1.31],
  [-2.2, 1.35, 1.38, -1.31],
  [-4.1, 1.33, 1.38, -1.28],
  [-5.5, 1.17, 1.36, -1.08],
  [-7.0, 0.95, 1.35, -0.68],
  [-8.0, 0.76, 1.36, -0.39],
  [-9.0, 0.61, 1.38, -0.03],
  [-10.0, 0.46, 1.37, 0.29],
  [-10.7, 0.34, 1.35, 0.57],
  [-11.1, 0.23, 1.33, 0.74],
  [-11.22, 0.17, 1.32, 0.8],
];
export const FUSE = fuselage({
  table: bodyStations.map(([x, width, roof, keel]) => [x, width, (roof - keel) / 2, (roof + keel) / 2]),
  nTop: 2.12,
  nBot: 2.28,
  tumble: 0.018,
});

// Stations traced from the top and front views on p. 3. The increasing aft-edge sweep
// and the short, rolled tip are distinct from a straight tapered wing with a vertical fence.
const planform = [
  // Semispan, leading edge, chord, mean height.
  [0, 3.25, 5.96, -0.96],
  [1.42, 2.48, 4.86, -0.97],
  [2.75, 1.68, 4.22, -0.94],
  [4.25, 0.7, 3.61, -0.9],
  [5.8, -0.33, 2.99, -0.86],
  [7.25, -1.27, 2.5, -0.82],
  [8.65, -2.13, 2.13, -0.79],
  [10.25, -3.16, 1.85, -0.76],
  [11.65, -4.14, 1.35, -0.73],
  [12.2, -4.47, 1.23, -0.7],
  [12.45, -4.72, 1.19, -0.64],
  [12.6, -4.88, 1.11, -0.51],
  [12.75, -5.1, 1.04, -0.25],
  [12.84, -5.37, 0.94, 0.02],
  [12.93, -5.74, 0.76, 0.29],
  [12.97, -6.05, 0.48, 0.46],
];
const atSpan = (z: number) => lin(planform, Math.abs(z));
export const WING = liftingSurface({
  le: (z) => atSpan(z)[0],
  chord: (z) => atSpan(z)[1],
  y: (z) => atSpan(z)[2] - 0.15 * (1 - Math.abs(z) / 12.97),
  t: (z) => 0.121 - 0.061 * (Math.abs(z) / 12.97),
  m: 0.016,
});

export const wingtipStations = planform.filter(([span]) => span >= 12.2).map(([span]) => span);
export function wingtipSection(z: number) {
  const span = Math.abs(z);
  const lo = Math.max(0, span - 0.05),
    hi = Math.min(12.97, span + 0.05);
  const cant = Math.atan2(WING.y(hi) - WING.y(lo), hi - lo);
  return WING.sec(z, 0, 1).map((point) => {
    const thickness = point.y - WING.y(z);
    point.y = WING.y(z) + Math.cos(cant) * thickness;
    point.z -= Math.sign(z) * Math.sin(cant) * thickness;
    return point;
  });
}

const tailplane = [
  // Semispan, leading edge, chord. The plan view shows a small radius at the tip.
  [0, -8.36, 2.53],
  [0.55, -8.75, 2.36],
  [2.65, -10.09, 1.8],
  [4.62, -11.36, 1.39],
  [4.84, -11.53, 1.3],
  [4.94, -11.83, 1.01],
];
export const STAB = liftingSurface({
  le: (z) => lin(tailplane, Math.abs(z))[0],
  chord: (z) => lin(tailplane, Math.abs(z))[1],
  y: (z) => 2.28 + Math.abs(z) * 0.012,
  t: () => 0.088,
  m: 0,
});
const finProfile = [
  // Height, leading edge and chord. The long dorsal fillet blends into the aft fuselage.
  [0.75, -4.75, 6.39],
  [1.08, -5.48, 5.77],
  [1.31, -6.0, 5.4],
  [1.55, -6.69, 4.74],
  [1.8, -7.08, 4.43],
  [2.12, -7.48, 4.17],
  [2.55, -8.22, 3.53],
  [3.05, -8.92, 3.03],
  [4.25, -10.28, 2.12],
  [4.65, -10.78, 1.78],
  [4.79, -10.8, 1.82],
];
export const finHeights = finProfile.map(([height]) => height);
export const FIN = finSurface({
  le: (h) => lin(finProfile, h)[0],
  chord: (h) => lin(finProfile, h)[1],
  t: () => 0.08,
});
