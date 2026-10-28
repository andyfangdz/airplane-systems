"use client";
/**
 * The page around one component simulation (/components/<id>), and the layout it shares with the flight data replays
 * (/fdr/<id>): the picker heading the panel column, the 3D view with a toolbar (the page's toggles, then Reset view),
 * an optional readout over the foot of the view, and the panel. The theme switch sits in the picker's corner.
 * The layout is the engine page's (engine.css).
 */
import { useState, type ReactNode } from "react";
import { ENGINES } from "@/engines";
import { COMPONENTS, componentById } from "@/engines/components";
import { FDR_REPLAYS } from "@/fdr";
import { useNarrowLayout } from "@/lib/view";
import { Picker, type PickerEntry } from "../Picker";
import { airplaneLinks, componentEntries, engineEntries, replayEntries } from "../pickerEntries";
import { ModelSizeToggle, ThemeButton } from "../ui/chrome";
import { useScenarioMarks } from "../ui/controls";
import { StageResetButton, useTheme } from "./chrome";
import { PartInspectionProvider } from "./PartInspector";
import "./engine.css";

export interface ShellParts {
  /** The 3D view (a Canvas, loaded with `next/dynamic` and `ssr: false`). */
  scene: ReactNode;
  /** The view's toggles, grouped before Reset view (chrome.tsx `Toggle`). */
  toolbar?: ReactNode;
  /** Readouts over the bottom of the view. */
  foot?: ReactNode;
  panel: ReactNode;
}

/** The picker's groups on a simulation page, marking the one shown. */
export const simulationGroups = (current: { component?: string; replay?: string }) => [
  { label: "Airplanes", entries: airplaneLinks() },
  { label: "Engines", entries: engineEntries(ENGINES) },
  { label: "Components", entries: componentEntries(COMPONENTS, current.component), compact: true },
  { label: "Flight data", entries: replayEntries(FDR_REPLAYS, current.replay), compact: true },
];

export function SimulationShell({
  id,
  current,
  kind,
  groups,
  scene,
  toolbar,
  foot,
  panel,
}: ShellParts & {
  id: string;
  current: { name: string; sub: string };
  kind: "component" | "replay";
  groups: { label: string; entries: PickerEntry[]; compact?: boolean }[];
}) {
  const narrow = useNarrowLayout();
  const [reading, setReading] = useState(false);
  useTheme();
  useScenarioMarks();
  return (
    <PartInspectionProvider key={id}>
      <div className={`eng-app component-app${reading ? " reading-space" : ""}`}>
        <title>{`${current.name} · Airplane Systems`}</title>
        <div className="brand eng-brand">
          <Picker current={{ name: current.name, sub: current.sub }} kind={kind} groups={groups} />
          <ThemeButton />
        </div>
        <main className="stage eng-stage" id="component-model-view">
          <div className="eng-view">
            {scene}
            <div className="toolbar">
              {toolbar && (
                <div className="tb-group" role="group" aria-label="View">
                  {toolbar}
                </div>
              )}
              <StageResetButton />
            </div>
            {narrow && (
              <ModelSizeToggle
                collapsed={reading}
                controls="component-model-view"
                onClick={() => setReading(!reading)}
              />
            )}
          </div>
        </main>
        {foot && <div className="eng-foot">{foot}</div>}
        <aside className="panel">{panel}</aside>
      </div>
    </PartInspectionProvider>
  );
}

export function ComponentShell({ id, ...parts }: ShellParts & { id: string }) {
  return (
    <SimulationShell
      id={id}
      current={componentById(id)!}
      kind="component"
      groups={simulationGroups({ component: id })}
      {...parts}
    />
  );
}
