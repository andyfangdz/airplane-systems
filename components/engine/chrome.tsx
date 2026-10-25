"use client";
/** Page chrome shared by the engine and component pages: toolbar toggles, Reset view and the saved-theme hook. */
import { useEffect } from "react";
import { create } from "zustand";
import { useView } from "@/lib/view";
import { ResetViewButton } from "../ui/chrome";

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
