/**
 * Pitot-static lines and the stall warning line or wiring for flows.ts.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import { V, type Vec3 } from "@/lib/math";
import { AB, wingP } from "./geometry";
import type { Elec, Sim } from "./model";
import {
  PITOT_Z,
  SPX,
  STALL_Z,
  pitotBase,
  statR,
  ALT_STATIC,
  ADAHRS_1,
  ADAHRS_2,
  MD302_PITOT_PORT,
  MD302_STATIC_PORT,
  STATIC_TEE,
  TRAPS,
  SUMPS,
} from "./parts";
import { STALL_COMPUTER, STALL_COMPUTER_PORT, STALL_TRANSDUCER } from "./parts/ice";
import { STALL_SWITCH } from "./parts/pitot";
import { flowList } from "./flow-builder";

const { F, flow } = flowList();

// pitot-static: POH 7-68, 7-69, Fig 7-16 (2 of 2); AMM 34-10 (PDF p. 1629), Fig 34-10-1 sheets 2 and 4
// (PDF pp. 1646, 1648). Each line passes its water trap at its low point; tees and routing approximate. The pitot line and
// the static line each tee to ADAHRS 1, ADAHRS 2 and the MD302 (Fig 7-16 (2 of 2); AMM Fig 34-10-1 sheet 2 items 9, 11,
// 12, 17); ADAHRS 2 installed per operator, 2026-10-08. Endpoints are the parts' anchors.
const PITOT_JCT: Vec3 = [2.12, -0.32, -0.27],
  STATIC_JCT: Vec3 = [1.84, -0.44, -0.17];
flow(
  "pitot",
  [
    pitotBase.clone().add(V(0, 0.015, 0)),
    wingP(PITOT_Z, 0.35, 0),
    // High in the wing root, over the LH collector tank and gear fitting, then down inboard of them, aft of the
    // rudder-aileron interconnect and outboard of the TKS forward proportioning unit. Illustrative waypoints.
    wingP(-1.0, 0.4, 0).lerp(wingP(-1.0, 0.4, 1), 0.5),
    [1.18, -0.465, -0.78],
    [1.18, -0.47, -0.6],
    [1.17, -0.6, -0.53],
    [1.2, -0.6, -0.25],
    [1.05, -0.625, 0],
    TRAPS.pitot,
    [1.5, -0.6, -0.125],
    [2.0, -0.5, -0.2],
    PITOT_JCT,
    ADAHRS_1,
  ],
  ["pitot"],
  { r: 0.009, name: "Pitot line", note: "Pitot pressure through the pitot water trap to ADAHRS 1 (POH Fig 7-16)." },
);
flow("pitotAdahrs2", [PITOT_JCT, [2.3, -0.2, -0.12], ADAHRS_2], ["pitot"], {
  r: 0.007,
  name: "Pitot line to ADAHRS 2",
  note: "Tee to ADAHRS 2 (POH Fig 7-16 (2 of 2); AMM Fig 34-10-1 sheet 2 items 1, 9, 12, PDF p. 1646).",
});
flow("pitotStby", [PITOT_JCT, [2.1, -0.2, -0.25], [2.3, -0.2, MD302_PITOT_PORT[2]], MD302_PITOT_PORT], ["pitot"], {
  r: 0.007,
  name: "Pitot line to MD302",
  note: "Tee to the MD302 standby's rear pitot connector, approaching below the screen then rising behind its face (POH Fig 7-16 (2 of 2); AMM Fig 34-10-1 sheet 2 item 17). Connector offsets and bends schematic.",
  tension: 0,
});
// The RH line passes under the CAPS canister (parts/caps.ts) to the tee. Illustrative waypoint.
flow(
  "static",
  [[SPX, statR.cy, statR.hw - 0.01], SUMPS[0], [SPX + 0.5, 0.08, 0.08], [-0.6, 0.1, -0.12], STATIC_TEE],
  ["pitot"],
  {
    r: 0.009,
    name: "Static line (RH port)",
    note: "RH port through its static line sump to the tee on the aft cabin bulkhead (AMM 34-10, PDF p. 1629; Fig 34-10-1 sheet 2 items 13, 16, 2, PDF p. 1646). Stops while alternate static is selected.",
  },
);
flow("staticL", [[SPX, statR.cy, -statR.hw + 0.01], SUMPS[1], [SPX + 0.5, 0.06, -0.1], STATIC_TEE], ["pitot"], {
  r: 0.009,
  name: "Static line (LH port)",
  note: "LH port through its static line sump to the tee on the aft cabin bulkhead (AMM 34-10, PDF p. 1629; Fig 34-10-1 sheet 2 items 13, 16, 2, PDF p. 1646). Stops while alternate static is selected.",
});
flow(
  "static2",
  [
    STATIC_TEE,
    [AB + 0.02, -0.5, -0.17],
    // Outboard of the A/C condenser and its blower, inboard of the WX-500 (parts/aircon.ts, parts/avionics.ts),
    // then aft of the pitch servo and under the rudder/elevator pulley gang bracket. Illustrative.
    [0.05, -0.53, -0.155],
    // over the flap actuator housing (parts/cabin.ts FLAP_ACT), inboard of it before dropping aft of the servo. Illustrative.
    [0.25, -0.5, -0.04],
    [0.36, -0.61, -0.05],
    [0.4, -0.62, 0.15],
    [0.5, -0.6, 0.1],
    [0.65, -0.59, 0.44],
    [0.95, -0.59, 0.44],
    [1.05, -0.61, 0.4],
    TRAPS.static,
    [1.4, -0.6, 0],
    STATIC_JCT,
  ],
  ["pitot"],
  {
    r: 0.009,
    name: "Static line",
    note: "Tee on the aft cabin bulkhead → static water trap → console tee (AMM 34-10, PDF p. 1629; Fig 34-10-1 sheet 4 Detail D). Illustrative under-floor waypoints x 0.5/0.65/0.95/1.05 m, y −0.60/−0.59/−0.61 m and z 0.10/0.44/0.40 m keep the line outboard of the full roll-clamp sweep; fix3 lead §8 route ruling.",
  },
);
flow("staticAdahrs", [STATIC_JCT, [2.1, -0.35, -0.22], ADAHRS_1], ["pitot"], {
  r: 0.009,
  name: "Static line to ADAHRS 1",
  note: "Static pressure to ADAHRS 1 (POH Fig 7-16).",
});
flow("staticAdahrs2", [STATIC_JCT, [2.25, -0.3, -0.08], ADAHRS_2], ["pitot"], {
  r: 0.007,
  name: "Static line to ADAHRS 2",
  note: "Tee to ADAHRS 2 (POH Fig 7-16 (2 of 2); AMM Fig 34-10-1 sheet 2 items 2, 9, 12, PDF p. 1646).",
});
flow(
  "staticStby",
  [STATIC_JCT, [2.05, -0.3, -0.24], [2.3, -0.25, MD302_STATIC_PORT[2]], MD302_STATIC_PORT],
  ["pitot"],
  {
    r: 0.007,
    name: "Static line to MD302",
    note: "Tee to the MD302 standby's separate rear static connector, approaching below the screen then rising behind its face (POH Fig 7-16 (2 of 2); AMM Fig 34-10-1 sheet 2 item 17). Connector offsets and bends schematic.",
    tension: 0,
  },
);
flow("staticAlt", [ALT_STATIC, [1.84, -0.38, -0.16], STATIC_JCT], ["pitot"], {
  r: 0.007,
  name: "Alternate static",
  note: "Cabin air into the static line while the alternate static source is selected (POH 7-69; Fig 7-16).",
});
// stall warning: AMM 27-31 ¶A without ice protection, ¶B with it (PDF 1032); see flowsFor
flow(
  "stall",
  [
    wingP(STALL_Z, 0.02, 0),
    wingP(STALL_Z, 0.38, 0),
    // High in the wing root, over the RH collector tank, then between the seat pan and the A/C evaporator, blower
    // and recirculation valve into the console. Illustrative waypoints.
    wingP(0.9, 0.4, 0).lerp(wingP(0.9, 0.4, 1), 0.5),
    [1.18, -0.465, 0.6],
    [1.2, -0.485, 0.3],
    [1.3, -0.485, 0.05],
    [1.38, -0.5, -0.06],
    STALL_SWITCH,
  ],
  ["pitot"],
  {
    r: 0.009,
    name: "Stall warning line",
    note: "Inlet → pressure switch on the mid-console LH side panel (POH 7-68; AMM 27-31 ¶A, PDF 1032). Serials without ice protection only. Routing schematic.",
  },
);
flow(
  "stallWire",
  [
    STALL_TRANSDUCER,
    wingP(STALL_Z, 0.38, 0),
    // Aft of the spar web and high over the RH collector tank and gear rib, like the pneumatic line. Illustrative.
    wingP(0.9, 0.4, 0).lerp(wingP(0.9, 0.4, 1), 0.5),
    [1.17, -0.465, 0.6],
    [0.8, -0.52, 0.44],
    // Undimensioned under-floor approach: clear the controller and terminate at the upper case face
    // (AMM 13773-002 Rev 7 Fig 27-31-2 Detail A, PDF p. 1044).
    [STALL_COMPUTER[0] - 0.12, STALL_COMPUTER[1] + 0.09, STALL_COMPUTER[2]],
    [STALL_COMPUTER[0], STALL_COMPUTER[1] + 0.09, STALL_COMPUTER[2]],
    STALL_COMPUTER_PORT,
  ],
  ["pitot", "ice"],
  {
    r: 0.005,
    color: "#C8A23C",
    name: "Stall transducer wiring",
    tension: 0,
    note: "Wing harness from the lift transducer to the stall warning computer under CF3R; replaces the pneumatic line on serials with ice protection (AMM 27-31 ¶B, PDF 1032, 1038; Fig. 27-31-2, PDF 1044). Routing schematic; illustrative waypoint [0.8, −0.52, 0.44] m rises above the full roll-clamp sweep under the fix3 lead §8 ruling.",
  },
);

export const PITOT_DEPTH_FLOWS = F;

/** Particle speed multiplier per pitot-static and stall warning flow (0 = stopped; negative = reversed). */
export function pitotDepthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  // pitot-static: the alternate static source replaces the ports (POH 7-69)
  const altStatic = s.pitot.alt;
  R.pitot = R.pitotStby = R.pitotAdahrs2 = 0.4;
  R.static = R.staticL = R.static2 = altStatic ? 0 : 0.4;
  R.staticAlt = altStatic ? 0.4 : 0;
  R.staticAdahrs = R.staticAdahrs2 = R.staticStby = 0.4;
  R.stall = s.stall.aoa >= 14 && !s.stall.fault ? -1 : 0;
  R.stallWire = s.stall.aoa >= 14 && !s.stall.fault && E.stallPwr ? 1 : 0;
  return R;
}
