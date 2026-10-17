/** POH172SPHBUS-04 7-30/7-37; source-located knobs and fuel-servo linkages. */
import { addControlCable } from "@/lib/hardware";
import { CAT, P3 } from "./catalogue";
export const CONTROL_ROUTES = [
  addControlCable(
    CAT,
    "aircraft.c172s.parts.control-routing.throttle-cable",
    "Throttle control cable",
    [
      P3(17.6, 1.8, 47.5),
      P3(10, -2, 40),
      P3(0, -2, 37),
      P3(-10, -8.6, 34.6),
      P3(-26.4, -8.6, 34.6),
      P3(-28.2, -2, 33.8),
    ],
    "Push-pull throttle operates the fuel/air-control butterfly; RPM also depends on airspeed with the fixed-pitch propeller (POH 7-30/7-37).",
  ),
  addControlCable(
    CAT,
    "aircraft.c172s.parts.control-routing.mixture-cable",
    "Mixture control cable",
    [P3(17.6, 5.2, 47.5), P3(10, 3, 40), P3(0, 3, 37), P3(-10, 8.6, 34.6), P3(-26.4, 8.6, 34.6), P3(-28.2, 2, 33.8)],
    "Vernier mixture acts at the fuel/air-control unit; full aft cuts off metered fuel (POH 7-30; Lycoming Operator1-3).",
    ["engine", "fuel"],
  ),
];
