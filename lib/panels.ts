"use client";
import { useSyncExternalStore } from "react";

type PanelSide = "systems" | "details";
const COLLAPSED_KEY = "panelsCollapsed";
const listeners = new Set<() => void>();
// Memory keeps the controls usable when storage is blocked; storage only remembers the preference.
let collapsedSides: string | undefined;
function readCollapsed() {
  if (collapsedSides === undefined) {
    try {
      collapsedSides = localStorage.getItem(COLLAPSED_KEY) ?? "";
    } catch {
      collapsedSides = "";
    }
  }
  return collapsedSides;
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function setPanelCollapsed(side: PanelSide, collapsed: boolean) {
  const next = new Set(readCollapsed().split(",").filter(Boolean));
  if (collapsed) next.add(side);
  else next.delete(side);
  collapsedSides = [...next].join(",");
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsedSides);
  } catch {}
  listeners.forEach((notify) => notify());
}

/** Both panels render open on the server, then restore the visitor's preference. */
export function useCollapsed(side: PanelSide): [boolean, () => void] {
  const sides = useSyncExternalStore(subscribe, readCollapsed, () => "");
  const collapsed = sides.split(",").includes(side);
  return [collapsed, () => setPanelCollapsed(side, !collapsed)];
}
