import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { transpileModule, ScriptTarget } from "typescript";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { airplaneBounds, cameraFitDistance, FRAME_FILL, viewPresetCamera } from "../lib/camera";
import { V, clamp, ease } from "../lib/math";

// Read through fs below. Listing it to Vite (never loading it) makes it a dependency, so `vitest --changed` reruns this
// file when it changes.
import.meta.glob("../components/scene/Scene.tsx");

// Execute the actual frame callback with real Three geometry; hooks only provide its scene/state inputs.
function rig() {
  const source = readFileSync(process.env.CAMERA_RIG_SOURCE || resolve("components/scene/Scene.tsx"), "utf8");
  const body = transpileModule(
    source.slice(source.indexOf("function clearDamping"), source.indexOf("function MaterialSync")),
    {
      compilerOptions: { target: ScriptTarget.ES2022 },
    },
  ).outputText;
  const model = new THREE.Group();
  model.name = "aircraft-model";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 12));
  mesh.userData.cameraBounds = true;
  model.add(mesh);
  const scene = new THREE.Scene();
  scene.add(model);
  const camera = new THREE.PerspectiveCamera(38, 2560 / 1080, 0.05, 400);
  const listeners = new Map<string, () => void>();
  const controls = {
    target: new THREE.Vector3(),
    minDistance: 0.4,
    maxDistance: 70,
    update() {},
    addEventListener: (key: string, callback: () => void) => listeners.set(key, callback),
    removeEventListener: (key: string) => listeners.delete(key),
  };
  let building = false;
  const owner = { aircraft: "sr20", token: Symbol("camera test") };
  const state = {
    cam: { p: [10, 4, 10], t: [0, 0, 0], preset: "front" },
    sys: "overview",
    session: owner as typeof owner | null,
  };
  const three = { scene, camera, controls, size: { width: 2560, height: 1080 } };
  const refs: { current: unknown }[] = [];
  let hook = 0;
  let effects: (() => void)[] = [],
    frames: [number, () => void][] = [];
  const context = {
    THREE,
    V,
    clamp,
    ease,
    MOVED: 1e-6,
    view: { moves: 0 },
    registerSceneCamera: () => () => {},
    fitDist: cameraFitDistance,
    airplaneBounds,
    viewPresetCamera,
    useView: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }),
    useBuild: (select: (value: { stage: string }) => unknown) => select({ stage: building ? "airframe" : "ready" }),
    useThree: (select: (value: typeof three) => unknown) => select(three),
    useRef: (initial: unknown) => refs[hook++] ?? (refs[hook - 1] = { current: initial }),
    useEffect: (callback: () => void) => effects.push(callback),
    useFrame: (callback: () => void, priority = 0) => frames.push([priority, callback]),
    matchMedia: () => ({ matches: true }),
    performance: { now: () => 0 },
    CameraRig: undefined as unknown as (props: { owner: typeof owner }) => void,
  };
  runInNewContext(body + ";this.CameraRig = CameraRig;", context);
  function frame() {
    hook = 0;
    effects = [];
    frames = [];
    context.CameraRig({ owner });
    effects.forEach((callback) => callback());
    frames.sort((a, b) => a[0] - b[0]).forEach(([, callback]) => callback());
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
  }
  function resize(width = 1440) {
    three.size = { width, height: 1080 };
    camera.aspect = width / 1080;
    camera.updateProjectionMatrix();
    frame();
  }
  function expectFramed() {
    const bounds = airplaneBounds(model);
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).project(camera);
          expect(Math.abs(corner.x)).toBeLessThanOrEqual(FRAME_FILL + 1e-6);
          expect(Math.abs(corner.y)).toBeLessThanOrEqual(FRAME_FILL + 1e-6);
          expect(corner.z).toBeGreaterThan(-1);
          expect(corner.z).toBeLessThan(1);
        }
  }
  return {
    frame,
    resize,
    expectFramed,
    camera,
    state,
    start: () => listeners.get("start")!(),
    change: () => listeners.get("change")!(),
    end: () => listeners.get("end")?.(),
    build: (value: boolean) => {
      building = value;
    },
  };
}

describe("overview preset resize", () => {
  it("a departed scene ignores a replacement route's camera request", () => {
    const r = rig();
    r.frame();
    const before = r.camera.position.clone();
    r.state.session = null;
    r.state.cam = { p: [3, 2, 8], t: [1, 0, 0], preset: "left" };
    r.frame();
    expect(r.camera.position.toArray()).toEqual(before.toArray());
  });
  it("applies a held overview preset after an unmoved tap during the build", () => {
    const r = rig();
    r.build(true);
    r.frame();
    r.start();
    r.end();
    r.build(false);
    r.frame();
    r.expectFramed();
  });
  it("still refits after an unmoved tap on the completed model", () => {
    const r = rig();
    r.frame();
    r.start();
    r.end();
    r.resize();
    r.expectFramed();
    r.change(); // OrbitControls announces the programmatic fit; it is not user movement.
    const narrow = r.camera.position.clone();
    r.resize(2560);
    expect(r.camera.position.distanceTo(narrow)).toBeGreaterThan(1);
    r.expectFramed();
  });
  it("consumes a held preset only when the press actually moves the camera", () => {
    const r = rig();
    r.build(true);
    r.frame();
    r.start();
    r.camera.position.set(30, 5, 10);
    r.change();
    r.end();
    const before = r.camera.position.clone();
    r.build(false);
    r.frame();
    expect(r.camera.position.toArray()).toEqual(before.toArray());
  });
  it("keeps physical airplane bounds within the preset margin after a wide viewport narrows", () => {
    const r = rig();
    r.frame();
    r.expectFramed();
    r.resize();
    r.expectFramed();
  });
  it("ignores motion below the existing movement threshold", () => {
    const r = rig();
    r.frame();
    r.start();
    r.camera.position.x += 0.0001;
    r.change();
    r.end();
    r.resize();
    r.expectFramed();
  });
  it.each(["press", "wheel", "keyboard"])("keeps the user's camera after %s rather than refitting", (input) => {
    const r = rig();
    r.frame();
    if (input !== "keyboard") r.start();
    r.camera.position.set(30, 5, 10);
    r.change();
    const before = r.camera.position.clone();
    r.resize();
    expect(r.camera.position.toArray()).toEqual(before.toArray());
  });
  it("ends overview refitting when a newer system request arrives", () => {
    const r = rig();
    r.frame();
    r.state.sys = "electrical";
    r.state.cam = { p: [8, 2, 5], t: [0, 0, 0], preset: "front" };
    r.frame();
    const before = r.camera.position.clone();
    r.resize();
    expect(r.camera.position.toArray()).toEqual(before.toArray());
  });
});
