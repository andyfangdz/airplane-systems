import * as THREE from "three";
import { primeGeo, type Catalogue } from "@/lib/catalogue";
import type { BuiltMesh } from "./format";
import { bindSceneManifest, type RuntimeAssets } from "./scene-manifest";

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
  if (!mesh.procedural) g.userData.unindexedSource = mesh.unindexedSource;
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
  const runtime = JSON.parse(process.env.NEXT_PUBLIC_GEOMETRY_RUNTIME || "null") as RuntimeAssets | null;
  if (!path) return Promise.resolve(false);
  const promise = (async () => {
    try {
      const asset = runtime?.aircraft[cat.prefix];
      const [meshes, manifest] = await Promise.all([
        loadGeometry(path, cat.prefix),
        asset
          ? fetch(asset.scene).then(async (response) => {
              if (!response.ok) throw new Error(`Scene manifest: HTTP ${response.status}`);
              return response.json();
            })
          : null,
      ]);
      if (!meshes) throw new Error("Geometry asset unavailable");
      if (asset) bindSceneManifest(cat, manifest, asset);
      primeCatalogue(cat, meshes);
      return true;
    } catch (error) {
      if (!runtime) return false; // Development and source tests retain synchronous factories.
      console.warn("Prebuilt geometry unavailable; loading authoring recovery", error);
      const recovered = await loadRecovery(runtime.recovery, cat.prefix);
      primeCatalogue(cat, recovered);
      return true;
    }
  })().catch((error) => {
    pending.delete(cat); // A route Retry must make a fresh request.
    throw error;
  });
  pending.set(cat, promise);
  return promise;
}

/** Recovery code is a separate, original-source worker bundle, never a normal aircraft import. */
function loadRecovery(path: string, aircraft: string): Promise<BuiltMesh[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(path, { type: "module" });
    } catch (error) {
      reject(new Error("Aircraft geometry could not load. Retry the page.", { cause: error }));
      return;
    }
    let settled = false;
    const finish = (meshes?: BuiltMesh[], error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (meshes) resolve(meshes);
      else reject(new Error("Aircraft geometry recovery failed. Retry the page.", { cause: error }));
    };
    const timer = setTimeout(() => finish(undefined, "timeout"), 60_000);
    worker.onmessage = ({ data }) =>
      Array.isArray(data?.meshes) ? finish(data.meshes) : finish(undefined, data?.error);
    worker.onerror = (error) => finish(undefined, error.message);
    try {
      worker.postMessage({ aircraft });
    } catch (error) {
      finish(undefined, error);
    }
  });
}

/** One worker owns download, gzip and Wasm decoding, then transfers buffers and terminates on every exit path. */
export function loadGeometry(path: string, aircraft: string): Promise<BuiltMesh[] | null> {
  if (typeof Worker === "undefined") return loadWithoutWorker(path, aircraft);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./geometry.worker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      console.warn("Geometry worker unavailable; decoding on the main thread", error);
      resolve(loadWithoutWorker(path, aircraft));
      return;
    }
    let settled = false;
    const finish = (meshes: BuiltMesh[] | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) console.warn("Geometry worker failed; decoding on the main thread", error);
      resolve(meshes ?? loadWithoutWorker(path, aircraft));
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

async function loadWithoutWorker(path: string, aircraft: string): Promise<BuiltMesh[] | null> {
  try {
    const response = await fetch(path);
    if (!response.ok || !response.body) return null;
    const bytes = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    const { decodeMeshes } = await import("./decode");
    return await decodeMeshes(bytes, aircraft);
  } catch {
    return null;
  }
}
