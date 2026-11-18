import { useId, useRef, type ReactNode } from "react";
import { useNarrowLayout } from "@/lib/view";
import { StageResetButton, ViewToggles } from "./chrome";
import { currentStudy, selectStudy, StudyViews } from "./StudyViews";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  assemblyAvailable,
  assemblyComponents,
  assemblyStations,
  canPairCrank,
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
  const linkage = detail?.kind === "linkage" ? detail : undefined;
  const cycle = sim.spec.illustratedInstallation && currentStudy(sim, view) === "cycle";
  const change = (detail: StudyDetail) => {
    if (focus) set({ assembly: { ...focus, detail } });
  };
  const back = () => {
    if (!open) set({ assembly: undefined });
    else if (focus && detail) set({ assembly: { id: focus.id, exploded: focus.exploded } });
    else if (focus) set({ assembly: undefined });
    else set({ blowUp: false });
  };
  const pair = (cylinder: LinkageCylinder) =>
    set({
      assembly: {
        ...(focus ?? { id: "shafts", exploded: false }),
        detail: { ...linkage, kind: "linkage", cylinder },
      },
    });
  const backLabel = !open
    ? "Whole power cycle"
    : (detail && parent?.name) || (focus ? "Part groups" : "Assemble engine");
  const backButton = (open || linkage) && (
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
  const cycleFocus = cycle && (
    <label className="eng-study">
      Focus
      <select
        aria-label="Power cycle focus"
        value={linkage?.cylinder ?? "system"}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "system") selectStudy(sim, "cycle");
          else pair(value === "all" ? "all" : Number(value));
        }}
      >
        <option value="system">Whole power cycle</option>
        <option value="all">Crankshaft + all cylinders</option>
        {sim.spec.geometry.cylinders.map(({ n }) => (
          <option key={n} value={n}>
            Crankshaft + cylinder {n}
          </option>
        ))}
      </select>
    </label>
  );
  const crankShortcut = focus && !detail && canPairCrank(focus.id, view.hidden) && (
    <button
      type="button"
      className="tb"
      onClick={() => pair(focus.id === "shafts" ? "all" : Number(focus.id.slice("cylinder-".length)))}
    >
      {focus.id === "shafts" ? "Show with cylinders" : "Show with crankshaft"}
    </button>
  );
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
  const study = <StudyViews sim={sim} />;
  const explodeEngine = sim.spec.illustratedInstallation && (!open || linkage) && (
    <button
      type="button"
      className="tb eng-explode-engine"
      aria-label="Explode engine"
      title="Separate the engine into part groups"
      onClick={() => selectStudy(sim, "assemblies")}
    >
      <span>
        Explode<span className="eng-explode-noun"> engine</span>
      </span>
    </button>
  );
  const settings = (
    <>
      <div className="tb-group" role="group" aria-label="View">
        <ViewToggles items={TOGGLES} view={{ ...view, xray: studyXray(view) }} set={set} />
      </div>
      <StageResetButton />
    </>
  );
  if (compact) {
    const action = crank || explodeButton || groupPicker || cycleFocus;
    return (
      <div className="toolbar eng-compact-toolbar">
        {backButton}
        {action || study}
        {!action && explodeEngine}
        <EngineOptions>
          {action && study}
          {action && explodeEngine}
          {linkage && cycleFocus}
          {focus && groupPicker}
          {memberPicker}
          {crankShortcut}
          {follow}
          {settings}
        </EngineOptions>
      </div>
    );
  }
  return (
    <div className="toolbar">
      {study}
      {explodeEngine}
      {(open || cycle) && (
        <div
          className="eng-assembly-nav"
          role="group"
          aria-label={cycle ? "Power cycle controls" : "Assembly controls"}
        >
          {backButton}
          {groupPicker}
          {memberPicker}
          {explodeButton}
          {crankShortcut}
          {cycleFocus}
          {crank}
          {follow}
        </div>
      )}
      {settings}
    </div>
  );
}
