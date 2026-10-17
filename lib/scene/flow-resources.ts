import * as THREE from "three";
import type { FlowSpec } from "../catalogue";
import { curveOf } from "../geometry";

/**
 * Bound the whole Catmull–Rom path, not the particles' positions on their first frame. Each segment is a cubic
 * Bézier curve: its endpoints and two tangent-derived control points enclose it, including spline overshoot.
 */
export function flowBounds(curve: THREE.CatmullRomCurve3, padding = 0) {
  const points = curve.points;
  const box = new THREE.Box3().setFromPoints(points);
  const before = new THREE.Vector3(),
    after = new THREE.Vector3(),
    control = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const p0 = i ? points[i - 1] : before.copy(a).multiplyScalar(2).sub(b);
    const p3 = i + 2 < points.length ? points[i + 2] : after.copy(b).multiplyScalar(2).sub(a);
    box.expandByPoint(
      control
        .subVectors(b, p0)
        .multiplyScalar(curve.tension / 3)
        .add(a),
    );
    box.expandByPoint(
      control
        .subVectors(a, p3)
        .multiplyScalar(curve.tension / 3)
        .add(b),
    );
  }
  return box.expandByScalar(padding).getBoundingSphere(new THREE.Sphere());
}

const noRaycast = () => {};

export function createFlowResource(f: FlowSpec, texture: THREE.Texture | null) {
  const curve = curveOf(f.pts, f.tension ?? 0.3);
  const len = curve.getLength();
  const n = f.count ?? Math.max(6, Math.round(len * 9));
  const off = Float32Array.from({ length: n }, () => Math.random());
  const tube =
    f.tube === false ? null : new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 28)), f.r ?? 0.012, 6, false);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geometry.boundingSphere = flowBounds(curve, f.size ?? 0.08);
  const pts = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      size: f.size ?? 0.08,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  pts.raycast = noRaycast;
  pts.visible = false;
  return { f, curve, len, n, off, tube, pts, t: 0 };
}

export type FlowResource = ReturnType<typeof createFlowResource>;

/**
 * A mounted aircraft owns its flow resources. Filtering changes the selected list, without reconstructing the
 * surviving paths or losing their particle phase. Hidden paths remain reusable until this owner is released.
 */
export class FlowResources {
  private readonly resources = new Map<FlowSpec, FlowResource>();
  private selection: FlowResource[] = [];

  constructor(private readonly texture: THREE.Texture | null) {}

  select(flows: readonly FlowSpec[]) {
    if (flows.length === this.selection.length && flows.every((flow, i) => flow === this.selection[i].f))
      return this.selection;
    this.selection = flows.map((flow) => {
      let resource = this.resources.get(flow);
      if (!resource) {
        resource = createFlowResource(flow, this.texture);
        this.resources.set(flow, resource);
      }
      return resource;
    });
    return this.selection;
  }

  get size() {
    return this.resources.size;
  }

  dispose() {
    for (const item of this.resources.values()) {
      item.tube?.dispose();
      item.pts.geometry.dispose();
      item.pts.material.dispose();
    }
    // Keep the JS resources usable for React Strict Mode's setup → cleanup → setup. Three uploads them again
    // when needed; on a real unmount the owner and its map become unreachable together.
  }
}

/** Keep Three's point sizing (including pixel ratio and perspective) while allowing all stream sizes in one draw. */
export function flowParticleMaterial(texture: THREE.Texture | null) {
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 1,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float particleSize;")
      .replace("gl_PointSize = size;", "gl_PointSize = size * particleSize;");
  };
  material.customProgramCacheKey = () => "flow-particle-sizes-v1";
  return material;
}

/**
 * One particle pass sits above system geometry and below the X-ray shells (renderOrder 2). Streams inside the pass
 * retain normal back-to-front alpha blending as the camera moves; tube meshes keep independent picking identities.
 * This deliberate overlay policy replaces interleaving individual streams with unrelated transparent dim meshes.
 */
export class FlowParticleBatch {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly ranges: {
    item: FlowResource;
    start: number;
    color: THREE.Color;
    visible: boolean;
    depth: number;
  }[];
  private readonly positions: THREE.BufferAttribute;
  private readonly colors: THREE.BufferAttribute;
  private readonly indices: THREE.BufferAttribute;
  private readonly projection = new THREE.Matrix4();
  private readonly centre = new THREE.Vector3();
  private order: number[] = [];

  constructor(items: FlowResource[], texture: THREE.Texture | null) {
    const count = items.reduce((total, item) => total + item.n, 0);
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.indices = new THREE.BufferAttribute(count > 65535 ? new Uint32Array(count) : new Uint16Array(count), 1);
    this.indices.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("color", this.colors);
    const sizes = new THREE.BufferAttribute(new Float32Array(count), 1);
    geometry.setAttribute("particleSize", sizes);
    geometry.setIndex(this.indices);
    geometry.setDrawRange(0, 0);
    const bounds = new THREE.Sphere();
    let start = 0;
    this.ranges = items.map((item) => {
      bounds.union(item.pts.geometry.boundingSphere!);
      const range = { item, start, color: new THREE.Color(-1, -1, -1), visible: false, depth: 0 };
      for (let i = start; i < start + item.n; i++) sizes.setX(i, item.pts.material.size);
      start += item.n;
      return range;
    });
    geometry.boundingSphere = bounds;
    this.points = new THREE.Points(geometry, flowParticleMaterial(texture));
    this.points.raycast = noRaycast;
    this.points.visible = false;
    this.points.name = "flow-particles";
    this.points.renderOrder = 1;
  }

  /** Reindex only when visible stream order changes; per-stream positions and colours stay in stable buffer ranges. */
  sync(camera?: THREE.Camera) {
    let colorsChanged = false,
      visibleCount = 0;
    if (camera) {
      camera.updateMatrixWorld();
      this.points.updateWorldMatrix(true, false);
      this.projection
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(this.points.matrixWorld);
    }
    for (const range of this.ranges) {
      const { item, start } = range;
      range.visible = item.pts.visible;
      if (!range.visible) continue;
      if (camera)
        range.depth = this.centre.copy(item.pts.geometry.boundingSphere!.center).applyMatrix4(this.projection).z;
      visibleCount += item.n;
      (this.positions.array as Float32Array).set(item.pts.geometry.attributes.position.array, start * 3);
      const color = item.pts.material.color;
      if (!range.color.equals(color)) {
        for (let i = start; i < start + item.n; i++) this.colors.setXYZ(i, color.r, color.g, color.b);
        range.color.copy(color);
        colorsChanged = true;
      }
    }
    const visible = this.ranges.filter((range) => range.visible).sort((a, b) => b.depth - a.depth || a.start - b.start);
    const changed = visible.length !== this.order.length || visible.some((range, i) => range.start !== this.order[i]);
    if (changed) {
      let index = 0;
      for (const { item, start } of visible) for (let i = start; i < start + item.n; i++) this.indices.setX(index++, i);
      this.order = visible.map((range) => range.start);
      this.indices.needsUpdate = true;
      this.points.geometry.setDrawRange(0, visibleCount);
    }
    this.points.visible = visibleCount > 0;
    if (visibleCount) this.positions.needsUpdate = true;
    if (colorsChanged) this.colors.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

export function createFlowParticleBatches(items: FlowResource[], texture: THREE.Texture | null) {
  return items.length ? [new FlowParticleBatch(items, texture)] : [];
}
