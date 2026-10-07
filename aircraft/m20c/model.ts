/**
 * 1967 Mooney M20C simulation model: discrete state, the pure electrical solver, engine / fuel / vacuum helpers and the
 * warning-light and horn list. Sources: the Mark 21 (M20C) Owner's Manual, 1965 edition with the 1962–64 supplement
 * ("OM p. n" — the closest available edition to the 1967 book, same systems: manual gear, hydraulic flaps, generator,
 * vacuum step, PC), the M20C Ranger Operator's Manual of Dec 1974 ("Ranger 2-n", used where the older book is silent),
 * the 1963 FAA Approved Flight Manual for s/n 2394, and TCDS 2A3. Where this model makes an assumption it says so.
 */
import { initFlight, type FlightCfg, type FlightState } from "@/lib/avionics/flight";
import type { CasLevel } from "../types";

/** Ignition / starter switch: OFF – R – L – BOTH – START (push in to crank), spring return to BOTH (OM p. 2, 16). */
export type Key = "OFF" | "R" | "L" | "BOTH" | "START";
export type FuelSel = "L" | "R" | "OFF";
/** Johnson bar: DOWN = handle in the down-lock socket under the panel; UP = handle in the up-lock socket on the floor. */
export type GearLever = "DOWN" | "UP";
/** Flap-shaped control beside the pump handle: DOWN holds pumped pressure; UP lets the relief valve bleed the flaps up. */
export type FlapValve = "DOWN" | "UP";

export interface Sim {
  /** Airborne or on the ramp (drives the flight-state integrator, ram air and gear-retraction logic). */
  air: boolean;
  eng: {
    running: boolean;
    key: Key;
    /** Throttle, propeller (governor) and mixture 0..1: closed/low RPM/idle cut-off … full/high RPM/rich. */
    throttle: number;
    prop: number;
    mix: number;
    /** Carburetor heat 0 (cold, filtered) … 1 (full hot, unfiltered). Cowl flaps open or closed (push-pull control). */
    carbHeat: number;
    cowlFlaps: boolean;
    fail: {
      governor: boolean;
      oilLeak: boolean;
      mechPump: boolean;
      carbIce: boolean;
      vacPump: boolean;
      starterStuck: boolean;
    };
  };
  elec: {
    /** Master switch (left side of the flight panel) and the radio master / avionics. */
    master: boolean;
    radios: boolean;
    fail: { gen: boolean; bat: boolean };
    /** Minutes the airplane has run on the battery alone (slider). */
    tBat: number;
  };
  /** The seven switch-breakers on the lower left panel (OM p. 4): position of each switch. */
  sw: { fuelPump: boolean; pitotHeat: boolean; beacon: boolean; nav: boolean; landing: boolean };
  /** Tripped switch-breakers and pulled push-to-reset breakers, by label. */
  cb: Record<string, boolean>;
  fuel: { sel: FuelSel; qL: number; qR: number };
  flaps: { valve: FlapValve };
  /** Johnson bar, its thumb safety latch (pressed = unlocked), toe brakes −1 (left) … +1 (right), parking-brake knob. */
  gear: { lever: GearLever; latch: boolean; diff: number; park: boolean };
  /** Control wheel and pedals −1..1 (pitch + = aft / nose up, roll + = right, yaw + = right pedal); trim wheel −1 (nose down) … +1 (nose up). */
  ctrl: { pitch: number; roll: number; yaw: number; trim: number };
  /** Positive Control: cut-off valve held in the left wheel grip; roll-trim knob on the turn coordinator −1 (left) … +1 (right). */
  pc: { cutoff: boolean; rollTrim: number };
  pitot: { heatInstalled: boolean; oat: number; altStatic: boolean };
  /** Stall-warning demo: indicated airspeed (mph) on the ground, vane stuck. */
  stall: { ias: number; stuck: boolean };
  lights: { instr: number; spot: number; cabin: boolean; selector: number };
  /** Cabin heat valve 0..1, right-scoop cabin vent 0..1, overhead ram-air scoop 0 (retracted) … 1 (extended), pilot's storm window. */
  env: { heat: number; vent: number; scoop: number; stormWindow: boolean };
  doors: { cabin: boolean; baggage: boolean };
}

export const initialSim: Sim = {
  air: true,
  eng: {
    running: true,
    key: "BOTH",
    throttle: 0.7,
    prop: 0.78,
    mix: 0.8,
    carbHeat: 0,
    cowlFlaps: false,
    fail: { governor: false, oilLeak: false, mechPump: false, carbIce: false, vacPump: false, starterStuck: false },
  },
  elec: { master: true, radios: true, fail: { gen: false, bat: false }, tBat: 0 },
  sw: { fuelPump: false, pitotHeat: false, beacon: true, nav: true, landing: false },
  cb: {},
  fuel: { sel: "L", qL: 20, qR: 19 },
  flaps: { valve: "UP" },
  gear: { lever: "UP", latch: false, diff: 0, park: false },
  ctrl: { pitch: 0, roll: 0, yaw: 0, trim: 0.2 },
  pc: { cutoff: false, rollTrim: 0 },
  pitot: { heatInstalled: true, oat: 10, altStatic: false },
  stall: { ias: 110, stuck: false },
  lights: { instr: 0, spot: 0, cabin: false, selector: 0 },
  env: { heat: 0.3, vent: 0.4, scoop: 0.3, stormWindow: false },
  doors: { cabin: true, baggage: true },
};

/** The integrator works in knots; the M20C's instruments read miles per hour. */
export const MPH = 1.15078;
export const mph = (kt: number) => kt * MPH;

/**
 * Flight-state model tuned to the Owner's Manual: ≈ 150 mph TAS at 75 % (OM Fig. 3 cruise tables, 2,200 lb), ≈ 165 mph at
 * full throttle low, Vy ≈ 105 mph, stall 67 mph clean (OM Fig. 4), in knots.
 */
export const M20C_FLIGHT: FlightCfg = {
  v0: 48,
  vp: 100,
  fpmPerKt: 13,
  vMin: 52,
  maxBank: 35,
  rollRate: 9,
  tauVs: 1.4,
  tauIas: 7,
};

export const cruiseFlight = (): FlightState =>
  initFlight({ hdg: 270, hdgBug: 270, crs: 270, alt: 5500, selAlt: 5500, ias: 126, power: 0.7, oat: 10, baro: 29.98 });
export const groundFlight = (): FlightState =>
  initFlight({
    hdg: 10,
    hdgBug: 10,
    crs: 10,
    alt: 390,
    selAlt: 3000,
    ias: 0,
    power: 0,
    vs: 0,
    pitch: 0,
    oat: 10,
    onGround: true,
    baro: 29.98,
  });

/** Trim wheel setting (−1..1) at the take-off mark on the floor indicator (OM p. 9) — modelled slightly nose up. */
export const TO_TRIM = 0.15;
/** Trim that holds cruise with the wheel centred (tick.ts trimPitch). */
export const CRUISE_TRIM = 0.2;

/** Fast-changing values advanced every frame (outside React state). */
export const live = {
  rpm: 2450,
  map: 23.0,
  ff: 9.6,
  fuelP: 3.0,
  oilP: 78,
  oilT: 185,
  cht: 390,
  egt: 1350,
  vac: 4.8,
  /** Flap angle (deg, 0…33), pump-handle stroke animation 0..1. */
  flapAng: 0,
  pumpAnim: 0,
  /** Gear 0 = down and locked … 1 = up and locked; the bar follows it. Entry step 0 = extended … 1 = retracted. */
  gearFrac: 1,
  stepFrac: 1,
  /** START push hold, cranking time, starvation timer, priming shots in the induction (decays), time since firing, carb ice 0..1. */
  startTimer: 0,
  crankT: 0,
  starve: 0,
  prime: 0,
  fireT: -1,
  carbIce: 0,
  oilLoss: 0,
  trimRate: 0,
  /** Effective control positions shown on the wheel and surfaces (pilot plus the PC servos). */
  eff: { pitch: 0, roll: 0, yaw: 0 },
  /** PC servo contribution to roll and yaw (−1..1), for the servo-bladder animation. */
  pcRoll: 0,
  pcYaw: 0,
  fs: cruiseFlight(),
};

/* ---------- electrical ---------- */

/**
 * Breakers. The lower-left switch-breakers (OM p. 4: "act in combination both as on-off switches and as breaker switches";
 * an overload flips the switch off) and the push-to-reset breakers under the cover on the lower right of the co-pilot's
 * panel. The 1965 book names the switches but not the push-to-reset circuits; the list of those follows the Ranger
 * schematic (Ranger Fig. 2-4) with the electric-gear and alternator circuits left out, and is therefore an inference.
 */
export const SWITCH_CB: [string, number][] = [
  ["FUEL PUMP", 5],
  ["PITOT HEAT", 10],
  ["BEACON", 5],
  ["NAV LTS", 5],
  ["LDG LT", 10],
];
export const PUSH_CB: [string, number][] = [
  ["ALT", 60],
  ["ALT FIELD", 5],
  ["GEAR WARN", 5],
  ["STALL WARN", 5],
  ["IGN / VIBRATOR", 5],
  ["INSTRUMENTS", 5],
  ["TURN & BANK", 5],
  ["VAC WARN", 5],
  ["INST LTS", 5],
  ["RADIO MASTER", 15],
  ["NAV/COM 1", 5],
  ["NAV/COM 2", 5],
  ["XPDR", 5],
];

export interface Elec {
  /** Bus volts (0 when dead), alternator on line, battery state, ammeter (+ charge / − discharge), total load (A). */
  bus: number;
  genOn: boolean;
  batOk: boolean;
  batDead: boolean;
  batFrac: number;
  amps: number;
  load: number;
  batLoad: number;
  endurance: number;
  starterPwr: boolean;
  starterOn: boolean;
  vibrator: boolean;
  fuelPump: boolean;
  pitotHeat: boolean;
  beacon: boolean;
  nav: boolean;
  landing: boolean;
  gaugesPwr: boolean;
  gearWarn: boolean;
  stallWarn: boolean;
  turnBank: boolean;
  vacWarn: boolean;
  instLts: boolean;
  radios: boolean;
  xpdr: boolean;
}

/** Typical loads (A, 12 V) — illustrative; the Owner's Manual gives none. */
const LOAD = {
  radios: 6,
  xpdr: 2,
  nav: 3.5,
  beacon: 3,
  landing: 8,
  pitot: 5,
  fuelPump: 2,
  inst: 1.5,
  turnBank: 0.6,
  gauges: 0.4,
  vibrator: 1.2,
  gearLts: 0.3,
  spot: 0.8,
  cabin: 0.6,
};
/** 35 Ah battery (OM p. 3), 70 % usable. */
const BAT_AH = 24.5;

/**
 * Alternator excitation memory: the field is fed from the bus through ALT FIELD, so with a dead battery the alternator can
 * only come on line if it was already excited. Updated after every solve.
 */
let altExcited = true;

/**
 * Electrical solver. One bus: battery → master relay at the battery (master switch) → bus; 60 A 12 V alternator → ALT 60 A
 * breaker → bus, its field excited from the bus through ALT FIELD and the voltage regulator (Ranger 2-13). The 1962–67
 * Mark 21 had a 50 A Delco-Remy generator and a load meter instead (OM p. 3; TCDS 2A3); the 1968 Ranger's Prestolite
 * alternator carries the loads from idle up. The engine's ignition is independent of all of this (OM p. 3 note).
 */
export function solve(s: Sim): Elec {
  const first = solveWith(s, true);
  const E = first.batFrac < 1 ? first : solveWith(s, false);
  altExcited = E.genOn;
  return E;
}

function solveWith(s: Sim, batCharge: boolean): Elec {
  const e = s.elec,
    cb = (n: string) => !s.cb[n];
  const batOk = e.master && !e.fail.bat && batCharge;
  const field = (batOk || altExcited) && cb("ALT FIELD");
  const genOn = s.eng.running && live.rpm >= 700 && !e.fail.gen && cb("ALT") && field && e.master;
  const bus = batOk || genOn;
  const pw = (name: string) => bus && cb(name);
  const sw = (k: keyof Sim["sw"], name: string) => pw(name) && s.sw[k];
  const fuelPump = sw("fuelPump", "FUEL PUMP"),
    pitotHeat = sw("pitotHeat", "PITOT HEAT") && s.pitot.heatInstalled;
  const beacon = sw("beacon", "BEACON"),
    nav = sw("nav", "NAV LTS"),
    landing = sw("landing", "LDG LT");
  const gaugesPwr = pw("INSTRUMENTS"),
    gearWarn = pw("GEAR WARN"),
    stallWarn = pw("STALL WARN"),
    turnBank = pw("TURN & BANK"),
    vacWarn = pw("VAC WARN");
  const instLts = pw("INST LTS"),
    radios = pw("RADIO MASTER") && e.radios,
    xpdr = radios && cb("XPDR");
  const starterPwr = bus && cb("IGN / VIBRATOR");
  const starterOn = starterPwr && (s.eng.key === "START" || (s.eng.fail.starterStuck && s.eng.running));
  const L = s.lights;
  let load = 0;
  const add = (on: boolean, a: number) => {
    if (on) load += a;
  };
  add(radios, LOAD.radios);
  add(xpdr, LOAD.xpdr);
  add(nav, LOAD.nav);
  add(beacon, LOAD.beacon);
  add(landing, LOAD.landing);
  add(pitotHeat, LOAD.pitot);
  add(fuelPump, LOAD.fuelPump);
  add(instLts && L.instr > 0, LOAD.inst * L.instr);
  add(turnBank, LOAD.turnBank);
  add(gaugesPwr, LOAD.gauges);
  add(starterOn, LOAD.vibrator);
  add(gearWarn, LOAD.gearLts);
  add(bus && L.spot > 0, LOAD.spot * L.spot);
  add(bus && L.cabin, LOAD.cabin);
  const onBattery = bus && !genOn;
  const batLoad = onBattery ? load : 0;
  const endurance = (BAT_AH / Math.max(batLoad, 1)) * 60;
  const batFrac = onBattery ? e.tBat / endurance : 0;
  const vBat = 12.6 - 1.8 * Math.min(batFrac, 1);
  const r = (v: number) => Math.round(v * 10) / 10;
  // ammeter in the battery line (Ranger 2-13): + charging after a start or a spell on the battery, − the loads when the alternator is off line
  const charge = genOn && batOk ? (e.tBat > 0 ? 8 : 2) : 0;
  const amps = genOn ? charge : onBattery ? -load : 0;
  return {
    bus: r(!bus ? 0 : genOn ? 14.0 : vBat),
    genOn,
    batOk,
    batDead: e.master && !e.fail.bat && !batCharge,
    batFrac: Math.min(batFrac, 1),
    amps: Math.round(amps),
    load: r(load),
    batLoad: r(batLoad),
    endurance: Math.round(endurance),
    starterPwr,
    starterOn,
    vibrator: starterOn,
    fuelPump,
    pitotHeat,
    beacon,
    nav,
    landing,
    gaugesPwr,
    gearWarn,
    stallWarn,
    turnBank,
    vacWarn,
    instLts,
    radios,
    xpdr,
  };
}

/* ---------- engine, propeller, fuel ---------- */

export const fuelAvail = (s: Sim) => s.fuel.sel !== "OFF" && (s.fuel.sel === "L" ? s.fuel.qL : s.fuel.qR) > 0.05;
/** Governor target RPM for the propeller control 0..1 (low-RPM stop not in the manual: ≈ 1,800 assumed). */
export const govRpmFor = (lever: number) => Math.round(1800 + 900 * lever);
export const govRpm = (s: Sim) => govRpmFor(s.eng.prop);
/** Blade angle at the 30 in station: 13° low pitch … 29° high (Ranger 1-4). Oil pressure raises pitch; lose it and the blades go fine. */
export function bladeAngle(s: Sim, rpm: number) {
  if (rpm < 300 || s.eng.fail.governor || live.oilP < 20) return 13;
  const fineRpm = 650 + s.eng.throttle * 2350 + (s.air ? live.fs.ias * 4 : 0);
  return Math.max(13, Math.min(29, 13 + (fineRpm - rpm) / 50));
}

/* ---------- vacuum, PC, step ---------- */

/** Regulated 4.5–5.0 in Hg (OM p. 10); red lights below 4.05 or above 5.20. */
export const VAC = { lo: 4.05, hi: 5.2, reg: 4.8 };
export const vacOk = (v: number) => v >= VAC.lo && v <= VAC.hi;
/** PC works whenever the pump turns fast enough — windmilling at about 1,000 RPM or above (OM p. 8). */
export const pcAvailable = (s: Sim) => !s.eng.fail.vacPump && live.rpm >= 1000 && live.vac >= 3.5;
export const pcEngaged = (s: Sim) => pcAvailable(s) && !s.pc.cutoff;

/* ---------- gear, flaps, stall ---------- */

export const gearDown = () => live.gearFrac < 0.02;
export const gearUp = () => live.gearFrac > 0.98;
/** Green light: handle engaged in the down socket; red: not sufficiently engaged in the down-lock (OM p. 6). */
export const gearLights = (s: Sim, E: Elec) => ({
  green: E.gearWarn && s.gear.lever === "DOWN" && gearDown(),
  red: E.gearWarn && !(s.gear.lever === "DOWN" && gearDown()),
});
/** Gear horn: throttle retarded with the gear not down and locked — about 10 in Hg manifold pressure (OM p. 27). */
export const gearHorn = (_s: Sim, E: Elec) => E.gearWarn && !gearDown() && live.map < 10 && live.rpm > 300;
export const FLAP_MAX = 33,
  FLAP_TO = 15,
  FLAP_STROKE = FLAP_MAX / 4.5;

/** Stall speeds, power off, 2,575 lb, IAS mph (OM Fig. 4): flaps up 67, 15° 64, 33° 57. */
export const stallMph = (flap: number) => (flap < 7 ? 67 : flap < 24 ? 64 : 57);
/** Stall horn: within 5–10 mph of the stall (OM p. 23), intermittent then steady. 0 = quiet … 1 = steady. */
export function hornLevel(s: Sim, E: Elec) {
  if (!E.stallWarn || s.stall.stuck) return 0;
  const vs = stallMph(live.flapAng);
  const ias = s.air ? Math.min(mph(live.fs.ias), s.stall.ias) : s.stall.ias;
  if (ias < 30) return 0;
  const m = ias - vs;
  return m > 10 ? 0 : Math.min(1, (10 - m) / 6);
}

/* ---------- lights ---------- */
let litFor: { s: Sim | null; E: Elec | null; r: { nav: boolean; beacon: boolean; landing: boolean } } = {
  s: null,
  E: null,
  r: { nav: false, beacon: false, landing: false },
};
export function extLit(s: Sim, E: Elec) {
  if (litFor.s === s && litFor.E === E) return litFor.r;
  void s;
  litFor = { s, E, r: { nav: E.nav, beacon: E.beacon, landing: E.landing } };
  return litFor.r;
}

/* ---------- warning lights and horns ---------- */
export type { CasLevel };
/**
 * What the 1967 panel can tell you: the two gear lights, the low/high vacuum lights on the artificial horizon, the gear horn
 * and the stall horn. All need the master switch (Ranger 4-9: "All warning devices are inoperative when the master switch is off").
 */
export function warnings(s: Sim, E: Elec): [CasLevel, string][] {
  const m: [CasLevel, string][] = [];
  void s;
  const g = gearLights(s, E);
  if (g.red) m.push(["w", "GEAR UNSAFE (red)"]);
  if (g.green) m.push(["a", "GEAR DOWN (green)"]);
  if (E.vacWarn && s.eng.running !== undefined) {
    if (live.vac < VAC.lo) m.push(["w", "LOW VACUUM"]);
    else if (live.vac > VAC.hi) m.push(["w", "HIGH VACUUM"]);
  }
  if (gearHorn(s, E)) m.push(["w", "GEAR WARNING HORN"]);
  const h = hornLevel(s, E);
  if (h > 0) m.push(["c", h > 0.9 ? "STALL HORN — STEADY" : "STALL HORN — INTERMITTENT"]);
  if (E.genOn === false && s.eng.running && E.bus > 0) m.push(["c", "AMMETER DISCHARGE"]);
  return m;
}
