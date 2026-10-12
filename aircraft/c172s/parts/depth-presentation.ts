import { CAT } from "./catalogue";
import { DEPTH_ENGINE_PARTS } from "./depth-engine";
import { DEPTH_ELECTRICAL_PARTS } from "./depth-electrical";
import { DEPTH_AVIONICS_PARTS } from "./depth-avionics";
import { DEPTH_CABIN_GEAR_PARTS } from "./depth-cabin-gear";
import { DEPTH_CONTROLS_PARTS } from "./depth-controls";
export const DEPTH_PARTS = [
  ...DEPTH_ENGINE_PARTS,
  ...DEPTH_ELECTRICAL_PARTS,
  ...DEPTH_AVIONICS_PARTS,
  ...DEPTH_CABIN_GEAR_PARTS,
  ...DEPTH_CONTROLS_PARTS,
];
// Keep detailed selection entries, avoiding dozens of overlapping pins in the cockpit/firewall.
const priority = new Set([
  "Accessory-housing oil pump",
  "Main battery contactor",
  "Pitot pressure distribution tee",
  "Front seat track",
  "Flap actuator lead screw",
]);
for (const p of DEPTH_PARTS)
  if (p.pin && p.name && !priority.has(p.name))
    for (const sys of p.sys) {
      const quiet = (CAT.labels.quiet ??= {});
      (quiet[sys] ??= []).push(p.name);
    }
