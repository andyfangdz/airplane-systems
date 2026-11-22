import { Box3, InstancedMesh, MathUtils, Mesh, Spherical, Vector2, Vector3, Matrix4, type Object3D } from "three";

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
function componentSupport(model: Object3D, preferSubjects = false) {
  const surrounding: PhysicalExtent[] = [],
    subjects: PhysicalExtent[] = [];
  model.updateWorldMatrix(true, true);
  // During a study transition, fit the final assembly without moving its rendered meshes.
  const visit = (object: Object3D, parentDestination?: Matrix4, parentSubject = false) => {
    if (!object.visible || object.userData.cameraBounds === false) return;
    const subject = preferSubjects && (parentSubject || object.userData.cameraSubject === true);
    const extents = subject ? subjects : surrounding;
    const local = object.userData.cameraDestination as Matrix4 | undefined;
    const destination =
      local || parentDestination
        ? new Matrix4().multiplyMatrices(
            parentDestination ?? object.parent?.matrixWorld ?? new Matrix4(),
            local ?? object.matrix,
          )
        : undefined;
    const matrix = destination ?? object.matrixWorld;
    const envelope = object.userData.cameraRotationEnvelope as XRotationEnvelope | undefined;
    if (envelope) {
      extents.push({ matrix, envelope });
      return;
    }
    if (object instanceof InstancedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox && !object.boundingBox.isEmpty()) extents.push({ matrix, box: object.boundingBox });
    } else if (object instanceof Mesh) {
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (geometry.boundingBox && !geometry.boundingBox.isEmpty()) extents.push({ matrix, box: geometry.boundingBox });
    }
    for (const child of object.children) visit(child, destination, subject);
  };
  visit(model);
  if (!subjects.length && !surrounding.length) return null;
  return {
    subject: extentSupport(subjects.length ? subjects : surrounding),
    context: subjects.length && surrounding.length ? extentSupport(surrounding) : undefined,
  };
}

type Support = (direction: Vector3) => number;
function extentSupport(extents: PhysicalExtent[]): Support {
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
  const support = componentSupport(model)?.subject;
  if (!support) return new Box3();
  return new Box3(
    new Vector3(-support(new Vector3(-1, 0, 0)), -support(new Vector3(0, -1, 0)), -support(new Vector3(0, 0, -1))),
    new Vector3(support(new Vector3(1, 0, 0)), support(new Vector3(0, 1, 0)), support(new Vector3(0, 0, 1))),
  );
}

/**
 * Fit the physical assembly inside a safe screen rectangle, preserving the authored viewing direction. Each mesh
 * and rotational envelope meets all four camera edges directly; a single world box would add empty corner space.
 * In a focused study, prefer the marked hardware and move the optical centre into the safe rectangle.
 * This keeps the physical orbit pivot on the hardware even when the monitor occupies the bottom of the stage.
 */
export function fitComponentCamera(
  model: Box3 | Object3D,
  direction: Vector3,
  fov: number,
  width: number,
  height: number,
  safe: StageRect,
  focused = false,
): { position: Vector3; target: Vector3; viewOffset: Vector2 } | null {
  if (width <= 0 || height <= 0 || safe.right <= safe.left || safe.bottom <= safe.top) return null;
  const back = direction.clone().normalize();
  if (back.lengthSq() < 0.5) return null;
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), back);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(back, right).normalize();
  const bounds: { subject: Support; context?: Support } | null =
    model instanceof Box3
      ? model.isEmpty()
        ? null
        : {
            subject: (n: Vector3) =>
              n.x * (n.x >= 0 ? model.max.x : model.min.x) +
              n.y * (n.y >= 0 ? model.max.y : model.min.y) +
              n.z * (n.z >= 0 ? model.max.z : model.min.z),
          }
      : componentSupport(model, focused);
  if (!bounds) return null;
  const { subject, context } = bounds;
  const centre = new Vector3();
  for (const axis of [right, up, back])
    centre.addScaledVector(axis, (subject(axis) - subject(axis.clone().negate())) / 2);
  const tanY = Math.tan((fov * Math.PI) / 360),
    tanX = tanY * (width / height);
  const left = (safe.left / width) * 2 - 1,
    rightEdge = (safe.right / width) * 2 - 1,
    bottom = 1 - (safe.bottom / height) * 2,
    top = 1 - (safe.top / height) * 2;
  const cx = (left + rightEdge) / 2,
    cy = (bottom + top) / 2;
  // setViewOffset shifts screen coordinates by (cx, cy). In that projection the safe
  // frustum is symmetric about the target. Other stage views retain their centred lens.
  const shiftX = focused ? cx : 0,
    shiftY = focused ? cy : 0;
  const fitDistance = (support: Support) => {
    const relativeSupport = (normal: Vector3) => support(normal) - centre.dot(normal);
    const edgeDistance = (axis: Vector3, scale: number, depth: number, span: number) =>
      relativeSupport(axis.clone().multiplyScalar(scale).addScaledVector(back, depth)) / span;
    return Math.max(
      0.01,
      relativeSupport(back) + 0.01,
      edgeDistance(right, -1 / tanX, shiftX - left, cx - left),
      edgeDistance(right, 1 / tanX, rightEdge - shiftX, rightEdge - cx),
      edgeDistance(up, -1 / tanY, shiftY - bottom, cy - bottom),
      edgeDistance(up, 1 / tanY, top - shiftY, top - cy),
    );
  };
  const primaryDistance = fitDistance(subject);
  // Let nearby fittings and leads share the frame, up to 30% more orbit distance.
  // A long harness can extend past the viewport while its magnetos stay legible.
  const distance = context
    ? Math.max(primaryDistance, Math.min(fitDistance(context), primaryDistance * 1.3))
    : primaryDistance;
  const target = centre
    .addScaledVector(right, (shiftX - cx) * distance * tanX)
    .addScaledVector(up, (shiftY - cy) * distance * tanY);
  return {
    position: target.clone().addScaledVector(back, distance),
    target,
    viewOffset: new Vector2((-shiftX * width) / 2, (shiftY * height) / 2),
  };
}

export type StageCameraPose = { position: Vector3; target: Vector3; viewOffset: Vector2 };

const MIN_POLAR = 1e-4;
const MAX_POLAR = Math.PI - 1e-4;
const _fromOffset = new Vector3();
const _toOffset = new Vector3();
const _fromSpherical = new Spherical();
const _toSpherical = new Spherical();

/**
 * Orbit smoothly between two fitted stage poses instead of cutting linearly through the assembly.
 * Interpolates the target linearly, the viewing offset in spherical coordinates (shortest azimuth),
 * and the lens view offset linearly.
 */
export function interpolateStageCamera(
  from: StageCameraPose,
  to: StageCameraPose,
  alpha: number,
  out: StageCameraPose,
) {
  if (alpha <= 0) {
    out.position.copy(from.position);
    out.target.copy(from.target);
    out.viewOffset.copy(from.viewOffset);
    return;
  }
  if (alpha >= 1) {
    out.position.copy(to.position);
    out.target.copy(to.target);
    out.viewOffset.copy(to.viewOffset);
    return;
  }
  out.target.lerpVectors(from.target, to.target, alpha);
  out.viewOffset.lerpVectors(from.viewOffset, to.viewOffset, alpha);
  _fromOffset.subVectors(from.position, from.target);
  _toOffset.subVectors(to.position, to.target);
  if (_fromOffset.lengthSq() < 1e-10 || _toOffset.lengthSq() < 1e-10) {
    out.position.lerpVectors(from.position, to.position, alpha);
    return;
  }
  _fromSpherical.setFromVector3(_fromOffset);
  _toSpherical.setFromVector3(_toOffset);
  const fromPole = Math.hypot(_fromOffset.x, _fromOffset.z) < 1e-6;
  const toPole = Math.hypot(_toOffset.x, _toOffset.z) < 1e-6;
  const theta0 = fromPole ? _toSpherical.theta : _fromSpherical.theta;
  const theta1 = toPole ? _fromSpherical.theta : _toSpherical.theta;
  const dTheta = Math.atan2(Math.sin(theta1 - theta0), Math.cos(theta1 - theta0));
  const radius = MathUtils.lerp(_fromSpherical.radius, _toSpherical.radius, alpha);
  const phi = MathUtils.clamp(MathUtils.lerp(_fromSpherical.phi, _toSpherical.phi, alpha), MIN_POLAR, MAX_POLAR);
  const theta = theta0 + dTheta * alpha;
  out.position.setFromSphericalCoords(radius, phi, theta).add(out.target);
}
