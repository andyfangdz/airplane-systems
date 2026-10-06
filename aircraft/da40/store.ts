"use client";
import { gfc700Init } from "@/lib/avionics/gfc700";
import { createSimStore } from "@/lib/simStore";
import { CRUISE_TRIM, cruiseFlight, groundFlight, initialSim, live, solveElec, type Sim } from "./model";

/** DA40 systems state (switches, levers, failures, quantities) and its electrical solution. */
export const useDA40 = createSimStore(initialSim, solveElec);

const fresh = (): Sim => structuredClone(initialSim);

/** Normal cruise at 4,500 ft: everything on and working (the initial state). */
export function scenarioCruise() {
  live.fs = cruiseFlight();
  live.afcs = { ...gfc700Init(), trim: CRUISE_TRIM };
  live.afcsDerived = "";
  Object.assign(live, { rpm: 2400, map: 23.5, ff: 9.4, fuelP: 27, oilP: 78, oilT: 188, cht: 345, egt: 1360, flapAng: 0, prime: 0, fireT: -1, oilLoss: 0 });
  useDA40.getState().update((d) => { const f = fresh(); Object.assign(d, { ...f, fuel: { ...f.fuel, qL: d.fuel.qL, qR: d.fuel.qR } }); });
}

/**
 * Cold and dark on the ramp, set up for "Before starting engine" (AFMS p. 37–38): parking brake set, rear door closed and
 * locked, front canopy in position 2 (cooling gap), throttle IDLE, mixture LEAN, RPM HIGH, avionics master and ESS BUS OFF.
 */
export function scenarioRamp() {
  live.fs = groundFlight();
  live.afcs = { ...gfc700Init(), trim: 0.1 };
  live.afcsDerived = "";
  Object.assign(live, { rpm: 0, map: 29.7, ff: 0, fuelP: 0, oilP: 0, oilT: 43, cht: 43, egt: 43, flapAng: 0, prime: 0, fireT: -1, oilLoss: 0, crankT: 0 });
  useDA40.getState().update((d) => {
    const f = fresh();
    Object.assign(d, f);
    d.air = false;
    d.eng = { ...f.eng, running: false, key: "OFF", throttle: 0, rpmLever: 1, mix: 0 };
    d.elec = { ...f.elec, bat: false, alt: false, avMaster: false, essBus: false };
    d.lights = { ...f.lights, position: false, strobe: false };
    d.pitot.heat = false;
    d.fuel = { ...d.fuel, sel: d.fuel.qL >= d.fuel.qR ? "L" : "R", pump: false };
    d.env = { heat: 0, dist: 0.5, window: false };
    d.stall.ias = 0;
    d.gear.park = true;
    d.doors = { canopy: "GAP", rear: true };
  });
}
