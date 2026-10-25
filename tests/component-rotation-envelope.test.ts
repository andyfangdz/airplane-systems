import { createElement as h } from "react";
import { Box3, Group, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three";
import { expect, it } from "vitest";
import { componentBounds, fitComponentCamera } from "@/lib/component-stage";
import { Propeller } from "@/components/engine/scene/Systems";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { simFor } from "@/components/engine/store";
import { IO390 } from "@/engines/io390/spec";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { mountScene } from "./engine-mount";

it("keeps a rotational envelope stable under translated, rotated and scaled ancestors", () => {
  const parent = new Group();
  parent.position.set(2, -1, 0.5);
  parent.rotation.set(0.3, 0.4, -0.2);
  parent.scale.set(1.2, 0.8, 1.5);
  const rotor = new Group();
  rotor.userData.cameraRotationEnvelope = { minX: -0.03, maxX: 0.15, radius: 0.3 };
  parent.add(rotor);
  const initial = componentBounds(parent);
  const direction = new Vector3(1, 0.4, 0.8),
    safe = { left: 20, top: 74, right: 362, bottom: 240 };
  const pose = fitComponentCamera(parent, direction, 38, 382, 260, safe)!;
  for (let phase = 0; phase < 360; phase += 15) {
    rotor.rotation.x = (phase * Math.PI) / 180;
    const bounds = componentBounds(parent);
    expect(bounds.min.distanceTo(initial.min)).toBeLessThan(1e-10);
    expect(bounds.max.distanceTo(initial.max)).toBeLessThan(1e-10);
    const next = fitComponentCamera(parent, direction, 38, 382, 260, safe)!;
    expect(next.position.distanceTo(pose.position)).toBeLessThan(1e-10);
    expect(next.target.distanceTo(pose.target)).toBeLessThan(1e-10);
  }
  rotor.visible = false;
  expect(componentBounds(parent).isEmpty()).toBe(true);
});

for (const spec of [IO390, O360, TSIO550K]) {
  it(`${spec.id}: one fitted envelope contains actual propeller blades at sampled crank phases and pitch angles`, async () => {
    const sim = simFor(spec, `camera-envelope-${spec.id}`),
      mats = makeMats();
    sim.useUi.getState().setView({ prop: true, slow: true });
    sim.s.rpm = 0;
    const mounted = await mountScene(h(Propeller, { sim, d: dims(spec), mats }));
    try {
      const envelope = componentBounds(mounted.scene);
      const safe = { left: 20, top: 60, right: 370, bottom: 334 };
      const fit = fitComponentCamera(mounted.scene, new Vector3(1, 0.4, 0.8), 38, 390, 354, safe)!;
      const camera = new PerspectiveCamera(38, 390 / 354, 0.01, 40);
      camera.position.copy(fit.position);
      camera.lookAt(fit.target);
      camera.updateMatrixWorld();
      for (const pitch of [spec.propeller.fineDeg, 30, spec.propeller.coarseDeg]) {
        sim.s.beta = pitch;
        for (let phase = 0; phase < 360; phase += 30) {
          sim.anim.crank = phase;
          mounted.frame();
          const bounds = componentBounds(mounted.scene);
          expect(bounds.min.distanceTo(envelope.min)).toBeLessThan(1e-8);
          expect(bounds.max.distanceTo(envelope.max)).toBeLessThan(1e-8);
          const physical = new Box3();
          mounted.scene.traverseVisible((object) => {
            if (!(object instanceof Mesh)) return;
            const vertices = object.geometry.getAttribute("position");
            const matrix = new Matrix4().copy(object.matrixWorld);
            for (let i = 0; i < vertices.count; i++) {
              const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix);
              physical.expandByPoint(point);
              const projected = point.project(camera);
              const x = ((projected.x + 1) / 2) * 390,
                y = ((1 - projected.y) / 2) * 354;
              expect(x).toBeGreaterThanOrEqual(safe.left - 0.001);
              expect(x).toBeLessThanOrEqual(safe.right + 0.001);
              expect(y).toBeGreaterThanOrEqual(safe.top - 0.001);
              expect(y).toBeLessThanOrEqual(safe.bottom + 0.001);
            }
          });
          expect(envelope.clone().expandByScalar(1e-7).containsBox(physical)).toBe(true);
        }
      }
      sim.useUi.getState().setView({ prop: false });
      mounted.frame();
      expect(componentBounds(mounted.scene).isEmpty()).toBe(true);
    } finally {
      await mounted.unmount();
      Object.values(mats).forEach((material) => material.dispose());
    }
  });
}
