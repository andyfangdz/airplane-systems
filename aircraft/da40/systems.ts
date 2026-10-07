import type { SysDef } from "@/lib/systems";

/**
 * Rail entries in AFM Section 7 order (DA 40 AFM Doc. 6.01.01-E Rev. 8, table of contents p. 7-1): airframe, flight controls
 * (flaps 7-5), landing gear 7-13, seats/baggage/canopy and door 7-15 – 7-17 (heating and ventilation 7-18), power plant 7-20,
 * fuel 7-31, electrical 7-40 (lighting 7-44), pitot-static and stall warning 7-54, avionics 7-54. Section 7 says nothing about
 * the GFC 700: it is described in the G1000/GFC 700 AFMS.
 */
export const SYS: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "7-3",
    cam: [
      [9.4, 4.8, 11.6],
      [-0.9, -0.35, 0],
    ],
    blurb: "",
  },
  {
    id: "airframe",
    name: "Airframe",
    pg: "7-3",
    cam: [
      [6.4, 5.4, 9.2],
      [-0.9, -0.3, 0],
    ],
    blurb: "GFRP/CFRP shell, stub wing, T-tail",
  },
  {
    id: "controls",
    name: "Flight controls",
    pg: "7-4",
    cam: [
      [-7.5, 7.0, 11.5],
      [-0.9, -0.3, 0.6],
    ],
    blurb: "Push rods, rudder cables, trim tab",
  },
  {
    id: "flaps",
    name: "Wing flaps",
    pg: "7-5",
    cam: [
      [-4.6, 3.8, 7.8],
      [0.3, -0.5, 2.2],
    ],
    blurb: "Electric UP / T/O / LDG flaps",
  },
  {
    id: "gear",
    name: "Gear & brakes",
    pg: "7-13",
    cam: [
      [6.2, 0.3, 6.4],
      [0.9, -0.8, 0.25],
    ],
    blurb: "Spring-steel mains, toe brakes",
  },
  {
    id: "cabin",
    name: "Canopy, door & safety",
    pg: "7-15",
    cam: [
      [3.4, 4.2, -5.4],
      [0.3, -0.05, 0],
    ],
    blurb: "Canopy, rear door, seats, ELT",
  },
  {
    id: "environment",
    name: "Heating & ventilation",
    pg: "7-18",
    cam: [
      [3.9, 1.9, 3.7],
      [1.0, -0.25, 0],
    ],
    blurb: "Muffler heat, fresh air, defrost",
  },
  {
    id: "engine",
    name: "Engine",
    pg: "7-20",
    cam: [
      [3.6, 1.0, 2.2],
      [1.9, -0.15, 0],
    ],
    blurb: "IO-360-M1A, controls, oil, EIS",
  },
  {
    id: "propeller",
    name: "Propeller",
    pg: "7-24",
    cam: [
      [5.7, 0.8, -3.2],
      [2.45, -0.05, 0],
    ],
    blurb: "MT 3-blade constant speed",
  },
  {
    id: "fuel",
    name: "Fuel",
    pg: "7-31",
    cam: [
      [2.9, 7.4, 8.9],
      [0.5, -0.5, 0.4],
    ],
    blurb: "Long-range tanks, selector, pumps",
  },
  {
    id: "electrical",
    name: "Electrical",
    pg: "7-40",
    cam: [
      [4.3, 2.8, 5.2],
      [1.0, -0.2, 0],
    ],
    blurb: "28 V, 3 buses, emergency battery",
  },
  {
    id: "lighting",
    name: "Lighting",
    pg: "7-44",
    cam: [
      [-6.8, 6.0, 10.0],
      [0.0, -0.3, 0.9],
    ],
    blurb: "Wing-tip, landing/taxi, flood lights",
  },
  {
    id: "pitot",
    name: "Pitot-static & stall",
    pg: "7-54",
    cam: [
      [2.4, 2.6, -8.2],
      [0.6, -0.45, -2.2],
    ],
    blurb: "Heated probe, stall-warning horn",
  },
  {
    id: "avionics",
    name: "Avionics (G1000)",
    pg: "7-54",
    cam: [
      [0.15, 0.36, -0.065],
      [1.22, -0.01, -0.065],
    ],
    blurb: "PFD, MFD, GIAs, annunciations",
  },
  {
    id: "autopilot",
    name: "Autopilot (GFC 700)",
    pg: "AFMS",
    ref: "AFMS 190-00492-10 · p. 9",
    cam: [
      [0.35, 0.24, -0.14],
      [1.22, -0.04, -0.1],
    ],
    blurb: "Modes, servos, trim, limits",
  },
];
