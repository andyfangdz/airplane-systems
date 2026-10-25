/**
 * Mount engine scene components headless for a test: React Three Fiber with a stub renderer (nothing draws), so a test
 * can raycast what the components actually build. `frame()` runs their `useFrame` once, as the page does every frame.
 */
import { act, advance, createRoot, extend, type RootState } from "@react-three/fiber";
import { createElement, type ReactNode } from "react";
import * as THREE from "three";
import { PartInspectionProvider } from "@/components/engine/PartInspector";

export async function mountScene(el: ReactNode) {
  // the fiber package loads its own copy of three; build with this one, so tests can check the objects it makes
  extend(THREE as unknown as Parameters<typeof extend>[0]);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = {
    width: 1440,
    height: 900,
    style: {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement;
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
  const root = createRoot(canvas);
  let state: RootState | undefined;
  await root.configure({
    gl,
    frameloop: "never",
    size: { width: 1440, height: 900, top: 0, left: 0 },
    onCreated: (s) => {
      state = s;
    },
  });
  const inspection = (children: ReactNode) => createElement(PartInspectionProvider, { children });
  await act(async () => root.render(inspection(el)));
  const frame = () => {
    advance(0);
    state!.scene.updateMatrixWorld(true);
  };
  frame();
  return {
    scene: state!.scene,
    /** What the pointer is tested against: the objects with pointer handlers (R3F's event system). */
    hoverTargets: () => state!.get().internal.interaction,
    frame,
    render: (next: ReactNode) => act(async () => root.render(inspection(next))).then(frame),
    unmount: () => act(async () => root.unmount()),
  };
}
