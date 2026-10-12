/** Mechanical shaft motion and independent magneto selection, POH 7-36.
 * IO-360-L2A IPC Fig 24 p. 49 lists two impulse Slick 4371 magnetos. The selected
 * documents do not establish a right-magneto START grounding jumper for this installation. */
import { magFires } from "@/lib/anims";
import type { Sim, Elec } from "./model";
export function engineTurning(s: Sim, E: Elec, rpm = s.eng.rpm) {
  return s.eng.running || (s.eng.mags === "START" && E.starterPwr) || rpm > 150;
}
export function magnetoOperating(s: Sim, E: Elec, mag: "L" | "R", rpm = s.eng.rpm) {
  return engineTurning(s, E, rpm) && magFires(mag, s.eng.mags, mag === "L" ? s.eng.fail.magL : s.eng.fail.magR);
}
