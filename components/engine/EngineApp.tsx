"use client";
/**
 * The standalone engine page: the 3D engine with an engine monitor over it, and a panel with the controls, the
 * environment, failures, a cylinder-pressure chart and the documented numbers. The simulation runs on animation
 * frames (store.ts); React reads it through low-rate snapshots.
 */
import dynamic from "next/dynamic";
import { ENGINES, engineById } from "@/engines";
import { COMPONENTS } from "@/engines/components";
import { Picker } from "../Picker";
import { airplaneLinks, componentEntries, engineEntries, engineSub } from "../pickerEntries";
import { ThemeButton } from "../ui/chrome";
import { useScenarioMarks } from "../ui/controls";
import { StageResetButton, useTheme, ViewToggles } from "./chrome";
import { simFor, useEngineLoop, type EngineSim } from "./store";
import { EnginePanel } from "./EnginePanel";
import { Monitor, Flags } from "./Monitor";
import { MotionState, StudyViews } from "./StudyViews";
import { PartInspectionProvider, PartInspector } from "./PartInspector";
import "./engine.css";

const Scene = dynamic(() => import("./EngineScene"), { ssr: false, loading: () => <div /> });

const TOGGLES = [
  ["xray", "X-ray", "See through the case and cylinders"],
  ["labels", "Labels", "Name the main parts"],
  ["prop", "Propeller", "Show the propeller"],
  ["slow", "Slow motion", "Turn the drawn crankshaft slowly enough to follow the four strokes"],
  ["paused", "Pause", "Freeze the simulation"],
] as const;

function Toolbar({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((x) => x.view),
    setView = sim.useUi((x) => x.setView);
  return (
    <div className="toolbar">
      <StudyViews sim={sim} />
      <div className="tb-group" role="group" aria-label="View">
        <ViewToggles items={TOGGLES} view={view} set={setView} />
      </div>
      <StageResetButton />
    </div>
  );
}

export default function EngineApp({ id }: { id: string }) {
  const spec = engineById(id)!;
  const sim = simFor(spec);
  useEngineLoop(sim);
  useTheme();
  useScenarioMarks();
  return (
    <PartInspectionProvider key={id}>
      <div className="eng-app">
        <title>{`${spec.name} engine · Airplane Systems`}</title>
        <div className="brand eng-brand">
          <Picker
            current={{ name: spec.name, sub: engineSub(spec) }}
            kind="engine"
            groups={[
              { label: "Airplanes", entries: airplaneLinks() },
              { label: "Engines", entries: engineEntries(ENGINES, spec.id) },
              { label: "Components", entries: componentEntries(COMPONENTS), compact: true },
            ]}
          />
          <ThemeButton />
        </div>
        <main className="stage eng-stage">
          <div className="eng-view">
            <Scene sim={sim} />
            <Toolbar sim={sim} />
          </div>
        </main>
        <div className="eng-foot">
          <Monitor sim={sim} />
          <Flags sim={sim} />
          <MotionState sim={sim} />
        </div>
        <aside className="panel">
          <PartInspector />
          <EnginePanel sim={sim} />
        </aside>
      </div>
    </PartInspectionProvider>
  );
}
