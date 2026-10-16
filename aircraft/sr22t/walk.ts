/**
 * SR22T preflight walk-around (data in walkaround.ts) on the shared walk logic: the ramp state it starts from, where its
 * moving groups sit, the flap angle at each step, and the framing wait for the fuselage skin the page's worker builds.
 */
import * as THREE from "three";
import { createFleetWalk, fleetGroupMatrix, type FleetWalkStep } from "@/lib/fleet-walk";
import { toVec3 } from "@/lib/math";
import { hullPending, useFuselage } from "./fuselage-geo";
import { doorHinge, GROUND_Y } from "./geometry";
import { FLAP_DEG, initialSim, type Sim } from "./model";
import { CAT, NOSE_CASTER, NOSE_GEAR, PROP } from "./parts";
import { CROUCH_Y, WALK_DATA } from "./walkaround";

/**
 * The airplane as found on the ramp, where the walk-around starts: the starting state with the equipment fitted and the
 * fuel aboard kept, engine stopped, every switch the cabin items use OFF, flaps up.
 */
export function rampState(prior: Sim): Sim {
  const d = structuredClone(initialSim);
  d.equip = structuredClone(prior.equip);
  d.fuel.qL = prior.fuel.qL;
  d.fuel.qR = prior.fuel.qR;
  d.paFt = prior.paFt;
  d.eng = { ...d.eng, running: false, key: "OFF", lever: 0, mix: 0 };
  d.elec = { ...d.elec, bat1: false, bat2: false, avionics: false, tBat: 0 };
  d.fuel.pump = "OFF";
  d.flaps.cmd = 0;
  d.pitot.heat = false;
  d.stall.onGround = true;
  d.lights = { ...d.lights, nav: false, strobe: false, land: false, ice: false };
  d.oxy.on = false;
  d.ice.on = false;
  return d;
}

/** A moving group's ramp transform (doors shut); groups the walk-around can't place are left out (null). */
export function groupMatrix(parent: string): THREE.Matrix4 | null {
  if (parent === "door:L" || parent === "door:R" || parent === "door:bag")
    return fleetGroupMatrix(toVec3(doorHinge(parent.slice(5) as "L" | "R" | "bag").pivot));
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
  // the clearance outline needs the fuselage skin: while the page's worker still builds it, framing waits rather than
  // building it again here
  hull: {
    pending: hullPending,
    onSettled: (listener) =>
      useFuselage.subscribe(({ settled }) => {
        if (settled) listener();
      }),
  },
});

/**
 * Physical flap angle at step `at` (−1: on the ramp), degrees: the flaps where the commanded position leaves them, since a
 * flap motor without power (batteries off after 1u) can't move them. `running`: the step was reached by stepping forward
 * one item with the flaps powered, so the angle is the previous step's and the motor carries them on from there (1m).
 */
export function flapsAt(prior: Sim, steps: FleetWalkStep<Sim>[], at: number, running = false): number {
  return FLAP_DEG[walk.simAt(prior, running ? at - 1 : at, steps).flaps.cmd];
}
