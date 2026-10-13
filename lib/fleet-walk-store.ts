"use client";
/** A separate reversible study session and progress store for each fleet airplane. */
import { createStore, type StoreApi, type UseBoundStore } from "zustand";
import { selectAircraft } from "./fleet";
import { toVec3 } from "./math";
import { view as scene } from "./registry";
import type { SimStore } from "./simStore";
import type { SysDef } from "./systems";
import { useView, type CamRequest, type View } from "./view";
import { fleetStationStart, type createFleetWalk, type FleetWalkProgress } from "./fleet-walk";

export type FleetWalkPhase = "intro" | "resume" | "walk" | "done";
export interface FleetWalkState {
  phase: FleetWalkPhase;
  done: boolean;
  at: number;
  from: number;
  marks: FleetWalkProgress["marks"];
  ms: number;
  since: number | null;
  big: boolean;
}
export interface FleetWalkController<S> {
  logic: ReturnType<typeof createFleetWalk<S>>;
  systems: SysDef[];
  store: StoreApi<FleetWalkState>;
  elapsed: (w: FleetWalkState) => number;
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
export function createFleetWalkStore<S, E, L extends object>(options: {
  logic: ReturnType<typeof createFleetWalk<S>>;
  sim: UseBoundStore<StoreApi<SimStore<S, E>>>;
  live: L;
  systems: SysDef[];
  /** Stop flight/engine timers and set the model's ramp pose without starting or priming the engine. */
  resetLive: (s: S) => void;
  /** Demonstrate the selected item's cumulative physical pose, even after electrical power is turned off. */
  syncLive?: (s: S, at: number) => void;
}): FleetWalkController<S> {
  const { logic, sim, live, systems } = options;
  const store = createStore<FleetWalkState>(() => ({
    phase: "intro",
    done: false,
    at: 0,
    from: 1,
    marks: {},
    ms: 0,
    since: null,
    big: false,
  }));
  const bigKey = `${logic.data.id}-walkaround-big`;
  let prior: { s: S; E: E; live: L; liveReferences: LiveReferences; view: ViewKeep } | null = null;
  const now = () => performance.now();
  const elapsed = (w: FleetWalkState) => w.ms + (w.since === null ? 0 : now() - w.since);
  const setSim = (s: S) => sim.getState().update((draft) => Object.assign(draft as object, s));
  function checkpoint() {
    const w = store.getState(),
      step = logic.steps[w.at];
    if (prior && step && (w.phase === "walk" || w.phase === "done"))
      logic.saveProgress({ v: 1, at: step.item.id, marks: w.marks, ms: Math.round(elapsed(w)), done: w.done });
  }
  const framing = (cam: CamRequest | null): CamRequest | null =>
    scene.camera && scene.target
      ? { p: toVec3(scene.camera.position), t: toVec3(scene.target), id: cam?.id ?? 0, exact: true }
      : cam;
  function open(n?: number) {
    if (prior && useView.getState().walking) {
      if (n) {
        checkpoint();
        store.setState({ phase: "intro", from: n, since: null });
      }
      return;
    }
    if (useView.getState().ac !== logic.data.id) selectAircraft(logic.data.id);
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
    const saved = n ? null : logic.loadProgress();
    let big = false;
    try {
      big = localStorage.getItem(bigKey) === "1";
    } catch {}
    store.setState({
      phase: saved && !saved.done ? "resume" : "intro",
      done: false,
      at: 0,
      from: n ?? 1,
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
  function close() {
    if (!prior) return;
    checkpoint();
    store.setState({ since: null });
    const saved = prior;
    prior = null;
    const here = useView.getState().ac === logic.data.id;
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
    if (here && !cam) useView.getState().flyTo(...(systems.find((s) => s.id === sys) ?? systems[0]).cam);
  }
  useView.subscribe((v) => {
    if (prior && v.walking && v.ac !== logic.data.id) close();
  });
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
  function begin() {
    if (!prior) return;
    store.setState({
      phase: "walk",
      done: false,
      at: Math.max(0, fleetStationStart(logic.steps, store.getState().from)),
      marks: {},
      ms: 0,
      since: now(),
    });
    checkpoint();
  }
  function resume() {
    if (!prior) return;
    const saved = logic.loadProgress(),
      at = saved ? logic.steps.findIndex((s) => s.item.id === saved.at) : -1;
    if (!saved || at < 0) return begin();
    store.setState({ phase: "walk", done: saved.done, at, marks: saved.marks, ms: saved.ms, since: now() });
    checkpoint();
  }
  function reset() {
    logic.saveProgress(null);
    store.setState({ phase: "intro", done: false, at: 0, from: 1, marks: {}, ms: 0, since: null });
  }
  function goStep(at: number) {
    const w = store.getState();
    if (!prior || (w.phase !== "walk" && w.phase !== "done")) return;
    store.setState({ phase: "walk", at: Math.max(0, Math.min(at, logic.steps.length - 1)), since: w.since ?? now() });
    checkpoint();
  }
  function mark(kind: "ok" | "skip") {
    const w = store.getState();
    if (!prior || w.phase !== "walk") return;
    const marks = { ...w.marks, [logic.steps[w.at].item.id]: kind };
    if (w.at === logic.steps.length - 1) {
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
  store.subscribe((w, was) => {
    if (!prior || !useView.getState().walking || (w.at === was.at && w.phase === was.phase)) return;
    const on = w.phase === "walk" || w.phase === "done",
      at = on ? w.at : -1;
    const s = logic.simAt(prior.s, at);
    setSim(s);
    options.syncLive?.(s, at);
  });
  return {
    logic,
    systems,
    store,
    elapsed,
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
  };
}
