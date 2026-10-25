"use client";
import { useSyncExternalStore } from "react";
import type { Dpr } from "@react-three/fiber";

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";
const DESKTOP_DPR: Dpr = [1, 2];
const TOUCH_DPR: Dpr = [1, 1.5];
const serverSnapshot = () => false;

function subscribeTouch(listener: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const touchSnapshot = () => typeof window.matchMedia === "function" && window.matchMedia(TOUCH_QUERY).matches;

/**
 * Keep high-DPI phones from shading four pixels per CSS pixel in these dense, transparent scenes. At 1.5 DPR the
 * drawing buffer has 44% fewer pixels than at 2; DOM labels and controls retain the screen's native resolution.
 */
export function useSceneRendering(): { dpr: Dpr } {
  const touch = useSyncExternalStore(subscribeTouch, touchSnapshot, serverSnapshot);
  return { dpr: touch ? TOUCH_DPR : DESKTOP_DPR };
}
