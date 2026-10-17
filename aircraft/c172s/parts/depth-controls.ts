// Frozen row keys identify authored members; preserve these tokens when inserting, moving or reshaping a row.
/** Mechanical drive detail: POH Figs 7-1/7-3/7-10; 172RPC24 Chapter27;
 * Garmin 190-00352-00Rev K 1-4. Shapes, bracket positions and travel clearances schematic. */
import { box, cyl, tubeGeo } from "../geometry";
import { P3, part, wp } from "./catalogue";
import { CAT } from "./catalogue";
const depthStart = CAT.parts.length;
import { RIG, RIG_SPEC } from "../rig";
import { live } from "../model";
const c = "#9F85E6";
for (const side of [-1, 1]) {
  const a = wp(side * 24, 0.66);
  part(() => box(0.055, 0.009, 0.044), ["flaps"], {
    id: "parts.depth-controls.flap-bellcrank-support.001",
    instance: [side],
    pos: [a[0], a[1] - 0.03, a[2]],
    name: "Flap bellcrank support",
    color: "#8895A1",
    pin: side > 0,
    note: "Structural support/pivot for the inboard flap bellcrank (172RPC24 27-50). Separate from the actuating rod and flap roller tracks; dimensions approximate.",
  });
  for (const [rowKey1, bl] of [
    ["row-001", 35],
    ["row-002", 85],
  ] as const)
    part(() => box(0.055, 0.01, 0.018), ["flaps"], {
      id: "parts.depth-controls.flap-roller-track.002",
      instance: [side, rowKey1],
      pos: wp(side * bl, 0.77, 0),
      name: "Flap roller track",
      color: "#BAC1C5",
      pin: side > 0 && bl === 35,
      note: "Rollers move in the single-slot flap track assembly (172RPC24 27-50; POH 7-23). Simplified neutral-position track; dimensions/roller spacing approximate.",
    });
  part(() => cyl(0.008, 0.027, "z", 12), ["flaps"], {
    id: "parts.depth-controls.flap-track-roller.003",
    instance: [side],
    pos: wp(side * 35, 0.79, 0),
    name: "Flap track roller",
    color: c,
    pin: side > 0,
    note: "Roller follows the flap track during extension/retraction (172RPC24 27-50). Marker position shows the neutral assembly and is not a surveyed rigging dimension.",
  });
}
const motor = wp(30, 0.6);
part(() => cyl(0.009, 0.09, "z", 14), ["flaps"], {
  id: "parts.depth-controls.flap-actuator-lead-screw.004",
  pos: [motor[0] - 0.08, motor[1], motor[2]],
  name: "Flap actuator lead screw",
  pin: true,
  color: c,
  note: "Electric motor drives the screw/actuator tube to move the flap mechanism (172RPC24 27-50-00 Fig 01). Lead and thread count schematic.",
});
part(() => cyl(0.014, 0.023, "z", 14), ["flaps"], {
  id: "parts.depth-controls.flap-drive-coupling.005",
  pos: [motor[0] - 0.045, motor[1], motor[2]],
  name: "Flap drive coupling",
  pin: true,
  color: "#A3ADB5",
  note: "Coupling connects the motor drive to the actuator installation (172RPC24 27-50-00 Fig 01). Separate from the cross-cabin synchronizing cables.",
});
for (const [i, [rowKey2, name]] of (
  [
    ["row-001", "Flap extend microswitch"],
    ["row-002", "Flap retract microswitch"],
  ] as const
).entries())
  part(() => box(0.021, 0.017, 0.023), ["flaps", "electrical"], {
    id: "parts.depth-controls.part.006",
    instance: [rowKey2],
    pos: [motor[0] + 0.04, motor[1], motor[2] + (i ? -0.035 : 0.035)],
    name,
    pin: true,
    color: "#D1B760",
    note: "Two microswitches and the switch bar control the reversible electric actuator (172RPC24 27-50-00 Fig 01; POH 7-23). Follow-up stops the motor at the selected position. Switching/overload timing is simplified.",
  });
part(() => box(0.06, 0.012, 0.008), ["flaps"], {
  id: "parts.depth-controls.flap-follow-up-switch-bar.007",
  pos: [motor[0] + 0.02, motor[1] + 0.027, motor[2]],
  name: "Flap follow-up switch bar",
  pin: true,
  color: c,
  anim: (m) => {
    m.rotation.y = live.flapAng * 0.01;
  },
  note: "Switch bar in the electric-flap assembly links position to the microswitch arrangement (172RPC24 27-50-00 Fig 01). Shown movement is illustrative; it does not represent certified switch rigging travel.",
});
part(() => box(0.016, 0.024, 0.03), ["flaps"], {
  id: "parts.depth-controls.flap-lever-mechanical-detents.008",
  pos: P3(18.3, 9, 50),
  name: "Flap lever mechanical detents",
  pin: true,
  color: c,
  note: "Slotted panel provides stops at 10°,20° and FULL; lever moves right to clear 10°/20° stops (POH 7-23). Lever stop geometry schematic.",
});
for (const channel of ["roll", "pitch", "trim"] as const) {
  const at = RIG.p3(RIG_SPEC.servo[channel]);
  part(() => box(0.09, 0.012, 0.1), ["autopilot", "controls"], {
    id: "parts.depth-controls.part.009",
    instance: [channel],
    pos: [at[0], at[1] - 0.05, at[2]],
    name: "GFC 700 " + channel + " mounting bracket",
    pin: true,
    color: "#899AA5",
    note: "GSM 85 mount/custom aircraft bracket transfers GSA 81 output to mechanical control linkage (Garmin 190-00352-00Rev K 1-4). POH equipment-list longitudinal arm retained; bracket shape/height schematic.",
  });
  part(() => cyl(0.028, 0.012, "z", 20), ["autopilot", "controls"], {
    id: "parts.depth-controls.part.010",
    instance: [channel],
    pos: [at[0], at[1], at[2] + 0.055],
    name: "GFC 700 " + channel + " servo clutch",
    pin: true,
    color: "#C68FB9",
    note: "Servo mount/capstan transfers torque to the control cable with an override/slip mechanism; A/P TRIM DISC removes automatic control (POH4-16; Fig 7-10; Garmin1-4). Clutch detail schematic.",
  });
  part(() => box(0.018, 0.022, 0.03), ["autopilot", "electrical"], {
    id: "parts.depth-controls.part.011",
    instance: [channel],
    pos: [at[0] + 0.04, at[1], at[2]],
    name: "GFC 700 " + channel + " electrical connector",
    pin: true,
    color: "#BC9F50",
    note: "AUTO PILOT breaker supplies servo power; GIAs communicate with GSA 81 usingRS-485 (POH Fig 7-7/Fig 7-10; Garmin1-4,1-7). Electrical connector distinct from mechanical bridle.",
  });
}
// Mechanical cockpit-to-firewall controls, not electrical wires.
for (const [rowKey3, name, a, b, note] of [
  [
    "row-001",
    "CABIN HT control cable",
    P3(18.4, 15.5, 48.5),
    P3(0.6, 5, 37.5),
    "Locking push-pull cable operates the firewall heat valve.",
  ],
  [
    "row-002",
    "CABIN AIR control cable",
    P3(18.4, 15.5, 46.5),
    P3(0.6, 14, 36.5),
    "Independent locking push-pull cable operates the ventilating-air door.",
  ],
  [
    "row-003",
    "Fuel shutoff control cable",
    P3(25.9, 2.2, 31),
    P3(4.5, -2.5, 26.5),
    "Red shutoff knob operates the supply shutoff valve; selector and shutoff are separate controls.",
  ],
  [
    "row-004",
    "Parking brake control cable",
    P3(18.6, -13.5, 43),
    P3(9, -8, 29),
    "Mechanical handle linkage holds the applied brake master-cylinder mechanism.",
  ],
] as const)
  part(
    () => tubeGeo([a, P3(12, a[2] / 0.0254, 38), b], 0.0025, 0),
    name.includes("CABIN") ? ["environment"] : name.includes("Fuel") ? ["fuel"] : ["gear"],
    {
      instance: [rowKey3],

      id: "parts.depth-controls.part.012",

      name,
      color: "#B2A77B",
      pin: true,
      note: note + " POH 7-37/46/62; 172RPC24 Chapters21/28/32. Route/radius schematic.",
    },
  );

export const DEPTH_CONTROLS_PARTS = CAT.parts.slice(depthStart);
