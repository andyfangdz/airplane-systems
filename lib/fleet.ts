"use client";
/**
 * Airplane and system selection. The fleet itself is registered by aircraft/lazy.ts (the app: each airplane's light
 * meta, and a loader for the rest of it) or aircraft/index.ts (tests and scripts: every full definition), so airplane
 * modules (panels etc.) can import these helpers without importing each other.
 */
import { create } from "zustand";
import type { AircraftDef, AircraftMeta } from "@/aircraft/types";
import type { CameraPreset } from "./camera";
import type { Vec3 } from "./math";
import type { AircraftId, SysDef, SysId } from "./systems";
import { useView } from "./view";
import { setBuild } from "./build";

type Loader = () => Promise<AircraftDef>;
let FLEET: AircraftMeta[] = [];
let LOADERS: Partial<Record<AircraftId, Loader>> = {};
/** The airplanes whose code has loaded, by id (components re-render when one arrives). */
const useLoaded = create<Partial<Record<AircraftId, AircraftDef>>>(() => ({}));
/** The airplanes whose last load failed (the Loader offers a retry); cleared when a load starts again. */
const useFailed = create<Partial<Record<AircraftId, true>>>(() => ({}));
const pending = new Map<AircraftId, Promise<AircraftDef>>();
const waiting = new Map<AircraftId, ((def: AircraftDef) => void)[]>();

const isDef = (a: AircraftMeta | AircraftDef): a is AircraftDef => "Model" in a;

/**
 * Called once with every airplane, in picker order: aircraft/lazy.ts passes the metas and a loader per airplane;
 * aircraft/index.ts passes the full definitions, which count as loaded. It replaces any fleet registered before.
 */
export function registerFleet(entries: (AircraftMeta | AircraftDef)[], load: Partial<Record<AircraftId, Loader>> = {}) {
  FLEET = entries;
  LOADERS = load;
  pending.clear();
  waiting.clear();
  useLoaded.setState(Object.fromEntries(entries.filter(isDef).map((d) => [d.id, d])), true);
  useFailed.setState({}, true);
}
/** An airplane's meta (always at hand; its code may still be loading). */
export const aircraft = (id: AircraftId): AircraftMeta => FLEET.find((a) => a.id === id) ?? FLEET[0];
/** An airplane's full definition, once its code has loaded. */
export const loaded = (id: AircraftId): AircraftDef | undefined => useLoaded.getState()[id];
/** The meta of the airplane currently shown. */
export const useAircraft = () => aircraft(useView((v) => v.ac));
/** The full definition of the airplane currently shown; undefined while its code loads (the Loader shows meanwhile). */
export const useAircraftDef = () => {
  const ac = useView((v) => v.ac);
  return useLoaded((d) => d[ac]);
};
/** Did the airplane's last load fail? */
export const loadFailed = (id: AircraftId) => !!useFailed.getState()[id];
/** Did the last load of the airplane currently shown fail? */
export const useLoadFailed = () => {
  const ac = useView((v) => v.ac);
  return useFailed((f) => !!f[ac]);
};
/** Try loading the airplane currently shown again (the Loader's Retry). */
export const retryLoad = () => {
  loadAircraft(useView.getState().ac).catch(() => {}); // logged by loadAircraft
};

/**
 * Load an airplane's code (once; a failed load is tried again on the next call). Before the definition is published (so
 * before anything renders it), its `prepare` runs and then any callbacks queued by `whenLoaded`.
 */
export function loadAircraft(id: AircraftId): Promise<AircraftDef> {
  const have = loaded(id);
  if (have) return Promise.resolve(have);
  let p = pending.get(id);
  if (!p) {
    const load = LOADERS[id];
    if (!load) return Promise.reject(new Error(`No airplane "${id}" in the fleet`));
    if (useFailed.getState()[id]) useFailed.setState({ [id]: undefined });
    p = load().then(
      (def) => {
        pending.delete(id);
        def.prepare?.();
        const fns = waiting.get(id) ?? [];
        waiting.delete(id);
        for (const fn of fns) fn(def);
        useLoaded.setState({ [id]: def });
        return def;
      },
      (e: unknown) => {
        pending.delete(id);
        useFailed.setState({ [id]: true });
        console.error(`Loading the ${id} failed`, e);
        throw e;
      },
    );
    pending.set(id, p);
  }
  return p;
}

/** Run `fn` with the airplane's definition: now if its code has loaded, else (loading it) just before it is published. */
export function whenLoaded(id: AircraftId, fn: (def: AircraftDef) => void) {
  const have = loaded(id);
  if (have) return fn(have);
  waiting.set(id, [...(waiting.get(id) ?? []), fn]);
  loadAircraft(id).catch(() => {}); // logged by loadAircraft; the Loader offers a retry
}

export const sysOf = (def: AircraftMeta, id: SysId): SysDef => def.systems.find((s) => s.id === id) ?? def.systems[0];
export const hasSys = (def: AircraftMeta, id: unknown): id is SysId => def.systems.some((s) => s.id === id);

const remember = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
/** Keep the address bar on the view shown (/c172s/electrical), so a reload or a copied link opens it. */
export const showInUrl = (ac: AircraftId, sys: SysId) => {
  try {
    history.replaceState(null, "", `/${ac}/${sys}${location.search}`);
  } catch {}
};

/** Show a system of the current airplane, optionally flying the camera to it. */
export function selectSys(id: SysId, fly = true) {
  const v = useView.getState(),
    def = aircraft(v.ac);
  loaded(v.ac)?.onSelect?.(id);
  useView.setState({ sys: id, focus: null });
  if (fly) {
    const [p, t] = sysOf(def, id).cam;
    v.flyTo(p, t);
  }
  remember("sys:" + v.ac, id);
  showInUrl(v.ac, id);
}

/**
 * Switch airplane (to its overview, or to `sys` if it has one). Its code loads if it hasn't yet; the shell shows its
 * meta (rail, panel heading, camera) meanwhile and the loader says "Loading".
 */
export function selectAircraft(id: AircraftId, sys?: SysId) {
  const v = useView.getState(),
    code = loaded(id);
  if (v.ac !== id) {
    loaded(v.ac)?.onSelect?.("overview");
    setBuild(code ? "airframe" : "code");
  }
  if (!code) loadAircraft(id).catch(() => {}); // logged by loadAircraft; the Loader offers a retry
  const def = aircraft(id),
    to = sys && hasSys(def, sys) ? sys : "overview";
  code?.onSelect?.(to);
  useView.setState({ ac: id, sys: to, focus: null, ctrlFocus: "all", hover: null });
  const [p, t] = sysOf(def, to).cam;
  v.flyTo(p, t);
  remember("fleetAc", id);
  remember("sys:" + id, to);
  showInUrl(id, to);
}

/** Camera for the toolbar's Reset view. */
export function resetCam(): [Vec3, Vec3] {
  const v = useView.getState();
  return loaded(v.ac)?.resetCam?.() ?? sysOf(aircraft(v.ac), v.sys).cam;
}

/** Apply a URL preset to the same focus used by Reset view. */
export function applyCameraPreset(preset: CameraPreset) {
  const [p, t] = resetCam();
  useView.getState().flyTo(p, t, preset);
}
