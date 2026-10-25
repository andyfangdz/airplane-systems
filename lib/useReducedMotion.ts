"use client";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const listeners = new Set<() => void>();
let query: MediaQueryList | undefined;
const notify = () => listeners.forEach((listener) => listener());

/** Also available to frame callbacks; the preference never changes simulation time or state. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  (query ?? window.matchMedia(QUERY)).matches;

function subscribe(listener: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  if (!query) {
    query = window.matchMedia(QUERY);
    query.addEventListener("change", notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      query?.removeEventListener("change", notify);
      query = undefined;
    }
  };
}

const serverSnapshot = () => false;
export const useReducedMotion = () => useSyncExternalStore(subscribe, prefersReducedMotion, serverSnapshot);
