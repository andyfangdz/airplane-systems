/**
 * Cabin air and air conditioning for flows.ts: the heat and fresh-air inlets, mixing chamber, distribution manifold and
 * outlet ducts, the refrigerant loop and the A/C air path.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import type { Vec3 } from "@/lib/math";
import { botY } from "./geometry";
import { acCompressorOn, type Elec, type Sim } from "./model";
import {
  AC,
  HEAT_X,
  INTERCOOLER_AFT,
  airflowValveOpen,
  butterflies,
  freshValveOpen,
  hotValveOpen,
  valveEnv,
} from "./parts";
import { COWL_LOUVERS } from "./parts/cowl";
import { AC_FITTING } from "./parts/aircon";
import {
  BLOWER,
  CABIN_AIR_COUPLER,
  CREW_DISPLAY_VENT,
  CREW_FLOOR_VENT,
  CREW_PANEL_VENT,
  DEFROST_VENT,
  DIST_MANIFOLD,
  FRESH_INLET,
  FRESH_VALVE,
  HOT_VALVE,
  MIX,
  PAX_FLOOR_VENT,
  PAX_PANEL_VENT,
} from "./parts/environment";
import { flowList, off } from "./flow-builder";

const { F, flow } = flowList();

// environmental: POH 7-64 … 7-66, Fig 7-13; AMM 21-20, 21-40 (Fig 21-40-2), 21-60
const AIR = "#149C94";
/** Heated air dumped into the engine compartment leaves through the RH cowl exit louvers (parts/cowl.ts; POH 7-38). */
const LOUVERS_R = COWL_LOUVERS(1);
/** Intercooler-port heat ducts: 20 mm radius (illustrative) so each leaves its rear-port nozzle between BAT 1 and the
 * cowl skin. */
const HEAT_DUCT_R = 0.02;
/** Heat-duct pass through the shroud: on the aft side of the crossover, 0.05 m off its axis (approximate), so the
 * Ø0.04-m duct clears the Ø0.04-m crossover pipe (7 mm on the drawn curve). It reads as the annular
 * pass, its aft edge 10 mm outside the Ø0.12-m shroud. AMM Fig 21-40-2 PDF p. 495 shows the shroud ducts clamped to the
 * heat exchanger, undimensioned. */
const SHROUD_PASS = 0.05;
/** The heat-exchanger shroud's inboard end, where the ducts enter it, reached from aft of the engine (Both
 * rear ports sit at the accessory face). */
const SHROUD_IN: Vec3 = [HEAT_X[0] - SHROUD_PASS, HEAT_X[1], HEAT_X[2] - 0.1];
/** The heated air leaves the shroud aft at the heat exchanger's station. */
const SHROUD_OUT: Vec3 = [HEAT_X[0] - SHROUD_PASS, HEAT_X[1], HEAT_X[2]];
/** Where the LH duct meets the RH one: aft of the nose-gear support's rise and below its fore-aft run, clear of
 * the turbo scavenge lines and the fuel drains. Illustrative. */
// First shared waypoint: render the downstream trunk once. POH 7-64; AMM 21-40 PDF p. 486,
// Fig 21-40-2. Coordinates approximate: neither source dimensions this junction.
const HEAT_DUCT_JOIN: Vec3 = [2.73, -0.525, -0.04];
// each inlet duct is split at its valve: the inlet side runs up to the valve, the chamber side only flows when the valve
// admits air (flowRates)
flow(
  "freshIn",
  // outboard of the RH air box and turbo, inboard of the engine mount's side frame. The duct starts on the
  // inlet's inner face, 29 mm inboard (its 25 mm radius plus clearance), so it stays inside the POH 13772-007 Fig 1-1
  // (p. 1-4) cowl loft behind the NACA inlet; approximate, the AMM 21-00 gives no duct dimensions.
  [off(FRESH_INLET, [-0.01, 0, -0.029]), [3.1, -0.46, 0.44], [2.9, -0.46, 0.44], [2.79, -0.45, 0.43], FRESH_VALVE],
  ["environment"],
  {
    r: 0.025,
    color: AIR,
    pcolor: "#5FC8F0",
    name: "Fresh-air duct",
    note: "NACA inlet → fresh-air valve on the forward firewall → mixing chamber (POH 7-64, 7-65).",
  },
);
// both valves open into the mixing chamber (parts/environment.ts)
flow("fresh", [FRESH_VALVE, off(MIX, [0.02, 0.03, 0.03])], ["environment"], {
  r: 0.025,
  color: AIR,
  pcolor: "#5FC8F0",
});
// RH intercooler rear port → down between BAT 1 and the cowl, under the A/C hoses and the starter, between the starter
// and the throttle cable → under the engine to the crossover-tube heat exchanger → hot-air valve → mixing
// chamber (POH 7-64; AMM Fig 21-40-2 PDF p. 486). The rear port sits at the accessory face (Continental
// M-18 Fig 5-33), so the duct stays aft of the turbos and the mount's aft feet. Waypoints illustrative.
flow(
  "hotIn",
  [
    INTERCOOLER_AFT(1),
    [2.725, -0.09, 0.462],
    [2.72, -0.2, 0.46],
    [2.715, -0.25, 0.42],
    [2.7, -0.25, 0.35],
    [2.68, -0.25, 0.2],
    // under the starter along the firewall, aft of the mixture cable: the vertical oil filter now stands where the duct
    // crossed over the starter
    [2.645, -0.33, 0.15],
    [2.64, -0.335, 0.02],
    [2.66, -0.345, -0.055],
    [2.695, -0.35, -0.075],
    [2.7, -0.45, -0.085],
    [2.725, -0.52, -0.075],
    HEAT_DUCT_JOIN,
    [2.76, -0.525, 0],
    [SHROUD_IN[0], -0.52, 0],
    SHROUD_IN,
    SHROUD_OUT,
    [2.8, -0.52, 0.14],
    [2.73, -0.525, 0.17],
    HOT_VALVE,
  ],
  ["environment"],
  {
    r: HEAT_DUCT_R,
    color: "#E0522B",
    pcolor: "#FF7A3D",
    name: "Heat duct",
    note: "Ram air from the rear ports of both intercoolers (the nozzle on each intercooler's aft hood, AMM Fig 71-60-2 sheet 2 item 19) → crossover-tube heat exchanger → hot-air valve → mixing chamber (POH 7-64; AMM 21-40 PDF p. 486, Fig 21-40-2). Routing illustrative.",
  },
);
flow("hot", [HOT_VALVE, off(MIX, [0.02, -0.02, -0.02])], ["environment"], {
  r: 0.025,
  color: "#E0522B",
  pcolor: "#FF7A3D",
});
// LH intercooler rear port → down the aft left of the engine, outboard of the MCU and above the wastegate actuator,
// under the engine → joins the RH duct, which alone continues into the shroud (POH 7-64: "the rear ports of the intercoolers"; AMM 21-40 PDF 486,
// Fig 21-40-2). Waypoints illustrative.
flow(
  "hotL",
  [
    INTERCOOLER_AFT(-1),
    [2.725, -0.09, -0.463],
    [2.71, -0.2, -0.46],
    [2.7, -0.33, -0.4],
    [2.7, -0.36, -0.2],
    [2.698, -0.4, -0.1],
    [2.71, -0.48, -0.08],
    HEAT_DUCT_JOIN,
  ],
  ["environment"],
  {
    r: HEAT_DUCT_R,
    color: "#E0522B",
    pcolor: "#FF7A3D",
    name: "Heat duct",
  },
);
// valves closed: the air exits into the engine compartment and leaves with the engine cooling airflow (POH 7-64, 7-65)
flow("hotDump", [HOT_VALVE, [2.84, -0.57, 0.3], off(LOUVERS_R, [0.03, 0, 0.06])], ["environment"], {
  tube: false,
  pcolor: "#FF7A3D",
  size: 0.05,
  name: "Hot air dumped overboard",
  note: "With the hot-air valve closed the heated air exits into the engine compartment and is exhausted overboard with the engine cooling airflow (POH 7-64).",
});
flow("freshDump", [FRESH_VALVE, [2.84, -0.5, 0.46], off(LOUVERS_R, [0.03, 0.02, 0.05])], ["environment"], {
  tube: false,
  pcolor: "#5FC8F0",
  size: 0.05,
  name: "Fresh air dumped overboard",
  note: "With the fresh-air valve closed the air exits into the engine compartment and is exhausted overboard with the engine cooling airflow (POH 7-65).",
});
/** Distribution manifold (parts/environment.ts), above the aileron push rod and sector. */
const E0 = DIST_MANIFOLD;
// through the firewall into the cabin air coupler (duct temperature sensor), up the right side aft of the aileron push rod
// (x 2.54, y −0.2), into the manifold's right end
flow("toMan", [MIX, CABIN_AIR_COUPLER, [2.46, -0.3, 0.24], [2.5, -0.12, 0.2], E0], ["environment"], {
  r: 0.03,
  color: AIR,
  name: "Mixing chamber → manifold",
  note: "Mixing chamber air ducted directly into the distribution system; with the A/C selected it goes through the evaporator assembly instead and this duct carries nothing (POH 7-64; AMM 21-50 PDF p. 496).",
});
// blower on the evaporator assembly under the RH crew seat → forward along the floor between the RH pedals → manifold
// bottom (POH Fig 7-13; AMM 21-20; AMM Fig 21-50-1 sheet 3, PDF p. 521)
flow(
  "fanDuct",
  [
    off(BLOWER, [0.06, 0, 0]),
    // forward off the blower under the RH crew seat, down to the floor outboard of the fuel return lines;
    // approximate
    [1.95, -0.5, 0.215],
    [2.05, -0.63, 0.22],
    [2.3, -0.56, 0.25],
    [2.47, -0.35, 0.12],
    off(E0, [-0.02, -0.06, 0.05]),
  ],
  ["environment"],
  {
    r: 0.022,
    color: AIR,
    name: "Fan duct",
    note: "Blower → distribution manifold with the A/C off; the blower runs at airflow 1, 2 and 3 (POH 7-65, Fig 7-13; AMM 21-20 PDF p. 454). With the A/C selected the blower, mounted on the evaporator assembly, pushes all its air through the evaporator duct instead (AMM 21-50 PDF pp. 496, 504; Fig 21-50-1 sheet 3 items 24, 30, 31, PDF p. 521).",
  },
);
// Outlet ducts, all from the distribution manifold, each ending at its outlet's anchor in parts/environment.ts (AMM 21-20
// PDF pp. 460–463; Fig 21-20-1 sheet 1, PDF p. 474). Routings between the ends are illustrative.
// crew display ducts (items 16, 17) to the outboard instrument-panel vents: the LH one below and outboard of ADAHRS 1, the RH
// one between the GEA 71 (below, outboard) and GIA 2 (above, inboard); clearance tested
flow(
  "panelL",
  [E0, [2.45, -0.06, -0.2], [2.36, 0, -0.4], [2.31, 0.133, -0.413], CREW_DISPLAY_VENT(-1)],
  ["environment"],
  {
    r: 0.018,
    color: AIR,
    name: "Crew display duct",
    note: "Distribution manifold → crew display air vent on the outboard instrument panel; always fed (AMM 21-20 PDF p. 461; POH 7-66).",
  },
);
flow(
  "panelR",
  [E0, [2.47, -0.04, 0.15], [2.36, 0.06, 0.2], [2.31, 0.133, 0.222], CREW_DISPLAY_VENT(1)],
  ["environment"],
  {
    r: 0.018,
    color: AIR,
    name: "Crew display duct",
  },
);
// crew panel ducts (items 3, 14; 22T-1460, 1471, 1473 thru 22T-9749 only) to the bolster vents, beside the avionics stack
for (const s of [-1, 1]) {
  const [x, y, z] = CREW_PANEL_VENT(s);
  flow(s < 0 ? "panelL2" : "panelR2", [E0, [2.4, -0.09, z], [x + 0.03, y, z], [x, y, z]], ["environment"], {
    r: 0.016,
    color: AIR,
    name: "Crew panel duct",
    note: "Distribution manifold → crew panel air vent in the bolster trim, serials 22T-1460, 22T-1471, 22T-1473 thru 22T-9749; always fed (AMM 21-20 PDF pp. 454, 460; POH 7-66).",
  });
}
// passenger panel ducts (items 6, 9), secured to the console and fuselage, aft along the floor and up the side trim
for (const s of [-1, 1]) {
  const [x, y, z] = PAX_PANEL_VENT(s);
  flow(
    s < 0 ? "armL" : "armR",
    // Over the brake bulkhead fitting and the TKS filter assembly, and up aft of the roll cage hoop
    // (parts/gear.ts, parts/ice.ts, parts/structure.ts). Illustrative waypoints.
    [
      E0,
      [1.8, -0.62, s * 0.45],
      [1.3, -0.62, s * 0.5],
      [1.02, -0.52, s * 0.555],
      [0.85, -0.42, s * 0.57],
      [0.68, -0.33, s * 0.6],
      [0.68, -0.1, s * 0.6],
      [x, y, z],
    ],
    ["environment"],
    {
      r: 0.014,
      color: AIR,
      name: "Passenger panel duct",
      note: "Distribution manifold → passenger panel (armrest) air vent; always fed (AMM 21-20 PDF p. 462; POH 7-66).",
    },
  );
}
// crew floor ducts (items 2, 15) down to the vent under each kick plate
for (const s of [-1, 1]) {
  const [x, y, z] = CREW_FLOOR_VENT(s);
  // Turns outboard forward of the LH avionics (IAU) cooling fan (parts/avionics.ts). Illustrative waypoint.
  flow(
    s < 0 ? "floorF" : "floorF2",
    [E0, [2.42, -0.15, s * 0.2], [2.4, -0.15, z], [x + 0.02, -0.15, z], [x, y, z]],
    ["environment"],
    {
      r: 0.014,
      color: AIR,
      name: "Crew floor duct",
      note: "Distribution manifold → crew floor air vent under the kick plate; fed when the floor butterfly is open (AMM 21-20 PDF p. 462; POH 7-66).",
    },
  );
}
// passenger floor ducts (items 7, 8) aft along the floor, outboard of the evaporator, then up into the trim's armrest bulge and
// down to its sleeve from above (Fig 21-20-1 sheet 6 Detail I); routing illustrative
for (const s of [-1, 1]) {
  const [x, y, z] = PAX_FLOOR_VENT(s);
  flow(
    s < 0 ? "floorR" : "floorR2",
    // the under-floor waypoint sits 40 mm inboard of the curved belly (POH 13772-007 Fig 1-1 loft, p. 1-4);
    // approximate
    [E0, [1.8, -0.62, s * 0.43], [1.0, -0.62, s * 0.52], [0.86, -0.4, z], [x + 0.03, -0.4, z], [x, y, z]],
    ["environment"],
    {
      r: 0.014,
      color: AIR,
      name: "Passenger floor duct",
      note: "Distribution manifold → passenger floor air vent (foot-warmer diffuser) in the rear cabin side trim; fed when the floor butterfly is open (AMM 21-20 PDF p. 463; POH 7-66).",
    },
  );
}
// defrost duct (item 1) up to the defrost vent on the glareshield C-channel; defrost2 spreads along the slot
flow(
  "defrost",
  // Rises outboard of GIA 2 instead of through the GSU 75 ADAHRS 2 between the GIAs (parts/avionics.ts).
  // Final approach into the underside of the compact diffuser: AMM 13773-002 Fig 21-20-1
  // sheet 2 Detail A (PDF p. 475). Undimensioned figure; coordinates approximate.
  [E0, [2.5, 0, 0.02], [2.49, 0.01, 0.145], [2.46, 0.14, 0.15], [2.42, 0.27, 0.08], [2.36, 0.3, 0], [2.32, 0.322, 0]],
  ["environment"],
  {
    r: 0.018,
    color: AIR,
    name: "Windshield diffuser duct",
    note: "Distribution manifold → underside of the compact windshield diffuser under the glareshield (POH 13772-007 7-64; AMM 13773-002 21-20 p. 17, PDF p. 470; Fig 21-20-1 sheet 2 Detail A, PDF p. 475). Final approach coordinates approximate: the figure is undimensioned. Fed when the defrost butterfly is open (POH 7-66).",
  },
);
// Particle-only air along the glareshield slot (POH 13772-007 7-64, 7-66; AMM Fig 21-20-1
// sheet 2 Detail A, PDF p. 475). Slot extent approximate: the figure gives no dimensions.
flow(
  "defrost2",
  [[DEFROST_VENT[0], DEFROST_VENT[1], -0.25], DEFROST_VENT, [DEFROST_VENT[0], DEFROST_VENT[1], 0.25]],
  ["environment"],
  { tube: false, r: 0.018, color: AIR },
);

// air conditioning: R134A loop compressor → condenser → receiver-drier → expansion valve → evaporator →
// compressor (POH 7-65; AMM 21-50 PDF p. 496). The compressor hoses start on its head fittings (parts/aircon.ts), pass
// the firewall and run aft along the RH side (the RH cabin trim comes off to reach them, AMM 21-50 PDF pp. 503,
// 506–507); routing approximate. Hose sizes 1/2 in (discharge)
// and 5/8 in (suction) are matched by fitting torque (AMM 21-50 PDF pp. 501, 505, 509). The 3/8 in hose's 120–160 in-lb
// torque (PDF p. 514) matches the receiver-drier-to-condenser fitting (PDF p. 517), so the liquid lines are drawn ~3/8 in.
const REFRIG = { color: "#7E8A93", count: 10 };
flow(
  "acDischarge",
  [
    AC_FITTING.discharge,
    // forward off the head, down outboard of the left cap-departure leads and inboard of the oil filler, aft under the
    // compressor, inboard under the A/C drive unit forward of the belt plane, aft inboard of the belt to the firewall,
    // down the RH firewall inboard of BAT 1 and outboard under it (AMM 21-50 PDF pp. 499, 501; Fig
    // 21-50-1 sheet 2 PDF p. 520); approximate
    [2.827, 0.115, -0.215],
    [2.827, 0.04, -0.218],
    [2.81, -0.009, -0.218],
    [2.75, -0.009, -0.22],
    [2.695, -0.009, -0.215],
    [2.68, -0.057, -0.19],
    [2.68, -0.057, 0.05],
    [2.68, -0.009, 0.075],
    [2.636, -0.009, 0.11],
    [2.636, -0.009, 0.14],
    [2.645, -0.02, 0.19],
    [2.648, -0.2, 0.19],
    [2.66, -0.2, 0.3],
    [2.68, -0.19, 0.44],
    [2.61, -0.3, 0.48],
    [2.4, -0.45, 0.5],
    [1.5, -0.5, 0.54],
    [0.7, -0.5, 0.54],
    [0.15, -0.5, 0.42],
    [-0.05, -0.5, 0.2],
    AC.condenser,
  ],
  ["environment"],
  {
    ...REFRIG,
    r: 0.0064,
    pcolor: "#FF9A6A",
    name: "A/C discharge line",
    note: "Hot, high-pressure vapor from the compressor to the condenser under the baggage floor (POH 7-65; AMM 21-50 PDF p. 496); 1/2 in compressor hose: its 180–240 in-lb fitting torque matches the condenser-to-compressor joint at the plumbing bulkhead (AMM 21-50 PDF pp. 501, 509).",
  },
);
flow("acLiquid", [AC.condenser, [-0.18, AC.receiver[1] - 0.02, 0.08], AC.receiver], ["environment"], {
  ...REFRIG,
  r: 0.005,
  pcolor: "#5FA8F0",
  name: "A/C condenser → receiver-drier",
  note: "Liquid refrigerant from the condenser to the receiver-drier clamped to it (POH 7-65; AMM 21-50 PDF p. 508); 3/8 in: the receiver-drier-to-condenser fitting takes the 3/8 in hose's 120–160 in-lb torque (AMM 21-50 PDF pp. 514, 517).",
});
flow(
  "acLiquid2",
  // over the main spar and the OAT 1 data run to the evaporator under the RH crew seat; approximate
  [
    AC.receiver,
    [-0.05, -0.47, 0.25],
    [0.15, -0.47, 0.38],
    [0.7, -0.47, 0.5],
    [1.1, -0.48, 0.5],
    [1.4, -0.455, 0.49],
    [1.55, -0.455, 0.42],
    AC.expansion,
  ],
  ["environment"],
  {
    ...REFRIG,
    r: 0.005,
    pcolor: "#5FA8F0",
    name: "A/C liquid line",
    note: "Receiver-drier → expansion valve on the evaporator, joined at the plumbing bulkhead (POH 7-65; AMM 21-50 PDF pp. 504, 509).",
  },
);
flow(
  "acSuction",
  [
    AC.evaporator,
    // up off the evaporator's forward outboard corner under the RH crew seat, over the coupler duct;
    // approximate
    [1.93, -0.465, 0.4],
    [2.1, -0.43, 0.43],
    [2.4, -0.41, 0.43],
    [2.61, -0.26, 0.455],
    // the discharge route in reverse, about 25 mm above it on the firewall, under the drive unit and on the LH run, inboard
    // of it down the RH firewall, inside it round the head loop (AMM 21-50 PDF pp. 499, 501; Fig
    // 21-50-1 sheet 2 PDF p. 520); approximate
    [2.665, -0.165, 0.43],
    [2.66, -0.165, 0.3],
    [2.652, -0.165, 0.215],
    [2.645, 0.004, 0.215],
    [2.636, 0.0155, 0.165],
    [2.636, 0.0155, 0.09],
    [2.68, 0.0155, 0.04],
    [2.68, -0.03, 0.02],
    [2.68, -0.03, -0.155],
    [2.695, 0.0155, -0.207],
    [2.75, 0.0155, -0.22],
    [2.79, 0.0155, -0.218],
    [2.802, 0.045, -0.215],
    [2.802, 0.085, -0.21],
    AC_FITTING.suction,
  ],
  ["environment"],
  {
    ...REFRIG,
    r: 0.008,
    pcolor: "#BDEBFF",
    name: "A/C suction line",
    note: "Low-pressure vapor from the evaporator back to the compressor (POH 7-65); 5/8 in compressor hose: its 250–350 in-lb fitting torque matches the evaporator hose at the firewall (AMM 21-50 PDF pp. 501, 505).",
  },
);
// The outlet sits 8 cm aft of the evaporator centre, between the coupler duct rising into its underside and
// the TKS inboard feed line; approximate.
flow(
  "acDrain",
  [AC.evaporator, [AC.evaporator[0] - 0.08, botY(AC.evaporator[0] - 0.08) + 0.051, 0.36]],
  ["environment"],
  {
    // The drain ends on the belly's inner face at z 0.36: botY is the keel (z 0), and the nBot-3 belly of the POH
    // 13772-007 Fig 1-1 loft (p. 1-4) sits 43 mm higher at z 0.36; 8 mm more keeps the 6 mm hose inside the skin.
    r: 0.006,
    color: "#4E9DB5",
    pcolor: "#8FD3E8",
    count: 4,
    name: "A/C condensate drain",
    note: "Moisture condensed on the evaporator coils drains overboard through the belly (POH 7-65; AMM 21-50 PDF p. 496); drain hose clamped to a fuselage rivnut (AMM 21-50 PDF p. 504).",
  },
);
// A/C air path. Normal A/C: ram air from the fresh-air intake flows into the evaporator assembly, is cooled
// through the coils and ducted forward to the distribution manifold. Maximum A/C (recirculation): the fresh-air valve
// closes and valves in the evaporator assembly open, so cabin air is recirculated through the coils and ducted forward to
// the manifold (AMM 21-50 PDF p. 496; POH 7-65). The coupler duct (item 29) and evaporator duct (item 24) clamp to the
// evaporator assembly (AMM Fig 21-50-1 sheet 3, PDF p. 521; 21-50 PDF p. 504). Routings between the ends are illustrative.
flow(
  "acCoupler",
  [
    CABIN_AIR_COUPLER,
    [2.53, -0.58, 0.46],
    // 50 mm inboard of the curved belly (POH 13772-007 Fig 1-1 loft, p. 1-4); approximate
    [2.2, -0.635, 0.37],
    // along the floor under the passenger floor ducts, then up into the evaporator's underside under the RH crew seat
    // approximate
    [1.82, -0.63, 0.36],
    [1.82, -0.56, 0.345],
    AC.evaporator,
  ],
  ["environment"],
  {
    r: 0.022,
    color: AIR,
    pcolor: "#5FC8F0",
    name: "A/C coupler duct",
    note: "Cabin air coupler aft of the firewall → evaporator assembly: in normal A/C operation ram air from the fresh-air intake flows into the evaporator (POH 7-65; AMM 21-50 PDF p. 496; coupler duct, Fig 21-50-1 sheet 3 item 29, PDF p. 521). Routing approximate.",
  },
);
flow(
  "acEvapDuct",
  [
    AC.evaporator,
    // down off the evaporator's inboard forward corner under the RH crew seat to the floor; approximate
    [1.86, -0.58, 0.27],
    [2.2, -0.59, 0.33],
    [2.45, -0.5, 0.3],
    [2.56, -0.3, 0.14],
    off(E0, [0.02, -0.06, 0.1]),
  ],
  ["environment"],
  {
    r: 0.022,
    color: AIR,
    name: "A/C evaporator duct",
    note: "Evaporator assembly → distribution manifold: the air cooled through the evaporator coils is ducted forward to the manifold, moved by ram air or the blower bolted to the evaporator (POH 7-65; AMM 21-50 PDF pp. 496, 504; evaporator duct, Fig 21-50-1 sheet 3 items 24, 30, 31, PDF p. 521). With the A/C selected it is the only path to the manifold, in normal and in recirculation mode. Routing approximate.",
  },
);
// recirculation: cabin air under the seat → recirculation check valve on the evaporator cover → coils; no duct
flow("acRecirc", [AC.recircInlet, AC.recircValve, AC.evaporator], ["environment"], {
  tube: false,
  size: 0.04,
  name: "A/C recirculation air",
  note: "Maximum A/C: the fresh-air valve closes and valves in the evaporator assembly open, recirculating cabin air through the evaporator coils (AMM 21-50 PDF p. 496; POH 7-65; RECIRCULATION CHECK VALVE, POH Fig 7-14 on 7-63). Not available unless the A/C is operating, nor at airflow 0 (POH 7-66).",
});

export const ENVIRONMENT_DEPTH_FLOWS = F;

/** Particle speed multiplier per cabin-air, refrigerant and A/C air flow (0 = stopped). */
export function environmentDepthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running;
  // cabin air. The valves follow the control panel only while it is powered (POH 7-61); ram air through the
  // inlet valves does not depend on the blower, which adds its own duct with the A/C off (POH 7-65, Fig 7-13). Rates are
  // illustrative.
  const v = valveEnv(s, E),
    flap = airflowValveOpen(v),
    RAM = 0.45;
  R.hotL = run ? 1 : 0;
  R.hot = run && flap ? RAM * hotValveOpen(v) : 0;
  R.fresh = run && flap ? RAM * freshValveOpen(v) : 0;
  // a closed inlet valve sends its air into the engine compartment (POH 7-64, 7-65)
  R.hotDump = run ? 1 - hotValveOpen(v) : 0;
  R.freshDump = run ? 1 - freshValveOpen(v) : 0;
  // inlet side of each valve: carries whatever the valve admits or dumps
  R.hotIn = Math.max(R.hot, R.hotDump);
  R.freshIn = Math.max(R.fresh, R.freshDump);
  // the blower needs its 15 A CABIN FAN breaker in and A/C BUS 2 powered (POH 7-61)
  const fanPwr = E.ac2 > 0 && !s.cb["CABIN FAN"];
  // its speed is a control-panel selection too, held with the valves while the panel is unpowered
  const blower = flap && v.fan >= 1 && fanPwr ? 0.6 + v.fan * 0.4 : 0;
  // With the A/C selected all cabin air passes through the evaporator, whose assembly carries the blower
  // (POH 7-64, 7-65; AMM 21-50 PDF pp. 496, 504; Fig 21-50-1 sheet 3 items 22, 24, 29–31, PDF p. 521): the direct
  // chamber → manifold duct and the blower's own duct carry nothing, and the evaporator duct below takes both.
  R.fanDuct = v.ac ? 0 : blower;
  // downstream ducts carry air only when a source flows: the chamber's hot or fresh air, or the blower
  R.toMan = !v.ac && (R.hot || R.fresh) ? RAM : 0;
  // air conditioning: the refrigerant moves only while the compressor runs (POH 7-61)
  const acOn = acCompressorOn(s, E, v); // the A/C command latches with the control panel, as v does
  R.acDischarge = R.acSuction = acOn ? 1 : 0;
  R.acLiquid = R.acLiquid2 = acOn ? 0.6 : 0;
  R.acDrain = acOn ? 0.3 : 0;
  // A/C air path: with the A/C selected, ram air the fresh-air valve admits flows into the evaporator; in
  // recirculation that valve is shut and the blower draws cabin air through the evaporator assembly's valves instead
  // (AMM 21-50 PDF p. 496; POH 7-65). Either way the evaporator duct carries it forward to the manifold. Recirculation is
  // not available unless the A/C is operating, nor at airflow 0 (POH 7-66), where the blower is off.
  R.acCoupler = v.ac ? R.fresh : 0;
  R.acRecirc = acOn && v.recirc ? blower : 0;
  // the blower on the evaporator pushes through the evaporator duct in normal A/C too; in recirculation only what
  // comes in through the recirculation valves leaves
  R.acEvapDuct = v.ac ? Math.max(R.acCoupler, R.acRecirc, v.recirc ? 0 : blower) : 0;
  const out = Math.max(R.toMan, R.fanDuct, R.acEvapDuct);
  ["panelL", "panelR", "panelL2", "panelR2", "armL", "armR"].forEach((k) => (R[k] = out));
  const floor = butterflies(v.vent).floor,
    wind = butterflies(v.vent).defrost;
  ["floorF", "floorF2", "floorR", "floorR2"].forEach((k) => (R[k] = floor ? out : 0));
  R.defrost = R.defrost2 = wind ? out : 0;
  return R;
}
