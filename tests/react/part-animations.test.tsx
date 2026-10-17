import { StrictMode, useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PartAnimationScope, usePartAnimation } from "@/components/scene/PartAnimations";
import { Catalogue, type PartSpec } from "@/lib/catalogue";
import { partObjects } from "@/lib/registry";
import { useView, type AircraftSessionOwner } from "@/lib/view";

const loop = vi.hoisted(() => ({ callbacks: new Set<(state: { clock: { elapsedTime: number } }) => void>() }));
vi.mock("@react-three/fiber", async () => {
  const { useLayoutEffect } = await import("react");
  return {
    useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
      useLayoutEffect(() => {
        loop.callbacks.add(callback);
        return () => {
          loop.callbacks.delete(callback);
        };
      }, [callback]);
    },
  };
});

const original = useView.getState();
afterEach(() => {
  cleanup();
  useView.setState(original);
});

it("uses one frame subscription for static and animated parts, including Strict Mode and owner cleanup", () => {
  const owner: AircraftSessionOwner = { aircraft: "c172s", token: Symbol("scene") };
  useView.setState({ session: owner });
  const cat = new Catalogue("frame-budget");
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const calls: string[] = [];
  const parts = Array.from({ length: 303 }, (_, i) => ({
    spec: cat.part(() => geometry, ["engine"], {
      id: "tests.react.part-animations.test.part.001",
      instance: [i],
      ...(i < 3 ? { name: `Animated ${i}`, anim: () => calls.push(String(i)) } : {}),
    }),
    mesh: new THREE.Mesh(geometry, material),
  }));
  function Entry({ spec, mesh, focused }: { spec: PartSpec; mesh: THREE.Mesh; focused: boolean }) {
    const ref = useRef(mesh);
    usePartAnimation(ref, spec, { material, active: true, focused, ghost: false }, "#778899");
    return null;
  }
  const scene = (focused: boolean) => (
    <StrictMode>
      <PartAnimationScope owner={owner}>
        {parts.map(({ spec, mesh }) => (
          <Entry key={spec.id} spec={spec} mesh={mesh} focused={focused} />
        ))}
      </PartAnimationScope>
    </StrictMode>
  );
  const mounted = render(scene(false));
  expect(loop.callbacks.size).toBe(1);
  act(() => {
    for (const callback of loop.callbacks) callback({ clock: { elapsedTime: 1 } });
  });
  expect(calls).toEqual(["0", "1", "2"]);
  expect(partObjects.get("Animated 0")).toBe(parts[0].mesh);
  parts[0].mesh.visible = false;
  mounted.rerender(scene(true));
  expect(parts[0].mesh.visible).toBe(true);
  expect(loop.callbacks.size).toBe(1);
  mounted.unmount();
  expect(loop.callbacks.size).toBe(0);
  expect(partObjects.has("Animated 0")).toBe(false);
  geometry.dispose();
  material.dispose();
});
