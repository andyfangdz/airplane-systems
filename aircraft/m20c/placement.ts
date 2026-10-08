/** M20C assembly coordinates shared by parts, animation and placement checks.
 * Track and wheelbase are the dimensioned three-view values already cited in geometry.ts.
 * Trunnion, well and equipment envelopes are schematic fits, not maintenance rigging dimensions. */
import * as THREE from "three";
import { cutCowlInlets, inletContour, inletSkins, type CowlInlet } from "@/lib/cowl";
import { loft, mergeGeos, sided } from "@/lib/geometry";
import { D2R, V, clamp, type Vec3 } from "@/lib/math";
import { FUSE, GROUND_Y, IN, MAIN_SPAR, PANEL_X, fs, fuselageGeo, onSkin, wingP, wingSec } from "./geometry";

export const NG = { top: [2.3, -0.5, 0] as Vec3, wheel: [-0.12, -0.57, 0] as Vec3, r: 0.18, width: 0.11 };
const track = (9 * 12 + 0.75) * IN;
const wheelbase = (5 * 12 + 6 + 9 / 16) * IN;
const trunnionZ = 1.405;
export const MG = {
  x: NG.top[0] + NG.wheel[0] - wheelbase,
  y: GROUND_Y + 0.22,
  z: track / 2,
  r: 0.22,
  width: 0.15,
  // The main leg hangs almost vertically from the spar, then folds inward 90°.
  // The former inboard trunnion/136° rotation placed the retracted tire in the seats.
  // Mounting axis is just aft of the spar, leaving the forward sealed fuel bay intact.
  // This bracket offset is schematic; ground track and wheelbase remain dimensioned above.
  trunnion: [wingP(trunnionZ, MAIN_SPAR + 0.06, 0).x, -0.525, trunnionZ] as Vec3,
};
export const mainAxle = (side: number): Vec3 => [
  MG.x - MG.trunnion[0],
  MG.y - MG.trunnion[1],
  side * (MG.z - MG.trunnion[2]),
];
export const mainAngle = (fraction: number, side: number) => (side * clamp(fraction, 0, 1) * Math.PI) / 2;
export const noseAngle = (fraction: number) => -clamp(fraction, 0, 1) * 95 * D2R;
/** Doors stay open until the tire clears the lower skin, then close over the well. */
export const noseDoorAngle = (fraction: number, side: number) =>
  -side * 110 * D2R * (1 - clamp((fraction - 0.94) / 0.06, 0, 1));
export const mainGearPoint = (local: Vec3, fraction: number, side: number) =>
  V(...local)
    .applyAxisAngle(V(1, 0, 0), mainAngle(fraction, side))
    .add(V(MG.trunnion[0], MG.trunnion[1], side * MG.trunnion[2]));
export const noseGearPoint = (local: Vec3, fraction: number, yaw = 0) =>
  V(...local)
    .applyAxisAngle(V(0, 1, 0), -(1 - fraction) * yaw * 20 * D2R)
    .applyAxisAngle(V(0, 0, 1), noseAngle(fraction))
    .add(V(...NG.top));

export const MAIN_WELL = { x: MG.x, z: MG.trunnion[2] + MG.y - MG.trunnion[1], length: 0.54, width: 0.59 };
/** Narrow recess follows the folded leg from the wheel well to its trunnion.
 * Its schematic width clears the unchanged leg, shock discs and assist spring. */
export const MAIN_LEG_WELL = {
  x: (MG.x + MG.trunnion[0]) / 2,
  z: (MAIN_WELL.z + MG.trunnion[2]) / 2,
  angle: Math.atan2(MG.trunnion[0] - MG.x, MG.trunnion[2] - MAIN_WELL.z),
  length: Math.hypot(MG.trunnion[0] - MG.x, MG.trunnion[2] - MAIN_WELL.z) + 0.12,
  width: 0.18,
};
export const NOSE_WELL = { x0: 1.52, x1: 2.48, halfWidth: 0.135, roof: -0.13 };
const noseEdgeY = (x: number) => {
  const { cy, hh, hw } = FUSE.fus(x);
  return cy - hh * (1 - (NOSE_WELL.halfWidth / hw) ** FUSE.nBot) ** (1 / FUSE.nBot);
};
const noseHingeOffset =
  Math.min(
    ...Array.from({ length: 65 }, (_, i) => {
      const t = i / 64,
        x = NOSE_WELL.x0 + (NOSE_WELL.x1 - NOSE_WELL.x0) * t;
      return noseEdgeY(x) - (noseEdgeY(NOSE_WELL.x0) * (1 - t) + noseEdgeY(NOSE_WELL.x1) * t);
    }),
  ) - 0.008;
/** Schematic bracket axis follows the rising belly, below its curved edge so an
 * opening door moves away from the fixed skin. The door itself retains the exact curved skin. */
export const noseDoorAxis = () =>
  V(NOSE_WELL.x1 - NOSE_WELL.x0, noseEdgeY(NOSE_WELL.x1) - noseEdgeY(NOSE_WELL.x0), 0).normalize();
export const noseDoorHinge = (side: number): Vec3 => [
  (NOSE_WELL.x0 + NOSE_WELL.x1) / 2,
  (noseEdgeY(NOSE_WELL.x0) + noseEdgeY(NOSE_WELL.x1)) / 2 + noseHingeOffset,
  side * (NOSE_WELL.halfWidth + 0.025),
];
export const CABIN = {
  floor: -0.57,
  frontSeatX: fs(42 * IN), // TCDS front-seat arms +36.5…44 in; representative aft-half setting.
  rearSeatX: fs(70 * IN),
  baggageX: fs(93 * IN),
  shelfX: fs(114 * IN),
};
/** Schematic bungee package beneath the panel floor; its full animated envelope
 * stays between the floor underside and the traced belly. */
export const GEAR_BUNGEE: Vec3 = [PANEL_X, CABIN.floor - 0.07, 0];
export const EQUIPMENT = {
  battery: [fs(2.5 * IN), -0.2, -0.36] as Vec3,
  boost: [fs(19 * IN), -0.62, -0.2] as Vec3,
  radios: [PANEL_X + 0.14, -0.03, 0.05] as Vec3,
  starter: [fs(-18 * IN), -0.24, 0.2] as Vec3,
  carburetor: [2.5, -0.33, 0] as Vec3,
  airbox: [2.62, -0.32, 0] as Vec3,
  carbHeatValve: [2.61, -0.32, 0.1] as Vec3,
  exhaust: [2.32, -0.36, 0.05] as Vec3,
};

/** Equivalent usable-fluid envelope, calibrated to the stated 26 US gal per wing.
 * Its planform follows the previous bay approximation; reduced section thickness accounts
 * for unmodelled structure/void space. It is not an engineering drawing of the sealed bay. */
export const fuelBayGeo = (side: number) =>
  loft(
    sided(
      [0.62, 1, 1.4, 1.8, 2.2, 2.5].map((z) => wingSec(side * z, 0.06, MAIN_SPAR - 0.02, 0.6332556)),
      side,
    ),
  );

/** Cabin floor split around the raised nose well and the Johnson-bar floor recess.
 * Heights are schematic; preserve the full seat and tire envelopes rather than hiding intersections. */
export function cabinFloorGeo(side: number) {
  const stations = side ? [1.86, 1.55, 1.52, 1.25, 0.85, 0.5, 0, -0.45] : [1.3, 0.58];
  return loft(
    stations.map((x) => {
      const y = side ? CABIN.floor : -0.69;
      const width = onSkin(x, y - 0.015, 1, 0.96).z;
      const inner = side ? side * (x >= NOSE_WELL.x0 ? 0.15 : 0.11) : -0.11;
      const outer = side ? side * width : 0.11;
      return [V(x, y, inner), V(x, y, outer), V(x, y - 0.015, outer), V(x, y - 0.015, inner)];
    }),
  );
}

/** Reuse the attribute-preserving convex-prism cutter, rotated so its x projection
 * becomes a downward well opening. Only the lower skin is cut; upper wing skin stays intact. */
function cutBelow(geometry: THREE.BufferGeometry, cuts: CowlInlet[]) {
  geometry.rotateZ(Math.PI / 2);
  return cutCowlInlets(geometry, cuts).rotateZ(-Math.PI / 2);
}
const mainWheelCut = (side: number): CowlInlet => ({
  y: MAIN_WELL.x,
  z: side * MAIN_WELL.z,
  height: MAIN_WELL.length / 0.9,
  width: MAIN_WELL.width / 0.9,
  exponent: 4,
  minX: 0.4,
});
const mainLegCut: CowlInlet = {
  y: 0,
  z: 0,
  height: MAIN_LEG_WELL.width / 0.9,
  width: MAIN_LEG_WELL.length / 0.9,
  exponent: 4,
  minX: 0.4,
};
function cutMainLegWell(geometry: THREE.BufferGeometry, side: number, wholeHeight = false) {
  const { x, z, angle } = MAIN_LEG_WELL;
  geometry.translate(-x, 0, -side * z).rotateY(-side * angle);
  return cutBelow(geometry, [wholeHeight ? { ...mainLegCut, minX: -1 } : mainLegCut])
    .rotateY(side * angle)
    .translate(x, 0, side * z);
}
export function cutMainWell(geometry: THREE.BufferGeometry, side: number) {
  return cutMainLegWell(cutBelow(geometry, [mainWheelCut(side)]), side);
}
const noseWellCut: CowlInlet = {
  y: (NOSE_WELL.x0 + NOSE_WELL.x1) / 2,
  z: 0,
  height: (NOSE_WELL.x1 - NOSE_WELL.x0) / 0.9,
  width: (NOSE_WELL.halfWidth * 2) / 0.9,
  exponent: 4,
  minX: -NOSE_WELL.roof,
};
export function cutNoseWell(geometry: THREE.BufferGeometry) {
  return cutBelow(geometry, [noseWellCut]);
}
/** The actual removed belly triangles form each door. An inward 4 mm skin and edge
 * strips give the schematic panel thickness without changing the exterior or tire envelope. */
export function noseDoorGeo(side: number) {
  const outer = inletSkins(
    fuselageGeo().rotateZ(Math.PI / 2),
    [noseWellCut],
    [new THREE.Plane(V(0, 0, -side), 0)],
  ).rotateZ(-Math.PI / 2);
  const pos = outer.attributes.position,
    normal = outer.attributes.normal,
    ix = outer.index!;
  const vertices: number[] = [],
    indices: number[] = [];
  const edges = new Map<string, [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] | null>();
  const key = (p: THREE.Vector3) =>
    p
      .toArray()
      .map((v) => v.toFixed(6))
      .join(",");
  for (let i = 0; i < ix.count; i += 3) {
    const tri = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, ix.getX(i + j)));
    const inner = tri.map((p, j) =>
      p.clone().addScaledVector(new THREE.Vector3().fromBufferAttribute(normal, ix.getX(i + j)), -0.004),
    );
    const start = vertices.length / 3;
    for (const p of tri) vertices.push(p.x, p.y, p.z);
    for (const p of inner) vertices.push(p.x, p.y, p.z);
    indices.push(start, start + 1, start + 2, start + 3, start + 5, start + 4);
    for (let j = 0; j < 3; j++) {
      const a = tri[j],
        b = tri[(j + 1) % 3],
        edgeKey = [key(a), key(b)].sort().join("|");
      edges.set(edgeKey, edges.has(edgeKey) ? null : [a, b, inner[j], inner[(j + 1) % 3]]);
    }
  }
  for (const edge of edges.values())
    if (edge) {
      const [a, b, ai, bi] = edge,
        start = vertices.length / 3;
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, ai.x, ai.y, ai.z, bi.x, bi.y, bi.z);
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  outer.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const hinge = noseDoorHinge(side);
  return geo.translate(-hinge[0], -hinge[1], -hinge[2]);
}
/** Wheel and leg recess walls follow the wing skins. Remove their shared interior
 * boundary so the folded strut passes through one continuous well. */
export function mainWellGeo(side: number) {
  const walls = (contour: THREE.Vector3[]) =>
    loft(
      [-1, 1].map((up) =>
        contour.map(({ x, z }) => {
          const le = wingP(z, 0, 0).x,
            chord = le - wingP(z, 1, 0).x;
          return V(x, wingP(z, (le - x) / chord, up).y, z);
        }),
      ),
      { caps: false },
    );
  const wheel = inletContour(mainWheelCut(side)).map(([x, z]) => V(x, 0, z));
  const leg = inletContour(mainLegCut).map(([x, z]) =>
    V(x, 0, z)
      .applyAxisAngle(V(0, 1, 0), side * MAIN_LEG_WELL.angle)
      .add(V(MAIN_LEG_WELL.x, 0, side * MAIN_LEG_WELL.z)),
  );
  const pieces = [
    cutMainLegWell(walls(wheel), side, true),
    cutBelow(walls(leg), [{ ...mainWheelCut(side), minX: -1 }]),
  ];
  const geometry = mergeGeos(pieces);
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}
