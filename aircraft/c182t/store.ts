"use client";
import { initFlight, type FlightState } from "@/lib/avionics/flight";
import { kap140Power, type Kap140State } from "@/lib/avionics/kap140";
import { createSimStore } from "@/lib/simStore";
import { initialSim, kapReady, live, solve, type Sim } from "./model";

/** C182T systems state (switches, levers, failures, quantities) and its solved electrical/fuel picture. */
export const useC182 = createSimStore(initialSim, solve);

/* ---------- scenarios ---------- */
/**
 * Every scenario starts from the initial state, so failures, pulled breakers and battery drain from before don't carry
 * over; only the fuel on board, the time warp and the airplane's configuration (alternator, speed fairings) do. The
 * KAP 140's failures live outside the store and are cleared too.
 */
function fresh(d: Sim) {
  const f = structuredClone(initialSim);
  Object.assign(d, {
    ...f,
    warp: d.warp,
    altAmps: d.altAmps,
    fuel: { ...f.fuel, qL: d.fuel.qL, qR: d.fuel.qR },
    gear: { ...f.gear, fairings: d.gear.fairings },
  });
}
function clearLiveFailures() {
  live.kap = { ...live.kap, fail: {} };
  live.coPpm = 0;
}

/** Scenarios keep the flight clock running so KAP 140 timers (self-test, tones) stay consistent. */
const ground = (p: Partial<FlightState> = {}) =>
  initFlight({
    t: live.fs.t,
    onGround: true,
    ias: 0,
    vs: 0,
    pitch: 0,
    alt: 173,
    selAlt: 3000,
    hdg: 190,
    hdgBug: 190,
    crs: 190,
    power: 0,
    ...p,
  });

/** Cold and dark on the ramp: everything off, engine cold, ready for the POH 4-13 start. */
export function scenarioColdDark() {
  clearLiveFailures();
  live.fs = ground();
  live.rpm = 0;
  live.map = 29.9;
  live.oilP = 0;
  live.oilT = 60;
  live.cht = 60;
  live.egt = 60;
  live.wet = 0;
  live.hot = 0;
  live.vac = 0;
  live.gyro = 0;
  live.flapAng = 0;
  live.stallDemo = false;
  live.blade = 14.9;
  live.galUsed = 0;
  useC182.getState().update((d) => {
    fresh(d);
    d.ground = true;
    d.eng.running = false;
    d.eng.mags = "OFF";
    d.eng.rpm = 0;
    d.eng.throttle = 0;
    d.eng.prop = 1;
    d.eng.mix = 0;
    d.eng.cowl = 0;
    d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = false;
    d.elec.stby = "OFF";
    d.elec.cb = {};
    d.elec.ext = false;
    d.fuel.pump = false;
    d.fuel.sel = "LEFT";
    d.fuel.slip = false;
    d.flaps.cmd = 0;
    d.gear.park = true;
    d.lights = { ...d.lights, beacon: false, land: false, taxi: false, nav: false, strobe: false, dome: false };
    d.pitot.heat = false;
    d.ctrl = { pitch: 0, roll: 0, yaw: 0, rudTrim: 0 };
  });
}

/** KAP 140 disengaged and back to ROL / VS with nothing armed (keeps power, self-test, preselect, baro and trim). */
const kapOff = (k: Kap140State): Kap140State => ({
  ...k,
  ap: false,
  lat: "ROL",
  latArm: null,
  vert: "VS",
  gsArm: false,
  altArm: false,
  hold: null,
  pt: null,
  lostLat: null,
  lostGs: false,
  apFlash: 0,
  hdgFlash: 0,
  tone: 0,
  toneKind: null,
});

/** Engine running at 1,000 RPM on the ramp, avionics on (after the POH start checklist): the KAP 140 runs its self-test. */
export function scenarioRunUp() {
  clearLiveFailures();
  // AVIONICS BUS 2 has just come on after the start: power-cycle the computer so the next tick starts the preflight test (S3-20)
  live.kap = kap140Power(live.kap, false, live.fs.t);
  live.discTone = -99;
  live.fs = ground();
  live.rpm = 1000;
  live.map = 13;
  live.oilP = 60;
  live.oilT = 120;
  live.cht = 260;
  live.hot = 0.7;
  live.gyro = 1;
  live.flapAng = 0;
  live.stallDemo = false;
  live.blade = 14.9;
  useC182.getState().update((d) => {
    fresh(d);
    d.ground = true;
    d.eng.running = true;
    d.eng.mags = "BOTH";
    d.eng.rpm = 1000;
    d.eng.throttle = 0.12;
    d.eng.prop = 1;
    d.eng.mix = 0.95;
    d.eng.cowl = 1;
    d.eng.flooded = false;
    // external power, if used for the start, is disconnected by the end of the start checklist
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true;
    d.elec.stby = "ARM";
    d.elec.cb = {};
    d.elec.ext = false;
    d.fuel.pump = false;
    d.fuel.sel = "BOTH";
    d.flaps.cmd = 0;
    d.gear.park = true;
    d.lights = { ...d.lights, beacon: true, nav: true, strobe: false };
  });
}

/** Cruise at 6,000 ft, 2,300 RPM / 21 in, leaned, cowl flaps closed, autopilot off (KAP 140 already tested). */
export function scenarioCruise() {
  clearLiveFailures();
  live.fs = initFlight({
    t: live.fs.t,
    ias: 113,
    alt: 6000,
    selAlt: 6000,
    hdg: 90,
    hdgBug: 90,
    crs: 90,
    power: 0.59,
    oat: 3,
  });
  live.oilP = 72;
  live.oilT = 190;
  live.cht = 385;
  live.egt = 1380;
  live.hot = 1;
  live.gyro = 1;
  live.rpm = 2300;
  live.map = 21;
  live.flapAng = 0;
  live.stallDemo = false;
  live.blade = 29;
  if (!live.kap.powered || !live.kap.ready) live.kap = { ...kapReady(), on: live.fs.t - 100, trim: live.kap.trim };
  live.kap = kapOff(live.kap);
  live.discTone = -99;
  useC182.getState().update((d) => {
    fresh(d);
    d.ground = false;
    d.eng.running = true;
    d.eng.mags = "BOTH";
    d.eng.rpm = 2300;
    d.eng.throttle = 0.82;
    d.eng.prop = 0.89;
    d.eng.mix = 0.69;
    d.eng.cowl = 0;
    d.eng.flooded = false;
    d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = true;
    d.elec.stby = "ARM";
    d.elec.ext = false;
    d.fuel.sel = "BOTH";
    d.fuel.slip = false;
    d.flaps.cmd = 0;
    d.gear.park = false;
    d.ctrl = { pitch: 0, roll: 0, yaw: 0, rudTrim: 0 };
    if (d.fuel.qL + d.fuel.qR < 16) {
      d.fuel.qL = 34;
      d.fuel.qR = 33;
    }
  });
}
