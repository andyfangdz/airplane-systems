import { magFires } from "@/lib/anims";
import type { Elec, Sim } from "./model";

/** Starter power and magneto grounding also drive the engine animation (POH 7-31–7-34). */
export function engineOperation(s: Sim, E: Elec, rpm: number) {
  return {
    cranking: !s.eng.running && s.eng.key === "START" && E.starterPwr,
    leftMag: rpm > 100 && magFires("L", s.eng.key),
    rightMag: rpm > 100 && magFires("R", s.eng.key),
  };
}
