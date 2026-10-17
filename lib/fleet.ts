"use client";
/**
 * Airplane and system selection. Each airplane has its own route (app/(fleet)/<id>/), whose page imports only that
 * airplane's definition and mounts the shell (components/App.tsx) with it; the shell registers it here and provides it
 * to its components. Tests and scripts register every full definition by importing aircraft/index.ts. Airplane modules
 * (panels etc.) import these helpers without importing each other.
 */
import { createContext, useContext } from "react";
import type { AircraftDef, AircraftMeta } from "@/aircraft/types";
import type { CameraPreset } from "./camera";
import type { Vec3 } from "./math";
import type { AircraftId, SysDef, SysId } from "./systems";
import { useView } from "./view";

/** The airplanes this page has shown (on an airplane route, the route's own; in tests, the whole fleet), by id. */
const DEFS = new Map<AircraftId, AircraftDef>();

/** Make airplanes' definitions available to the helpers below (by the id in the view state). */
export function registerAircraft(...defs: AircraftDef[]) {
  for (const def of defs) DEFS.set(def.id, def);
}

/** A registered airplane's full definition. */
export function aircraft(id: AircraftId): AircraftDef {
  const def = DEFS.get(id);
  if (!def) throw new Error(`The ${id} is not registered on this page`);
  return def;
}

/** The airplane its route shows, for the shell's components (components/App.tsx provides it). */
export const AircraftContext = createContext<AircraftDef | null>(null);
/** The airplane shown, from the route: right from the first render, before the view state has caught up. */
export function useAircraft(): AircraftDef {
  const def = useContext(AircraftContext);
  if (!def) throw new Error("useAircraft() outside an airplane route");
  return def;
}

export const sysOf = (def: AircraftMeta, id: SysId): SysDef => def.systems.find((s) => s.id === id) ?? def.systems[0];
export const hasSys = (def: AircraftMeta, id: unknown): id is SysId => def.systems.some((s) => s.id === id);

const remember = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
/**
 * Keep the address bar on the view shown (/c172s/electrical), so a reload or a copied link opens it. The airplane's
 * route stays mounted (no navigation); Next's history state is kept so Back and Forward still work.
 */
export const showInUrl = (ac: AircraftId, sys: SysId) => {
  try {
    history.replaceState(history.state, "", `/${ac}/${sys}${location.search}`);
  } catch {}
};

/** Show a system of the current airplane, optionally flying the camera to it. */
export function selectSys(id: SysId, fly = true) {
  const v = useView.getState(),
    def = aircraft(v.ac);
  def.onSelect?.(id);
  useView.setState({ sys: id, focus: null });
  if (fly) {
    const [p, t] = sysOf(def, id).cam;
    v.flyTo(p, t);
  }
  remember("sys:" + v.ac, id);
  showInUrl(v.ac, id);
}

/**
 * Put an airplane in the view state, at its overview or at `sys` if it has one: what its route does when it mounts.
 * (Switching airplanes is a navigation to the other airplane's route: components/Fleet.tsx.)
 */
export function selectAircraft(id: AircraftId, sys?: SysId) {
  const v = useView.getState(),
    def = aircraft(id);
  if (v.ac !== id) DEFS.get(v.ac)?.onSelect?.("overview");
  const to = sys && hasSys(def, sys) ? sys : "overview";
  def.onSelect?.(to);
  useView.setState({ ac: id, sys: to, focus: null, ctrlFocus: "all", hover: null });
  const [p, t] = sysOf(def, to).cam;
  v.flyTo(p, t);
  remember("fleetAc", id);
  remember("sys:" + id, to);
  showInUrl(id, to);
}

/** Camera for the toolbar's Reset view. */
export function resetCam(): [Vec3, Vec3] {
  const v = useView.getState(),
    def = aircraft(v.ac);
  return def.resetCam?.() ?? sysOf(def, v.sys).cam;
}

/** Apply a URL preset to the same focus used by Reset view. */
export function applyCameraPreset(preset: CameraPreset) {
  const [p, t] = resetCam();
  useView.getState().flyTo(p, t, preset);
}
