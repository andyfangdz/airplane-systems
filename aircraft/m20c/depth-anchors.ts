/** Installation anchors for the 1968 M20C study configuration. All dimensions/routing are illustrative.
 * Names/topology: Mooney MAN 106 §§ 3–9, IPC 205 Figs. 25,27–30,34–44; Brittain 11968.
 * Kept free of catalogue imports so adding detail cannot change legacy component registration order. */
import type { Vec3 } from "@/lib/math";
import { wingP } from "./geometry";
export const DEPTH = {
  oilPump: [2.3, -0.14, 0] as Vec3,
  suction: [2.4, -0.245, 0.06] as Vec3,
  pressureScreen: [2.22, -0.02, 0.13] as Vec3,
  oilBypass: [2.26, -0.1, -0.12] as Vec3,
  oilRelief: [2.33, 0.03, 0.02] as Vec3,
  oilGallery: [2.59, -0.02, 0.055] as Vec3,
  governor: [2.87, 0.015, -0.08] as Vec3,
  oilPressure: [2.25, 0.035, 0.1] as Vec3,
  oilTemp: [2.21, -0.035, 0.08] as Vec3,
  oilDipstick: [2.44, 0.16, 0.15] as Vec3,
  selectorBowl: [1.35, -0.665, -0.3] as Vec3,
  selectorScreen: [1.35, -0.65, -0.3] as Vec3,
  boostScreen: [1.77, -0.53, -0.22] as Vec3,
  fuelFirewall: [1.95, -0.47, -0.22] as Vec3,
  carbScreen: [2.59, -0.285, -0.045] as Vec3,
  carbFloat: [2.56, -0.29, 0.02] as Vec3,
  bus: [1.61, -0.24, 0] as Vec3,
  shunt: [1.83, -0.2, -0.25] as Vec3,
  starterRelay: [2.12, -0.16, -0.25] as Vec3,
  overvoltage: [2.06, 0.09, -0.22] as Vec3,
  fieldBreaker: [1.56, -0.13, 0.35] as Vec3,
  outputBreaker: [1.02, -0.19, 0.5] as Vec3,
  instrument: [1.55, 0.05, -0.3] as Vec3,
  engineGauges: [1.56, 0.025, 0.32] as Vec3,
  vacuumSwitch: [1.79, 0.04, -0.13] as Vec3,
  attitude: [1.56, 0.08, -0.28] as Vec3,
  directional: [1.56, -0.015, -0.29] as Vec3,
  pcPilot: [1.68, -0.14, -0.28] as Vec3,
  pcRate: [1.57, -0.025, -0.43] as Vec3,
  pcTrim: [1.55, -0.05, -0.43] as Vec3,
  hydraulic: [1.87, 0.1, 0.2] as Vec3,
  flapPump: [1.5, -0.5, 0.075] as Vec3,
  flapInlet: [1.51, -0.5, 0.095] as Vec3,
  flapOutlet: [1.47, -0.52, 0.095] as Vec3,
  flapRelease: [1.49, -0.5, 0.055] as Vec3,
  flapActuator: [0.25, -0.62, 0] as Vec3,
  parkValve: [1.65, -0.4, -0.25] as Vec3,
  heatBox: [1.85, -0.3, 0.35] as Vec3,
};
export const tankPickup = (side: number): Vec3 => wingP(side * 0.85, 0.3, 0).toArray() as Vec3;
export const tankVent = (side: number): Vec3 => wingP(side * 2.4, 0.3, 0).toArray() as Vec3;
export const depthWing = (side: number, span: number, chord: number): Vec3 =>
  wingP(side * span, chord, 0).toArray() as Vec3;
