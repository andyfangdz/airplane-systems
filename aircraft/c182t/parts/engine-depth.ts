// Frozen row keys identify authored members; preserve these tokens when inserting, moving or reshaping a row.
/** C182T IO-540-AB1A5 installation detail. See SOURCES.md for the document/applicability ledger.
 * POH 182TPHAUS-04; Cessna 182SMM14; Lycoming PC-IO-540-AB1A5 (January 2016).
 * Internal engine/propeller cutaways and all installation coordinates are illustrative, not surveyed dimensions.
 * Register after governor.ts: imports only earlier sections, never the barrel or avionics section.
 */
import { mergeGeos } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import { box, cyl, tubeGeo } from "../geometry";
import { CAT, P3, part } from "./catalogue";
import { CYLS, INTAKES } from "./engine";
import { GOVERNOR } from "./governor";

export const ENGINE_DEPTH_ANCHORS = {
  sump: P3(-24, 0, 40.25),
  oilScreen: P3(-12, 0, 40.25),
  oilPump: P3(-6.5, -1, 45.1),
  filter: P3(-4.5, 0, 47.5),
  filterBase: P3(-6.1, 0, 47.5),
  filterBypass: P3(-6.1, 1.1, 47.5),
  relief: P3(-8.5, 6.7, 49.1),
  thermostat: P3(-6.1, -1.1, 48.7),
  cooler: P3(-11.4, -12.6, 54.9),
  rightGallery: P3(-23, 6.7, 49.1),
  leftGallery: P3(-23, -6.7, 49.1),
  governor: GOVERNOR,
  propPiston: P3(-46.5, 0, 50.375),
  crankcaseBreather: P3(-7, -3.5, 55.5),
  breatherFirewall: P3(-0.8, -14, 27),
  breatherOutlet: P3(-0.8, -14, 20.9),
  inductionElbow: P3(-29, 0, 36),
  inductionDrain: P3(-28.5, -0.8, 34.5),
  drainFirewall: P3(-0.8, -11, 27),
  drainOutlet: P3(-0.8, -11, 21.1),
  oilTemp: P3(-4.6, -1.8, 47.5),
  oilPressure: P3(-12.9, 9.21, 47),
  oilSwitch: P3(-10.9, 9.21, 45),
  tach: P3(-8, 0, 55.55),
  map: P3(-1.2, 7, 58),
  fuelFlow: P3(-12.4, 0, 57.5),
  harness: P3(-0.3, -12, 52),
  gea: P3(11.4, -3, 57),
  ignitionSwitch: P3(18.3, -19.4, 50.4),
} satisfies Record<string, Vec3>;

export type EngineCylinder = (typeof CYLS)[number];
export const magnetoPoint = (mag: "L" | "R"): Vec3 => P3(-4.5, mag === "L" ? -5.5 : 5.5, 55);
/** Exact cross-bank assignment in the selected 2005 KAP 140 POH 7-35 (later POHs reverse it). */
export const plugMag = (c: EngineCylinder, level: "U" | "L") => (c.s > 0 === (level === "L") ? "R" : "L") as "R" | "L";
export const plugPoint = (c: EngineCylinder, level: "U" | "L"): Vec3 => {
  const b = P3(c.fs, c.s * 12, 50);
  return [b[0] - 0.03, b[1] + (level === "U" ? 0.105 : -0.085), b[2] + c.s * 0.075];
};
export const chtPoint = (c: EngineCylinder): Vec3 => P3(c.fs + 0.65, c.s * 15.5, 49.3);
export const egtPoint = (c: EngineCylinder): Vec3 => P3(c.fs - 0.1, c.s * 15, 44.4);
export const rockerDrainPoint = (c: EngineCylinder): Vec3 => P3(c.fs + 0.9, c.s * 15.6, 47.7);

const start = CAT.parts.length;
const A = ENGINE_DEPTH_ANCHORS;

part(() => cyl(0.027, 0.74, "x"), ["engine"], {
  id: "parts.engine-depth.crankshaft-direct-drive.001",
  pos: P3(-25, 0, 48.6),
  color: "#59636B",
  name: "Crankshaft (direct drive)",
  note: "Crankshaft and connecting rods: Lycoming 60297-10 §1 pp.1-1–1-2; IPC 72-20 Figs 3–5. Internal cutaway, schematic journals; propeller drive remains 1:1.",
  groups: [],
});
part(() => cyl(0.015, 0.64, "x"), ["engine"], {
  id: "parts.engine-depth.camshaft-hydraulic-tappets.002",
  pos: P3(-24, 0, 52.1),
  color: "#747E86",
  name: "Camshaft / hydraulic tappets",
  note: "Camshaft above and parallel to the crankshaft drives hydraulic tappets, pushrods and valve rockers (Lycoming 60297-10 §1 p.1-1). Internal cutaway; cam profiles not reproduced.",
  groups: [],
});
part(() => box(0.04, 0.25, 0.34), ["engine"], {
  id: "parts.engine-depth.accessory-housing-accessory-drives.003",
  pos: P3(-6.2, 0, 48.6),
  color: "#697681",
  name: "Accessory housing / accessory drives",
  note: "Rear accessory housing encloses oil pump and accessory drives (Lycoming 60297-10 §1 p.1-1; IPC 72-60 Fig 15). Approximate envelope.",
  fairing: true,
  groups: [],
});

for (const c of CYLS) {
  part(() => cyl(0.042, 0.07, "z"), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.004",
    pos: P3(c.fs, c.s * 9.3, 48.6),
    color: "#ADB4BA",
    name: "Piston — cylinder " + c.n,
    note: "Piston/pin and rod inside the cylinder (Lycoming IPC 72-30 Fig 8 pp.14–15). Static cutaway, not a combustion or crank-motion simulation.",
    groups: [],
  });
  part(() => tubeGeo([P3(c.fs, c.s * 1.2, 48.6), P3(c.fs, c.s * 8.4, 48.6)], 0.009), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.005",
    color: "#68737C",
    name: "Connecting rod — cylinder " + c.n,
    note: "One connecting rod per cylinder (Lycoming IPC 72-30 Fig 8 pp.14–15). Internal cutaway; shape and crank throw approximate.",
    groups: [],
  });
  part(() => box(0.125, 0.125, 0.015), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.006",
    pos: P3(c.fs, c.s * 16.2, 50.4),
    color: "#89969F",
    name: "Rocker box cover — cylinder " + c.n,
    note: "Six rocker box covers and gaskets (Lycoming IPC 72-30 Fig 10 p.20). Cover ghosts in X-ray to reveal valve gear. Shape approximate.",
    fairing: true,
    groups: [],
  });
  for (const [rowKey1, offset] of [
    ["row-001", -0.9],
    ["row-002", 0.9],
  ] as const) {
    part(() => tubeGeo([P3(c.fs + offset, c.s * 7, 53.5), P3(c.fs + offset, c.s * 15.4, 53.5)], 0.006), ["engine"], {
      id: "parts.engine-depth.part.007",
      instance: [c.n, rowKey1],
      color: "#B3BEC5",
      name: "Pushrod / shroud tube — cylinder " + c.n,
      note: "Two pushrod/shroud assemblies per cylinder connect tappets to valve rockers (Lycoming IPC 72-30 Fig 10 pp.18–20). Approximate placement.",
      groups: [],
    });
    part(() => box(0.041, 0.012, 0.031), ["engine"], {
      id: "parts.engine-depth.part.008",
      instance: [c.n, rowKey1],
      pos: P3(c.fs + offset, c.s * 15.8, 50.9),
      color: "#7A858D",
      name: "Valve rocker — cylinder " + c.n,
      note: "Intake and exhaust rockers on floating shafts (Lycoming IPC 72-30 Fig 10 p.20). Internal cutaway; geometry approximate.",
      groups: [],
    });
  }
  part(() => cyl(0.007, 0.025, "z", 10), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.009",
    pos: chtPoint(c),
    color: "#C3AB73",
    name: "CHT probe — cylinder " + c.n,
    note: "One cylinder-head probe per G1000 cylinder (Cessna MM 77-20-00 p.1; POH 7-33). CHT 3 is required. Probe position schematic.",
    groups: ["sensors"],
  });
  part(() => cyl(0.005, 0.035, "y", 10), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.010",
    pos: egtPoint(c),
    color: "#C3AB73",
    name: "EGT probe — cylinder " + c.n,
    note: "One clamped exhaust probe per G1000 cylinder (Cessna MM 77-20-00 pp.1,201; POH 7-33). Representative riser position.",
    groups: ["sensors"],
  });
  const intake = INTAKES[CYLS.indexOf(c)];
  const socket = intake[1];
  part(() => cyl(0.024, 0.025, "z", 12), ["engine"], {
    instance: [c.n],
    id: "parts.engine-depth.part.011",
    pos: socket,
    color: "#454F55",
    name: "Induction sleeve — cylinder " + c.n,
    note: "Six intake hoses with two clamps each (Lycoming IPC 72-30 Fig 12 pp.24–25). Sleeve shown schematically at the runner/plenum joint.",
    groups: ["induction"],
  });
  for (const [rowKey2, d] of [
    ["row-001", -0.009],
    ["row-002", 0.009],
  ] as const)
    part(() => cyl(0.0255, 0.004, "z", 12), ["engine"], {
      id: "parts.engine-depth.intake-sleeve-clamp.012",
      instance: [c.n, rowKey2],
      pos: [socket[0], socket[1], socket[2] + d],
      color: "#A7B1B6",
      name: "Intake sleeve clamp",
      note: "Two clamps per induction sleeve (Lycoming IPC 72-30 Fig 12 p.25). Shape approximate.",
      groups: ["induction"],
    });
}

part(() => cyl(0.018, 0.065, "x", 12), ["engine"], {
  id: "parts.engine-depth.oil-suction-screen-pickup.013",
  pos: A.oilScreen,
  color: "#BCA363",
  name: "Oil suction screen / pickup",
  note: "Screen 70484 in the sump pickup (Lycoming IPC 72-30 Fig 12 p.25; POH 7-34). Internal cutaway.",
  pin: true,
  groups: ["oil"],
});
part(() => box(0.064, 0.061, 0.071), ["engine"], {
  id: "parts.engine-depth.engine-driven-oil-pump.014",
  pos: A.oilPump,
  color: "#BB813C",
  name: "Engine-driven oil pump",
  note: "Accessory-housing pump with driving and driven impellers (Lycoming IPC 72-60 Fig 16 pp.32–33). Internal cutaway.",
  pin: true,
  groups: ["oil"],
});
for (const s of [-1, 1])
  part(() => cyl(0.014, 0.025, "x", 10), ["engine"], {
    instance: [s],
    id: "parts.engine-depth.oil-pump-impeller.015",
    pos: [A.oilPump[0], A.oilPump[1], A.oilPump[2] + s * 0.014],
    color: "#D3A75E",
    name: "Oil pump impeller",
    note: "Driving/driven impeller pair; kit 05K19423-S (Lycoming IPC 72-60 Fig 16 p.33). Internal schematic.",
    groups: ["oil"],
  });
part(() => box(0.044, 0.065, 0.072), ["engine"], {
  id: "parts.engine-depth.oil-filter-adapter-valve-housing.016",
  pos: A.filterBase,
  color: "#78868D",
  name: "Oil filter adapter / valve housing",
  note: "Filter base 77852 and temperature-control valve 53E22144 (Lycoming IPC 72-60 Fig 18 pp.36–37). Approximate envelope.",
  groups: ["oil"],
});
for (const [rowKey3, point, name, note] of [
  [
    "row-001",
    A.filterBypass,
    "Oil filter bypass valve",
    "Filter-adapter bypass permits lubrication with a plugged filter or extremely cold oil (POH 7-34). Internal cutaway; differential pressure is not simulated.",
  ],
  [
    "row-002",
    A.relief,
    "Oil pressure relief valve",
    "Pressure relief at the rear of the right gallery (POH 7-34; Lycoming IPC 72-20 Fig 4 pp.6–7). Internal cutaway.",
  ],
  [
    "row-003",
    A.thermostat,
    "Oil cooler temperature-control valve",
    "Valve 53E22144 in the filter/valve assembly (Lycoming IPC 72-60 Fig 18 p.37). Thermostatic cooler control; valve temperature is not separately simulated.",
  ],
] as const)
  part(() => cyl(0.012, 0.025, "z", 10), ["engine"], {
    instance: [rowKey3],

    id: "parts.engine-depth.part.017",

    pos: point,
    color: "#D6AC62",
    name,
    note,
    groups: ["oil"],
  });
part(() => cyl(0.008, 0.027, "z", 10), ["engine"], {
  id: "parts.engine-depth.oil-temperature-sensor.018",
  pos: A.oilTemp,
  color: "#C4AB72",
  name: "Oil temperature sensor",
  note: "Separate oil-temperature sensor in the oil-filter adapter (POH 7-32). Indication is electrically independent of oil circulation. Shape approximate.",
  groups: ["sensors"],
});
part(() => cyl(0.012, 0.023, "y", 10), ["engine"], {
  id: "parts.engine-depth.oil-sump-drain-plug.019",
  pos: P3(-24, 0, 37.45),
  color: "#B89F64",
  name: "Oil sump drain plug",
  note: "Sump oil drain plug (Lycoming IPC 72-50 Fig 14 pp.28–29). Representative location under the wet sump.",
  groups: ["oil"],
});
part(() => box(0.012, 0.155, 0.175), ["engine"], {
  id: "parts.engine-depth.oil-cooler-mounting-bracket-seal.020",
  pos: P3(-10, -12.6, 54.9),
  color: "#7C8E9B",
  name: "Oil cooler mounting bracket / seal",
  note: "Cooler bolts/spacers attach to rear engine baffles; seal and hoses shown in MM 79-20-00 pp.201–202 Fig 201. Approximate mounting envelope.",
  groups: ["oil"],
});

for (const s of [-1, 1]) {
  part(
    () =>
      mergeGeos([
        box(0.18, 0.055, 0.004).translate(...P3(-35, s * 14.5, 53)),
        box(0.18, 0.075, 0.004).translate(...P3(-28, s * 16.2, 53.3)),
        box(0.18, 0.075, 0.004).translate(...P3(-21, s * 16.2, 53.3)),
      ]),
    ["engine"],
    {
      instance: [s],
      id: "parts.engine-depth.side-cooling-baffle.021",
      color: "#A3AFB7",
      name: "Side cooling baffle",
      note: "Baffles force cooling air through cylinder fins (POH 7-37; Lycoming 60297-10 §1 p.1-2). Sheet envelope approximate.",
      fairing: true,
      groups: [],
    },
  );
  part(
    () =>
      tubeGeo([P3(-38, s * 14.3, 54), P3(-32, s * 15, 54.6), P3(-25, s * 16.1, 54.8), P3(-19, s * 16.1, 54.8)], 0.006),
    ["engine"],
    {
      instance: [s],
      id: "parts.engine-depth.cooling-baffle-seal.022",
      color: "#343E44",
      name: "Cooling baffle seal",
      note: "Flexible baffle/cowl seal: installation shape schematic, not a measured cowling fit (Cessna MM 71-00-01 Fig 1; POH 7-37).",
      groups: [],
    },
  );
  part(() => box(0.005, 0.072, 0.17), ["engine"], {
    instance: [s],
    id: "parts.engine-depth.aft-cylinder-cooling-baffle.023",
    pos: P3(-17, s * 12.2, 54.9),
    color: "#A3AFB7",
    name: "Aft cylinder cooling baffle",
    note: "Rear bank baffling directs inlet air through the fins to the aft bottom cowl flaps (POH 7-37). Approximate envelope.",
    groups: [],
  });
  for (const [gap, fs] of s > 0
    ? ([
        ["front", -32.5],
        ["rear", -26.5],
      ] as const)
    : ([
        ["front", -29.5],
        ["rear", -23.5],
      ] as const))
    part(() => box(0.095, 0.013, 0.13), ["engine"], {
      id: "parts.engine-depth.inter-cylinder-cooling-baffle.024",
      instance: [s, gap],
      pos: P3(fs, s * 11.5, 46.1),
      color: "#A9B4BA",
      name: "Inter-cylinder cooling baffle",
      note: "Four inter-cylinder baffles, including a distinct 1–3 baffle (Lycoming IPC 72-30 Fig 11 pp.22–23). Geometry approximate.",
      groups: [],
    });
  part(() => cyl(0.057, 0.022, "x", 16), ["engine"], {
    instance: [s],
    id: "parts.engine-depth.exhaust-slip-joint-attachment-spring.025",
    pos: P3(-30.1, s * 9.5, 34),
    color: "#A17959",
    name: "Exhaust slip joint / attachment spring",
    note: "Mufflers attach to exhaust stacks with springs and hardware; inspect welds and slip joints (Cessna MM 78-10-00 p.201). Approximate joint envelope.",
    groups: ["exhaust"],
  });
}

for (const mag of ["L", "R"] as const) {
  const p = magnetoPoint(mag);
  part(() => cyl(0.031, 0.012, "x", 12), ["engine"], {
    id: "parts.engine-depth.part.026",
    instance: [mag],
    pos: [p[0] + 0.045, p[1], p[2]],
    color: "#B4A377",
    name: mag === "L" ? "Left magneto impulse coupling" : "Right magneto impulse coupling",
    note: "Both Slick 6351 magnetos are impulse-coupled (Cessna MM 74-10-00 p.201; 71-00-01 p.1). Starting retard/energy is mechanical; no battery ignition booster is installed here. Internal schematic.",
    groups: ["ignition"],
  });
}
part(() => mergeGeos([box(0.02, 0.046, 0.052), cyl(0.015, 0.018, "x")]), ["engine"], {
  id: "parts.engine-depth.engine-sensor-firewall-harness-connector.027",
  pos: A.harness,
  color: "#667A89",
  name: "Engine sensor firewall harness connector",
  note: "Representative firewall junction for separate sensor circuits feeding GEA 71 (POH 7-28; Cessna MM 77-20-00). Connector location/shape approximate.",
  pin: true,
  groups: ["sensors"],
});

part(() => cyl(0.023, 0.035, "x", 14), ["propeller", "engine"], {
  id: "parts.engine-depth.propeller-pitch-change-piston-yoke.028",
  pos: A.propPiston,
  color: "#C89C52",
  name: "Propeller pitch-change piston / yoke",
  note: "C400 single-acting piston/yoke converts governor oil pressure into high pitch (McCauley MPC26 61-00-04 p.1, Fig 3). Internal schematic; existing blade/RPM model governs motion.",
  ext: true,
  pin: true,
  groups: ["oil"],
});
part(() => cyl(0.015, 0.037, "x", 12), ["propeller"], {
  id: "parts.engine-depth.propeller-low-pitch-return-spring.029",
  pos: P3(-45.1, 0, 50.375),
  color: "#BDC4C8",
  name: "Propeller low-pitch return spring",
  note: "C400 spring and blade centrifugal twisting moment oppose oil pressure toward low pitch; it is nonfeathering (McCauley MPC26 61-00-04 p.1). Internal schematic spring envelope.",
  ext: true,
  groups: ["oil"],
});
for (let i = 0; i < 3; i++) {
  const angle = (i * Math.PI * 2) / 3;
  part(() => cyl(0.013, 0.01, "x", 12), ["propeller"], {
    id: "parts.engine-depth.propeller-blade-bearing-actuating-link.030",
    instance: [i],
    pos: [A.propPiston[0], 0.038 * Math.cos(angle), 0.038 * Math.sin(angle)],
    color: "#9DA9B2",
    name: "Propeller blade bearing / actuating link",
    note: "Blade bearing, pin and yoke link (McCauley MPC26 61-00-04 p.1, Fig 3). The oil-filled hub bearing cavity contains sealed red-dyed oil isolated from governor/engine oil. Internal schematic.",
    ext: true,
    groups: ["oil"],
  });
}
part(() => cyl(0.017, 0.018, "y", 12), ["propeller", "engine"], {
  id: "parts.engine-depth.governor-gear-pump-pilot-valve.031",
  pos: [GOVERNOR[0], GOVERNOR[1] - 0.018, GOVERNOR[2]],
  color: "#B79354",
  name: "Governor gear pump / pilot valve",
  note: "Engine-driven gear pump boosts oil; flyweights and speeder spring position the pilot valve (McCauley Propeller Systems technical guide pp.5–7). Internal schematic within the governor.",
  groups: ["oil"],
});
for (const s of [-1, 1])
  part(() => box(0.008, 0.012, 0.012), ["propeller"], {
    instance: [s],
    id: "parts.engine-depth.governor-flyweight.032",
    pos: [GOVERNOR[0] + s * 0.012, GOVERNOR[1] + 0.012, GOVERNOR[2]],
    color: "#C1C9CD",
    name: "Governor flyweight",
    note: "Flyweights balance the speeder spring at selected RPM (McCauley technical guide pp.6–7). Internal schematic.",
    groups: ["oil"],
  });

/** Exact new specs, useful to test full envelopes without including intentional exterior legacy components. */
export const ENGINE_DEPTH_PARTS = CAT.parts.slice(start);
