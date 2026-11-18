import * as THREE from "three";
import { afRing, loft } from "@/lib/geometry";
import { rod } from "../kit";

/** Schematic sections at fractions of the published radius, with twist relative to the 0.75 R pitch station. */
export function installedPropeller(radius: number, fixed: boolean) {
  const stations = [
    [0.055, 0.048, 0, 24],
    [0.14, 0.096, 0, 20],
    [0.28, fixed ? 0.13 : 0.15, 0, 13],
    [0.5, fixed ? 0.142 : 0.171, 0.002, 6],
    [0.75, fixed ? 0.112 : 0.143, 0.005, 0],
    [0.92, fixed ? 0.084 : 0.113, fixed ? 0.008 : 0.02, -4],
    [0.987, fixed ? 0.069 : 0.089, fixed ? 0.012 : 0.03, -5],
    [1, fixed ? 0.045 : 0.052, fixed ? 0.015 : 0.034, -5],
  ];
  const axis = new THREE.Vector3(0, 1, 0);
  const sections = stations.map(([span, chord, sweep, twist]) =>
    afRing(0, 1, span < 0.2 ? 0.25 : 0.12, 0.025).map(([u, h]) =>
      new THREE.Vector3(chord * h, span * radius, chord * (u - 0.4) + sweep)
        .applyAxisAngle(axis, (-twist * Math.PI) / 180)
        .add(new THREE.Vector3(0.047, 0, 0)),
    ),
  );
  const spinner = new THREE.LatheGeometry(
    [
      [0.119, 0],
      [0.122, 0.032],
      [0.116, 0.078],
      [0.104, 0.123],
      [0.082, 0.176],
      [0.052, 0.216],
      [0.026, 0.24],
      [0, 0.25],
    ].map(([r, x]) => new THREE.Vector2(r, x)),
    48,
  ).rotateZ(-Math.PI / 2);
  return {
    blade: loft(sections.slice(0, 6)),
    tip: loft(sections.slice(5)),
    spinner,
    hub: rod(fixed ? 0.074 : 0.086, fixed ? 0.052 : 0.104, 40).translate(0.045, 0, 0),
  };
}
