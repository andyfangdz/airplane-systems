"use client";
/**
 * The standalone engine page: the 3D engine with an engine monitor over it, and a panel with the controls, the
 * environment, failures, a cylinder-pressure chart and the documented numbers. The simulation runs on animation
 * frames (store.ts); React reads it through low-rate snapshots.
 */
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { ENGINES, engineById } from "@/engines";
import { Picker } from "../Picker";
import { airplaneLinks, engineEntries, engineSub, partEntries } from "../pickerEntries";
import { useView } from "@/lib/view";
import { simFor, useEngineLoop, type EngineSim } from "./store";
import { EnginePanel } from "./EnginePanel";
import { Monitor, Flags } from "./Monitor";
import "./engine.css";

const Scene = dynamic(() => import("./EngineScene"), { ssr: false, loading: () => <div /> });

const SUN = (
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
  </>
);
const MOON = <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />;

function Toolbar({ sim }: { sim: EngineSim }) {
  const view = sim.useUi((x) => x.view),
    setView = sim.useUi((x) => x.setView);
  const toggles: [keyof typeof view, string, string][] = [
    ["xray", "X-ray", "See through the case and cylinders"],
    ["labels", "Labels", "Name the main parts"],
    ["prop", "Propeller", "Show the propeller"],
    ["slow", "Slow motion", "Turn the drawn crankshaft slowly enough to follow the four strokes"],
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

/** The toolbar's light/dark switch (also on the component pages). */
export function ThemeButton() {
  const theme = useView((x) => x.theme),
    setTheme = useView((x) => x.setTheme);
  const dark = theme === "dark";
  return (
    <button
      className="tb tb-theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
        {dark ? SUN : MOON}
      </svg>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

/** Follow the saved theme, else the system setting (the same key the airplane pages use). */
export function useTheme() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("sr20theme");
    } catch {}
    const os = window.matchMedia("(prefers-color-scheme: dark)");
    useView.getState().setTheme(saved === "light" || saved === "dark" ? saved : os.matches ? "dark" : "light", false);
  }, []);
}

export default function EngineApp({ id }: { id: string }) {
  const spec = engineById(id)!;
  const sim = simFor(spec);
  useEngineLoop(sim);
  useTheme();
  return (
    <div className="eng-app">
      <title>{`${spec.name} engine · Airplane Systems`}</title>
      <div className="brand eng-brand">
        <Picker
          current={{ name: spec.name, sub: engineSub(spec) }}
          kind="engine"
          groups={[
            { label: "Airplanes", entries: airplaneLinks() },
            { label: "Engines", entries: engineEntries(ENGINES, spec.id) },
            { label: "Components", entries: partEntries() },
          ]}
        />
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
      </div>
      <aside className="panel">
        <EnginePanel sim={sim} />
      </aside>
    </div>
  );
}
