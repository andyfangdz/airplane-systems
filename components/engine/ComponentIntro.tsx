"use client";
import { useId, useState, type ReactNode } from "react";
import { useNarrowLayout } from "@/lib/view";
import { PartInspector } from "./PartInspector";

/** Keep background reading available without placing a long introduction ahead of phone controls. */
export function ComponentIntro({
  label = "Component simulation",
  source,
  children,
}: {
  /** What the page is, before its source. */
  label?: string;
  source: ReactNode;
  children: ReactNode;
}) {
  const narrow = useNarrowLayout();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="component-intro">
      <PartInspector />
      {narrow && (
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span> About this model
        </button>
      )}
      <div id={id} hidden={narrow && !open}>
        <div className="ref">
          {label} · {source}
        </div>
        {children}
      </div>
    </div>
  );
}
