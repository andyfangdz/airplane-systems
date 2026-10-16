"use client";
/**
 * What every engine and component page runs on: the simulation loop and the view toggles' store. The 3D view around
 * them is `ComponentStage`; the toolbar buttons are chrome.tsx `ViewToggles`.
 */
import { useEffect } from "react";
import { create } from "zustand";

/**
 * Run a simulation on animation frames while the page is mounted, independent of the 3D view (which loads later, and
 * reads the simulation in `useFrame`). Each frame passes the time since the last, at most `maxDt` seconds: a slow frame
 * keeps real time up to there (a simulation splits a long step itself), but a pause such as a hidden tab isn't caught
 * up. The first frame's timestamp can come before the loop's start, so time never runs backwards.
 */
export function useSimLoop(advance: (dt: number) => void, maxDt: number) {
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      advance(Math.min(Math.max((now - last) / 1000, 0), maxDt));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [advance, maxDt]);
}

export type ViewState<V> = V & { set: (p: Partial<V>) => void };

/** A page's view toggles (x-ray, labels, slow motion, pause, …), with `set` to change some of them. */
export const createViewStore = <K extends string>(defaults: Record<K, boolean>) =>
  create<ViewState<Record<K, boolean>>>()((set) => ({
    ...defaults,
    set: (p) => set(p as Partial<ViewState<Record<K, boolean>>>),
  }));
