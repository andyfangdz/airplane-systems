"use client";
import { useEffect } from "react";

/** Route-owned RAF driver. Hidden time is paused; the runtime owns integration and catch-up policy. */
export function useSimulationLoop(advance: (dt: number) => void, maxDt = 1, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    let active = !document.hidden;
    const tick = (now: number) => {
      if (!active) return;
      advance(Math.min(Math.max((now - last) / 1000, 0), maxDt));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(raf);
      active = !document.hidden;
      last = performance.now();
      if (active) raf = requestAnimationFrame(tick);
    };
    if (active) raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [advance, maxDt, enabled]);
}
