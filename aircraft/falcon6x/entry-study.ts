import { create } from "zustand";

export const useEntryStudy = create(() => ({ open: false }));

// Share one transition across the panel, molded stairs, handrail and lifting stay.
// Reversing the selection continues from the current pose.
const travelMs = 800;
let start = 0;
let from = 0;
let target = 0;
export function entryProgress(now = performance.now()) {
  const t = Math.min(1, Math.max(0, (now - start) / travelMs));
  return from + (target - from) * t * t * (3 - 2 * t);
}
useEntryStudy.subscribe((state, previous) => {
  if (state.open === previous.open) return;
  const now = performance.now();
  from = entryProgress(now);
  target = Number(state.open);
  start = now;
});
