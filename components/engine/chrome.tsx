"use client";
/** Page chrome shared by the engine and component pages: toolbar toggles, Reset view and the saved-theme hook. */
import { useEffect } from "react";
import { create } from "zustand";
import { useView } from "@/lib/view";
import { useTouchClick } from "@/lib/useTouchClick";
import { Icon, ResetViewButton } from "../ui/chrome";

/** Keep the disclosure on the canvas edge so it is still reachable with the panel closed. */
export function ModelPanelToggle({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  const touchClick = useTouchClick();
  const label = collapsed ? "Show side panel" : "Hide side panel";
  return (
    <button
      {...touchClick}
      type="button"
      className="tb eng-panel-toggle"
      aria-controls="model-details"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      <Icon>
        <rect x="1.5" y="2" width="13" height="12" rx="1.5" />
        <path d="M10.5 2v12" />
        <path d={collapsed ? "m7.5 5.5-2.5 2.5 2.5 2.5" : "m5 5.5 2.5 2.5L5 10.5"} />
      </Icon>
      <span>Panel</span>
    </button>
  );
}

/** The 3D view's Reset view, registered by the page's ComponentStage while its canvas is mounted. */
export const useStageReset = create<{ reset: (() => void) | null }>(() => ({ reset: null }));

/** The toolbar's Reset view, for the page's 3D view. */
export function StageResetButton() {
  const reset = useStageReset((x) => x.reset);
  return <ResetViewButton disabled={!reset} onClick={() => reset?.()} />;
}

/** A toolbar toggle button. */
export function Toggle({
  on,
  title,
  onClick,
  children,
}: {
  on: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="tb" title={title} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/** One view toggle: the key it flips, its label and its tooltip. */
export type ToggleItem<K extends string> = readonly [key: K, label: string, title: string];

/** A row of toolbar toggles over a page's view settings. */
export function ViewToggles<K extends string>({
  items,
  view,
  set,
}: {
  items: readonly ToggleItem<K>[];
  view: { readonly [k in K]?: unknown };
  set: (p: { [k in K]?: boolean }) => void;
}) {
  return (
    <>
      {items.map(([k, label, title]) => (
        <Toggle key={k} on={!!view[k]} title={title} onClick={() => set({ [k]: !view[k] } as { [k in K]?: boolean })}>
          {label}
        </Toggle>
      ))}
    </>
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
