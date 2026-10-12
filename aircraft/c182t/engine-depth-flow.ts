/** C182T independent oil, ignition, sensor and cooling circuits. Installation paths are schematic.
 * Existing fuel/induction/exhaust/propeller behavior remains in flows.ts/model.ts/tick.ts.
 */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import { magFires } from "@/lib/anims";
import { govRpm, rpmFine, type Elec, type Sim } from "./model";
import { P3 } from "./parts/catalogue";
import { CYLS } from "./parts/engine";
import {
  ENGINE_DEPTH_ANCHORS as A,
  chtPoint,
  egtPoint,
  magnetoPoint,
  plugMag,
  plugPoint,
  rockerDrainPoint,
} from "./parts/engine-depth";

const F: FlowSpec[] = [];
const flow = (key: string, pts: Vec3[], options: Omit<FlowSpec, "key" | "pts">) =>
  F.push({ key: "eDepth" + key, pts, ...options });
const oil = {
  sys: ["engine"] as FlowSpec["sys"],
  groups: ["oil"] as FlowSpec["groups"],
  color: "#B87B34",
  pcolor: "#F3B952",
  r: 0.007,
  size: 0.025,
  count: 5,
};
const ignition = {
  sys: ["engine"] as FlowSpec["sys"],
  groups: ["ignition"] as FlowSpec["groups"],
  color: "#9AA6A8",
  pcolor: "#FFDA85",
  r: 0.003,
  size: 0.015,
  count: 6,
};
const sensors = {
  sys: ["engine", "avionics"] as FlowSpec["sys"],
  groups: ["sensors"] as FlowSpec["groups"],
  color: "#588195",
  pcolor: "#ADDAE9",
  r: 0.002,
  size: 0.014,
  count: 3,
};

flow("OilPickup", [A.sump, A.oilScreen, A.oilPump], {
  ...oil,
  tube: false,
  name: "Oil suction screen → oil pump",
  note: "Wet-sump pickup/screen to accessory-housing pump (POH 7-34; Lycoming IPC Figs 12,16). Internal passages; particles only.",
});
flow("OilPumpFilter", [A.oilPump, A.filterBase, A.filter], {
  ...oil,
  tube: false,
  name: "Oil pump → full-flow filter",
  note: "Pumped oil passes through the full-flow filter (POH 7-34). Internal schematic.",
});
flow("OilFilterBypass", [A.filterBase, A.filterBypass, A.relief], {
  ...oil,
  tube: false,
  name: "Oil filter bypass passage",
  note: "Filter bypass opens for blockage or extremely cold oil (POH 7-34). Branch displayed without active particles because filter differential pressure is not simulated.",
});
flow("OilFilterRelief", [A.filter, A.filterBase, A.relief], {
  ...oil,
  tube: false,
  name: "Filtered oil → pressure relief",
  note: "Filter and pressure-relief circuit (POH 7-34). Internal schematic; pressure regulation remains in the existing engine model.",
});
flow("OilToThermostat", [A.relief, A.thermostat], {
  ...oil,
  tube: false,
  name: "Pressure relief → oil cooler control",
  note: "Thermostatically controlled remote cooler; separate temperature-control valve in IPC Fig 18 p.37 (POH 7-34). Internal route schematic.",
});
flow("OilCoolerFeed", [A.thermostat, P3(-5.2, -4, 49), P3(-7, -11, 52), A.cooler], {
  ...oil,
  name: "Oil cooler inlet hose",
  note: "Separate inlet hose to cooler mounted behind engine baffles (Cessna MM 79-20-00 pp.201–202). Routing approximate.",
});
flow("OilCoolerReturn", [A.cooler, P3(-12, -10.5, 54.2), P3(-17, -9.5, 51.5), A.leftGallery], {
  ...oil,
  name: "Oil cooler outlet hose → left gallery",
  note: "Separate cooler outlet hose (Cessna MM 79-20-00 p.201); cooled oil supplies left gallery and governor (POH 7-34). Routing approximate.",
});
flow("OilCoolerBypass", [A.thermostat, P3(-14, -5, 49.1), A.leftGallery], {
  ...oil,
  tube: false,
  name: "Thermostatic cooler bypass passage",
  note: "Conceptual temperature-control branch (Lycoming IPC Fig 18 pp.36–37). No active particles: valve temperature/position is not simulated.",
});
flow("OilRightGallery", [A.relief, A.rightGallery, P3(-35, 6.7, 49.1)], {
  ...oil,
  tube: false,
  name: "Right engine oil gallery",
  note: "Internal pressure lubrication gallery (POH 7-34). Schematic; not an external oil hose.",
});
flow("OilLeftGallery", [A.leftGallery, P3(-35, -6.7, 49.1)], {
  ...oil,
  tube: false,
  name: "Left engine oil gallery",
  note: "Left gallery also supplies propeller governor (POH 7-34). Schematic internal route.",
});
flow("GovernorSupply", [A.leftGallery, P3(-37, -6.7, 49.1), A.governor], {
  ...oil,
  sys: ["engine", "propeller"],
  tube: false,
  name: "Left oil gallery → governor pump",
  note: "Engine oil to governor pressure-boosting pump (POH 7-34,7-37). Internal schematic.",
});
flow("PropOil", [A.governor, P3(-42.8, -5, 51), P3(-44.3, 0, 50.375), A.propPiston], {
  ...oil,
  sys: ["engine", "propeller"],
  tube: false,
  ext: true,
  name: "Governor valve → propeller pitch piston",
  note: "Oil into the C400 hub increases pitch; oil released permits low pitch (POH 7-37; McCauley MPC26 61-00-04 p.1). Internal path to the exterior propeller, particles only. Direction follows the existing governor model.",
});
flow("OilGravityReturn", [A.rightGallery, P3(-23, 0, 45.5), A.sump], {
  ...oil,
  tube: false,
  name: "Internal oil gravity return",
  note: "Oil drains back to sump after lubricating engine (POH 7-34). Representative internal passage.",
});
flow("Breather", [A.crankcaseBreather, P3(-4, -7, 55), P3(-2, -14, 48), A.breatherFirewall], {
  ...oil,
  r: 0.009,
  name: "Crankcase breather line",
  note: "C182T crankcase vents directly through its breather; MM 79-20-10 p.201 identifies air/oil separator as turbocharged equipment. Routing approximate.",
});
flow("BreatherOutlet", [A.breatherFirewall, A.breatherOutlet], {
  ...oil,
  r: 0.009,
  ext: true,
  name: "Crankcase breather overboard outlet",
  note: "Breather terminates below cowling; winterization insulation described in MM 30-20-00 p.201. Approximate outlet; particles represent crankcase ventilation, not oil loss.",
});
flow("InductionDrain", [A.inductionDrain, P3(-19, -2, 33), P3(-8, -9, 30), A.drainFirewall], {
  sys: ["engine"],
  groups: ["induction"],
  r: 0.003,
  color: "#777B70",
  count: 0,
  name: "Induction elbow drain line",
  note: "Drain line attaches to the induction elbow (Cessna MM 71-60-00 pp.201–202); engine drains cluster on left forward firewall (71-70-00 p.201). No continuous liquid flow is implied.",
});
flow("DrainOutlet", [A.drainFirewall, A.drainOutlet], {
  sys: ["engine"],
  groups: ["induction"],
  r: 0.003,
  color: "#777B70",
  count: 0,
  ext: true,
  name: "Induction drain overboard outlet",
  note: "Engine drain outlet cluster (Cessna MM 71-70-00 p.201 Fig 201). Outlet geometry approximate.",
});

for (const c of CYLS) {
  flow("RockerDrain" + c.n, [rockerDrainPoint(c), P3(c.fs + 0.9, c.s * 11.5, 45.4), P3(c.fs + 0.9, c.s * 8.65, 43.2)], {
    ...oil,
    r: 0.004,
    name: "Cylinder " + c.n + " rocker-box oil drain",
    note: "Six separate cylinder-head oil drain tubes/hoses (Lycoming IPC 72-30 Fig 11 pp.22–23). Gravity return to crankcase/sump. Routing approximate.",
  });
  for (const level of ["U", "L"] as const) {
    const mag = plugMag(c, level);
    flow(
      `Ign${c.n}${level}`,
      [
        magnetoPoint(mag),
        P3(-3.3, c.s * 8, level === "U" ? 55.9 : 44.3),
        P3(-9, c.s * 16.1, level === "U" ? 55 : 43.5),
        P3(c.fs + 0.7, c.s * 16.1, level === "U" ? 54.1 : 46.2),
        plugPoint(c, level),
      ],
      {
        ...ignition,
        name: `Shielded ignition lead — cylinder ${c.n} ${level === "U" ? "upper" : "lower"}`,
        note: `${mag} magneto to its assigned plug (selected 2005 POH 7-35; Lycoming IPC Fig 22 pp.46–47). Independent of airplane battery power. Routing approximate.`,
      },
    );
  }
  for (const [kind, point] of [
    ["CHT", chtPoint(c)],
    ["EGT", egtPoint(c)],
  ] as const)
    flow(kind + c.n, [point, P3(c.fs + 0.9, c.s * 17, 50), P3(-10, c.s * 17, 53), P3(-2, c.s * 13, 53), A.harness], {
      ...sensors,
      name: `${kind} ${c.n} → engine sensor harness`,
      note: "Independent cylinder-temperature circuit to GEA 71; G1000 has six probes of each type (POH 7-33; Cessna MM 77-20-00 p.1). Routing approximate.",
    });
}
for (const mag of ["L", "R"] as const)
  flow("Plead" + mag, [A.ignitionSwitch, P3(6, -16, 49), P3(-0.4, -12, 51), magnetoPoint(mag)], {
    ...ignition,
    count: 0,
    name: mag + " magneto primary grounding lead",
    note: "Ignition-switch P-lead grounds magneto to inhibit spark (Cessna MM 74-10-00 p.201). Static control wire, not a battery ignition supply. Routing approximate.",
  });
for (const [key, point, name] of [
  ["OilPressureSignal", A.oilPressure, "Oil pressure transducer"],
  ["OilTemperatureSignal", A.oilTemp, "Oil temperature sensor"],
  ["OilSwitchSignal", A.oilSwitch, "Separate low oil pressure switch"],
  ["TachSignal", A.tach, "Tachometer drive sensor"],
  ["MapSignal", A.map, "Absolute manifold pressure transducer"],
  ["FuelFlowSignal", A.fuelFlow, "Metered fuel flow transducer"],
] as const)
  flow(key, [point, P3(-3, -10, 53), A.harness], {
    ...sensors,
    name: name + " → engine harness",
    note: "Separate sensing circuit to GEA 71 (POH 7-29–7-33). Powered indication does not supply magneto ignition or mechanical oil flow. Routing approximate.",
  });
flow("ManifoldSense", [P3(-22, 0, 36.5), P3(-12, 9.5, 42), P3(-4, 9.5, 54), A.map], {
  ...sensors,
  r: 0.003,
  count: 0,
  name: "Manifold pressure sensing line",
  note: "Induction manifold pressure connection to absolute pressure transducer (POH 7-29; Cessna MM 77-30-00 p.201). Static pressure-sensing line; not an electrical supply. Routing approximate.",
});
flow("EngineData", [A.harness, P3(4, -12, 52), P3(8, -7, 55), A.gea], {
  ...sensors,
  name: "Engine harness → GEA 71",
  note: "GEA 71 forward of instrument panel receives engine sensor signals and supplies EIS data (POH 7-28). Route behind panel, approximate.",
});
for (const s of [-1, 1]) {
  const side = s > 0 ? "R" : "L";
  const inlet = P3(-43.4, s * 10.8, 53.5);
  const outlet = P3(-8, s * 8, 28);
  const cooling = {
    sys: ["engine"] as FlowSpec["sys"],
    groups: [] as FlowSpec["groups"],
    tube: false,
    pcolor: "#ADDAE9",
    size: 0.028,
    count: 10,
  };
  flow("CoolingEntry" + side, [P3(-44.8, s * 10.8, 53.5), inlet], {
    ...cooling,
    ext: true,
    name: "Cooling inlet air — " + side,
    note: "Front cowling inlet (POH 7-37). Exterior air, particles only; illustrative opening position.",
  });
  flow("Cooling" + side, [inlet, P3(-35, s * 10, 56), P3(-27, s * 15, 53.8), P3(-18, s * 16, 41), outlet], {
    ...cooling,
    name: "Baffled cylinder cooling air — " + side,
    note: "Cowling inlet to cylinder fins and bottom aft cowl flaps (POH 7-37). Internal schematic, no thermofluid simulation.",
  });
  flow("CoolingExit" + side, [outlet, P3(-1, s * 8, 23.3), P3(-1, s * 8, 20)], {
    ...cooling,
    ext: true,
    name: "Cowl-flap cooling outlet — " + side,
    note: "Air exits through two bottom cowl flaps (Cessna MM 71-10-00 p.201; POH 7-37). Intentional exterior airflow, particles only.",
  });
  flow("CowlCable" + side, [P3(23, 5, 34.3), P3(10, 6, 30), P3(0, 7, 29), P3(-5, s * 8, 27), P3(-9, s * 8, 26)], {
    sys: ["engine"],
    groups: [],
    color: "#949EAA",
    r: 0.003,
    count: 0,
    name: "Cowl flap control cable — " + side,
    note: "Cockpit lever mechanically controls both cowl flaps; separate control cables/clevises (POH 7-37; Cessna MM 71-10-00 p.208). Endpoints/routing approximate; existing flap pose handles motion.",
  });
}

export const ENGINE_DEPTH_FLOWS = F;
/** Replace coarse circuits so detailed paths do not draw duplicate hoses or out-of-cowl cooling curves. */
export const ENGINE_DEPTH_REPLACED_FLOW_KEYS = ["oil", "oilRet", "oilGov", "coolL", "coolR"] as const;

/** Illustrative relative particle rates. Reuses existing fuel/electrical solutions and propeller governor rules. */
export function engineDepthFlowRates(s: Sim, E: Elec, rpm: number, ias = 0): Record<string, number> {
  const R = Object.fromEntries(F.map((f) => [f.key, 0]));
  const cranking = s.eng.mags === "START" && E.starterPwr;
  const turning = rpm > 150 || s.eng.running || cranking;
  const oilOn = turning && !s.eng.fail.oil;
  const cooling = turning || (!s.ground && ias > 30);
  for (const f of F) {
    if (f.groups?.includes("oil")) R[f.key] = oilOn ? 0.7 : 0;
    if (f.groups?.includes("sensors") && (f.count ?? 3) > 0) R[f.key] = E.gea ? 0.35 : 0;
    if (f.key.startsWith("eDepthCooling")) R[f.key] = cooling ? 0.6 + 0.6 * s.eng.cowl : 0;
  }
  R.eDepthOilFilterBypass = R.eDepthOilCoolerBypass = 0;
  R.eDepthBreather = R.eDepthBreatherOutlet = turning ? 0.3 : 0;
  for (const c of CYLS)
    for (const level of ["U", "L"] as const) {
      const mag = plugMag(c, level);
      const failed = mag === "L" ? s.eng.fail.magL : s.eng.fail.magR;
      R[`eDepthIgn${c.n}${level}`] = turning && magFires(mag, s.eng.mags, failed) ? 1 : 0;
    }
  const governs = oilOn && !s.eng.fail.gov;
  const target = govRpm(s.eng.prop);
  R.eDepthPropOil = governs ? (rpm > target - 30 || rpmFine(1, ias) > target ? 0.8 : -0.4) : 0;
  return R;
}
