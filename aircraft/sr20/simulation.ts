import { createSimulation } from "@/lib/simulation";
import { initialLive, initialSim, solve, type Sim, type Elec } from "./model";
import { stepModel } from "./step";

export type SR20Command = { type: "caps"; playing: boolean };

export function createSR20Simulation() {
  return createSimulation<Sim, Elec, ReturnType<typeof initialLive>, undefined, SR20Command>({
    id: "sr20",
    initialState: () => structuredClone(initialSim),
    initialLive,
    initialMemory: () => undefined,
    solve,
    memoryFrom: () => undefined,
    step: stepModel,
    command: ({ store, live }, command) => {
      live.capsT = command.playing ? 0 : -1;
      live.capsPlaying = command.playing;
      store.getState().update((d) => {
        d.capsOn = command.playing;
      });
    },
  });
}
