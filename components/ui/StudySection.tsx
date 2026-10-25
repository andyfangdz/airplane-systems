import type { ReactNode } from "react";
import "./study-section.css";

/** Keep operating controls in view while retaining the full explanation and cited reference material. */
export function StudySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="study-section">
      <summary>{title}</summary>
      <div className="study-section-body">{children}</div>
    </details>
  );
}

/** A breaker can be physically open even when its bus is powered; those are different conditions. */
export function BreakerState({ open, powered, trip = false }: { open: boolean; powered: boolean; trip?: boolean }) {
  const state = open ? (trip ? "Tripped" : "Pulled") : !powered ? "Unpowered" : null;
  return state ? <span className="breaker-state">{state}</span> : null;
}
