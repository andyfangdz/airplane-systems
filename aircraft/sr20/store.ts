"use client";
import { createSimStore } from "@/lib/simStore";
import { useView } from "@/lib/view";
import { CAPS_CAM } from "./systems";
import { initialSim, live, solve } from "./model";

/** SR20 systems state (switches, failures, quantities) and its electrical solution. */
export const useSR20 = createSimStore(initialSim, solve);

export function startCaps() {
  live.capsT = 0; live.capsPlaying = true;
  useSR20.getState().update((d) => { d.capsOn = true; });
  useView.getState().flyTo(...CAPS_CAM);
}

export function resetCaps() {
  live.capsT = -1; live.capsPlaying = false;
  useSR20.getState().update((d) => { d.capsOn = false; });
}
