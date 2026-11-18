import type { EngineSpec } from "../types";
import { line, flows } from "../io360/charts";

export const M1A_RATED_HP = 180;
export const M1A_CHARTS = {
  id: "io360-m1a",
  performance: {
    kind: "lycoming",
    curve: "Lycoming curve 13549 (Fig. 3-2)",
    lines: [
      line(1800, 66, 113, 29.2, 61),
      line(2000, 74, 128, 29.15, 67),
      line(2200, 81, 142, 29.1, 75),
      line(2400, 90, 152, 29.1, 83),
      line(2700, 103, 172, 29, 91),
    ],
  },
  fuelFlow: {
    kind: "chart",
    curve: "Lycoming curve 12849-A (Fig. 3-1)",
    slope: 0.39,
    bestPower: flows([
      [2200, 12],
      [2400, 14],
      [2500, 15.2],
      [2600, 16.2],
      [2700, 17],
    ]),
    bestEconomy: flows([
      [1800, 3],
      [2000, 4.5],
      [2200, 6],
      [2400, 7],
      [2500, 8],
      [2600, 8.7],
      [2700, 9.3],
    ]),
  },
} satisfies Pick<EngineSpec, "id" | "performance" | "fuelFlow">;
