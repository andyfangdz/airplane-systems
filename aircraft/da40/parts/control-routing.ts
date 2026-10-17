/** AFM7-21–23; AMM73-00-00 pp.1–3. Mechanical quadrant connections. */
import { addControlCable } from "@/lib/hardware";
import { CAT } from "./catalogue";
import { fs, FW } from "../geometry";
import { FUEL_SERVO, GOVERNOR } from "../depth-anchors";
export const CONTROL_ROUTES = [
  addControlCable(
    CAT,
    "aircraft.da40.parts.control-routing.throttle-cable",
    "Throttle control cable",
    [
      [fs(2), -0.31, -0.045],
      [FW - 0.2, -0.4, -0.045],
      [FW, -0.4, -0.08],
      [FUEL_SERVO[0], -0.39, -0.06],
      [FUEL_SERVO[0], FUEL_SERVO[1], -0.025],
    ],
    "Left quadrant lever operates the fuel-injector throttle (AFM7-21; AMM73-00-00 pp.1–3).",
  ),
  addControlCable(
    CAT,
    "aircraft.da40.parts.control-routing.mixture-cable",
    "Mixture control cable",
    [
      [fs(2), -0.31, 0.045],
      [FW - 0.2, -0.4, 0.045],
      [FW, -0.4, 0.08],
      [FUEL_SERVO[0], -0.39, 0.06],
      [FUEL_SERVO[0], FUEL_SERVO[1], 0.025],
    ],
    "Right quadrant lever provides mixture adjustment and idle cutoff (AFM7-22–23; AMM73-00-00 pp.1–3).",
    ["engine", "fuel"],
  ),
  addControlCable(
    CAT,
    "aircraft.da40.parts.control-routing.rpm-cable",
    "RPM control cable",
    [
      [fs(2), -0.31, 0],
      [FW - 0.2, -0.4, 0],
      [FW, -0.4, -0.12],
      [FW + 0.08, -0.3, -0.22],
      [GOVERNOR[0], -0.24, -0.22],
      [GOVERNOR[0], 0.12, -0.22],
      GOVERNOR,
    ],
    "Centre blue lever sets governor RPM; the throttle and mixture remain separate controls (AFM7-21–23).",
    ["engine", "propeller"],
  ),
];
