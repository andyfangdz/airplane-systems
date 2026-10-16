"use client";
/**
 * A separate reversible study session and progress store for each airplane's walk (logic in fleet-walk.ts). Opening it
 * remembers the airplane's systems state, its animated values (`live`) and the view, camera framing included; closing it
 * puts all of them back exactly. While it is open the cabin items drive the model through their `sim` steps, and the
 * progress is saved (when storage allows) so a walk can be resumed.
 */
import { PerspectiveCamera } from "three";
import { createStore, type StoreApi, type UseBoundStore } from "zustand";
import { cameraFitDistance } from "./camera";
import { selectAircraft } from "./fleet";
import { toVec3 } from "./math";
import { view as scene } from "./registry";
import type { SimStore } from "./simStore";
import type { SysDef } from "./systems";
import { useView, type CamRequest, type View } from "./view";
import { fleetStationStart, type FleetWalk, type FleetWalkProgress, type FleetWalkStep } from "./fleet-walk";

export type FleetWalkPhase = "intro" | "resume" | "walk" | "done";
export interface FleetWalkState<S = unknown> {
  /** Immutable step list for the equipment fitted when this session opened. */
  steps: FleetWalkStep<S>[];
  phase: FleetWalkPhase;
  /** Completion survives returning to the items for review; only a new walk clears it. */
  done: boolean;
  /** Current step index into `steps`. */
  at: number;
  /** Station the intro's Begin goes to. */
  from: number;
  marks: FleetWalkProgress["marks"];
  /** Walking time banked before `since`, ms. */
  ms: number;
  /** performance.now() when the current timing run started; null while not walking. */
  since: number | null;
  /** Larger text, for use at the airplane. */
  big: boolean;
}
/** What the walk's `syncLive` gets with the step's model state. */
export interface FleetWalkSync<S> {
  /** Current step (−1: on the ramp). */
  at: number;
  steps: FleetWalkStep<S>[];
  /** The airplane state the walk opened from. */
  prior: S;
  /** Reached by stepping forward one item, so a motor (the flaps) can carry on from the previous step's position. */
  forward: boolean;
}
export interface FleetWalkController<S> {
  logic: FleetWalk<S>;
  systems: SysDef[];
  store: StoreApi<FleetWalkState<S>>;
  elapsed: (w: FleetWalkState<S>) => number;
  /** The steps of the open walk, and the airplane state it started from. */
  session: () => { steps: FleetWalkStep<S>[]; prior: S | null };
  /** Names of the parts a progressive build adds first for the walk (see `first` below). */
  first: () => Set<string>;
  checkpoint: () => void;
  open: (n?: number) => void;
  close: () => void;
  boot: (search: string) => void;
  begin: () => void;
  resume: () => void;
  reset: () => void;
  goStep: (at: number) => void;
  mark: (kind: "ok" | "skip") => void;
  setBig: (big: boolean) => void;
  /** Fly to the item's framing; one that waits for the page's hull keeps the station view and is framed once it is in. */
  frame: (step: FleetWalkStep<S>) => void;
  /** Forget a pending framing retry (another step, another screen, or the walk closed). */
  cancelFrame: () => void;
}
type ViewKeep = Pick<View, "sys" | "xray" | "labels" | "spin" | "ctrlFocus" | "focus" | "hover" | "spot" | "cam">;
/** Preserve nested live-object identities: animation functions may retain them. */
export function restoreFleetWalkLive(target: object, source: object) {
  const into = target as Record<string, unknown>;
  for (const key of Object.keys(into)) if (!(key in source)) delete into[key];
  for (const [key, value] of Object.entries(source)) {
    const current = into[key];
    if (value && typeof value === "object" && current && typeof current === "object")
      restoreFleetWalkLive(current, value);
    else into[key] = value;
  }
}
interface LiveReferences {
  ref: object;
  children: Record<string, LiveReferences>;
}
function captureReferences(ref: object): LiveReferences {
  return {
    ref,
    children: Object.fromEntries(
      Object.entries(ref)
        .filter(([, value]) => value && typeof value === "object")
        .map(([key, value]) => [key, captureReferences(value as object)]),
    ),
  };
}
/** Simulation ticks replace nested objects, so put the original references back before restoring their values. */
function restoreReferences(saved: LiveReferences) {
  for (const [key, child] of Object.entries(saved.children)) {
    (saved.ref as Record<string, unknown>)[key] = child.ref;
    restoreReferences(child);
  }
}
/** The camera as the user left it (the live orbit, which may have moved since the last request), else the last request. */
function framing(cam: CamRequest | null): CamRequest | null {
  const { camera, target } = scene;
  if (!camera || !target) return cam;
  if (!(camera instanceof PerspectiveCamera))
    return { p: toVec3(camera.position), t: toVec3(target), id: cam?.id ?? 0, exact: true };
  // Save before the viewport fit, so leaving the taller phone stage fits this pose only once.
  const p = camera.position.clone().sub(target).divideScalar(cameraFitDistance(camera.aspect)).add(target);
  return { p: toVec3(p), t: toVec3(target), id: cam?.id ?? 0, restore: true };
}
export function createFleetWalkStore<S, E, L extends object>(options: {
  logic: FleetWalk<S>;
  sim: UseBoundStore<StoreApi<SimStore<S, E>>>;
  live: L;
  systems: SysDef[];
  /** Stop flight/engine timers and set the model's ramp pose without starting or priming the engine. */
  resetLive: (s: S) => void;
  /** Demonstrate the selected item's cumulative physical pose, even after electrical power is turned off. */
  syncLive?: (s: S, step: FleetWalkSync<S>) => void;
}): FleetWalkController<S> {
  const { logic, sim, live, systems } = options;
  const id = logic.data.id;
  const store = createStore<FleetWalkState<S>>(() => ({
    steps: [],
    phase: "intro",
    done: false,
    at: 0,
    from: 1,
    marks: {},
    ms: 0,
    since: null,
    big: false,
  }));
  const bigKey = `${id}-walkaround-big`;
  /** What opening the walk changed, to put back on close. */
  let prior: { s: S; E: E; live: L; liveReferences: LiveReferences; view: ViewKeep } | null = null;
  const now = () => performance.now();
  const elapsed = (w: FleetWalkState<S>) => w.ms + (w.since === null ? 0 : now() - w.since);
  const setSim = (s: S) => sim.getState().update((draft) => Object.assign(draft as object, s));
  const session = () => ({ steps: store.getState().steps, prior: prior?.s ?? null });
  /**
   * The shown item's parts (its spot) or, before the walk begins, those of its starting station's items for the
   * equipment fitted; none while it is closed.
   */
  function first(): Set<string> {
    const { spot, walking } = useView.getState();
    if (spot) return new Set(spot.names);
    if (!walking) return new Set();
    const { from, steps } = store.getState();
    return new Set(steps.filter((x) => x.station.n === from).flatMap((x) => x.item.parts));
  }
  function checkpoint() {
    const w = store.getState(),
      step = w.steps[w.at];
    if (prior && step && (w.phase === "walk" || w.phase === "done"))
      logic.saveProgress({ v: 1, at: step.item.id, marks: w.marks, ms: Math.round(elapsed(w)), done: w.done });
  }
  /**
   * Open the walk: at station `n` (deep link `?walk=n`, after the intro), else offering to resume saved progress, else at
   * the intro.
   */
  function open(n?: number) {
    if (prior && useView.getState().walking) {
      if (n) {
        checkpoint();
        store.setState({ phase: "intro", from: n, since: null });
      }
      return;
    }
    if (useView.getState().ac !== id) selectAircraft(id);
    const v = useView.getState(),
      { s, E } = sim.getState();
    prior = {
      s,
      E,
      live: structuredClone(live),
      liveReferences: captureReferences(live),
      view: {
        sys: v.sys,
        xray: v.xray,
        labels: v.labels,
        spin: v.spin,
        ctrlFocus: v.ctrlFocus,
        focus: v.focus,
        hover: v.hover,
        spot: v.spot,
        cam: framing(v.cam),
      },
    };
    const steps = logic.walkSteps(s);
    const saved = n ? null : logic.loadProgress();
    const resume = saved && !saved.done ? steps.find((x) => x.item.id === saved.at) : undefined;
    let big = false;
    try {
      big = localStorage.getItem(bigKey) === "1";
    } catch {}
    store.setState({
      steps,
      phase: resume ? "resume" : "intro",
      done: false,
      at: 0,
      // offering to resume: the saved item's station (its parts are built first; Start over goes back to station 1)
      from: n ?? resume?.station.n ?? 1,
      marks: {},
      ms: 0,
      since: null,
      big,
    });
    useView.setState({
      walking: true,
      xray: true,
      labels: false,
      spin: false,
      ctrlFocus: "all",
      focus: null,
      hover: null,
      spot: null,
    });
    const ramp = logic.rampState(s);
    setSim(ramp);
    options.resetLive(ramp);
  }
  /**
   * Leave the walk: progress is saved, and the airplane state, its animated values and the view (camera framing, focus
   * and hover included) go back to what they were; only the display toggles when another airplane is now shown.
   */
  function close() {
    if (!prior) return;
    checkpoint();
    cancelFrame();
    store.setState({ since: null });
    const saved = prior;
    prior = null;
    const here = useView.getState().ac === id;
    sim.setState({ s: saved.s, E: saved.E });
    restoreReferences(saved.liveReferences);
    restoreFleetWalkLive(live, saved.live);
    const { sys, focus, hover, spot, cam, ...toggles } = saved.view;
    useView.setState({
      walking: false,
      spot: null,
      focus: null,
      hover: null,
      ...toggles,
      ...(here ? { sys, focus, hover, spot, cam } : {}),
    });
    // back to the user's own framing; with none recorded, the system's view
    if (here && !cam) useView.getState().flyTo(...(systems.find((s) => s.id === sys) ?? systems[0]).cam);
  }
  // switching to another airplane ends the walk; only this module's active walk can close it
  useView.subscribe((v) => {
    if (prior && v.walking && v.ac !== id) close();
  });
  /** Page load: `?walk=n` opens station n (and leaves the address bar); otherwise unfinished saved progress is offered. */
  function boot(search: string) {
    const n = logic.walkParam(search);
    if (n) {
      const query = new URLSearchParams(search);
      query.delete("walk");
      const rest = query.toString();
      try {
        history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
      } catch {}
      open(n);
    } else {
      const saved = logic.loadProgress();
      if (saved && !saved.done) open();
    }
  }
  /** Start walking at the intro's station, with no marks. */
  function begin() {
    if (!prior) return;
    const w = store.getState();
    store.setState({
      phase: "walk",
      done: false,
      at: Math.max(0, fleetStationStart(w.steps, w.from)),
      marks: {},
      ms: 0,
      since: now(),
    });
    checkpoint();
  }
  /** Carry on from the saved progress. */
  function resume() {
    if (!prior) return;
    const saved = logic.loadProgress(),
      at = saved ? store.getState().steps.findIndex((s) => s.item.id === saved.at) : -1;
    if (!saved || at < 0) return begin();
    store.setState({ phase: "walk", done: saved.done, at, marks: saved.marks, ms: saved.ms, since: now() });
    checkpoint();
  }
  /** Forget the saved progress and go back to the intro, with the airplane as found on the ramp. */
  function reset() {
    logic.saveProgress(null);
    store.setState({ phase: "intro", done: false, at: 0, from: 1, marks: {}, ms: 0, since: null });
    if (prior) setSim(logic.rampState(prior.s));
  }
  /** Go to step `at` (clamped). */
  function goStep(at: number) {
    const w = store.getState();
    if (!prior || (w.phase !== "walk" && w.phase !== "done")) return;
    store.setState({ phase: "walk", at: Math.max(0, Math.min(at, w.steps.length - 1)), since: w.since ?? now() });
    checkpoint();
  }
  /** Mark the current item and move on; the last item finishes the walk. */
  function mark(kind: "ok" | "skip") {
    const w = store.getState();
    if (!prior || w.phase !== "walk") return;
    const marks = { ...w.marks, [w.steps[w.at].item.id]: kind };
    if (w.at === w.steps.length - 1) {
      store.setState({ marks, phase: "done", done: true, ms: elapsed(w), since: null });
      checkpoint();
    } else {
      store.setState({ marks });
      goStep(w.at + 1);
    }
  }
  function setBig(big: boolean) {
    store.setState({ big });
    try {
      localStorage.setItem(bigKey, big ? "1" : "0");
    } catch {}
  }
  // stepping forward or back (or starting over) puts the model where that step leaves it, so a jump, a resume or a step
  // back shows the same airplane as walking there item by item
  store.subscribe((w, was) => {
    if (!prior || !useView.getState().walking || (w.at === was.at && w.phase === was.phase)) return;
    const on = w.phase === "walk" || w.phase === "done",
      at = on ? w.at : -1;
    const s = logic.simAt(prior.s, at, w.steps);
    setSim(s);
    options.syncLive?.(s, {
      at,
      steps: w.steps,
      prior: prior.s,
      forward: on && (was.phase === "walk" || was.phase === "done") && w.at === was.at + 1,
    });
  });

  /** The item framed from the station while it waits for the page's hull, and the camera state when it was framed. */
  let waiting: { step: FleetWalkStep<S>; moves: number; cam: number | undefined } | null = null;
  function frame(step: FleetWalkStep<S>) {
    const pose = logic.framePose(step);
    const { p, t } = pose ?? step.station.cam;
    useView.getState().flyTo(p, t);
    waiting = pose ? null : { step, moves: scene.moves, cam: useView.getState().cam?.id };
  }
  function cancelFrame() {
    waiting = null;
  }
  // the hull is in: frame the item that waited, unless the camera has been moved since (by the user or any request)
  logic.hull?.onSettled(() => {
    const w = waiting;
    waiting = null;
    if (!w || scene.moves !== w.moves || useView.getState().cam?.id !== w.cam) return;
    const { p, t } = logic.stepPose(w.step);
    useView.getState().flyTo(p, t);
  });
  return {
    logic,
    systems,
    store,
    elapsed,
    session,
    first,
    checkpoint,
    open,
    close,
    boot,
    begin,
    resume,
    reset,
    goStep,
    mark,
    setBig,
    frame,
    cancelFrame,
  };
}
