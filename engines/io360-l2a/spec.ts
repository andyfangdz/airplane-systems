import type { EngineSpec } from "../types";
import { IO360_PARTS } from "../io360/parts";
import { common, drawingNote, physicsNote, limits, flows, line } from "../io360/shared";

const cessna = "C172S NAV III POH";
const om = "Lycoming 60297-12";
const l2aIpc = "https://www.lycoming.com/sites/default/files/file/2025-06/PC-IO-360-L2A_0.pdf";

export const IO360_C172S: EngineSpec = {
  ...common,
  id: "io360-l2a",
  illustratedInstallation: "c172s",
  name: "IO-360-L2A · C172S",
  model: "Lycoming IO-360-L2A",
  lead: "The C172S Skyhawk uses the 180 hp rating of the IO-360-L2A. Its two-blade McCauley has fixed pitch. Throttle and airspeed determine RPM. A spring-loaded alternate-air door opens when suction builds behind an obstructed filter.",
  doc: "POH",
  ref: "Engine simulation · C172S NAV III",
  refs: {
    start: cessna + " 4-12–15",
    idle: cessna + " 4-29",
    magCheck: cessna + " 4-16",
    cruise: cessna + " Fig. 5-8",
    tables: cessna + " 1-5, 2-6–9, 8-14 and " + om + " §2–3.",
    leaning: cessna + " 4-35",
  },
  modelNotes: [
    drawingNote,
    "Power follows Lycoming curve 13516-A, including the dashed higher-RPM lines for the 180 hp installation. The cruise setups use Cessna Figure 5-8 at standard temperature. The fixed blade angle and aerodynamic load are fitted to static and cruise RPM.",
    physicsNote,
  ],
  sources: [
    {
      title: cessna,
      href: "https://aerocadet.com/cbts/pdf/172S-POH.pdf",
      note: "Engine and propeller, limits, cruise performance and induction. Sections 1, 2, 4, 5 and 7.",
    },
    {
      title: om,
      href: "https://www.lycoming.com/content/operator%27s-manual-O-360-HO-360-IO-360-AIO-360-HIO-360-TIO-360-60297-12",
      note: "L2A alternate rating p. 2-2, weight and dimensions §2, fuel and performance Figs. 3-9 and 3-25.",
    },
    {
      title: "IO-360-L2A illustrated parts catalog",
      href: l2aIpc,
      note: "Power section, cylinders, injection and impulse-coupled magnetos, Figs. 4–12 and 20–25.",
    },
  ],
  geometry: { ...common.geometry, envelopeIn: { length: 29.81, width: 33.37, height: 24.84 } },
  ignition: { ...common.ignition, advanceSrc: om + " 2-2" },
  calibration: { ...common.calibration, idleArea: 0.024 },
  parts: IO360_PARTS.c172s,
  rating: {
    hp: 180,
    rpm: 2700,
    cruise: [
      { label: "Cruise at 4,000 ft", pct: 73, hp: 131.4, rpm: 2550, gph: 9.9, tasKt: 117, mixture: "recommended lean" },
      { label: "Cruise at 6,000 ft", pct: 65, hp: 117, rpm: 2500, gph: 9, tasKt: 114, mixture: "recommended lean" },
    ],
  },
  performance: {
    kind: "lycoming",
    curve: "Lycoming curve 13516-A (Fig. 3-25)",
    lines: [
      line(1800, 68, 115, 29.4, 54),
      line(2000, 77, 132, 29.4, 66),
      line(2200, 87, 143, 29.3, 71),
      line(2400, 92, 153, 29.1, 76),
      line(2500, 98, 158, 29, 78),
      line(2600, 105, 167, 28.9, 82),
      line(2700, 111, 175, 28.7, 87),
    ],
  },
  fuelFlow: {
    kind: "chart",
    curve: "Lycoming Fig. 3-9 (higher RPM extrapolated)",
    slope: 0.39,
    bestPower: flows([
      [2200, 12.5],
      [2400, 14],
    ]),
    bestEconomy: flows([
      [1800, 3],
      [2000, 4.6],
      [2200, 6],
      [2400, 8],
    ]),
  },
  induction: { altAir: "automatic", doorOpenInH2O: 2, altAirDeltaC: 24 },
  limits: limits(true, cessna, om),
  accessories: {
    starterRatio: 16.556,
    alternatorRatio: 3.2,
    magnetoRatio: 1,
    tachRatio: 0.5,
    governorRatio: 0,
    rotation: "Clockwise viewed from the rear",
    magnetos: "Two Slick 4371 impulse-coupled magnetos",
    weightLb: 278,
  },
  propeller: {
    name: "McCauley 1A170E/JHA7660",
    src: cessna + " 1-5, 2-6",
    diameterIn: 76,
    blades: 2,
    control: "fixed-pitch",
    fineDeg: 18,
    coarseDeg: 18,
    governorMinRpm: 0,
    inertia: 3.2,
    staticCp: 0.06,
    unloading: 0.505,
  },
};
