/** Narrow physical skin transitions; the rest of each route remains subject to containment. */
import type { Vec3 } from "@/lib/math";
import { V, toVec3 } from "@/lib/math";
import { PROP } from "./parts/engine";
import { pitotBase } from "./parts/pitot";
import { LIGHTS } from "./parts/lights";
import { FW, botY, fs, onSkin } from "./geometry";
import { RUD_HORN, rudHornPivot } from "./rig";
import { VENT } from "./depth-anchors";
const horn = rudHornPivot();
export const AIRFRAME_PORTS: Record<string, readonly { point: Vec3; reach: number }[]> = {
  // Rudder cables emerge locally at the lower bearing bracket to attach to the external horn bolts.
  rudL: [{ point: [horn[0] + 0.02, horn[1], -RUD_HORN.half], reach: 0.068 }],
  rudR: [{ point: [horn[0] + 0.02, horn[1], RUD_HORN.half], reach: 0.068 }],
  // Bowden cable crosses the small fin/top-stabilizer root fairing gap (AMM27-30-00).
  trim: [{ point: [fs(7.5), 0.674, 0], reach: 0.032 }],
  // Normal interior hoses/ducts terminate only at these lower-cowling outlet openings.
  bleed: [{ point: [fs(1.32), botY(fs(1.32)) - 0.02, -0.12], reach: 0.04 }],
  heatDump: [{ point: [FW + 0.07, botY(FW + 0.07) - 0.04, 0.2], reach: 0.09 }],
  tailpipe: [{ point: [fs(1.29), botY(fs(1.29)), 0.14], reach: 0.085 }],
  pitotHeatWire: [{ point: toVec3(pitotBase.clone().add(V(0, 0.012, 0))), reach: 0.035 }],
  // The combined mast pressure hoses enter through its short lower-wing mounting base.
  pitot: [{ point: toVec3(pitotBase.clone().add(V(0, 0.012, 0))), reach: 0.035 }],
  static: [{ point: toVec3(pitotBase.clone().add(V(-0.03, 0.016, 0.03))), reach: 0.045 }],
  // Two independently terminating capillary/check vents project a short distance beneath each wing.
  ventL: [{ point: VENT(-1, false), reach: 0.03 }],
  ventR: [{ point: VENT(1, false), reach: 0.03 }],
  ventCheckL: [{ point: VENT(-1, true), reach: 0.03 }],
  ventCheckR: [{ point: VENT(1, true), reach: 0.03 }],
  // Oil enters the piston inside the spinner, forward of the fuselage cowling envelope.
  oilGov: [{ point: [PROP[0] - 0.06, 0, 0], reach: 0.025 }],
  // OAM 40-099 independent panel-vent NACA mouths at the front fuselage skin.
  freshPanel: [{ point: toVec3(onSkin(fs(1.88), -0.16, -1, 1.005)), reach: 0.025 }],
  freshPanelR: [{ point: toVec3(onSkin(fs(1.88), -0.16, 1, 1.005)), reach: 0.025 }],
  // Lamp connector reaches the tip lens beneath its exterior fairing.
  positionWire1: [{ point: LIGHTS.tipR, reach: 0.015 }],
  "positionWire-1": [{ point: LIGHTS.tipL, reach: 0.015 }],
};
