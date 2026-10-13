/** Refinements of the source-cited parts registered above this module in index.ts.
 * Original equipment arms, connections, optional fit and system memberships stay authoritative.
 * Surface detail is schematic, not an IPC dimensional reconstruction. See SOURCES.md.
 */
import { refineHardware, bindHardwareMotion } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { useC182 } from "../store";
const S = () => useC182.getState().s;

export const HARDWARE_DETAILS = refineHardware(CAT, {
  case: [
    "Battery contactor",
    "Alternator contactor",
    "Starter contactor",
    "External-power contactor",
    "Standby battery controller",
    "Audio fail-safe relay",
    "ELT",
  ],
  battery: ["Main battery — 24 V", "Standby battery", "ELT battery pack"],
  radio: [
    "GIA 63 #1",
    "GIA 63 #2",
    "GRS 77 AHRS",
    "GDC 74A air data computer",
    "GEA 71 engine/airframe unit",
    "GTX 33 transponder",
  ],
  valve: [
    "Vacuum regulator",
    "Heater valve",
    "Oil filter adapter / valve housing",
    "Fuel vent check valve",
    "Defrost control valve",
  ],
  pump: ["Engine-driven oil pump"],
  actuator: ["Flap motor and actuator", "KS 271C roll servo", "KS-270C pitch servo", "KS-272C pitch trim servo"],
  filter: ["Vacuum regulator filter"],
});

// MM 32-42-00 pp. 201/205: ratchet cable holds the existing animated master-cylinder rods.
export const PARK_LINKS = bindHardwareMotion(CAT, "Master-cylinder parking linkage", (spec) => {
  const y = spec.pos![1];
  return (mesh) => {
    mesh.position.y = y - (S().gear.park ? 0.009 : 0);
  };
});
