"use client";
import { createSimStore } from "@/lib/simStore";
import { revealStage, useView } from "@/lib/view";
import { CAPS_CAM } from "./systems";
import { initialSim, live, solve } from "./model";

/** SR20 systems state (switches, failures, quantities) and its electrical solution. */
export const useSR20 = createSimStore(initialSim, solve);

export function startCaps() {
  live.capsT = 0; live.capsPlaying = true;
  useSR20.getState().update((d) => { d.capsOn = true; });
  useView.getState().flyTo(...CAPS_CAM);
  // phones: the handle is in the panel below the 3D view, which is otherwise scrolled mostly out of sight
  revealStage();
}

export function resetCaps() {
  live.capsT = -1; live.capsPlaying = false;
  useSR20.getState().update((d) => { d.capsOn = false; });
}
