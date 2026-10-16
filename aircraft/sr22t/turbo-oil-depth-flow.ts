/**
 * Turbocharger and wastegate oil, the upper-deck pressure reference and the wastegate bypass for flows.ts.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import type { Vec3 } from "@/lib/math";
import { WASTEGATE_BYPASS, bentRun } from "./exhaust-layout";
import { wastegateOpen, type Sim } from "./model";
import { OIL_SOURCE, OIL_CHECK, OIL_TEE, UPPER_DECK_LINE, GATE_OIL_RUN, TURBO, TURBO_SCAVENGE } from "./parts";
import { TURBO_OIL_RES } from "./parts/engine";
import { EXH } from "./engine-depth-flow";
import { flowList } from "./flow-builder";

const { F, flow } = flowList();

// Turbo oil/deck/bypass circuits: schematic paths, AMM Fig 79-30-2 sheet 3
// (PDF p. 2787), 79-00 (PDF p. 2764), Fig 81-00-1 (PDF p. 2810). Waypoints thread the
// engine mount's aft cage to the turbos low in the aft engine.
const REAR_CASE: Vec3 = [2.77, -0.22, 0];
const OIL = { r: 0.008, color: "#B49246", pcolor: "#E6CA73", count: 8 };
for (const side of [-1, 1]) {
  // Crosses outboard forward of the exhaust crossover's drop, below the mount's aft side frame and inboard of the
  // compressor duct, then drops onto the centre housing where Fig 5-33 labels the turbo oil inlet.
  // Waypoints illustrative.
  const supply: Vec3[] = [
    [2.99, -0.4, side * 0.2],
    // 5 mm further inboard than the first layout, so the intercooler inlet duct's riser keeps 5 mm
    [2.985, -0.42, side * 0.28], // approximate
    [TURBO(side)[0] + 0.014, -0.47, side * 0.295], // approximate
  ];
  // Detail C branches directly at the tee's opposite outlets. Both routes are approximate: the AMM
  // Fig 79-30-2 sheet 3 (PDF p. 2787) dimensions neither the hose bends nor their clearance offsets.
  const branch: Vec3[] =
    side < 0
      ? [
          [OIL_TEE[0], OIL_TEE[1], OIL_TEE[2] - 0.04], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
          [2.72, -0.28, -0.35], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
          [2.695, -0.36, -0.18], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
        ]
      : bentRun(
          [
            [OIL_TEE[0], OIL_TEE[1], OIL_TEE[2] + 0.04], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
            [2.73, -0.285, -0.18], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
            [2.705, -0.36, -0.17], // approximate (AMM Fig 79-30-2 sh 3, PDF p. 2787)
            // Cross aft of the sump, then forward on its RH side; approximate bends, same undimensioned figure.
            [2.755, -0.38, -0.17],
            [2.755, -0.38, 0.12],
            [2.811, -0.38, 0.12],
            [2.811, -0.38, 0.18],
            [2.9, -0.42, 0.18],
          ],
          0.004,
        ); // approximate bends, AMM Fig 79-30-2 sh 3, PDF p. 2787

  flow(
    side < 0 ? "turboOilL" : "turboOilR",
    [
      OIL_SOURCE,
      // Approximate forward/outboard departure separates the hoses at the shared cooler fitting (AMM Fig 79-30-2 sh 3, PDF 2787).
      [OIL_SOURCE[0] + 0.04, OIL_SOURCE[1] - 0.01, OIL_SOURCE[2]],
      [OIL_SOURCE[0] + 0.04, OIL_SOURCE[1] - 0.01, OIL_CHECK[2]],
      OIL_CHECK,
      OIL_TEE,
      ...branch,
      ...supply,
      TURBO(side),
    ],
    ["engine"],
    {
      ...OIL,
      name: "Turbo oil supply — check valve / tee",
      note: "Oil cooler bottom → cooler-base check valve → tee → center housing (SR22T POH 13772-007 7-38; AMM 13773-002 Rev 7 79-00 PDF p. 2764; Fig 79-30-2 sheet 3 PDF p. 2787). Routing and diameter approximate: the figure is undimensioned; the LH and RH hoses branch directly at the tee’s opposite outlets, then run independently to their centre housings.",
      groups: ["oil"],
    },
  );
  const reservoir = TURBO_OIL_RES(side);
  flow(
    side < 0 ? "turboScavL" : "turboScavR",
    [
      reservoir,
      [reservoir[0], -0.6, side * 0.2],
      [reservoir[0], -0.6, 0.08],
      [2.84, -0.6, 0.08], // under the exhaust crossover
      // Approximate rise between the gascolator and heat duct (AMM 79-00 PDF p. 2764).
      [2.79, -0.55, 0.08],
      [2.77, -0.49, 0.08],
      TURBO_SCAVENGE,
      [2.77, -0.25, 0.14], // approximate: beside the starter adapter, AMM 79-00 PDF p. 2764
      REAR_CASE,
    ],
    ["engine"],
    {
      ...OIL,
      name: "Turbo reservoir → scavenge pump → sump",
      note: "AMM 79-00 PDF p. 2764. Routing approximate.",
      groups: ["oil"],
    },
  );
}
// Supply to the wastegate actuator, actuator → controller, controller → crankcase: the connectivity of the three
// drawn oil lines (parts/engine-air.ts), with a schematic offset where they meet the MCU.
// Approximate lift of the flow's upper return waypoints over the MCU top. The physical hose stays fixed;
// AMM 13773-002 Rev 7 Fig 78-10-3 PDF p. 2742 gives connectivity, not the schematic bend clearance.
const gateOilRun = GATE_OIL_RUN().map(([x, y, z]): Vec3 => {
  const lift = Math.max(0, Math.min(1, (y + 0.03) / 0.04, (-z - 0.29) / 0.03)); // approximate
  return [x, y + (x < 2.686 && y < 0.035 ? 0.0098 * lift : 0), z]; // approximate
});
flow("gateOil", gateOilRun, ["engine"], {
  ...OIL,
  r: 0.0045, // inside the Ø12-mm hoses; approximate
  tension: 0,
  name: "Wastegate oil supply / return",
  note: "Oil pressure closes the wastegate; the controller meters the oil returning to the crankcase (POH 7-38–7-39; AMM 79-00 PDF p. 2764; AMM Fig 78-10-3 PDF p. 2742).",
  groups: ["oil"],
});
// AMM 13773-002 Rev 7 Fig 78-10-3 (PDF 2742), POH 13772-007 7-39:
// approximate pressure-line routing; retain the high run above ignition, then drop at the firewall controller.
// from the controller's own fitting on the throttle body's upstream half along the drawn hose (Fig 78-10-3); the magnetos
// have a separate fitting and hose (Continental M-18 Fig 5-35 View F-F PDF p. 150; parts/engine-ignition.ts)
flow("deckRef", UPPER_DECK_LINE, ["engine"], {
  tension: 0,
  r: 0.005,
  pcolor: "#8FD3E8",
  name: "Upper-deck pressure reference",
  note: "Controller senses throttle differential (POH 7-39; AMM Fig 78-10-3 PDF p. 2742).",
  groups: ["induction"],
});
flow("gateBypass", WASTEGATE_BYPASS, ["engine"], {
  ...EXH,
  name: "Wastegate → LH tailpipe bypass",
  note: "POH 7-38; AMM 81-20 PDF p. 2812. Routing approximate.",
  groups: ["exhaust"],
});

export const TURBO_OIL_DEPTH_FLOWS = F;

/** Particle speed multiplier per turbo oil, deck-pressure and wastegate flow (0 = stopped). */
export function turboOilDepthRates(s: Sim): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running;
  R.turboOilL = R.turboOilR = R.turboScavL = R.turboScavR = R.gateOil = run ? 0.7 : 0;
  R.deckRef = run ? 0.2 : 0;
  R.gateBypass = run ? 1.2 * wastegateOpen(s) : 0;
  return R;
}
