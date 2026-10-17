"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { live } from "./model";
import { createM20CSimulation } from "./simulation";
export { createM20CSimulation } from "./simulation";
export type { M20CCommand } from "./simulation";

export const m20cRuntime = bindSimulation(createM20CSimulation(), live);
export const useM20C = m20cRuntime.useStore;

export const scenarioCruise = () => {
  m20cRuntime.dispatch({ type: "scenario", name: "cruise" });
};
export const scenarioRamp = () => {
  m20cRuntime.dispatch({ type: "scenario", name: "ramp" });
};
export const pumpFlaps = () => m20cRuntime.dispatch({ type: "pumpFlaps" });
export const primeThrottle = () => m20cRuntime.dispatch({ type: "primeThrottle" });
