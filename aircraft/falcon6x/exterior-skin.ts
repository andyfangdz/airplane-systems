import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { curvedSkinPatch } from "@/lib/skin-patch";
import { fuselageNormal } from "@/lib/fuselage-openings";
import { roundPoly } from "@/lib/geometry";
import { sidePaintUV, paintAtlas } from "@/lib/livery";
import { FUSE } from "./geometry";
import { FALCON_PEARL } from "./paint";

// Develop the skin in longitudinal station and angle around the fuselage. The
// two scale factors set tessellation density for the shared aperture mesher.
const axial = 0.24,
  angular = 0.46;
const halfTurn = Math.PI / 2;
const skinUV = (x: number, angle: number) => new THREE.Vector2(x * axial, angle * angular);
const skinPoint = (uv: THREE.Vector2) => {
  const angle = uv.y / angular;
  return FUSE.ring(uv.x / axial, 1, 1, angle, angle, false)[0];
};
function surfaceUV(point: THREE.Vector3) {
  const { hh, cy, nTop, nBot } = FUSE.section(point.x);
  const height = THREE.MathUtils.clamp((point.y - cy) / hh, -1, 1);
  const sin = Math.sign(height) * Math.abs(height) ** ((height < 0 ? nBot : nTop) / 2);
  const angle = Math.asin(sin);
  return skinUV(point.x, point.z < 0 ? Math.PI - angle : angle);
}

export type Aperture = THREE.Vector2[];
function mirror(angle: number, side: number) {
  return side > 0 ? angle : Math.PI - angle;
}

// The side view on p. 7 shows fifteen cabin windows on each side. The glass is
// rounded, with a short straight side between the upper and lower arcs.
export function cabinOpening(index: number, side: number): Aperture {
  const center = 6.23 - (index - 1) * 0.548;
  return Array.from({ length: 28 }, (_, i) => {
    const a = (i * Math.PI * 2) / 28;
    const c = Math.cos(a),
      s = Math.sin(a);
    return skinUV(
      center + 0.161 * Math.sign(c) * Math.abs(c) ** 0.79,
      mirror(0.205 + 0.161 * Math.sign(s) * Math.abs(s) ** 0.79, side),
    );
  });
}

// The front panes meet across a narrow center post. The side panes taper aft
// and sit between the windshield post and the crown of the cockpit.
export function cockpitOpening(front: boolean, side: number): Aperture {
  const corners = front
    ? [
        [10.97, 1.541],
        [10.33, 1.537],
        [10.19, 0.97],
        [10.2, 0.71],
        [10.57, 0.46],
        [10.81, 0.63],
        [10.96, 1.16],
      ]
    : [
        [10.5, 0.426],
        [10.13, 0.701],
        [9.83, 0.702],
        [9.49, 0.626],
        [9.6, 0.386],
        [9.89, 0.351],
      ];
  return roundPoly(corners, 0.085, 2).map(([x, t]) => skinUV(x, mirror(t, side)));
}
export const skylightOpening = (): Aperture =>
  Array.from({ length: 32 }, (_, i) => {
    const a = (i * Math.PI) / 16;
    return skinUV(7.61 + 0.241 * Math.cos(a), halfTurn + 0.155 * Math.sin(a));
  });
function centerOf(loop: Aperture) {
  return loop.reduce((total, v) => total.add(v), new THREE.Vector2()).divideScalar(loop.length);
}
function pointAtDepth(uv: THREE.Vector2, depth: number) {
  const p = skinPoint(uv);
  return p.addScaledVector(fuselageNormal(FUSE, p), depth);
}
// Profile rings proceed from the center of a pane (or the inner lip of a seal)
// toward the skin. Both use the exact same unwrapped perimeter as the aperture.
function glazedRings(loop: Aperture, profile: [number, number][]) {
  const center = centerOf(loop),
    positions: number[] = [],
    indices: number[] = [];
  const ccw = THREE.ShapeUtils.isClockWise(loop) ? [...loop].reverse() : loop;
  let previous = 0;
  for (const [r, [scale, depth]] of profile.entries()) {
    const start = positions.length / 3;
    if (scale === 0) positions.push(...pointAtDepth(center, depth).toArray());
    else for (const p of ccw) positions.push(...pointAtDepth(center.clone().lerp(p, scale), depth).toArray());
    if (r > 0) {
      for (let i = 0; i < ccw.length; i++) {
        const next = (i + 1) % ccw.length;
        if (profile[r - 1][0] === 0) indices.push(previous, start + i, start + next);
        else indices.push(previous + i, start + i, start + next, previous + i, start + next, previous + next);
      }
    }
    previous = start;
  }
  const g = new THREE.BufferGeometry()
    .setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    .setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export const glassPane = (loop: Aperture) =>
  glazedRings(loop, [
    [0, -0.008],
    [0.24, -0.008],
    [0.48, -0.008],
    [0.71, -0.008],
    [0.93, -0.008],
  ]);
export const windowFrame = (loop: Aperture) =>
  glazedRings(loop, [
    [0.926, -0.01],
    [0.951, 0.005],
    [1.001, 0.005],
    [1.012, 0.0008],
  ]);

// The left entrance uses the same developed skin and paint projection as the
// fuselage. The outer edge stays with the frame when the painted leaf swings away.
function entryOpening() {
  const shape = new THREE.Shape();
  shape.moveTo(7.95, 0.92);
  shape.bezierCurveTo(8.11, 1.01, 8.51, 1.0, 8.65, 0.91);
  shape.quadraticCurveTo(8.72, 0.85, 8.71, 0.73);
  shape.lineTo(8.66, -0.69);
  shape.quadraticCurveTo(8.64, -0.86, 8.48, -0.87);
  shape.lineTo(7.96, -0.87);
  shape.quadraticCurveTo(7.82, -0.86, 7.82, -0.71);
  shape.lineTo(7.84, 0.74);
  shape.quadraticCurveTo(7.84, 0.85, 7.95, 0.92);
  return shape
    .getSpacedPoints(88)
    .slice(0, -1)
    .map((p) => surfaceUV(FUSE.onSkin(p.x, p.y, -1, 1)));
}

export function doorSkin() {
  const loop = entryOpening();
  const center = centerOf(loop);
  return paintProjection(curvedPanel(loop.map((p) => center.clone().lerp(p, 0.987))));
}

export function doorFrame() {
  return glazedRings(entryOpening(), [
    [0.9, -0.14],
    [0.939, -0.075],
    [0.964, -0.018],
    [1.004, -0.002],
  ]);
}

export function doorSeal() {
  return glazedRings(entryOpening(), [
    [0.961, -0.019],
    [0.987, -0.003],
    [1.005, -0.001],
  ]);
}

export function allOpenings() {
  return [
    ...[-1, 1].flatMap((side) => [
      ...Array.from({ length: 15 }, (_, i) => cabinOpening(i + 1, side)),
      cockpitOpening(true, side),
      cockpitOpening(false, side),
    ]),
    skylightOpening(),
  ];
}

const paintBox = { x0: -11.22, x1: 12.84, y0: -halfTurn, y1: halfTurn };
export function hull() {
  const holes = [...allOpenings(), entryOpening()];
  const ends = [FUSE.xTail, FUSE.xNose];
  const outline = [
    skinUV(ends[0], -halfTurn),
    skinUV(ends[1], -halfTurn),
    skinUV(ends[1], 3 * halfTurn),
    skinUV(ends[0], 3 * halfTurn),
  ];
  const skin = curvedPanel(outline, holes);
  // Leave the aft end open for the recessed tailcone nozzle. The painted skin
  // wraps continuously over the crown, using angle instead of projected height.
  const nosePlate = FUSE.plate(FUSE.xNose);
  const cap = nosePlate.toNonIndexed();
  nosePlate.dispose();
  const g = mergeGeometries([skin, cap])!;
  skin.dispose();
  cap.dispose();
  return paintProjection(g);
}

function curvedPanel(outline: Aperture, holes: Aperture[] = []) {
  return curvedSkinPatch({
    outline,
    holes,
    side: 1,
    point: skinPoint,
    parameter: surfaceUV,
    normal: (p) => fuselageNormal(FUSE, p),
    uv: (p) => [p.x, p.y],
    parameterStep: (a, b) => a.distanceToSquared(b) / 0.085 ** 2,
    tolerance: 0.004,
  });
}

function paintProjection(g: THREE.BufferGeometry) {
  const painted = sidePaintUV(g, paintBox);
  const positions = painted.getAttribute("position"),
    uv = painted.getAttribute("uv");
  const p = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i);
    const { cy, hh, nTop, nBot } = FUSE.section(p.x);
    const h = THREE.MathUtils.clamp((p.y - cy) / hh, -1, 1);
    const angle = Math.asin(Math.sign(h) * Math.abs(h) ** ((h < 0 ? nBot : nTop) / 2));
    uv.setY(i, (angle + halfTurn) / Math.PI);
  }
  return painted;
}

// The center and side windows look onto the dark cockpit sidewalls. These
// liners hide the back of the exterior paint through the actual openings.
export function cockpitLiner(side: number) {
  const points: number[] = [],
    indices: number[] = [];
  const startX = side < 0 ? 8.77 : 8.32;
  for (let i = 0; i <= 16; i++)
    for (let j = 0; j <= 5; j++) {
      const u = skinUV(startX + ((11.09 - startX) * i) / 16, mirror(-0.62 + (0.9 * j) / 5, side));
      points.push(...pointAtDepth(u, -0.025).toArray());
      if (i && j) {
        const d = i * 6 + j;
        indices.push(d - 7, d - 1, d, d - 7, d, d - 6);
      }
    }
  const g = new THREE.BufferGeometry()
    .setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
    .setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// F-WSIX's nested charcoal and silver sweeps surround the window line.
// The thin red tracer doubles back low on the forward body.
export function paintHull() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 384;
  const w = canvas.width,
    h = canvas.height;
  const px = ([x, y]: number[]) => [
    ((x - paintBox.x0) / (paintBox.x1 - paintBox.x0)) * w,
    ((paintBox.y1 - y) / (paintBox.y1 - paintBox.y0)) * h,
  ];
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = FALCON_PEARL;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(0, h);
  ctx.scale(w / (paintBox.x1 - paintBox.x0), -h / (paintBox.y1 - paintBox.y0));
  ctx.translate(-paintBox.x0, -paintBox.y0);
  ctx.fillStyle = "#868f94";
  ctx.beginPath();
  ctx.moveTo(2.75, halfTurn + 0.03);
  ctx.bezierCurveTo(2.78, 1.26, 2.35, 1.18, 0.95, 1.1);
  ctx.bezierCurveTo(-0.8, 0.98, -3.53, 0.69, -3.53, 0.19);
  ctx.bezierCurveTo(-3.53, -0.51, -0.88, -0.53, 4.5, -0.45);
  ctx.bezierCurveTo(0.4, -0.49, -2.55, -0.4, -2.55, 0.2);
  ctx.bezierCurveTo(-2.55, 0.77, -0.25, 0.99, 1.48, 1.075);
  ctx.bezierCurveTo(2.08, 1.14, 2.31, 1.29, 2.31, halfTurn + 0.03);
  ctx.fill();
  ctx.fillStyle = "#273239";
  ctx.beginPath();
  ctx.moveTo(0.28, 1.06);
  ctx.bezierCurveTo(-1.5, 0.94, -2.84, 0.65, -2.84, 0.19);
  ctx.bezierCurveTo(-2.85, -0.42, -0.75, -0.48, 3.6, -0.46);
  ctx.bezierCurveTo(0.6, -0.45, -2.49, -0.4, -2.48, 0.2);
  ctx.bezierCurveTo(-2.48, 0.7, -1.23, 0.91, 0.28, 1.06);
  ctx.fill();
  ctx.strokeStyle = "#982c39";
  ctx.lineWidth = 0.019;
  ctx.beginPath();
  ctx.moveTo(4.55, halfTurn + 0.04);
  ctx.bezierCurveTo(4.55, 1.21, 4.38, 1.12, 2.99, 1.052);
  ctx.bezierCurveTo(1.79, 1.01, -0.49, 0.67, -0.47, 0.22);
  ctx.bezierCurveTo(-0.55, -0.48, 1.62, -0.46, 4.52, -0.46);
  ctx.bezierCurveTo(5.9, -0.46, 6.63, -0.67, 6.19, -1.13);
  ctx.stroke();
  ctx.strokeStyle = "#313d43";
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(9.58, -0.86);
  ctx.bezierCurveTo(8.68, -0.72, 8.09, -0.24, 7.4, -0.25);
  ctx.bezierCurveTo(6.91, -0.2, 6.6, -0.56, 5.51, -0.58);
  ctx.stroke();
  const texture = paintAtlas(canvas, px);
  const atlas = texture.image as HTMLCanvasElement;
  const ink = atlas.getContext("2d")!;
  const [x, y] = px([9.3, -0.15]);
  const legendHeight = (0.29 * h) / (paintBox.y1 - paintBox.y0);
  ink.font = `italic bold ${legendHeight * 1.35}px Arial, sans-serif`;
  ink.fillStyle = "#a02332";
  ink.textAlign = "center";
  ink.textBaseline = "middle";
  for (const u of [x, 2 * w - x]) ink.fillText("6X", u, y, (0.48 * w) / (paintBox.x1 - paintBox.x0));
  return texture;
}
