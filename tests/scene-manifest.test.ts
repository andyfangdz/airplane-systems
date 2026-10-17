import { describe, expect, it } from "vitest";
import { BoxGeometry } from "three";
import { Catalogue } from "@/lib/catalogue";
import { bindSceneManifest } from "@/lib/mesh/scene-manifest";
import { compileSceneManifest } from "@/authoring/scene-manifest";

describe("compiled scene presentation and live bindings", () => {
  const create = () => {
    const cat = new Catalogue("test");
    cat.part(() => new BoxGeometry(1, 2, 3), ["electrical"], {
      instance: [[1, 2, 3]],
      id: "tests.scene-manifest.test.display.001",
      name: "Display",
      note: "Published installation reference",
      pos: [1, 2, 3],
      pin: true,
      anim: (mesh) => {
        mesh.visible = true;
      },
      fitted: () => false,
    });
    cat.part(() => new BoxGeometry(), ["controls"], {
      id: "tests.scene-manifest.test.cable.002",
      name: "Cable",
      dynamicGeo: true,
    });
    return cat;
  };
  const expected = {
    geometry: "/geometry/test.bin.gz",
    scene: "/geometry/test.scene.json",
    definitionDigest: "definition-v1",
  };

  it("records exact bounds, authored notes and identities without serializing executable callbacks", () => {
    const cat = create();
    const manifest = compileSceneManifest(cat, expected.definitionDigest, expected.geometry);
    expect(manifest.entries[0]).toMatchObject({
      id: cat.parts[0].id,
      geometry: "compiled",
      bounds: { min: [-0.5, -1, -1.5], max: [0.5, 1, 1.5] },
      metadata: { note: "Published installation reference", pos: [1, 2, 3], pin: true },
      bindings: { anim: `${cat.parts[0].id}:anim`, fitted: `${cat.parts[0].id}:fitted` },
    });
    expect(manifest.entries[1].geometry).toBe("dynamic");
    const animation = cat.parts[0].anim;
    bindSceneManifest(cat, JSON.parse(JSON.stringify(manifest)), expected);
    expect(cat.parts[0].anim).toBe(animation);
    expect(cat.parts[0].fitted!()).toBe(false);
  });

  it("rejects stale definitions, missing bindings, duplicate identities and invalid bounds before mutation", () => {
    for (const corrupt of [
      (scene: ReturnType<typeof compileSceneManifest>) => {
        scene.definitionDigest = "stale";
      },
      (scene: ReturnType<typeof compileSceneManifest>) => {
        delete scene.entries[0].bindings.anim;
      },
      (scene: ReturnType<typeof compileSceneManifest>) => {
        scene.entries[1].id = scene.entries[0].id;
      },
      (scene: ReturnType<typeof compileSceneManifest>) => {
        scene.entries[0].bounds.min[0] = NaN;
      },
    ]) {
      const cat = create();
      const scene = compileSceneManifest(cat, expected.definitionDigest, expected.geometry);
      scene.entries[0].metadata.note = "Must not apply";
      corrupt(scene);
      expect(() => bindSceneManifest(cat, scene, expected)).toThrow();
      expect(cat.parts[0].note).toBe("Published installation reference");
    }
  });
});
