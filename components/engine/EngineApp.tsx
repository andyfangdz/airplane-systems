"use client";
/**
 * The standalone engine page: the 3D engine with an engine monitor over it, and a panel with the controls, the
 * environment, failures, a cylinder-pressure chart and the documented numbers. The simulation runs on animation
 * frames (store.ts); React reads it through low-rate snapshots.
 */
import dynamic from "next/dynamic";
import { useCollapsed } from "@/lib/panels";
import { ENGINES, engineById } from "@/engines";
import { COMPONENTS } from "@/engines/components";
import { FDR_REPLAYS } from "@/fdr";
import { Picker } from "../Picker";
import { airplaneLinks, componentEntries, engineEntries, engineSub, replayEntries } from "../pickerEntries";
import { ThemeButton } from "../ui/chrome";
import { useScenarioMarks } from "../ui/controls";
import { ModelPanelToggle, useTheme } from "./chrome";
import { simFor, useEngineLoop } from "./store";
import { EngineToolbar } from "./EngineToolbar";
import { EnginePanel } from "./EnginePanel";
import { EngineMonitorPanel, Flags } from "./Monitor";
import { MotionState } from "./StudyViews";
import { PartInspectionProvider, PartInspector } from "./PartInspector";
import "./engine.css";

const Scene = dynamic(() => import("./EngineScene"), { ssr: false, loading: () => <div /> });

export default function EngineApp({ id }: { id: string }) {
  const spec = engineById(id)!;
  const sim = simFor(spec);
  const [collapsed, togglePanel] = useCollapsed("model-details");
  useEngineLoop(sim);
  useTheme();
  useScenarioMarks();
  return (
    <PartInspectionProvider key={id}>
      <div className="eng-app model-study" data-panel-collapsed={collapsed || undefined}>
        <title>{`${spec.name} engine · Airplane Systems`}</title>
        <div className="brand eng-brand">
          <Picker
            current={{ name: spec.name, sub: engineSub(spec) }}
            kind="engine"
            groups={[
              { label: "Airplanes", entries: airplaneLinks() },
              { label: "Engines", entries: engineEntries(ENGINES, spec.id) },
              { label: "Components", entries: componentEntries(COMPONENTS), compact: true },
              { label: "Flight data", entries: replayEntries(FDR_REPLAYS), compact: true },
            ]}
          />
          <ThemeButton />
        </div>
        <main className="stage eng-stage">
          <div className="eng-view">
            <Scene sim={sim} />
            <EngineToolbar sim={sim} />
            <ModelPanelToggle collapsed={collapsed} toggle={togglePanel} />
          </div>
        </main>
        <div className="eng-foot">
          <EngineMonitorPanel sim={sim} />
          <Flags sim={sim} />
          <MotionState sim={sim} />
        </div>
        <aside id="model-details" className="panel" hidden={collapsed}>
          <PartInspector />
          <EnginePanel sim={sim} />
        </aside>
      </div>
    </PartInspectionProvider>
  );
}
