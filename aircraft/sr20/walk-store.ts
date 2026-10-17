"use client";
/** SR20-only study progress and reversible scene state. No progress or model state is shared with the SR22T walk. */
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { sr20Runtime, useSR20 } from "./store";
import { SYS } from "./systems";
import { flapsAt, walk } from "./walk";

export const walkController = createFleetWalkStore({
  logic: walk,
  runtime: sr20Runtime,
  systems: SYS,
  resetLive: (_s, live) => {
    live.rpm = 0;
    live.flapAng = 0;
    live.capsT = -1;
    live.capsPlaying = false;
  },
  syncLive: (_s, { at, steps, prior, forward }, live) => {
    live.flapAng = flapsAt(prior, steps, at, forward && useSR20.getState().E.flapsPwr);
  },
});
