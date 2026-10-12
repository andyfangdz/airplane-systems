"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNarrowLayout } from "@/lib/view";

/** Keep the active check and its controls with the model on phones. */
export function WalkSceneContent({ children, big }: { children: ReactNode; big: boolean }) {
  const narrow = useNarrowLayout();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("walk-scene")), []);
  return narrow && host
    ? createPortal(
        <div
          className={big ? "walk-big" : undefined}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            const row = event.target;
            if (
              (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
              row instanceof HTMLElement &&
              row.classList.contains("walk-current") &&
              row.scrollWidth > row.clientWidth
            )
              event.stopPropagation();
          }}
        >
          {children}
        </div>,
        host,
      )
    : children;
}
