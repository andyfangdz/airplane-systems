"use client";
/**
 * What every engine and component page runs on: the simulation loop and the view toggles' store. The 3D view around
 * them is `ComponentStage`; the toolbar buttons are chrome.tsx `ViewToggles`.
 */
import { create } from "zustand";
export { useSimulationLoop as useSimLoop } from "@/lib/useSimulationLoop";

export type ViewState<V> = V & { set: (p: Partial<V>) => void };

/** A page's view toggles (x-ray, labels, slow motion, pause, …), with `set` to change some of them. */
export const createViewStore = <K extends string>(defaults: Record<K, boolean>) =>
  create<ViewState<Record<K, boolean>>>()((set) => ({
    ...defaults,
    set: (p) => set(p as Partial<ViewState<Record<K, boolean>>>),
  }));
