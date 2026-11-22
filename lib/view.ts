"use client";
/**
 * View state shared by every airplane: which airplane and system are shown, display toggles,
 * theme and camera requests. Pointer hover has its own store so pointer movement never notifies scene subscribers.
 * Each airplane keeps its own systems state in
 * its own store (see lib/simStore.ts), so switching airplanes keeps each one's switches as left.
 */
import { create } from "zustand";
import { useSyncExternalStore } from "react";
import type * as THREE from "three";
import type { CameraPreset } from "./camera";
import type { Spot } from "./spot";
import type { Vec3 } from "./math";
import { DEFAULT_AIRCRAFT, type AircraftId, type Chan, type SysId, type Theme } from "./systems";
import { THEME_COLORS } from "./theme";

export interface HoverInfo {
  name: string;
  note: string;
  color: string;
  x: number;
  y: number;
}
export interface SelectedAnchor {
  object: THREE.Object3D;
  local: THREE.Vector3;
}
export interface SelectedPartInfo {
  name: string;
  note: string;
  color: string;
  /** Stage-relative click coordinates when picked directly on the 3D canvas. */
  x?: number;
  y?: number;
  /** 3D mesh and local hit point so the tooltip tracks the selected part as the camera or assembly moves. */
  anchor?: SelectedAnchor;
}
export interface CamRequest {
  preset?: CameraPreset;
  p: Vec3;
  t: Vec3;
  id: number;
  /** A pose already fitted to the viewport (e.g. a framing put back as the user left it): used as is. */
  exact?: boolean;
  /** Wait for the canvas to measure its stage before applying a saved framing. */
  restore?: boolean;
}

/** Identity of one mounted aircraft route; selecting a system keeps this owner. */
export interface AircraftSessionOwner {
  readonly aircraft: AircraftId;
  readonly token: symbol;
}

export interface View {
  session: AircraftSessionOwner | null;
  /** The exact mounted session whose geometry and scene have finished loading. */
  sceneReady: AircraftSessionOwner | null;
  ac: AircraftId;
  /** Navigation selection, reflected in the URL and system rail. */
  selectedSys: SysId;
  /** Scene filter; a walk may highlight another system without navigating. */
  sys: SysId;
  xray: boolean;
  labels: boolean;
  spin: boolean;
  /** Part name flashed by a "tap to locate" list. */
  focus: string | null;
  /** Flight-controls view: highlight one control channel. */
  ctrlFocus: Chan | "all";
  theme: Theme;
  cam: CamRequest | null;
  /** Guided walk-around: parts highlighted while everything else is dimmed. */
  spot: Spot | null;
  /** The airplane's guided walk-around is open (it replaces the system panel). */
  walking: boolean;
}

interface ViewStore extends View {
  set: (p: Partial<View>) => void;
  flyTo: (p: Vec3, t: Vec3, preset?: CameraPreset) => void;
  /** Apply a theme; `save` (the default) remembers it as the user's choice. */
  setTheme: (t: Theme, save?: boolean) => void;
}

export const useAircraftHover = create<{
  hover: HoverInfo | null;
  selected: SelectedPartInfo | null;
  setHover: (hover: HoverInfo | null) => void;
  setSelected: (selected: SelectedPartInfo | null) => void;
}>((set) => ({
  hover: null,
  selected: null,
  setHover: (hover) => set({ hover }),
  setSelected: (selected) => set({ selected }),
}));

/**
 * Position a hover/selected tooltip at the same below-right offset from `(x, y)` that hover uses,
 * flipping above `(x, y)` when it would run past the bottom edge and clamping inside `[8, size - 8]`.
 */
export function placeTipAtPoint(
  el: HTMLElement,
  x: number,
  y: number,
  boundsWidth: number,
  boundsHeight: number,
  originX = 0,
  originY = 0,
) {
  if (!boundsWidth || !boundsHeight) {
    el.style.maxHeight = "";
    el.style.left = `${Math.round(originX + x + 14)}px`;
    el.style.top = `${Math.round(originY + y + 14)}px`;
    return;
  }
  const maxH = Math.max(48, Math.floor(boundsHeight - 16));
  el.style.maxHeight = `${maxH}px`;
  const wd = el.offsetWidth;
  const ht = Math.min(el.offsetHeight, maxH);
  const left = Math.max(8, Math.min(x + 14, boundsWidth - wd - 8));
  const below = y + 14;
  const top = below + ht <= boundsHeight - 8 ? below : Math.max(8, Math.min(y - 14 - ht, boundsHeight - ht - 8));
  el.style.left = `${Math.round(originX + left)}px`;
  el.style.top = `${Math.round(originY + top)}px`;
}

/** Project a 3D world point into stage pixel coordinates, or null if behind the camera. */
export function projectToStage(
  world: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (!width || !height) return null;
  const projected = world.clone().project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z > 1) return null;
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
  };
}

/** The stacked phone layout (app/globals.css uses the same breakpoint): short full-width 3D view, page scrolls. */
export const NARROW_PX = 639;
export const NARROW_QUERY = `(max-width: ${NARROW_PX}px)`;
export const narrowLayout = () =>
  typeof window !== "undefined" && (layoutQuery ?? window.matchMedia(NARROW_QUERY)).matches;

// Parts and screens share one media-query listener, including when there are hundreds of label candidates.
const layoutListeners = new Set<() => void>();
let layoutQuery: MediaQueryList | undefined;
const notifyLayout = () => layoutListeners.forEach((notify) => notify());
const subscribeLayout = (notify: () => void) => {
  if (!layoutQuery) {
    layoutQuery = window.matchMedia(NARROW_QUERY);
    layoutQuery.addEventListener("change", notifyLayout);
  }
  layoutListeners.add(notify);
  return () => {
    layoutListeners.delete(notify);
    if (!layoutListeners.size) {
      layoutQuery?.removeEventListener("change", notifyLayout);
      layoutQuery = undefined;
    }
  };
};
const desktopLayout = () => false;
export const useNarrowLayout = () => useSyncExternalStore(subscribeLayout, narrowLayout, desktopLayout);

/** Phones: the page scrolls and the panel sits below the 3D view, so bring the view back up when it has scrolled away. */
export function revealStage() {
  const stage = document.querySelector(".stage");
  if (narrowLayout() && stage && stage.getBoundingClientRect().top < 0) stage.scrollIntoView({ block: "start" });
}

/** Phones: the 3D view sticks to the top while the panel scrolls under it; after picking a system from far down the
 *  panel, bring the new system's panel back to its start, just under the view. */
export function revealPanelStart() {
  const stage = document.querySelector(".stage"),
    panel = document.querySelector(".panel");
  if (!narrowLayout() || !stage || !panel) return;
  const gap = panel.getBoundingClientRect().top - stage.getBoundingClientRect().bottom;
  if (gap < 0) scrollBy({ top: gap });
}

let camId = 0;
let focusTimer: ReturnType<typeof setTimeout> | undefined;

export const useView = create<ViewStore>((set) => ({
  session: null,
  sceneReady: null,
  ac: DEFAULT_AIRCRAFT,
  selectedSys: "overview",
  sys: "overview",
  xray: true,
  labels: true,
  spin: false,
  focus: null,
  ctrlFocus: "all",
  theme: "light",
  cam: null,
  spot: null,
  walking: false,
  set: (p) => set(p),
  flyTo: (p, t, preset) => set({ cam: { p, t, preset, id: ++camId } }),
  setTheme: (theme, save = true) => {
    set({ theme });
    document.documentElement.setAttribute("data-theme", theme);
    // Keep Next's metadata contents stable for hydration; the app choice overrides the OS-media condition.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.media = meta.content === THEME_COLORS[theme] ? "all" : "not all";
    });
    if (save)
      try {
        localStorage.setItem("sr20theme", theme);
      } catch {}
  },
}));

// A locate flash belongs to the route that requested it; its timer must not survive replacement of that route.
useView.subscribe((next, previous) => {
  if (next.session === previous.session) return;
  clearTimeout(focusTimer);
  focusTimer = undefined;
});

/** Highlight a part by name for a moment (used by "tap to locate" lists). */
export function flashFocus(name: string) {
  const owner = useView.getState().session;
  useView.setState({ focus: name });
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    focusTimer = undefined;
    if (useView.getState().session === owner && useView.getState().focus === name) useView.setState({ focus: null });
  }, 2600);
}
