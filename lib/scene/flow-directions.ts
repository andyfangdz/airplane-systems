import * as THREE from "three";
import type { FlowResource } from "./flow-resources";

const UP = new THREE.Vector3(0, 1, 0);

/** A stationary arrow replaces moving particles; its direction and visibility still follow the live flow. */
export function createFlowDirection(item: FlowResource) {
  const length = Math.min(0.14, Math.max(0.04, (item.f.size ?? 0.08) * 1.4));
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(length * 0.28, length, 8),
    new THREE.MeshBasicMaterial({ depthWrite: false }),
  );
  mesh.position.copy(item.curve.getPointAt(0.55));
  mesh.raycast = () => {};
  mesh.visible = false;
  mesh.renderOrder = 1;
  mesh.name = "flow-direction";
  mesh.userData.presentation = true;
  mesh.userData.cameraBounds = false;
  return { mesh, forward: item.curve.getTangentAt(0.55), direction: new THREE.Vector3() };
}

export type FlowDirection = ReturnType<typeof createFlowDirection>;

export function updateFlowDirection(arrow: FlowDirection, rate: number, visible: boolean, color: THREE.Color) {
  arrow.mesh.visible = visible && rate !== 0;
  if (!arrow.mesh.visible) return;
  arrow.direction.copy(arrow.forward).multiplyScalar(Math.sign(rate));
  arrow.mesh.quaternion.setFromUnitVectors(UP, arrow.direction);
  arrow.mesh.material.color.copy(color);
}
