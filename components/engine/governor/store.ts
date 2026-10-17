"use client";
/**
 * The governor page's state: controls, hub and failures in a zustand store (React reads them), the view toggles in
 * another; the simulation itself is one mutable `GovState`, advanced every animation frame and read by the scene in
 * `useFrame` and by panels through `useLiveSnapshot`.
 */
import { create } from "zustand";
import { createSimulationClock } from "@/lib/simulationClock";
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
import { createViewStore, useSimLoop } from "../sim";

export interface GovUi {
  controls: Controls;
  hub: Hub;
  failures: Failures;
  setControls: (p: Partial<Controls>) => void;
  setHub: (hub: Hub) => void;
  setFailures: (p: Partial<Failures>) => void;
}

export const spec = GOVERNOR;

/** The one simulation, kept across remounts. */
export const s: GovState = initialState(spec);

/** Drawn shaft angles, revolutions: they follow the shafts, or turn slowly in slow motion. */
export const anim = { crank: 0, gov: 0 };

/** `slow` draws the shafts turning slowly (the simulation runs at full speed). */
export const useGovView = createViewStore({ xray: true, labels: true, slow: true, paused: false });

export const useGov = create<GovUi>((set) => ({
  controls: defaultControls(),
  hub: "high",
  failures: noFailures(),
  setControls: (p) => set((x) => ({ controls: { ...x.controls, ...p } })),
  setHub: (hub) =>
    set(() => {
      // the other hub, with its blades where these were
      s.p = fillFor(spec, hub, s.beta);
      s.beta = bladeAngle(spec, hub, s.p);
      return { hub };
    }),
  setFailures: (p) => set((x) => ({ failures: { ...x.failures, ...p } })),
}));

/** Slow motion turns the drawn shafts at most this fast, rpm. */
const SLOW_RPM = 12;

export function stepGovernor(dt: number) {
  const ui = useGov.getState(),
    view = useGovView.getState();
  if (view.paused) return;
  step(spec, s, ui.controls, ui.hub, ui.failures, dt);
  const rpm = view.slow ? Math.min(s.rpm, SLOW_RPM) : s.rpm;
  anim.crank = (anim.crank + (rpm / 60) * dt) % 1;
  anim.gov = (anim.gov + ((rpm * spec.engine.driveRatio) / 60) * dt) % 1;
}

/** This retained accessory session owns its integration remainder across route mounts. */
export const governorClock = createSimulationClock(stepGovernor);
export const advance = (elapsed: number) => {
  if (!useGovView.getState().paused) governorClock.advance(elapsed);
};

/** Run the simulation on animation frames while the page is mounted. */
export const useGovLoop = () => useSimLoop(advance);
