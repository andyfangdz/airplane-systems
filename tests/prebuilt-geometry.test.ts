import * as THREE from "three";
import { describe, expect, it, vi, afterEach } from "vitest";
import { Catalogue, specGeo } from "@/lib/catalogue";
import { encodeMeshes } from "@/lib/mesh/encode";
import { decodeMeshes } from "@/lib/mesh/decode";
import { geometryEntries, loadGeometry, primeCatalogue, rebuildMesh } from "@/lib/mesh/prebuilt";

const bytes = (array: THREE.TypedArray) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

describe("prebuilt geometry fidelity", () => {
  it("preserves every attribute, index, seam, group and triangle in an indexed mesh", async () => {
    const source = new THREE.BoxGeometry(1, 2, 3, 3, 3, 3);
    const [decoded] = await decodeMeshes(
      (await encodeMeshes("test", [{ key: "box", geometry: source }])).buffer as ArrayBuffer,
      "test",
    );
    const restored = rebuildMesh(decoded);
    for (const name of Object.keys(source.attributes))
      expect(bytes(restored.attributes[name].array)).toEqual(bytes(source.attributes[name].array));
    expect(bytes(restored.index!.array)).toEqual(bytes(source.index!.array));
    expect(restored.groups).toEqual(source.groups);
    expect(decoded.unindexedSource).toBe(false);
  });

  it("indexes triangle soup without merging UV/normal seams or losing signed zero", async () => {
    const source = new THREE.SphereGeometry(1, 32, 24).toNonIndexed();
    source.attributes.position.setX(0, -0);
    const [decoded] = await decodeMeshes(
      (await encodeMeshes("test", [{ key: "skin", geometry: source }])).buffer as ArrayBuffer,
      "test",
    );
    const restored = rebuildMesh(decoded);
    expect(restored.attributes.position.count).toBeLessThan(source.attributes.position.count);
    const triangles = restored.toNonIndexed();
    for (const name of Object.keys(source.attributes))
      expect(bytes(triangles.attributes[name].array)).toEqual(bytes(source.attributes[name].array));
    expect(decoded.unindexedSource).toBe(true);
  });

  it("rejects wrong aircraft, truncated headers, corrupted streams and unsupported versions", async () => {
    const packed = await encodeMeshes("test", [{ key: "box", geometry: new THREE.BoxGeometry() }]);
    await expect(decodeMeshes(packed.buffer as ArrayBuffer, "wrong")).rejects.toThrow("aircraft mismatch");
    await expect(decodeMeshes(packed.slice(0, 10).buffer, "test")).rejects.toThrow();
    await expect(decodeMeshes(packed.slice(0, -5).buffer, "test")).rejects.toThrow();
    const version = packed.slice();
    const header = new TextDecoder().decode(version);
    version[header.indexOf('"version":1') + 10] = "2".charCodeAt(0);
    await expect(decodeMeshes(version.buffer, "test")).rejects.toThrow("version/aircraft mismatch");
  });

  it("primes all optional parts without running their factories and rejects partial catalogues atomically", async () => {
    const cat = new Catalogue("test");
    const factory = vi.fn(() => new THREE.BoxGeometry());
    const part = cat.part(factory, ["engine"], { name: "Optional part", fitted: () => false });
    cat.part(factory, ["controls"], { name: "Moving cable", dynamicGeo: true });
    const entries = geometryEntries(cat);
    expect(entries).toHaveLength(1);
    const decoded = await decodeMeshes(
      (
        await encodeMeshes(
          "test",
          entries.map(({ key }) => ({ key, geometry: new THREE.BoxGeometry() })),
        )
      ).buffer as ArrayBuffer,
      "test",
    );
    expect(() => primeCatalogue(cat, [])).toThrow("catalogue mismatch");
    primeCatalogue(cat, decoded);
    expect(specGeo(part).attributes.position.count).toBeGreaterThan(0);
    expect(factory).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("terminates a failed or silent asset worker and resolves to procedural fallback", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers();
  const terminate = vi.fn();
  let reply: ((event: { data: unknown }) => void) | null = null;
  vi.stubGlobal(
    "Worker",
    class {
      set onmessage(fn: typeof reply) {
        reply = fn;
      }
      terminate = terminate;
      postMessage() {}
    },
  );
  const failed = loadGeometry("/geometry/test.bin.gz", "test");
  reply!({ data: { error: "404" } });
  expect(await failed).toBeNull();
  const silent = loadGeometry("/geometry/test.bin.gz", "test");
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await silent).toBeNull();
  expect(terminate).toHaveBeenCalledTimes(2);
});
