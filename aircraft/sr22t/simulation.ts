import { assignLive, createSimulation } from "@/lib/simulation";
import { initialLive, initialSim, initialSimFor, solve, type Sim, type Elec, type ElectricalMemory } from "./model";
import { stepModel } from "./step";

export type SR22TCommand =
  | { type: "caps"; playing: boolean }
  | { type: "oxygenScenario"; index: number }
  | { type: "oxygenExposure"; minutes: number }
  | { type: "door"; command: DoorCommand };

export function createSR22TSimulation(search = "") {
  return createSimulation<Sim, Elec, ReturnType<typeof initialLive>, ElectricalMemory | undefined, SR22TCommand>({
    id: "sr22t",
    initialState: () => structuredClone(initialSimFor(search)),
    initialLive,
    initialMemory: () => undefined,
    solve,
    memoryFrom: (E) => ({ alt1: E.alt1, alt2: E.alt2, envHeld: { ...E.envHeld } }),
    step: stepModel,
    command: ({ store, live }, command) => {
      if (command.type === "caps") {
        live.capsT = command.playing ? 0 : -1;
        live.capsPlaying = command.playing;
        store.getState().update((d) => {
          d.capsOn = command.playing;
        });
      } else if (command.type === "oxygenScenario") {
        const scenario = OXY_SCENARIOS[command.index];
        if (!scenario) throw new Error(`Unknown oxygen scenario ${command.index}`);
        assignLive(live, initialLive());
        store.getState().update(scenario[1]);
      } else if (command.type === "oxygenExposure") {
        if (!Number.isFinite(command.minutes)) throw new Error("Oxygen exposure must be finite");
        const minutes = store.getState().s.paFt > 12500 ? Math.max(0, command.minutes) : 0;
        live.above12k5Min = live.above12k5Written = minutes;
        store.getState().update((d) => {
          d.oxy.above12k5Min = minutes;
        });
      } else store.getState().update((d) => applyDoorCommand(d, command.command));
    },
  });
}

/* ---------- oxygen scenarios ---------- */
/** Each starts from the initial state, keeping only the equipment fitted, so earlier failures and pulled breakers don't carry over. */
function fresh(d: Sim) {
  Object.assign(d, { ...structuredClone(initialSim), equip: d.equip });
}
/** Pure discrete recipes; apply them through startOxygenScenario to reset physical state and timers together. */
export const OXY_SCENARIOS: [string, (d: Sim) => void][] = [
  [
    "Oxygen left on after shutdown",
    (d) => {
      fresh(d);
      d.eng.running = false;
      d.eng.key = "OFF";
      d.oxy.on = true;
    },
  ],
  [
    "Low oxygen at FL180",
    (d) => {
      fresh(d);
      d.paFt = 18000;
      d.oxy.on = true;
      d.oxy.psi = 600;
    },
  ],
  [
    "Climbing above 14,000 ft with oxygen off",
    (d) => {
      fresh(d);
      d.paFt = 14500;
    },
  ],
];

/* ---------- doors: one action writes physical state and convenience-light inputs ---------- */
export type DoorCommand =
  | { cabin: "L" | "R"; position: Sim["doors"]["L"] }
  | { cabinLights: boolean }
  | { baggage: Sim["doors"]["bag"] }
  | { bagLocked: boolean };

/** Pure transition; a locked baggage door cannot open, and an open door cannot be key-locked. */
export function applyDoorCommand(d: Sim, command: DoorCommand) {
  if ("cabin" in command) d.doors[command.cabin] = command.position;
  else if ("cabinLights" in command) {
    d.doors.L = command.cabinLights ? "open" : "latched";
    if (!command.cabinLights) d.doors.R = "latched";
  } else if ("baggage" in command) {
    if (command.baggage === "closed" || !d.doors.bagLocked) d.doors.bag = command.baggage;
  } else if (d.doors.bag === "closed") d.doors.bagLocked = command.bagLocked;
  d.lights.door = d.doors.L !== "latched" || d.doors.R !== "latched";
  d.lights.bag = d.doors.bag === "open";
}
