"use client";
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { groundFlight, initialLive } from "./model";
import { m20cRuntime } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
export const walkController = createFleetWalkStore({
  logic: walk,
  runtime: m20cRuntime,
  systems: SYS,
  resetLive: (_s, live) => {
    Object.assign(live, initialLive());
    live.rpm =
      live.ff =
      live.oilP =
      live.vac =
      live.flapAng =
      live.gearFrac =
      live.prime =
      live.crankT =
      live.startTimer =
        0;
    live.fs = groundFlight();
  },
  syncLive: (_s, _step, live) => {
    live.flapAng = 0;
    live.gearFrac = 0;
  },
});
