import { expect, it } from "vitest";
import { CAT } from "@/aircraft/m20c/parts";

it.each([false, true])(
  "leaves the cabin panel label to its live screen while retaining tap-to-locate (narrow=%s)",
  (narrow) => {
    const panels = CAT.pinned("cabin").filter((part) => part.name === "Instrument panel");
    expect(panels).toHaveLength(1);
    expect(CAT.isPinned(panels[0], "cabin", narrow)).toBe(false);
  },
);
