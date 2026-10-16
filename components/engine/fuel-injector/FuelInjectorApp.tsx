"use client";
/**
 * The fuel injection page: the RSA system cut away in 3D over an engine monitor, and a panel with the engine's
 * controls, what each part is doing, the nozzle-pressure chart, failures and the documents. It runs its own IO-390
 * simulation (store.ts), separate from the IO-390 engine page's.
 */
import dynamic from "next/dynamic";
import { IO390 } from "@/engines/io390/spec";
import { ComponentShell } from "../ComponentShell";
import { ViewToggles } from "../chrome";
import { Flags, Monitor } from "../Monitor";
import { simFor, useEngineLoop, type EngineSim } from "../store";
import { InjectorPanel } from "./InjectorPanel";
import "./injector.css";

const Scene = dynamic(() => import("./InjectorScene"), { ssr: false, loading: () => <div /> });

const ID = "fuel-injector";

const TOGGLES = [
  ["xray", "X-ray", "See through the housings"],
  ["labels", "Labels", "Name the main parts"],
  ["paused", "Pause", "Freeze the simulation"],
] as const;

function Toggles({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((x) => x.view),
    setView = sim.useUi((x) => x.setView);
  return <ViewToggles items={TOGGLES} view={view} set={setView} />;
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
  const sim = simFor(IO390, `component:${ID}`);
  useEngineLoop(sim);
  return (
    <ComponentShell
      id={ID}
      scene={
        <>
          <Scene sim={sim} />
          <Legend />
        </>
      }
      toolbar={<Toggles sim={sim} />}
      foot={
        <>
          <Monitor sim={sim} />
          <Flags sim={sim} />
        </>
      }
      panel={<InjectorPanel sim={sim} />}
    />
  );
}
