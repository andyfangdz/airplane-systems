/** Refinements of the source-cited parts registered above this module in index.ts.
 * Original equipment arms, connections, optional fit and system memberships stay authoritative.
 * Surface detail is schematic, not an IPC dimensional reconstruction. See SOURCES.md.
 */
import { refineHardware, bindHardwareMotion, linkageGeo } from "@/lib/hardware";
import { brakeAmount } from "@/lib/anims";
import { CAT } from "./catalogue";
import { useC172 } from "../store";
const S = () => useC172.getState().s;

export const HARDWARE_DETAILS = refineHardware(CAT, {
  case: [
    "Alternator Control Unit (ACU)",
    "Standby battery controller",
    "Main battery contactor",
    "Starter contactor",
    "Alternator output relay",
    "External power relay",
    "ELT (Artex ME406)",
  ],
  battery: ["Main battery — 24 V", "Standby battery"],
  radio: [
    "GIA 63W #1",
    "GIA 63W #2",
    "GRS 77 AHRS",
    "GDC 74A air data computer",
    "GEA 71 engine/airframe unit",
    "GTX 33 transponder",
    "GMU 44 magnetometer",
  ],
  valve: ["Vacuum regulator", "Heater control valve"],
  actuator: ["Elevator trim tab actuator", "Flap motor and actuator"],
  filter: ["Induction air filter"],
});

// POH 7-30/7-37: separate throttle and mixture act at the fuel/air control unit.
for (const [name, value] of [
  ["Throttle butterfly linkage", () => S().eng.throttle],
  ["Servo mixture linkage", () => S().eng.mix],
] as const) {
  const parts = bindHardwareMotion(CAT, name, () => (mesh) => {
    mesh.rotation.z = (value() - 0.5) * 1.2;
  });
  parts.forEach((part) => {
    part.geo = linkageGeo;
  });
}
// POH 7-46; 172RPC24 32-30/32-32: two interconnected pilot cylinders, mechanical parking lock.
export const BRAKE_RODS = bindHardwareMotion(CAT, "Brake master-cylinder piston", (spec, index) => {
  const x = spec.pos![0];
  return (mesh) => {
    mesh.position.x = x + 0.012 * brakeAmount(S().gear, index === 0 ? "L" : "R");
  };
});
export const PARK_LOCKS = bindHardwareMotion(CAT, "Parking brake locking lever", (spec) => {
  const y = spec.pos![1];
  return (mesh) => {
    mesh.position.y = y - (S().gear.park ? 0.008 : 0);
  };
});
