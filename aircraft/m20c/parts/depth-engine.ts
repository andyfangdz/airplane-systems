/** Lycoming O-360-A1D / Hartzell HC-C2YK-1B detail. Mooney 1968 OM scan p. 15–17;
 * MAN 106 §§ 3-5,3-15–24,4-9; Lycoming 60297-12 §§ 1,4,7; Hartzell 115N Description 2.B.
 * Hardware envelopes and anchors are schematic; no maintenance dimensions are inferred from IPC drawings. */
import { box, cyl, tubeGeo } from "../geometry";
import { DEPTH } from "../depth-anchors";
import { CYLS, PROP } from "./engine";
import { part } from "./catalogue";

const metal = "#8A949D",
  oil = "#B85A2A";
const oilParts = [
  [
    "Oil suction screen",
    DEPTH.suction,
    "Sump suction screen catches coarse debris before the accessory-housing pump. Lycoming 60297-12 § 7-1 checks this at 100 h; pressure screen has its own interval. Not an external filter.",
  ],
  [
    "Oil pump (accessory housing)",
    DEPTH.oilPump,
    "Engine-driven impeller-type pump supplies the full-pressure wet-sump circuit (Lycoming 60297-12 § 1-3). The A1D is not a dry-sump aerobatic AIO variant.",
  ],
  [
    "Oil pressure screen",
    DEPTH.pressureScreen,
    "Pressure-screen housing is distinct from sump suction screen and optional full-flow filter. Inspect metal/debris and clean according to the fitted filtration configuration (Lycoming 60297-12 §§ 4-2–3,7-1).",
  ],
  [
    "Oil cooler bypass valve",
    DEPTH.oilBypass,
    "Automatic bypass routes oil around the cooler when cold or the cooler is obstructed (1968 OM scan p. 16). This is a conceptual passage, not a dimensioned hose installation.",
  ],
  [
    "Oil pressure relief valve",
    DEPTH.oilRelief,
    "Accessory-case relief limits oil pressure; incorrect pressure can also reflect oil quantity, temperature or gauge plumbing (Lycoming 60297-12 §§ 1,6–7).",
  ],
  [
    "Oil gallery",
    DEPTH.oilGallery,
    "Pressure oil distributes internally to crankshaft bearings and valve gear; oil returns by gravity to the wet sump. Internal passages are depicted schematically (Lycoming 60297-12 § 1).",
  ],
  [
    "Oil pressure gauge fitting",
    DEPTH.oilPressure,
    "A pressure hose and firewall fitting connect the engine to the mechanical cluster gauge (IPC 205 Fig. 42, 1968 effectivity). A leaking or obstructed indication line is distinct from an engine oil-pressure failure.",
  ],
  [
    "Oil temperature bulb",
    DEPTH.oilTemp,
    "Oil-temperature sensing element belongs to the engine cluster indication system (MAN 106 § 7-3, IPC 205 Fig. 42); sensor form/position approximate.",
  ],
] as const;
for (const [name, pos, note] of oilParts)
  part(() => cyl(0.018, 0.04, "x", 12), ["engine"], { name, pos, color: oil, pin: true, note });
part(() => cyl(0.016, 0.075, "y", 12), ["engine"], {
  pos: DEPTH.oilDipstick,
  name: "Oil filler cap / dipstick",
  color: metal,
  pin: true,
  note: "1968 OM scan p. 89: oil-filler access through the right cowl; keep6–8 qt,8 qt capacity. Dipstick and cap are one service point. Stem/position illustrative, not a claim that this aircraft has a quick-drain or aftermarket oil separator.",
});
part(() => cyl(0.009, 0.025, "y", 10), ["engine"], {
  pos: [2.49, -0.26, 0],
  name: "Oil sump drain plug",
  color: metal,
  pin: true,
  note: "Wet-sump drain plug and suction screen are separate service locations (Lycoming 60297-12 § 1-2,7-1). A fitted quick-drain is not established by the N6947N records.",
});
part(() => box(0.07, 0.09, 0.065), ["engine", "propeller"], {
  pos: DEPTH.governor,
  name: "Propeller governor",
  color: "#75818A",
  fairing: true,
  pin: true,
  note: "Single-acting governor meters pressure oil through the crankshaft to the hub: oil increases pitch. Flyweight force opposes the control-set speeder spring; low pitch follows oil loss (1968 OM scan p. 7,9; Hartzell 115N Description 2.B). Mount geometry is illustrative.",
});
for (const [name, y] of [
  ["Governor flyweights", 0.05],
  ["Governor speeder spring", 0.075],
  ["Governor pilot valve", -0.015],
] as const)
  part(() => cyl(0.009, 0.018, "y", 10), ["propeller", "engine"], {
    pos: [DEPTH.governor[0], y, DEPTH.governor[2]],
    name,
    color: oil,
    note: "Governor functional cutaway: flyweights and speeder spring position the pilot valve to meter or release hub oil. Representative internal hardware, not the installed governor's measured internals (Hartzell 115N Description).",
  });
part(() => cyl(0.028, 0.045, "x", 14), ["propeller"], {
  pos: [PROP[0] - 0.035, 0, 0],
  name: "Propeller pitch piston",
  color: oil,
  pin: true,
  ext: true,
  note: "Hartzell HC-C2YK-1B is a non-counterweighted,-1 constant-speed propeller: pressure oil raises pitch; spring and centrifugal twisting moment lower it. No feathering, counterweights or air charge (Hartzell 115N Description 2.B).",
});
part(() => cyl(0.017, 0.055, "x", 14), ["propeller"], {
  pos: [PROP[0] - 0.055, 0, 0],
  name: "Propeller low-pitch return spring",
  color: metal,
  ext: true,
  note: "Mechanical spring returns stationary blades toward the low-pitch stop when centrifugal twisting moment is absent (Hartzell 115N Description 2.B). Visual cutaway approximate.",
});
part(() => box(0.035, 0.025, 0.025), ["engine", "fuel"], {
  pos: DEPTH.carbScreen,
  name: "Carburetor inlet strainer",
  color: "#C9B98F",
  pin: true,
  note: "Fuel inlet strainer ahead of the MA-4-5 float bowl; inspect/clean inlet strainers and check throttle/mixture travel at 50 h (Lycoming 60297-12 § 4-3). Updraft carburetor under the oil sump (MAN 106 § 4-9).",
});
for (const [name, pos, note] of [
  [
    "Carburetor float and needle valve",
    DEPTH.carbFloat,
    "Float controls the inlet needle to maintain bowl level; the bowl stores fuel before the metering jet. A schematic functional cutaway, not an injected-engine flow divider (MAN 106 § 4-9; Lycoming 60297-12 § 1).",
  ],
  [
    "Carburetor accelerator pump",
    [2.55, -0.3, 0.055],
    "Throttle movement gives an accelerator-pump fuel shot. This airframe's 1968 start procedure uses throttle pumping; an O-360 engine's generic primer provision does not establish a fitted separate primer (1968 OM scan p. 37; Lycoming 60297-12 § 1-3).",
  ],
  [
    "Carburetor mixture metering valve",
    [2.53, -0.3, -0.03],
    "Manual mixture varies metered fuel and provides idle cutoff (MAN 106 § 4-9). Propeller vernier and mixture control perform different functions.",
  ],
  [
    "Carburetor throttle butterfly",
    [2.57, -0.26, 0],
    "Throttle butterfly changes airflow/manifold pressure; carb heat selects warm unfiltered air at the air box (1968 OM scan p. 15; MAN 106 § 4-9).",
  ],
] as const)
  part(() => cyl(0.011, 0.025, "z", 10), ["engine", "fuel"], {
    pos: [...pos],
    name,
    color: "#9DADBB",
    note,
    pin: true,
  });
for (const c of CYLS) {
  const head = [c.x, 0.005, c.s * 0.27] as const;
  part(() => box(0.115, 0.095, 0.028), ["engine"], {
    pos: [...head],
    color: metal,
    fairing: true,
    name: "Rocker cover — cylinder " + c.n,
    note: "Removable cover protects the intake/exhaust rocker arms. Inspect leakage around covers and pushrod housings (Lycoming 60297-12 §§ 1,4). Dimensions illustrative.",
  });
  for (const dx of [-0.034, 0.034]) {
    part(
      () =>
        tubeGeo(
          [
            [c.x + dx, -0.015, c.s * 0.11],
            [c.x + dx, 0.02, c.s * 0.245],
          ],
          0.008,
          0,
        ),
      ["engine"],
      {
        name: "Pushrod housing — cylinder " + c.n,
        color: metal,
        note: "Camshaft/tappet/pushrod motion operates intake and exhaust rockers; the sealed housing also provides the oil-return path (Lycoming 60297-12 § 1-1). Two per cylinder; route approximate.",
      },
    );
    part(() => cyl(0.008, 0.025, "z", 10), ["engine"], {
      pos: [c.x + dx, 0.045, c.s * 0.27],
      name: "Valve spring — cylinder " + c.n,
      color: "#B5B9B9",
      note: "Two overhead valves per cylinder, operated by rockers and returned by springs (Lycoming 60297-12 § 1-1). Small illustrative cutaway within the rocker housing.",
    });
  }
}
part(() => cyl(0.014, 0.45, "x", 16), ["engine"], {
  pos: [2.58, 0.045, 0],
  name: "Camshaft",
  color: metal,
  pin: true,
  note: "Gear-driven camshaft operates hydraulic tappets and pushrods (Lycoming 60297-12 § 1). Internal shape/location schematic; no cam wear or timing simulation.",
});
part(() => cyl(0.025, 0.52, "x", 16), ["engine", "propeller"], {
  pos: [2.63, -0.06, 0],
  name: "Crankshaft oil transfer passage",
  color: metal,
  pin: true,
  note: "Pressure oil from the governor reaches the propeller through the crankshaft; crank and bearings shown as a functional internal passage (Hartzell 115N Description; Lycoming 60297-12 § 1).",
});
for (const side of [-1, 1]) {
  part(() => box(0.48, 0.11, 0.018), ["engine"], {
    pos: [2.51, 0.005, side * 0.28],
    color: "#A6A295",
    fairing: true,
    name: "Engine cooling baffles",
    pin: side > 0,
    note: "Down-draft baffles direct inlet air around the cylinder fins and out the fixed cowl openings. Loose fasteners/deteriorated baffles permit cooling-air loss (1968 OM scan p. 17; MAN 106 § 3-21). Dimensions illustrative.",
  });
  part(() => box(0.4, 0.018, 0.025), ["engine"], {
    pos: [2.51, 0.063, side * 0.28],
    color: "#464C48",
    name: "Cooling baffle seal",
    note: "Flexible seals close baffle/cowling gaps; inspect position and condition at the engine inspection (MAN 106 § 3-21). Envelope fitted to this model's cowling, not a measured seal profile.",
  });
}
part(() => cyl(0.012, 0.045, "z", 10), ["engine"], {
  pos: [2.21, -0.09, 0.1],
  name: "Crankcase breather outlet",
  color: metal,
  pin: true,
  note: "Breather vents crankcase pressure; restrictions and loose connections are inspection items (Lycoming 60297-12 §§ 4,7). No aftermarket air/oil separator is assumed.",
});
part(() => cyl(0.011, 0.025, "z", 10), ["engine", "fuel"], {
  pos: [2.3, -0.24, -0.16],
  name: "Engine fuel-pump diaphragm vent",
  color: "#9DADBB",
  pin: true,
  note: "Vent/drain line routes engine pump leakage outside the cowling; fuel in the vent is a pump inspection clue (MAN 106 § 4-10; Lycoming 60297-12 § 4-3). Drain is not a fuel return to the wing tanks.",
});
part(() => box(0.025, 0.016, 0.025), ["engine"], {
  pos: [2.51, -0.31, 0.22],
  name: "Exhaust heat-muff inspection seam",
  color: "#B17B56",
  pin: true,
  note: "Cabin heat air surrounds the exhaust housing without mixing with exhaust gas. Inspect the exhaust and heater for leakage/corrosion; a crack can contaminate cabin heat (MAN 106 § 3-22; Lycoming 60297-12 § 4-3).",
});
part(() => cyl(0.008, 0.02, "y", 8), ["engine", "electrical"], {
  pos: [CYLS[3].x, -0.09, -0.29],
  name: "Cylinder-head temperature probe",
  color: "#CC9346",
  pin: true,
  note: "The original engine cluster provides a single CHT indication, unlike a modern four-cylinder analyzer (1968 OM scan p. 14; MAN 106 § 7-3). Chosen cylinder and probe geometry schematic; N6947N modifications are unverified.",
});
part(() => cyl(0.006, 0.025, "y", 8), ["engine"], {
  pos: [CYLS[2].x, -0.27, 0.23],
  name: "EGT probe (optional)",
  color: "#CC9346",
  pin: true,
  note: "Optional exhaust-gas temperature indication is listed in the 1968 instrument panel (1968 OM scan p. 14). One riser probe is a study assumption; do not infer a fitted multi-probe engine monitor.",
});
// Only the starter/vibrator and engine-instrument feeds require electricity; ignition leads are magneto powered.
part(() => box(0.03, 0.025, 0.03), ["engine"], {
  pos: [2.245, 0.075, -0.11],
  name: "Left magneto retard breaker",
  color: "#6C8A95",
  pin: true,
  note: "Fixed-retard points plus battery starting vibrator provide long-duration starting sparks; START grounds the right magneto (1968 OM scan p. 15; Lycoming 60297-12 § 1-3 A1D table).",
});
