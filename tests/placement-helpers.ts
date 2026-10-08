import * as THREE from "three";
import type { Catalogue, PartSpec } from "@/lib/catalogue";

/** Part transform used by the scene; a supplied parent matrix places moving-group geometry. Caller disposes it. */
export function worldGeometry(part: PartSpec, parent?: THREE.Matrix4) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...(part.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rot ?? [0, 0, 0]))),
    new THREE.Vector3(...(part.scale ?? [1, 1, 1])),
  );
  if (parent) matrix.premultiply(parent);
  return part.geo().applyMatrix4(matrix);
}

export function partBounds(part: PartSpec, parent?: THREE.Matrix4) {
  const geometry = worldGeometry(part, parent);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!.clone();
  geometry.dispose();
  return bounds;
}

export function points(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  return Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
}

export function namedPart(cat: Catalogue, name: string) {
  const part = cat.parts.find((p) => p.name === name);
  if (!part) throw new Error(`Missing ${cat.prefix} part: ${name}`);
  return part;
}
