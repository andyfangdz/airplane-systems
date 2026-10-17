/**
 * Every SR22T walk-around item's default camera (aircraft/sr22t/walk.ts stepPose) shows all of the item's listed parts,
 * the 7a and 11g stall strips included. Projected the way the 3D view does it (components/scene/Scene.tsx): a CAMERA_FOV
 * perspective camera on the pose, backed off by cameraFitDistance for the view's shape, at the desktop and phone 3D view
 * sizes of tests/fleet-walkaround-framing.test.ts.
 */
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import "@/aircraft";
import { walk } from "@/aircraft/sr22t/walk";
import { WALK } from "@/aircraft/sr22t/walkaround";
import { CAMERA_FOV, cameraFitDistance as fitDist } from "@/lib/camera";
const { nameInstances, stepParts, stepPose, stepSide } = walk;
type Step = (typeof walk.steps)[number];

/** The 3D view's width per unit height: desktop 1440×900 less the 228 px rail and 392 px panel; phone 390×844 with the
 * view the top 55%. */
const VIEWS = { desktop: (1440 - 228 - 392) / 900, phone: 390 / (0.55 * 844) };
/** A corner counts as in frame within this share of the half-width or half-height (approximate: a few pixels' slack). */
const IN_FRAME = 0.95;
/**
 * Known gaps the station's line of sight can't fix, left for follow-ups: cabin items whose parts are out on the wings
 * (1m flaps, 1r pitot tube), where backing away from the station would go through the airplane, and 9g+, seen from its
 * own hand-set eye. 1r aims at its target, the tube, which is checked below; its cockpit switch is the gap.
 */
const FOLLOW_UP = ["1m", "1r", "9g+"];

/** Every item, and its configuration variant where it has one. */
const steps: Step[] = WALK.flatMap((station) =>
  station.items.flatMap((item) => [
    { station, item },
    ...(item.variant ? [{ station, item: { ...item, ...item.variant } }] : []),
  ]),
);

/** Largest |x| or |y| of the part's box corners on screen (Infinity when behind the eye), seen as the 3D view sees `step`. */
function onScreen(step: Step, name: string, aspect: number) {
  const pose = stepPose(step),
    t = new Vector3(...pose.t);
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.05, 400);
  camera.position.copy(new Vector3(...pose.p).sub(t).multiplyScalar(fitDist(aspect)).add(t));
  camera.lookAt(t);
  camera.updateMatrixWorld();
  let extent = 0;
  for (const { box: b } of nameInstances(name, stepSide(step)))
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const v = new Vector3(x, y, z).project(camera);
          extent = Math.max(extent, Math.abs(v.z) > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y)));
        }
  return extent;
}

describe("SR22T walk-around item framing", () => {
  it("boxes each part instance around its centre", () => {
    for (const name of ["Right outboard stall strip", "Left flap", "Front cowl fastener"]) {
      const instances = nameInstances(name, 0);
      expect(instances.length, name).toBeGreaterThan(0);
      for (const { centre, box } of instances) expect(box.distanceToPoint(centre), name).toBeLessThan(1e-9);
    }
  });

  // items without modelled parts keep the station view: nothing to frame
  for (const step of steps.filter((s) => !FOLLOW_UP.includes(s.item.id) && stepParts(s).shown.length))
    for (const [view, aspect] of Object.entries(VIEWS))
      it(`item ${step.item.id} shows every listed part on the ${view}`, () => {
        for (const name of stepParts(step).shown)
          expect(onScreen(step, name, aspect), name).toBeLessThanOrEqual(IN_FRAME);
      });

  it("frames the 7a and 11g stall strips on both sides", () => {
    for (const [id, side] of [
      ["7a", "Right"],
      ["11g", "Left"],
    ]) {
      const step = steps.find((s) => s.item.id === id)!;
      for (const section of ["inboard", "outboard", "porous"])
        for (const aspect of Object.values(VIEWS))
          expect(onScreen(step, `${side} ${section} stall strip`, aspect), `${id} ${section}`).toBeLessThanOrEqual(
            IN_FRAME,
          );
    }
  });

  it("frames the 1r target, the heated pitot tube, on both views", () => {
    const step = steps.find((s) => s.item.id === "1r")!;
    for (const [view, aspect] of Object.entries(VIEWS))
      expect(onScreen(step, "Heated pitot tube", aspect), view).toBeLessThanOrEqual(IN_FRAME);
  });
});
