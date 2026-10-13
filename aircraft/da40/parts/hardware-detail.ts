/** Refinements of the source-cited parts registered above this module in index.ts.
 * Original equipment arms, connections, optional fit and system memberships stay authoritative.
 * Surface detail is schematic, not an IPC dimensional reconstruction. See SOURCES.md.
 */
import { refineHardware, bindHardwareMotion, butterflyGeo } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { useDA40 } from "../store";
const S = () => useDA40.getState().s;

export const HARDWARE_DETAILS = refineHardware(CAT, {
  case: [
    "Relay box",
    "Voltage regulator (VR2000)",
    "Battery contactor",
    "Starter contactor",
    "External-power contactor",
    "Essential/main tie relay",
    "Avionics master relay",
    "Flood-light inverter",
    "Instrument-light dimmer module",
    "ELT",
  ],
  battery: ["Main battery — 24 V, 11 Ah", "Emergency battery (lithium pack)"],
  radio: [
    "GEA 71 engine/airframe unit",
    "GDC 74A air data computer",
    "GIA 63W #1",
    "GIA 63W #2",
    "GTX 33 transponder",
    "GMU 44 magnetometer",
  ],
  valve: [
    "Parking brake valve (Cleveland 60-59)",
    "Propeller governor",
    "Alternate static valve",
    "Heat valve",
    "Floor / defrost distributor valve",
    "Electric fuel-pump bypass",
  ],
  pump: ["Engine-driven fuel pump", "Electric fuel pump", "Accessory oil pump"],
  actuator: ["Pitch servo (GSA)", "Roll servo (GSA)", "Flap actuator"],
  filter: ["Induction air filter"],
});

// AMM 21-00-00 pp. 1–3: two independent butterflies, not an electrical heater.
export const AIR_BUTTERFLIES = [
  ...bindHardwareMotion(CAT, "Heat-valve butterfly", () => (mesh) => {
    mesh.rotation.z = (S().env.heat * Math.PI) / 2;
  }),
  ...bindHardwareMotion(CAT, "Defrost/floor distributor butterfly", () => (mesh) => {
    mesh.rotation.z = (S().env.dist * Math.PI) / 2;
  }),
];
AIR_BUTTERFLIES[0].geo = () => butterflyGeo(0.033, 0.07);
AIR_BUTTERFLIES[1].geo = () => butterflyGeo(0.031, 0.12);
// Ghost the covers in X-ray so the mechanism can be inspected through its own enclosure.
for (const name of ["Heat valve", "Floor / defrost distributor valve"])
  CAT.parts.find((p) => p.name === name)!.fairing = true;
