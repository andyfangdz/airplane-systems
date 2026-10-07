import type { SysDef } from "@/lib/systems";

/**
 * Rail entries in POH Section 7 order (182TPHAUS-04 table of contents, pp. 7-1 – 7-4). Ground control (7-19) leads
 * the gear entry; cabin & safety starts at the baggage/seats pages (7-21) and also covers cabin features (7-74);
 * the KAP 140 is described on 7-68 and in Supplement 3.
 */
export const SYS: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "7-5",
    cam: [
      [8.2, 4.6, 11.4],
      [-0.3, 0.1, 0],
    ],
    blurb: "",
  },
  {
    id: "airframe",
    name: "Airframe",
    pg: "7-5",
    cam: [
      [6.9, 6.6, 9.8],
      [-0.2, 0.15, 0],
    ],
    blurb: "Semimonocoque, strut-braced wing",
  },
  {
    id: "controls",
    name: "Flight controls",
    pg: "7-6",
    cam: [
      [-8.6, 6.8, 8.4],
      [-0.9, 0.1, 0],
    ],
    blurb: "Cables, bellcranks, elevator + rudder trim",
  },
  {
    id: "gear",
    name: "Gear, brakes & steering",
    pg: "7-19",
    cam: [
      [6.8, 0.5, 7.2],
      [1.4, -0.65, 0],
    ],
    blurb: "Spring steel, oleo nose, bungee",
  },
  {
    id: "flaps",
    name: "Wing flaps",
    pg: "7-20",
    cam: [
      [-3.6, 3.6, 6.7],
      [0.55, 0.55, 1.4],
    ],
    blurb: "Electric single-slot, UP–FULL",
  },
  {
    id: "cabin",
    name: "Cabin & safety",
    pg: "7-21",
    cam: [
      [3.3, 5.1, 5.8],
      [0.3, 0.25, 0],
    ],
    blurb: "Seats, doors, baggage, ELT, CO",
  },
  {
    id: "engine",
    name: "Engine",
    pg: "7-27",
    cam: [
      [3.3, 1.3, 3.8],
      [2.85, 0.0, 0],
    ],
    blurb: "IO-540-AB1A5, oil, ignition, cowl flaps",
  },
  {
    id: "propeller",
    name: "Propeller",
    pg: "7-37",
    cam: [
      [7.6, 1.1, -3.6],
      [3.7, 0.0, 0],
    ],
    blurb: "Constant speed: governor + blue knob",
  },
  {
    id: "fuel",
    name: "Fuel",
    pg: "7-38",
    cam: [
      [3.2, 4.8, 7.6],
      [0.6, -0.1, 0],
    ],
    blurb: "92 gal, BOTH/L/R/OFF, return line",
  },
  {
    id: "electrical",
    name: "Electrical",
    pg: "7-46",
    cam: [
      [3.9, 4.4, -7.0],
      [1.5, -0.1, 0],
    ],
    blurb: "28 V, 60 A, standby battery, 6 buses",
  },
  {
    id: "lighting",
    name: "Lighting",
    pg: "7-57",
    cam: [
      [6.1, 6.9, -12.1],
      [-0.28, 0.3, 0.91],
    ],
    blurb: "Nav, strobes, beacon, land/taxi",
  },
  {
    id: "environment",
    name: "Cabin heat & ventilation",
    pg: "7-60",
    cam: [
      [5.2, 2.0, 4.1],
      [2.1, -0.15, 0],
    ],
    blurb: "Muffler shrouds, CABIN HT / AIR, DEFROST",
  },
  {
    id: "pitot",
    name: "Pitot-static & stall",
    pg: "7-62",
    cam: [
      [5.6, 0.6, -7.2],
      [1.2, 0.3, -1.4],
    ],
    blurb: "Heated pitot, two static ports, vane",
  },
  {
    id: "vacuum",
    name: "Vacuum & standby attitude",
    pg: "7-63",
    cam: [
      [3.3, 1.6, 3.0],
      [2.3, 0.1, 0.1],
    ],
    blurb: "Engine pump, GYRO flag, LOW VACUUM",
  },
  {
    id: "avionics",
    name: "Avionics (G1000)",
    pg: "7-66",
    cam: [
      [0.45, 0.4, -0.07],
      [2.1, 0.02, -0.07],
    ],
    blurb: "GDU 1040 ×2, GIA 63, AHRS, EIS",
  },
  {
    id: "autopilot",
    name: "Autopilot (KAP 140)",
    pg: "7-68",
    cam: [
      [-5.6, 3.5, 6.9],
      [-0.9, 0.15, 0],
    ],
    blurb: "2-axis, altitude preselect, servos",
  },
];
