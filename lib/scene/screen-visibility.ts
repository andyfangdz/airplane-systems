import * as THREE from "three";

/** Reusable visibility query for the front faces of the cockpit's plane meshes. */
export class ScreenVisibility {
  private readonly frustum = new THREE.Frustum();
  private readonly projection = new THREE.Matrix4();
  private readonly eye = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();

  update(camera: THREE.Camera) {
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    this.eye.setFromMatrixPosition(camera.matrixWorld);
  }

  contains(mesh: THREE.Mesh) {
    mesh.updateWorldMatrix(true, false);
    this.position.setFromMatrixPosition(mesh.matrixWorld);
    this.normal.set(0, 0, 1).applyNormalMatrix(this.normalMatrix.getNormalMatrix(mesh.matrixWorld));
    return (
      this.normal.dot(this.position.subVectors(this.eye, this.position)) > 0 && this.frustum.intersectsObject(mesh)
    );
  }
}
