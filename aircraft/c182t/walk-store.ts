"use client";
import { initFlight } from "@/lib/avionics/flight";
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { initialLive } from "./model";
import { c182Runtime } from "./store";
import { SYS } from "./systems";
import { walk } from "./walk";
export const walkController = createFleetWalkStore({
  logic: walk,
  runtime: c182Runtime,
  systems: SYS,
  resetLive: (_s, live) => {
    Object.assign(live, initialLive());
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
    live.kap.trim = 0;
    live.kap.powered = false;
  },
  syncLive: (s, _step, live) => {
    live.flapAng = s.flaps.cmd;
  },
});
