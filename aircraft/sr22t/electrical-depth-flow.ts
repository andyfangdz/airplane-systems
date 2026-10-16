/**
 * Electrical wiring for flows.ts: alternator outputs, battery feeds, the MCU distribution buses to the breaker panel, the
 * starter cable and the landing light feed and lamp lead.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import { bentRun } from "./exhaust-layout";
import { extLit, type Elec, type Sim } from "./model";
import { ALT1_TERM, ALT2_TERM, BAT2_BOX, BAT2_SIZE, MCU } from "./parts";
import { CB_PANEL } from "./parts/cabin";
import { BAT_1, LAND_BALLAST, mcuRelayPos } from "./parts/electrical";
import { cowlLampAxis } from "./parts/lights";
import { STARTER } from "./parts/engine";
import { flowList, off } from "./flow-builder";

const { F, flow } = flowList();

// electrical wiring
flow(
  "alt1",
  // Approximate bends: forward of the sump, then aft in the LH lane below the cylinders and above the mount.
  // AMM 13773-002 Rev 7 Fig 24-30-3 item 6, PDF p. 714 gives connectivity, not bend dimensions.
  bentRun(
    [
      ALT1_TERM,
      off(ALT1_TERM, [0, -0.03, 0.03]),
      [3.55, -0.33, 0.25],
      [3.54, -0.34, 0.24],
      [3.46, -0.32, 0.14],
      [3.46, -0.32, -0.26],
      [3.32, -0.3, -0.26],
      [2.68, -0.24, -0.26],
      [2.66, -0.18, -0.24],
      [2.64, -0.12, -0.24],
      off(MCU, [0.02, -0.04, 0.04]),
    ],
    0.008,
  ),
  ["electrical"],
  {
    name: "ALT 1 output",
    note: "6 AWG cable from the ALT 1 power terminal to the MCU; 100 A fuse into Main Distribution Bus 1 (AMM 13773-002 24-30 PDF p. 704; Fig 24-30-3 item 6). Route approximate.",
  },
);
flow("alt2", [ALT2_TERM, [3.3, -0.24, -0.3], [2.9, -0.3, -0.34], off(MCU, [0.02, 0.02, 0])], ["electrical"], {
  name: "ALT 2 output",
  note: "6 AWG cable from the ALT 2 terminals to the MCU; 80 A fuse into Main Distribution Bus 2 (POH 7-49; AMM 13773-002 24-30 PDF p. 704); POH Fig 7-10 (7-48) prints 60 A, the 7-49 text governs. Route approximate.",
});
// along the firewall above the starter and the oil filter, below the wastegate controller's oil return
// and the A/C hoses; route approximate
flow(
  "bat1",
  [off(BAT_1, [0, 0, -0.1]), [2.68, -0.05, 0.12], [2.63, -0.05, 0], [2.63, -0.05, -0.12], off(MCU, [0.01, 0.04, 0.07])],
  ["electrical"],
  {
    name: "BAT 1 feed",
    note: "BAT 1 relay connects the battery to the MCU distribution buses and starter relay.",
  },
);
// electrical distribution: the MCU distribution buses feed the circuit breaker panel buses through 30 A
// fuses, one bundle per distribution bus (POH 7-49). Side by side, they leave the MCU outboard of the DME data path's
// riser, pass between the MAG 2 wiring (magData2) and the traffic data path (trafficData), cross under the throttle
// cable inside the console and reach the back of the panel between the ELT remote switch and the ELT remote cable on the
// floor (parts/cabin.ts). Routes approximate.
(
  [
    ["cbMdb1", "Main Distribution Bus 1", "A/C BUS 1, A/C BUS 2 and MAIN BUS 3"],
    ["cbMdb2", "Main Distribution Bus 2", "NON ESS BUS, MAIN BUS 1 and MAIN BUS 2"],
    ["cbEss", "Essential Distribution Bus", "ESS BUS 1 and ESS BUS 2"],
  ] as const
).forEach(([key, bus, feeds], i) => {
  const z = -0.33 + i * 0.017,
    y = -0.468 - i * 0.017;
  flow(
    key,
    [
      [MCU[0] - 0.04, MCU[1] - 0.06, z],
      [2.58, -0.33, z],
      [2.5, -0.36, z],
      [2.4, -0.4, z],
      // under the throttle cable's bend (parts/engine-air.ts THROTTLE_CABLE)
      [2.2, y - 0.03, -0.1],
      [2.1, y - 0.035, -0.1],
      [2.03, y, -0.088],
      [CB_PANEL[0] + 0.15, y, CB_PANEL[2] + 0.025],
    ],
    ["electrical"],
    {
      name: bus + " → breaker panel",
      note: `The ${bus} in the MCU feeds ${feeds} on the circuit breaker panel through 30 A fuses (SR22T POH 13772-007 7-49). The panel is on the left side of the center console (POH 7-50; AMM 13773-002 24-50 PDF p. 750). Route approximate.`,
      r: 0.005,
    },
  );
});
flow(
  "bat2",
  [
    // terminal on the forward face of the BAT 2 container (parts/electrical.ts)
    [BAT2_BOX[0] + BAT2_SIZE[0] / 2, BAT2_BOX[1], BAT2_BOX[2]],
    // Over the A/C condenser and condenser blower under the baggage floor (parts/aircon.ts). Illustrative.
    [-0.45, -0.46, -0.08],
    [-0.1, -0.455, -0.085],
    // outboard of the flap actuator under the baggage floor (parts/cabin.ts FLAP_ACT). Illustrative.
    [0.3, -0.53, -0.16],
    [0.6, -0.62, -0.17],
    [1.55, -0.55, -0.15],
    // the circuit breaker panel holds the BAT 2 breaker's ESS BUS 1 (parts/cabin.ts); neither is modelled on its own
    off(CB_PANEL, [0, -0.02, -0.01]),
  ],
  ["electrical"],
  {
    name: "BAT 2 feed",
    note: "Through the 20 A BAT 2 circuit breaker to ESS BUS 1 (SR22T POH 13772-007 7-50; AMM 13773-002 24-50 PDF p. 750). Charged from ESS BUS 1 (POH 7-47). Route approximate.",
  },
);
// Starter cable: the starter relay in the MCU switches BAT 1 to the starter (POH Fig 7-10, 7-48; 7-37). The MCU and the
// starter are both on the engine side of the firewall (POH 7-47), so the run stays on the firewall face. Route approximate.
flow(
  "starterCable",
  [
    mcuRelayPos(2),
    // Approximate inboard departure above the buses, down beside them, below the filter adapter to the starter.
    // SR22T POH 13772-007 Fig 7-10, 7-48; neither source dimensions these schematic bends.
    [2.63, -0.01, -0.33],
    [2.63, -0.01, -0.235],
    [2.635, -0.12, -0.22],
    [2.635, -0.25, -0.2],
    [2.635, -0.25, -0.12],
    off(STARTER, [0, 0, -0.065]),
  ],
  ["electrical"],
  {
    name: "Starter cable",
    note: "Starter relay in the MCU → starter (SR22T POH 13772-007 Fig 7-10, 7-48). Carries current only while the key is held at START with STARTER power available: 2 A STARTER circuit breaker on the NON-ESSENTIAL BUS (POH 7-37). Route approximate.",
    r: 0.008,
  },
);
// Landing light feed: LAND energizes the MCU relay, which completes the 28 VDC circuit from Main Distribution Bus 1 to the
// ballast on the firewall (POH 7-57); the lamp lead (landLamp, below) carries it on to the HID lamp in the lower cowl.
flow(
  "landFeed",
  [
    mcuRelayPos(4),
    // Approximate inboard lane beside the MCU buses and ALT 2 regulator; POH 13772-007 7-57, Fig 7-10.
    [2.64, -0.01, -0.24],
    [2.64, -0.2, -0.24],
    off(LAND_BALLAST, [0, 0.045, -0.04]),
  ],
  ["electrical", "lighting"],
  {
    name: "Landing light feed",
    note: "Landing light relay in the MCU → ballast on the firewall: LAND energizes the relay, completing a 28 VDC circuit from Main Distribution Bus 1 through a 7.5 A fuse (SR22T POH 13772-007 7-57, 7-49). The ballast then powers the HID lamp in the lower cowl (POH 7-57) through the lamp lead. Route approximate.",
    r: 0.006,
  },
);
// Landing light lamp lead: ballast → HID lamp. POH 13772-007 7-57 puts the ballast on the firewall and the
// lamp in the lower engine cowl; AMM 13773-002 Rev 7 Fig 33-40-1 (PDF p. 1588; 33-40 p. 7) shows the lamp harness
// running inside the lower cowl to the lamp seated behind its lens in the cowl skin. Neither document dimensions the
// route (and the AMM figure shows the later LED lamp), so the waypoints are approximate: inboard from the ballast's
// inboard face, forward under the oil sump and the alternate air ducts to the lamp's top face, kept 5 mm clear of every
// engine-bay part and tube and of the cowl skin.
flow(
  "landLamp",
  [
    off(LAND_BALLAST, [0, 0, 0.06]),
    [2.64, -0.4, -0.095],
    [2.69, -0.45, -0.04],
    [2.86, -0.47, -0.09],
    [3.49, -0.48, -0.09],
    [3.515, -0.455, -0.07],
    cowlLampAxis(0.045),
    cowlLampAxis(0.015),
  ],
  ["electrical", "lighting"],
  {
    name: "Landing light lamp lead",
    note: "Landing light ballast on the firewall → HID landing light in the lower cowl: the ballast provides the boosted voltage that lights the lamp, live whenever the landing light feed is (SR22T POH 13772-007 7-57). The harness runs inside the lower cowl to the lamp (AMM 13773-002 Fig 33-40-1, PDF p. 1588). Route approximate: neither document dimensions it.",
    r: 0.006,
  },
);

export const ELECTRICAL_DEPTH_FLOWS = F;

/** Particle speed multiplier per electrical flow (0 = stopped; negative = reversed). */
export function electricalDepthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  R.alt1 = E.alt1 ? 1 : 0;
  R.alt2 = E.alt2 ? 1 : 0;
  R.bat1 = !E.bat1ok ? 0 : E.bat1Charging ? -0.6 : 1;
  // electrical distribution: each breaker-panel bundle runs on its own distribution bus (POH 7-49); BAT 2
  // through its breaker (POH 7-50), charging or supplying; the starter cable while cranking (POH 7-37; Fig 7-10, 7-48);
  // the landing-light feed and the ballast's lamp lead through the LAND-energized MCU relay (POH 7-57)
  R.cbMdb1 = E.mdb1 > 0 ? 1 : 0;
  R.cbMdb2 = E.mdb2 > 0 ? 1 : 0;
  R.cbEss = E.edb > 0 ? 1 : 0;
  R.bat2 = !E.bat2ok ? 0 : E.bat2Charging ? -0.6 : E.bat2Supplying ? 1 : 0;
  R.starterCable = E.starterPwr && s.eng.key === "START" ? 1 : 0;
  R.landFeed = R.landLamp = extLit(s, E).land ? 1 : 0;
  return R;
}
