/**
 * Induction, exhaust and the engine oil circuit for flows.ts.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import type { FlowSpec } from "@/lib/catalogue";
import { COMPRESSOR_INLET, COMPRESSOR_OUTLET } from "./turbo-layout";
import { DUCT7, INTERCOOLER_IN } from "./intercooler-layout";
import { CROSSOVER, TAILPIPE } from "./exhaust-layout";
import { altAirOpen, type Sim } from "./model";
import {
  CYLS,
  GOV,
  EXHAUST_RUN,
  OIL_SCREEN,
  OIL_PUMP,
  OIL_CONTROL,
  OIL_COOLER,
  INDUCTION_Y,
  INTAKE_MANIFOLD,
  AIR_BOX,
  INLET_RUN,
  INTAKE_RUN,
  cylIntake,
  COMPRESSOR_RUN,
  ALTERNATE_DUCT,
  THROTTLE,
} from "./parts";
import { OIL_FILTER, OIL_FILTER_ADAPTER, OIL_SUMP } from "./parts/engine";
import { flowList, off } from "./flow-builder";

const { F, flow } = flowList();

// induction & exhaust: NACA duct → air box → turbocharger compressor → intercooler → "Y" junction → throttle body → intake
// manifold → intake pipes (top induction); cylinders → header → turbocharger turbine → tailpipe (bottom exhaust) (POH 7-37, 7-38)
const AIR_IN: Partial<FlowSpec> = { tube: false, pcolor: "#8FD3E8", size: 0.07, groups: ["induction"] };
/** Exhaust pipe style, shared with the wastegate bypass (turbo-oil-depth-flow.ts). */
export const EXH = { r: 0.016, color: "#8A5A3C", pcolor: "#FF8A4A" } as const;
const PLENUM = INTAKE_MANIFOLD;
// three segments per side: the NACA inlet stops when the filter is blocked, while the air box onward keeps flowing
// on alternate air (POH 7-37); the inlet runs along the drawn inlet duct, through the air box's forward face into the
// filter housing
[1, -1].forEach((s) =>
  flow(s > 0 ? "inletR" : "inletL", [...INLET_RUN(s), AIR_BOX(s)], ["engine"], { ...AIR_IN, tension: 0 }),
);
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  flow(
    "intake" + side,
    [off(COMPRESSOR_INLET(s), [0.003, 0, 0]), off(COMPRESSOR_INLET(s), [-0.003, 0, 0])],
    ["engine"],
    {
      ...AIR_IN,
      name: "Air box → compressor",
      note: "POH 7-37; AMM Fig 81-00-1 PDF p. 2810. Routing approximate.",
    },
  );
  flow(
    "compressor" + side,
    [
      // along the drawn intercooler inlet duct, up into the aft hood from below
      COMPRESSOR_OUTLET(s),
      ...COMPRESSOR_RUN(s),
      // forward through the core, out of the forward neck
      [INTERCOOLER_IN(s)[0] + 0.02, INTERCOOLER_IN(s)[1] + 0.035, INTERCOOLER_IN(s)[2]],
      // duct 7 forward, inboard and up across the front of the cylinders to the "Y" junction (AMM Fig 71-60-2 sheet 2):
      // the drawn duct's own centreline, from the neck spigot (INTERCOOLER_OUT)
      ...DUCT7(s),
      INDUCTION_Y,
      THROTTLE,
    ],
    ["engine"],
    {
      ...AIR_IN,
      name: "Compressor → intercooler → Y junction",
      note: "POH 7-37; AMM Fig 81-20-1 PDF p. 2815 (coupler 9 to the induction tube); Fig 71-60-2 PDF pp. 2557–2558 (duct into the intercooler's aft end from below, forward neck to duct 7). Along the drawn ducts; routing approximate.",
    },
  );
});
// the alternate air assembly feeds both air boxes when its door is open (POH 7-37)
[1, -1].forEach((s) =>
  flow(s > 0 ? "altAirR" : "altAirL", ALTERNATE_DUCT(s), ["engine"], {
    r: 0.02,
    tension: 0,
    color: "#8A969E",
    pcolor: "#D9C27A",
    count: 4,
    name: "Alternate air tube",
    note: "Alternate air assembly → air box; unfiltered cowl air when the door is open (POH 7-37).",
    groups: ["induction"],
  }),
);
// ends at the manifold's aft end (parts/engine-air.ts)
flow("manifold", [THROTTLE, PLENUM, off(PLENUM, [-0.34, -0.01, 0])], ["engine"], {
  r: 0.022,
  color: "#8A969E",
  pcolor: "#8FD3E8",
  count: 5,
  name: "Intake manifold",
  note: "From the throttle body, divided by the intake pipes to each cylinder (POH 7-37).",
  groups: ["induction"],
});
CYLS.forEach((c) =>
  flow("man" + c.n, [...INTAKE_RUN(c).slice(0, -1), cylIntake(c)], ["engine"], {
    r: 0.01,
    tension: 0,
    color: "#8A969E",
    pcolor: "#8FD3E8",
    count: 4,
    name: "Intake pipe",
    note: "Intake manifold → cylinder (POH 7-37).",
    groups: ["induction"],
  }),
);
CYLS.forEach((c) =>
  flow("exh" + c.n, EXHAUST_RUN(c), ["engine"], {
    ...EXH,
    count: 4,
    tension: 0,
    name: "Header → turbine inlet",
    note: "Slip-jointed elbow riser / tee / turbocharger transition → turbine inlet (POH 13772-007 7-38; AMM 13773-002 Rev 7 Fig 78-10-2 PDF p. 2740). Routing approximate.",
    groups: ["exhaust"],
  }),
);
[1, -1].forEach((s) =>
  flow(s > 0 ? "tailpipeR" : "tailpipeL", TAILPIPE(s), ["engine"], {
    ...EXH,
    r: 0.024,
    name: "Exhaust tailpipe",
    note: "Turbine discharge → overboard through the lower cowling; no muffler (POH 7-38).",
    ext: true,
    groups: ["exhaust"],
  }),
);
flow("crossover", CROSSOVER, ["engine", "environment"], {
  ...EXH,
  r: 0.02,
  tension: 0,
  name: "Exhaust crossover",
  note: "Crossover pipe joining the LH and RH header assemblies, through the cabin heat exchanger (AMM 78-00).",
  groups: ["exhaust"],
});
flow(
  "oil",
  [
    OIL_SUMP,
    OIL_SCREEN,
    OIL_PUMP,
    // up through the adapter on the pump housing into the vertical spin-on filter, then out to the cooler's control
    // valve below the cooler (Continental M-18 Fig 13-10 PDF p. 374)
    OIL_FILTER_ADAPTER,
    OIL_FILTER,
    [2.712, -0.12, -0.19],
    OIL_CONTROL,
    OIL_COOLER,
    // into the case outboard of and below the left magneto, which sits forward of the accessory face
    // Approximate gallery approach below the magneto before rising inside the case; POH 7-36;
    // AMM 13773-002 Rev 7 79-00 PDF p. 2764 gives the circuit, not waypoint dimensions.
    [2.75, -0.08, -0.13],
    [2.89, -0.08, 0],
    [2.95, -0.02, 0],
    [3.35, -0.02, 0],
    GOV,
  ],
  ["engine", "propeller"],
  {
    r: 0.01,
    color: "#B85A2A",
    name: "Oil circuit",
    note: "Sump → suction strainer → pump (relief valve at its outlet) → full-flow filter → engine-mounted oil cooler (bypassed below about 180 °F) → galleries, and to the propeller governor (SR22T POH 13772-007 7-36; AMM 13773-002 Rev 7 79-00 PDF p. 2764). Routing schematic and particle rates illustrative.",
    groups: ["oil"],
  },
);

export const ENGINE_DEPTH_FLOWS = F;

/** Particle speed multiplier per induction, exhaust and oil-circuit flow (0 = stopped). */
export function engineDepthRates(s: Sim): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running;
  CYLS.forEach((c) => {
    R["man" + c.n] = run ? 1 : 0;
    R["exh" + c.n] = run ? 1.2 : 0;
  });
  R.inletL = R.inletR = run && !altAirOpen(s) ? 1 : 0;
  R.intakeL = R.intakeR = R.manifold = run ? 1 : 0;
  R.compressorL = R.compressorR = run ? (s.turbo.fail === "leak" ? 0.35 : 1) : 0;
  R.altAirL = R.altAirR = altAirOpen(s) ? 1 : 0;
  R.tailpipeL = R.tailpipeR = R.crossover = run ? 1.2 : 0;
  R.oil = run ? 0.7 : 0;
  return R;
}
