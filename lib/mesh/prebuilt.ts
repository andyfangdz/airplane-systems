import * as THREE from "three";
import { primeGeo, type Catalogue } from "@/lib/catalogue";
import type { BuiltMesh } from "./format";

/** Keys are independent of optional-equipment state. Factories remain the source of truth and the fallback. */
export const geometryEntries = (cat: Catalogue) => [
  ...cat.shells.map((spec) => ({ key: spec.id, spec })),
  ...cat.surfaces.map((spec) => ({ key: `surface:${spec.key}`, spec })),
  // Animated replacement geometry may depend on TubeGeometry/LatheGeometry constructor metadata.
  // Those few meshes stay procedural; moving a mesh or changing its material does not exclude it.
  ...cat.parts.filter((spec) => !spec.dynamicGeo).map((spec) => ({ key: spec.id, spec })),
];

export function rebuildMesh(mesh: BuiltMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const a of mesh.attributes) g.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
  if (mesh.index) g.setIndex(new THREE.BufferAttribute(mesh.index, 1));
  for (const group of mesh.groups) g.addGroup(group.start, group.count, group.materialIndex);
  g.userData.unindexedSource = mesh.unindexedSource;
  return g;
}

/** Validate the whole catalogue before priming any entry; a partial/stale result cannot mix with the current model. */
export function primeCatalogue(cat: Catalogue, meshes: BuiltMesh[]) {
  const entries = geometryEntries(cat);
  const byKey = new Map(meshes.map((mesh) => [mesh.key, mesh]));
  if (byKey.size !== meshes.length || entries.length !== meshes.length || entries.some(({ key }) => !byKey.has(key)))
    throw new Error(`Geometry catalogue mismatch: ${cat.prefix}`);
  const built = entries.map(({ key, spec }) => ({ spec, geometry: rebuildMesh(byKey.get(key)!) }));
  for (const { spec, geometry } of built) if (!primeGeo(spec, geometry)) geometry.dispose();
}

const pending = new WeakMap<Catalogue, Promise<boolean>>();

export function prepareGeometry(cat: Catalogue): Promise<boolean> {
  const existing = pending.get(cat);
  if (existing) return existing;
  // Development uses the live factories so edits never show stale baked meshes.
  const paths: Record<string, string> = JSON.parse(process.env.NEXT_PUBLIC_GEOMETRY_ASSETS || "{}");
  const path = paths[cat.prefix];
  if (!path || typeof Worker === "undefined") return Promise.resolve(false);
  const promise = loadGeometry(path, cat.prefix).then((meshes) => {
    if (!meshes) return false;
    try {
      primeCatalogue(cat, meshes);
      return true;
    } catch (error) {
      console.warn("Prebuilt geometry rejected; using procedural geometry", error);
      return false;
    }
  });
  pending.set(cat, promise);
  return promise;
}

/** One worker owns download, gzip and Wasm decoding, then transfers buffers and terminates on every exit path. */
export function loadGeometry(path: string, aircraft: string): Promise<BuiltMesh[] | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./geometry.worker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      console.warn("Geometry worker unavailable; using procedural geometry", error);
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (meshes: BuiltMesh[] | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) console.warn("Prebuilt geometry unavailable; using procedural geometry", error);
      resolve(meshes);
    };
    const timer = setTimeout(() => finish(null, "download/decode timeout"), 15_000);
    worker.onmessage = ({ data }) =>
      Array.isArray(data?.meshes) ? finish(data.meshes) : finish(null, data?.error || "invalid reply");
    worker.onerror = (error) => finish(null, error.message);
    try {
      worker.postMessage({ path, aircraft });
    } catch (error) {
      finish(null, error);
    }
  });
}
