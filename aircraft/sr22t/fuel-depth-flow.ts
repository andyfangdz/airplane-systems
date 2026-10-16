/**
 * Fuel for flows.ts: tank feeds, the supply and return lines, injector lines, the fuel distribution drains and the tank and
 * collector vents.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import type { FlowSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import { FW, wingP } from "./geometry";
import { bentRun } from "./exhaust-layout";
import { fuelAvail, live, mapInHg, pumpSpeed, type Elec, type Sim } from "./model";
import { CYLS, injectorAnchor, THROTTLE, TANK_SPAN, tankTop } from "./parts";
import { FUEL_SELECTOR } from "./parts/cabin";
import { cylOrigin } from "./parts/engine";
import {
  COLLECTOR,
  CYL_DRAIN_CHECK,
  DRAIN_MANIFOLD,
  ENGINE_PUMP,
  FUEL_FLOW,
  FUEL_PUMP,
  GASCOLATOR,
  GASCOLATOR_DRAIN,
  NACA_FUEL_VENT,
  SPIDER,
  SPIDER_DRAIN_PORT,
  SPIDER_INLET,
  spiderOutlet,
} from "./parts/fuel";
import { flowList, off } from "./flow-builder";

const { F, flow } = flowList();

// fuel
const collector = COLLECTOR;
const tankOut = (s: number) => wingP(s * 1.15, 0.35, -1).add(V(0, 0.03, 0));
/** Selector valve port, below the handle (parts/cabin.ts). */
const SELECTOR = off(FUEL_SELECTOR, [0, -0.03, 0]);
// Each feed stays low until it is inside the console, so it rises clear of the seat pans, the GTS 800 and the A/C
// evaporator and blower (parts/cabin.ts, parts/avionics.ts, parts/aircon.ts). Illustrative waypoints.
flow(
  "fuelL",
  [
    tankOut(-1),
    collector(-1),
    [1.165, -0.555, -0.6],
    [1.19, -0.625, -0.5],
    [1.2, -0.625, -0.3],
    [1.22, -0.62, -0.08],
    SELECTOR,
  ],
  ["fuel"],
  {
    name: "Left feed line",
    note: "Collector → selector valve.",
  },
);
flow(
  "fuelR",
  [
    tankOut(1),
    collector(1),
    [1.165, -0.555, 0.6],
    [1.19, -0.625, 0.5],
    [1.2, -0.625, 0.3],
    [1.22, -0.62, 0.08],
    SELECTOR,
  ],
  ["fuel"],
  {
    name: "Right feed line",
    note: "Collector → selector valve.",
  },
);
/** Approximate outboard throttle-metering detour; POH 13772-007 7-43; AMM 13773-002 Rev 7
 * 73-30 PDF p. 2594; Continental M-18 Fig 12-10, p. 12-15. The sources give connectivity, not bend dimensions.
 * Approach the fixed metering-valve anchor from aft/outboard to clear the Y sleeve.
 * The throttle cable ends beside that anchor, so its fitting contact remains unavoidable. */
const FUEL_UPPER_RUN: Vec3[] = [
  ...bentRun(
    [
      [2.99, 0.15, 0.1],
      [3.2, 0.12, 0.1],
      [3.24, 0.12, 0.1],
      [3.27, 0.12, 0.045],
      THROTTLE,
      [3.27, 0.12, 0.045],
      [3.26, 0.11, 0.09],
      [3.25, SPIDER_INLET[1], SPIDER_INLET[2]],
    ],
    0.008,
    [THROTTLE],
  ),
  SPIDER_INLET,
  SPIDER,
]; // approximate, undimensioned routing (AMM 73-30 PDF p. 2594)
/** Approximate detour below the case and aft of the sump/RH cylinders; the source drawings give connectivity,
 * not waypoint dimensions (AMM Fig 28-20-4 PDF p. 1136; 73-30 PDF p. 2594; POH 7-43). */
const FUEL_ENGINE_RUN = bentRun(
  [
    ENGINE_PUMP,
    [2.79, -0.34, -0.07],
    [2.73, -0.34, 0.19],
    [2.73, -0.34, 0.26],
    [2.78, -0.34, 0.29],
    [2.86, -0.32, 0.29],
    FUEL_FLOW,
    [2.77, -0.19, 0.19],
    [2.77, -0.02, 0.19],
    [2.77, -0.01, 0.22],
    [2.8, 0.1, 0.22],
    [2.81, 0.1, 0.262],
    [2.88, 0.11, 0.262],
    [2.93, 0.11, 0.21],
    [2.95, 0.1, 0.15],
    [2.97, 0.13, 0.1],
    [2.99, 0.15, 0.1],
  ],
  0.008,
  [FUEL_FLOW],
); // approximate bend, AMM Fig 28-20-4 (undimensioned)
// Routing is schematic: selector through firewall to electric pump, gascolator and engine (AMM 28-20, PDF p. 1112).
flow(
  "fuelMain",
  [
    SELECTOR,
    [1.4, -0.62, 0.08],
    [1.95, -0.62, 0.24],
    [2.3, -0.645, 0.25],
    [2.5, -0.655, 0.25],
    // Approximate outboard bend clears the brake tee beside the firewall approach.
    // AMM 13773-002 Rev 7 Fig 28-20-4 PDF p. 1136 is undimensioned.
    [2.54, -0.64, 0.27],
    [2.63, -0.6, 0.15],
    FUEL_PUMP,
    GASCOLATOR,
    ...FUEL_ENGINE_RUN.slice(0, -1),
    ...FUEL_UPPER_RUN,
  ],
  ["fuel", "engine"],
  {
    name: "Fuel supply",
    note: "Selector → firewall → electric fuel pump → gascolator → engine-driven pump / mixture control → transducer → throttle metering valve → fuel manifold valve → nozzles (POH 13772-007 7-38, 7-43; AMM 13773-002 Rev 7 28-00, PDF p. 1078; 28-20, PDF p. 1112). Under-floor fuselage supply tube (AMM 28-10, PDF p. 1088; Fig 28-20-4, PDF p. 1136). Geometry approximate.",
    r: 0.014,
    groups: ["fuel"],
  },
);
// Two drawn branches show the selector routing return fuel to the selected tank (POH 7-40, Fig 7-8).
[-1, 1].forEach((side) =>
  flow(
    side < 0 ? "fuelRetL" : "fuelRetR",
    [
      ENGINE_PUMP,
      [2.792, -0.315, -0.1065], // approximate: retain the pump departure tangent, AMM Fig 28-20-3 PDF p. 1131
      // Approximate aft/inboard pass beside the gascolator; POH Fig 7-8; AMM Fig 28-20-3 PDF p. 1131.
      [2.68, -0.46, 0.145],
      [2.68, -0.57, 0.15],
      [FW + 0.03, -0.6, 0.15],
      [FW - 0.035, -0.6, 0.15],
      // Into the console from below; out under it and the tail harness (parts/electrical-harness.ts), up aft of
      // the GTS 800, then under the seat pans (parts/cabin.ts) and over the collector tank, under the OAT 2 wiring.
      // Illustrative waypoints.
      [1.6, -0.524, 0.17],
      [1.3, -0.5, 0.09],
      SELECTOR,
      [1.2, -0.53, 0],
      [1.1, -0.53, side * 0.16],
      [1.1, -0.465, side * 0.25],
      [1.1, -0.461, side * 0.36],
      [1.1, -0.485, side * 0.6],
      [1.11, -0.48, side * 0.72],
      tankTop(side),
    ],
    ["fuel"],
    {
      name: side < 0 ? "Left fuel return" : "Right fuel return",
      note: "Excess fuel → selector → selected tank (POH 13772-007 7-40, Fig 7-8). Return enters the tank top (AMM 13773-002 Rev 7 28-10, PDF p. 1088); supply and return fittings pass through the firewall enclosure (Fig 28-20-3 items 10, 15–16, PDF p. 1131). Routing and particle speed illustrative.",
      r: 0.009,
    },
  ),
);
/** Injector tubes leave the manifold valve on top of the induction manifold, run out over the manifold to each bank and
 * drop onto each nozzle (AMM Fig 71-00-2 sheet 1 item 4, PDF p. 2487; Continental M-18 Fig 12-10, p. 12-15;
 * Fig 17-39, p. 17-71). The run height clears the crankcase top and the cylinder fins. Each line stays on the manifold
 * valve's side of its own intake pipe, so it never crosses that pipe. Height and offsets are illustrative. */
const INJ_LINE_Y = -0.005;
const INJ_LINE_OFFSET = 0.045;
/** Lines drop from the valve to a fan just outboard of the manifold tube, under the throttle cable and the deck-pressure
 * line, then run out to each bank. */
const INJ_FAN_Y = 0.055;
const INJ_FAN_Z = 0.085;
const INJ_FAN_SPREAD = 1;
const injectorLine = (c: { x: number; s: number }): Vec3[] => {
  const nozzle = injectorAnchor(c);
  const x = c.x + Math.sign(SPIDER[0] - c.x) * INJ_LINE_OFFSET;
  return [
    SPIDER,
    spiderOutlet(x, c.s),
    [SPIDER[0] + INJ_FAN_SPREAD * (x - SPIDER[0]), INJ_FAN_Y, c.s * INJ_FAN_Z],
    [x, INJ_LINE_Y, c.s * 0.18],
    [nozzle[0], INJ_LINE_Y, nozzle[2]],
    nozzle,
  ];
};
CYLS.forEach((c) =>
  flow("inj" + c.n, injectorLine(c), ["fuel", "engine"], {
    name: "Injector line, cyl " + c.n,
    note: "Fuel manifold valve to cylinder-head nozzle (POH 7-38; AMM 73-00 PDF p. 2582; Fig 71-00-2 sheet 1 PDF p. 2487). Out of the valve on top of the intake manifold (Continental M-18 Fig 12-10, p. 12-15), over the engine and down onto the nozzle (M-18 Fig 17-39, p. 17-71). Routing and bore approximate.",
    r: 0.007,
    count: 5,
    tension: 0,
    groups: ["fuel"],
  }),
);

// fuel distribution drains: dry static plumbing, not supply lines.
const DRAIN = DRAIN_MANIFOLD; // AMM 28-20 PDF 1113; approximate.
const CYL_COLLECTOR: Vec3 = [3.05, -0.42, 0]; // Schematic hose junction, not the check-valve mounting position.
const CYL_CHECK = CYL_DRAIN_CHECK; // AMM Fig 71-70-2 detail A item 12, PDF p. 2565.
/** The manifold valve drain leaves its aft side, runs downhill aft over the induction manifold, under the A/C suction line and out over the right
 * magneto, then drops between the crankcase and cylinder 1, outboard of the slinger supply line and inboard of the mount isolator. Above the
 * heat duct it moves inboard of it and of the turbo scavenge lines, drops forward of the mount's lower cross tube, then runs aft
 * inside the lower cowl into the firewall drain manifold
 * (AMM 28-20, PDF p. 1113; Fig 71-70-2, PDF p. 2565). Waypoints approximate because the figure is undimensioned; the final bend stays inside the POH 13772-007 Fig 1-1 (p. 1-4) lower cowl. They keep the whole drain 5 mm off every part and rendered tube. */
const SPIDER_DRAIN_RUN: Vec3[] = [
  [2.8, SPIDER_DRAIN_PORT[1] - 0.009, SPIDER_DRAIN_PORT[2]],
  [2.79, SPIDER_DRAIN_PORT[1] - 0.009, 0.17],
  [2.79, -0.45, 0.17],
  [2.795, -0.465, 0.11],
  [2.797, -0.475, 0.05],
  [2.797, -0.635, 0.05],
  [2.705, -0.635, 0.02],
];
const drain = (key: string, pts: FlowSpec["pts"], name: string, ref = "Fig 71-70-2, PDF p. 2565") =>
  flow(key, pts, ["fuel", "engine"], {
    name,
    note:
      "Drain to bottom-centre firewall manifold, not a fuel feed (AMM 13773-002 Rev 7 28-20, PDF p. 1113; " +
      ref +
      "). Routing and bore approximate. Static dry hose; no particles.",
    r: 0.004,
    color: "#806B53",
    count: 0,
    tension: 0,
    groups: ["fuel"],
  });
drain("fuelDrainAux", [off(FUEL_PUMP, [0, -0.04, 0]), [2.72, -0.63, 0.22], DRAIN], "Auxiliary pump drain");
drain(
  "fuelDrainGas",
  [off(GASCOLATOR, [0, -0.05, 0]), [2.73, -0.63, 0.08], DRAIN],
  "Gascolator bowl drain tube",
  "Fig 28-20-1 items 7–11, PDF p. 1116",
);
// Approximate departure aft of the mixture-cable end, AMM Fig 71-70-2 PDF p. 2565.
drain(
  "fuelDrainEngine",
  [ENGINE_PUMP, [2.815, -0.293, -0.145], [2.81, -0.34, -0.16], [2.76, -0.56, -0.12], DRAIN],
  "Engine-driven pump drain",
);
drain("fuelDrainSpider", [SPIDER_DRAIN_PORT, ...SPIDER_DRAIN_RUN, DRAIN], "Injection manifold drain");
/** The rear cylinders (1, 2) sit over their bank's turbocharger transition and the crossover legs: their drains run
 * inboard above the transition first, then down inboard of the crossover. Approximate. */
const REAR_DRAIN_Z = 0.18; // approximate: outside the case, AMM Fig 71-70-2 PDF p. 2565
CYLS.forEach((c) =>
  drain(
    "fuelDrainCyl" + c.n,
    [
      off(cylOrigin(c), [0, -0.1, c.s * 0.08]),
      ...(c.n <= 2
        ? ([
            [c.x, -0.29, c.s * REAR_DRAIN_Z], // approximate, above the transition
            [c.x, -0.44, c.s * REAR_DRAIN_Z], // approximate, below the slinger hose
          ] as Vec3[])
        : ([[c.x, c.s > 0 ? -0.44 : -0.42, c.s * 0.26]] as Vec3[])),
      // Approximate RH drain under the slinger line, AMM Fig 71-70-2 PDF p. 2565.
      ...(c.s > 0 ? ([[CYL_COLLECTOR[0], -0.44, 0.07]] as Vec3[]) : []),
      CYL_COLLECTOR,
    ],
    "Cylinder " + c.n + " drain → collector",
  ),
);
// Approximate lower-cross-member bypass inside the cowl; undimensioned AMM
// Fig 71-70-2 (PDF p. 2565), POH Fig 1-1 (p. 1-4) loft; retain 5 mm mount clearance.
drain(
  "fuelDrainHeads",
  [CYL_COLLECTOR, [2.87, -0.59, 0], [2.82, -0.635, 0], [2.705, -0.635, -0.05], CYL_CHECK, DRAIN],
  "Cylinder drain collector → check valve → firewall",
  "Fig 71-70-2 detail A item 12, PDF p. 2565",
);
drain(
  "fuelDrainOutlet",
  [DRAIN, GASCOLATOR_DRAIN],
  "Gascolator preflight drain valve",
  "Fig 28-20-1 items 7–11, PDF p. 1116",
);

// fuel storage: vents
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  // Approximate outboard top fitting: POH 13772-007 Fig 7-8 (p. 7-42); AMM 13773-002 Rev 7
  // 28-10 pp. 1–2 (PDF 1088–1089), Fig 28-10-3 items 6–7 (PDF 1105), Fig 6-00-7 (PDF 124).
  // Undimensioned station; 0.85 matches the illustrative tank loft in Airplane.tsx, not a manual dimension.
  const mean = wingP(s * TANK_SPAN[1], 0.45, 0);
  const top = mean.lerp(wingP(s * TANK_SPAN[1], 0.45, 1), 0.85);
  // The right vent bends aft of the RH-wing GMU 44 magnetometers (parts/avionics.ts) instead of through them.
  const bend = s > 0 ? wingP(4.8, 0.55, 0).lerp(wingP(4.8, 0.55, 1), 0.4) : wingP(-4.8, 0.45, 0);
  flow("fuelVent" + side, [top, bend, NACA_FUEL_VENT(s)], ["fuel"], {
    name: (s > 0 ? "Right" : "Left") + " tank vent line",
    note: "Connects the tank top and the outboard lower-skin NACA scoop (POH 13772-007 7-40; AMM 13773-002 Rev 7 28-10, PDF pp. 1088–1089, Fig 28-10-3 items 6–7, PDF p. 1105; Fig 6-00-7 LW10/RW10, PDF p. 124). Fuel-resistant plastic; no moisture-trapping low points. The vent line maintains positive tank pressure (POH 7-40); no source gives a vent flow rate, so the line is drawn static. Top fitting station and 0.85 thickness fraction approximate: the figures are undimensioned; fraction matches the rendered tank bay. Routing and bore illustrative.",
    r: 0.006,
    tension: 0,
  });
  flow("collectorVent" + side, [off(collector(s), [0, 0.035, 0]), tankTop(s)], ["fuel"], {
    name: (s > 0 ? "Right" : "Left") + " collector vent",
    note: "Connects the collector top and the associated tank inboard rib (POH 13772-007 7-40, Fig 7-8, 7-42; AMM 13773-002 Rev 7 28-10, PDF p. 1089, Fig 28-10-3 item 3, PDF p. 1105). Neither source gives a flow direction, so the line is drawn static. Routing and bore illustrative.",
    r: 0.006,
    tension: 0,
  });
});

export const FUEL_DEPTH_FLOWS = F;

/** Particle speed multiplier per fuel flow (0 = stopped; negative = reversed). */
export function fuelDepthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running;
  const speed = pumpSpeed(s, E, live.rpm, mapInHg(s, live.rpm), s.paFt);
  const feed = run || speed !== "off",
    ok = fuelAvail(s);
  R.fuelL = feed && ok && s.fuel.sel === "L" ? 1 : 0;
  R.fuelR = feed && ok && s.fuel.sel === "R" ? 1 : 0;
  // Particle rates are illustrative, not measured fuel flow.
  R.fuelMain = feed && ok ? (speed === "high" ? 1.8 : speed === "low" ? 1.4 : 1) : 0;
  R.fuelRetL = run && ok && s.fuel.sel === "L" ? 1 : 0;
  R.fuelRetR = run && ok && s.fuel.sel === "R" ? 1 : 0;
  // fuel storage: vents. Static: POH 7-40 and AMM 28-10 (PDF p. 1089) give no vent flow rate or direction.
  R.fuelVentL = R.collectorVentL = R.fuelVentR = R.collectorVentR = 0;
  // fuel distribution
  R.fuelDrainAux = R.fuelDrainGas = R.fuelDrainEngine = R.fuelDrainSpider = R.fuelDrainHeads = R.fuelDrainOutlet = 0;
  CYLS.forEach((c) => (R["fuelDrainCyl" + c.n] = 0));
  CYLS.forEach((c) => (R["inj" + c.n] = run && ok ? 1 : 0));
  return R;
}
