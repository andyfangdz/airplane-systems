"use client";

import type { ReactNode } from "react";
import { useNarrowLayout } from "@/lib/view";

/** Keep the station map available without displacing the current check on phones.
 * Key this by item id so moving to another check closes the phone disclosure. */
export function WalkMap({ children }: { children: ReactNode }) {
  const narrow = useNarrowLayout();
  return (
    <details className="walk-map-section" open={!narrow}>
      <summary>Station map</summary>
      {children}
    </details>
  );
}
