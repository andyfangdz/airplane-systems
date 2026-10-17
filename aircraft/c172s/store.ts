"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { live } from "./model";
import { createC172Simulation } from "./simulation";
export { createC172Simulation } from "./simulation";
export type { C172Command } from "./simulation";

export const c172Runtime = bindSimulation(createC172Simulation(), live);
export const useC172 = c172Runtime.useStore;

export const scenarioColdDark = () => {
  c172Runtime.dispatch({ type: "scenario", name: "coldDark" });
};
export const scenarioRunUp = () => {
  c172Runtime.dispatch({ type: "scenario", name: "runUp" });
};
export const scenarioCruise = () => {
  c172Runtime.dispatch({ type: "scenario", name: "cruise" });
};
