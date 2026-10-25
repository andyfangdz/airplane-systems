import { Box3, InstancedMesh, Mesh, Vector3, type Matrix4, type Object3D } from "three";

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

type PhysicalExtent = { matrix: Matrix4 } & ({ box: Box3 } | { envelope: XRotationEnvelope });

/** Support of the physical assembly in any world direction, without inventing corners between separate parts. */
function componentSupport(model: Object3D): ((direction: Vector3) => number) | null {
  const extents: PhysicalExtent[] = [];
  model.updateWorldMatrix(true, true);
  model.traverseVisible((object) => {
    for (let parent: Object3D | null = object; parent; parent = parent.parent) {
      if (parent.userData.cameraBounds === false) return;
      // A rotation envelope is authoritative for its descendants, independent of the sampled animation phase.
      if (parent !== object && parent.userData.cameraRotationEnvelope) return;
    }
    const envelope = object.userData.cameraRotationEnvelope as XRotationEnvelope | undefined;
    if (envelope) {
      extents.push({ matrix: object.matrixWorld, envelope });
      return;
    }
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox && !object.boundingBox.isEmpty())
        extents.push({ matrix: object.matrixWorld, box: object.boundingBox });
      return;
    }
    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox && !geometry.boundingBox.isEmpty())
      extents.push({ matrix: object.matrixWorld, box: geometry.boundingBox });
  });
  if (!extents.length) return null;
  return (direction) => {
    const { x, y, z } = direction;
    let farthest = -Infinity;
    for (const extent of extents) {
      const m = extent.matrix.elements;
      // Transpose the linear transform: dot(world point, direction) = dot(local point, local direction) + offset.
      const dx = m[0] * x + m[1] * y + m[2] * z,
        dy = m[4] * x + m[5] * y + m[6] * z,
        dz = m[8] * x + m[9] * y + m[10] * z;
      const offset = m[12] * x + m[13] * y + m[14] * z;
      let support: number;
      if ("envelope" in extent) {
        const { minX, maxX, radius } = extent.envelope;
        // The complete rotating cylinder, rather than the square corners of its enclosing box. This remains
        // phase-independent under translated, rotated and nonuniformly scaled ancestors.
        support = dx * (dx >= 0 ? maxX : minX) + radius * Math.hypot(dy, dz);
      } else {
        const { min, max } = extent.box;
        support = dx * (dx >= 0 ? max.x : min.x) + dy * (dy >= 0 ? max.y : min.y) + dz * (dz >= 0 ? max.z : min.z);
      }
      farthest = Math.max(farthest, offset + support);
    }
    return farthest;
  };
}

/** Visible physical meshes only. A decoration or selection outline may opt out at any ancestor. */
export function componentBounds(model: Object3D): Box3 {
  const support = componentSupport(model);
  if (!support) return new Box3();
  return new Box3(
    new Vector3(-support(new Vector3(-1, 0, 0)), -support(new Vector3(0, -1, 0)), -support(new Vector3(0, 0, -1))),
    new Vector3(support(new Vector3(1, 0, 0)), support(new Vector3(0, 1, 0)), support(new Vector3(0, 0, 1))),
  );
}

/**
 * Fit the physical assembly inside a safe screen rectangle, preserving the authored viewing direction. Each mesh
 * and rotational envelope meets all four camera edges directly; a single world box would add empty corner space.
 * Moving camera and target across the view plane clears the monitor and toolbar without tilting the model.
 */
export function fitComponentCamera(
  model: Box3 | Object3D,
  direction: Vector3,
  fov: number,
  width: number,
  height: number,
  safe: StageRect,
): { position: Vector3; target: Vector3 } | null {
  if (width <= 0 || height <= 0 || safe.right <= safe.left || safe.bottom <= safe.top) return null;
  const back = direction.clone().normalize();
  if (back.lengthSq() < 0.5) return null;
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), back);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(back, right).normalize();
  const support =
    model instanceof Box3
      ? model.isEmpty()
        ? null
        : (n: Vector3) =>
            n.x * (n.x >= 0 ? model.max.x : model.min.x) +
            n.y * (n.y >= 0 ? model.max.y : model.min.y) +
            n.z * (n.z >= 0 ? model.max.z : model.min.z)
      : componentSupport(model);
  if (!support) return null;
  const centre = new Vector3();
  for (const axis of [right, up, back])
    centre.addScaledVector(axis, (support(axis) - support(axis.clone().negate())) / 2);
  const tanY = Math.tan((fov * Math.PI) / 360),
    tanX = tanY * (width / height);
  const left = (safe.left / width) * 2 - 1,
    rightEdge = (safe.right / width) * 2 - 1,
    bottom = 1 - (safe.bottom / height) * 2,
    top = 1 - (safe.top / height) * 2;
  const cx = (left + rightEdge) / 2,
    cy = (bottom + top) / 2;
  const relativeSupport = (normal: Vector3) => support(normal) - centre.dot(normal);
  const edgeDistance = (axis: Vector3, scale: number, depth: number, span: number) =>
    relativeSupport(axis.clone().multiplyScalar(scale).addScaledVector(back, depth)) / span;
  const distance = Math.max(
    0.01,
    relativeSupport(back) + 0.01,
    edgeDistance(right, -1 / tanX, -left, cx - left),
    edgeDistance(right, 1 / tanX, rightEdge, rightEdge - cx),
    edgeDistance(up, -1 / tanY, -bottom, cy - bottom),
    edgeDistance(up, 1 / tanY, top, top - cy),
  );
  const target = centre.addScaledVector(right, -cx * distance * tanX).addScaledVector(up, -cy * distance * tanY);
  return { position: target.clone().addScaledVector(back, distance), target };
}
