"use client";
import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createPartInspection, distinctParts, type PartInspectionStore } from "./part-inspection";
import "./part-inspector.css";

const InspectionContext = createContext<PartInspectionStore | null>(null);

/** Key this provider by model id so a route change creates a fresh selection and registry. */
export function PartInspectionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPartInspection);
  return <InspectionContext value={store}>{children}</InspectionContext>;
}

export function usePartInspectionStore() {
  const store = useContext(InspectionContext);
  if (!store) throw new Error("Part inspection requires PartInspectionProvider");
  return store;
}

export function usePartInspection<T>(selector: (state: ReturnType<PartInspectionStore["getState"]>) => T): T {
  return useStore(usePartInspectionStore(), selector);
}

/** The same persistent explanation for a mesh click, a touch tap, or a keyboard selection from the index. */
export function PartInspector() {
  const parts = usePartInspection((state) => state.parts);
  const selected = usePartInspection((state) => state.selected);
  const select = usePartInspection((state) => state.select);
  const reveal = usePartInspection((state) => state.reveal);
  const [query, setQuery] = useState("");
  const explanation = useRef<HTMLDivElement>(null);
  const lastReveal = useRef(0);
  const searchId = useId();
  const all = distinctParts(parts);
  const matches = distinctParts(parts, query);
  const part = all.find((entry) => entry.name === selected);
  useLayoutEffect(() => {
    if (lastReveal.current === reveal) return;
    lastReveal.current = reveal;
    const target = explanation.current;
    const panel = target?.closest<HTMLElement>(".panel");
    if (!target || !panel || !selected) return;
    const targetRect = target.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    if (getComputedStyle(panel).overflowY === "auto") {
      panel.scrollTop += targetRect.top - panelRect.top - 12;
    } else {
      // Phones retain the model and, for pitot-static, its instrument strip above the note. Use their eventual
      // sticky edges rather than their current scroll positions. Scrolling never changes keyboard focus.
      const overlays = panel.closest(".eng-app")?.querySelectorAll<HTMLElement>(".eng-stage, .eng-foot") ?? [];
      let inset = 0;
      for (const overlay of overlays) {
        const style = getComputedStyle(overlay);
        if (style.position === "sticky")
          inset = Math.max(inset, overlay.getBoundingClientRect().height + (parseFloat(style.top) || 0));
      }
      window.scrollTo({ top: Math.max(0, scrollY + targetRect.top - inset - 12), behavior: "instant" });
    }
  }, [reveal, selected]);
  if (!all.length) return null;
  return (
    <section className="part-inspector" aria-label="Part inspector" data-part-inspector="">
      <details>
        <summary>
          Inspect a part <span>({all.length})</span>
        </summary>
        <label htmlFor={searchId}>Find a part</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or function"
        />
        <ul className="part-index" aria-label="Parts in this view">
          {matches.map((entry) => (
            <li key={entry.name}>
              <button type="button" aria-pressed={entry.name === selected} onClick={() => select(entry.name)}>
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
        {!matches.length && <p className="part-empty">No matching parts. Try another name or function.</p>}
      </details>
      <div ref={explanation} className="part-explanation" aria-live="polite" aria-atomic="true">
        {part && (
          <>
            <div className="part-explanation-head">
              <h3>{part.name}</h3>
              <button type="button" onClick={() => select(null)} aria-label="Clear selected part">
                Close
              </button>
            </div>
            <p>{part.note || "Highlighted in the model. Select another part to compare its position."}</p>
          </>
        )}
      </div>
    </section>
  );
}
