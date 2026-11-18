import type { EngineSpec } from "../types";
import { IO360_PARTS } from "../io360/parts";
import { common, drawingNote, physicsNote, limits, flows, line } from "../io360/shared";

const diamond = "DA40 AFM 6.01.01-E";
const iom = "Lycoming 60297-36";
const propSupplement = "DA40 AFMS 6.01.01-CS0601(E), pp. 2–3";
const m1aIpc = "https://www.lycoming.com/sites/default/files/file/2025-10/PC-%28L%29IO-360-M1A%20Rev%201.pdf";

export const IO360_DA40: EngineSpec = {
  ...common,
  id: "io360-m1a",
  illustratedInstallation: "da40",
  name: "IO-360-M1A · DA40 XLS",
  model: "Lycoming IO-360-M1A",
  lead: "The DA40 XLS couples its 180 hp IO-360-M1A to a three-blade MT constant-speed propeller. The blue lever sets governor RPM. A rotary alternate-air inlet bypasses the filter, and four exhaust headers feed the underslung Power Flow collector.",
  doc: "AFM",
  ref: "Engine simulation · DA40 XLS",
  refs: {
    start: diamond + " 4A, starting engine",
    idle: iom + " §3",
    magCheck: diamond + " 4A, before take-off",
    cruise: iom + " p. 18",
    tables: diamond + " 2-5, " + propSupplement + " and " + iom + " pp. 9, 18.",
    leaning: diamond + " 4A, cruise",
  },
  modelNotes: [
    drawingNote,
    "Power and fuel flow follow the M1A engine charts. Oil pressure drives the MT hub toward coarse pitch. The model uses the XLS propeller supplement for blade stops and continuous RPM.",
    physicsNote,
  ],
  sources: [
    {
      title: diamond,
      href: "https://www.acbelleile.com/_files/ugd/ec5b88_820a629dca6a472ea7fe29b64398c055.pdf",
      note: "Operating limits and engine installation, §§2, 4A and 7.",
    },
    {
      title: propSupplement,
      href: "https://diamondaviators.net/forum/download/file.php?id=1173",
      note: "MTV-12-B/183-59b diameter, pitch range and continuous RPM.",
    },
    {
      title: iom,
      href: "https://www.lycoming.com/content/operator%27s-manual-%28L%29IO-360-M1A-60297-36",
      note: "M1A specifications p. 9, cruise table p. 18, Figs. 3-1, 3-2 and installation Fig. 2-1.",
    },
    {
      title: "IO-360-M1A illustrated parts catalog",
      href: m1aIpc,
      note: "Front governor drive, cylinders, fuel injector and ignition, chapters 72–74.",
    },
    {
      title: "Power Flow PFS-15102 installation instructions",
      href: "https://www.powerflowsystems.com/documents/installation-icaw-ipc-ac-manufacture/diamond-da40-360-icaw",
      note: "Headers, shrouded collector and tailpipe, PFS-15250-00 pp. 3–8.",
    },
  ],
  geometry: { ...common.geometry, envelopeIn: { length: 33.267, width: 33.345, height: 20.596 } },
  ignition: { ...common.ignition, advanceSrc: iom + " p. 9" },
  calibration: { ...common.calibration, idleArea: 0.024 },
  parts: IO360_PARTS.da40,
  rating: {
    hp: 180,
    rpm: 2700,
    cruise: [
      { label: "Performance cruise", pct: 75, hp: 135, rpm: 2450, gph: 11, mixture: "best power" },
      { label: "Economy cruise", pct: 65, hp: 117, rpm: 2350, gph: 8.5, mixture: "best economy" },
    ],
  },
  performance: {
    kind: "lycoming",
    curve: "Lycoming curve 13549 (Fig. 3-2)",
    lines: [
      line(1800, 66, 113, 29.2, 61),
      line(2000, 74, 128, 29.15, 67),
      line(2200, 81, 142, 29.1, 75),
      line(2400, 90, 152, 29.1, 83),
      line(2700, 103, 172, 29, 91),
    ],
  },
  fuelFlow: {
    kind: "chart",
    curve: "Lycoming curve 12849-A (Fig. 3-1)",
    slope: 0.39,
    bestPower: flows([
      [2200, 12],
      [2400, 14],
      [2500, 15.2],
      [2600, 16.2],
      [2700, 17],
    ]),
    bestEconomy: flows([
      [1800, 3],
      [2000, 4.5],
      [2200, 6],
      [2400, 7],
      [2500, 8],
      [2600, 8.7],
      [2700, 9.3],
    ]),
  },
  limits: limits(false, diamond, iom),
  accessories: {
    starterRatio: 16.556,
    alternatorRatio: 3.2,
    magnetoRatio: 1,
    tachRatio: 0.5,
    governorRatio: 0.947,
    rotation: "Clockwise viewed from the rear",
    magnetos: "Slick 4347 (left) and 4370 (right), SlickSTART",
    weightLb: 300,
  },
  propeller: {
    name: "MT-Propeller MTV-12-B/183-59b",
    src: propSupplement,
    diameterIn: 183 / 2.54,
    blades: 3,
    fineDeg: 11,
    coarseDeg: 30,
    governorMinRpm: 1800,
    inertia: 3.2,
    cpScale: 1.9,
    inducedInflow: true,
  },
};
