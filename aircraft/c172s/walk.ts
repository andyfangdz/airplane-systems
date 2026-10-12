/** Approximate neutral ramp transforms shared with the guided walk and containment audit. */
import * as THREE from "three";
import { createFleetWalk, fleetGroupMatrix } from "@/lib/fleet-walk";
import { GROUND_Y } from "./geometry";
import { initialSim, type Sim } from "./model";
import { CAT, NOSE, NOSE_CASTER, PROP, P3 } from "./parts";
import { RIG, RIG_SPEC, PULLEYS } from "./rig";
import { WALK_DATA } from "./walkaround";
export function rampState(prior: Sim): Sim {
  const s = structuredClone(initialSim);
  s.ground = true;
  s.fuel.qL = prior.fuel.qL;
  s.fuel.qR = prior.fuel.qR;
  s.pitot.oat = prior.pitot.oat;
  s.eng.running = false;
  s.eng.mags = "OFF";
  s.eng.rpm = 0;
  s.eng.throttle = 0;
  s.eng.mix = 0;
  s.elec.bat = s.elec.alt = s.elec.avn1 = s.elec.avn2 = s.elec.ext = false;
  s.elec.stby = "OFF";
  s.fuel.pump = false;
  s.pitot.heat = false;
  s.flaps.cmd = 0;
  s.gear.park = true;
  s.warp = 1;
  s.lights = { ...s.lights, beacon: false, land: false, taxi: false, nav: false, strobe: false, dome: false };
  s.ctrl = { ...s.ctrl, pitch: 0, roll: 0, yaw: 0 };
  s.fuel.shutoff = true;
  return s;
}
/** Full neutral parent matrix; unknown names fail instead of silently placing a pin at the origin. */
export function groupMatrix(parent: string): THREE.Matrix4 {
  if (parent.startsWith("surf:")) return fleetGroupMatrix(CAT.surfacePivot(parent.slice(5)));
  if (parent === "noseGear") return fleetGroupMatrix(NOSE);
  if (parent === "caster") return groupMatrix("noseGear").multiply(fleetGroupMatrix(NOSE_CASTER));
  if (parent.startsWith("blade:")) return fleetGroupMatrix(PROP, [(Number(parent.slice(6)) * 2 * Math.PI) / 2, 0, 0]);
  if (parent.startsWith("yoke:") || parent.startsWith("wheel:"))
    return fleetGroupMatrix(
      P3(RIG_SPEC.yoke.fs, parent.endsWith("L") ? -RIG_SPEC.yoke.bl : RIG_SPEC.yoke.bl, RIG_SPEC.yoke.h),
    );
  if (parent === "rig:cross") return fleetGroupMatrix(P3(RIG_SPEC.yoke.colFs, 0, RIG_SPEC.yoke.crossH));
  if (parent === "rig:crank") return fleetGroupMatrix(RIG.p3(RIG_SPEC.elev.crank));
  if (parent === "rig:trimWheel") return fleetGroupMatrix(RIG.p3(RIG_SPEC.trim.wheel));
  if (parent === "rig:pedL" || parent === "rig:pedR") return new THREE.Matrix4();
  if (parent.startsWith("rig:pul:")) {
    const pulley = PULLEYS[parent.slice(8)];
    if (pulley) return fleetGroupMatrix(pulley.c);
  }
  throw new Error(`Unknown c172s walk parent: ${parent}`);
}
export const walk = createFleetWalk({ data: WALK_DATA, cat: CAT, groundY: GROUND_Y, ramp: rampState, groupMatrix });
