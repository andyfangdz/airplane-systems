"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { live } from "./model";
import { createDA40Simulation } from "./simulation";
export { createDA40Simulation } from "./simulation";
export type { DA40Command } from "./simulation";

export const da40Runtime = bindSimulation(createDA40Simulation(), live);
export const useDA40 = da40Runtime.useStore;

export const scenarioCruise = () => {
  da40Runtime.dispatch({ type: "scenario", name: "cruise" });
};
export const scenarioRamp = () => {
  da40Runtime.dispatch({ type: "scenario", name: "ramp" });
};
