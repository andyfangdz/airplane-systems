import type { Vec3 } from "@/lib/math";

// Positive local X is toward the copilot, local Y is up, and local Z faces the crew.
// The lower MDU is tilted back into the pedestal, as in the 6X Overview, p. 57.
export const panelRotation = (pitch: number): Vec3 => [Math.PI / 2, -Math.PI / 2 - pitch, Math.PI / 2];

interface Unit {
  name: string;
  key: "left" | "right" | "upper-center" | "lower-center" | "left-efb" | "right-efb" | "standby";
  pos: Vec3;
  size: [number, number];
  pitch: number;
}
export const UNITS = [
  { key: "left", name: "Captain primary display", pos: [9.59, 0.075, -0.475], size: [0.34, 0.255], pitch: 0.11 },
  { key: "right", name: "First officer primary display", pos: [9.59, 0.075, 0.475], size: [0.34, 0.255], pitch: 0.11 },
  { key: "upper-center", name: "Upper multifunction display", pos: [9.59, 0.075, 0], size: [0.34, 0.255], pitch: 0.11 },
  {
    key: "lower-center",
    name: "Lower multifunction display",
    pos: [9.467, -0.25, 0],
    size: [0.34, 0.255],
    pitch: 0.61,
  },
  {
    key: "left-efb",
    name: "Left electronic flight bag",
    pos: [9.59, 0.074, -0.827],
    size: [0.204, 0.277],
    pitch: 0.11,
  },
  {
    key: "right-efb",
    name: "Right electronic flight bag",
    pos: [9.59, 0.074, 0.827],
    size: [0.204, 0.277],
    pitch: 0.11,
  },
  { key: "standby", name: "Standby flight display", pos: [9.586, 0.134, -0.235], size: [0.061, 0.068], pitch: 0.11 },
] satisfies Unit[];
