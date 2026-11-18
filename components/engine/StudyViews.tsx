"use client";
import type { EngineView, EngineSim } from "./store";
import { groupsFor, type GroupId } from "./scene/parts";

/** These presets change presentation only; controls, failures and the engine clock stay untouched. */
interface StudyPreset {
  id: string;
  name: string;
  prop: boolean;
  xray: boolean;
  groups?: readonly GroupId[];
}
const ENGINE_VIEWS: readonly StudyPreset[] = [
  { id: "installed", name: "Installed engine", prop: true, xray: false },
  { id: "exterior", name: "Engine exterior", prop: false, xray: false },
  { id: "internals", name: "Engine internals", prop: false, xray: true },
];
const SYSTEM_VIEWS: readonly StudyPreset[] = [
  {
    id: "cycle",
    name: "Power cycle",
    prop: false,
    xray: true,
    groups: ["rotating", "cylinders", "valvetrain", "ignition"],
  },
  {
    id: "fuel",
    name: "Fuel path",
    prop: false,
    xray: true,
    groups: ["fuel", "induction", "cylinders", "turbo"],
  },
  { id: "ignition", name: "Ignition", prop: false, xray: true, groups: ["ignition", "cylinders", "rotating"] },
  { id: "oil", name: "Lubrication", prop: false, xray: true, groups: ["oil", "case", "rotating", "drives"] },
];

const PRESETS = [...ENGINE_VIEWS, ...SYSTEM_VIEWS];

function presetView(sim: EngineSim, preset: StudyPreset) {
  return {
    prop: preset.prop,
    xray: preset.xray,
    hidden: groupsFor(sim.spec)
      .filter((g) => preset.groups && !preset.groups.includes(g.id))
      .map((g) => g.id),
  };
}

function matches(view: EngineView, next: ReturnType<typeof presetView>) {
  return (
    view.prop === next.prop &&
    view.xray === next.xray &&
    view.hidden.length === next.hidden.length &&
    next.hidden.every((id) => view.hidden.includes(id))
  );
}

/** The Study picker follows the scene, including focus entered by double-tapping a mesh. */
export function currentStudy(sim: EngineSim, view: EngineView) {
  if (view.assembly?.detail?.kind === "linkage") return "cycle";
  if (view.blowUp && sim.spec.illustratedInstallation) return "assemblies";
  return PRESETS.find((preset) => matches(view, presetView(sim, preset)))?.id ?? "custom";
}

export function selectStudy(sim: EngineSim, id: string) {
  const { setView } = sim.useUi.getState();
  if (id === "assemblies" && sim.spec.illustratedInstallation) {
    setView({ blowUp: true, assembly: undefined, hidden: [], xray: false });
  } else {
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) setView({ ...presetView(sim, preset), blowUp: false, assembly: undefined });
  }
}

const option = (preset: StudyPreset) => (
  <option key={preset.id} value={preset.id}>
    {preset.name}
  </option>
);

export function StudyViews({ sim }: { sim: EngineSim }) {
  const study = sim.useUi(({ view }) => currentStudy(sim, view));
  return (
    <label className="eng-study">
      <span>Study</span>
      <select aria-label="Study view" value={study} onChange={(event) => selectStudy(sim, event.target.value)}>
        {study === "custom" && (
          <option value="custom" disabled>
            Custom view
          </option>
        )}
        <optgroup label="Whole engine">{ENGINE_VIEWS.map(option)}</optgroup>
        <optgroup label="Engine operation">{SYSTEM_VIEWS.map(option)}</optgroup>
        {sim.spec.illustratedInstallation && (
          <optgroup label="Disassembly">
            <option value="assemblies">Exploded assemblies</option>
          </optgroup>
        )}
      </select>
    </label>
  );
}

export function MotionState({ sim }: { sim: EngineSim }) {
  const slow = sim.useUi((x) => x.view.slow),
    thermal = sim.useUi((x) => x.view.thermal),
    paused = sim.useUi((x) => x.view.paused);
  if (!slow && thermal === 1 && !paused) return null;
  return (
    <p className="eng-motion-state" role="status">
      {paused
        ? "Simulation paused"
        : slow
          ? "Motion slowed; instruments in real time"
          : "Motion and instruments in real time"}
      {!paused && thermal !== 1 && `; temperatures ${thermal}× faster`}
    </p>
  );
}
