/** Schematic component detail inside an existing, source-located installation envelope.
 * These finishes do not assert manufacturer dimensions, fastener counts, terminals or hidden plumbing.
 * One mesh/material per component; the normal catalogue cache and prebuilt pipeline own it.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Catalogue, PartSpec } from "./catalogue";
import { bentCurve, box, cyl, mergeGeos } from "./geometry";
import { toV, type Vec3 } from "./math";
import type { SysId } from "./systems";

export type HardwareKind = "case" | "battery" | "radio" | "valve" | "pump" | "actuator" | "filter" | "canister";

/** Closed across x, hinged about z. The shaft stays in place as the plate rotates. */
export const butterflyGeo = (radius: number, shaftLength: number) =>
  mergeGeos([cyl(radius, radius * 0.12, "x", 32), cyl(radius * 0.15, shaftLength, "z", 16)]);

/** A short lever about its z-axis hub, replacing an undifferentiated linkage block. */
export const linkageGeo = () =>
  mergeGeos([
    cyl(0.0035, 0.006, "z", 20),
    box(0.004, 0.01, 0.003).translate(0, 0.005, 0),
    cyl(0.0025, 0.005, "z", 16).translate(0, 0.01, 0),
  ]);

/** Bowden sheath with rounded bends and recessed end ferrules; no fluid/electrical flow particles. */
export function controlCableGeo(points: Vec3[], radius = 0.0035) {
  const curve = bentCurve(points, 0.025);
  const pieces: THREE.BufferGeometry[] = [
    new THREE.TubeGeometry(curve, Math.max(32, Math.ceil(curve.getLength() * 100)), radius * 0.72, 8, false),
  ];
  for (const end of [0, 1]) {
    const at = toV(points[end ? points.length - 1 : 0]);
    const next = toV(points[end ? points.length - 2 : 1]);
    const length = Math.min(0.014, at.distanceTo(next) / 3);
    const direction = next.sub(at).normalize();
    const center = at.addScaledVector(direction, length / 2);
    pieces.push(
      cyl(radius, length, "y", 16)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
        .translate(center.x, center.y, center.z),
    );
  }
  const result = mergeGeos(pieces);
  pieces.forEach((piece) => piece.dispose());
  return result;
}

export function addControlCable(cat: Catalogue, name: string, points: Vec3[], note: string, sys: SysId[] = ["engine"]) {
  const spec = cat.part(() => controlCableGeo(points), sys, {
    name,
    color: "#60676E",
    pin: true,
    note:
      note +
      " Mechanical sheath routing, bend radii and ferrule dimensions are illustrative; endpoints represent control housings, not surveyed attachment holes.",
  });
  return { spec, points };
}

/** Coordinates are fractions of the existing envelope; no new protrusions or connection points. */
function hardwareShape(kind: HardwareKind) {
  const pieces: THREE.BufferGeometry[] = [];
  const block = (w: number, h: number, d: number, y = 0, x = 0, z = 0) =>
    pieces.push(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.08).translate(x, y, z));
  if (kind === "canister") {
    pieces.push(cyl(0.46, 0.84, "x", 24));
    pieces.push(cyl(0.5, 0.07, "x", 24).translate(-0.465, 0, 0));
    pieces.push(cyl(0.5, 0.07, "x", 24).translate(0.465, 0, 0));
  } else if (kind === "filter") {
    // Recessed media and a perimeter frame; pleat pitch is a visual convention, not a filter specification.
    block(1, 0.12, 1, -0.44);
    block(1, 0.12, 1, 0.44);
    block(0.12, 0.76, 1, 0, -0.44);
    block(0.12, 0.76, 1, 0, 0.44);
    for (let i = 0; i < 9; i++) pieces.push(box(0.055, 0.76, 0.72).translate(-0.32 + i * 0.08, 0, 0));
  } else if (kind === "pump" || kind === "actuator") {
    pieces.push(cyl(0.35, 0.62, "x", 24).translate(0.17, 0.05, 0));
    pieces.push(cyl(0.37, 0.04, "x", 24).translate(0.46, 0.05, 0));
    block(0.32, 0.77, 0.77, 0.035, -0.34);
    block(0.94, 0.12, 1, -0.44);
    if (kind === "actuator") block(0.05, 0.82, 0.82, 0.035, -0.475);
  } else if (kind === "valve") {
    block(1, 0.72, 1, -0.14);
    pieces.push(cyl(0.34, 0.23, "y", 24).translate(0, 0.355, 0));
    // A cover seam, deliberately no invented inlet/outlet nipples.
    pieces.push(cyl(0.37, 0.04, "y", 24).translate(0, 0.48, 0));
  } else {
    block(0.96, 0.86, 0.96, -0.03);
    block(1, 0.09, 1, 0.455);
    block(1, 0.06, 1, -0.47);
    if (kind === "radio") {
      // Rack rails and a recessed end plate, rather than unverified connector/vent patterns.
      block(1, 0.055, 0.07, -0.35, 0, -0.465);
      block(1, 0.055, 0.07, -0.35, 0, 0.465);
      block(0.025, 0.68, 0.82, 0, -0.4875);
    }
  }
  const triangles = pieces.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(triangles)!;
  for (const g of new Set([...pieces, ...triangles])) g.dispose();
  return merged;
}

/** Explicit per-aircraft selection only: no name heuristics or mutation of already detailed meshes. */
export function refineHardware(cat: Catalogue, selection: Partial<Record<HardwareKind, readonly string[]>>) {
  return Object.entries(selection).flatMap(([kind, names]) =>
    names!.flatMap((name) => {
      const parts = cat.parts.filter((part) => part.name === name);
      if (!parts.length) throw new Error(`${cat.prefix}: missing hardware ${name}`);
      return parts.map((spec) => {
        if (spec.dynamicGeo) throw new Error(`${spec.id}: cannot refine replacement geometry`);
        const source = spec.geo;
        spec.geo = () => {
          const envelope = source();
          const type = kind === "canister" ? "CylinderGeometry" : "BoxGeometry";
          if (envelope.type !== type) throw new Error(`${spec.id}: detail requires ${type}`);
          envelope.computeBoundingBox();
          const bounds = envelope.boundingBox!;
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const result = hardwareShape(kind as HardwareKind)
            .scale(size.x, size.y, size.z)
            .translate(center.x, center.y, center.z);
          // Source factories can retain their geometry; do not mutate or dispose it here.
          return result;
        };
        spec.note +=
          " Case contours, cover seams and mounting detail are illustrative within the existing installation envelope; no manufacturer dimensions or connection layout are inferred.";
        return { spec, source, kind: kind as HardwareKind };
      });
    }),
  );
}

/** Preserve the original material animation and use absolute poses so repeated frames never accumulate motion. */
export function bindHardwareMotion(
  cat: Catalogue,
  name: string,
  pose: (spec: PartSpec, index: number) => (mesh: THREE.Mesh) => void,
) {
  const parts = cat.parts.filter((part) => part.name === name);
  if (!parts.length) throw new Error(`${cat.prefix}: missing mechanism ${name}`);
  parts.forEach((spec, index) => {
    const previous = spec.anim,
      apply = pose(spec, index);
    spec.anim = (mesh, time) => {
      previous?.(mesh, time);
      apply(mesh);
    };
    spec.note += " Movement illustrates control operation; travel and rigging angles are not maintenance dimensions.";
  });
  return parts;
}
