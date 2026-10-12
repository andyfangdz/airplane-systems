/**
 * The walk-around's camera framing of an item, and its one retry: an item whose framing waited for the page's worker to
 * finish the fuselage skin (it kept the station's view meanwhile) is framed once the skin is in, unless the camera has
 * been moved since, by the user or by any other camera request.
 */
import { view } from "@/lib/registry";
import { useView } from "@/lib/view";
import { useFuselage } from "./fuselage-geo";
import { framePose, stepPose, type Step } from "./walk";

/** The item shown from the station while it waits for the fuselage, and the camera state when it was framed. */
let waiting: { step: Step; moves: number; cam: number | undefined } | null = null;

/** Fly to the item's framing; if it waits for the fuselage, keep the station's view and frame it once the skin is in. */
export function frameStep(step: Step) {
  const pose = framePose(step);
  const { p, t } = pose ?? step.station.cam;
  useView.getState().flyTo(p, t);
  waiting = pose ? null : { step, moves: view.moves, cam: useView.getState().cam?.id };
}

/** Forget a pending retry (another step, another screen, or the walk-around closed). */
export function cancelFrame() {
  waiting = null;
}

useFuselage.subscribe(({ settled }) => {
  if (!settled || !waiting) return;
  const w = waiting;
  waiting = null;
  if (view.moves !== w.moves || useView.getState().cam?.id !== w.cam) return;
  const { p, t } = stepPose(w.step);
  useView.getState().flyTo(p, t);
});
