"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { revealStage, useView } from "@/lib/view";
import { CAPS_CAM } from "./systems";
import { live } from "./model";
import { createSR20Simulation } from "./simulation";
export { createSR20Simulation } from "./simulation";
export type { SR20Command } from "./simulation";

export const sr20Runtime = bindSimulation(createSR20Simulation(), live);
export const useSR20 = sr20Runtime.useStore;

export function startCaps() {
  sr20Runtime.dispatch({ type: "caps", playing: true });
  useView.getState().flyTo(...CAPS_CAM);
  // phones: the handle is in the panel below the 3D view, which is otherwise scrolled mostly out of sight
  revealStage();
}

export function resetCaps() {
  sr20Runtime.dispatch({ type: "caps", playing: false });
}
