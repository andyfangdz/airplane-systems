/** Refinements of the source-cited parts registered above this module in index.ts.
 * Original equipment arms, connections, optional fit and system memberships stay authoritative.
 * Surface detail is schematic, not an IPC dimensional reconstruction. See SOURCES.md.
 */
import { refineHardware, bindHardwareMotion, butterflyGeo } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { useM20C } from "../store";
const S = () => useM20C.getState().s;

export const HARDWARE_DETAILS = refineHardware(CAT, {
  case: ["Master relay (at the battery)", "Voltage regulator", "Alternator overvoltage relay"],
  battery: ["Battery — 12 V, 35 Ah"],
  valve: [
    "Parking brake lock valve",
    "Vacuum regulator",
    "Alternate static source valve (SB M20-158)",
    "PC pilot valve (pneumatic relay)",
    "PC rate-gyro rotary valve",
    "PC roll-trim valve",
    "Cabin heat shutoff valve",
    "Cabin fresh-air valve",
  ],
  pump: ["Engine-driven fuel pump", "Electric boost pump"],
  actuator: [],
  filter: ["Vacuum regulator inlet filter"],
  canister: [
    "Flap pump inlet check valve",
    "Flap pump outlet check valve",
    "Flap pressure release valve",
    "Flap hand-pump body",
    "Trim-wheel reduction gearbox",
    "Aft trim gearbox",
  ],
});

// OM scan p. 15; MAN 106 §4-9: manual carburetor controls, independent of bus power.
export const THROTTLE_PLATE = bindHardwareMotion(CAT, "Carburetor throttle butterfly", () => (mesh) => {
  mesh.rotation.z = (S().eng.throttle * Math.PI) / 2;
})[0];
THROTTLE_PLATE.geo = () => butterflyGeo(0.01, 0.025);
export const MIXTURE_VALVE = bindHardwareMotion(CAT, "Carburetor mixture metering valve", (spec) => {
  const z = spec.pos![2];
  return (mesh) => {
    mesh.position.z = z + (S().eng.mix - 0.5) * 0.008;
  };
})[0];
