"use client";
/**
 * The pitot-static page's state: what the user sets (the airplane's flight, the cockpit controls, the weather, the
 * installation, failures, the ramp test set) in a zustand store that React reads, the view toggles in another; the
 * system itself is one mutable `PSState`, advanced on its own clock and read by the scene in `useFrame` and by panels
 * through `useLiveSnapshot`.
 */
import { create } from "zustand";
import { createSimulationClock } from "@/lib/simulationClock";
import { PITOT_STATIC } from "@/engines/components/pitot-static/spec";
import {
  defaultTest,
  initialState,
  step,
  type Cockpit,
  type Controls,
  type Failures,
  type Inputs,
  type Mode,
  type Ports,
  type PSState,
  type TestSet,
  type Weather,
} from "@/engines/components/pitot-static/model";
import { scenarioById, scenarioInputs } from "@/engines/components/pitot-static/scenarios";
import { createViewStore, useSimLoop } from "../sim";

export const spec = PITOT_STATIC;

export interface PsUi extends Inputs {
  /** The set-up last started, for its note; cleared when the user switches mode. */
  scenario: string | null;
  setControls: (p: Partial<Controls>) => void;
  setCockpit: (p: Partial<Cockpit>) => void;
  setWeather: (p: Partial<Weather>) => void;
  setFailures: (p: Partial<Failures>) => void;
  setTest: (p: Partial<TestSet>) => void;
  setPorts: (ports: Ports) => void;
  /** Flying, or on the ramp with the test set: the airplane starts over, steady where the controls put it. */
  setMode: (mode: Mode) => void;
  /** Start a "Try" set-up. */
  start: (id: string) => void;
  /** Drain the static line's sump: only on the ground. */
  drainSump: () => void;
}

const FIRST = "cruise";
const first = scenarioInputs(scenarioById(FIRST)!);

/** The one system, kept across remounts. */
export const s: PSState = initialState(spec, first.setup);

/** Replace the system's state in place: the scene and snapshots hold this object. */
const restart = (next: PSState) => Object.assign(s, next);

export const inputsOf = (u: Inputs): Inputs => ({
  mode: u.mode,
  controls: u.controls,
  cockpit: u.cockpit,
  weather: u.weather,
  ports: u.ports,
  failures: u.failures,
  test: u.test,
});

/** `flow` draws the air moving through the openings and along the lines. */
export const usePsView = createViewStore({ xray: true, labels: true, flow: true, paused: false });

export const usePs = create<PsUi>((set, get) => ({
  ...first.then,
  scenario: FIRST,
  setControls: (p) => set((x) => ({ controls: { ...x.controls, ...p } })),
  setCockpit: (p) => set((x) => ({ cockpit: { ...x.cockpit, ...p } })),
  setWeather: (p) => set((x) => ({ weather: { ...x.weather, ...p } })),
  setFailures: (p) => set((x) => ({ failures: { ...x.failures, ...p } })),
  setTest: (p) => set((x) => ({ test: { ...x.test, ...p } })),
  setPorts: (ports) => set({ ports }),
  setMode: (mode) => {
    if (mode === get().mode) return;
    const next = { ...inputsOf(get()), mode, test: defaultTest() };
    restart(initialState(spec, next));
    clock.reset();
    set({ mode, test: next.test, scenario: null });
  },
  start: (id) => {
    const sc = scenarioById(id);
    if (!sc) return;
    const { setup, then } = scenarioInputs(sc);
    restart(initialState(spec, setup));
    clock.reset();
    set({ ...then, scenario: id });
  },
  drainSump: () => {
    if (!onGround(get())) return;
    set((x) => ({ failures: { ...x.failures, water: false } }));
  },
}));

/** On the ground and stopped, or on the ramp with the test set: the sump can be drained. */
export const onGround = (u: Pick<Inputs, "mode">) => u.mode === "test" || (s.h <= 0 && s.kcas < 1);

export function stepPitotStatic(dt: number) {
  if (usePsView.getState().paused) return;
  step(spec, s, inputsOf(usePs.getState()), dt);
}

/** This retained session owns its integration remainder across route mounts. */
export const clock = createSimulationClock(stepPitotStatic);
export const advance = (elapsed: number) => {
  if (!usePsView.getState().paused) clock.advance(elapsed);
};

/** Run the system on animation frames while the page is mounted. */
export const usePsLoop = () => useSimLoop(advance);
