import type { SysDef } from "@/lib/systems";

/** Rail grouping retained from the study model; references now point to the actual 1968 POH1187.
 * Serial680194: manual gear/hand flaps/PC; optional installations are explicitly identified in SOURCES.md. */
export const SYS: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "1-1",
    cam: [
      [8.6, 4.4, 10.4],
      [0.0, -0.3, 0],
    ],
    blurb: "",
  },
  {
    id: "airframe",
    name: "Airframe",
    pg: "1-1",
    cam: [
      [6.0, 5.2, 8.4],
      [0.0, -0.3, 0],
    ],
    blurb: "Steel-tube cabin, laminar wing, pivoting tail",
  },
  {
    id: "controls",
    name: "Flight controls & trim",
    pg: "2-6,2-8",
    cam: [
      [-6.8, 4.6, 7.4],
      [-0.9, -0.2, 0],
    ],
    blurb: "Push-pull tubes, all-moving tail trim",
  },
  {
    id: "autopilot",
    name: "Positive Control (PC)",
    pg: "2-6–8",
    cam: [
      [-1.6, 3.6, 7.0],
      [0.2, -0.4, 0.4],
    ],
    blurb: "Brittain vacuum wing leveler",
  },
  {
    id: "flaps",
    name: "Wing flaps",
    pg: "2-8–9",
    cam: [
      [-4.0, 3.2, 6.6],
      [0.2, -0.5, 1.4],
    ],
    blurb: "Hydraulic hand-pump flaps",
  },
  {
    id: "gear",
    name: "Landing gear & brakes",
    pg: "2-9–11",
    cam: [
      [5.4, 0.2, 5.8],
      [1.2, -0.9, 0.2],
    ],
    blurb: "Johnson-bar manual gear, rubber discs",
  },
  {
    id: "engine",
    name: "Engine",
    pg: "2-3–5",
    cam: [
      [4.4, 1.2, 2.6],
      [2.4, -0.15, 0],
    ],
    blurb: "O-360-A1D, carburetor, cowl flaps, oil",
  },
  {
    id: "propeller",
    name: "Propeller",
    pg: "1-3",
    cam: [
      [5.6, 0.9, -3.0],
      [3.1, -0.05, 0],
    ],
    blurb: "Hartzell constant speed, 74 in",
  },
  {
    id: "fuel",
    name: "Fuel",
    pg: "2-4",
    cam: [
      [2.6, 6.6, 8.2],
      [0.6, -0.5, 0.4],
    ],
    blurb: "Wet wings 2 × 26 gal, selector, boost pump",
  },
  {
    id: "electrical",
    name: "Electrical",
    pg: "2-12",
    cam: [
      [4.2, 2.6, 5.0],
      [1.6, -0.2, 0],
    ],
    blurb: "12 V, alternator, switch-breakers",
  },
  {
    id: "lighting",
    name: "Lighting",
    pg: "2-16",
    cam: [
      [-7.9, 6.83, 11.15],
      [-0.4, -0.3, 0.9],
    ],
    blurb: "Nav, beacon, landing, spot lights",
  },
  {
    id: "vacuum",
    name: "Vacuum & instruments",
    pg: "2-5",
    cam: [
      [1.2, 0.6, 1.6],
      [2.0, -0.05, -0.2],
    ],
    blurb: "Pump, gyros, PC servos",
  },
  {
    id: "pitot",
    name: "Pitot-static & stall",
    pg: "2-6",
    ref: "1968 OM POH1187 · p. 2-6",
    cam: [
      [2.0, 2.2, -7.4],
      [0.4, -0.4, -1.8],
    ],
    blurb: "Wing pitot, tail-cone statics, stall vane",
  },
  {
    id: "environment",
    name: "Heating & ventilation",
    pg: "2-16–17",
    cam: [
      [3.6, 2.0, 3.6],
      [1.4, -0.2, 0.2],
    ],
    blurb: "Exhaust muff, scoops, overhead vents",
  },
  {
    id: "cabin",
    name: "Cabin & panel",
    pg: "2-18",
    // Frame both seat rows and the baggage/shelf; the vacuum view keeps the close instrument view.
    cam: [
      [-1.2, 2.1, 4.2],
      [0.45, -0.1, 0.0],
    ],
    blurb: "Door, seats, baggage, instrument panel",
  },
];
