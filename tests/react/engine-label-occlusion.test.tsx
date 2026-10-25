import { act, advance, createRoot, extend, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { expect, it } from "vitest";
import { PartInspectionProvider } from "@/components/engine/PartInspector";
import { Labels } from "@/components/engine/EngineScene";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { layoutFor } from "@/components/engine/scene/layout";
import { Group } from "@/components/engine/scene/parts";
import { turboGeometry, Turbo } from "@/components/engine/scene/Turbo";
import { simFor } from "@/components/engine/store";
import { TSIO550K } from "@/engines/tsio550k/spec";

it("updates the actual Html label when an occluder changes with a stationary camera and anchor", async () => {
  extend(THREE as unknown as Parameters<typeof extend>[0]);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  host.append(canvas);
  document.body.append(host);
  const gl = {
    render() {},
    setPixelRatio() {},
    setSize() {},
    getPixelRatio: () => 1,
    dispose() {},
    xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
    shadowMap: {},
    domElement: canvas,
  } as unknown as THREE.WebGLRenderer;
  const sim = simFor(TSIO550K, "stationary-label-occlusion");
  const d = dims(TSIO550K);
  const anchor = new THREE.Vector3(
    ...layoutFor(TSIO550K)
      .labels(d, TSIO550K)
      .find(([name]) => name === "Oil filter")![1],
  );
  const camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.02, 40);
  camera.position.copy(anchor).add(new THREE.Vector3(1, 0, 0));
  camera.lookAt(anchor);
  const material = new THREE.MeshBasicMaterial({ transparent: true });
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
  blocker.position.copy(anchor).add(new THREE.Vector3(0.5, 0, 0));
  const group = new THREE.Group();
  group.add(blocker);
  const root = createRoot(canvas);
  let state: RootState;
  await root.configure({
    gl,
    camera,
    frameloop: "never",
    size: { width: 1440, height: 900, top: 0, left: 0 },
    onCreated: (s) => {
      state = s;
    },
  });
  const frame = () =>
    act(async () => {
      state.scene.updateMatrixWorld(true);
      advance(0);
    });
  try {
    await act(async () =>
      root.render(
        <PartInspectionProvider>
          <primitive object={group} />
          <Labels sim={sim} d={d} />
        </PartInspectionProvider>,
      ),
    );
    await frame();
    const label = [...host.querySelectorAll(".eng-label")].find((el) => el.textContent === "Oil filter")!;
    const visible = () => (label.parentElement!.parentElement as HTMLElement).style.display !== "none";
    expect(visible()).toBe(false);
    group.visible = false;
    await frame();
    expect(visible()).toBe(true);
    group.visible = true;
    await frame();
    expect(visible()).toBe(false);
    material.opacity = 0.16;
    await frame();
    expect(visible()).toBe(true);
    material.opacity = 1;
    await frame();
    expect(visible()).toBe(false);
    blocker.position.y += 1;
    await frame();
    expect(visible()).toBe(true);
    blocker.position.y -= 1;
    await frame();
    expect(visible()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    blocker.geometry.dispose();
    material.dispose();
    host.remove();
  }
});

it("re-checks the oil filter label when the turbo group is hidden or shown, with the camera stationary", async () => {
  extend(THREE as unknown as Parameters<typeof extend>[0]);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  host.append(canvas);
  document.body.append(host);
  const gl = {
    render() {},
    setPixelRatio() {},
    setSize() {},
    getPixelRatio: () => 1,
    dispose() {},
    xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
    shadowMap: {},
    domElement: canvas,
  } as unknown as THREE.WebGLRenderer;
  const sim = simFor(TSIO550K, "turbo-group-label-occlusion");
  const d = dims(TSIO550K);
  const L = layoutFor(TSIO550K);
  const anchor = new THREE.Vector3(...L.labels(d, TSIO550K).find(([name]) => name === "Oil filter")![1]);
  // looking at the label past the wastegate controller, a turbo-group part behind and outboard of the filter
  const body = turboGeometry(L.turbo!).controller.body;
  body.computeBoundingBox();
  const past = body.boundingBox!.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.02, 40);
  camera.position.copy(past).addScaledVector(past.clone().sub(anchor).normalize(), 1);
  camera.lookAt(anchor);
  const root = createRoot(canvas);
  let state: RootState;
  await root.configure({
    gl,
    camera,
    frameloop: "never",
    size: { width: 1440, height: 900, top: 0, left: 0 },
    onCreated: (s) => {
      state = s;
    },
  });
  const frame = () =>
    act(async () => {
      state.scene.updateMatrixWorld(true);
      advance(0);
    });
  const hide = async (hidden: string[]) => {
    await act(async () => sim.useUi.setState((u) => ({ view: { ...u.view, hidden } })));
    await frame();
  };
  try {
    await act(async () =>
      root.render(
        <PartInspectionProvider>
          <Group sim={sim} id="turbo">
            <Turbo sim={sim} d={d} mats={makeMats()} />
          </Group>
          <Labels sim={sim} d={d} />
        </PartInspectionProvider>,
      ),
    );
    await frame();
    // the turbo group's own labels come and go with it; the filter's label is looked up each time
    const visible = () => {
      const label = [...host.querySelectorAll(".eng-label")].find((el) => el.textContent === "Oil filter")!;
      return (label.parentElement!.parentElement as HTMLElement).style.display !== "none";
    };
    expect(visible()).toBe(false);
    await hide(["turbo"]);
    expect(visible()).toBe(true);
    await hide([]);
    expect(visible()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    body.dispose();
    host.remove();
  }
});
