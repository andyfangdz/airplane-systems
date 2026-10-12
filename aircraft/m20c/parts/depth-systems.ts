/** Serial-applicable airframe-system hardware: MAN 106 §§ 4–9 and IPC 205 effectivity C680001–680198.
 * Append-only registration: legacy identifiers and moving-group datums stay stable.
 * Component envelopes are illustrative; sources establish functions and connections, not drawn routing dimensions. */
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { box, botY, cyl, sph, tubeGeo, wingP } from "../geometry";
import { DEPTH, depthWing, tankPickup, tankVent } from "../depth-anchors";
import { CABIN, MG, mainAxle } from "../placement";
import { JACK, JBAR, SERVO, TRIM_WHEEL, johnsonTip } from "../rig";
import { glow, part, sim } from "./catalogue";
import { breatherOpening, pumpDrainOpening, selectorDrain, ventOpening } from "../airframe-ports";

type Hardware = readonly [name: string, pos: Vec3, note: string];
const add = (items: readonly Hardware[], sys: SysId[], color: string, shape: "box" | "round" = "box") => {
  for (const [name, pos, note] of items) {
    const systems: SysId[] =
      sys.includes("flaps") && sys.includes("controls")
        ? name.startsWith("Flap")
          ? ["flaps"]
          : name.startsWith("Brake")
            ? ["gear", "flaps"]
            : name.startsWith("Parking")
              ? ["gear"]
              : ["controls"]
        : sys.includes("cabin") && sys.includes("environment")
          ? /door|seat|belt|Baggage|panel/.test(name)
            ? ["cabin"]
            : ["environment"]
          : sys.includes("vacuum") && sys.includes("autopilot")
            ? name.startsWith("PC")
              ? ["autopilot", "vacuum"]
              : ["vacuum"]
            : sys;
    part(() => (shape === "box" ? box(0.035, 0.028, 0.032) : cyl(0.013, 0.03, "x", 12)), systems, {
      name,
      pos,
      note: note + " Dimensions and placement approximate.",
      color,
      pin: true,
      anim:
        name === "Overvoltage warning lamp"
          ? glow("#554327", "#FFAA35", () => sim().E.overvoltage, ["electrical"])
          : undefined,
    });
  }
};

for (const side of [-1, 1]) {
  const name = side < 0 ? "Left" : "Right",
    filler = wingP(side * 1.6, 0.22, 1);
  add(
    [
      [
        name + " fuel tank pickup screen",
        tankPickup(side),
        "Wing tank outlet feeds the selector through its screened pickup (IPC 205 Fig. 36; MAN 106 § 4-1). Inspect fuel-system restrictions before attributing low pressure to the pump.",
      ],
      [
        name + " tank vent connection",
        tankVent(side),
        "Outboard rear tank vent connects the wet bay to its overboard tube; obstruction can impair feed (MAN 106 § 4-11).",
      ],
      [
        name + " sender float arm",
        depthWing(side, 1.3, 0.2),
        "Electrical float transmitter senses tank quantity (IPC 205 Fig. 36 inboard transmitter effectivity; MAN 106 § 4-12). Single sender per tank in this 1968 configuration; later multi-sender systems are not transplanted.",
      ],
      [
        name + " tank outlet fitting",
        depthWing(side, 0.85, 0.32),
        "Tank outlet and hose connection lead toward the floor selector (IPC 205 Fig. 36). Wet-wing seals, not removable bladder cells, establish this study configuration.",
      ],
    ],
    ["fuel"],
    "#4883B5",
    "round",
  );
  part(
    () => {
      const g = tubeGeo(
        Array.from({ length: 25 }, (_, i) => [
          Math.sin((i * Math.PI) / 12) * 0.03,
          0,
          Math.cos((i * Math.PI) / 12) * 0.03,
        ]),
        0.002,
        0,
      );
      return g;
    },
    ["fuel"],
    {
      pos: [filler.x, filler.y + 0.003, filler.z],
      name: "Filler cap O-ring",
      color: "#343B40",
      ext: true,
      pin: side > 0,
      note: "Fuel cap seal keeps rain out of the recessed filler. Inspect seals/caps and sample both sumps and selector after refueling (1968 OM scan p. 35–36,88; IPC 205 Fig. 36). Schematic seal beneath the existing cap.",
    },
  );
  part(() => sph(0.005), ["fuel"], {
    pos: ventOpening(side),
    name: "Fuel vent inlet",
    ext: true,
    pin: side > 0,
    color: "#4883B5",
    note: "Physical overboard vent opening on the tank's outboard rear corner. Check unobstructed (MAN 106 § 4-11;1968 OM scan p. 35–36). Opening and route meet here; dimensions approximate.",
  });
}
for (const [name, pos, sys, note] of [
  [
    "Selector sump drain outlet",
    selectorDrain,
    ["fuel"],
    "Selector pull-ring drain exits beneath the floor; sample with LEFT and RIGHT selected, then ensure drain is closed (1968 OM scan p. 87). Distinct from wing sump drains.",
  ],
  [
    "Crankcase breather overboard outlet",
    breatherOpening,
    ["engine"],
    "Engine breather discharges beneath the cowling. Inspect obstruction/security (Lycoming 60297-12 §§ 4,7).",
  ],
  [
    "Engine fuel-pump overboard drain",
    pumpDrainOpening,
    ["fuel", "engine"],
    "Pump/manifold leakage drains outside the cowling (MAN 106 § 4-10). Never connect this overboard line to fuel-tank vent or return plumbing.",
  ],
] as const)
  part(() => cyl(0.004, 0.015, "y", 10), [...sys], {
    name,
    pos,
    color: "#ADB4B7",
    ext: true,
    pin: true,
    note: note + " Physical opening approximate.",
  });
add(
  [
    [
      "Selector strainer bowl",
      DEPTH.selectorBowl,
      "The selector has an integral sediment/water collection and strainer assembly; do not add the1978 M20J separate gascolator arrangement (MAN 106 §§ 4-1,4-5).",
    ],
    [
      "Selector screen",
      DEPTH.selectorScreen,
      "Clean selector/drain screen every 50 h in this edition (MAN 106 § 4-5); a dirty screen restricts both tank selections. Screen geometry is a functional cutaway.",
    ],
    [
      "Boost pump inlet screen",
      DEPTH.boostScreen,
      "An obstructed boost-pump screen is among the no-pressure troubleshooting causes (MAN 106 § 4-2). Distinct from selector and carburetor strainers.",
    ],
    [
      "Fuel firewall bulkhead fitting",
      DEPTH.fuelFirewall,
      "Rigid cabin fuel line connects to the engine-compartment hose at the firewall fitting (IPC 205 Fig. 36). Inspect hose condition, vibration and clamp security (MAN 106 § 4-2; Lycoming 60297-12 § 4-3).",
    ],
  ],
  ["fuel"],
  "#4883B5",
  "round",
);

add(
  [
    [
      "Main bus bar",
      DEPTH.bus,
      "Single-bus distribution feeds switch-breakers, instrument/warning circuits and installed radios (1968 OM scan p. 24–27; MAN 106 § 9-1). No modern avionics essential bus is implied.",
    ],
    [
      "Battery ammeter shunt",
      DEPTH.shunt,
      "Shunt-type ammeter indicates battery charge/discharge, rather than the older generator load meter (1968 OM scan p. 24; MAN 106 § 9-1).",
    ],
    [
      "Starter solenoid",
      DEPTH.starterRelay,
      "START energizes a contactor to switch the heavy starter cable; magneto ignition remains independent of this battery feed (MAN 106 § 9-6).",
    ],
    [
      "Alternator overvoltage relay",
      DEPTH.overvoltage,
      "Alternator-equipped variant uses a transistorized regulator and overvoltage relay (MAN 106 § 9-1). This study keeps its existing60A alternator option; N6947N charging-system logs have not been supplied.",
    ],
    [
      "ALT FIELD circuit breaker",
      DEPTH.fieldBreaker,
      "Field protection is on the main breaker panel (MAN 106 § 9-3). A loss of field excitation stops an alternator without changing manual gear/flap operation.",
    ],
    [
      "ALT output breaker (1968 side panel)",
      DEPTH.outputBreaker,
      "Main alternator output breaker is on the right-side upholstery panel on 1968 models; moved to main panel from 1969 (1968 OM scan p. 14 item 44; MAN 106 § 9-3).",
    ],
    [
      "Airframe ground connection",
      [1.91, -0.16, -0.27],
      "12V negative-ground battery and bonded airframe complete the circuit (1968 OM scan p. 24). Check corrosion and connection security before replacing charging components (MAN 106 § 9-3).",
    ],
    [
      "NAV/COM 1 case (study installation)",
      [1.64, 0.005, -0.08],
      "1968 OM lists optional radio equipment, not these specific models. Two NAV/COM units are retained from the baseline study; case depth and circuit split illustrative.",
    ],
    [
      "NAV/COM 2 case (study installation)",
      [1.64, -0.04, -0.08],
      "Optional installed-radio case; cooled by fresh-air grill/tubes rather than an assumed modern avionics fan (1968 OM scan p. 29; MAN 106 § 8-1). Radio models unverified.",
    ],
    [
      "Transponder case (study installation)",
      [1.64, -0.085, -0.08],
      "Baseline study transponder, not a claimed factory 1968 radio. Feed, ground and coax are illustrated separately; installation records are required for exact configuration.",
    ],
    [
      "Instrument-light rheostat",
      [1.55, -0.19, -0.34],
      "Rheostat controls instrument illumination; cabin spotlight and dome-light circuits remain separate (1968 OM scan p. 28).",
    ],
    [
      "Overvoltage warning lamp",
      [1.49, 0.1, 0.32],
      "Alternator-equipped aircraft have an overvoltage warning light; this is distinct from a discharge indication on the ammeter (1968 OM scan p. 14,24). The study fault forces an overvoltage event, not a detailed relay calibration.",
    ],
  ],
  ["electrical"],
  "#C9922C",
);
add(
  [
    [
      "Fuel quantity gauge (left)",
      [1.55, 0.075, 0.27],
      "Powered transmitter/cluster-gauge circuit; loss of electrical indication does not stop fuel flow (1968 OM scan p. 14,16).",
    ],
    [
      "Fuel quantity gauge (right)",
      [1.55, 0.075, 0.36],
      "Each wet wing has an independent fuel quantity indication (1968 OM scan p. 14,16).",
    ],
    [
      "Oil pressure gauge",
      [1.55, 0.03, 0.27],
      "Mechanical engine-pressure line and firewall fitting, IPC 205 Fig. 42 for 1968 C. Illustrated separately from engine oil supply.",
    ],
    [
      "Oil temperature gauge",
      [1.55, 0.03, 0.36],
      "Original engine-cluster temperature instrument; exact sender technology/retrofit status unverified (1968 OM scan p. 14; IPC 205 Fig. 42).",
    ],
    [
      "CHT gauge",
      [1.55, -0.015, 0.27],
      "Original single-channel cylinder-head temperature indication (1968 OM scan p. 14; MAN 106 § 7-3).",
    ],
    [
      "Ammeter (battery charge/discharge)",
      [1.55, -0.015, 0.36],
      "A shunt instrument indicating net battery current, not alternator total output (1968 OM scan p. 24; MAN 106 § 9-1).",
    ],
    [
      "Mechanical tachometer drive",
      [2.22, 0.11, 0.04],
      "Flexible shaft/cable drives tachometer from engine accessory case (IPC 205 Fig. 37; MAN 106 § 7-3). No electrical bus power is required.",
    ],
  ],
  ["engine", "electrical"],
  "#6C7B87",
  "round",
);
add(
  [
    [
      "Artificial horizon vacuum gyro",
      DEPTH.attitude,
      "Optional vacuum flight instrument, separately fed from filtered-air inlet and suction outlet (1968 OM scan p. 17; IPC 205 Fig. 43).",
    ],
    [
      "Directional gyro",
      DEPTH.directional,
      "Optional vacuum directional gyro; independent instrument branch joins suction manifold (1968 OM scan p. 17; IPC 205 Fig. 43).",
    ],
    [
      "Vacuum warning pressure switch",
      DEPTH.vacuumSwitch,
      "Pressure switch controls HI/LO warning lights; warnings need electric power while gyro suction does not (MAN 106 § 9-4; IPC 205 Fig. 43).",
    ],
    [
      "Vacuum regulator inlet filter",
      [1.87, 0.095, -0.13],
      "Regulator admits filtered relief air to control suction; distinct from instrument central filter (IPC 205 Fig. 43 regulating valve/filter, 1968 effectivity).",
    ],
    [
      "PC pilot valve (pneumatic relay)",
      DEPTH.pcPilot,
      "Pilot valve supplies the rate-gyro valve and relieves servo vacuum when the wheel button vents its control line (Brittain 11968 §§ 2.2,3.3–3.4). The 1968 control is pneumatic; no later electric-solenoid disconnect is fitted.",
    ],
    [
      "PC rate-gyro rotary valve",
      DEPTH.pcRate,
      "Tilted rate gyro operates spool/sleeve valve: one output applies vacuum while the opposite is vented to atmosphere; four servos balance in straight flight (Brittain 11968 § 2.2; MAN 106 § 6-9).",
    ],
    [
      "PC roll-trim valve",
      DEPTH.pcTrim,
      "Roll trim biases the pneumatic signal for asymmetric loading; it does not replace correct airframe rigging or provide a magnetic heading hold (Brittain 11968 § 2.2).",
    ],
  ],
  ["vacuum", "autopilot"],
  "#B05B95",
);
for (const side of [-1, 1]) {
  const pos: Vec3 = [SERVO.roll[0], SERVO.roll[1] + 0.025, side * Math.abs(SERVO.roll[2])];
  add(
    [
      [
        "PC aileron servo diaphragm",
        pos,
        "Rubber servo diaphragm converts suction differential to force at the outboard aileron bellcrank. Leaks, pinched tubing and command imbalance are separately isolated by service tests (Brittain 11968 §§ 8–9).",
      ],
    ],
    ["autopilot", "controls"],
    "#A8498D",
    "round",
  );
  add(
    [
      [
        "PC rudder servo diaphragm",
        [SERVO.yaw[0], SERVO.yaw[1], side * 0.1],
        "Two tail-cone servos connect to rudder control tubes; no pitch/altitude-hold axis is part of base PC (MAN 106 § 6-9; Brittain 11968 § 1.3).",
      ],
    ],
    ["autopilot", "controls"],
    "#A8498D",
    "round",
  );
}

add(
  [
    [
      "Brake fluid reservoir cap",
      [DEPTH.hydraulic[0], DEPTH.hydraulic[1] + 0.045, DEPTH.hydraulic[2]],
      "Vent/fill cap on the common brake/flap reservoir; check quantity with flaps retracted (MAN 106 § 2-21). No hydraulic pump is connected to landing-gear retraction.",
    ],
    [
      "Flap hand-pump body",
      DEPTH.flapPump,
      "Pump/valve assembly operated by the cabin handle; IPC 205 Fig. 30 identifies626-1 forM20C and separates inlet/outlet, piston and release components.",
    ],
    [
      "Flap pump inlet check valve",
      DEPTH.flapInlet,
      "Check valve admits reservoir fluid on the refill stroke; pump valves trap pressure for subsequent delivery (IPC 205 Fig. 30; MAN 106 §§ 6-6,8-2). Functional cutaway.",
    ],
    [
      "Flap pump outlet check valve",
      DEPTH.flapOutlet,
      "Outlet check retains delivered actuator pressure when the flap control is DOWN. Internal leakage can cause flaps to creep up (MAN 106 § 8-2; IPC 205 Fig. 30).",
    ],
    [
      "Flap pressure release valve",
      DEPTH.flapRelease,
      "UP opens controlled release back to the reservoir; spring/air force raises flaps, and returning control DOWN stops retraction (1968 OM scan p. 20–21; IPC 205 Fig. 30).",
    ],
    [
      "Flap actuator bleed fitting",
      [0.34, -0.62, 0.018],
      "Bleeder at hydraulic-cylinder end fitting; air causes erratic pump operation, requiring the specified bleed procedure (MAN 106 § 6-6.4,Fig. 6-13).",
    ],
    [
      "Parking brake control-cable attachment",
      [1.65, -0.385, -0.25],
      "Mechanical knob/cable locks wheel-brake pressure at the parking valve, rather than generating pressure (MAN 106 § 5-16).",
    ],
    [
      "Trim-wheel reduction gearbox",
      [TRIM_WHEEL.c[0] + 0.045, -0.6, 0],
      "Floor trim wheel drives gear reduction and torque tube to the aft jackscrew (MAN 106 § 6-3; IPC 205 Fig. 28). Whole empennage moves; no elevator trim tab or electric trim motor.",
    ],
    [
      "Trim torque-tube coupling",
      [0.35, -0.62, 0],
      "Torque tube and universal joints transfer trim-wheel rotation aft to the gearbox/jackscrew (IPC 205 Fig. 28; MAN 106 § 6-3).",
    ],
    [
      "Aft trim gearbox",
      [JACK[0] + 0.075, JACK[1] + 0.03, 0],
      "Trim torque tube operates the aft jackscrew at the tail-cone bulkhead (IPC 205 Fig. 28; MAN 106 § 6-3). Inspect/lubricate per maintenance instructions; dimensions illustrative.",
    ],
    [
      "Trim jack-screw bearing support",
      [JACK[0], JACK[1] + 0.04, 0],
      "Support carries the screw loads while the tail pivots. Check wear/free play in trim and empennage attachment (MAN 106 § 6-3; IPC 205 Fig. 18,28).",
    ],
    [
      "Trim indicator cable drum",
      [TRIM_WHEEL.c[0] + 0.08, -0.57, 0.04],
      "Mechanical trim-position indication is separate from the tail-angle actuator (IPC 205 Fig. 28). No electrical power required.",
    ],
    [
      "Flap indicator cable attachment",
      [0.25, -0.58, 0.025],
      "Actuator-position cable sets the cabin pointer. Rig takeoff mark and actuator attachment perFig6-13 (MAN 106 § 6-6).",
    ],
    [
      "Aileron/rudder interconnect spring",
      [1.4, -0.58, 0.13],
      "Spring-loaded mechanical interconnect assists lateral/directional stability independently of PC vacuum (1968 OM scan p. 18; MAN 106 § 6-1).",
    ],
  ],
  ["controls", "flaps", "gear"],
  "#8B75AD",
  "round",
);

for (const [x, z] of [
  [1.35, 0],
  [-0.35, 0],
  [-1.15, 0],
  [-1.95, 0],
] as const)
  part(() => box(0.035, 0.035, 0.04), ["controls"], {
    pos: [x, Math.max(-0.57, botY(x) + 0.06), z],
    name: "Control-tube guide block",
    color: "#CCC1A1",
    pin: x === -1.15,
    note: "Formica guide blocks support push-pull control tubes; inspect wear, freedom and lubrication rather than treating these rods as cables (MAN 106 §§ 1-6,6-1). Stations are illustrative, not a rigging reference.",
  });
part(() => box(0.025, 0.025, 0.03), ["gear", "electrical"], {
  pos: [JBAR.pivot[0] + 0.06, -0.58, 0.035],
  name: "Manual gear down-lock switch",
  color: "#C9922C",
  pin: true,
  note: "Manual gear warning/position circuit follows engagement of the cabin handle/downlock, with the throttle switch providing the horn demand (MAN 106 § 9-4;1968 OM scan p. 21–22). It is not the optional electric-gear airspeed safety switch.",
});
part(() => cyl(0.013, 0.025, "z", 12), ["gear"], {
  pos: johnsonTip(0).toArray() as Vec3,
  name: "Down-lock socket engagement pin",
  color: "#A7AEB5",
  pin: true,
  note: "Downlock engagement must be checked positively; worn socket or latch is a maintenance issue (MAN 106 § 5-2;1968 OM scan p. 21–22). The existing bar remains the moving mechanism, this shows its fixed lock interface.",
});
for (const side of [-1, 1]) {
  const parent = side < 0 ? "mainL" : "mainR",
    axle = mainAxle(side);
  for (const [name, pos, note] of [
    [
      "Main gear drag brace",
      [axle[0] * 0.5, axle[1] * 0.5, axle[2] * 0.5],
      "Over-center linkage holds the main gear down. Check prescribed preload/rigging on jacks; assist springs do not replace correct locking geometry (MAN 106 §§ 5-2–5-3; IPC 205 Fig. 22,25).",
    ],
    [
      "Main shock-disc retaining collar",
      [axle[0] * 0.6, axle[1] * 0.6, axle[2] * 0.6],
      "Retainer/collar contains rubber shock-disc stack; inspect deformation and replace discs according to service limits (MAN 106 § 5-3; IPC 205 Fig. 22).",
    ],
    [
      "Brake caliper",
      [axle[0] - 0.06, axle[1] - 0.04, axle[2] - side * 0.09],
      "Wheel brake cylinder/caliper grips the single disc; inspect leakage, piston seal and lining wear (MAN 106 § 5-14; IPC 205 Fig. 24).",
    ],
    [
      "Brake pad",
      [axle[0] - 0.08, axle[1] - 0.03, axle[2] - side * 0.095],
      "Friction lining on the brake assembly; wear and attachment condition are maintenance checks (MAN 106 § 5-14).",
    ],
    [
      "Brake bleeder screw",
      [axle[0] - 0.06, axle[1] + 0.008, axle[2] - side * 0.09],
      "Bleeder provides wheel-cylinder servicing point. Hydraulic brakes are independent left/right circuits sharing a reservoir with hand-pump flaps (MAN 106 § 2-21,5-14).",
    ],
    [
      "Main axle retaining nut",
      [axle[0], axle[1], axle[2] + side * 0.085],
      "Axle nut/cotter pin retain wheel; wheel bearing service and nut adjustment follow MAN 106 § 5-13 and IPC 205 Fig. 24.",
    ],
  ] as const)
    part(() => cyl(0.016, 0.025, "z", 12), ["gear"], {
      parent,
      pos: [...pos],
      name,
      note: note + " Geometry approximate.",
      color: "#9AA6B0",
      ext: true,
      pin: side > 0,
    });
  part(() => cyl(0.012, 0.04, "z", 14), ["gear"], {
    pos: [MG.trunnion[0], MG.trunnion[1], side * MG.trunnion[2]],
    name: "Main gear trunnion bearing",
    color: "#9AA6B0",
    pin: side > 0,
    ext: true,
    note: "Fixed lower-wing attach bearing is exposed in the gear well and supports the folding leg; linkage/attach security and lubrication are inspected under MAN 106 §§ 5-2–5-3. Shape illustrative around the preserved trunnion datum.",
  });
  part(
    () =>
      tubeGeo(
        [
          [0, 0, 0],
          [axle[0] * 0.3 + 0.03, axle[1] * 0.3, axle[2] * 0.3],
          [axle[0] - 0.06, axle[1] - 0.04, axle[2] - side * 0.09],
        ],
        0.004,
        0,
      ),
    ["gear"],
    {
      parent,
      name: "Brake wheel flexible hose",
      color: "#8B75AD",
      ext: true,
      pin: side > 0,
      note: "Exterior wheel-brake hose runs from the gear-well connection down the folding strut to the caliper. It moves with the preserved gear group; internal supply line ends inside the wing (MAN 106 § 5-14; IPC 205 Fig. 24). Path/clearance approximate.",
    },
  );
}
part(() => cyl(0.016, 0.04, "y", 12), ["gear"], {
  parent: "nose",
  pos: [-0.07, -0.23, 0],
  name: "Nose gear steering pivot bolt",
  color: "#9AA6B0",
  ext: true,
  pin: true,
  note: "Steering-horn/pivot wear and stop condition require inspection after towing damage (1968 OM scan p. 35; MAN 106 § 5-11). Geometry follows the existing moving nose gear, not an oleo strut.",
});

add(
  [
    [
      "Cabin heat shutoff valve",
      [1.88, -0.285, 0.34],
      "Valve at firewall junction controls exhaust-heated ram air. Inspect heat valve operation and flexible ducts; cabin air does not flow through exhaust gas (MAN 106 § 8-1).",
    ],
    [
      "Cabin fresh-air valve",
      [1.84, -0.28, 0.35],
      "Right scoop supplies cool air to junction box for cabin/defrost distribution (1968 OM scan p. 28–29; MAN 106 § 8-1).",
    ],
    [
      "Pilot heat outlet control",
      [1.23, -0.43, -0.29],
      "Cabin heat inlet handle/louvers regulate delivered air separately from the firewall heat control (1968 OM scan p. 14,29).",
    ],
    [
      "Copilot heat outlet control",
      [1.23, -0.43, 0.29],
      "Right front outlet control regulates heat delivery (1968 OM scan p. 14,29).",
    ],
    [
      "Left radio cooling tube",
      [1.48, -0.2, -0.34],
      "Left scoop supplies pilot eyeball outlet and two radio cooling tubes; no electrically driven cabin fan is implied (1968 OM scan p. 29).",
    ],
    [
      "Right radio cooling tube",
      [1.48, -0.15, -0.3],
      "Second fresh-air radio cooling branch from left scoop (1968 OM scan p. 29). Routing approximate to the baseline radio cases.",
    ],
    [
      "Defroster outlet manifold",
      [1.62, 0.15, 0.08],
      "Windshield outlets receive conditioned air from the cabin junction box (1968 OM scan p. 29; MAN 106 § 8-1).",
    ],
    [
      "Cabin door latch linkage",
      [0.94, -0.12, 0.51],
      "Door latch/handle linkage secures the forward-opening cabin door (IPC 205 Fig. 15, 1968–75). Inspect engagement and avoid forcing the door (MAN 106 § 5-11).",
    ],
    [
      "Baggage door latch",
      [-0.4, -0.1, 0.4],
      "Lock/latch secures the baggage access door (IPC 205 Fig. 16). Flight/check configuration follows the 1968 preflight; exact aftermarket latch status unverified.",
    ],
    [
      "Front seat track stop",
      [CABIN.frontSeatX, -0.54, 0.23],
      "Seat tracks/stops retain adjustable front seats; check secure seat position before start (1968 OM scan p. 30,36; IPC 205 cabin furnishing figures).",
    ],
    [
      "Front lap-belt anchor",
      [CABIN.frontSeatX, -0.43, -0.44],
      "Front seat safety belt attaches to cabin structure; inspect fabric, fittings and locking function (1968 OM scan p. 30). Shoulder-harness retrofit is not inferred.",
    ],
    [
      "Rear lap-belt anchor",
      [CABIN.rearSeatX, -0.43, -0.35],
      "Rear belts protect seated occupants; baggage must also be secured within weight/balance limits (1968 OM scan p. 30).",
    ],
    [
      "Baggage restraint attachment",
      [-0.22, -0.48, 0.3],
      "Baggage compartment maximum 120 lb subject to CG; secure cargo before flight (1968 OM scan p. 10,30). Model anchor is illustrative, not an installed restraint certification.",
    ],
    [
      "Instrument panel shock mount",
      [1.48, 0.16, -0.44],
      "Primary flight panel is shock mounted (1968 OM scan p. 17). Mounting hardware/schematic spacing differ from a modern glass-panel installation.",
    ],
  ],
  ["environment", "cabin"],
  "#62A59B",
);
add(
  [
    [
      "Airspeed indicator pressure connection",
      [1.55, 0.055, -0.36],
      "Airspeed measures pitot pressure against static; it is not electrically powered (1968 OM scan p. 17–18; MAN 106 § 7-2).",
    ],
    [
      "Altimeter static connection",
      [1.55, 0.055, -0.18],
      "Static pressure feeds altimeter; the optional alternate static source substitutes cabin pressure (1968 OM scan p. 18; IPC 205 Fig. 44).",
    ],
    [
      "Vertical-speed static connection",
      [1.55, -0.065, -0.18],
      "Optional rate-of-climb instrument shares static pressure, through its calibrated leak; no electric VSI or air-data computer is assumed (1968 OM scan p. 17–18; IPC 205 Fig. 44).",
    ],
    [
      "Pitot drain junction",
      depthWing(-1, 0.8, 0.15),
      "Low point in left wing permits line drainage. Port is separate from tank sump drain (IPC 205 Fig. 44; MAN 106 § 7-2).",
    ],
    [
      "Static drain junction",
      [-2.4, -0.43, 0],
      "Tail-cone static plumbing connects two ports and a low-point drain (IPC 205 Fig. 44). Water can disturb all three pressure instruments without affecting vacuum gyros.",
    ],
    [
      "Stall warning electrical switch",
      depthWing(-1, 1.9, 0.02),
      "Leading-edge vane closes a switch and sounds the electric horn; this is not the Cirrus suction-operated stall inlet (1968 OM scan p. 18; MAN 106 § 9-4).",
    ],
  ],
  ["pitot"],
  "#4384AF",
  "round",
);
