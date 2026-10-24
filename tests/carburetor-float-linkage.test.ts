/** Float lever/shaft/bracket assembly (MA-4-5 OI ¶2-27 x–y), float-to-needle action (AMT p. 2-10).
 * Checks the actual mounted meshes through their travel; all dimensions and travel in this cutaway are schematic. */
import { createElement as h } from "react";
import * as THREE from "three";
import { expect, test } from "vitest";
import { FloatChamber } from "@/components/engine/carburetor/CarburetorScene";
import { live } from "@/components/engine/carburetor/live";
import { useHover } from "@/components/engine/scene/parts";
import { mountScene } from "./engine-mount";
import { edgeCrossing, tris } from "./mesh-clearance";

async function fixture() {
  const mats = {
    fuel: new THREE.MeshStandardMaterial(),
    float: new THREE.MeshStandardMaterial(),
    steel: new THREE.MeshStandardMaterial(),
    brass: new THREE.MeshStandardMaterial(),
    passage: new THREE.MeshStandardMaterial(),
    darkSteel: new THREE.MeshStandardMaterial(),
  };
  const before = { bowl: live.bowl, needle: live.needle };
  const mounted = await mountScene(h(FloatChamber, { mats }));
  const parts = new Map<string, THREE.Mesh>();
  for (const o of mounted.hoverTargets()) {
    if (!(o instanceof THREE.Mesh)) continue;
    const over = (o as unknown as { __r3f: { handlers: Record<string, (e: unknown) => void> } }).__r3f.handlers
      .onPointerOver;
    over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
    parts.set(useHover.getState().hover!.name, o);
  }
  useHover.setState({ hover: null });
  return {
    ...mounted,
    part: (name: string) => {
      expect(parts.has(name), `rendered part ${name}`).toBe(true);
      return parts.get(name)!;
    },
    async dispose() {
      Object.assign(live, before);
      useHover.setState({ hover: null });
      await mounted.unmount();
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}

const crosses = (a: THREE.Mesh, b: THREE.Mesh) => {
  const aa = tris(a.geometry, a.matrixWorld),
    bb = tris(b.geometry, b.matrixWorld);
  return edgeCrossing(aa, bb) ?? edgeCrossing(bb, aa);
};

test("the tab is joined to the float lever and the shaft reaches its fixed bracket throughout travel (OI ¶2-27 x–y)", async () => {
  const f = await fixture();
  try {
    const tab = f.part("Float lever tab"),
      lever = f.part("Float and lever assembly");
    const shaft = f.part("Float shaft"),
      bracket = f.part("Float bracket");
    const fixed = bracket.matrixWorld.clone();
    for (const bowl of [1, 0.98, 0.75, 0.5, 0.25, 0]) {
      live.bowl = bowl;
      f.frame();
      expect(crosses(tab, lever), `tab/lever at bowl=${bowl}`).toBeDefined();
      expect(crosses(shaft, bracket), `shaft/bracket at bowl=${bowl}`).toBeDefined();
      expect(bracket.matrixWorld.equals(fixed)).toBe(true);
    }
  } finally {
    await f.dispose();
  }
});

test("the guided needle bears on the rotating tab at every fuel level, rather than moving independently (AMT p. 2-10)", async () => {
  const f = await fixture();
  try {
    const tab = f.part("Float lever tab"),
      needle = f.part("Float valve");
    const seat = f.part("Float valve seat");
    needle.geometry.computeBoundingBox();
    const bounds = needle.geometry.boundingBox!;
    const radius = (bounds.max.x - bounds.min.x) / 2;
    const heelLocal = new THREE.Vector3(0, bounds.min.y + radius, 0);
    let previousY = Infinity;
    for (const bowl of [1, 0.98, 0.75, 0.5, 0.25, 0]) {
      live.bowl = bowl;
      // Deliberately disagree with the level: a separate opening readout must not pull the needle off its tab.
      live.needle = 1 - bowl;
      f.frame();
      const heel = needle.localToWorld(heelLocal.clone());
      const down = new THREE.Vector3(0, -1, 0).transformDirection(tab.matrixWorld);
      const hit = new THREE.Raycaster(heel, down, 0, radius * 2).intersectObject(tab)[0];
      expect(hit, `tab beneath the heel at bowl=${bowl}`).toBeDefined();
      expect(hit.distance, `heel contact at bowl=${bowl}`).toBeCloseTo(radius, 7);
      const valveBox = new THREE.Box3().setFromObject(needle),
        seatBox = new THREE.Box3().setFromObject(seat);
      expect(valveBox.max.y, `needle remains in its guide at bowl=${bowl}`).toBeGreaterThan(seatBox.min.y);
      expect(heel.y).toBeLessThanOrEqual(previousY);
      previousY = heel.y;
    }
  } finally {
    await f.dispose();
  }
});
