/**
 * Where an engine's parts sit in the 3D scene: the drawing data that differs between engines (stations, camshaft side,
 * valve and port arrangement, drives, labels, camera, hover notes). The scene reads it through `layoutFor(spec)`; the
 * model never imports it, and an engine's layout lives beside its spec (`engines/<id>/layout.ts`), so the spec stays
 * physics data. `IO390_DEFAULTS` are the constants the scene was first drawn with: an engine without a layout, or a
 * field its layout leaves out, draws exactly as the IO-390 does.
 */
import { TSIO550K_LAYOUT } from "@/engines/tsio550k/layout";
import type { EngineSpec } from "@/engines/types";
import type { Dims } from "./kit";

export type V3 = [number, number, number];

/** One valve's train in its cylinder's frame (y up, +z out along the axis): lobe and tappet line, rocker pivot, stem tip. */
export interface ValveDef {
  /** Along the crankshaft from the cylinder axis (towards the front for the right bank), m. */
  x: number;
  /** Pushrod line height: the camshaft axis, m. */
  pushY: number;
  /** Rocker pivot, halfway between the pushrod and the stem tip (1:1 rocker), m. */
  pivotY: number;
  /** Valve stem tip, m. */
  tipY: number;
}

export interface AlternatorDef {
  /** Part name in the scene and its label. */
  name: string;
  drive: "belt" | "gear";
  /** Alternator turns per crankshaft turn; null = the spec's `accessories.alternatorRatio`. */
  ratio: number | null;
  /** Position around the crankshaft axis, degrees from straight up towards the right (+z). */
  angleDeg: number;
  /** Belt drive: distance of the alternator shaft from the crankshaft axis, m (a gear drive is set by its gears). */
  r?: number;
  /** Belt drive: the crankshaft pulley's centre behind the propeller-flange face, m (default 0.055). */
  pulleyBehindFlange?: number;
  /** Length of the alternator body, m (default 0.08). */
  bodyLen?: number;
  /**
   * Gear drive: the shaft along the crankshaft, the body running forward of its gear (absent), or across it on a pad on
   * the crankcase nose, turned by a bevel pinion on the crankshaft's drive gear (`"transverse"`, with `transverse`).
   */
  axis?: "axial" | "transverse";
  /**
   * A transverse alternator's shaft station forward of the accessory mounting face, its pad face and outboard end face
   * from the crankshaft axis (in the `angleDeg` direction), inches, and its housing radius, m.
   */
  transverse?: { stationIn: number; padIn: number; endIn: number; r: number };
  src: string;
  /** Hover note; absent = the IO-390 alternator's. */
  note?: string;
}

/** Hover notes that name an engine's documents or counts; absent = the IO-390 text written where the part is drawn. */
export type NoteKey =
  | "crankshaft"
  | "mainBearings"
  | "counterweight"
  | "propFlange"
  | "pistonOil"
  | "baseFlange"
  | "rockerCover"
  | "intakePort"
  | "exhaustPort"
  | "nozzle"
  | "plug"
  | "camshaft"
  | "govDriveGear"
  | "crankcaseRight"
  | "crankcaseLeft"
  | "crankcaseBolts"
  | "accessoryHousing"
  | "sump"
  | "oilFilter"
  | "oilPump"
  | "oilPumpDrive"
  | "screen"
  | "screenPlug"
  | "drain"
  | "dipTube"
  | "oilSupply"
  | "magneto"
  | "magCap"
  | "magGear"
  | "idler"
  | "harness"
  | "fuelManifold"
  | "fuelLines"
  | "starter"
  | "starterShaftGear"
  | "starterWorm"
  | "governor"
  | "altDriveGear"
  | "altPulley"
  | "altBelt";

export interface EngineLayout {
  /**
   * Stations along the crankshaft, inches, in the scene's x (x = in × 0.0254, + forward): the accessory mounting face,
   * the rear face of the crankcase, the front of the crankcase and the propeller-flange face. null = derived from the
   * cylinder positions (IO-390).
   */
  stationsIn: { accessoryFace: number; caseRear: number; front: number; propFlange: number } | null;
  /** Rocker covers' outer faces, side to side, inches; null = the spec's overall width (`envelopeIn.width`). */
  coverWidthIn: number | null;
  /** Camshaft under the crankshaft (its gear meshes below the crankshaft gear). */
  camBelow: boolean;
  /** Valves fore and aft of the cylinder axis, or intake above and exhaust below it (cross-flow head, schematic). */
  valvePlane: "fore-aft" | "vertical";
  /** Intake ports under the head (the runners come up from below) or on top (downdraft). */
  ports: { intake: "under" | "top" };
  /** Rocker covers per head; two sit fore and aft. */
  coversPerCylinder: 1 | 2;
  /** Rocker box height range in the cylinder frame, m (the cover adds 4 mm each way). */
  rockerBoxY: [number, number];
  /** Fasteners drawn on each cylinder base flange. */
  baseFasteners: number;
  /** Half the width of one crank throw along the shaft (cheeks and crankpin), m. */
  throwHalf: number;
  /** Counterweights: on the front (+1) or rear (−1) cheek of the named cylinder's throw, hanging opposite its pin. */
  counterweights: { cyl: number; cheek: 1 | -1 }[];
  /** A main bearing at the front of the crankcase as well as one in each journal between the throws. */
  noseMainBearing: boolean;
  /** Crankcase top and bottom, sump bottom, and the accessory housing's height range, m (crankshaft axis at 0). */
  caseY: { top: number; bottom: number; sumpBottom: number; accBottom: number; accTop: number };
  /** Starter: pinion on a ring gear behind the propeller flange, or a right-angle adapter on the accessory end. */
  starter: "front-ring" | "rear-adapter";
  /** Rear adapter: the starter's centreline, inches aft of the accessory face. */
  starterAftIn: number | null;
  /** Propeller governor: on the front top, spur-driven from the camshaft, or front lower left on a camshaft bevel gear. */
  governor: "front-top" | "front-lower-left";
  alternators: AlternatorDef[];
  /** Magneto drive gears mesh with the camshaft gear, or with an idler gear the crankshaft gear drives. */
  magDrive: "cam" | "idler";
  /** Oil pump drive gear meshes with the crankshaft gear, or turns with the camshaft gear (splined into it). */
  oilPumpDrive: "crank" | "cam";
  /** Label pins: text and position. */
  labels: (d: Dims, spec: EngineSpec) => [string, V3][];
  /** Initial camera position and orbit target, and the furthest zoom. */
  camera: { position: V3; target: V3; maxDistance: number };
  notes: Partial<Record<NoteKey, string>>;
}

/** The IO-390 scene's constants: today's drawing, unchanged. */
export const IO390_DEFAULTS: EngineLayout = {
  stationsIn: null,
  coverWidthIn: null,
  camBelow: false,
  valvePlane: "fore-aft",
  ports: { intake: "under" },
  coversPerCylinder: 1,
  rockerBoxY: [0.012, 0.15],
  baseFasteners: 8,
  throwHalf: 0.032,
  counterweights: [
    { cyl: 2, cheek: -1 },
    { cyl: 3, cheek: 1 },
  ],
  noseMainBearing: false,
  caseY: { top: 0.16, bottom: -0.11, sumpBottom: -0.2, accBottom: -0.13, accTop: 0.235 },
  starter: "front-ring",
  starterAftIn: null,
  governor: "front-top",
  alternators: [{ name: "Alternator", drive: "belt", ratio: null, angleDeg: 135, r: 0.27, src: "IOM Table A-4" }],
  magDrive: "cam",
  oilPumpDrive: "crank",
  labels: (d, spec) => [
    ["Magnetos", [d.accRear - 0.08, 0.22, 0]],
    ["Oil filter", [d.accRear - 0.12, -0.04, 0]],
    ...((spec.fuelSystem.kind === "carburetor"
      ? [["Carburetor", [d.front + 0.02, d.sumpBottom - 0.13, 0]]]
      : [
          ["Fuel injector", [d.front + 0.02, d.sumpBottom - 0.1, 0]],
          ["Fuel manifold", [0, d.caseTop + 0.09, 0]],
        ]) as [string, V3][]),
    ["Starter", [d.flangeX - 0.02, -0.17, -0.22]],
    ["Alternator", [d.flangeX - 0.1, -0.27, 0.25]],
    ["Governor", [d.front + 0.04, 0.16, -0.07]],
  ],
  camera: { position: [1.15, 0.62, 1.35], target: [0, -0.02, 0], maxDistance: 6 },
  notes: {},
};

/** Layouts by engine id; the fields an engine leaves out keep the IO-390 values. */
const LAYOUTS: Record<string, EngineLayout> = {
  io390: IO390_DEFAULTS,
  tsio550k: { ...IO390_DEFAULTS, ...TSIO550K_LAYOUT },
};

/** The scene layout for an engine (the IO-390 defaults for an engine without one). */
export const layoutFor = (spec: EngineSpec): EngineLayout => LAYOUTS[spec.id] ?? IO390_DEFAULTS;
