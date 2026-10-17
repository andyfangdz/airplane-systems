import { cabinFloor } from "@/lib/cabin-trim";
import { FUSE, fs } from "../geometry";
/** AFM 7-13/14/18: rear-door damper and four serial brake masters. Travel/attachments illustrative. */
import { Vector3 } from "three";
import { telescopingStrut } from "@/lib/strut";
import { bindHardwareMotion } from "@/lib/hardware";
import { DOOR, cyl } from "../geometry";
import { PEDALS, PEDAL_STATIONS } from "../rig";
import { CAT, sim } from "./catalogue";
import { DOOR_HINGE } from "./airframe";

export const DOOR_POSE = { rear: 0 };
const hinge = new Vector3(...DOOR_HINGE),
  axis = new Vector3(1, 0, 0);
export const REAR_STRUT = telescopingStrut(CAT, {
  id: "door.rear.strut",
  name: "Rear door gas strut",
  sys: ["cabin"],
  fraction: () => DOOR_POSE.rear,
  note: "Gas-pressure damper holds the rear door open (AFM 7-18). Fixed-length barrel, sliding rod and ball joints follow the fixed and moving attachments. Geometry, attachments and stroke are illustrative.",
  ends: (fraction) => ({
    fixed: new Vector3(DOOR.x0 + 0.025, -0.18, -0.47),
    moving: new Vector3(DOOR.x0 - 0.15, 0.25, -0.44)
      .sub(hinge)
      .applyAxisAngle(axis, (fraction * 82 * Math.PI) / 180)
      .add(hinge),
  }),
  replace: CAT.parts.find((p) => p.name === "Rear door gas strut")!,
});
// The parking valve retains wheel pressure; released toe pedals do not stay depressed with it.
export const toeAmount = (index: number) => Math.max(0, sim().s.gear.diff * (index % 2 ? 1 : -1));
bindHardwareMotion(CAT, "Rudder pedal / toe brake", (spec, index) => (mesh) => {
  mesh.rotation.z = spec.rot![2] - 0.22 * toeAmount(index);
});
export const BRAKE_RODS = PEDAL_STATIONS.map(({ id: pedalId, z }, index) => {
  const pos: [number, number, number] = [PEDALS.x + 0.05, PEDALS.y + 0.065, z];
  return CAT.part(() => cyl(0.004, 0.04, "y", 12), ["gear"], {
    id: "parts.mechanisms.brake-master-cylinder-piston-rod.001",
    instance: [pedalId],
    name: "Brake master-cylinder piston rod",
    parent: index % 2 ? "rig:pedR" : "rig:pedL",
    pos,
    color: "#D5DDE2",
    pin: index === 0,
    anim: (mesh) => {
      mesh.position.y = pos[1] - 0.018 * toeAmount(index);
    },
    note: "Toe pressure strokes the piston in each of four masters; each wheel's pilot and copilot masters are in series (AFM 7-14). Rod diameter/stroke illustrative. Parking pressure is retained downstream by the parking valve, independently of released pedals.",
  });
});

// Locked and cooling-gap positions retain engagement; fully opening the canopy retracts the bolts.
bindHardwareMotion(CAT, "Canopy locking bolt", (spec, index) => (mesh) => {
  mesh.position.z = spec.pos![2] - (index ? 1 : -1) * (sim().s.doors.canopy === "OPEN" ? 0.012 : 0);
});
bindHardwareMotion(CAT, "Rear door locking bolt", (spec) => (mesh) => {
  mesh.position.z = spec.pos![2] + (sim().s.doors.rear ? 0 : 0.012);
});
bindHardwareMotion(CAT, "Canopy handle (left)", () => (mesh) => {
  mesh.rotation.z = sim().s.doors.canopy === "CLOSED" ? 0 : sim().s.doors.canopy === "GAP" ? 0.35 : 0.9;
});
bindHardwareMotion(CAT, "Rear door safety lever", () => (mesh) => {
  mesh.rotation.z = sim().s.doors.rear ? 0 : 0.8;
});

CAT.part(() => cabinFloor(FUSE, fs(3.98), fs(1.8), -0.56), ["cabin", "airframe"], {
  id: "parts.mechanisms.cabin-floor-covering.002",
  name: "Cabin floor covering",
  fairing: true,
  color: "#514F4B",
  note: "Floor panel separates the cabin from the control runs beneath the seats (AFM 7-15, 7-19). Floor height and edge clearance illustrative.",
});
