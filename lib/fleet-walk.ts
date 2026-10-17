/**
 * The preflight study walk shared by every airplane: the data types each airplane's `walkaround.ts` fills in (stations,
 * items, wording) and the pure logic over them (the items shown for the equipment fitted, where each item's parts are,
 * the camera framing, the model state at each step and the saved progress). The session store is fleet-walk-store.ts and
 * the panel and scene markers components/FleetWalkaround.tsx.
 */
import * as THREE from "three";
import { specGeo, type Catalogue, type ShellSpec, type PartSpec } from "./catalogue";
import { CAMERA_FOV, CAMERA_FIT_ASPECT } from "./camera";
import { toVec3, V, type Vec3 } from "./math";
import { partCentre, partSide, type Side } from "./spot";
import type { AircraftId, SysId } from "./systems";

/** Planned item animations (not drawn yet). */
export type FleetWalkAnim = "flaps100" | "aileronSweep" | "elevatorSweep" | "rudderSweep" | "drainSample" | "dipstick";
/** Fields an item's configuration variant may replace. */
type VariantFields = "text" | "standard" | "parts" | "why" | "ref" | "note" | "configurationCue";

export interface FleetWalkItem<S = unknown> {
  /** Station and item, e.g. "7c" or "3-2". */
  id: string;
  /** Checklist item text, e.g. "Fuel Drains (2 underside)". */
  text: string;
  /** Checklist action or standard, e.g. "DRAIN AND SAMPLE". */
  standard: string;
  /** Catalogue part, surface or shell names to highlight; names in the data's `missing` are shown as text only. */
  parts: string[];
  /** X-ray system shown with the item (the overview when absent). */
  system?: SysId;
  ref: string;
  /** Applicable supplement when an inspection differs from the base manual. */
  sourceUrl?: string;
  /** Part name or point anchoring the label and camera instead of averaging the highlighted parts. */
  target?: string | Vec3;
  /** Which side's instances of a shared part name; defaults to the station's side, "any" for both. */
  side?: "L" | "R" | "any";
  /** Sub-steps printed with the item. */
  steps?: string[];
  /** Note printed with the item. */
  note?: string;
  /** One line: what the check protects against, or what the system does. */
  why?: string;
  /** An underside check: the item camera crouches instead of standing. */
  crouch?: boolean;
  /** Fit the complete highlighted assembly, preserving the separate marker anchor. */
  fitParts?: boolean;
  /** Explicit eye position, used instead of the computed one; the camera still looks at the parts. */
  eye?: Vec3;
  /**
   * A technique item, not a lettered checklist item: shown with the data's technique badge, kept out of the checklist
   * item counts, and otherwise walked like the others.
   */
  technique?: boolean;
  /** Where the pilot is looking from, e.g. "Looking across at the LEFT main wheel". */
  look?: string;
  /** Id of the item where the pilot stands for this check: the mini-map and the scene draw the line of sight from there. */
  sightFrom?: string;
  /** Pointer to a related item, e.g. where a part is checked from the other side. */
  see?: string;
  /** Emphasize the parts beyond the spot colour: a pulsing halo on every instance. */
  emphasis?: boolean;
  /** A configuration cue (it points to a supplement rather than supplying its procedure); shown with a badge. */
  configurationCue?: boolean;
  /** Optional equipment: the item is left out while this is false. */
  fitted?: (s: S) => boolean;
  /** Different wording for a configuration, e.g. a FIKI airplane's cue replacing a basic-POH item. */
  variant?: { when: (s: S) => boolean } & Partial<Pick<FleetWalkItem<S>, VariantFields>>;
  /** What stepping onto this item sets in the model (the cabin checks). */
  sim?: (s: S) => void;
  anim?: FleetWalkAnim;
}
export interface FleetWalkStation<S = unknown> {
  n: number;
  title: string;
  /** Side the station's shared part names refer to. */
  side?: "L" | "R";
  /** Standing viewpoint: eye position and the point looked at (airplane coordinates, metres). */
  cam: { p: Vec3; t: Vec3 };
  /** Where the station sits on the top-down mini-map, [x, z] in airplane coordinates. */
  map: [number, number];
  /** Warning (or, with `caution`, caution) printed with the station. */
  warning?: string;
  caution?: boolean;
  /** Note printed before the station's first item. */
  note?: string;
  items: FleetWalkItem<S>[];
}
/** The panel's wording where the airplanes' documents and walks differ; each has a default (fleetWalkCopy). */
export interface FleetWalkCopy {
  /** Panel heading. */
  title: string;
  /** The Exit button's accessible name. */
  exit: string;
  /** Bold study-aid notice. */
  notice: string;
  /** Heading of the intro's warning box. */
  warnTitle: string;
  /** Line before the throughout list in the intro, if any. */
  throughoutLead?: string;
  /** Further intro lists after the throughout list (cold weather). */
  also?: string[][];
  /** Closing line of the intro's warning box. */
  consequence?: string;
  begin: string;
  resumeTitle: string;
  /** The resume screen's line for the saved step. */
  resumed: (step: { station: { n: number; title: string }; item: { id: string; text: string } }) => string;
  /** What marking an item does: "Reviewed", "Checked". */
  ok: string;
  /** The mini-map station's accessible-name suffix once every item is marked. */
  stationDone: string;
  /** Summary row for items left unmarked. */
  unmarked: string;
  doneTitle: string;
  /** Lead for the parts the model doesn't have. */
  missingLead: string;
  /** Added to each item's reference ("4-5 · C172S"); null for none. */
  refSuffix: string | null;
  /** Reference under the throughout list. */
  throughoutRef: string;
  /** Badge on technique items. */
  technique: string;
  /** Badge on configuration cues. */
  configurationCue: string;
  /** Mini-map: accessible name, title, outline. */
  mapLabel: string;
  mapTitle: string;
  map: FleetWalkMap;
}
/** Top-down outline for the mini-map, nose up, 10 map units per metre. */
export interface FleetWalkMap {
  viewBox: string;
  fuselage: string;
  wings: string;
}
export const FLEET_WALK_MAP: FleetWalkMap = {
  viewBox: "-80 -65 160 125",
  fuselage: "M-3,-34 L-6,-18 L-6,19 L-2,39 L2,39 L6,19 L6,-18 L3,-34 Z",
  wings: "M-6,-8 L-58,-6 L-58,3 L-6,7 Z M6,-8 L58,-6 L58,3 L6,7 Z M-19,27 L19,27 L19,33 L-19,33 Z",
};
export interface FleetWalkData<S = unknown> {
  id: AircraftId;
  short: string;
  source: string;
  /** The source document; without one, references are plain text. */
  sourceUrl?: string;
  applicability: string;
  general: string;
  throughout: string[];
  /** Where the checklist continues; `**text**` is bold. */
  next: string;
  stations: FleetWalkStation<S>[];
  /** A physical check is named explicitly when the scene cannot show or perform it. */
  missing: Record<string, string>;
  copy?: Partial<FleetWalkCopy>;
}
export interface FleetWalkStep<S = unknown> {
  station: FleetWalkStation<S>;
  item: FleetWalkItem<S>;
}
export interface FleetWalkProgress {
  v: 1;
  /** Current item id. */
  at: string;
  /** Checked or skipped, by item id. */
  marks: Record<string, "ok" | "skip">;
  /** Time spent walking, ms. */
  ms: number;
  done: boolean;
}
/** The data's wording, with the defaults filled in. */
export const fleetWalkCopy = (data: Pick<FleetWalkData, "short" | "source" | "copy">): FleetWalkCopy => ({
  title: `${data.short} preflight study walk`,
  exit: `Exit the ${data.short} study walk`,
  notice: "Study aid · use the approved checklist for your aircraft.",
  warnTitle: "Before inspection",
  begin: "Begin study walk",
  resumeTitle: `Resume ${data.short} study walk?`,
  resumed: ({ station, item }) => `Saved at station ${station.n}, ${station.title}: ${item.id} ${item.text}.`,
  ok: "Reviewed",
  stationDone: "reviewed",
  unmarked: "Unmarked",
  doneTitle: "Study walk complete",
  missingLead: "Physical detail outside the model:",
  refSuffix: data.short,
  throughoutRef: data.source,
  technique: "Technique (not in the checklist)",
  configurationCue: "Configuration cue — see supplement",
  mapLabel: `${data.short} preflight stations`,
  mapTitle: `${data.short}: approximate station map, nose up`,
  map: FLEET_WALK_MAP,
  ...data.copy,
});

/** Full parent transform, including fixed rake and nested propeller/gear rotations. */
export function fleetGroupMatrix(position: Vec3, rotation: Vec3 = [0, 0, 0]) {
  return new THREE.Matrix4().compose(
    V(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    V(1, 1, 1),
  );
}
/** "L" / "R" as a side, from the item or else its station ("any": both sides). */
export const fleetStepSide = <S>({ station, item }: FleetWalkStep<S>): Side => {
  const side = item.side ?? station.side;
  return side === "L" ? -1 : side === "R" ? 1 : 0;
};
/** Index of the first step of station `n`, or −1. */
export const fleetStationStart = <S>(steps: FleetWalkStep<S>[], n: number) => steps.findIndex((s) => s.station.n === n);
/** Counts for the finish summary: every item, technique items included, and the technique items on their own. */
export const fleetTally = <S>(steps: FleetWalkStep<S>[], marks: FleetWalkProgress["marks"]) => {
  const tech = steps.filter((s) => s.item.technique);
  return {
    ok: steps.filter((s) => marks[s.item.id] === "ok").length,
    skip: steps.filter((s) => marks[s.item.id] === "skip").length,
    open: steps.filter((s) => !marks[s.item.id]).length,
    tech: { ok: tech.filter((s) => marks[s.item.id] === "ok").length, of: tech.length },
  };
};
/** "12:05" from milliseconds. */
export const fleetWalkClock = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
/** Is the item one of the checklist's own items (not a technique item)? */
export const isChecklistItem = <S>(item: FleetWalkItem<S>) => !item.technique;

/** Radius of a station marker on the mini-map, m in airplane coordinates (drawn at 10 map units per metre). */
export const WALK_MAP_MARK_R = 0.75; // approximate: display size of a marker, not a source value
/** Closest and farthest the item framing puts the camera from the item's parts, m, along the ground. */
export const FRAME_DIST: [number, number] = [1.2, 2.4]; // approximate: display framing, not a source value
/** Step when backing the camera away from the airplane, m. */
const BACK_STEP_M = 0.05;

export function createFleetWalk<S>(options: {
  data: FleetWalkData<S>;
  cat: Catalogue;
  /** Scene shells outside the fixed catalogue, such as hinged doors and the pivoting tail. */
  extraShells?: ShellSpec[];
  groundY: number;
  /** Eye height for the `crouch` items (default 1.1 m above the ground). */
  crouchY?: number;
  ramp: (prior: S) => S;
  /** Each moving group's full ramp transform in airplane coordinates; null leaves its parts out of the framing. */
  groupMatrix: (parent: string) => THREE.Matrix4 | null;
  /** Some airplanes (M20C) keep empennage shells and hinges in a whole-tail group. */
  surfaceMatrix?: (key: string) => THREE.Matrix4;
  shellMatrix?: (name: string) => THREE.Matrix4;
  /** Room kept between a person and the airplane's top-view outline, m (default 0.25). */
  clearance?: number;
  /**
   * A skin the page still builds off the main thread: framing that needs the clearance outline waits for it (framePose is
   * null) rather than building it again, and `onSettled` reports when it is in.
   */
  hull?: { pending: () => boolean; onSettled: (listener: () => void) => void };
}) {
  const { data, cat } = options;
  const shells = [...cat.shells, ...(options.extraShells ?? [])];
  /** Every item, whatever the equipment fitted. */
  const steps: FleetWalkStep<S>[] = data.stations.flatMap((station) =>
    station.items.map((item) => ({ station, item })),
  );
  const progressKey = `${data.id}-walkaround`;
  /** The items shown for the equipment fitted in `s`, in checklist order. */
  const walkSteps = (s: S): FleetWalkStep<S>[] =>
    steps
      .filter(({ item }) => !item.fitted || item.fitted(s))
      .map((step) => {
        const variant = step.item.variant;
        if (!variant?.when(s)) return step;
        const { when: _when, ...fields } = variant;
        return { station: step.station, item: { ...step.item, ...fields } };
      });
  /** The item with this id, with its station (whatever the equipment fitted). */
  const stepOf = (id: string) => steps.find((s) => s.item.id === id);
  const stepParts = (step: FleetWalkStep<S>) => ({
    shown: step.item.parts.filter((name) => !(name in data.missing)),
    missing: step.item.parts.filter((name) => name in data.missing),
  });
  const inCatalogue = (name: string) => [...cat.parts, ...cat.surfaces, ...shells].some((p) => p.name === name);
  function parentMatrix(part: PartSpec) {
    return part.parent
      ? part.parent.startsWith("surf:")
        ? (options.surfaceMatrix?.(part.parent.slice(5)) ?? new THREE.Matrix4())
            .clone()
            .multiply(new THREE.Matrix4().makeTranslation(...cat.surfacePivot(part.parent.slice(5))))
        : options.groupMatrix(part.parent)
      : new THREE.Matrix4();
  }
  /**
   * Centres of every instance of a part, surface or shell name on `side` (0: all), in airplane coordinates; instances on
   * moving groups the walk can't place are left out. Empty for names the catalogue doesn't have.
   */
  function nameCentres(name: string, side: Side = 0) {
    const points: THREE.Vector3[] = [];
    // approximate: within 5 cm of the centreline counts as both sides, as in lib/spot.ts
    const keep = (z: number) => !side || Math.abs(z) < 0.05 || Math.sign(z) === side;
    for (const part of cat.parts) {
      if (part.name !== name) continue;
      const geometry = specGeo(part);
      const matrix = parentMatrix(part);
      if (!matrix) continue;
      const centre = partCentre(part, geometry).applyMatrix4(matrix);
      // Use the resolved world centre for arbitrary gear/tail group names too.
      const s = partSide(part, geometry, cat);
      if (keep(centre.z) && (!side || !s || s === side)) points.push(centre);
    }
    for (const shell of shells) {
      if (shell.name !== name) continue;
      const geometry = specGeo(shell);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const centre = geometry
        .boundingBox!.getCenter(V(0, 0, 0))
        .applyMatrix4(options.shellMatrix?.(name) ?? new THREE.Matrix4());
      if (keep(centre.z)) points.push(centre);
    }
    for (const surface of cat.surfaces) {
      if (surface.name !== name) continue;
      const geometry = specGeo(surface);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const centre = geometry
        .boundingBox!.getCenter(V(0, 0, 0))
        .add(V(...surface.pivot))
        .applyMatrix4(options.surfaceMatrix?.(surface.key) ?? new THREE.Matrix4());
      if (keep(centre.z)) points.push(centre);
    }
    return points;
  }
  function stepBounds(step: FleetWalkStep<S>) {
    const names = new Set(stepParts(step).shown),
      side = fleetStepSide(step),
      bounds = new THREE.Box3();
    const include = (box: THREE.Box3) => {
      const z = box.getCenter(V(0, 0, 0)).z;
      if (!side || Math.abs(z) < 0.05 || Math.sign(z) === side) bounds.union(box);
    };
    for (const part of cat.parts) {
      if (!names.has(part.name ?? "")) continue;
      const parent = parentMatrix(part);
      if (!parent) continue;
      const geometry = specGeo(part);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const object = new THREE.Object3D();
      if (part.pos) object.position.set(...part.pos);
      if (part.rot) object.rotation.set(...part.rot);
      if (part.scale) object.scale.set(...part.scale);
      object.updateMatrix();
      include(geometry.boundingBox!.clone().applyMatrix4(parent.clone().multiply(object.matrix)));
    }
    for (const shell of shells) {
      if (!names.has(shell.name)) continue;
      const geometry = specGeo(shell);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      include(geometry.boundingBox!.clone().applyMatrix4(options.shellMatrix?.(shell.name) ?? new THREE.Matrix4()));
    }
    for (const surface of cat.surfaces) {
      if (!names.has(surface.name)) continue;
      const geometry = specGeo(surface);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      include(
        geometry
          .boundingBox!.clone()
          .translate(V(...surface.pivot))
          .applyMatrix4(options.surfaceMatrix?.(surface.key) ?? new THREE.Matrix4()),
      );
    }
    return bounds.isEmpty() ? null : bounds;
  }
  /** The explicit target's centre, otherwise the highlighted parts' centroid on the step's side; null without parts. */
  function stepCentroid(step: FleetWalkStep<S>) {
    if (Array.isArray(step.item.target)) return V(...step.item.target);
    const names = step.item.target ? [step.item.target] : stepParts(step).shown;
    const points = names.flatMap((name) => nameCentres(name, fleetStepSide(step)));
    return points.length ? points.reduce((sum, p) => sum.add(p), V(0, 0, 0)).multiplyScalar(1 / points.length) : null;
  }
  /** Centroid of a station's checklist items (a technique item frames its own view, not the station's). */
  function stationCentroid(station: FleetWalkStation<S>) {
    const points = station.items.filter(isChecklistItem).flatMap((item) => {
      const c = stepCentroid({ station, item });
      return c ? [c] : [];
    });
    return points.length ? points.reduce((sum, p) => sum.add(p), V(0, 0, 0)).multiplyScalar(1 / points.length) : null;
  }
  /** Line of sight for an item checked from somewhere else (`sightFrom`), from that item's parts to this one's. */
  function sightLine(step: FleetWalkStep<S>): [THREE.Vector3, THREE.Vector3] | null {
    const from = step.item.sightFrom ? stepOf(step.item.sightFrom) : undefined;
    const a = from && stepCentroid(from),
      b = stepCentroid(step);
    return a && b ? [a, b] : null;
  }
  /** Where to draw the pulsing halos for an item with `emphasis`: every instance of its modelled parts on its side. */
  function emphasisPoints(step: FleetWalkStep<S>) {
    if (!step.item.emphasis) return [];
    const side = fleetStepSide(step);
    return stepParts(step).shown.flatMap((name) => nameCentres(name, side));
  }
  let outline: THREE.Box3[] | null = null;
  const clearance = options.clearance ?? 0.25; // approximate: a person's half-width, not a source value
  /** Is `point` over or under the airplane in top view (skin shells and control surfaces, grown by the clearance)? */
  function underAirplane(point: THREE.Vector3) {
    outline ??= [
      ...shells.map((shell) => {
        const geometry = specGeo(shell);
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return geometry
          .boundingBox!.clone()
          .applyMatrix4(options.shellMatrix?.(shell.name) ?? new THREE.Matrix4())
          .expandByScalar(clearance);
      }),
      ...cat.surfaces.map((surface) => {
        const geometry = specGeo(surface);
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return geometry
          .boundingBox!.clone()
          .translate(V(...surface.pivot))
          .applyMatrix4(options.surfaceMatrix?.(surface.key) ?? new THREE.Matrix4())
          .expandByScalar(clearance);
      }),
    ];
    return outline.some(
      (box) => point.x >= box.min.x && point.x <= box.max.x && point.z >= box.min.z && point.z <= box.max.z,
    );
  }
  /**
   * Camera for an item: the eye stays at the station's standing height (crouched for `crouch` items) and walks along the
   * ground from the station towards the item's parts, to FRAME_DIST from them but never over or under the airplane, then
   * looks at them; an item with its own `eye` is seen from there, and `fitParts` backs off until the whole assembly fits.
   * Items without modelled parts keep the station view. Null while the clearance outline waits for the page's hull.
   */
  function framePose(step: FleetWalkStep<S>): { p: Vec3; t: Vec3 } | null {
    const centre = stepCentroid(step),
      { p } = step.station.cam;
    if (!centre) return step.station.cam;
    if (step.item.eye) return { p: step.item.eye, t: toVec3(centre) };
    // Approximate eye heights and display framing, not aircraft dimensions or operational clearances.
    const y = step.item.crouch ? (options.crouchY ?? options.groundY + 1.1) : p[1];
    const away = V(p[0] - centre.x, 0, p[2] - centre.z),
      distance = away.length();
    away.normalize();
    if (step.item.fitParts) {
      const bounds = stepBounds(step);
      if (bounds) {
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const radius = sphere.radius + sphere.center.distanceTo(centre);
        const halfAngle = Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) * Math.min(1, CAMERA_FIT_ASPECT));
        // Approximate display margin for the toolbar, captions and the entire inspection assembly.
        const required = (radius / Math.sin(halfAngle)) * 1.5;
        const horizontal = Math.max(distance, Math.sqrt(Math.max(0, required ** 2 - (y - centre.y) ** 2)));
        return { p: [centre.x + away.x * horizontal, y, centre.z + away.z * horizontal] as Vec3, t: toVec3(centre) };
      }
    }
    const r0 = Math.min(Math.max(distance, FRAME_DIST[0]), FRAME_DIST[1]);
    if (r0 < distance && !outline && options.hull?.pending()) return null;
    // from the framing distance back towards the station (which is clear of the airplane) until clear
    for (let r = r0; r < distance; r += BACK_STEP_M) {
      const eye = V(centre.x + away.x * r, y, centre.z + away.z * r);
      if (!underAirplane(eye)) return { p: toVec3(eye), t: toVec3(centre) };
    }
    return { p: [p[0], y, p[2]] as Vec3, t: toVec3(centre) };
  }
  const stepPose = (step: FleetWalkStep<S>) => framePose(step) ?? step.station.cam;
  /** The model at step `at` (−1: on the ramp): the ramp state with every step's `sim` up to and including `at`. */
  function simAt(prior: S, at: number, shown: FleetWalkStep<S>[] = steps) {
    const state = options.ramp(prior);
    for (let i = 0; i <= at && i < shown.length; i++) shown[i].item.sim?.(state);
    return state;
  }
  /** Parse saved progress; anything malformed, or naming no item of this walk, is no progress. */
  function parseProgress(raw: string | null): FleetWalkProgress | null {
    if (!raw) return null;
    try {
      const p = JSON.parse(raw) as Partial<FleetWalkProgress>;
      if (
        p?.v !== 1 ||
        typeof p.at !== "string" ||
        !steps.some((s) => s.item.id === p.at) ||
        typeof p.ms !== "number" ||
        !Number.isFinite(p.ms) ||
        p.ms < 0 ||
        !p.marks ||
        typeof p.marks !== "object" ||
        Array.isArray(p.marks)
      )
        return null;
      const ids = new Set(steps.map((s) => s.item.id)),
        marks: FleetWalkProgress["marks"] = {};
      for (const [id, mark] of Object.entries(p.marks))
        if (ids.has(id) && (mark === "ok" || mark === "skip")) marks[id] = mark;
      return { v: 1, at: p.at, marks, ms: p.ms, done: p.done === true };
    } catch {
      return null;
    }
  }
  function loadProgress() {
    try {
      return parseProgress(localStorage.getItem(progressKey));
    } catch {
      return null;
    }
  }
  function saveProgress(progress: FleetWalkProgress | null) {
    try {
      if (progress) localStorage.setItem(progressKey, JSON.stringify(progress));
      else localStorage.removeItem(progressKey);
    } catch {
      /* Blocked storage must not stop the study walk. */
    }
  }
  /** The `walk` query value as a station number, or null. */
  function walkParam(search: string) {
    const value = new URLSearchParams(search).get("walk");
    if (value === null) return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= data.stations.length ? n : value === "" ? 1 : null;
  }
  return {
    data,
    copy: fleetWalkCopy(data),
    steps,
    walkSteps,
    stepOf,
    progressKey,
    stepParts,
    stepSide: fleetStepSide,
    inCatalogue,
    nameCentres,
    stepCentroid,
    stationCentroid,
    sightLine,
    emphasisPoints,
    stepBounds,
    framePose,
    stepPose,
    underAirplane,
    simAt,
    rampState: options.ramp,
    hull: options.hull,
    parseProgress,
    loadProgress,
    saveProgress,
    walkParam,
  };
}
export type FleetWalk<S> = ReturnType<typeof createFleetWalk<S>>;
