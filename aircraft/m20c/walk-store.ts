"use client";
import { createFleetWalkStore, restoreFleetWalkLive } from "@/lib/fleet-walk-store";
import { groundFlight, initialLive, live } from "./model";
import { useM20C } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
export const walkController = createFleetWalkStore({
  logic: walk,
  sim: useM20C,
  live,
  systems: SYS,
  resetLive: () => {
    restoreFleetWalkLive(live, initialLive());
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
  syncLive: () => {
    live.flapAng = 0;
    live.gearFrac = 0;
  },
});
