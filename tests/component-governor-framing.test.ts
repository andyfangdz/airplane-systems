import { createElement as h, type ReactNode } from "react";
import { Mesh, PerspectiveCamera, Vector3, type Object3D } from "three";
import { expect, it, vi } from "vitest";
import { componentBounds, fitComponentCamera, type StageRect } from "@/lib/component-stage";
import GovernorScene from "@/components/engine/governor/GovernorScene";
import { anim, s, spec, useGov, useGovView } from "@/components/engine/governor/store";
import { mountScene } from "./engine-mount";

vi.mock("@/components/engine/ComponentStage", () => ({
  ComponentStage: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@react-three/drei", () => ({ Html: () => null }));

/** Actual vertices, including descendants whose complete rotation is represented by the fitted envelope. */
function projectedPhysicalBounds(model: Object3D, camera: PerspectiveCamera, width: number, height: number) {
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, near: Infinity, far: -Infinity };
  const point = new Vector3();
  model.traverseVisible((object) => {
    if (!(object instanceof Mesh)) return;
    for (let ancestor: Object3D | null = object; ancestor; ancestor = ancestor.parent)
      if (ancestor.userData.cameraBounds === false) return;
    const vertices = object.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld).project(camera);
      const x = ((point.x + 1) / 2) * width,
        y = ((1 - point.y) / 2) * height;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
      bounds.near = Math.min(bounds.near, point.z);
      bounds.far = Math.max(bounds.far, point.z);
    }
  });
  return bounds;
}

it.each([
  { hub: "high" as const, height: 260 },
  { hub: "high" as const, height: 210 },
  { hub: "low" as const, height: 260 },
  { hub: "low" as const, height: 210 },
])("fits the actual $hub-pitch governor hub through its full movement at 382 × $height", async ({ hub, height }) => {
  const initial = { state: { ...s }, anim: { ...anim }, ui: useGov.getState(), view: useGovView.getState() };
  const width = 382;
  const safe: StageRect = { left: 20, top: 74, right: width - 20, bottom: height - 20 };
  const direction = new Vector3(0.5 - 0.16, 0.26 + 0.02, 0.86);
  let mounted: Awaited<ReturnType<typeof mountScene>> | undefined;
  try {
    useGov.setState({ hub });
    useGovView.setState({ labels: false, paused: true });
    s.p = 0;
    s.beta = spec.propeller.fineDeg;
    anim.crank = anim.gov = 0;
    mounted = await mountScene(h(GovernorScene));
    const fit = fitComponentCamera(mounted.scene, direction, 36, width, height, safe)!;
    const boxFit = fitComponentCamera(componentBounds(mounted.scene), direction, 36, width, height, safe)!;
    expect(fit.position.distanceTo(fit.target)).toBeLessThan(boxFit.position.distanceTo(boxFit.target));
    const camera = new PerspectiveCamera(36, width / height, 0.01, 20);
    camera.position.copy(fit.position);
    camera.lookAt(fit.target);
    camera.updateMatrixWorld();
    for (const stroke of [0, 1]) {
      s.p = stroke;
      for (const pitch of [spec.propeller.fineDeg, spec.propeller.coarseDeg]) {
        s.beta = pitch;
        for (let phase = 0; phase <= 360; phase += 30) {
          anim.crank = phase / 360;
          anim.gov = phase / 360;
          mounted.frame();
          const bounds = projectedPhysicalBounds(mounted.scene, camera, width, height);
          const context = `${hub} hub, stroke ${stroke}, pitch ${pitch}°, crank ${phase}°`;
          expect(bounds.left, context).toBeGreaterThanOrEqual(safe.left - 0.001);
          expect(bounds.right, context).toBeLessThanOrEqual(safe.right + 0.001);
          expect(bounds.top, context).toBeGreaterThanOrEqual(safe.top - 0.001);
          expect(bounds.bottom, context).toBeLessThanOrEqual(safe.bottom + 0.001);
          expect(bounds.near, context).toBeGreaterThanOrEqual(-1);
          expect(bounds.far, context).toBeLessThanOrEqual(1);
        }
      }
    }
  } finally {
    await mounted?.unmount();
    Object.assign(s, initial.state);
    Object.assign(anim, initial.anim);
    useGov.setState(initial.ui, true);
    useGovView.setState(initial.view, true);
  }
});
