/** Source-specific preflight data and pure geometry/progress helpers shared by the non-Cirrus fleet. */
import * as THREE from "three";
import { specGeo, type Catalogue, type ShellSpec, type PartSpec } from "./catalogue";
import { CAMERA_FOV, CAMERA_FIT_ASPECT } from "./camera";
import { toVec3, V, type Vec3 } from "./math";
import { partCentre, partSide, type Side } from "./spot";
import type { AircraftId, SysId } from "./systems";

export interface FleetWalkItem<S = unknown> {
  id: string;
  text: string;
  standard: string;
  parts: string[];
  system: SysId;
  ref: string;
  /** Applicable supplement when an inspection differs from the base manual. */
  sourceUrl?: string;
  target?: string | Vec3;
  side?: "L" | "R" | "any";
  note?: string;
  why?: string;
  crouch?: boolean;
  /** Fit the complete highlighted assembly, preserving the separate marker anchor. */
  fitParts?: boolean;
  sim?: (s: S) => void;
}
export interface FleetWalkStation<S = unknown> {
  n: number;
  title: string;
  side?: "L" | "R";
  cam: { p: Vec3; t: Vec3 };
  map: [number, number];
  warning?: string;
  note?: string;
  items: FleetWalkItem<S>[];
}
export interface FleetWalkData<S = unknown> {
  id: AircraftId;
  short: string;
  source: string;
  sourceUrl: string;
  applicability: string;
  general: string;
  throughout: string[];
  next: string;
  stations: FleetWalkStation<S>[];
  /** A physical check is named explicitly when the scene cannot show or perform it. */
  missing: Record<string, string>;
}
export interface FleetWalkStep<S = unknown> {
  station: FleetWalkStation<S>;
  item: FleetWalkItem<S>;
}
export interface FleetWalkProgress {
  v: 1;
  at: string;
  marks: Record<string, "ok" | "skip">;
  ms: number;
  done: boolean;
}
/** Full parent transform, including fixed rake and nested propeller/gear rotations. */
export function fleetGroupMatrix(position: Vec3, rotation: Vec3 = [0, 0, 0]) {
  return new THREE.Matrix4().compose(
    V(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    V(1, 1, 1),
  );
}
export const fleetStepSide = <S>({ station, item }: FleetWalkStep<S>): Side => {
  const side = item.side ?? station.side;
  return side === "L" ? -1 : side === "R" ? 1 : 0;
};
export const fleetStationStart = <S>(steps: FleetWalkStep<S>[], n: number) => steps.findIndex((s) => s.station.n === n);
export const fleetTally = <S>(steps: FleetWalkStep<S>[], marks: FleetWalkProgress["marks"]) => ({
  ok: steps.filter((s) => marks[s.item.id] === "ok").length,
  skip: steps.filter((s) => marks[s.item.id] === "skip").length,
  open: steps.filter((s) => !marks[s.item.id]).length,
});
export const fleetWalkClock = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function createFleetWalk<S>(options: {
  data: FleetWalkData<S>;
  cat: Catalogue;
  /** Scene shells outside the fixed catalogue, such as hinged doors and the pivoting tail. */
  extraShells?: ShellSpec[];
  groundY: number;
  ramp: (prior: S) => S;
  /** Return each moving group's full ramp transform in airplane coordinates. */
  groupMatrix: (parent: string) => THREE.Matrix4 | null;
  /** Some airplanes (M20C) keep empennage shells and hinges in a whole-tail group. */
  surfaceMatrix?: (key: string) => THREE.Matrix4;
  shellMatrix?: (name: string) => THREE.Matrix4;
}) {
  const { data, cat } = options;
  const shells = [...cat.shells, ...(options.extraShells ?? [])];
  const steps = data.stations.flatMap((station) => station.items.map((item) => ({ station, item })));
  const progressKey = `${data.id}-walkaround`;
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
  function nameCentres(name: string, side: Side = 0) {
    const points: THREE.Vector3[] = [];
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
  function stepCentroid(step: FleetWalkStep<S>) {
    if (Array.isArray(step.item.target)) return V(...step.item.target);
    const names = step.item.target ? [step.item.target] : stepParts(step).shown;
    const points = names.flatMap((name) => nameCentres(name, fleetStepSide(step)));
    return points.length ? points.reduce((sum, p) => sum.add(p), V(0, 0, 0)).multiplyScalar(1 / points.length) : null;
  }
  let outline: THREE.Box3[] | null = null;
  function underAirplane(point: THREE.Vector3) {
    outline ??= [
      ...shells.map((shell) => {
        const geometry = specGeo(shell);
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return geometry
          .boundingBox!.clone()
          .applyMatrix4(options.shellMatrix?.(shell.name) ?? new THREE.Matrix4())
          .expandByScalar(0.25);
      }),
      ...cat.surfaces.map((surface) => {
        const geometry = specGeo(surface);
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return geometry
          .boundingBox!.clone()
          .translate(V(...surface.pivot))
          .applyMatrix4(options.surfaceMatrix?.(surface.key) ?? new THREE.Matrix4())
          .expandByScalar(0.25);
      }),
    ];
    return outline.some(
      (box) => point.x >= box.min.x && point.x <= box.max.x && point.z >= box.min.z && point.z <= box.max.z,
    );
  }
  function stepPose(step: FleetWalkStep<S>) {
    const centre = stepCentroid(step),
      { p } = step.station.cam;
    if (!centre) return step.station.cam;
    // Approximate eye heights and display framing, not aircraft dimensions or operational clearances.
    const y = step.item.crouch ? options.groundY + 1.1 : p[1];
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
    for (let r = Math.min(Math.max(distance, 1.2), 2.4); r < distance; r += 0.05) {
      const eye = V(centre.x + away.x * r, y, centre.z + away.z * r);
      if (!underAirplane(eye)) return { p: toVec3(eye), t: toVec3(centre) };
    }
    return { p: [p[0], y, p[2]] as Vec3, t: toVec3(centre) };
  }
  function simAt(prior: S, at: number) {
    const state = options.ramp(prior);
    for (let i = 0; i <= at && i < steps.length; i++) steps[i].item.sim?.(state);
    return state;
  }
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
  function walkParam(search: string) {
    const value = new URLSearchParams(search).get("walk");
    if (value === null) return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= data.stations.length ? n : value === "" ? 1 : null;
  }
  return {
    data,
    steps,
    progressKey,
    stepParts,
    inCatalogue,
    nameCentres,
    stepCentroid,
    stepBounds,
    stepPose,
    underAirplane,
    simAt,
    rampState: options.ramp,
    parseProgress,
    loadProgress,
    saveProgress,
    walkParam,
  };
}
