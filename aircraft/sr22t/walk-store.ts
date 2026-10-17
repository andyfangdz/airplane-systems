"use client";
/**
 * The SR22T walk-around session (lib/fleet-walk-store.ts): the cabin station drives the SR22T model through the items'
 * `sim` steps and the flaps follow (walk.ts flapsAt), so a jump, a resume or a step back shows the same airplane as walking
 * there item by item.
 */
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { FLAP_DEG, live } from "./model";
import { useSR22T } from "./store";
import { SYS } from "./systems";
import { flapsAt, walk } from "./walk";

export const walkController = createFleetWalkStore({
  logic: walk,
  sim: useSR22T,
  live,
  systems: SYS,
  resetLive: () => {
    live.rpm = 0;
    live.flapAng = FLAP_DEG[0];
  },
  syncLive: (_s, { at, steps, prior, forward }) => {
    live.flapAng = flapsAt(prior, steps, at, forward && useSR22T.getState().E.flapsPwr);
  },
});

/** Names of the parts the progressive build adds first for the walk-around (Airplane.tsx). */
export const walkFirst = () => walkController.first();
