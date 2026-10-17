/** The SR20 and SR22T walk-around mini-map: the Cirrus from above, nose up (10 map units per metre, approximate). */
import type { FleetWalkMap } from "@/lib/fleet-walk";

export const CIRRUS_WALK_MAP: FleetWalkMap = {
  viewBox: "-80 -64 160 120",
  fuselage: "M-3.5,-37 L-6,-30 L-6.5,-18 L-6.5,26 L-1.5,34 L1.5,34 L6.5,26 L6.5,-18 L6,-30 L3.5,-37 Z",
  wings:
    "M-6.5,-18.4 L-58.4,-16.7 L-58.4,-8.5 L-6.5,-4 Z M6.5,-18.4 L58.4,-16.7 L58.4,-8.5 L6.5,-4 Z M-18.6,23 L18.6,23 L18.6,31 L-18.6,31 Z",
};
