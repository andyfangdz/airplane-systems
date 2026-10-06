"use client";
import { initFlight, type FlightState } from "@/lib/avionics/flight";
import { createSimStore } from "@/lib/simStore";
import { initialSim, live, solve } from "./model";

/** C172S systems state (switches, levers, failures, quantities) and its solved electrical/fuel picture. */
export const useC172 = createSimStore(initialSim, solve);

/* ---------- scenarios ---------- */
/** Scenarios keep the flight clock running so AFCS timers (preflight test, disconnect tone) stay consistent. */
const ground = (p: Partial<FlightState> = {}) => initFlight({ t: live.fs.t, onGround: true, ias: 0, vs: 0, pitch: 0, alt: 173, selAlt: 3000, hdg: 220, hdgBug: 220, crs: 220, power: 0, ...p });

/** Cold and dark on the ramp: everything off, engine cold, ready for the POH 4-11 start. */
export function scenarioColdDark() {
  live.fs = ground(); live.rpm = 0; live.oilP = 0; live.oilT = 60; live.cht = 60; live.egt = 60; live.wet = 0; live.hot = 0; live.vac = 0; live.gyro = 0; live.flapAng = 0;
  live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = true; d.eng.running = false; d.eng.mags = "OFF"; d.eng.rpm = 0; d.eng.throttle = 0; d.eng.mix = 0; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = false; d.elec.stby = "OFF"; d.elec.cb = {};
    d.fuel.pump = false; d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = true;
    d.lights = { ...d.lights, beacon: false, land: false, taxi: false, nav: false, strobe: false, dome: false };
    d.pitot.heat = false; d.ctrl = { pitch: 0, roll: 0, yaw: 0 };
  });
}

/** Engine running at 1,000 RPM on the ramp, avionics on (after the POH start checklist). */
export function scenarioRunUp() {
  live.fs = ground(); live.rpm = 1050; live.oilP = 60; live.oilT = 120; live.cht = 250; live.hot = 0.7; live.gyro = 1; live.flapAng = 0; live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = true; d.eng.running = true; d.eng.mags = "BOTH"; d.eng.rpm = 1050; d.eng.throttle = 0.06; d.eng.mix = 0.95; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true; d.elec.stby = "ARM"; d.elec.cb = {};
    d.fuel.pump = false; d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = true;
    d.lights = { ...d.lights, beacon: true, nav: true, strobe: false };
  });
}

/** Cruise at 4,500 ft, 110 KIAS, AP off. */
export function scenarioCruise() {
  live.fs = initFlight({ t: live.fs.t, ias: 110, alt: 4500, selAlt: 4500, hdg: 90, hdgBug: 90, crs: 90, power: 0.75, oat: 8 });
  live.oilP = 74; live.oilT = 186; live.cht = 372; live.egt = 1360; live.hot = 1; live.gyro = 1; live.rpm = 2400; live.flapAng = 0; live.stallDemo = false;
  useC172.getState().update((d) => {
    d.ground = false; d.eng.running = true; d.eng.mags = "BOTH"; d.eng.rpm = 2400; d.eng.throttle = 0.86; d.eng.mix = 0.82; d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true; d.elec.stby = "ARM";
    d.fuel.sel = "BOTH"; d.fuel.shutoff = true; d.flaps.cmd = 0; d.gear.park = false; d.ctrl = { pitch: 0, roll: 0, yaw: 0 };
    if (d.fuel.qL + d.fuel.qR < 10) { d.fuel.qL = 20; d.fuel.qR = 19; }
  });
}
