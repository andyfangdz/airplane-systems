/**
 * The four-stroke cycle of one cylinder: crank kinematics, valve events, and a single-zone cylinder-pressure trace.
 * Phase is the cylinder's own crank angle, 0 … 720°, with 0 at top centre on compression (firing).
 */
import type { CylinderDef, EngineSpec } from "../types";
import { IN_M, INHG_PA, PSI_PA } from "./atmosphere";

const D2R = Math.PI / 180;
export const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Crank angle (0 … 720) at which each cylinder fires, from the firing order: one cylinder every 720/n degrees. */
export function firingAngle(spec: EngineSpec, n: number) {
  const k = spec.geometry.firingOrder.indexOf(n);
  return (k * 720) / spec.geometry.firingOrder.length;
}

/**
 * Spark timing, degrees before top centre, for a switch position: at START only the retard-breaker magneto fires, at
 * its start retard (after top centre, so negative here); otherwise the normal advance.
 */
export const sparkBTC = (spec: EngineSpec, mags: string) =>
  mags === "START" ? -spec.ignition.startRetardATC : spec.ignition.advanceBTC;

/** The cylinder's phase at an engine crank angle. */
export const phaseOf = (spec: EngineSpec, n: number, crank: number) => mod(crank - firingAngle(spec, n), 720);

/** Stroke name for a phase. */
export function stroke(phase: number): "power" | "exhaust" | "intake" | "compression" {
  const p = mod(phase, 720);
  return p < 180 ? "power" : p < 360 ? "exhaust" : p < 540 ? "intake" : "compression";
}

/** Direction (degrees, in the plane normal to the crank, 0 = up, 90 = right) of a bank's cylinder axis. */
export const sideAngle = (c: CylinderDef) => (c.side === "R" ? 90 : 270);

/** Crankpin direction at a crank angle, degrees (same convention as `sideAngle`). */
export const pinAngle = (c: CylinderDef, crank: number) => mod(c.pin + crank, 360);

/** Piston-pin distance from the crank axis (m) for a crank angle measured from this cylinder's top centre. */
export function pistonDistance(spec: EngineSpec, fromTdcDeg: number) {
  const r = (spec.geometry.strokeIn * IN_M) / 2,
    l = spec.geometry.rodIn * IN_M;
  const a = fromTdcDeg * D2R;
  return r * Math.cos(a) + Math.sqrt(l * l - (r * Math.sin(a)) ** 2);
}

/**
 * Crankpin and piston-pin centres (m) at a crank angle, in the plane normal to the crank (y up, z right): the two ends
 * of the connecting rod, always one rod length apart.
 */
export function rodEnds(spec: EngineSpec, c: CylinderDef, crank: number) {
  const r = (spec.geometry.strokeIn * IN_M) / 2;
  const phi = pinAngle(c, crank) * D2R,
    axis = sideAngle(c) * D2R;
  const dist = pistonDistance(spec, pinAngle(c, crank) - sideAngle(c));
  return {
    pin: { y: r * Math.cos(phi), z: r * Math.sin(phi) },
    piston: { y: dist * Math.cos(axis), z: dist * Math.sin(axis) },
  };
}

/** Cylinder volume (m³) at a phase: clearance plus swept volume to the piston. */
export function volume(spec: EngineSpec, phase: number) {
  const g = spec.geometry;
  const r = (g.strokeIn * IN_M) / 2,
    l = g.rodIn * IN_M;
  const area = Math.PI * ((g.boreIn * IN_M) / 2) ** 2;
  const swept = area * 2 * r;
  const clearance = swept / (g.compressionRatio - 1);
  return clearance + area * (r + l - pistonDistance(spec, phase));
}

/** Valve lift 0 … 1 (intake and exhaust) at a phase, from the valve events: smooth sin² ramps. */
export function valveLift(spec: EngineSpec, phase: number) {
  const v = spec.geometry.valves;
  const p = mod(phase, 720);
  const lift = (open: number, close: number) => {
    let x = p;
    if (open < 0 && x > 360) x -= 720; // windows that wrap past 0
    if (x < open || x > close) return 0;
    return Math.sin((Math.PI * (x - open)) / (close - open)) ** 2;
  };
  return { intake: lift(360 - v.ivo, 540 + v.ivc), exhaust: lift(180 - v.evo, 360 + v.evc) };
}

export interface Trace {
  /** Phase (deg), pressure (psia), volume (fraction of maximum). */
  phase: number[];
  psi: number[];
  vol: number[];
  peakPsi: number;
  /** Peak pressure location, degrees after top centre. */
  peakAtdc: number;
  /** Phase where combustion starts and is 90 % complete. */
  spark: number;
  burn90: number;
}

/**
 * Cylinder pressure over one cycle: intake at manifold pressure, polytropic compression from intake-valve
 * closing, Wiebe heat release from the spark, expansion to exhaust-valve opening, blowdown, exhaust at exhaust
 * pressure. The heat released is solved so the compression–expansion loop does `grossWork` joules: the trace is
 * the model's own indicated work drawn as pressure, not a separate prediction.
 */
export function pressureTrace(
  spec: EngineSpec,
  opts: { map: number; exhaust: number; grossWork: number; advance: number; burnDeg: number; firing: boolean },
): Trace {
  const g = spec.geometry;
  const gam = 1.3;
  const step = 2;
  const phase: number[] = [],
    psi: number[] = [],
    vol: number[] = [];
  const vmax = volume(spec, 180);
  const pin = opts.map * INHG_PA,
    pex = opts.exhaust * INHG_PA;
  const ivc = 540 + g.valves.ivc,
    evo = 720 + 180 - g.valves.evo; // in the −… frame below: compression starts at ivc, expansion ends at evo
  const spark = 720 - opts.advance;
  const wiebe = (th: number) =>
    th < spark ? 0 : 1 - Math.exp(-5 * Math.pow(Math.min((th - spark) / opts.burnDeg, 2), 3));

  // closed part, ivc … evo (phases beyond 720 belong to the next cycle's power stroke)
  const closed = (q: number) => {
    const ps: number[] = [];
    let p = pin;
    let v = volume(spec, ivc);
    let w = 0;
    for (let th = ivc; th <= evo; th += step) {
      const v2 = volume(spec, th + step);
      const dq = q * (wiebe(th + step) - wiebe(th));
      const dv = v2 - v;
      const p2 = p + ((gam - 1) * dq - gam * p * dv) / ((v + v2) / 2);
      w += ((p + p2) / 2) * dv;
      ps.push(p);
      p = p2;
      v = v2;
    }
    return { ps, w };
  };
  const m = closed(0);
  let q = 0;
  if (opts.firing && opts.grossWork > 0) {
    const u = closed(1000);
    q = (1000 * (opts.grossWork - m.w)) / Math.max(u.w - m.w, 1e-6);
    q = Math.max(0, q);
  }
  const loop = closed(q).ps;
  const pEvo = loop[loop.length - 1];

  for (let th = 0; th < 720; th += step) {
    // map 0 … 720 onto the frames above: the power stroke (0 … 180) is the end of the closed part
    let p: number;
    const t = th < 360 ? th + 720 : th;
    if (t >= ivc && t <= evo) p = loop[Math.round((t - ivc) / step)] ?? pEvo;
    else if (th >= 180 - g.valves.evo && th < 180 + 40) {
      const k = (th - (180 - g.valves.evo)) / (g.valves.evo + 40);
      p = pex + (pEvo - pex) * Math.exp(-5 * k);
    } else if (th >= 180 && th < 360) p = pex * 1.02;
    else p = pin;
    phase.push(th);
    psi.push(p / PSI_PA);
    vol.push(volume(spec, th) / vmax);
  }
  let peak = 0,
    at = 0;
  psi.forEach((p, i) => {
    if (p > peak) {
      peak = p;
      at = phase[i];
    }
  });
  let burn90 = spark + opts.burnDeg;
  for (let th = spark; th < spark + 3 * opts.burnDeg; th += 0.5)
    if (wiebe(th) >= 0.9) {
      burn90 = th;
      break;
    }
  return {
    phase,
    psi,
    vol,
    peakPsi: peak,
    peakAtdc: at > 360 ? at - 720 : at,
    spark: mod(spark, 720),
    burn90: mod(burn90, 720),
  };
}
