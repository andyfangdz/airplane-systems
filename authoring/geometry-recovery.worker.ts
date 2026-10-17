/** Independently bundled original authoring modules. Loaded only after a compiled asset fails. */
import type { Catalogue } from "@/lib/catalogue";
import type { BuiltMesh } from "@/lib/mesh/format";
import { meshTransfers } from "@/lib/mesh/format";

/** The compiler generates explicit lazy imports from AIRCRAFT_IDS; this worker has no hand-maintained fleet list. */
export function installRecoveryWorker(definitions: Record<string, () => Promise<{ CAT: Catalogue }>>) {
  self.onmessage = async ({ data }: MessageEvent<{ aircraft: string }>) => {
    try {
      const load = definitions[data.aircraft];
      if (!load) throw new Error(`Unknown aircraft: ${data.aircraft}`);
      const { CAT: cat }: { CAT: Catalogue } = await load();
      const entries = [
        ...cat.shells.map((spec) => ({ key: spec.id, spec })),
        ...cat.surfaces.map((spec) => ({ key: `surface:${spec.key}`, spec })),
        ...cat.parts.filter((spec) => !spec.dynamicGeo).map((spec) => ({ key: spec.id, spec })),
      ];
      const meshes: BuiltMesh[] = entries.map(({ key, spec }) => {
        const geometry = spec.geo();
        return {
          key,
          procedural: true,
          attributes: Object.entries(geometry.attributes).map(([name, a]) => ({
            name,
            array: a.array as Float32Array,
            itemSize: a.itemSize,
            normalized: a.normalized,
          })),
          index: (geometry.index?.array as Uint16Array | Uint32Array | undefined) ?? null,
          groups: geometry.groups,
          unindexedSource: false,
        };
      });
      postMessage({ meshes, recovery: true }, { transfer: [...new Set(meshTransfers(meshes))] });
    } catch (error) {
      postMessage({ error: String(error) });
    }
  };
}
