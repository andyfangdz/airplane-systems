/** SR20 study walk (data in walkaround.ts) on the shared walk logic: its ramp state, moving groups and flap angle. */
import * as THREE from "three";
import { createFleetWalk, fleetGroupMatrix, type FleetWalkStep } from "@/lib/fleet-walk";
import { GROUND_Y } from "./geometry";
import { initialSim, type Sim } from "./model";
import { CAT, NOSE_CASTER, NOSE_GEAR, PROP } from "./parts";
import { CROUCH_Y, WALK_DATA } from "./walkaround";

/** Healthy study ramp state, retaining actual model fuel quantities and optional second ADAHRS configuration. */
export function rampState(prior: Sim): Sim {
  const s = structuredClone(initialSim);
  s.avx.dualAdahrs = prior.avx.dualAdahrs;
  s.fuel.qL = prior.fuel.qL;
  s.fuel.qR = prior.fuel.qR;
  s.pitot.oat = prior.pitot.oat;
  s.eng = { ...s.eng, running: false, key: "OFF", lever: 0, mix: 0 };
  s.elec = { ...s.elec, bat1: false, bat2: false, avionics: false, tBat: 0 };
  s.fuel.boost = false;
  s.flaps.cmd = 0;
  s.pitot.heat = false;
  s.lights = { ...s.lights, nav: false, strobe: false, land: false, ice: false };
  s.capsOn = false;
  return s;
}
/** A moving group's ramp transform; door vertices and attached hardware keep aircraft coordinates at the closed pose. */
export function groupMatrix(parent: string): THREE.Matrix4 | null {
  if (parent.startsWith("door:")) return new THREE.Matrix4();
  if (parent === "noseGear") return fleetGroupMatrix(NOSE_GEAR);
  if (parent === "caster") return fleetGroupMatrix(NOSE_GEAR).multiply(fleetGroupMatrix(NOSE_CASTER));
  if (parent.startsWith("blade:")) return fleetGroupMatrix(PROP);
  return null;
}
export const walk = createFleetWalk({
  data: WALK_DATA,
  cat: CAT,
  groundY: GROUND_Y,
  crouchY: CROUCH_Y,
  ramp: rampState,
  groupMatrix,
  clearance: 0.3, // approximate: a person's half-width, not a source value
});
/** Flaps remain physically extended after BAT 1/2 OFF, since the unpowered motor cannot retract them. */
export const flapsAt = (prior: Sim, steps: FleetWalkStep<Sim>[], at: number, animate = false) =>
  walk.simAt(prior, animate ? at - 1 : at, steps).flaps.cmd * 0.32;
