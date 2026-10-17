import type { Catalogue, PartSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { BufferGeometry } from "three";
import {
  SCENE_FORMAT,
  SCENE_BINDINGS,
  sceneRecords,
  type SceneManifest,
  type SceneEntry,
} from "@/lib/mesh/scene-manifest";

/** The build records serializable presentation facts independently of live callbacks. */
export function compileSceneManifest(
  cat: Catalogue,
  definitionDigest: string,
  meshAsset: string,
  built?: Map<string, BufferGeometry>,
): SceneManifest {
  const entries = sceneRecords(cat).map(({ id, kind, spec }): SceneEntry => {
    const metadata: Record<string, unknown> = {};
    const active: SceneEntry["bindings"] = {};
    for (const [key, value] of Object.entries(spec)) {
      if (key === "geo" || key === "id" || key === "key") continue;
      if (typeof value === "function") {
        if (!SCENE_BINDINGS.includes(key as (typeof SCENE_BINDINGS)[number]))
          throw new Error(`${id}: unknown runtime binding ${key}`);
        active[key as (typeof SCENE_BINDINGS)[number]] = `${id}:${key}`;
      } else if (value !== undefined) metadata[key] = value;
    }
    const geo = built?.get(id) ?? spec.geo();
    geo.computeBoundingBox();
    if (!geo.boundingBox || geo.boundingBox.isEmpty()) throw new Error(`${id}: geometry has no bounds`);
    const bounds = { min: geo.boundingBox.min.toArray() as Vec3, max: geo.boundingBox.max.toArray() as Vec3 };
    // Factories can return a cached object. Ownership remains with the authoring catalogue.
    return {
      id,
      kind,
      metadata,
      bindings: active,
      geometry: (spec as PartSpec).dynamicGeo ? "dynamic" : "compiled",
      bounds,
    };
  });
  return { version: SCENE_FORMAT, aircraft: cat.prefix, definitionDigest, meshAsset, entries };
}
