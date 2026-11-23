import { create } from "zustand";
import { D2R } from "@/lib/math";

export type FlaperonPose = "neutral" | "lift" | "left" | "right";
export const useFlaperonStudy = create<{ pose: FlaperonPose }>(() => ({ pose: "neutral" }));

// Schematic deflection for comparing motion. Both hinge axes point toward their respective wingtips.
const deflection = 20 * D2R;
const angles = {
  neutral: { ailL: 0, ailR: 0 },
  lift: { ailL: -deflection, ailR: deflection },
  left: { ailL: deflection, ailR: deflection },
  right: { ailL: -deflection, ailR: -deflection },
};

export function surfaceAngle(key: string) {
  return key === "ailL" || key === "ailR" ? angles[useFlaperonStudy.getState().pose][key] : 0;
}
