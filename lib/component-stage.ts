import { Box3, InstancedMesh, Mesh, Vector3, type Object3D } from "three";

export type StageRect = { left: number; top: number; right: number; bottom: number };
export type StageLabel = { id: string; rect: StageRect; priority: number; selected?: boolean };
/** Local cylinder enclosing a complete turn about x, including the moving assembly's pitch/stroke range. */
export type XRotationEnvelope = { minX: number; maxX: number; radius: number };

export const intersects = (a: StageRect, b: StageRect, pad = 0) =>
  a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

/** Deterministic priority order: selection wins, then authored importance, then name. */
export function visibleStageLabels(
  labels: StageLabel[],
  viewport: StageRect,
  obstacles: StageRect[],
  limit = Infinity,
  pad = 4,
): Set<string> {
  const kept = [...obstacles];
  const shown = new Set<string>();
  const ordered = [...labels].sort(
    (a, b) => Number(!!b.selected) - Number(!!a.selected) || a.priority - b.priority || a.id.localeCompare(b.id),
  );
  for (const label of ordered) {
    const r = label.rect;
    if (
      (!label.selected && shown.size >= limit) ||
      r.left < viewport.left + pad ||
      r.right > viewport.right - pad ||
      r.top < viewport.top + pad ||
      r.bottom > viewport.bottom - pad ||
      kept.some((other) => intersects(r, other, pad))
    )
      continue;
    shown.add(label.id);
    kept.push(r);
  }
  return shown;
}

/** Visible physical meshes only. A decoration or selection outline may opt out at any ancestor. */
export function componentBounds(model: Object3D): Box3 {
  const bounds = new Box3();
  model.updateWorldMatrix(true, true);
  model.traverseVisible((object) => {
    for (let parent: Object3D | null = object; parent; parent = parent.parent) {
      if (parent.userData.cameraBounds === false) return;
      // A rotation envelope is authoritative for its descendants, independent of the sampled animation phase.
      if (parent !== object && parent.userData.cameraRotationEnvelope) return;
    }
    const envelope = object.userData.cameraRotationEnvelope as XRotationEnvelope | undefined;
    if (envelope) {
      const { minX, maxX, radius } = envelope;
      const centre = new Vector3((minX + maxX) / 2, 0, 0).applyMatrix4(object.matrixWorld);
      const half = (maxX - minX) / 2;
      const m = object.matrixWorld.elements;
      // Exact axis-aligned bounds of the transformed cylinder. Unlike transforming its enclosing box, this stays
      // constant as the owner spins about x, including when a static ancestor rotates or scales the assembly.
      const extent = new Vector3(
        Math.abs(m[0]) * half + Math.hypot(m[4], m[8]) * radius,
        Math.abs(m[1]) * half + Math.hypot(m[5], m[9]) * radius,
        Math.abs(m[2]) * half + Math.hypot(m[6], m[10]) * radius,
      );
      bounds.union(new Box3(centre.clone().sub(extent), centre.clone().add(extent)));
      return;
    }
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox) bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
      return;
    }
    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

/**
 * Fit every corner inside a safe screen rectangle, preserving the authored viewing direction. Moving both camera
 * and target across the view plane puts the assembly above a monitor or below a toolbar without tilting the model.
 */
export function fitComponentCamera(
  bounds: Box3,
  direction: Vector3,
  fov: number,
  width: number,
  height: number,
  safe: StageRect,
): { position: Vector3; target: Vector3 } | null {
  if (bounds.isEmpty() || width <= 0 || height <= 0 || safe.right <= safe.left || safe.bottom <= safe.top) return null;
  const back = direction.clone().normalize();
  if (back.lengthSq() < 0.5) return null;
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), back);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(back, right).normalize();
  const centre = bounds.getCenter(new Vector3());
  const tanY = Math.tan((fov * Math.PI) / 360),
    tanX = tanY * (width / height);
  const left = (safe.left / width) * 2 - 1,
    rightEdge = (safe.right / width) * 2 - 1,
    bottom = 1 - (safe.bottom / height) * 2,
    top = 1 - (safe.top / height) * 2;
  const cx = (left + rightEdge) / 2,
    cy = (bottom + top) / 2;
  let distance = 0.01;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new Vector3(x, y, z).sub(centre);
        const depth = corner.dot(back),
          horizontal = corner.dot(right) / tanX,
          vertical = corner.dot(up) / tanY;
        distance = Math.max(
          distance,
          depth + 0.01,
          (-horizontal - left * depth) / (cx - left),
          (horizontal + rightEdge * depth) / (rightEdge - cx),
          (-vertical - bottom * depth) / (cy - bottom),
          (vertical + top * depth) / (top - cy),
        );
      }
  const target = centre.addScaledVector(right, -cx * distance * tanX).addScaledVector(up, -cy * distance * tanY);
  return { position: target.clone().addScaledVector(back, distance), target };
}
