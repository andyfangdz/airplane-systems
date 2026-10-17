import type { Catalogue, PartSpec, ShellSpec, SurfaceSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";

export const SCENE_FORMAT = 1;
export interface SceneEntry {
  id: string;
  kind: "part" | "shell" | "surface";
  metadata: Record<string, unknown>;
  bindings: Partial<Record<"anim" | "fitted" | "skin" | "solidMaterial", string>>;
  geometry: "compiled" | "dynamic";
  bounds: { min: Vec3; max: Vec3 };
}
export interface SceneManifest {
  version: typeof SCENE_FORMAT;
  aircraft: string;
  definitionDigest: string;
  meshAsset: string;
  entries: SceneEntry[];
}
export interface AircraftAssets {
  geometry: string;
  scene: string;
  definitionDigest: string;
}
export interface RuntimeAssets {
  version: 1;
  recovery: string;
  aircraft: Record<string, AircraftAssets>;
}

export const SCENE_BINDINGS = ["anim", "fitted", "skin", "solidMaterial"] as const;
export const sceneRecords = (cat: Catalogue) => [
  ...cat.shells.map((spec) => ({ id: spec.id, kind: "shell" as const, spec })),
  ...cat.surfaces.map((spec) => ({ id: `surface:${spec.key}`, kind: "surface" as const, spec })),
  ...cat.parts.map((spec) => ({ id: spec.id, kind: "part" as const, spec })),
];

/** Validate the complete binding set before installing any compiled presentation metadata. */
export function bindSceneManifest(cat: Catalogue, value: unknown, expected: AircraftAssets): SceneManifest {
  const scene = value as SceneManifest;
  if (
    scene?.version !== SCENE_FORMAT ||
    scene.aircraft !== cat.prefix ||
    scene.definitionDigest !== expected.definitionDigest ||
    scene.meshAsset !== expected.geometry ||
    !Array.isArray(scene.entries)
  )
    throw new Error(`Scene manifest mismatch: ${cat.prefix}`);
  const authored = sceneRecords(cat);
  const byId = new Map(scene.entries.map((entry) => [entry.id, entry]));
  if (byId.size !== scene.entries.length || authored.length !== scene.entries.length)
    throw new Error(`Scene entry count mismatch: ${cat.prefix}`);
  for (const { id, kind, spec } of authored) {
    const entry = byId.get(id);
    if (!entry || entry.kind !== kind || entry.geometry !== ((spec as PartSpec).dynamicGeo ? "dynamic" : "compiled"))
      throw new Error(`Scene entry mismatch: ${id}`);
    for (const key of SCENE_BINDINGS) {
      const callback = (spec as unknown as Record<string, unknown>)[key];
      if ((typeof callback === "function") !== (entry.bindings[key] === `${id}:${key}`))
        throw new Error(`Scene runtime binding mismatch: ${id}:${key}`);
    }
    for (const bound of [entry.bounds.min, entry.bounds.max])
      if (!Array.isArray(bound) || bound.length !== 3 || bound.some((n) => !Number.isFinite(n)))
        throw new Error(`Scene bounds mismatch: ${id}`);
    if (
      !entry.metadata ||
      typeof entry.metadata !== "object" ||
      Object.keys(entry.metadata).some(
        (key) =>
          SCENE_BINDINGS.includes(key as (typeof SCENE_BINDINGS)[number]) ||
          ["id", "key", "geo", "__proto__", "constructor", "prototype"].includes(key),
      )
    )
      throw new Error(`Scene metadata mismatch: ${id}`);
  }
  for (const { id, spec } of authored) Object.assign(spec, byId.get(id)!.metadata);
  return scene;
}

/** Bindings are ordinary authored functions. They are never serialized/evaluated from strings. */
export type RuntimeGeometrySpec = PartSpec | ShellSpec | SurfaceSpec;
