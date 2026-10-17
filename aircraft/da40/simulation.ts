import { gfc700Init } from "@/lib/avionics/gfc700";
import { createSimulation, type SimulationContext } from "@/lib/simulation";
import { stepModel } from "./step";
import {
  CRUISE_TRIM,
  TO_TRIM,
  cruiseFlight,
  groundFlight,
  initialLive,
  initialSim,
  solve,
  type Sim,
  type Elec,
  type ElectricalMemory,
} from "./model";

export type DA40Command = { type: "scenario"; name: "cruise" | "ramp" };

type Context = SimulationContext<Sim, Elec, ReturnType<typeof initialLive>>;

/** Fresh runtimes can be stepped, forked and restored without mounting this airplane's UI. */
export function createDA40Simulation() {
  return createSimulation<Sim, Elec, ReturnType<typeof initialLive>, ElectricalMemory | undefined, DA40Command>({
    id: "da40",
    initialState: () => structuredClone(initialSim),
    initialLive,
    initialMemory: () => undefined,
    solve,
    memoryFrom: (E) => ({ altOn: E.altOn }),
    step: stepModel,
    command: (context, command) => {
      const handlers = commands(context);
      handlers.scenarios[command.name]();
    },
  });
}

function commands(context: Context) {
  const { store, live } = context;

  const fresh = (): Sim => structuredClone(initialSim);

  /** Normal cruise at 4,500 ft: everything on and working (the initial state). */
  function scenarioCruise() {
    Object.assign(live, initialLive());
    live.fs = cruiseFlight();
    live.afcs = { ...gfc700Init(), trim: CRUISE_TRIM };
    live.afcsDerived = "";
    live.afcsUser = {};
    Object.assign(live, {
      trimPrev: CRUISE_TRIM,
      rpm: 2400,
      map: 23.5,
      ff: 9.4,
      fuelP: 27,
      oilP: 78,
      oilT: 188,
      cht: 345,
      egt: 1360,
      flapAng: 0,
      prime: 0,
      fireT: -1,
      oilLoss: 0,
    });
    store.getState().update((d) => {
      const f = fresh();
      Object.assign(d, { ...f, fuel: { ...f.fuel, qL: d.fuel.qL, qR: d.fuel.qR } });
    });
  }

  /**
   * Cold and dark on the ramp, set up for "Before starting engine" (AFMS p. 37–38): parking brake set, rear door closed and
   * locked, front canopy in position 2 (cooling gap), throttle IDLE, mixture LEAN, RPM HIGH, avionics master and ESS BUS OFF.
   */
  function scenarioRamp() {
    Object.assign(live, initialLive());
    live.fs = groundFlight();
    live.afcs = { ...gfc700Init(), trim: TO_TRIM };
    live.afcsDerived = "";
    live.afcsUser = {};
    Object.assign(live, {
      trimPrev: TO_TRIM,
      rpm: 0,
      map: 29.7,
      ff: 0,
      fuelP: 0,
      oilP: 0,
      oilT: 43,
      cht: 43,
      egt: 43,
      flapAng: 0,
      prime: 0,
      fireT: -1,
      oilLoss: 0,
      crankT: 0,
    });
    store.getState().update((d) => {
      const f = fresh();
      Object.assign(d, f);
      d.air = false;
      d.eng = { ...f.eng, running: false, key: "OFF", throttle: 0, rpmLever: 1, mix: 0 };
      d.elec = { ...f.elec, bat: false, alt: false, avMaster: false, essBus: false };
      d.lights = { ...f.lights, position: false, strobe: false };
      d.pitot.heat = false;
      d.fuel = { ...d.fuel, sel: d.fuel.qL >= d.fuel.qR ? "L" : "R", pump: false };
      d.env = { heat: 0, dist: 0.5, window: false, extraVents: true };
      d.stall.ias = 0;
      d.gear.park = true;
      d.doors = { canopy: "GAP", rear: true };
    });
  }

  return { scenarios: { cruise: scenarioCruise, ramp: scenarioRamp } };
}
