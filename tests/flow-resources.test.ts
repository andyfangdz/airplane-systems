import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { FlowSpec } from "@/lib/catalogue";
import { curveOf } from "@/lib/geometry";
import { createFlowParticleBatches, FlowResources, flowBounds } from "@/lib/scene/flow-resources";

const flow = (key: string): FlowSpec => ({
  key,
  pts: [
    [10, 0, -5],
    [0, 0, -5],
    [1, 1, -5],
  ],
  sys: ["fuel"],
});

describe("flow resource ownership", () => {
  it("retains curves, geometry and particle phase across filtering and reappearance", () => {
    const a = flow("a"),
      b = flow("b");
    const resources = new FlowResources(null);
    const [first, second] = resources.select([a, b]);
    first.t = 12;
    expect(resources.select([a, b])).toBe(resources.select([a, b]));
    expect(resources.select([a])[0]).toBe(first);
    expect(resources.select([b, a])).toEqual([second, first]);
    expect(resources.select([a])[0].t).toBe(12);
    expect(resources.size).toBe(2);
    resources.dispose();
  });

  it("releases hidden resources too, while retaining the externally owned sprite texture", () => {
    const texture = new THREE.Texture();
    const resources = new FlowResources(texture);
    const [a, b] = resources.select([flow("a"), flow("b")]);
    const disposed: unknown[] = [];
    const owned = [a.tube!, a.pts.geometry, a.pts.material, b.tube!, b.pts.geometry, b.pts.material];
    for (const resource of [...owned, texture]) resource.addEventListener("dispose", () => disposed.push(resource));
    resources.select([a.f]);
    resources.dispose();
    expect(disposed).toEqual(owned);
    expect(resources.select([b.f])[0]).toBe(b); // Strict Mode can reuse the same owner after cleanup.
    texture.dispose();
  });
});

describe("particle draw batching", () => {
  it("combines different-size streams while preserving their positions, colours, sizes and visibility", () => {
    const resources = new FlowResources(null);
    const items = resources.select([flow("a"), flow("b"), { ...flow("c"), size: 0.12 }]);
    const batches = createFlowParticleBatches(items, null);
    expect(batches).toHaveLength(1);
    const [a, b, c] = items;
    a.pts.visible = b.pts.visible = c.pts.visible = true;
    a.pts.material.color.set("red");
    b.pts.material.color.set("blue");
    a.pts.geometry.getAttribute("position").setXYZ(0, 1, 2, 3);
    b.pts.geometry.getAttribute("position").setXYZ(0, 4, 5, 6);
    batches.forEach((batch) => batch.sync());
    const geometry = batches[0].points.geometry;
    expect(geometry.drawRange.count).toBe(a.n + b.n + c.n);
    expect(Array.from(geometry.attributes.position.array.slice(0, 3))).toEqual([1, 2, 3]);
    expect(Array.from(geometry.attributes.position.array.slice(a.n * 3, a.n * 3 + 3))).toEqual([4, 5, 6]);
    expect(Array.from(geometry.attributes.color.array.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(geometry.attributes.color.array.slice(a.n * 3, a.n * 3 + 3))).toEqual([0, 0, 1]);
    expect(geometry.attributes.particleSize.getX(0)).toBeCloseTo(0.08);
    expect(geometry.attributes.particleSize.getX(a.n + b.n)).toBeCloseTo(0.12);
    a.pts.visible = false;
    batches[0].sync();
    expect(geometry.drawRange.count).toBe(b.n + c.n);
    expect(geometry.index!.getX(0)).toBe(a.n);
    b.pts.visible = false;
    c.pts.visible = false;
    batches[0].sync();
    expect(batches[0].points.visible).toBe(false);
    expect(geometry.drawRange.count).toBe(0);
    for (const batch of batches) batch.dispose();
    resources.dispose();
  });

  it("sorts all stream sizes back-to-front after an orbit and only reindexes when the order changes", () => {
    const resources = new FlowResources(null);
    const items = resources.select(
      [-2, -8, -5].map((z, i) => ({
        ...flow(String(i)),
        size: i === 1 ? 0.12 : 0.08,
        pts: [
          [0, 0, z],
          [1, 0, z],
        ],
      })),
    );
    for (const item of items) item.pts.visible = true;
    const [batch] = createFlowParticleBatches(items, null);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const [a, b] = items;
    batch.sync(camera);
    const geometry = batch.points.geometry;
    const index = geometry.index!;
    expect([index.getX(0), index.getX(b.n), index.getX(b.n + items[2].n)]).toEqual([a.n, a.n + b.n, 0]);
    const before = index.version;
    batch.sync(camera);
    expect(index.version).toBe(before);
    camera.position.z = -10;
    camera.lookAt(0, 0, -5);
    batch.sync(camera);
    expect([index.getX(0), index.getX(a.n), index.getX(a.n + items[2].n)]).toEqual([0, a.n + b.n, a.n]);
    expect(index.version).toBeGreaterThan(before);
    expect(batch.points.renderOrder).toBe(1);
    batch.dispose();
    resources.dispose();
  });

  it("retains the renderer's size uniform when adding per-particle sizes to its actual point shader", () => {
    const resources = new FlowResources(null);
    const [batch] = createFlowParticleBatches(resources.select([flow("a")]), null);
    const shader = { ...THREE.ShaderLib.points };
    batch.points.material.onBeforeCompile(
      shader as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );
    expect(shader.vertexShader).toContain("attribute float particleSize;");
    expect(shader.vertexShader).toContain("gl_PointSize = size * particleSize;");
    expect(shader.vertexShader).toContain("gl_PointSize *= ( scale / - mvPosition.z )");
    batch.dispose();
    resources.dispose();
  });
});

describe("moving particle bounds", () => {
  it.each([0, 0.3, 0.5, 1])("encloses the entire path, including overshoot at tension %s", (tension) => {
    const curve = curveOf(
      [
        [0, 0, 0],
        [0, 1, 0],
        [3, 1, 2],
        [3, -2, 0],
        [4, 0, -2],
      ],
      tension,
    );
    const bounds = flowBounds(curve, 0.08);
    for (let i = 0; i <= 2000; i++) expect(bounds.containsPoint(curve.getPoint(i / 2000))).toBe(true);
  });

  it("does not cull particles entering the view after their first frame", () => {
    const resources = new FlowResources(null);
    const [item] = resources.select([flow("entering")]);
    const positions = item.pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const bounds = item.pts.geometry.boundingSphere;
    for (const x of [10, 0]) {
      for (let i = 0; i < positions.count; i++) positions.setXYZ(i, x, 0, -5);
      positions.needsUpdate = true;
      expect(frustum.intersectsObject(item.pts)).toBe(true);
      expect(item.pts.geometry.boundingSphere).toBe(bounds);
    }
    resources.dispose();
  });
});
