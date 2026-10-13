import { DOORS } from "./geometry";
import * as THREE from "three";
import { createFleetWalk, fleetGroupMatrix } from "@/lib/fleet-walk";
import { toVec3 } from "@/lib/math";
import { GROUND_Y, TAIL_PIVOT } from "./geometry";
import { initialSim, type Sim } from "./model";
import { CAT, PROP, CYLS, TAIL_SHELLS, TAIL_SURFACE_KEYS, MG, NG } from "./parts";
import { noseDoorHinge, noseDoorAxis, noseDoorAngle } from "./placement";
import { PIVOTS, WHEEL, JBAR, FLAP_PUMP, johnsonAngle } from "./rig";
import { WALK_DATA } from "./walkaround";
export function rampState(prior: Sim): Sim {
  const s = structuredClone(initialSim);
  s.air = false;
  s.fuel.qL = prior.fuel.qL;
  s.fuel.qR = prior.fuel.qR;
  s.pitot.oat = prior.pitot.oat;
  s.pitot.heatInstalled = prior.pitot.heatInstalled;
  s.eng.running = s.eng.altSpinning = false;
  s.eng.key = "OFF";
  s.eng.throttle = s.eng.mix = s.eng.carbHeat = 0;
  s.elec.master = s.elec.radios = false;
  s.elec.tBat = 0;
  s.sw = { fuelPump: false, pitotHeat: false, beacon: false, nav: false, landing: false };
  s.gear = { lever: "DOWN", latch: false, diff: 0, park: true };
  s.flaps.valve = "UP";
  s.ctrl = { pitch: 0, roll: 0, yaw: 0, trim: 0 };
  s.lights = { instr: 0, spot: 0, cabin: false, selector: 0 };
  return s;
}
const tailMatrix = () => fleetGroupMatrix(TAIL_PIVOT);
/** The study airplane remains down and locked with neutral controls; includes open gear doors and the whole-tail offset. */
export function groupMatrix(parent: string): THREE.Matrix4 {
  if (DOORS.some((door) => parent === `door:${door.key}`)) return new THREE.Matrix4();
  if (parent.startsWith("surf:")) {
    const key = parent.slice(5);
    return (TAIL_SURFACE_KEYS.includes(key) ? tailMatrix() : new THREE.Matrix4()).multiply(
      fleetGroupMatrix(CAT.surfacePivot(key)),
    );
  }
  if (parent === "tail") return tailMatrix();
  if (parent === "nose") return fleetGroupMatrix(NG.top);
  if (parent === "mainR" || parent === "mainL")
    return fleetGroupMatrix([MG.trunnion[0], MG.trunnion[1], (parent.endsWith("L") ? -1 : 1) * MG.trunnion[2]]);
  if (parent === "jbar") return fleetGroupMatrix(JBAR.pivot, [0, 0, johnsonAngle(0)]);
  if (parent === "pump") return fleetGroupMatrix(FLAP_PUMP.pivot);
  if (parent.startsWith("noseDoor")) {
    const side = parent.endsWith("L") ? -1 : 1;
    return new THREE.Matrix4().compose(
      new THREE.Vector3(...noseDoorHinge(side)),
      new THREE.Quaternion().setFromAxisAngle(noseDoorAxis(), noseDoorAngle(0, side)),
      new THREE.Vector3(1, 1, 1),
    );
  }
  if (parent.startsWith("blade:")) return fleetGroupMatrix(PROP, [Number(parent.slice(6)) * Math.PI, 0, 0]);
  if (parent.startsWith("cyl:")) {
    const c = CYLS.find((c) => c.n === Number(parent.slice(4)));
    if (c) return fleetGroupMatrix([c.x, -0.05, c.s * 0.18]);
  }
  if (parent.startsWith("wheel:"))
    return fleetGroupMatrix([WHEEL.x, WHEEL.y, (parent.endsWith("L") ? -1 : 1) * WHEEL.z]);
  if (parent === "rig:pedL" || parent === "rig:pedR") return new THREE.Matrix4();
  const pivots: Record<string, () => THREE.Matrix4> = {
    "rig:eIdle": () => fleetGroupMatrix(PIVOTS.eIdle),
    "rig:eTail": () => fleetGroupMatrix(PIVOTS.eTail),
    "rig:aFwd": () => fleetGroupMatrix(PIVOTS.aFwd),
    "rig:aCtr": () => fleetGroupMatrix(PIVOTS.aCtr),
    "rig:rFwd": () => fleetGroupMatrix(PIVOTS.rFwd),
    "rig:wbL": () => fleetGroupMatrix(toVec3(PIVOTS.wbL())),
    "rig:wbR": () => fleetGroupMatrix(toVec3(PIVOTS.wbR())),
  };
  if (pivots[parent]) return pivots[parent]();
  throw new Error(`Unknown m20c walk parent: ${parent}`);
}
export const walk = createFleetWalk({
  data: WALK_DATA,
  cat: CAT,
  extraShells: TAIL_SHELLS,
  groundY: GROUND_Y,
  ramp: rampState,
  groupMatrix,
  surfaceMatrix: (key) => (TAIL_SURFACE_KEYS.includes(key) ? tailMatrix() : new THREE.Matrix4()),
  shellMatrix: (name) => (TAIL_SHELLS.some((shell) => shell.name === name) ? tailMatrix() : new THREE.Matrix4()),
});
