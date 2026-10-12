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

/** Find a rejected point on the rendered vertices, triangle centres or edge midpoints. */
export function firstSurfaceSample(geometry: THREE.BufferGeometry, rejects: (p: THREE.Vector3) => boolean) {
  const position = geometry.getAttribute("position"),
    index = geometry.getIndex();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    if (rejects(p)) return p.clone();
  }
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
    p.copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    if (rejects(p)) return p.clone();
    for (const [left, right] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      p.copy(left).add(right).multiplyScalar(0.5);
      if (rejects(p)) return p.clone();
    }
  }
}

export function namedPart(cat: Catalogue, name: string) {
  const part = cat.parts.find((p) => p.name === name);
  if (!part) throw new Error(`Missing ${cat.prefix} part: ${name}`);
  return part;
}
