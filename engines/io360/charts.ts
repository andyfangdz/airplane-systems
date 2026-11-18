import type { SeaLevelLine } from "../types";

export const line = (rpm: number, hp20: number, hp28: number, ftMap: number, hp20k: number): SeaLevelLine => ({
  rpm,
  a: [20, hp20],
  b: [28, hp28],
  ftMap,
  hp20k,
});
export const flows = (rows: [number, number][]) => rows.map(([rpm, base]) => ({ rpm, base }));
