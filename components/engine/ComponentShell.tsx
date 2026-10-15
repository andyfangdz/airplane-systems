"use client";
/**
 * The page around one component simulation (/components/<id>): the picker heading the panel column, the 3D view
 * with a toolbar (the page's toggles, then the theme), an optional readout over the foot of the view, and the panel.
 * The layout is the engine page's (engine.css).
 */
import type { ReactNode } from "react";
import { ENGINES } from "@/engines";
import { COMPONENTS, componentById } from "@/engines/components";
import { Picker } from "../Picker";
import { airplaneLinks, componentEntries, engineEntries } from "../pickerEntries";
import { ThemeButton, useTheme } from "./chrome";
import "./engine.css";

export function ComponentShell({
  id,
  scene,
  toolbar,
  foot,
  panel,
}: {
  id: string;
  /** The 3D view (a Canvas, loaded with `next/dynamic` and `ssr: false`). */
  scene: ReactNode;
  /** Toolbar buttons before the theme switch (chrome.tsx `Toggle`). */
  toolbar?: ReactNode;
  /** Readouts over the bottom of the view. */
  foot?: ReactNode;
  panel: ReactNode;
}) {
  const c = componentById(id)!;
  useTheme();
  return (
    <div className="eng-app">
      <title>{`${c.name} · Airplane Systems`}</title>
      <div className="brand eng-brand">
        <Picker
          current={{ name: c.name, sub: c.sub }}
          kind="component"
          groups={[
            { label: "Airplanes", entries: airplaneLinks() },
            { label: "Engines", entries: engineEntries(ENGINES), compact: true },
            { label: "Components", entries: componentEntries(COMPONENTS, id), compact: true },
          ]}
        />
      </div>
      <main className="stage eng-stage">
        <div className="eng-view">
          {scene}
          <div className="toolbar">
            {toolbar}
            <ThemeButton />
          </div>
        </div>
      </main>
      {foot && <div className="eng-foot">{foot}</div>}
      <aside className="panel">{panel}</aside>
    </div>
  );
}
