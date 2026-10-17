/** Refinements of the source-cited parts registered above this module in index.ts.
 * Original equipment arms, connections, optional fit and system memberships stay authoritative.
 * Surface detail is schematic, not an IPC dimensional reconstruction. See SOURCES.md.
 */
import { refineHardware, bindHardwareMotion } from "@/lib/hardware";
import { brakeAmount } from "@/lib/anims";
import { CAT } from "./catalogue";
import { useSR20 } from "../store";
const S = () => useSR20.getState().s;

export const HARDWARE_DETAILS = refineHardware(CAT, {
  case: [
    "SlickSTART magneto booster",
    "electrical.battery2.relay",
    "electrical.alt1.fieldRelay",
    "electrical.alt2.fieldRelay",
    "electrical.battery1.relay",
    "electrical.starter.relay",
    "electrical.externalPower.relay",
    "Roll trim relay",
    "Flap relay",
    "Avionics master relays",
    "ELT — Artex ELT 1000",
  ],
  battery: ["BAT 2 battery — 12 V, 7 Ah"],
  radio: [
    "avionics.adahrs1",
    "avionics.adahrs2",
    "avionics.gia1",
    "avionics.gia2",
    "avionics.gea",
    "avionics.transponder",
    "Magnetometer (GMU 44, MAG 1)",
    "Magnetometer (GMU 44, MAG 2) (optional)",
  ],
  valve: [
    "Parking brake valve",
    "Oil filter base / thermostat housing",
    "Fuel servo regulator / mixture valve",
    "Alternate static valve",
    "Selector valve enclosure",
    "Expansion valve",
  ],
  pump: ["Engine oil pump", "Electric boost pump"],
  actuator: ["Cabin air coupler actuator", "Manifold dual actuator", "Pitch servo — GSA 81", "Roll servo — GSA 81"],
  filter: ["Induction air filter"],
});

// AMM 32-42 p. 23: both seats' corresponding pedals stroke the same wheel circuit.
export const BRAKE_RODS = bindHardwareMotion(CAT, "Master-cylinder piston rod", (spec, index) => {
  const y = spec.pos![1];
  const side = index % 2 === 0 ? "L" : "R";
  return (mesh) => {
    mesh.position.y = y - 0.012 * brakeAmount(S().gear, side);
  };
});
