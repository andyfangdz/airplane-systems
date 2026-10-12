/** DA40 XLS avgas installation study ports. Undimensioned positions are schematic; see SOURCES.md. */
import { V, toVec3, type Vec3 } from "@/lib/math";
import { PEDALS } from "./rig";
import { FW, PANEL_X, fs, wingP } from "./geometry";

export const FUEL_SELECTOR_BODY: Vec3 = [fs(2.38), -0.55, 0];
export const GASCOLATOR: Vec3 = [fs(1.89), -0.56, 0];
export const ELECTRIC_PUMP: Vec3 = [fs(1.6), -0.55, 0.07];
export const FUEL_FIREWALL: Vec3 = [FW, -0.43, -0.08];
export const ENGINE_PUMP: Vec3 = [fs(1.28), -0.12, -0.12];
export const FUEL_SERVO: Vec3 = [fs(1.08), -0.31, 0];
export const FLOW_SENSOR: Vec3 = [fs(0.98), -0.27, 0.15];
export const FUEL_DIVIDER: Vec3 = [fs(0.92), 0.15, 0];
export const AIR_FILTER: Vec3 = [fs(1.02), -0.405, 0];
export const ALTERNATE_AIR: Vec3 = [fs(1.045), -0.37, 0];
export const AIR_INLET: Vec3 = [fs(0.92), -0.41, 0];
export const OIL_SUMP: Vec3 = [fs(0.9), -0.2, 0];
export const OIL_SCREEN: Vec3 = [fs(1.1), -0.24, -0.08];
export const OIL_PUMP: Vec3 = [fs(1.22), -0.14, -0.04];
export const OIL_THERMOSTAT: Vec3 = [fs(1.2), -0.02, -0.18];
export const OIL_FILTER: Vec3 = [fs(1.2), -0.04, -0.26];
export const OIL_COOLER: Vec3 = [fs(0.6), -0.06, 0.32];
export const OIL_RELIEF: Vec3 = [fs(1.17), -0.11, -0.2];
export const OIL_GALLERY: Vec3 = [fs(0.95), -0.07, 0];
export const GOVERNOR: Vec3 = [fs(0.75), 0.12, 0.06];
export const SLICKSTART: Vec3 = [FW + 0.035, 0.035, -0.2];
export const GEA: Vec3 = [PANEL_X + 0.1, -0.05, -0.3];
export const GDC: Vec3 = [PANEL_X + 0.1, 0.06, 0.12];
export const GRS: Vec3 = [fs(3.83), -0.39, 0.174];
export const GIA1: Vec3 = [fs(3.83), -0.54, -0.11];
export const GIA2: Vec3 = [fs(3.83), -0.54, 0];
export const GTX: Vec3 = [fs(3.83), -0.54, 0.11];
export const GMA: Vec3 = [PANEL_X - 0.03, -0.03, -0.066];
export const PFD: Vec3 = [PANEL_X + 0.01, -0.03, -0.26];
export const MFD: Vec3 = [PANEL_X + 0.01, -0.03, 0.13];
export const BRAKE_VALVE: Vec3 = [fs(1.9), -0.58, 0.1];
export const BATTERY_RELAY: Vec3 = [fs(1.3), -0.04, 0.32];
export const START_RELAY: Vec3 = [fs(1.28), -0.095, 0.32];
export const EXT_RELAY: Vec3 = [fs(1.28), 0.02, 0.32];
export const BUS = {
  ess: [PANEL_X + 0.06, 0.045, 0.43] as Vec3,
  main: [PANEL_X + 0.06, -0.035, 0.43] as Vec3,
  av: [PANEL_X + 0.06, -0.1, 0.43] as Vec3,
};
export const TIE_RELAY: Vec3 = [PANEL_X + 0.095, -0.1, 0.34];
export const TIE_DIODE: Vec3 = [PANEL_X + 0.1, -0.02, 0.34];
export const AV_RELAY: Vec3 = [PANEL_X + 0.1, -0.16, 0.34];
export const PITOT_SPLIT: Vec3 = [fs(2.6), -0.47, -0.2];
export const STATIC_SPLIT: Vec3 = [fs(2.6), -0.47, -0.27];
export const PITOT_SUMP: Vec3 = [fs(2.75), -0.58, -0.2];
export const STATIC_SUMP: Vec3 = [fs(2.75), -0.58, -0.27];
export const PITOT_JOIN: Vec3 = [fs(2.45), -0.47, -0.2];
export const STATIC_JOIN: Vec3 = [fs(2.45), -0.47, -0.27];
export const PITOT_FILTER: Vec3 = [fs(2.3), -0.5, -0.5];
export const STATIC_FILTER: Vec3 = [fs(2.3) - 0.018, -0.5, -0.477];
export const ALTERNATE_STATIC: Vec3 = [fs(1.86), -0.3, -0.42];
export const FUEL_CHAMBERS = [
  { name: "Inboard fuel chamber", z0: 1.18, z1: 2.08 },
  { name: "Outboard fuel chamber", z0: 2.13, z1: 2.95 },
  { name: "Long-range fuel chamber", z0: 3.0, z1: 3.55 },
] as const;
export const FUEL_PROBE = (s: number, longRange: boolean) => toVec3(wingP(s * (longRange ? 3.04 : 1.22), 0.5, 0));
export const VENT = (s: number, check: boolean) =>
  toVec3(wingP(s * (check ? 4.04 : 3.9), 0.45, -1).add(V(0, -0.02, 0)));
export const tankPort = (s: number, z: number, upper = false) => {
  const mean = wingP(s * z, 0.45, 0);
  return upper ? toVec3(mean.lerp(wingP(s * z, 0.45, 1), 0.65)) : toVec3(mean);
};

/** AMM32-40: reservoirs on both copilot masters; each wheel circuit continues through its pilot master. */
export const brakeCircuit = (side: number) => {
  const pilotZ = PEDALS.z[side < 0 ? 0 : 1],
    copilotZ = PEDALS.z[side < 0 ? 2 : 3];
  const point = (z: number, dy: number): Vec3 => [PEDALS.x + 0.05, PEDALS.y + dy, z];
  return { pilot: point(pilotZ, 0.01), copilot: point(copilotZ, 0.01), reservoir: point(copilotZ, 0.105) };
};
