"use client";
/**
 * The carburetor page's state. The engine is the O-360's own simulation (the engine page's store, so both pages show
 * the same engine); each frame advances it and then reads the carburetor's side of it into `live` (the scene reads it
 * in `useFrame`, the panel through `useLiveSnapshot`). View toggles are a small zustand store (`createViewStore`).
 */
import { useEffect } from "react";
import { O360 } from "@/engines/o360/spec";
import {
  PRIMER_IDLE,
  primerStroke,
  pumpStep,
  runPrimer,
  readCarb,
  type CarbReading,
  type Primer,
  type Pump,
} from "@/engines/components/carburetor/carburetor";
import { createViewStore } from "../sim";
import { simFor, startScenario, useEngineLoop, type EngineSim } from "../store";

export type CarbLive = CarbReading &
  Pump & {
    rpm: number;
    map: number;
    fuelPsi: number;
    inletC: number;
    chamberC: number;
    ice: number;
    primer: Primer;
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
  primer: PRIMER_IDLE,
};

/** Pull and push the primer once more (the loop sends the fuel to the cylinders as the plunger goes in). */
export const primeStroke = () => {
  live.primer = primerStroke(live.primer);
};

/** `flow` draws the air and fuel moving through the carburetor. */
export const useCarbView = createViewStore({ xray: true, labels: true, flow: true });

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

/** Compose accessories on the engine clock: engine, pump and primer, then readings, every fixed step. */
function carbStep(sim: EngineSim) {
  const carb = sim.spec.fuelSystem.kind === "carburetor" ? sim.spec.fuelSystem : null;
  let pump: Pump = { plunger: sim.useUi.getState().controls.throttle, squirt: 0 },
    resets = sim.resets;
  return (dt: number) => {
    // a scenario replaced the engine: strokes asked for before don't carry over to it
    if (sim.resets !== resets) {
      resets = sim.resets;
      live.primer = PRIMER_IDLE;
    }
    if (carb && !sim.useUi.getState().view.paused) {
      pump = pumpStep(carb, pump, sim.useUi.getState().controls.throttle, dt, sim.s.bowl);
      live.primer = runPrimer(sim.spec, sim.s, live.primer, dt);
    }
    read(sim, pump);
  };
}

/**
 * Run the engine and read the carburetor on animation frames while the page is mounted. An engine nobody has set up
 * yet starts from performance cruise, so the main metering system is flowing when the page opens.
 */
export function useCarbLoop(sim: EngineSim) {
  useEffect(() => {
    const ui = sim.useUi.getState();
    if (sim.s.rpm === 0 && !ui.view.scenario && !ui.view.loading) startScenario(sim, "cruise75");
    const step = carbStep(sim);
    step(0);
    return sim.subscribeSteps(step);
  }, [sim]);
  useEngineLoop(sim);
}
