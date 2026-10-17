// vitest: isolate
/**
 * Prebuilt geometry is keyed by part and shell id (lib/mesh/prebuilt.ts). `npm run build` bakes it from every catalogue
 * loaded in one Node process (scripts/build-geometry.mjs). These tests load each authoring catalogue in a fresh module
 * graph and require the same explicit identity mapping as the fleet compiler, then verify prebuilt priming against it.
 * Production mounts validated compiled scene metadata; authored identities survive label edits and insertions.
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

  it("preserve authored identities when another declaration is inserted", () => {
    const build = (extra: boolean) => {
      const cat = new Catalogue("t");
      cat.shell(box, "Fuselage", "", false, "tests.catalogue-ids.test.fuselage.001");
      cat.part(box, ["engine"], {
        id: "tests.catalogue-ids.test.pump.002",
        name: "Pump",
        pin: true,
      });
      if (extra)
        cat.part(box, ["fuel"], {
          id: "tests.catalogue-ids.test.inserted.003",
          name: "Inserted",
          pin: true,
        });
      cat.part(box, ["engine"], { id: "tests.catalogue-ids.test.pump.004", name: "Pump" });
      cat.part(box, ["engine"], { id: "tests.catalogue-ids.test.fuselage.005", name: "Fuselage" });
      cat.part(box, ["engine"], { id: "tests.catalogue-ids.test.part.006" });
      return cat;
    };
    const ids = (cat: Catalogue) => [...cat.shells, ...cat.parts].map((p) => p.id);
    expect(ids(build(false))).toEqual([
      "t/tests.catalogue-ids.test.fuselage.001",
      "t/tests.catalogue-ids.test.pump.002",
      "t/tests.catalogue-ids.test.pump.004",
      "t/tests.catalogue-ids.test.fuselage.005",
      "t/tests.catalogue-ids.test.part.006",
    ]);
    expect(ids(build(true)).filter((id) => id !== "t/tests.catalogue-ids.test.inserted.003")).toEqual(
      ids(build(false)),
    );
  });

  it("leave the label pin on the first part of each name", () => {
    const cat = new Catalogue("t");
    const first = cat.part(box, ["engine"], { id: "tests.catalogue-ids.test.pump.007", name: "Pump", pin: true });
    const second = cat.part(box, ["engine"], { id: "tests.catalogue-ids.test.pump.008", name: "Pump", pin: true });
    expect(cat.pinned("engine")).toEqual([first]);
    expect(cat.isPinned(first, "engine")).toBe(true);
    expect(cat.isPinned(second, "engine")).toBe(false);
    for (const p of cat.parts) specGeo(p).dispose();
  });
});
