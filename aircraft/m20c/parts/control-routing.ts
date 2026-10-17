/** 1968 OM pp.2/15; MAN106 §4-9. Manual carburetor controls. */
import { addControlCable } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { FW, PANEL_X } from "../geometry";
export const CONTROL_ROUTES = [
  addControlCable(
    CAT,
    "aircraft.m20c.parts.control-routing.throttle-cable",
    "Throttle control cable",
    [
      [PANEL_X + 0.06, -0.17, -0.1],
      [FW - 0.08, -0.35, -0.12],
      [FW + 0.02, -0.35, -0.12],
      [2.4, -0.4, -0.12],
      [2.57, -0.35, -0.08],
      [2.57, -0.26, -0.015],
    ],
    "Panel throttle acts mechanically at the carburetor butterfly; the throttle also operates the gear-warning demand switch (1968 OM pp.2/15; MAN106 §4-9).",
  ),
  addControlCable(
    CAT,
    "aircraft.m20c.parts.control-routing.mixture-cable",
    "Mixture control cable",
    [
      [PANEL_X + 0.06, -0.17, -0.05],
      [FW - 0.08, -0.37, -0.06],
      [FW + 0.02, -0.37, -0.16],
      [2.4, -0.42, -0.16],
      [2.53, -0.36, -0.045],
      [2.53, -0.3, -0.045],
    ],
    "Hexagonal mixture control operates the carburetor metering/idle-cutoff mechanism (1968 OM p.2; MAN106 §4-9).",
    ["engine", "fuel"],
  ),
];
