/** Same source geometry and working animation in development, downloaded production and fallback. */
import * as THREE from "three";
import { expect, it } from "vitest";
import { AIRCRAFT_IDS } from "@/lib/systems";
import type { Catalogue } from "@/lib/catalogue";
import { geometryEntries, rebuildMesh } from "@/lib/mesh/prebuilt";
import { encodeMeshes } from "@/lib/mesh/encode";
import { decodeMeshes } from "@/lib/mesh/decode";

const bytes = (array: THREE.TypedArray) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

it.each(AIRCRAFT_IDS)(
  "%s: lossless catalogue round trip and live animation compatibility",
  async (id) => {
    const { CAT: cat }: { CAT: Catalogue } = await import(`../aircraft/${id}/parts/index.ts`);
    const entries = geometryEntries(cat).map(({ key, spec }) => ({ key, geometry: spec.geo() }));
    const encoded = await encodeMeshes(id, entries);
    const decoded = await decodeMeshes(encoded.buffer as ArrayBuffer, id);
    expect(decoded.map((m) => m.key)).toEqual(entries.map((e) => e.key));
    const byId = new Map(cat.parts.map((p) => [p.id, p]));
    for (let i = 0; i < entries.length; i++) {
      const { key, geometry: source } = entries[i];
      const rebuilt = rebuildMesh(decoded[i]);
      const expanded = decoded[i].unindexedSource ? rebuilt.toNonIndexed() : rebuilt;
      expect(Object.keys(expanded.attributes), key).toEqual(Object.keys(source.attributes));
      for (const name of Object.keys(source.attributes)) {
        expect(
          bytes(expanded.attributes[name].array).equals(bytes(source.attributes[name].array)),
          `${key}/${name}`,
        ).toBe(true);
        expect(expanded.attributes[name].normalized, key).toBe(source.attributes[name].normalized);
      }
      expect(expanded.groups, key).toEqual(source.groups);
      expect(
        source.index ? bytes(expanded.index!.array).equals(bytes(source.index.array)) : expanded.index === null,
        key,
      ).toBe(true);
      const part = byId.get(key);
      if (part?.anim) {
        const mesh = new THREE.Mesh(rebuilt, new THREE.MeshStandardMaterial());
        if (part.pos) mesh.position.fromArray(part.pos);
        if (part.rot) mesh.rotation.set(...part.rot);
        if (part.scale) mesh.scale.fromArray(part.scale);
        expect(() => {
          part.anim!(mesh, 0);
          part.anim!(mesh, 3);
        }, `${key}: animation must support prebuilt BufferGeometry`).not.toThrow();
      }
      if (expanded !== rebuilt) expanded.dispose();
      rebuilt.dispose();
    }
    // Procedural ownership is explicit for the CAPS draw-range animation as well as replacement cables/struts.
    if (id === "sr20" || id === "sr22t")
      expect(cat.parts.filter((p) => p.name === "Forward harness strap").every((p) => p.dynamicGeo)).toBe(true);
  },
  60_000,
);
