import { act, advance, createRoot, extend, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { expect, test } from "vitest";
import { Labels } from "@/components/engine/EngineScene";
import { dims } from "@/components/engine/scene/kit";
import { groupsFor } from "@/components/engine/scene/parts";
import { createEngineSimulation } from "@/components/engine/store";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";

test.each([IO390, O360, TSIO550K])("$id study views remove labels with the assemblies they hide", async (spec) => {
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
  const sim = createEngineSimulation(spec);
  const root = createRoot(canvas);
  let state: RootState;
  await root.configure({
    gl,
    frameloop: "never",
    size: { width: 1440, height: 900, top: 0, left: 0 },
    onCreated: (s) => {
      state = s;
    },
  });
  const labels = () => [...host.querySelectorAll(".eng-label")].map((el) => el.textContent);
  const hide = async (groups: ReturnType<typeof groupsFor>) => {
    await act(async () => sim.useUi.getState().setView({ hidden: groups.map((group) => group.id) }));
    await act(async () => {
      state.scene.updateMatrixWorld(true);
      advance(0);
    });
  };
  try {
    await act(async () => root.render(<Labels sim={sim} d={dims(spec)} />));
    expect(labels()).toContain("Cyl 1");
    expect(labels()).toContain("Oil filter");
    expect(labels()).toContain("Magnetos");

    // The new one-system study presets must not leave labels pointing into empty space.
    const groups = groupsFor(spec);
    await hide(groups.filter((group) => group.id !== "ignition"));
    expect(labels()).toEqual(["Magnetos"]);
    await hide(groups.filter((group) => group.id === "ignition"));
    expect(labels()).not.toContain("Magnetos");
    expect(labels()).toContain("Oil filter");
    expect(labels()).toContain("Cyl 1");
    await hide(groups);
    expect(labels()).toEqual([]);
  } finally {
    await act(async () => root.unmount());
    sim.dispose();
    host.remove();
  }
});
