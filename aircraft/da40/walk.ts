import * as THREE from "three";
import { createFleetWalk, fleetGroupMatrix } from "@/lib/fleet-walk";
import { toVec3 } from "@/lib/math";
import { GROUND_Y } from "./geometry";
import { initialSim, type Sim } from "./model";
import { CAT, NOSE_GEAR, NOSE_CASTER, PROP, CYLS, CANOPY_HINGE, DOOR_HINGE, CANOPY_SHELL, DOOR_SHELL } from "./parts";
import { STICK, PIVOTS, FLAP_TUBE } from "./rig";
import { WALK_DATA } from "./walkaround";
export function rampState(prior: Sim): Sim {
  const s = structuredClone(initialSim);
  s.air = false;
  s.fuel.qL = prior.fuel.qL;
  s.fuel.qR = prior.fuel.qR;
  s.pitot.oat = prior.pitot.oat;
  s.env.extraVents = prior.env.extraVents;
  s.eng.running = false;
  s.eng.key = "OFF";
  s.eng.throttle = s.eng.mix = 0;
  s.eng.rpmLever = 1;
  s.elec.bat = s.elec.alt = s.elec.avMaster = s.elec.essBus = s.elec.emerg = s.elec.ext = false;
  s.elec.tBat = 0;
  s.fuel.pump = s.pitot.heat = false;
  s.flaps.cmd = 0;
  s.gear.park = true;
  s.lights = { ...s.lights, position: false, strobe: false, landing: false, taxi: false, instr: 0, flood: 0 };
  s.ctrl = { pitch: 0, roll: 0, yaw: 0 };
  return s;
}
/** All scene-parent ramp transforms, including hinged doors; unknown groups fail visibly. */
export function groupMatrix(parent: string): THREE.Matrix4 {
  if (parent.startsWith("surf:")) return fleetGroupMatrix(CAT.surfacePivot(parent.slice(5)));
  if (parent === "noseGear") return fleetGroupMatrix(NOSE_GEAR);
  if (parent === "caster") return groupMatrix("noseGear").multiply(fleetGroupMatrix(NOSE_CASTER));
  if (parent === "canopy") return fleetGroupMatrix(CANOPY_HINGE);
  if (parent === "door") return fleetGroupMatrix(DOOR_HINGE);
  if (parent.startsWith("blade:")) return fleetGroupMatrix(PROP, [(Number(parent.slice(6)) * 2 * Math.PI) / 3, 0, 0]);
  if (parent.startsWith("cyl:")) {
    const c = CYLS.find((c) => c.n === Number(parent.slice(4)));
    if (c) return fleetGroupMatrix([c.x, -0.05, c.s * 0.26]);
  }
  if (parent.startsWith("stick:"))
    return fleetGroupMatrix([STICK.x, STICK.y, (parent.endsWith("L") ? -1 : 1) * STICK.z]);
  if (parent === "rig:ett") return fleetGroupMatrix([STICK.x, STICK.y, 0]);
  if (parent === "rig:flapTube") return fleetGroupMatrix([FLAP_TUBE.x, FLAP_TUBE.y, 0]);
  if (parent === "rig:pedL" || parent === "rig:pedR") return new THREE.Matrix4();
  const pivots: Record<string, () => THREE.Matrix4> = {
    "rig:eIdle": () => fleetGroupMatrix(PIVOTS.eIdle),
    "rig:eFin": () => fleetGroupMatrix(PIVOTS.eFin),
    "rig:aFwd": () => fleetGroupMatrix(PIVOTS.aFwd),
    "rig:aAft": () => fleetGroupMatrix(PIVOTS.aAft),
    "rig:wbL": () => fleetGroupMatrix(toVec3(PIVOTS.wbL())),
    "rig:wbR": () => fleetGroupMatrix(toVec3(PIVOTS.wbR())),
  };
  if (pivots[parent]) return pivots[parent]();
  throw new Error(`Unknown da40 walk parent: ${parent}`);
}
export const walk = createFleetWalk({
  data: WALK_DATA,
  cat: CAT,
  extraShells: [CANOPY_SHELL, DOOR_SHELL],
  groundY: GROUND_Y,
  ramp: rampState,
  groupMatrix,
  shellMatrix: (name) =>
    name === CANOPY_SHELL.name
      ? groupMatrix("canopy")
      : name === DOOR_SHELL.name
        ? groupMatrix("door")
        : new THREE.Matrix4(),
});
