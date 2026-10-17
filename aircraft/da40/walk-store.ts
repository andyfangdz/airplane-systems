"use client";
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { groundFlight, initialLive } from "./model";
import { da40Runtime } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
export const walkController = createFleetWalkStore({
  logic: walk,
  runtime: da40Runtime,
  systems: SYS,
  resetLive: (_s, live) => {
    Object.assign(live, initialLive());
    live.rpm = live.ff = live.oilP = live.flapAng = live.prime = live.crankT = live.startTimer = 0;
    live.fs = groundFlight();
    live.afcs.trim = live.trimPrev = 0;
    live.afcs.powered = false;
  },
  syncLive: (s, _step, live) => {
    live.flapAng = [0, 20, 42][s.flaps.cmd];
  },
});
