import { useId, useRef, type ReactNode } from "react";
import { useNarrowLayout } from "@/lib/view";
import { StageResetButton, ViewToggles } from "./chrome";
import { StudyViews } from "./StudyViews";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  assemblyAvailable,
  assemblyComponents,
  assemblyStations,
  linkageCylinders,
  studyXray,
  type LinkageCylinder,
  type StudyDetail,
} from "./assembly-study";
import type { EngineSim } from "./store";

const TOGGLES = [
  ["xray", "X-ray", "See through the case and cylinders"],
  ["labels", "Labels", "Name the main parts"],
  ["prop", "Propeller", "Show the propeller"],
  ["slow", "Slow motion", "Turn the drawn crankshaft slowly enough to follow the four strokes"],
  ["paused", "Pause", "Freeze the simulation"],
] as const;

/** The native popover stays inside the visual viewport and dismisses on Escape or an outside tap. */
function EngineOptions({ children }: { children: ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = () => panel.current?.hidePopover();
  return (
    <>
      <button
        type="button"
        className="tb eng-options-trigger"
        popoverTarget={id}
        aria-label="Engine controls"
        aria-haspopup="dialog"
      >
        Controls <span aria-hidden="true">▾</span>
      </button>
      <div
        id={id}
        ref={panel}
        className="eng-options-sheet"
        popover="auto"
        role="dialog"
        aria-label="Engine controls"
        onChange={(e) => {
          if (e.target instanceof HTMLSelectElement) close();
        }}
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest("button")) close();
        }}
      >
        <div className="eng-options-heading">
          <strong>Engine controls</strong>
          <button type="button" className="tb" autoFocus>
            Done
          </button>
        </div>
        <div className="eng-options-body">{children}</div>
      </div>
    </>
  );
}

function CrankControl({
  sim,
  detail,
  change,
}: {
  sim: EngineSim;
  detail: Extract<StudyDetail, { kind: "linkage" }>;
  change: (detail: StudyDetail) => void;
}) {
  const live = useLiveSnapshot(sim.anim);
  const angle = Math.round(detail.angle ?? live.crank);
  return (
    <label className="eng-crank-control">
      Turn crank
      <input
        aria-label="Crankshaft angle"
        aria-valuetext={`${angle} degrees`}
        type="range"
        min={0}
        max={720}
        value={angle}
        onChange={(e) => change({ ...detail, angle: Number(e.target.value) })}
      />
      <output>{angle}°</output>
    </label>
  );
}

export function EngineToolbar({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((s) => s.view);
  const set = sim.useUi((s) => s.setView);
  const compact = useNarrowLayout();
  const open = !!(sim.spec.illustratedInstallation && view.blowUp);
  const stations = open ? assemblyStations(sim.spec).filter((s) => assemblyAvailable(s, view)) : [];
  const focus = view.assembly;
  const parent = stations.find((s) => s.id === focus?.id);
  const detail = focus?.detail;
  const component = detail?.kind === "component" ? detail : undefined;
  const exploded = component?.exploded ?? focus?.exploded;
  const components = focus ? assemblyComponents(sim.spec, focus.id) : [];
  const cylinders = focus ? linkageCylinders(sim.spec, focus.id, view.hidden) : [];
  const change = (detail: StudyDetail) => {
    if (focus) set({ assembly: { ...focus, detail } });
  };
  const back = () => {
    if (focus && detail) set({ assembly: { id: focus.id, exploded: focus.exploded } });
    else if (focus) set({ assembly: undefined });
    else set({ blowUp: false });
  };
  const pair = (cylinder: LinkageCylinder) =>
    change(detail?.kind === "linkage" ? { ...detail, cylinder } : { kind: "linkage", cylinder });
  const backLabel = (detail && parent?.name) || (focus ? "Part groups" : "Assemble engine");
  const backButton = open && (
    <button type="button" className="tb eng-study-back" aria-label={backLabel} title={backLabel} onClick={back}>
      <span aria-hidden="true">‹</span> <span className="eng-back-name">{backLabel}</span>
    </button>
  );
  const groupPicker = open && !detail && (
    <label className="eng-study">
      <select
        aria-label="Focus a part group"
        title="Choose a part group or double-tap it in the model"
        value={focus?.id ?? ""}
        onChange={(e) => {
          const next = stations.find((s) => s.id === e.target.value);
          if (next) set({ assembly: { id: next.id, exploded: false } });
        }}
      >
        <option value="" disabled>
          Focus a group…
        </option>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
  const memberPicker = components.length > 0 && (
    <label className="eng-study">
      <select
        aria-label="Focus a component"
        title="Choose a component or double-tap it in the model"
        value={component?.id ?? ""}
        onChange={(e) => {
          const next = components.find((c) => c.id === e.target.value);
          if (next) change({ kind: "component", id: next.id, exploded: false });
        }}
      >
        <option value="" disabled>
          Focus a component…
        </option>
        {components.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  const explodeButton = focus && detail?.kind !== "linkage" && (
    <button
      type="button"
      className="tb"
      onClick={() => {
        if (detail) change({ ...detail, exploded: !detail.exploded });
        else set({ assembly: { ...focus, exploded: !focus.exploded } });
      }}
    >
      {exploded ? "Assemble" : "Blow up"} {component ? "component" : "group"}
    </button>
  );
  const pairControl =
    cylinders.length > 0 &&
    (focus?.id === "shafts" || detail?.kind === "linkage" ? (
      <label className="eng-study">
        <select
          aria-label="Pair crankshaft with cylinder"
          value={detail?.kind === "linkage" ? detail.cylinder : ""}
          onChange={(e) => pair(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="" disabled>
            Pair with cylinder…
          </option>
          <option value="all">Crankshaft + all cylinders</option>
          {cylinders.map((c) => (
            <option key={c.n} value={c.n}>
              Crankshaft + cylinder {c.n}
            </option>
          ))}
        </select>
      </label>
    ) : (
      !detail && (
        <button type="button" className="tb" onClick={() => pair(cylinders[0].n)}>
          Show with crankshaft
        </button>
      )
    ));
  const crank = detail?.kind === "linkage" && <CrankControl sim={sim} detail={detail} change={change} />;
  const follow = detail?.kind === "linkage" && (
    <button
      type="button"
      className="tb"
      disabled={detail.angle === undefined}
      onClick={() => change({ ...detail, angle: undefined })}
    >
      Follow engine
    </button>
  );
  const start = sim.spec.illustratedInstallation && !open && (
    <button
      className="tb"
      type="button"
      title="Separate the engine into part groups. Double-tap a part to focus its group directly."
      onClick={() => set({ blowUp: true })}
    >
      Blow up
    </button>
  );
  const settings = (
    <>
      <StudyViews sim={sim} />
      <div className="tb-group" role="group" aria-label="View">
        {!compact && start}
        <ViewToggles items={TOGGLES} view={{ ...view, xray: studyXray(view) }} set={set} />
      </div>
      <StageResetButton />
    </>
  );
  if (compact)
    return (
      <div className="toolbar eng-compact-toolbar">
        {backButton}
        {start || crank || explodeButton || groupPicker}
        <EngineOptions>
          {focus && groupPicker}
          {memberPicker}
          {pairControl}
          {follow}
          {settings}
        </EngineOptions>
      </div>
    );
  return (
    <div className="toolbar">
      {open && (
        <div className="eng-assembly-nav" role="group" aria-label="Engine assembly study">
          {backButton}
          {groupPicker}
          {memberPicker}
          {explodeButton}
          {pairControl}
          {crank}
          {follow}
        </div>
      )}
      {settings}
    </div>
  );
}
