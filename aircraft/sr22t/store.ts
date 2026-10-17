"use client";
import { bindSimulation } from "@/lib/simulationBinding";
import { revealStage, useView } from "@/lib/view";
import { CAPS_CAM } from "./systems";
import { live } from "./model";
import { createSR22TSimulation, type DoorCommand } from "./simulation";
export { createSR22TSimulation, OXY_SCENARIOS, applyDoorCommand } from "./simulation";
export type { SR22TCommand, DoorCommand } from "./simulation";

/**
 * SR22T systems state (switches, failures, quantities) and its electrical solution. The page's query string is read once,
 * on load (see initialSimFor): `?fiki=0` starts the airplane without ice protection, `?lights=land,ice` with those
 * lights on, `?iceprotect=on` with ice protection on.
 */
export const sr22Runtime = bindSimulation(
  createSR22TSimulation(typeof location === "undefined" ? "" : location.search),
  live,
);
export const useSR22T = sr22Runtime.useStore;
export const startOxygenScenario = (index: number) => sr22Runtime.dispatch({ type: "oxygenScenario", index });
export const setOxygenExposure = (minutes: number) => sr22Runtime.dispatch({ type: "oxygenExposure", minutes });

export function startCaps() {
  sr22Runtime.dispatch({ type: "caps", playing: true });
  useView.getState().flyTo(...CAPS_CAM);
  // phones: the handle is in the panel below the 3D view, which is otherwise scrolled mostly out of sight
  revealStage();
}

export function resetCaps() {
  sr22Runtime.dispatch({ type: "caps", playing: false });
}

export const setDoor = (command: DoorCommand) => sr22Runtime.dispatch({ type: "door", command });
