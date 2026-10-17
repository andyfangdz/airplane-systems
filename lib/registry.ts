/** Handles to live three.js objects so UI code can locate parts in the scene. */
import * as THREE from "three";
import { flashFocus, revealStage, useView, type AircraftSessionOwner } from "./view";

/**
 * Meshes of the mounted airplane, by part name: the first pinned mesh of each name (the one that carries the label, as
 * `Catalogue.pinned` picks it), else the first mounted one. Part meshes join with `registerPart`.
 */
export const partObjects = new Map<string, THREE.Mesh>();
const mounted = new Map<string, { mesh: THREE.Mesh; pinned: boolean; owner: AircraftSessionOwner | null }[]>();

function pickRegistered(name: string) {
  const entries = mounted.get(name) ?? [];
  const mesh = (entries.find((entry) => entry.pinned) ?? entries[0])?.mesh;
  if (mesh) partObjects.set(name, mesh);
  else {
    partObjects.delete(name);
    mounted.delete(name);
  }
}

/** Route cleanup removes only that scene's registrations, even if another scene has already committed. */
export function clearSceneParts(owner: AircraftSessionOwner) {
  for (const [name, entries] of mounted) {
    mounted.set(
      name,
      entries.filter((entry) => entry.owner !== owner),
    );
    pickRegistered(name);
  }
}

/** Add a mounted part mesh to `partObjects`; the returned function removes it again (on unmount). */
export function registerPart(
  name: string,
  mesh: THREE.Mesh,
  pinned: boolean,
  owner: AircraftSessionOwner | null = null,
) {
  if (owner && useView.getState().session !== owner) return () => {};
  mounted.set(name, [...(mounted.get(name) ?? []), { mesh, pinned, owner }]);
  pickRegistered(name);
  // "tap to locate" asked for this part before it was mounted (a progressive build still adding it): go there now
  if (waiting === name) {
    waiting = null;
    focusPart(name);
  }
  return () => {
    const rest = (mounted.get(name) ?? []).filter((e) => e.mesh !== mesh);
    mounted.set(name, rest);
    pickRegistered(name);
  };
}
/** The scene's camera and orbit target, and how many times the user has moved the camera (not a mere tap). */
export const view: {
  owner: AircraftSessionOwner | null;
  camera: THREE.Camera | null;
  target: THREE.Vector3 | null;
  moves: number;
} = {
  owner: null,
  camera: null,
  target: null,
  moves: 0,
};

export function clearSceneCamera(owner: AircraftSessionOwner) {
  if (view.owner !== owner) return;
  view.owner = null;
  view.camera = null;
  view.target = null;
}

/** Only a committed scene owned by the current route may supply live camera framing. */
export function registerSceneCamera(owner: AircraftSessionOwner, camera: THREE.Camera, target: THREE.Vector3 | null) {
  if (useView.getState().session !== owner) return () => {};
  Object.assign(view, { owner, camera, target });
  return () => {
    if (view.camera === camera) clearSceneCamera(owner);
  };
}

/** A part "tap to locate" asked for that is not mounted yet: focused as soon as it is. */
let waiting: string | null = null;
// Navigation and Reset view supersede a locate request, even if the user returns before the part mounts.
useView.subscribe((next, previous) => {
  if (
    next.session !== previous.session ||
    next.ac !== previous.ac ||
    next.sys !== previous.sys ||
    next.cam !== previous.cam
  )
    waiting = null;
});

/** Fly the camera to a named part (keeping the current viewing direction) and flash it; a part not mounted yet, once it is. */
export function focusPart(name: string) {
  // phones: the list is far below the 3D view
  revealStage();
  flashFocus(name);
  const o = partObjects.get(name);
  waiting = o ? null : name;
  if (!o) return;
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  // a part mounted this moment has no world matrix from a render yet
  o.updateWorldMatrix(true, false);
  const c = o.localToWorld(g.boundingSphere!.center.clone());
  const dir =
    view.owner === useView.getState().session && view.camera && view.target
      ? view.camera.position.clone().sub(view.target).normalize()
      : new THREE.Vector3(1, 0.6, 1).normalize();
  const p = c.clone().add(dir.multiplyScalar(2.6));
  useView.getState().flyTo([p.x, p.y, p.z], [c.x, c.y, c.z]);
}
