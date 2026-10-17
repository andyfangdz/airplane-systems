import { createSimulation, type SimulationContext } from "@/lib/simulation";
import { stepModel } from "./step";
import {
  CRUISE_TRIM,
  FLAP_MAX,
  FLAP_STROKE,
  TO_TRIM,
  fuelAvail,
  initialLive,
  groundFlight,
  initialSim,
  solve,
  type Sim,
  type Elec,
  type ElectricalMemory,
} from "./model";

export type M20CCommand =
  { type: "scenario"; name: "cruise" | "ramp" } | { type: "pumpFlaps" } | { type: "primeThrottle" };

type Context = SimulationContext<Sim, Elec, ReturnType<typeof initialLive>>;

/** Fresh runtimes can be stepped, forked and restored without mounting this airplane's UI. */
export function createM20CSimulation() {
  return createSimulation<Sim, Elec, ReturnType<typeof initialLive>, ElectricalMemory | undefined, M20CCommand>({
    id: "m20c",
    initialState: () => structuredClone(initialSim),
    initialLive,
    initialMemory: () => undefined,
    solve,
    memoryFrom: (E) => ({ genOn: E.genOn }),
    step: stepModel,
    command: (context, command) => {
      const handlers = commands(context);
      if (command.type === "scenario") handlers.scenarios[command.name]();
      else handlers[command.type]();
    },
  });
}

function commands(context: Context) {
  const { store, live } = context;

  const fresh = (): Sim => structuredClone(initialSim);

  /** Cruise at 5,500 ft, gear and flaps up, PC engaged (the initial state). */
  function scenarioCruise() {
    Object.assign(live, initialLive());
    store.getState().update((d) => {
      const f = fresh();
      Object.assign(d, {
        ...f,
        fuel: { ...f.fuel, qL: d.fuel.qL, qR: d.fuel.qR },
        ctrl: { ...f.ctrl, trim: CRUISE_TRIM },
      });
    });
  }

  /**
   * Cold and dark on the ramp, set for the Owner's Manual's "Starting the engine" (OM p. 15): fullest tank, all switches off,
   * brakes on, carb heat off, mixture rich, prop high RPM, gear handle down and locked, flaps up.
   */
  function scenarioRamp() {
    Object.assign(live, initialLive(), {
      fs: groundFlight(),
      trimPrev: TO_TRIM,
      rpm: 0,
      map: 29.5,
      ff: 0,
      fuelP: 0,
      oilP: 0,
      oilT: 50,
      cht: 50,
      egt: 50,
      vac: 0,
      flapAng: 0,
      gearFrac: 0,
      prime: 0,
      fireT: -1,
      carbIce: 0,
      oilLoss: 0,
      crankT: 0,
    });
    store.getState().update((d) => {
      const f = fresh();
      const fuel = d.fuel;
      Object.assign(d, f);
      d.air = false;
      d.eng = {
        ...f.eng,
        running: false,
        altSpinning: false,
        key: "OFF",
        throttle: 0,
        prop: 1,
        mix: 1,
        carbHeat: 0,
      };
      d.elec = { ...f.elec, master: false, radios: false };
      d.sw = { fuelPump: false, pitotHeat: false, beacon: false, nav: false, landing: false };
      d.fuel = { ...fuel, sel: fuel.qL >= fuel.qR ? "L" : "R" };
      d.flaps.valve = "UP";
      d.gear = { lever: "DOWN", latch: false, diff: 0, park: true };
      d.ctrl = { pitch: 0, roll: 0, yaw: 0, trim: TO_TRIM };
      d.pc = { cutoff: false, rollTrim: 0 };
      d.env = { heat: 0, vent: 0.3, scoop: 0, stormWindow: false };
      d.stall.ias = 0;
      d.doors = { cabin: false, baggage: true };
    });
  }

  /** One stroke of the flap pump handle: with the control in DOWN it adds about half of take-off flap (OM p. 9: 2 strokes take-off, 4½ full). */
  function pumpFlaps() {
    const { s } = store.getState();
    if (s.flaps.valve !== "DOWN") return;
    live.flapAng = Math.min(FLAP_MAX, live.flapAng + FLAP_STROKE);
    live.pumpAnim = 1;
  }

  /**
   * One pump of the throttle: the carburetor's accelerator pump squirts fuel into the induction — the M20C's only priming
   * (OM p. 15: boost pump on, mixture rich, "pump the throttle twice"; three or four pumps when cold). Needs fuel pressure at
   * the carburetor, so on the ramp the boost pump must be on.
   */
  function primeThrottle() {
    const { s, E } = store.getState();
    if (!fuelAvail(s) || s.eng.running || !(E.fuelPump || live.fuelP > 0.5) || s.eng.mix < 0.5) return;
    live.prime = Math.min(8, live.prime + 1);
  }

  return { scenarios: { cruise: scenarioCruise, ramp: scenarioRamp }, pumpFlaps, primeThrottle };
}
