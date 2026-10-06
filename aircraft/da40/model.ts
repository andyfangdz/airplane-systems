/**
 * DA40 XLS simulation model: discrete state, the pure electrical solver, engine/fuel helpers and the
 * G1000 annunciations. Sources: DA 40 AFM Doc. 6.01.01-E Rev. 8 (§7), Garmin AFMS 190-00492-10
 * (G1000 + GFC 700, DA 40) §2.5–2.6 and §3, AMM-E 190-00545-01 Fig. 2-3 (GFC 700 power distribution),
 * G1000 SMM 190-00303-03 Fig. 2-1 (breaker panel) and the Garmin GFC 700 electrical load analysis.
 */
import { initFlight, type FlightCfg, type FlightState } from "@/lib/avionics/flight";
import { GFC700_BASE, gfc700Init, type Gfc700Cfg, type Gfc700Fail } from "@/lib/avionics/gfc700";
import type { CasLevel } from "../types";

/** Ignition key, in AFM order OFF – L – R – BOTH – START (AFM 7.9.1). */
export type Key = "OFF" | "L" | "R" | "BOTH" | "START";
export type FuelSel = "L" | "R" | "OFF";
/** Front canopy: closed and locked, latched in the "cooling gap" position (ground only), or open. */
export type CanopyPos = "CLOSED" | "GAP" | "OPEN";
/** Flap selector: 0 = UP (cruise), 1 = T/O, 2 = LDG. */
export type FlapSel = 0 | 1 | 2;

export interface Sim {
  /** On the ground (ramp) or airborne — drives the flight-state integrator and ram-air effects. */
  air: boolean;
  eng: {
    running: boolean; key: Key;
    /** Throttle, RPM lever and mixture 0..1 (IDLE/LOW RPM/LEAN … MAX PWR/HIGH RPM/RICH). */
    throttle: number; rpmLever: number; mix: number;
    altAir: boolean;
    /** fuelHi: the engine-driven pump's pressure regulation fails high (illustrative — the AFM has no FUEL PRES HI procedure). */
    fail: { governor: boolean; oilLeak: boolean; mechPump: boolean; starterStuck: boolean; fuelHi: boolean };
  };
  elec: {
    /** Split master: BAT and ALT halves; AVIONIC MASTER; ESS. BUS; HORIZON EMERGENCY; external power plugged in. */
    bat: boolean; alt: boolean; avMaster: boolean; essBus: boolean; emerg: boolean; ext: boolean;
    fail: { alt: boolean; bat: boolean };
    /** Minutes the airplane has been running on battery power (slider). */
    tBat: number;
  };
  /** Pulled circuit breakers, keyed by label. */
  cb: Record<string, boolean>;
  fuel: { sel: FuelSel; pump: boolean; qL: number; qR: number };
  flaps: { cmd: FlapSel };
  /** Pilot stick and pedals −1..1 (pitch + = aft/nose up, roll + = right, yaw + = right pedal). */
  ctrl: { pitch: number; roll: number; yaw: number };
  /** Toe brakes −1 (left) … +1 (right) and the parking brake lever (down = set). */
  gear: { diff: number; park: boolean };
  /** Cabin heat lever 0 (OFF) … 1 (ON); air distribution 0 (floor ▼) … 1 (canopy ▲); left canopy window open. */
  env: { heat: number; dist: number; window: boolean };
  pitot: { heat: boolean; oat: number; heaterFail: boolean; altStatic: boolean };
  /** Stall-warning demo: indicated airspeed and a blocked orifice. */
  stall: { ias: number; blocked: boolean };
  lights: { landing: boolean; taxi: boolean; position: boolean; strobe: boolean; instr: number; flood: number };
  doors: { canopy: CanopyPos; rear: boolean };
  /** DISPLAY BACKUP button OUT (reversionary), display and sensor failures. */
  avx: { backup: boolean; pfdFail: boolean; mfdFail: boolean; ahrsFail: boolean; adcFail: boolean };
}

export const initialSim: Sim = {
  air: true,
  eng: { running: true, key: "BOTH", throttle: 0.72, rpmLever: 0.667, mix: 0.82, altAir: false, fail: { governor: false, oilLeak: false, mechPump: false, starterStuck: false, fuelHi: false } },
  elec: { bat: true, alt: true, avMaster: true, essBus: false, emerg: false, ext: false, fail: { alt: false, bat: false }, tBat: 0 },
  cb: {},
  fuel: { sel: "L", pump: false, qL: 21, qR: 20 },
  flaps: { cmd: 0 },
  ctrl: { pitch: 0, roll: 0, yaw: 0 },
  gear: { diff: 0, park: false },
  env: { heat: 0.4, dist: 0.3, window: false },
  pitot: { heat: true, oat: 6, heaterFail: false, altStatic: false },
  stall: { ias: 90, blocked: false },
  lights: { landing: false, taxi: false, position: true, strobe: true, instr: 0, flood: 0 },
  doors: { canopy: "CLOSED", rear: true },
  avx: { backup: false, pfdFail: false, mfdFail: false, ahrsFail: false, adcFail: false },
};

/** Flight-state model tuned for the DA40: ~120 KIAS at 73 % power, ~145 at full power, Vy climb ≈ 900 fpm. */
export const DA40_FLIGHT: FlightCfg = { v0: 52, vp: 93, fpmPerKt: 12, vMin: 50, maxBank: 30, rollRate: 8, tauVs: 1.6, tauIas: 7 };

/**
 * GFC 700 configuration (G1000/GFC 700 AFMS 190-00492-10): mode keys on the MFD bezel only and no BC key — NAV on a localizer
 * annunciates LOC until the course pointer is at least 105° from the heading, then BC (AFMS p. 51 back-course note; CRG
 * 190-00324-07 p. 6-19 agrees). The stand-alone GFC 700 AFMS 190-00492-00 in the same AFM gives 115° for the same note; the
 * model follows the G1000/GFC 700 AFMS used throughout. No yaw damper; AP DISC, CWS and AP TRIM on the stick, GA on the
 * throttle; engage 70–165 KIAS (AFMS p. 16), MAXSPD above 165. FLC solves with the DA40 flight model.
 */
export const AFCS_CFG: Gfc700Cfg = { ...GFC700_BASE, bcKey: false, bcAngle: 105, vmo: 165, flight: DA40_FLIGHT };
/** Elevator trim (−1 nose down … +1 nose up) that holds ~119 KIAS level with the stick centred (tick.ts TRIM_PITCH). */
export const CRUISE_TRIM = 0.27;

export const cruiseFlight = (): FlightState => initFlight({ hdg: 40, hdgBug: 40, crs: 40, alt: 4500, selAlt: 4500, ias: 119, power: 0.72, oat: 6, baro: 30.02 });
/** On the ramp: wings and fuselage about level on the wheels (the integrator does not move pitch on the ground). */
export const groundFlight = (): FlightState => initFlight({ hdg: 10, hdgBug: 10, crs: 10, alt: 190, selAlt: 3000, ias: 0, power: 0, vs: 0, pitch: 0, oat: 6, onGround: true, baro: 30.02 });

/** Fast-changing values advanced every frame (kept out of React state). */
export const live = {
  rpm: 2400, map: 23.5, ff: 9.4, fuelP: 27, oilP: 78, oilT: 188, cht: 345, egt: 1360,
  /** Flap angle (deg, 0 … 42). The elevator trim position lives in `afcs.trim` (wheel, MET and autotrim share it). */
  flapAng: 0,
  /** Key START hold time left, cranking time (s), starvation timer, priming (s of pump+RICH), time since the engine fired (−1 = settled). */
  startTimer: 0, crankT: 0, starve: 0, prime: 0, fireT: -1,
  /** Oil lost (0..1) with the oil-leak failure; trim wheel rate (for the Bowden-cable particles). */
  oilLoss: 0, trimRate: 0,
  /** Fuel gauge pointers (long-range tanks: full reads 24, holds 16 while the ungauged 3 gal is used). */
  gaugeL: 21, gaugeR: 20,
  /** Effective control positions shown on the sticks and surfaces (pilot or autopilot servos). */
  eff: { pitch: 0, roll: 0, yaw: 0 },
  fs: cruiseFlight(),
  afcs: { ...gfc700Init(), trim: CRUISE_TRIM },
  /** Failures injected from the Autopilot panel (merged with failures derived from lost LRUs each tick). */
  afcsUser: {} as Gfc700Fail,
  /** Last AFCS failure set applied (so it is only re-applied on change). */
  afcsDerived: "",
};

/* ---------- electrical ---------- */

export type BusId = "ess" | "main" | "av";

export interface Elec extends Record<BusId, number> {
  /** Relay-box bus bar live (battery relay closed or external power), battery state, alternator. */
  bar: boolean; batOk: boolean; batDead: boolean; altOn: boolean; altFeed: boolean; tieClosed: boolean; mstr: boolean;
  /** Battery (or external power) reaches ESSENTIAL through BATT 70 A; both tie breakers (ESS TIE, MAIN TIE) are in. */
  essBat: boolean; tieCb: boolean;
  /** The alternator feeds ESSENTIAL (through the tie relay or the bypass diode). */
  essAlt: boolean;
  batCharging: boolean; batFrac: number; volts: number; amps: number; load: number; endurance: number;
  /** Current drawn from the battery (A); 0 while the alternator or external power carries the buses. */
  batLoad: number;
  emergDead: boolean;
  pfd: boolean; mfd: boolean; ahrs: boolean; adc: boolean; gia1: boolean; gia2: boolean; com1: boolean; com2: boolean;
  xpdr: boolean; audio: boolean; gea: boolean; gdl: boolean; adf: boolean; dme: boolean;
  stbyAtt: boolean; floodPwr: boolean; pitotPwr: boolean; flapsPwr: boolean; landPwr: boolean; taxiPwr: boolean;
  posPwr: boolean; strobePwr: boolean; instPwr: boolean; pumpPwr: boolean; cduFan: boolean; avFan: boolean;
  afcsPwr: boolean; starterPwr: boolean; starterOn: boolean;
}

/** Typical loads (A) from the Garmin GFC 700 / DA40 electrical load analysis (duty-cycle averaged). */
const LOAD = {
  pfd: 2.5, mfd: 2.5, gia1: 2.33, gia2: 2.33, ahrs: 0.3, adc: 0.6, gea: 1.02, xpdr: 1.4, audio: 1.75, stby: 0.55,
  servos: 1.5, gdl: 0.35, adf: 1.1, dme: 0.54, relays: 0.7, strobe: 3.4, position: 3.4, landing: 1.2, taxi: 1.2,
  inst: 1.19, flood: 0.5, pitot: 5.8, pump: 2.2, flaps: 3.0, fans: 0.64, field: 2.6,
};
/** Battery: 11 Ah lead-acid, 70 % available = 7.7 Ah (ELA). Emergency pack: 1 h 30 min (AFM 7.11). */
const BAT_AH = 7.7, EMERG_MIN = 90;

/**
 * Alternator excitation memory: the field is fed from MAIN (MAIN → ALT CONT → ALT switch → regulator), so a stopped
 * or switched-off alternator can only come online while MAIN is live from the battery; once online it keeps its own
 * field alive through MAIN. Updated after every solve (the store solves on every state change).
 */
let altExcited = true;

/**
 * Electrical solver (AMM-E Fig. 2-3, GFC 700 configuration).
 * Battery → battery relay (BAT switch) → BATT 70 A → ESSENTIAL. Alternator → ALT 70 A → MAIN.
 * ESSENTIAL ↔ ESS TIE 25 A ↔ tie relay (opened by ESS. BUS ON) ‖ bypass diode (MAIN → ESS only) ↔ MAIN TIE 25 A ↔ MAIN.
 * MAIN → AV BUSS 25 A → avionics master relay → MAIN AVIONICS. Both relay coils are fed through MSTR CNTRL 2 A on ESSENTIAL.
 * Sources disagree on one case: with BATT and ESS TIE pulled (AFMS smoke procedure) ESSENTIAL is dead, so by the schematic the
 * relay coils lose power, but the approved AFMS (p. 30) says this "restores power to the main and avionics busses". The model
 * follows the AFMS: the avionics relay needs the AVIONIC MASTER switch and the MSTR CNTRL breaker, not a live ESSENTIAL bus.
 * HORIZON 3 A (ESSENTIAL) or the emergency battery (HORIZON EMERGENCY switch) feeds the standby attitude and the flood light.
 */
export function solveElec(s: Sim): Elec {
  const first = solveWith(s, true);
  const E = first.batFrac < 1 ? first : solveWith(s, false);
  altExcited = E.altOn;
  return E;
}

function solveWith(s: Sim, batCharge: boolean): Elec {
  const e = s.elec, cb = (n: string) => !s.cb[n];
  const batOk = e.bat && !e.fail.bat && batCharge;
  const bar = batOk || e.ext;
  const essBat = bar && cb("BATT");
  const tie = cb("ESS TIE") && cb("MAIN TIE");
  const mstrCb = cb("MSTR CNTRL");
  // MAIN from the battery alone (tie relay closed unless ESS BUS ON has power to open it)
  const mainBat = essBat && tie && !(e.essBus && mstrCb);
  // field supply: MAIN live from the battery, or the alternator already online and feeding MAIN (self-excited)
  const field = mainBat || (altExcited && cb("ALT"));
  const altOn = s.eng.running && e.alt && !e.fail.alt && cb("ALT CONT") && cb("ALT PROT") && field;
  const altFeed = altOn && cb("ALT");
  const essAlt = altFeed && tie; // through the tie relay or the bypass diode
  const essOn = essBat || essAlt;
  const mstr = essOn && mstrCb;
  const tieClosed = !(e.essBus && mstr);
  const mainOn = altFeed || (essBat && tie && tieClosed);
  const mainFromBat = mainOn && !altFeed;
  // avionics relay coil: MSTR CNTRL on ESSENTIAL (AMM-E); the AFMS outcome with ESSENTIAL dead is kept (see above)
  const avOn = mainOn && cb("AV BUSS") && e.avMaster && mstrCb;
  const pw = (bus: boolean, name: string) => bus && cb(name);

  // loads
  const pfd = pw(essOn, "PFD") && !s.avx.pfdFail, mfd = pw(mainOn, "MFD") && !s.avx.mfdFail;
  const ahrs = pw(essOn, "AHRS") && !s.avx.ahrsFail, adc = pw(essOn, "ADC") && !s.avx.adcFail;
  const gia1 = pw(essOn, "GPS/NAV 1"), com1 = pw(essOn, "COM 1"), gia2 = pw(avOn, "GPS/NAV 2"), com2 = pw(avOn, "COM 2");
  const xpdr = pw(essOn, "XPDR"), audio = pw(essOn, "AUDIO"), gea = pw(essOn, "ENG INST");
  const gdl = pw(avOn, "GDL 69"), adf = pw(avOn, "ADF"), dme = pw(avOn, "DME"), afcsPwr = pw(avOn, "AFCS");
  const horizonNormal = pw(essOn, "HORIZON");
  const pitotPwr = pw(essOn, "PITOT"), flapsPwr = pw(essOn, "FLAPS"), landPwr = pw(essOn, "LANDING");
  const taxiPwr = pw(mainOn, "TAXI/MAP"), posPwr = pw(mainOn, "POSITION"), strobePwr = pw(mainOn, "STROBE"), instPwr = pw(mainOn, "INST");
  const pumpPwr = pw(mainOn, "FUEL PUMP"), cduFan = pw(mainOn, "CDU FAN"), avFan = pw(mainOn, "AV FAN");
  const L = s.lights;
  // per-bus loads (A): ESSENTIAL, MAIN (incl. the alternator field), MAIN AVIONICS
  const ld = { ess: essOn ? LOAD.relays : 0, main: 0, av: 0 };
  const add = (bus: BusId, on: boolean, a: number) => { if (on) ld[bus] += a; };
  add("ess", pfd, LOAD.pfd); add("main", mfd, LOAD.mfd); add("ess", gia1, LOAD.gia1); add("av", gia2, LOAD.gia2); add("ess", ahrs, LOAD.ahrs); add("ess", adc, LOAD.adc);
  add("ess", gea, LOAD.gea); add("ess", xpdr, LOAD.xpdr); add("ess", audio, LOAD.audio); add("ess", horizonNormal && !e.emerg, LOAD.stby);
  add("av", afcsPwr, LOAD.servos); add("av", gdl, LOAD.gdl); add("av", adf, LOAD.adf); add("av", dme, LOAD.dme);
  add("main", strobePwr && L.strobe, LOAD.strobe); add("main", posPwr && L.position, LOAD.position); add("ess", landPwr && L.landing, LOAD.landing);
  add("main", taxiPwr && L.taxi, LOAD.taxi); add("main", instPwr && L.instr > 0, LOAD.inst * L.instr); add("ess", pw(essOn, "FLOOD") && L.flood > 0 && !e.emerg, LOAD.flood * L.flood);
  add("ess", pitotPwr && s.pitot.heat && !s.pitot.heaterFail, LOAD.pitot); add("main", pumpPwr && s.fuel.pump, LOAD.pump);
  add("main", cduFan, LOAD.fans / 2); add("main", avFan, LOAD.fans / 2); add("main", altOn, LOAD.field);
  const load = ld.ess + ld.main + ld.av;

  // battery state while it carries ESSENTIAL (and MAIN through the closed tie) without the alternator or external power
  const onBattery = essBat && !essAlt && !e.ext;
  const batLoad = onBattery ? ld.ess + (mainFromBat ? ld.main + ld.av : 0) : 0;
  const endurance = (BAT_AH / Math.max(batLoad, 1)) * 60;
  const batFrac = onBattery ? e.tBat / endurance : 0;
  const vBat = 24.8 - 2.6 * Math.min(batFrac, 1);
  const vAlt = 28.0;
  const r = (v: number) => Math.round(v * 10) / 10;
  const ess = !essOn ? 0 : essAlt ? (tieClosed ? vAlt : vAlt - 0.7) : e.ext ? 28.0 : vBat;
  const main = !mainOn ? 0 : altFeed ? vAlt : ess;
  const av = avOn ? main : 0;
  const batCharging = batOk && cb("BATT") && (essAlt || e.ext);
  // AMPS: alternator output current (sensor on the ALT breaker cable) = the loads it carries + battery recharge
  const altLoad = altFeed ? ld.main + ld.av + (essAlt ? ld.ess : 0) : 0;
  const amps = altFeed ? altLoad + (batCharging && essAlt ? (e.tBat > 0 ? 6 : 1.5) : 0) : 0;

  // starter: START 5 A (ESSENTIAL) → key START contact → START relay → starter fed straight from the relay-box bus bar
  const starterPwr = bar && essOn && cb("START");
  const starterOn = starterPwr && (s.eng.key === "START" || (s.eng.fail.starterStuck && s.eng.running));

  const emergDead = e.tBat > EMERG_MIN;
  return {
    ess: r(ess), main: r(main), av: r(av),
    bar, batOk, batDead: e.bat && !e.fail.bat && !batCharge, altOn, altFeed, tieClosed, mstr, essBat, tieCb: tie, essAlt,
    batCharging, batFrac: Math.min(batFrac, 1), volts: r(ess), amps: Math.round(amps), load: r(load), endurance: Math.round(endurance), batLoad: r(batLoad),
    emergDead,
    pfd, mfd, ahrs, adc, gia1, gia2, com1, com2, xpdr, audio, gea, gdl, adf, dme,
    stbyAtt: e.emerg ? !emergDead : horizonNormal,
    floodPwr: e.emerg ? !emergDead : pw(essOn, "FLOOD"),
    pitotPwr, flapsPwr, landPwr, taxiPwr, posPwr, strobePwr, instPwr, pumpPwr, cduFan, avFan,
    afcsPwr, starterPwr, starterOn,
  };
}

/* ---------- engine & fuel helpers ---------- */

/** Fuel available at the engine from the selected tank. */
export const fuelAvail = (s: Sim) => s.fuel.sel !== "OFF" && (s.fuel.sel === "L" ? s.fuel.qL : s.fuel.qR) > 0.05;
/** Governor target RPM for a blue RPM lever position 0..1 (low-RPM stop not in the AFM: assumed 1,800). */
export const govRpmFor = (lever: number) => Math.round(1800 + 900 * lever);
export const govRpm = (s: Sim) => govRpmFor(s.eng.rpmLever);
/** Blade angle at 0.75 R (MTV-12-B/183-59b: 11.0° fine … 30.0° coarse), from how hard the governor is working. */
export function bladeAngle(s: Sim, rpm: number) {
  if (rpm < 300 || s.eng.fail.governor || live.oilP < 15) return 11;
  const fineRpm = 650 + s.eng.throttle * 2350 + (s.air ? live.fs.ias * 4 : 0);
  return Math.max(11, Math.min(30, 11 + (fineRpm - rpm) / 45));
}

/** Long-range tank gauge target (GFC 700 AFMS §7.10): full reads 24; between 19 and 16 gal it sits at 16 (ungauged fuel). */
export const gaugeTarget = (q: number) => (q > 19 ? Math.min(q, 24) : q >= 16 ? 16 : q);

/** Stall speeds (KIAS, 0° bank) at 1,200 kg / 2,646 lb (AFM 5.3.4, p. 5-8): UP 53, T/O 52, LDG 52. */
export const STALL_KIAS: Record<FlapSel, number> = { 0: 53, 1: 52, 2: 52 };
/** Stall horn (AFM 7.13): pneumatic, sounds from about 10 kt down to at least 5 kt above the stall. 0 = quiet … 1 = loud. */
export function hornLevel(s: Sim) {
  if (s.stall.blocked) return 0;
  const vs = STALL_KIAS[s.flaps.cmd];
  const ias = s.air ? Math.min(live.fs.ias, s.stall.ias) : s.stall.ias;
  if (ias < 30) return 0; // no airflow, no suction at the orifice
  const m = ias - vs;
  return m > 10 ? 0 : Math.min(1, (10 - m) / 5);
}

/* ---------- lights ---------- */
let litFor: { s: Sim | null; E: Elec | null; r: { land: boolean; taxi: boolean; pos: boolean; strobe: boolean } } = { s: null, E: null, r: { land: false, taxi: false, pos: false, strobe: false } };
/** Exterior lights lit (switch on and powered). Cached per store state: the scene asks for it many times per frame. */
export function extLit(s: Sim, E: Elec) {
  if (litFor.s === s && litFor.E === E) return litFor.r;
  const L = s.lights;
  litFor = { s, E, r: { land: L.landing && E.landPwr, taxi: L.taxi && E.taxiPwr, pos: L.position && E.posPwr, strobe: L.strobe && E.strobePwr } };
  return litFor.r;
}

/* ---------- G1000 annunciations (AFMS 190-00492-10 §2.6, CRG 190-00324-07 §12) ---------- */

export type { CasLevel };
/**
 * Annunciation window text, exactly as listed for the DA 40. Engine, fuel, door, starter and pitot-heat
 * sensing comes through the GEA 71 (ENG INST breaker) and a GIA to the displays.
 */
export function annunciations(s: Sim, E: Elec): [CasLevel, string][] {
  const m: [CasLevel, string][] = [];
  const sensed = E.gea && (E.gia1 || E.gia2);
  if (sensed) {
    if (live.oilP < 25) m.push(["w", "OIL PRES LO"]);
    if (live.fuelP < 14) m.push(["w", "FUEL PRES LO"]);
    if (live.fuelP > 35) m.push(["w", "FUEL PRES HI"]);
    if (s.eng.running && !E.altFeed) m.push(["w", "ALTERNATOR"]);
    if (E.starterOn) m.push(["w", "STARTER ENGD"]);
    if (s.doors.canopy !== "CLOSED" || !s.doors.rear) m.push(["w", "DOOR OPEN"]);
    if (!s.pitot.heat) m.push(["c", "PITOT OFF"]);
    else if (!E.pitotPwr || s.pitot.heaterFail) m.push(["c", "PITOT FAIL"]);
    if (s.fuel.qL < 3) m.push(["c", "L FUEL LOW"]);
    if (s.fuel.qR < 3) m.push(["c", "R FUEL LOW"]);
    if (E.volts < 24) m.push(["c", "LOW VOLTS"]);
  }
  if (E.pfd && !E.cduFan) m.push(["a", "PFD FAN FAIL"]);
  if (E.mfd && !E.cduFan) m.push(["a", "MFD FAN FAIL"]);
  if ((E.gia1 || E.gia2) && !E.avFan) m.push(["a", "GIA FAN FAIL"]);
  return m;
}

/** Display state: which screens are lit and whether they show the composite (reversionary) format. */
export function displays(s: Sim, E: Elec) {
  const pfd = E.pfd, mfd = E.mfd;
  return { pfd, mfd, pfdRev: pfd && (s.avx.backup || !mfd), mfdRev: mfd && (s.avx.backup || !pfd) };
}

/**
 * Circuit-breaker panel (SMM Fig. 2-1, right of the MFD), grouped by bus as in the GFC 700 distribution
 * schematic: [bus, label, source, breakers in panel order]. AFCS sits in the KAP 140 "AP" position and AUDIO is
 * re-bussed to ESSENTIAL for the GFC 700 (ELA). AP WARN, YAW GYRO and WX500 are KAP 140 / Stormscope positions.
 */
export const BUSES: [BusId, string, string, [string, number?][]][] = [
  ["ess", "ESSENTIAL BUS", "Battery via BATT 70 A · alternator via tie relay or bypass diode", [
    ["HORIZON", 3], ["ADC", 5], ["AHRS", 5], ["PFD", 5], ["PITOT", 10], ["FLAPS", 5], ["AP WARN", 2],
    ["COM 1", 5], ["GPS/NAV 1", 5], ["XPDR", 5], ["LANDING", 5], ["FLOOD", 5],
    ["BATT", 70], ["ESS TIE", 25], ["MSTR CNTRL", 2], ["ENG INST", 5], ["START", 5], ["AUDIO", 5],
  ]],
  ["main", "MAIN BUS", "Alternator via ALT 70 A · battery via ESS TIE → tie relay → MAIN TIE", [
    ["MAIN TIE", 25], ["MFD", 5], ["CDU FAN", 3], ["FUEL PUMP", 5],
    ["ALT", 70], ["ALT CONT", 5], ["ALT PROT", 5], ["INST", 3], ["STROBE", 5], ["POSITION", 5], ["TAXI/MAP", 5], ["AV FAN", 3], ["AV BUSS", 25],
  ]],
  ["av", "MAIN AVIONICS BUS", "MAIN via AV BUSS 25 A + avionics master relay", [
    ["COM 2", 5], ["GPS/NAV 2", 5], ["AFCS", 5], ["YAW GYRO", 3], ["GDL 69", 5], ["WX500", 3], ["ADF", 2], ["DME", 3],
  ]],
];
/** Breakers whose positions exist on the panel drawing but carry no load on a GFC 700 airplane (inference). */
export const SPARE_CB = ["AP WARN", "YAW GYRO", "WX500"];
