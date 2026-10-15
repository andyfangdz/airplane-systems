"use client";
/**
 * The governor page's state: controls, hub, failures and view in a zustand store (React reads them); the simulation
 * itself is one mutable `GovState`, advanced every animation frame and read by the scene in `useFrame` and by panels
 * through `useLiveSnapshot`.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { GOVERNOR } from "@/engines/components/governor/spec";
import {
  bladeAngle,
  defaultControls,
  fillFor,
  initialState,
  noFailures,
  step,
  type Controls,
  type Failures,
  type GovState,
  type Hub,
} from "@/engines/components/governor/model";

export interface GovView {
  xray: boolean;
  labels: boolean;
  /** Draw the shafts turning slowly (the simulation runs at full speed). */
  slow: boolean;
  paused: boolean;
}

export interface GovUi {
  controls: Controls;
  hub: Hub;
  failures: Failures;
  view: GovView;
  setControls: (p: Partial<Controls>) => void;
  setHub: (hub: Hub) => void;
  setFailures: (p: Partial<Failures>) => void;
  setView: (p: Partial<GovView>) => void;
}

export const spec = GOVERNOR;

/** The one simulation, kept across remounts. */
export const s: GovState = initialState(spec);

/** Drawn shaft angles, revolutions: they follow the shafts, or turn slowly in slow motion. */
export const anim = { crank: 0, gov: 0 };

export const useGov = create<GovUi>((set) => ({
  controls: defaultControls(),
  hub: "high",
  failures: noFailures(),
  view: { xray: true, labels: true, slow: true, paused: false },
  setControls: (p) => set((x) => ({ controls: { ...x.controls, ...p } })),
  setHub: (hub) =>
    set(() => {
      // the other hub, with its blades where these were
      s.p = fillFor(spec, hub, s.beta);
      s.beta = bladeAngle(spec, hub, s.p);
      return { hub };
    }),
  setFailures: (p) => set((x) => ({ failures: { ...x.failures, ...p } })),
  setView: (p) => set((x) => ({ view: { ...x.view, ...p } })),
}));

/** Slow motion turns the drawn shafts at most this fast, rpm. */
const SLOW_RPM = 12;

export function advance(dt: number) {
  const ui = useGov.getState();
  if (ui.view.paused) return;
  const d = Math.min(Math.max(dt, 0), 0.1);
  step(spec, s, ui.controls, ui.hub, ui.failures, d);
  const rpm = ui.view.slow ? Math.min(s.rpm, SLOW_RPM) : s.rpm;
  anim.crank = (anim.crank + (rpm / 60) * d) % 1;
  anim.gov = (anim.gov + ((rpm * spec.engine.driveRatio) / 60) * d) % 1;
}

/** Run the simulation on animation frames while the page is mounted. */
export function useGovLoop() {
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      advance((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
