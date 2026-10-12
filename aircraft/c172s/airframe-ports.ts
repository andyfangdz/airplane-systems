/** Narrow physical skin interfaces. Never exemptions for whole internal wiring runs.
 * POH7-36/37 induction/cooling,7-62 Fig7-8 ventilation,7-64 pitot/static,7-65 vacuum,
 *7-67 stall inlet. Reach is illustrative port/probe envelope, not a manual dimension. */
import type { Vec3 } from "@/lib/math";
import { RIG } from "./rig";
import { AF } from "./geometry";
import { PITOT, STATIC_PORT, STALL_INLET, OAT_PROBE } from "./parts";
const P = AF.P3,
  w = (bl: number, c: number, side = 0) => AF.P(AF.wingP(AF.Z(bl), c, side));
export const AIRFRAME_PORTS: Record<string, readonly { point: Vec3; reach: number }[]> = {
  intake: [{ point: P(-38.5, 0, 37.8), reach: 0.12 }],
  coolL: [
    { point: P(-38.4, -10.2, 53.3), reach: 0.13 },
    { point: P(-2, -6, 24), reach: 0.07 },
  ],
  coolR: [
    { point: P(-38.4, 10.2, 53.3), reach: 0.13 },
    { point: P(-2, 6, 24), reach: 0.07 },
  ],
  ram: [{ point: P(-38.5, 6, 49), reach: 0.07 }],
  wrootL: [{ point: w(-19, 0.01), reach: 0.045 }],
  wrootR: [{ point: w(19, 0.01), reach: 0.045 }],
  pitot: [{ point: PITOT, reach: 0.16 }],
  pitotHeater: [{ point: PITOT, reach: 0.16 }],
  static: [{ point: STATIC_PORT, reach: 0.03 }],
  stall: [{ point: STALL_INLET, reach: 0.035 }],
  // Only the short endpoint at the exposed elevator torque-tube horn may cross the lower fairing.
  elDn: [{ point: RIG.cable("elDn").pts.at(-1)!, reach: 0.1 }],
  vacOut: [{ point: P(-6, -8, 24.8), reach: 0.1 }],
  oatSignal: [{ point: OAT_PROBE, reach: 0.04 }],
};
