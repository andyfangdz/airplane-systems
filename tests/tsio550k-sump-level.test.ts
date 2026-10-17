// vitest: isolate (mounts the scene with React Three Fiber)
/** Oil lost overboard lowers the drawn sump as well as its pressure (POH 3-28 causes 3, 4). */
import { createElement as h } from "react";
import * as THREE from "three";
import { expect, test } from "vitest";
import { TSIO550K as K } from "@/engines/tsio550k/spec";
import { scenarioById } from "@/engines/model/scenarios";
import type { Failures } from "@/engines/model/engine";
import { createEngineSimulation, replaceState } from "@/components/engine/store";
import { Lubrication } from "@/components/engine/scene/Case";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { mountScene } from "./engine-mount";

test.each<[string, Partial<Failures>]>([
  ["oil leak", { oilLeak: true }],
  ["failed turbocharger", { turboInternal: [true, false] }],
])(
  "a %s lowers the actual sump mesh with the remaining oil (POH 3-28)",
  async (_, failure) => {
    const sim = createEngineSimulation(K),
      mats = makeMats(),
      d = dims(K);
    const x = scenarioById(K, "cruise")!.run(K);
    replaceState(sim, x.s);
    sim.useUi.getState().setControls(x.c);
    sim.useUi.getState().setEnv(x.env);
    const mounted = await mountScene(h(Lubrication, { sim, d, mats }));
    try {
      // The oil volume is the unlabelled mesh built directly with the cloned oil material.
      const levels: THREE.Mesh[] = [];
      mounted.scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh &&
          o.material instanceof THREE.Material &&
          o.material.transparent &&
          o.material.opacity === 0.75
        )
          levels.push(o);
      });
      expect(levels).toHaveLength(1);
      const level = levels[0],
        fullHeight = level.scale.y,
        initialQt = sim.useUi.getState().env.oilQt;
      sim.useUi.getState().setFailures(failure);
      for (let i = 0; i < 60 * 120; i++) sim.advance(1 / 120);
      expect(sim.s.oilLossQt).toBeGreaterThan(0);
      mounted.frame();
      expect(level.scale.y).toBeLessThan(fullHeight);
      expect(level.scale.y / fullHeight).toBeCloseTo((initialQt - sim.s.oilLossQt!) / initialQt, 8);
      // A missing optional checkpoint field draws the original level, and an empty sump keeps only the mesh floor.
      delete sim.s.oilLossQt;
      mounted.frame();
      expect(level.scale.y).toBe(fullHeight);
      sim.s.oilLossQt = initialQt + 1;
      mounted.frame();
      expect(level.scale.y).toBe(0.001);
    } finally {
      await mounted.unmount();
      Object.values(mats).forEach((m) => m.dispose());
      sim.dispose();
    }
  },
  60000,
);
