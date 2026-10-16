// vitest: isolate
/**
 * Prebuilt geometry is keyed by part and shell id (lib/mesh/prebuilt.ts). `npm run build` bakes it from every catalogue
 * loaded in one Node process (scripts/build-geometry.mjs); the browser evaluates one airplane's catalogue on its own and
 * `primeCatalogue` rejects the asset on any mismatch, after which the airplane quietly draws its procedural geometry.
 * These make that mismatch loud: each airplane's catalogue, built alone in a fresh module graph, has the ids the build
 * baked and primes from them; and an id depends only on its name and the same-named parts before it.
 */
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { Catalogue, specGeo } from "@/lib/catalogue";
import type { BuiltMesh } from "@/lib/mesh/format";
import { geometryEntries, primeCatalogue } from "@/lib/mesh/prebuilt";
import { AIRCRAFT_IDS } from "@/lib/systems";

const load = async (id: string): Promise<Catalogue> => (await import(`../aircraft/${id}/parts/index.ts`)).CAT;

/** A stand-in for a decoded mesh: priming checks only keys, so one triangle per entry will do. */
const stub = (key: string): BuiltMesh => ({
  key,
  attributes: [{ name: "position", array: new Float32Array(9), itemSize: 3, normalized: false }],
  index: null,
  groups: [],
  unindexedSource: false,
});

describe("prebuilt geometry keys", () => {
  it("are the same for an airplane built alone as for the whole fleet built in one process", async () => {
    // As scripts/build-geometry.mjs does: every airplane, in AIRCRAFT_IDS order, in one module graph.
    const baked: Record<string, string[]> = {};
    for (const id of AIRCRAFT_IDS) baked[id] = geometryEntries(await load(id)).map((e) => e.key);
    for (const id of AIRCRAFT_IDS) {
      vi.resetModules();
      const alone = await load(id);
      expect(
        geometryEntries(alone).map((e) => e.key),
        id,
      ).toEqual(baked[id]);
      expect(() => primeCatalogue(alone, baked[id].map(stub)), id).not.toThrow();
    }
  }, 120_000);
});

describe("part ids", () => {
  const box = () => new THREE.BoxGeometry();

  it("count only same-named parts and shells, so adding a part leaves every other id unchanged", () => {
    const build = (extra: boolean) => {
      const cat = new Catalogue("t");
      cat.shell(box, "Fuselage", "");
      cat.part(box, ["engine"], { name: "Pump", pin: true });
      if (extra) cat.part(box, ["fuel"], { name: "Inserted", pin: true });
      cat.part(box, ["engine"], { name: "Pump" });
      cat.part(box, ["engine"], { name: "Fuselage" });
      cat.part(box, ["engine"]);
      return cat;
    };
    const ids = (cat: Catalogue) => [...cat.shells, ...cat.parts].map((p) => p.id);
    expect(ids(build(false))).toEqual(["t/Fuselage-0", "t/Pump-0", "t/Pump-1", "t/Fuselage-1", "t/part-0"]);
    expect(ids(build(true)).filter((id) => id !== "t/Inserted-0")).toEqual(ids(build(false)));
  });

  it("leave the label pin on the first part of each name", () => {
    const cat = new Catalogue("t");
    const first = cat.part(box, ["engine"], { name: "Pump", pin: true });
    const second = cat.part(box, ["engine"], { name: "Pump", pin: true });
    expect(cat.pinned("engine")).toEqual([first]);
    expect(cat.isPinned(first, "engine")).toBe(true);
    expect(cat.isPinned(second, "engine")).toBe(false);
    for (const p of cat.parts) specGeo(p).dispose();
  });
});
