"use client";
/**
 * View state shared by every airplane: which airplane and system are shown, display toggles,
 * theme, camera requests and the hover tooltip. Each airplane keeps its own systems state in
 * its own store (see lib/simStore.ts), so switching airplanes keeps each one's switches as left.
 */
import { create } from "zustand";
import type { Vec3 } from "./math";
import type { AircraftId, Chan, SysId, Theme } from "./systems";

export interface HoverInfo { name: string; note: string; color: string; x: number; y: number }
export interface CamRequest { p: Vec3; t: Vec3; id: number }

export interface View {
  ac: AircraftId;
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
  hover: HoverInfo | null;
}

interface ViewStore extends View {
  set: (p: Partial<View>) => void;
  flyTo: (p: Vec3, t: Vec3) => void;
  setTheme: (t: Theme) => void;
  setHover: (h: HoverInfo | null) => void;
}

let camId = 0;
let focusTimer: ReturnType<typeof setTimeout> | undefined;

export const useView = create<ViewStore>((set) => ({
  ac: "sr20", sys: "overview", xray: true, labels: true, spin: false, focus: null, ctrlFocus: "all",
  theme: "light", cam: null, hover: null,
  set: (p) => set(p),
  flyTo: (p, t) => set({ cam: { p, t, id: ++camId } }),
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("sr20theme", theme); } catch {}
  },
  setHover: (hover) => set({ hover }),
}));

/** Highlight a part by name for a moment (used by "tap to locate" lists). */
export function flashFocus(name: string) {
  useView.setState({ focus: name });
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => useView.setState({ focus: null }), 2600);
}
