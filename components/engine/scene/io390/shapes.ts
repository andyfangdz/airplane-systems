// Original study geometry. Lengths are metres. Sections are in the x/y plane, with +z out of the part.
import * as THREE from "three";
import { merge, zrod, type Mats } from "../kit";

export type XY = [number, number];
export type Point = [number, number, number];
export type Detail = {
  name: string;
  note: string;
  geometry: THREE.BufferGeometry;
  material: keyof Mats;
  spread?: Point;
};

export function section(points: XY[]) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  s.closePath();
  return s;
}

export function hole(s: THREE.Shape, x: number, y: number, radius: number) {
  s.holes.push(new THREE.Path().absarc(x, y, radius, 0, 2 * Math.PI, true));
}

export function plate(s: THREE.Shape, start: number, end: number, bevel = 0) {
  return new THREE.ExtrudeGeometry(s, {
    depth: end - start,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  }).translate(0, 0, start);
}

/** A bored sleeve, washer or split bearing shell. Angles are radians. */
export function sleeve(
  inside: number,
  outside: number,
  z0: number,
  z1: number,
  start = 0,
  arc = Math.PI * 2,
  sides = 32,
) {
  const profile = [
    [inside, z0],
    [outside, z0],
    [outside, z1],
    [inside, z1],
    [inside, z0],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    sides,
    start,
    arc,
  ).rotateX(Math.PI / 2);
}

export function bolt(r: number, length: number) {
  return merge([zrod(r, -length, 0, 10), zrod(r * 1.75, 0, r * 1.2, 6)]);
}

export function nut(r: number) {
  const s = section(
    Array.from({ length: 6 }, (_, i): XY => [
      r * 1.8 * Math.cos((i * Math.PI) / 3),
      r * 1.8 * Math.sin((i * Math.PI) / 3),
    ]),
  );
  hole(s, 0, 0, r);
  return plate(s, 0, r * 1.5);
}

export function stations(count: number, rx: number, ry = rx, phase = 0): XY[] {
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / count;
    return [rx * Math.cos(a), ry * Math.sin(a)];
  });
}

export function item(
  name: string,
  pn: string,
  ref: string,
  material: keyof Mats,
  geometry: THREE.BufferGeometry,
  role: string,
  spread?: Point,
): Detail {
  return { name, note: `${role} Lycoming PC-IO-390-C Rev. 1, Fig. ${ref} (${pn}).`, material, geometry, spread };
}

/** Separate physical pieces in the order of the authored mounting pattern. Each gets its own pick target. */
export function items(
  name: string,
  pn: string,
  ref: string,
  material: keyof Mats,
  pieces: THREE.BufferGeometry[],
  role: string,
  spread?: Point,
): Detail[] {
  return pieces.map((geometry, i) => item(name + " (" + (i + 1) + ")", pn, ref, material, geometry, role, spread));
}

export function atStations(points: XY[], build: () => THREE.BufferGeometry, z = 0) {
  return points.map(([x, y]) => build().translate(x, y, z));
}
