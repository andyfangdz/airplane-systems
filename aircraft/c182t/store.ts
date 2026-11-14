"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { revealStage, useView } from "@/lib/view";
import { BRS_CAM } from "./brs";
import { live } from "./model";
import { createC182Simulation } from "./simulation";
export { createC182Simulation } from "./simulation";
export type { C182Command } from "./simulation";

export const c182Runtime = bindSimulation(createC182Simulation(), live);
export const useC182 = c182Runtime.useStore;

export const scenarioColdDark = () => {
  c182Runtime.dispatch({ type: "scenario", name: "coldDark" });
};
export const scenarioRunUp = () => {
  c182Runtime.dispatch({ type: "scenario", name: "runUp" });
};
export const scenarioCruise = () => {
  c182Runtime.dispatch({ type: "scenario", name: "cruise" });
};

/** Pull the optional BRS activation handle: the deployment timeline starts at T+0 and the camera pulls back to see it. */
export function startBrs() {
  c182Runtime.dispatch({ type: "brs", deployed: true });
  if (!useC182.getState().s.brs.deployed) return;
  useView.getState().flyTo(...BRS_CAM);
  // phones: the handle is in the panel below the 3D view, which is otherwise scrolled mostly out of sight
  revealStage();
}

/** Reset the BRS deployment (the parachute repacked, the airplane back on the scene's ground). */
export function resetBrs() {
  c182Runtime.dispatch({ type: "brs", deployed: false });
}
