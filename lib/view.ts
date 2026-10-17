"use client";
/**
 * View state shared by every airplane: which airplane and system are shown, display toggles,
 * theme and camera requests. Pointer hover has its own store so pointer movement never notifies scene subscribers.
 * Each airplane keeps its own systems state in
 * its own store (see lib/simStore.ts), so switching airplanes keeps each one's switches as left.
 */
import { create } from "zustand";
import { useSyncExternalStore } from "react";
import type { CameraPreset } from "./camera";
import type { Spot } from "./spot";
import type { Vec3 } from "./math";
import { DEFAULT_AIRCRAFT, type AircraftId, type Chan, type SysId, type Theme } from "./systems";

export interface HoverInfo {
  name: string;
  note: string;
  color: string;
  x: number;
  y: number;
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

export const useAircraftHover = create<{ hover: HoverInfo | null; setHover: (hover: HoverInfo | null) => void }>(
  (set) => ({ hover: null, setHover: (hover) => set({ hover }) }),
);

/** The stacked phone layout (app/globals.css uses the same breakpoint): short full-width 3D view, page scrolls. */
export const NARROW_PX = 860;
export const narrowLayout = () =>
  typeof window !== "undefined" && (layoutQuery ?? window.matchMedia(`(max-width:${NARROW_PX}px)`)).matches;

// Parts and screens share one media-query listener, including when there are hundreds of label candidates.
const layoutListeners = new Set<() => void>();
let layoutQuery: MediaQueryList | undefined;
const notifyLayout = () => layoutListeners.forEach((notify) => notify());
const subscribeLayout = (notify: () => void) => {
  if (!layoutQuery) {
    layoutQuery = window.matchMedia(`(max-width:${NARROW_PX}px)`);
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
