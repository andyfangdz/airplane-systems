/** The source's entire propeller inspection fits the scene, including arbitrary stopped blade azimuth and pitch. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAMERA_FOV, cameraFitDistance } from "@/lib/camera";
import { specGeo, type Catalogue } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { createFleetWalk } from "@/lib/fleet-walk";
import { walk as c172, groupMatrix as parent172 } from "@/aircraft/c172s/walk";
import { walk as c182, groupMatrix as parent182 } from "@/aircraft/c182t/walk";
import { walk as diamond, groupMatrix as parentDiamond } from "@/aircraft/da40/walk";
import { walk as mooney, groupMatrix as parentMooney } from "@/aircraft/m20c/walk";
import { CAT as cat172, PROP as prop172 } from "@/aircraft/c172s/parts";
import { CAT as cat182, PROP as prop182 } from "@/aircraft/c182t/parts";
import { CAT as catDiamond, PROP as propDiamond } from "@/aircraft/da40/parts";
import { CAT as catMooney, PROP as propMooney } from "@/aircraft/m20c/parts";

function checkFraming<S>(
  walk: ReturnType<typeof createFleetWalk<S>>,
  cat: Catalogue,
  parent: (name: string) => THREE.Matrix4,
  prop: Vec3,
  id: string,
  pitches: number[],
) {
  describe(`${walk.data.short} whole-propeller framing`, () => {
    const step = walk.steps.find((s) => s.item.id === id)!;
    const pose = walk.stepPose(step),
      target = V(...pose.t),
      axis = V(...prop);
    it("fits every highlighted blade and spinner vertex on desktop and phone, leaving overlay margin", () => {
      const points: THREE.Vector3[] = [];
      for (const spec of cat.parts.filter((p) => step.item.parts.includes(p.name ?? ""))) {
        const position = specGeo(spec).getAttribute("position"),
          object = new THREE.Object3D();
        if (spec.pos) object.position.set(...spec.pos);
        if (spec.rot) object.rotation.set(...spec.rot);
        if (spec.scale) object.scale.set(...spec.scale);
        object.updateMatrix();
        const matrix = spec.parent ? parent(spec.parent) : new THREE.Matrix4();
        for (const pitch of spec.parent?.startsWith("blade:") ? pitches : [0]) {
          for (let azimuth = 0; azimuth < 360; azimuth += 30) {
            for (let i = 0; i < position.count; i++) {
              const point = new THREE.Vector3()
                .fromBufferAttribute(position, i)
                .applyMatrix4(object.matrix)
                .applyAxisAngle(V(0, 1, 0), (pitch * Math.PI) / 180)
                .applyMatrix4(matrix);
              if (spec.parent?.startsWith("blade:"))
                point
                  .sub(axis)
                  .applyAxisAngle(V(1, 0, 0), (azimuth * Math.PI) / 180)
                  .add(axis);
              points.push(point);
            }
          }
        }
      }
      for (const shell of cat.shells.filter((p) => step.item.parts.includes(p.name))) {
        const position = specGeo(shell).getAttribute("position");
        for (let i = 0; i < position.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i));
      }
      expect(points.length).toBeGreaterThan(1000);
      // Actual scene dimensions: desktop excludes the 228px rail and 392px panel; phone panel is below the 55vh scene.
      for (const [width, height] of [
        [1440 - 228 - 392, 900],
        [390, 844 * 0.55],
      ]) {
        const aspect = width / height,
          camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.05, 400);
        camera.position.copy(
          V(...pose.p)
            .sub(target)
            .multiplyScalar(cameraFitDistance(aspect))
            .add(target),
        );
        camera.lookAt(target);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        let x = 0,
          y = 0;
        for (const point of points) {
          const projected = point.clone().project(camera);
          x = Math.max(x, Math.abs(projected.x));
          y = Math.max(y, Math.abs(projected.y));
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
        }
        expect(x, `${width}×${height} full propeller width`).toBeLessThan(0.85);
        expect(y, `${width}×${height} full propeller height including toolbar margin`).toBeLessThan(0.65);
      }
    });
    it("changes only the propeller framing and keeps the inspection marker on its original component", () => {
      expect(walk.steps.filter((s) => s.item.fitParts).map((s) => s.item.id)).toEqual([id]);
      const close = walk.stepPose({ ...step, item: { ...step.item, fitParts: false } });
      expect(V(...pose.p).distanceTo(target)).toBeGreaterThan(V(...close.p).distanceTo(target));
      expect(pose.t).toEqual(close.t);
      expect(walk.stepCentroid(step)?.distanceTo(target)).toBeLessThan(1e-8);
    }, 30_000); // This branch lazily builds the complete source hull for marker raycasts.
  });
}
checkFraming(c172, cat172, parent172, prop172, "5-4", [0]);
checkFraming(c182, cat182, parent182, prop182, "5-5", [-14.9 * 1.5, -31.7 * 1.5]);
checkFraming(diamond, catDiamond, parentDiamond, propDiamond, "9-4", [11, 30]);
checkFraming(mooney, catMooney, parentMooney, propMooney, "7-1", [13, 29]);

it("uses the G1000 long-range measuring procedure rather than operating an obsolete auxiliary switch", () => {
  const fuel = diamond.steps.find((s) => s.item.id === "1-13")!.item;
  expect(fuel.ref).toContain("190-00492-10");
  expect(fuel.sourceUrl).toBe("https://manualzilla.com/doc/7043953");
  expect(fuel.note).toContain("3 US gal between 16 and 19 US gal");
  expect(fuel.note).toContain("without that measurement, use 16 US gal for flight planning");
  expect(fuel.note).toContain("an older indication interface, not this G1000 installation");
});
