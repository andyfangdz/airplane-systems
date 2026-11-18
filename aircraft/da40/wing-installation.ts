/** DA40 wing structure and long-range fuel bay. Stations and sections are schematic.
 * Diamond AMM 53-10, 57-10 and 28-10 (OÄM 40-071). See SOURCES.md for the wing-off photos. */
import * as THREE from "three";
import { loft, mergeGeos, type Ring } from "@/lib/geometry";
import { toVec3 } from "@/lib/math";
import { WJ, WOUT, wingP, wingSec } from "./geometry";

export const FRONT_SPAR = 0.16;
export const REAR_SPAR = 0.55;
const REAR_WEB = 0.755;
export const FUEL_CHAMBERS = [
  { id: "inboard", name: "Inboard fuel chamber", z0: 1.18, z1: 2.4 },
  { id: "outboard", name: "Outboard fuel chamber", z0: 2.47, z1: 3.11 },
  { id: "long-range", name: "Long-range fuel chamber", z0: 3.17, z1: 3.55 },
] as const;
export const CHAMBER_JOINTS = [
  { id: "member-1", inner: FUEL_CHAMBERS[0], outer: FUEL_CHAMBERS[1] },
  { id: "member-2", inner: FUEL_CHAMBERS[1], outer: FUEL_CHAMBERS[2] },
] as const;

/** Height as a fraction of the distance from the mean line to the local skin. */
export function insideWing(z: number, chord: number, height: number) {
  return wingP(z, chord, 0).lerp(wingP(z, chord, Math.sign(height)), Math.abs(height));
}

function rectangle(z: number, front: number, rear: number, bottom: number, top: number) {
  return [
    insideWing(z, front, top),
    insideWing(z, rear, top),
    insideWing(z, rear, bottom),
    insideWing(z, front, bottom),
  ];
}

// The carbon caps taper outboard on either face of the lighter sandwich shear web.
export function sparMember(side: number, chord: number, member: "web" | "upper" | "lower") {
  const heights = { web: [-0.7, 0.7], upper: [0.7, 0.9], lower: [-0.9, -0.7] } as const;
  const [bottom, top] = heights[member];
  return loft(
    [WJ, 3.5, WOUT].map((span) => {
      const width = member === "web" ? 0.005 : 0.026 - (0.014 * (span - WJ)) / (WOUT - WJ);
      return rectangle(side * span, chord - width, chord + width, bottom, top);
    }),
  );
}

export function sparStub(side: number, chord: number) {
  return loft([0.58, 0.8, WJ].map((z) => rectangle(side * z, chord - 0.024, chord + 0.024, -0.67, 0.67)));
}

// A hollow box carries the stub inside the center section. Keep both ends open.
export function mainBulkhead(chord: number) {
  const stations = [-WJ, -0.8, -0.58, 0, 0.58, 0.8, WJ];
  const wall = (front: number, rear: number, bottom: number, top: number) =>
    loft(stations.map((z) => rectangle(z, chord + front, chord + rear, bottom, top)));
  return mergeGeos([
    wall(-0.034, 0.034, 0.7, 0.9),
    wall(-0.034, 0.034, -0.9, -0.7),
    wall(-0.034, -0.026, -0.7, 0.7),
    wall(0.026, 0.034, -0.7, 0.7),
  ]);
}

// Rounded tank end and matching rib opening, as seen looking spanwise into the empty bay.
function tankContour(z: number, scale: number): Ring {
  const points: Ring = [];
  const rounded = (v: number) => Math.sign(v) * Math.sqrt(Math.abs(v));
  const mid = (FRONT_SPAR + REAR_SPAR) / 2;
  for (let i = 0; i < 32; i++) {
    const a = (2 * Math.PI * i) / 32;
    points.push(insideWing(z, mid + 0.154 * scale * rounded(Math.cos(a)), 0.68 * scale * rounded(Math.sin(a))));
  }
  return points;
}

export function chamberGeometry(side: number, z0: number, z1: number, scale = 1) {
  return loft([z0, (z0 + z1) / 2, z1].map((z) => tankContour(side * z, scale)));
}

/** One clipping plane (and one quantity/label) per side, with three disconnected liquid volumes. */
export function wingFuelVolume(side: number) {
  return mergeGeos(FUEL_CHAMBERS.map((c) => chamberGeometry(side, c.z0, c.z1, 0.98)));
}

function ribPlate(z: number, edge: Ring, opening?: Ring, depth = 0.016) {
  const xy = (ring: Ring) => ring.map((p) => new THREE.Vector2(p.x, p.y));
  const profile = new THREE.Shape(xy(edge));
  if (opening) profile.holes.push(new THREE.Path(xy(opening)));
  return new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false }).translate(0, 0, z - depth / 2);
}

/** The center of the rib is open for the tank to pass through. */
export function tankRib(z: number) {
  const rim = rectangle(z, FRONT_SPAR + 0.005, REAR_SPAR - 0.005, -0.93, 0.93);
  const opening = tankContour(z, 1.025);
  const flange = tankContour(z, 1.075);
  return mergeGeos([ribPlate(z, rim, flange), ribPlate(z, flange, opening, 0.045)]);
}

export function rootRibs(side: number) {
  const z = side * WJ;
  const edge = (front: number, rear: number) => {
    const chords = [front, (front + rear) / 2, rear];
    return [...chords.map((c) => insideWing(z, c, 0.9)), ...chords.reverse().map((c) => insideWing(z, c, -0.9))];
  };
  const aftOpening = rectangle(z, 0.61, 0.72, -0.55, 0.55);
  return mergeGeos([
    ribPlate(z, edge(0.015, FRONT_SPAR - 0.005)),
    tankRib(z),
    ribPlate(z, edge(REAR_SPAR + 0.005, REAR_WEB), aftOpening),
  ]);
}

// Leave passages for the short moving rods to reach the surface horns.
export function rearWeb(side: number, flap: number, aileron: number) {
  const section = (z0: number, z1: number, bottom: number) =>
    loft([z0, z1].map((z) => rectangle(side * z, REAR_WEB - 0.004, REAR_WEB + 0.004, bottom, 0.89)));
  return mergeGeos([
    section(WJ, flap - 0.08, -0.89),
    section(flap - 0.08, flap + 0.08, 0.6),
    section(flap + 0.08, aileron - 0.1, -0.89),
    section(aileron - 0.1, aileron + 0.1, 0.6),
    section(aileron + 0.1, WOUT, -0.89),
  ]);
}

export function wingEndRib(side: number) {
  return ribPlate(side * WOUT, wingSec(side * WOUT, 0.015, REAR_WEB, 0.9));
}

/** A bent rib carries the bellcrank at an insert in the control bay (AMM 57-10-00 p. 4). */
export function controlRib(pivot: THREE.Vector3) {
  const z = pivot.z,
    side = Math.sign(z);
  const ribZ = z - side * 0.028;
  const web = ribPlate(
    ribZ,
    rectangle(ribZ, REAR_SPAR + 0.005, REAR_WEB, -0.9, 0.88),
    rectangle(ribZ, 0.585, 0.735, -0.64, 0.68),
  );
  const front = insideWing(ribZ, REAR_SPAR + 0.008, 0).x;
  const aft = pivot.x - 0.024;
  const shelf = new THREE.BoxGeometry(front - aft, 0.009, 0.048).translate(
    (front + aft) / 2,
    pivot.y - 0.017,
    z - side * 0.013,
  );
  return mergeGeos([web, shelf]);
}

export function chamberBaffle(z: number) {
  // A representative open baffle leaves a passage for the probe as well as fuel.
  return ribPlate(z, tankContour(z, 0.955), tankContour(z, 0.69));
}

export function probePort(side: number, longRange: boolean, end: "mount" | "guide") {
  const chamber = longRange ? FUEL_CHAMBERS[2] : FUEL_CHAMBERS[0];
  const mount = end === "mount";
  return toVec3(insideWing(side * (mount ? chamber.z0 : chamber.z1 - 0.012), 0.32, mount ? -0.46 : 0.38));
}
