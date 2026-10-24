/** Driven cylinder bench and cutaway kinematics. Dimensions and assumptions: SOURCES.md. */
import { egtOffset, headHeat, mixturePower, stability } from "../../model/mixture";
import { createSimulationClock } from "@/lib/simulationClock";
import { IO390 } from "../../io390/spec";
import { IN_M } from "../../model/atmosphere";
import { mod, pistonDistance, stroke, valveLift, volume } from "../../model/cycle";

export const geometry = IO390.geometry;
export const radius = (geometry.strokeIn * IN_M) / 2;
export const rodLength = geometry.rodIn * IN_M;
export const bore = geometry.boreIn * IN_M;
export const top = radius + rodLength;

export function cylinderAt(angle: number) {
  const phase = mod(angle, 720);
  const a = (phase * Math.PI) / 180;
  const pinX = radius * Math.sin(a);
  const pinY = radius * Math.cos(a);
  const pistonY = pistonDistance(IO390, phase);
  return {
    phase,
    stroke: stroke(phase),
    pinX,
    pinY,
    pistonY,
    rodAngle: Math.atan2(pinX, pistonY - pinY),
    travelMm: (top - pistonY) * 1000,
    volumeCc: volume(IO390, phase) * 1e6,
    valves: valveLift(IO390, phase),
    spark: phase >= 720 - IO390.ignition.advanceBTC || phase < 4,
  };
}

/** Playback rpm is deliberately slow; this is not a running-engine performance solver. */
export function advanceAngle(angle: number, dt: number, rpm: number) {
  return mod(angle + Math.max(0, dt) * Math.max(0, rpm) * 6, 720);
}

// The isolated cylinder is driven by a bench at a selected speed and charge level.
// It shares mixture/thermal relationships with the engine, not its propeller solver.

export type ValveFault = "free" | "open" | "closed";
export type CombustionFault = "none" | "detonation" | "preignition" | "backfire";
export const COMBUSTION_NAMES: Record<CombustionFault, string> = {
  none: "None",
  detonation: "Detonation",
  preignition: "Pre-ignition",
  backfire: "Intake backfire",
};
export type Ignition = "both" | "top" | "bottom" | "off";
export interface BenchControls {
  rpm: number;
  load: number;
  /** Fuel equivalence ratio: 1 = stoichiometric; >1 rich. Zero is fuel cut-off. */
  phi: number;
  ignition: Ignition;
  intake: ValveFault;
  exhaust: ValveFault;
  playback: number;
  combustionFault: CombustionFault;
}
export interface CylinderBench {
  angle: number;
  seconds: number;
  cht: number;
  egt: number;
  deposits: [number, number];
  sparks: [boolean, boolean];
  fuelGph: number;
  work: number;
  roughness: number;
  firing: boolean;
  abnormal: CombustionFault;
}
export const defaultBenchControls = (): BenchControls => ({
  rpm: 2450,
  load: 0.65,
  phi: 1 / IO390.calibration.lambdaBestPower,
  ignition: "both",
  intake: "free",
  exhaust: "free",
  playback: 10,
  combustionFault: "none",
});
export const initialBench = (): CylinderBench => ({
  angle: 0,
  seconds: 0,
  cht: 300,
  egt: 1100,
  deposits: [0, 0],
  sparks: [true, true],
  fuelGph: 0,
  work: 0,
  roughness: 0,
  firing: false,
  abnormal: "none",
});
export function benchValves(angle: number, c: BenchControls) {
  const v = cylinderAt(angle).valves;
  const lift = (normal: number, fault: ValveFault) => (fault === "free" ? normal : fault === "open" ? 0.55 : 0);
  return { intake: lift(v.intake, c.intake), exhaust: lift(v.exhaust, c.exhaust) };
}
const approach = (v: number, target: number, dt: number, tau: number) => target + (v - target) * Math.exp(-dt / tau);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function updateBench(s: CylinderBench, c: BenchControls) {
  const cal = IO390.calibration;
  const lambda = c.phi > 0 ? 1 / c.phi : Infinity;
  const rotating = c.rpm > 0;
  s.sparks = [
    rotating && (c.ignition === "both" || c.ignition === "top") && s.deposits[0] < 0.8,
    rotating && (c.ignition === "both" || c.ignition === "bottom") && s.deposits[1] < 0.8,
  ];
  const plugs = s.sparks.filter(Boolean).length;
  // A stuck valve removes useful trapped charge in this deliberately simple fault model.
  // Closed exhaust models failed scavenging; it is not a prediction of trapped-gas temperature.
  const breathing = c.intake === "free" && c.exhaust === "free";
  const base = mixturePower(lambda, cal.lambdaBestPower, cal.peakEgtPower);
  const burnable = rotating && breathing && base > 0.02;
  // Imposed fault demonstrations; these gates are not certified detonation/flammability limits.
  s.abnormal = "none";
  if (burnable && c.combustionFault === "preignition") s.abnormal = "preignition";
  if (burnable && plugs > 0) {
    if (c.combustionFault === "detonation" && c.load > 0.75 && s.cht > 380 && c.phi >= 0.8 && c.phi < 1.3)
      s.abnormal = "detonation";
    if (c.combustionFault === "backfire" && c.phi < 0.8) s.abnormal = "backfire";
  }
  const ignitionAvailable = plugs > 0 || s.abnormal === "preignition";
  s.work = burnable && ignitionAvailable ? base * (plugs === 1 ? cal.singlePlug : 1) : 0;
  if (s.abnormal === "detonation") s.work *= 0.85;
  if (s.abnormal === "preignition" || s.abnormal === "backfire") s.work *= 0.65;
  s.firing = s.work > 0.02;
  s.roughness = rotating
    ? clamp01(
        Math.max(1 - stability(lambda), plugs === 1 ? 0.15 : 0, !s.firing ? 1 : 0, s.abnormal !== "none" ? 0.45 : 0),
      )
    : 0;
  // Illustrative per-cylinder metering schedule, anchored to the published 75% cruise fuel flow.
  const cruise = IO390.rating.cruise[0];
  s.fuelGph = rotating
    ? (cruise.gph / IO390.geometry.cylinders.length) *
      (c.load / 0.75) *
      (c.rpm / cruise.rpm) *
      c.phi *
      cal.lambdaBestPower
    : 0;
}
export function stepBench(s: CylinderBench, c: BenchControls, dt: number) {
  updateBench(s, c);
  s.seconds += dt;
  if (c.rpm > 0) s.angle = advanceAngle(s.angle, dt, c.playback);
  const lambda = c.phi > 0 ? 1 / c.phi : Infinity;
  const cal = IO390.calibration;
  const load = c.load * s.work * (c.rpm / IO390.rating.rpm);
  const plugs = s.sparks.filter(Boolean).length;
  const ambient = 59;
  const egtTarget = s.firing
    ? Math.max(
        ambient,
        cal.egtBase +
          cal.egtGain * Math.sqrt(load) +
          egtOffset(lambda) +
          (plugs === 1 ? 60 : 0) -
          (s.abnormal === "backfire" ? 100 : 0),
      )
    : c.rpm > 0
      ? (s.cht + ambient) / 2
      : ambient;
  const chtTarget =
    ambient +
    (s.firing ? cal.chtRise * Math.pow(load, 0.6) * headHeat(lambda, cal.lambdaBestPower) : 0) +
    (s.abnormal === "preignition" ? 360 : s.abnormal === "detonation" ? 180 : 0);
  s.egt = approach(s.egt, egtTarget, dt, s.firing ? 3 : 12);
  s.cht = approach(
    s.cht,
    chtTarget,
    dt,
    s.abnormal === "preignition" ? 18 : s.abnormal === "detonation" ? 45 : cal.chtTau,
  );
  // Accelerated demonstration of deposit accumulation, not a service-life prediction.
  // Deposits persist after leaning; only the explicit service/reset action removes them.
  if (c.rpm > 0 && c.rpm < 1200 && c.phi > 1.35 && s.cht < 320) {
    const rate = (c.phi - 1.35) / 18;
    s.deposits = [clamp01(s.deposits[0] + rate * dt * 0.75), clamp01(s.deposits[1] + rate * dt)];
  }
  updateBench(s, c);
}
/** Phase windows only drive the schematic animation; thermal effects use the operating condition. */
export function combustionEvent(s: CylinderBench, c: BenchControls, angle = s.angle): CombustionFault {
  const phase = mod(angle, 720);
  if (s.abnormal === "detonation" && phase >= 10 && phase < 70) return "detonation";
  if (s.abnormal === "preignition" && phase >= 660 && phase < 700) return "preignition";
  if (s.abnormal === "backfire" && phase >= 340 && phase < 410 && benchValves(phase, c).intake > 0.001)
    return "backfire";
  return "none";
}
export const BENCH_SCENARIOS = [
  {
    id: "detonation",
    name: "Detonation",
    note: "A severe detonation example: the remaining charge autoignites after the spark. Orange rings show pressure disturbances during the power stroke; CHT rises and useful work falls. Reduce charge or enrich to suppress this demonstration. Light detonation may have no obvious cockpit symptoms.",
  },
  {
    id: "preignition",
    name: "Pre-ignition",
    note: "An imposed hot spot ignites the charge before the scheduled spark. The red flare appears during compression and CHT rises rapidly. Turning off the plugs does not remove the hot spot; fuel cut-off stops combustion. Clear the combustion fault to remove the source.",
  },
  {
    id: "backfire",
    name: "Intake backfire",
    note: "A lean, slow-burning charge ignites the intake as its valve opens. Orange flow travels outward through the intake, not the exhaust. Enrich the mixture to suppress this example. This models intake backfire, not exhaust afterfire.",
  },
  {
    id: "normal",
    name: "Normal operation",
    note: "Two plugs ignite the charge. Compare the fast EGT response with the slower cylinder-head temperature.",
  },
  {
    id: "rich",
    name: "Rich idle / fouling",
    note: "Excess fuel at low speed builds deposits in this accelerated example. The lower plug fouls first; leaning stops accumulation but does not erase deposits. Use Service plugs to restore them.",
  },
  {
    id: "single",
    name: "One fouled plug",
    note: "The upper plug has failed. One flame front burns more slowly: useful work falls and EGT can rise. Select top-only ignition to isolate the failed plug.",
  },
  {
    id: "dead",
    name: "Both plugs fouled",
    note: "Fuel still enters, but neither plug ignites it. EGT falls quickly; CHT cools more slowly. Service the plugs to restore ignition.",
  },
  {
    id: "lean",
    name: "Lean misfire",
    note: "Too little fuel reduces combustion stability. Enrich the mixture and watch combustion and temperature recover.",
  },
  {
    id: "intake",
    name: "Intake stuck closed",
    note: "The intake valve cannot admit a fresh charge. The bench keeps turning, but this cylinder produces no useful work.",
  },
  {
    id: "exhaust",
    name: "Exhaust stuck open",
    note: "The exhaust valve cannot seal during compression. The simplified fault model removes useful combustion; repair the valve with its Free setting.",
  },
] as const;
export type BenchScenario = (typeof BENCH_SCENARIOS)[number]["id"];
export function createCylinderBench() {
  const s = initialBench();
  const c = defaultBenchControls();
  const clock = createSimulationClock((dt) => stepBench(s, c, dt), { maxCatchUp: 0.25 });
  const set = (patch: Partial<BenchControls>) => {
    Object.assign(c, patch);
    updateBench(s, c);
  };
  const scenario = (id: BenchScenario) => {
    Object.assign(c, defaultBenchControls());
    Object.assign(s, initialBench());
    clock.reset();
    if (id === "rich") {
      Object.assign(c, { rpm: 900, load: 0.18, phi: 1.65 });
      s.deposits = [0.55, 0.72];
      s.cht = 230;
      s.egt = 900;
    }
    if (id === "detonation") {
      Object.assign(c, { combustionFault: "detonation", load: 1, rpm: 2700, phi: 1.05 });
      s.cht = 430;
      s.angle = 20;
    }
    if (id === "preignition") {
      Object.assign(c, { combustionFault: "preignition", load: 0.9, rpm: 2700, phi: 1.1 });
      s.cht = 420;
      s.angle = 670;
    }
    if (id === "backfire") {
      Object.assign(c, { combustionFault: "backfire", phi: 0.68 });
      s.angle = 360;
    }
    if (id === "single") s.deposits = [1, 0];
    if (id === "dead") s.deposits = [1, 1];
    if (id === "lean") c.phi = 0.62;
    if (id === "intake") c.intake = "closed";
    if (id === "exhaust") c.exhaust = "open";
    updateBench(s, c);
  };
  updateBench(s, c);
  return {
    s,
    c,
    advance: clock.advance,
    set,
    scenario,
    service: () => {
      s.deposits = [0, 0];
      updateBench(s, c);
    },
  };
}
