"use client";
import { createFleetWalkStore, restoreFleetWalkLive } from "@/lib/fleet-walk-store";
import { groundFlight, live } from "./model";
import { useDA40 } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
const initial = structuredClone(live);
export const walkController = createFleetWalkStore({
  logic: walk,
  sim: useDA40,
  live,
  systems: SYS,
  resetLive: () => {
    restoreFleetWalkLive(live, initial);
    live.rpm = live.ff = live.oilP = live.flapAng = live.prime = live.crankT = live.startTimer = 0;
    live.fs = groundFlight();
    live.afcs.trim = live.trimPrev = 0;
    live.afcs.powered = false;
  },
  syncLive: (s) => {
    live.flapAng = [0, 20, 42][s.flaps.cmd];
  },
});
