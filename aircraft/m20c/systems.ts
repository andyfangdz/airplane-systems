import type { SysDef } from "@/lib/systems";

/**
 * Rail entries in the order of the 1965–67 Mark 21 / M20C Owner's Manual, Part I "Description and Operation of
 * Components" (table of contents, 1965 edition p. 1): general, propeller, engine and ignition, fuel system, electrical
 * system, airframe, landing gear, flight controls, Mooney Positive Control, trim system, flaps, vacuum system, brakes,
 * heating and ventilation. The 1967 edition (POH-001186) is not available online; page numbers are the 1965 manual's,
 * which covers the same airplane with the same chapter order, with the later M20C Ranger Operator's Manual (1974,
 * Section II) used where the older book is silent (pitot-static, instruments, circuit breakers).
 */
export const SYS: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "1",
    cam: [
      [8.6, 4.4, 10.4],
      [0.0, -0.3, 0],
    ],
    blurb: "",
  },
  {
    id: "airframe",
    name: "Airframe",
    pg: "6",
    cam: [
      [6.0, 5.2, 8.4],
      [0.0, -0.3, 0],
    ],
    blurb: "Steel-tube cabin, laminar wing, pivoting tail",
  },
  {
    id: "controls",
    name: "Flight controls & trim",
    pg: "8",
    cam: [
      [-6.8, 4.6, 7.4],
      [-0.9, -0.2, 0],
    ],
    blurb: "Push-pull tubes, all-moving tail trim",
  },
  {
    id: "autopilot",
    name: "Positive Control (PC)",
    pg: "8",
    cam: [
      [-1.6, 3.6, 7.0],
      [0.2, -0.4, 0.4],
    ],
    blurb: "Brittain vacuum wing leveler",
  },
  {
    id: "flaps",
    name: "Wing flaps",
    pg: "9",
    cam: [
      [-4.0, 3.2, 6.6],
      [0.2, -0.5, 1.4],
    ],
    blurb: "Hydraulic hand-pump flaps",
  },
  {
    id: "gear",
    name: "Landing gear & brakes",
    pg: "6",
    cam: [
      [5.4, 0.2, 5.8],
      [1.2, -0.9, 0.2],
    ],
    blurb: "Johnson-bar manual gear, rubber discs",
  },
  {
    id: "engine",
    name: "Engine",
    pg: "2",
    cam: [
      [4.4, 1.2, 2.6],
      [2.4, -0.15, 0],
    ],
    blurb: "O-360-A1D, carburetor, cowl flaps, oil",
  },
  {
    id: "propeller",
    name: "Propeller",
    pg: "2",
    cam: [
      [5.6, 0.9, -3.0],
      [3.1, -0.05, 0],
    ],
    blurb: "Hartzell constant speed, 74 in",
  },
  {
    id: "fuel",
    name: "Fuel",
    pg: "3",
    cam: [
      [2.6, 6.6, 8.2],
      [0.6, -0.5, 0.4],
    ],
    blurb: "Wet wings 2 × 26 gal, selector, boost pump",
  },
  {
    id: "electrical",
    name: "Electrical",
    pg: "3",
    cam: [
      [4.2, 2.6, 5.0],
      [1.6, -0.2, 0],
    ],
    blurb: "12 V, alternator, switch-breakers",
  },
  {
    id: "lighting",
    name: "Lighting",
    pg: "4",
    cam: [
      [-6.0, 5.4, 9.0],
      [0.0, -0.3, 0.8],
    ],
    blurb: "Nav, beacon, landing, spot lights",
  },
  {
    id: "vacuum",
    name: "Vacuum & instruments",
    pg: "10",
    cam: [
      [1.2, 0.6, 1.6],
      [2.0, -0.05, -0.2],
    ],
    blurb: "Pump, gyros, PC servos",
  },
  {
    id: "pitot",
    name: "Pitot-static & stall",
    pg: "Ranger 2-7",
    ref: "Ranger OM 1974 · p. 2-7",
    cam: [
      [2.0, 2.2, -7.4],
      [0.4, -0.4, -1.8],
    ],
    blurb: "Wing pitot, tail-cone statics, stall vane",
  },
  {
    id: "environment",
    name: "Heating & ventilation",
    pg: "10",
    cam: [
      [3.6, 2.0, 3.6],
      [1.4, -0.2, 0.2],
    ],
    blurb: "Exhaust muff, scoops, overhead vents",
  },
  {
    id: "cabin",
    name: "Cabin & panel",
    pg: "12",
    cam: [
      [1.0, 0.9, 2.6],
      [1.4, -0.1, 0.0],
    ],
    blurb: "Door, seats, baggage, instrument panel",
  },
];
