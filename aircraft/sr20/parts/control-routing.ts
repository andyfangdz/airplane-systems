/** POH 11934-005 7-34, Fig 7-7; AMM73-00 p.1. Schematic console/firewall runs. */
import { addControlCable } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { CONSOLE_LEVERS } from "./cockpit";
import { THROTTLE, GOVERNOR } from "../engine-anchors";
import type { Vec3 } from "@/lib/math";
const start = (z: number): Vec3 => [CONSOLE_LEVERS[0], CONSOLE_LEVERS[1], z];
export const CONTROL_ROUTES = [
  addControlCable(
    CAT,
    "aircraft.sr20.parts.control-routing.power-throttle-cable",
    "Power-lever throttle cable",
    [
      start(-0.035),
      [2.2, -0.38, -0.035],
      [2.61, -0.41, -0.08],
      [2.78, -0.49, -0.08],
      [3.15, -0.49, -0.08],
      [THROTTLE[0], THROTTLE[1], -0.045],
    ],
    "Power lever mechanically operates the fuel-servo throttle (POH 7-34; AMM73-00 p.1).",
  ),
  addControlCable(
    CAT,
    "aircraft.sr20.parts.control-routing.mixture-cable",
    "Mixture control cable",
    [
      start(0.04),
      [2.2, -0.38, 0.04],
      [2.61, -0.41, 0.08],
      [2.78, -0.49, 0.08],
      [3.15, -0.49, 0.08],
      [THROTTLE[0], THROTTLE[1], 0.045],
    ],
    "Mixture lever acts at the servo's sliding mixture valve; full aft selects cutoff (POH 7-34; AMM73-00 p.1).",
    ["engine", "fuel"],
  ),
  addControlCable(
    CAT,
    "aircraft.sr20.parts.control-routing.power-governor-cable",
    "Power-lever governor cable",
    [start(-0.035), [2.2, -0.38, -0.055], [2.61, -0.4, -0.12], [2.8, -0.35, -0.22], [3.48, -0.22, -0.22], GOVERNOR],
    "The same power lever also controls the propeller governor; this is not a separate pilot RPM control (POH 7-34, Fig 7-7).",
    ["engine", "propeller"],
  ),
];
