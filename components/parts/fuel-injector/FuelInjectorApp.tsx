"use client";
/**
 * The fuel injection page: the RSA system cut away in 3D over an engine monitor, and a panel with the engine's
 * controls, what each part is doing, the nozzle-pressure chart, failures and the documents. It runs its own IO-390
 * simulation (store.ts), separate from the IO-390 engine page's.
 */
import dynamic from "next/dynamic";
import { ENGINES } from "@/engines";
import { IO390 } from "@/engines/io390/spec";
import { partById } from "@/parts";
import { Picker } from "@/components/Picker";
import { airplaneLinks, engineEntries, partEntries } from "@/components/pickerEntries";
import { ThemeButton, useTheme } from "@/components/engine/EngineApp";
import { Flags, Monitor } from "@/components/engine/Monitor";
import { simFor, useEngineLoop, type EngineSim } from "@/components/engine/store";
import { InjectorPanel } from "./InjectorPanel";
import "@/components/engine/engine.css";
import "./injector.css";

const Scene = dynamic(() => import("./InjectorScene"), { ssr: false, loading: () => <div /> });

const ID = "fuel-injector";

function Toolbar({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((x) => x.view),
    setView = sim.useUi((x) => x.setView);
  const toggles: ["xray" | "labels" | "paused", string, string][] = [
    ["xray", "X-ray", "See through the housings"],
    ["labels", "Labels", "Name the main parts"],
    ["paused", "Pause", "Freeze the simulation"],
  ];
  return (
    <div className="toolbar">
      {toggles.map(([k, t, title]) => (
        <button
          key={k}
          className="tb"
          title={title}
          aria-pressed={!!view[k]}
          onClick={() => setView({ [k]: !view[k] })}
        >
          {t}
        </button>
      ))}
      <ThemeButton />
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["inj-inlet-air", "Inlet air pressure"],
    ["inj-venturi", "Venturi suction"],
    ["inj-unmetered", "Unmetered fuel"],
    ["inj-metered", "Metered fuel"],
    ["inj-nozzle", "Nozzle pressure"],
  ];
  return (
    <ul className="inj-legend" aria-label="Pressure colours">
      {items.map(([c, t]) => (
        <li key={c}>
          <i className={c} />
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function FuelInjectorApp() {
  const part = partById(ID)!;
  const sim = simFor(IO390, `part:${ID}`);
  useEngineLoop(sim);
  useTheme();
  return (
    <div className="eng-app">
      <title>{`${part.name} · Airplane Systems`}</title>
      <div className="brand eng-brand">
        <Picker
          current={{ name: part.name, sub: part.sub }}
          kind="component"
          groups={[
            { label: "Airplanes", entries: airplaneLinks() },
            { label: "Engines", entries: engineEntries(ENGINES) },
            { label: "Components", entries: partEntries(ID) },
          ]}
        />
      </div>
      <main className="stage eng-stage">
        <div className="eng-view">
          <Scene sim={sim} />
          <Toolbar sim={sim} />
          <Legend />
        </div>
      </main>
      <div className="eng-foot">
        <Monitor sim={sim} />
        <Flags sim={sim} />
      </div>
      <aside className="panel">
        <InjectorPanel sim={sim} part={part} />
      </aside>
    </div>
  );
}
