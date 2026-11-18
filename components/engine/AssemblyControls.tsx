import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  assemblyAvailable,
  assemblyComponents,
  assemblyStations,
  linkageCylinders,
  type StudyDetail,
} from "./assembly-study";
import type { EngineSim } from "./store";

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
    <>
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
      <button
        type="button"
        className="tb"
        disabled={detail.angle === undefined}
        onClick={() => change({ ...detail, angle: undefined })}
      >
        Follow engine
      </button>
    </>
  );
}

export function AssemblyControls({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((s) => s.view);
  const set = sim.useUi((s) => s.setView);
  const stations = assemblyStations(sim.spec).filter((s) => assemblyAvailable(s, view));
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
  const pair = (cylinder: number) => change({ kind: "linkage", cylinder });
  return (
    <div className="eng-assembly-nav" role="group" aria-label="Engine assembly study">
      <button type="button" className="tb" onClick={back}>
        <span aria-hidden="true">‹</span> {detail ? parent?.name : focus ? "Part groups" : "Assemble engine"}
      </button>
      {!detail && (
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
      )}
      {components.length > 0 && (
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
      )}
      {focus && detail?.kind !== "linkage" && (
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
      )}
      {cylinders.length > 0 &&
        (focus?.id === "shafts" ? (
          <label className="eng-study">
            <select
              aria-label="Pair crankshaft with cylinder"
              value={detail?.kind === "linkage" ? detail.cylinder : ""}
              onChange={(e) => pair(Number(e.target.value))}
            >
              <option value="" disabled>
                Pair with cylinder…
              </option>
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
        ))}
      {detail?.kind === "linkage" && <CrankControl sim={sim} detail={detail} change={change} />}
    </div>
  );
}
