import type { SysDef } from "@/lib/systems";

/** Rail entries in POH Section 7 order (172SPHBUS-04 table of contents, pp. 7-1 – 7-3); Ground Control (7-22) leads the gear entry. */
export const SYS: SysDef[] = [
  { id: "overview", name: "Overview", pg: "7-5", cam: [[7.6, 4.3, 10.6], [-0.35, 0.05, 0]], blurb: "" },
  { id: "airframe", name: "Airframe", pg: "7-5", cam: [[6.4, 6.2, 9.2], [-0.2, 0.1, 0]], blurb: "Semimonocoque, strut-braced wing" },
  { id: "controls", name: "Flight controls", pg: "7-7", cam: [[-8.6, 5.8, 8.8], [-1.0, 0.2, 0]], blurb: "Cables, bellcranks, trim tab" },
  { id: "gear", name: "Gear, brakes & steering", pg: "7-22", cam: [[5.4, 0.2, 5.6], [1.1, -0.75, 0]], blurb: "Spring steel, oleo nose, bungee" },
  { id: "flaps", name: "Wing flaps", pg: "7-23", cam: [[-3.4, 3.4, 6.4], [0.55, 0.55, 1.4]], blurb: "Electric single-slot, UP–FULL" },
  { id: "cabin", name: "Cabin & safety", pg: "7-24", cam: [[3.3, 4.9, 5.5], [0.5, 0.25, 0]], blurb: "Seats, doors, ELT, extinguisher, CO" },
  { id: "engine", name: "Engine", pg: "7-29", cam: [[6.1, 1.5, 3.3], [2.95, 0.0, 0]], blurb: "IO-360-L2A, ignition, oil, induction" },
  { id: "propeller", name: "Propeller", pg: "7-37", cam: [[7.0, 1.0, -3.3], [3.45, 0.0, 0]], blurb: "Fixed pitch: RPM = throttle + speed" },
  { id: "fuel", name: "Fuel", pg: "7-38", cam: [[2.4, 3.9, 7.9], [0.85, -0.05, 0]], blurb: "Wing tanks, BOTH/L/R, aux pump" },
  { id: "electrical", name: "Electrical", pg: "7-47", cam: [[4.8, 2.3, -4.3], [2.15, 0.05, -0.15]], blurb: "28 V, 60 A, standby battery, 6 buses" },
  { id: "lighting", name: "Lighting", pg: "7-59", cam: [[9.9, 6.7, -13.4], [-0.7, 0.3, 1.5]], blurb: "Nav, strobes, beacon, land/taxi" },
  { id: "environment", name: "Cabin heat & ventilation", pg: "7-62", cam: [[4.7, 1.9, 3.7], [2.0, -0.15, 0]], blurb: "Muffler shroud, CABIN HT / AIR" },
  { id: "pitot", name: "Pitot-static & stall", pg: "7-64", cam: [[3.2, 1.4, -8.4], [0.6, 0.15, -1.6]], blurb: "Heated pitot, static, pneumatic horn" },
  { id: "vacuum", name: "Vacuum & standby attitude", pg: "7-65", cam: [[4.2, 1.7, -3.1], [2.45, 0.1, 0]], blurb: "Engine pump, GYRO flag, LOW VACUUM" },
  { id: "avionics", name: "Avionics (G1000)", pg: "7-68", cam: [[0.72, 0.6, -0.01], [2.1, 0.17, -0.01]], blurb: "GDU 1040 ×2, GIA 63W, AHRS, EIS" },
  { id: "autopilot", name: "Autopilot (GFC 700)", pg: "7-71", cam: [[-5.4, 3.4, 6.6], [-0.9, 0.15, 0]], blurb: "Modes, servos, CWS, MET, limits" },
];
