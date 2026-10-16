"use client";
/** SR20-only study progress and reversible scene state. No progress or model state is shared with the SR22T walk. */
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { live } from "./model";
import { useSR20 } from "./store";
import { SYS } from "./systems";
import { flapsAt, walk } from "./walk";

export const walkController = createFleetWalkStore({
  logic: walk,
  sim: useSR20,
  live,
  systems: SYS,
  resetLive: () => {
    live.rpm = 0;
    live.flapAng = 0;
    live.capsT = -1;
    live.capsPlaying = false;
  },
  syncLive: (_s, { at, steps, prior, forward }) => {
    live.flapAng = flapsAt(prior, steps, at, forward && useSR20.getState().E.flapsPwr);
  },
});
