/**
 * The governor, its propeller and the engine driving them, as pure functions of the spec and a mutable state.
 *
 * Flyweights on the governor's drive shaft lift the pilot valve with a force that grows with the square of speed; the
 * speeder spring, compressed by the propeller control, pushes it down. Where they balance is the set speed, and the
 * valve sits centred over the metering port: on speed. Faster, the flyweights tilt out and raise the valve
 * (overspeed); slower, the spring lowers it (underspeed). Off centre, the valve opens the port to the propeller line,
 * either to the gear pump's boosted oil or to drain (FAA-H-8083-32B pp. 7-9 to 7-11).
 *
 * Which way oil moves the blades depends on the hub. The SR20's Hartzell hub is driven to high pitch by oil, and the
 * blades' centrifugal twisting moment and a spring return them to low pitch when it drains (SR20 AMM 61-10 p. 1,
 * Figure 7-24); there the governor sends oil on an overspeed. A counterweighted hub works the other way, oil to low
 * pitch and counterweights to high, the arrangement the handbook describes (p. 7-11): oil goes on an underspeed. The
 * governor is the same; only its porting is matched to the hub.
 *
 * The engine is a torque source set by the throttle (the IO-390's rated torque at full throttle), the propeller the
 * one in engines/model/propeller.ts. See the spec for which numbers are published and which are model constants.
 */
import { propTorque } from "@/engines/model/propeller";
import type { GovernorSpec } from "./spec";

const HP_W = 745.7;
const KT = 0.514444;
const RHO = 1.225;

export type Hub = "high" | "low";

export interface Controls {
  /** Propeller control: 0 = low rpm (aft) … 1 = high rpm (forward). */
  lever: number;
  /** Throttle 0 (idle) … 1 (full). */
  throttle: number;
  /** True airspeed the airplane is heading for, knots (it gets there at `KT_PER_S`). */
  kt: number;
}

export interface Failures {
  /** No engine oil reaches the governor. */
  oilLoss: boolean;
  /** Governor gear pump worn: little flow. */
  wornPump: boolean;
  /** Pilot valve sticking in its bore. */
  stickyValve: boolean;
  /** Speeder spring broken. */
  brokenSpring: boolean;
  /** Relief valve stuck open. */
  reliefStuck: boolean;
}

export type Mode = "under" | "on" | "over";

export interface History {
  t: number[];
  rpm: number[];
  set: number[];
  beta: number[];
}

export interface GovState {
  t: number;
  /** Engine (and propeller) rpm. */
  rpm: number;
  /** True airspeed, knots. */
  kt: number;
  /** Pilot valve position from centre, mm: + up (overspeed), − down (underspeed). */
  x: number;
  /** Oil in the hub cylinder, as a fraction of the piston's stroke. */
  p: number;
  /** Blade angle at 75 % radius, degrees. */
  beta: number;
  setRpm: number;
  /** Forces on the pilot valve, N. */
  flyweightN: number;
  springN: number;
  /** Flyweight tilt for drawing, −1 (in) … 1 (out). */
  tilt: number;
  /** Engine oil pressure at the governor's inlet, the governor pump's output, the hub cylinder's, psi. */
  inletPsi: number;
  pumpPsi: number;
  hubPsi: number;
  /** The relief valve is open (pump oil returning to the inlet). */
  relief: boolean;
  /** Metering port opening, −1 (to drain) … 1 (to the pump), and the oil flow into the hub, strokes per second. */
  port: number;
  flow: number;
  mode: Mode;
  engineHp: number;
  /** Shaft angles for drawing, revolutions (wrapped). */
  crankRev: number;
  govRev: number;
  hist: History;
}

export const defaultControls = (): Controls => ({ lever: 1, throttle: 1, kt: 0 });

export const noFailures = (): Failures => ({
  oilLoss: false,
  wornPump: false,
  stickyValve: false,
  brokenSpring: false,
  reliefStuck: false,
});

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Governor set speed (engine rpm) for a propeller-control position. */
export const setRpm = (spec: GovernorSpec, lever: number) =>
  spec.propeller.governorMinRpm + clamp(lever, 0, 1) * (spec.engine.ratedRpm - spec.propeller.governorMinRpm);

/** Flyweight force on the pilot valve at an engine rpm, N (∝ governor speed²). */
export const flyweightForce = (spec: GovernorSpec, rpm: number) =>
  spec.model.flyweightN * (Math.max(rpm, 0) / spec.engine.ratedRpm) ** 2;

/** Speeder spring compression (mm) with the valve centred, for a propeller-control position. */
export const springSet = (spec: GovernorSpec, lever: number) =>
  flyweightForce(spec, setRpm(spec, lever)) / spec.model.springRate;

/** Blade angle for a hub fill. */
export function bladeAngle(spec: GovernorSpec, hub: Hub, p: number) {
  const { fineDeg, coarseDeg } = spec.propeller;
  return hub === "high" ? fineDeg + p * (coarseDeg - fineDeg) : coarseDeg - p * (coarseDeg - fineDeg);
}

/** Hub fill for a blade angle. */
export function fillFor(spec: GovernorSpec, hub: Hub, beta: number) {
  const { fineDeg, coarseDeg } = spec.propeller;
  const f = (beta - fineDeg) / (coarseDeg - fineDeg);
  return clamp(hub === "high" ? f : 1 - f, 0, 1);
}

/** Pressure (psi) the blades' return force puts on the oil in the hub. */
export function returnPsi(spec: GovernorSpec, hub: Hub, rpm: number) {
  const m = spec.model;
  return m.returnPsi * (Math.max(rpm, 0) / spec.engine.ratedRpm) ** 2 + (hub === "high" ? m.springPsi : 0);
}

/** Rated torque, N·m. */
const ratedTorque = (spec: GovernorSpec) => (spec.engine.ratedHp * HP_W) / ((spec.engine.ratedRpm * 2 * Math.PI) / 60);

/**
 * Engine torque (N·m): idle to rated torque with the throttle, falling away above rated rpm. A simplification: the
 * IO-390 simulation (engines/) models the engine itself.
 */
export function engineTorque(spec: GovernorSpec, throttle: number, rpm: number) {
  const over = Math.max(0, rpm - spec.engine.ratedRpm) / 1500;
  return (0.06 + 0.94 * clamp(throttle, 0, 1)) * ratedTorque(spec) * Math.max(0, 1 - over * over);
}

export const propDiameter = (spec: GovernorSpec) => (spec.propeller.diameterIn * 2.54) / 100;

export function initialState(spec: GovernorSpec, hub: Hub = "high", c: Controls = defaultControls()): GovState {
  const set = setRpm(spec, c.lever);
  return {
    t: 0,
    rpm: set,
    kt: c.kt,
    x: 0,
    p: fillFor(spec, hub, spec.propeller.fineDeg + 4),
    beta: spec.propeller.fineDeg + 4,
    setRpm: set,
    flyweightN: flyweightForce(spec, set),
    springN: flyweightForce(spec, set),
    tilt: 0,
    inletPsi: 0,
    pumpPsi: 0,
    hubPsi: 0,
    relief: false,
    port: 0,
    flow: 0,
    mode: "on",
    engineHp: 0,
    crankRev: 0,
    govRev: 0,
    hist: { t: [], rpm: [], set: [], beta: [] },
  };
}

/** How fast the airspeed changes, knots per second: an airplane gains or loses speed gradually. */
export const KT_PER_S = 6;

/** Port opening (fraction) still counted as on speed. */
const ON_SPEED = 0.1;

/** Seconds of history kept for the chart, and how often it is sampled. */
export const HIST_S = 30;
const HIST_DT = 0.1;

/** Advance the state by dt seconds (split into short steps). */
export function step(spec: GovernorSpec, s: GovState, c: Controls, hub: Hub, f: Failures, dt: number) {
  // a repeated frame time passes no time; a zero step would divide by it
  if (!(dt > 0)) return;
  const n = Math.max(1, Math.ceil(dt / 0.002));
  for (let i = 0; i < n; i++) substep(spec, s, c, hub, f, dt / n);
}

function substep(spec: GovernorSpec, s: GovState, c: Controls, hub: Hub, f: Failures, dt: number) {
  const m = spec.model;
  s.t += dt;

  // ---- flyweights against the speeder spring move the pilot valve
  s.setRpm = setRpm(spec, c.lever);
  const comp = springSet(spec, c.lever);
  s.flyweightN = flyweightForce(spec, s.rpm);
  // a broken spring leaves nothing to hold the flyweights in: they lift the valve to its stop
  const xEq = f.brokenSpring ? m.valveTravel : clamp(s.flyweightN / m.springRate - comp, -m.valveTravel, m.valveTravel);
  if (f.stickyValve) {
    // it holds until the imbalance overcomes the sticking, then breaks free and jumps
    if (Math.abs(xEq - s.x) > m.stickMm) s.x = xEq;
  } else s.x += (xEq - s.x) * Math.min(1, dt / m.valveTau);
  s.springN = f.brokenSpring ? 0 : m.springRate * (comp + s.x);
  s.tilt = clamp(s.x / m.valveTravel, -1, 1);

  // ---- metering port: + to the pump's oil, − to drain. Overspeed sends oil to a hub that oil drives to high pitch.
  const open = Math.sign(s.x) * clamp((Math.abs(s.x) - m.lap) / m.portOpen, 0, 1);
  // on speed the valve sits just off centre, metering the trickle that makes up the hub's leakage
  s.mode = open > ON_SPEED ? "over" : open < -ON_SPEED ? "under" : "on";
  s.port = hub === "high" ? open : -open;

  // ---- engine oil in, the governor's gear pump, its relief valve
  s.inletPsi = f.oilLoss ? 0 : spec.engine.oilPsi.max * clamp(s.rpm / 2200, 0, 1) ** 0.7;
  const feed = clamp(s.inletPsi / 15, 0, 1);
  const govRpm = s.rpm * spec.engine.driveRatio;
  const pumpQ = ((m.pumpStrokesPerRev * govRpm) / 60) * feed * (f.wornPump ? m.wornPump : 1);
  const maxPsi = feed > 0 ? Math.max(s.inletPsi, f.reliefStuck ? m.stuckReliefPsi : spec.handbook.reliefPsi.value) : 0;

  const ret = returnPsi(spec, hub, s.rpm);
  const hubPsi = s.p > 0 ? ret : 0;
  const leak = s.p > 0 ? m.leakStrokesPerS * Math.sqrt(hubPsi / 100) : 0;
  // the piston takes what fills it to its stop plus what leaks: on the stop, only the leakage
  const room = (1 - s.p) / dt + leak;
  let qIn = 0,
    qOut = 0;
  s.pumpPsi = maxPsi;
  s.relief = pumpQ > 0;
  if (s.port > 0 && maxPsi < ret) {
    // the pump can't raise the pressure the blades put on the oil: it runs back out through the open port
    qOut = s.port * m.portStrokesPerS * Math.sqrt((ret - maxPsi) / 100);
  } else if (s.port > 0) {
    // the port passes what the pressure across it allows, up to everything the pump delivers
    const portQ = s.port * m.portStrokesPerS * Math.sqrt(Math.max(0, maxPsi - ret) / 100);
    qIn = Math.min(pumpQ, portQ, room);
    if (qIn >= pumpQ) {
      // all the pump's oil goes to the hub: the relief valve closes and pressure falls to what the port needs
      s.relief = false;
      s.pumpPsi = pumpQ > 0 ? ret + 100 * (pumpQ / (s.port * m.portStrokesPerS)) ** 2 : 0;
    }
  } else if (s.port < 0) qOut = -s.port * m.portStrokesPerS * Math.sqrt(ret / 100);
  const before = s.p;
  s.p = clamp(s.p + (qIn - qOut - leak) * dt, 0, 1);
  s.flow = (s.p - before) / dt;
  // a piston held on its stop with the port open sees the pump's pressure behind it
  s.hubPsi = s.p > 0 ? (qIn > 0 ? (qIn >= room ? s.pumpPsi : Math.min(s.pumpPsi, ret + 5)) : ret) : 0;
  s.beta = bladeAngle(spec, hub, s.p);

  // ---- engine and propeller
  const qE = engineTorque(spec, c.throttle, s.rpm);
  s.kt += clamp(c.kt - s.kt, -KT_PER_S * dt, KT_PER_S * dt);
  const qP = propTorque(s.beta, s.kt * KT, s.rpm, propDiameter(spec), RHO);
  s.rpm = Math.max(0, s.rpm + (((qE - qP) / spec.propeller.inertia) * dt * 60) / (2 * Math.PI));
  s.engineHp = (qE * s.rpm * 2 * Math.PI) / 60 / HP_W;
  s.crankRev = (s.crankRev + (s.rpm / 60) * dt) % 1;
  s.govRev = (s.govRev + (govRpm / 60) * dt) % 1;

  // ---- history for the chart
  const h = s.hist;
  if (!h.t.length || s.t - h.t[h.t.length - 1] >= HIST_DT) {
    h.t.push(s.t);
    h.rpm.push(s.rpm);
    h.set.push(s.setRpm);
    h.beta.push(s.beta);
    while (h.t.length && s.t - h.t[0] > HIST_S) {
      h.t.shift();
      h.rpm.shift();
      h.set.shift();
      h.beta.shift();
    }
  }
}

/** Run for `seconds` (tests and set-ups). */
export function run(spec: GovernorSpec, s: GovState, c: Controls, hub: Hub, f: Failures, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) step(spec, s, c, hub, f, 0.05);
  return s;
}
