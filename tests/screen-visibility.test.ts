import { expect, it } from "vitest";
import * as THREE from "three";
import { ScreenVisibility } from "@/lib/scene/screen-visibility";

it("redraws only displays facing the camera within its frustum, including moving parents", () => {
  const visibility = new ScreenVisibility();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial();
  const screen = new THREE.Mesh(geometry, material);
  const parent = new THREE.Group();
  parent.add(screen);
  parent.position.z = -5;
  visibility.update(camera);
  expect(visibility.contains(screen)).toBe(true);
  screen.rotation.y = Math.PI;
  expect(visibility.contains(screen)).toBe(false);
  screen.rotation.y = 0;
  parent.position.x = 10;
  expect(visibility.contains(screen)).toBe(false);
  parent.position.x = 0;
  expect(visibility.contains(screen)).toBe(true);
  camera.position.z = -10;
  camera.lookAt(0, 0, -5);
  visibility.update(camera);
  expect(visibility.contains(screen)).toBe(false);
  geometry.dispose();
  material.dispose();
});
