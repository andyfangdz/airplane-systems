"use client";
import { initFlight } from "@/lib/avionics/flight";
import { createFleetWalkStore, restoreFleetWalkLive } from "@/lib/fleet-walk-store";
import { initialLive, live } from "./model";
import { useC172 } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
export const walkController = createFleetWalkStore({
  logic: walk,
  sim: useC172,
  live,
  systems: SYS,
  resetLive: () => {
    restoreFleetWalkLive(live, initialLive());
    live.rpm =
      live.ff =
      live.oilP =
      live.vac =
      live.flapAng =
      live.wet =
      live.crankT =
      live.primeRun =
      live.restartT =
        0;
    live.fs = initFlight({ onGround: true, ias: 0, power: 0, vs: 0, pitch: 0 });
    live.afcs.trim = 0;
    live.afcs.powered = false;
  },
  syncLive: (s) => {
    live.flapAng = s.flaps.cmd;
  },
});
