"use client";
/**
 * The carburetor page's state. The engine is the O-360's own simulation (the engine page's store, so both pages show
 * the same engine); each frame advances it and then reads the carburetor's side of it into `live` (the scene reads it
 * in `useFrame`, the panel through `useLiveSnapshot`). View toggles are a small zustand store.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { O360 } from "@/engines/o360/spec";
import { pumpStep, readCarb, type CarbReading, type Pump } from "@/engines/components/carburetor/carburetor";
import { advance, simFor, startScenario, type EngineSim } from "../store";

export type CarbLive = CarbReading &
  Pump & {
    rpm: number;
    map: number;
    fuelPsi: number;
    inletC: number;
    chamberC: number;
    ice: number;
  };

export const carbSim = (): EngineSim => simFor(O360);

export const live: CarbLive = {
  ...readCarb(O360, carbSim().s, carbSim().useUi.getState().controls),
  plunger: 0,
  squirt: 0,
  rpm: 0,
  map: 0,
  fuelPsi: 0,
  inletC: 15,
  chamberC: 15,
  ice: 0,
};

export interface CarbView {
  /** See through the castings. */
  xray: boolean;
  labels: boolean;
  /** Draw the air and fuel moving through the carburetor. */
  flow: boolean;
  set: (p: Partial<Omit<CarbView, "set">>) => void;
}

export const useCarbView = create<CarbView>((set) => ({
  xray: true,
  labels: true,
  flow: true,
  set: (p) => set(p),
}));

function read(sim: EngineSim, pump: Pump) {
  const s = sim.s;
  Object.assign(live, readCarb(sim.spec, s, sim.useUi.getState().controls), pump, {
    rpm: s.rpm,
    map: s.map,
    fuelPsi: s.fuelPsi,
    inletC: s.inletC,
    chamberC: s.carbC,
    ice: s.ice,
  });
}

/**
 * Run the engine and read the carburetor on animation frames while the page is mounted. An engine nobody has set up
 * yet starts from performance cruise, so the main metering system is flowing when the page opens.
 */
export function useCarbLoop(sim: EngineSim) {
  useEffect(() => {
    const ui = sim.useUi.getState();
    if (sim.s.rpm === 0 && !ui.view.scenario && !ui.view.loading) startScenario(sim, "cruise75");
    const carb = sim.spec.fuelSystem.kind === "carburetor" ? sim.spec.fuelSystem : null;
    let pump: Pump = { plunger: sim.useUi.getState().controls.throttle, squirt: 0 };
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.5);
      last = now;
      advance(sim, dt);
      if (carb && !sim.useUi.getState().view.paused)
        pump = pumpStep(carb, pump, sim.useUi.getState().controls.throttle, dt, sim.s.bowl);
      read(sim, pump);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
}
