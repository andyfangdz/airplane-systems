/** Kinematic teaching model. Dimensions and assumptions: SOURCES.md. */
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
