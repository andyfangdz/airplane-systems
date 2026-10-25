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
const PRESETS: readonly StudyPreset[] = [
  { id: "installed", name: "Installed engine", prop: true, xray: false },
  { id: "internals", name: "Engine internals", prop: false, xray: true },
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

function presetView(sim: EngineSim, preset: (typeof PRESETS)[number]) {
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

export function StudyViews({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((x) => x.view),
    setView = sim.useUi((x) => x.setView);
  const current = PRESETS.find((preset) => matches(view, presetView(sim, preset)));
  return (
    <label className="eng-study">
      Study
      <select
        aria-label="Study view"
        value={current?.id ?? "custom"}
        onChange={(event) => {
          const preset = PRESETS.find((p) => p.id === event.target.value);
          if (preset) setView(presetView(sim, preset));
        }}
      >
        <option value="custom" disabled>
          Custom view
        </option>
        {PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
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
