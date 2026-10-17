"use client";
import { bindSimulation } from "@/lib/simulationBinding";
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
