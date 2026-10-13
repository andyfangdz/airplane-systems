/**
 * C182T NAV III installation depth. Baseline POH182TPHAUS-04 Rev4 remains authoritative;
 * Cessna182SMM14 Rev14(1Jul2007) supplies NAVIII-specific component and attachment detail.
 * All dimensions/BL/height below are schematic; these are study parts, not installation drawings.
 */
import { glowAnim, brakeAmount } from "@/lib/anims";
import { type PartSpec } from "@/lib/catalogue";
import { box, cyl, tubeGeo } from "../geometry";
import { DEPTH as D } from "../depth-anchors";
import { EL, P3, S, cAt, part, wp } from "./catalogue";
import type { Vec3 } from "@/lib/math";

export const SYSTEM_DEPTH_PARTS: PartSpec[] = [];
const add: (...args: Parameters<typeof part>) => PartSpec = (...args) => {
  const spec = part(...args);
  SYSTEM_DEPTH_PARTS.push(spec);
  return spec;
};
const unit = (
  name: string,
  pos: Vec3,
  size: Vec3,
  sys: PartSpec["sys"],
  note: string,
  color = "#687781",
  pin = false,
  on?: () => boolean,
) =>
  add(() => box(...size), sys, {
    pos,
    name,
    note: note + " Dimensions and placement schematic.",
    color,
    pin,
    anim: on ? glowAnim(color, on, sys) : undefined,
  });

/* Four J-box contactors and source feeder protection, POH Fig. 7-7 Sheet1. */
for (const [i, name, on, note] of [
  [
    0,
    "Battery contactor",
    () => S().elec.bat && EL().node > 0,
    "MASTER BAT grounds its coil and connects tailcone battery to starter contacts/current shunt (POH 7-48; MM 24-00-00 p. 1).",
  ],
  [
    1,
    "Alternator contactor",
    () => EL().altOn,
    "Connects alternator output to main distribution; independent field control remains through ACU/ALT FIELD (POH Fig. 7-7 Sheet 1).",
  ],
  [
    2,
    "Starter contactor",
    () => EL().starterPwr && S().eng.mags === "START",
    "Ignition START and WARN power close starter contacts upstream of M BATT shunt; starting current is not the displayed net battery current (POH 7-48/7-53).",
  ],
  [
    3,
    "External-power contactor",
    () => S().elec.ext,
    "External source joins battery side of BAT contactor; polarity-protection diode prevents an incorrect connection (POH 7-48/7-55).",
  ],
] as const)
  unit(
    name,
    [D.jbox[0], D.jbox[1] + 0.045, D.jbox[2] - 0.048 + i * 0.032],
    [0.036, 0.026, 0.025],
    ["electrical"],
    note,
    "#7B8285",
    false,
    on,
  );
for (const [i, name] of [
  [0, "Feeder B protection"],
  [1, "Feeder A protection"],
  [2, "Spare feeder protection"],
] as const)
  unit(
    name,
    [D.jbox[0] + 0.027, D.jbox[1] - 0.044, D.jbox[2] - 0.045 + i * 0.045],
    [0.024, 0.021, 0.026],
    ["electrical"],
    "Three push-to-reset breakers in J-box: B supplies BUS1, A BUS2, third unused (POH 7-48/7-55). POH does not print feeder rating; MM 24-00-00 p. 1 lists multiple 30/40 A production variants, so none is assigned here.",
    "#CAB267",
  );
unit(
  "Standby battery fuse (25 A)",
  [D.stby[0] + 0.073, D.stby[1] - 0.045, D.stby[2]],
  [0.028, 0.016, 0.026],
  ["electrical"],
  "Fixed 25 A fuse at standby battery, ahead of controller and ESS-bus breaker (POH Fig. 7-7 Sheet 3, 7-50).",
  "#C8AA51",
  true,
);
unit(
  "Standby battery test load",
  [D.controller[0], D.controller[1] - 0.03, D.controller[2]],
  [0.045, 0.02, 0.055],
  ["electrical"],
  "Momentary TEST routes battery through a test load and overheat switch; green lamp reports energy acceptance, not charge percentage (POH 7-50/7-52).",
  "#69634C",
  false,
  () => S().elec.stby === "TEST",
);
unit(
  "Standby battery controller",
  D.controller,
  [0.025, 0.065, 0.1],
  ["electrical"],
  "MM 24-30-10 p. 201 places controller PCB on back of switch panel; controller senses main voltage via WARN, controls charge/discharge and S BATT shunt (POH 7-50).",
  "#476F61",
  true,
);
for (const [i, bus] of [
  [0, "ESSENTIAL"],
  [1, "CROSSFEED"],
] as const)
  for (const side of [-1, 1] as const) {
    add(() => cyl(0.009, 0.025, "z"), ["electrical"], {
      pos: [D.cb[0] + 0.027, D.cb[1] + i * 0.027, D.cb[2] + side * 0.04],
      name: `${bus} bus isolation diode`,
      color: "#926A35",
      note: "One-way feeds from each primary bus prevent backfeeding the failed bus (POH Fig. 7-7 Sheet 2; MM 24-61-01 Figure 201 Sheet 2, p. 203). Body and position schematic.",
    });
  }
for (const [i, name] of [
  "ELECTRICAL BUS 1",
  "ELECTRICAL BUS 2",
  "CROSSFEED BUS",
  "ESSENTIAL BUS",
  "AVIONICS BUS 1",
  "AVIONICS BUS 2",
].entries())
  unit(
    `${name} copper bar`,
    [D.cb[0] + 0.027, D.cb[1] - 0.066 + i * 0.027, D.cb[2]],
    [0.01, 0.008, 0.2],
    ["electrical"],
    "Schematic bus bar behind breaker panel; supplies/diode isolation/avionics switching follow POH Fig. 7-7 Sheet 2. No measured bus dimensions implied.",
    "#AD7A3D",
  );

unit(
  "External-power polarity diode",
  [D.jbox[0] + 0.02, D.jbox[1] + 0.04, D.jbox[2] + 0.05],
  [0.018, 0.02, 0.027],
  ["electrical"],
  "J-box external-power relay control includes a polarity-protection diode. Correctly polarized regulated power is required at the receptacle (POH Fig. 7-7 Sheet 1, 7-55).",
  "#916C37",
);

/* The four NAVIII fans, their display supports and remote rack duct ports. */
for (const [name, at, on] of [
  ["PFD display cooling fan", D.pfdFan, () => EL().fwdFan],
  ["MFD display cooling fan", D.mfdFan, () => EL().mfdFan],
] as const) {
  add(() => cyl(0.027, 0.018, "x"), ["avionics"], {
    pos: at,
    name,
    color: "#4B5960",
    pin: true,
    note: "MM 21-21-00 pp. 201–204: separate display fan behind each GDU; airflow toward display. PFD/deck fan on AV1:PFD, MFD fan on AV2:MFD (POH 7-49/7-69). Approximate housing.",
    anim: glowAnim("#4B5960", on, ["avionics"]),
  });
  for (const phase of [0, Math.PI / 2])
    add(() => box(0.004, 0.042, 0.008), ["avionics"], {
      pos: [at[0] + 0.012, at[1], at[2]],
      name,
      color: "#939DA3",
      anim: (m, t) => {
        if (on()) m.rotation.x = phase + t * 28;
      },
    });
}
for (const [name, at] of [
  ["GIA 1 mounting rack", D.gia1],
  ["GIA 2 mounting rack", D.gia2],
  ["AHRS calibrated mounting tray", D.ahrs],
] as const)
  unit(
    name,
    [at[0], at[1] - 0.043, at[2]],
    [0.26, 0.006, 0.15],
    ["avionics"],
    "MM 34-50-10 p. 201/34-23-00 p. 201: units on tailcone shelf; AHRS rack must retain calibrated orientation. Rack dimensions schematic.",
    "#9DA6AC",
  );
unit(
  "Audio fail-safe relay",
  [D.audio[0] + 0.07, D.audio[1] - 0.075, D.audio[2]],
  [0.028, 0.025, 0.035],
  ["avionics"],
  "GMA 1347 power-off fail-safe connects pilot headset to COMM1; audio functions otherwise need AV2:AUDIO (POH 7-66). A source-supported fallback, not an independently simulated radio.",
  "#777E85",
);
unit(
  "Cabin audio speaker",
  P3(55, 0, 77),
  [0.08, 0.012, 0.08],
  ["avionics", "cabin"],
  "Speaker is an audio-panel output; crew headset/microphone circuits and intercom controlled by GMA 1347 (POH 7-66). Position schematic below headliner.",
  "#424B52",
  true,
);
for (const [fs, bl] of [
  [37, -16],
  [37, 16],
  [79, -16],
  [79, 16],
]) {
  unit(
    "Headset and microphone jacks",
    P3(fs === 37 ? 27 : fs, bl, 45),
    [0.023, 0.035, 0.03],
    ["avionics", "cabin"],
    "Pilot/passenger headphone and microphone connections to GMA 1347; rear positions are intercom/entertainment, not independent NAV/COM radios (POH 7-66). Locations approximate.",
    "#555E66",
  );
}

/* Integrated-reservoir master cylinders and mechanical parking actuation: no SR20 remote reservoir transplant. */
for (const [side, at] of [
  ["L", D.masterL],
  ["R", D.masterR],
] as const) {
  const pressure = () => brakeAmount(S().gear, side);
  add(() => cyl(0.016, 0.13, "y"), ["gear"], {
    pos: at,
    name: `${side} brake master cylinder`,
    color: "#7B9198",
    pin: true,
    note: "One of TWO pilot master cylinders with integral fluid reservoir immediately ahead of pedals; copilot pedals operate them mechanically (MM 32-42-00 p. 201; POH 7-46). Schematic dimensions.",
    anim: glowAnim("#7B9198", () => pressure() > 0, ["gear"]),
  });
  add(() => cyl(0.019, 0.026, "y"), ["gear"], {
    pos: [at[0], at[1] + 0.077, at[2]],
    name: "Integral brake-fluid reservoir",
    color: "#6B7780",
    note: "Each master cylinder incorporates its own supply reservoir; MIL-PRF-5606 servicing (MM 32-42-00 pp. 201/204). No separate common reservoir shown.",
  });
  add(() => cyl(0.006, 0.06, "y"), ["gear"], {
    pos: [at[0], at[1] + 0.031, at[2]],
    name: "Master-cylinder piston rod",
    color: "#B7C4CA",
    note: "Toe pressure drives piston; parking cable linkage holds both piston rods (MM 32-42-00 p. 201). Illustrative travel.",
    anim: (m) => {
      m.position.y = at[1] + 0.031 - pressure() * 0.015;
    },
  });
  unit(
    "Master-cylinder parking linkage",
    [at[0] - 0.025, at[1] + 0.07, at[2]],
    [0.04, 0.012, 0.025],
    ["gear"],
    "Parking handle ratchet pulls a cable and depresses both master-cylinder piston rods; release by rotating handle (MM 32-42-00 p. 201/205).",
    "#9FAAB0",
  );
}
unit(
  "Parking-brake ratchet and cable anchor",
  D.park,
  [0.08, 0.034, 0.055],
  ["gear"],
  "Mechanical handle/ratchet holds master-cylinder linkage; this C182T has no source-supported hydraulic parking shutoff valve (MM 32-42-00 p. 201, Figure 203).",
  "#77858E",
  true,
  () => S().gear.park,
);
add(() => cyl(0.018, 0.15, "z"), ["gear"], {
  pos: P3(-0.5, 8, 28),
  name: "Nose gear shimmy damper",
  color: "#A0ADB6",
  pin: true,
  note: "MM 12-12-00/32-20: hydraulic damper uses fluid and floating compensating piston; Lord rubber-type replacement is a different equipment variant. This schematic represents hydraulic type; installed serial configuration not asserted.",
});
for (const side of [-1, 1])
  add(() => cyl(0.008, 0.13, "x"), ["gear", "controls"], {
    pos: P3(5, side * 5, 30),
    name: "Steering bungee spring",
    color: "#849198",
    note: "Spring-loaded steering bungees couple rudder bars to nose-gear steering; pedals about 11 degrees, differential braking up to 29 degrees (POH 7-19). Position and section schematic.",
  });

/* Fuel vent valve internals and float gauging; existing supply/return stack and ten sump drains remain. */
for (const side of [-1, 1]) {
  const vent = wp(side * 97, 0.3, 0);
  unit(
    "Fuel vent check valve",
    vent,
    [0.034, 0.018, 0.034],
    ["fuel"],
    "MM 28-20-00 p. 206/Figure 205: outboard tank vent check valve admits air and its bypass bleed releases thermal expansion pressure. Opposite-tank crossover and vacuum-vented filler cap provide separate vent paths.",
    "#3D74A1",
    side > 0,
  );
  add(() => cyl(0.006, 0.012, "x"), ["fuel"], {
    pos: [vent[0] + 0.008, vent[1], vent[2]],
    name: "Vent-valve bypass bleed",
    color: "#A6CAE2",
    note: "Small bypass port at top of valve flap releases positive tank pressure; obstruction can overpressurize tank even with engine stopped (MM 28-20-00 p. 206). Size illustrative.",
  });
  const sender = wp(side * 62, cAt(56.3, 62));
  add(() => tubeGeo([sender, [sender[0] + 0.12, sender[1] - 0.035, sender[2]]], 0.003, 0), ["fuel"], {
    name: "Fuel sender float arm",
    color: "#B6BEC5",
    note: "Float-type tank fuel gauging (POH 7-40; MM 28-20-00 Figure 204). Arm length/motion schematic; sender calibration, not shown position, determines indication.",
  });
  add(() => cyl(0.014, 0.045, "z"), ["fuel"], {
    pos: [sender[0] + 0.12, sender[1] - 0.035, sender[2]],
    name: "Fuel quantity float",
    color: "#596D75",
    note: "One float per tank. Approximately 36 gal top indicated range reflects float travel; unusable fuel still remains at zero (POH 7-40). Dimensions illustrative.",
  });
  unit(
    "Filler-cap vacuum relief",
    wp(side * 92, 0.2, 1, -0.05),
    [0.02, 0.015, 0.02],
    ["fuel"],
    "Vacuum-vented filler cap permits air entry if normal wing vents obstruct; pressure relief/bypass is a distinct function in vent valve (POH 7-44; MM 28-20-00 p. 206).",
    "#487BAB",
  );
}

/* Pneumatic tee and valve bodies make standby instrumentation independent of electronic power. */
for (const [name, at] of [
  ["Pitot distribution tee", D.pitotTee],
  ["Static distribution tee", D.staticTee],
] as const)
  unit(
    name,
    at,
    [0.027, 0.018, 0.034],
    ["pitot"],
    "Pitot/static plumbing branches to GDC 74A and mechanical standby instruments; electronic ADC failure cannot remove pneumatic input to standby ASI/altimeter (POH 7-62; MM 34-11-00 Figures 201/202).",
    "#4A955F",
    true,
  );
for (const side of [-1, 1])
  unit(
    "Static-line condensation sump",
    P3(15, side * 17, 44.5),
    [0.025, 0.04, 0.025],
    ["pitot"],
    "One sump at each external static port collects condensation before the pressure lines join. It has a drain provision (MM 34-11-00 p. 201, Fig. 201 Sheet 2).",
    "#65945B",
  );

unit(
  "Vacuum regulator filter",
  [D.regulator[0], D.regulator[1] + 0.02, D.regulator[2]],
  [0.025, 0.025, 0.04],
  ["vacuum"],
  "Regulator's cabin-air inlet has its own filter; clogging can cause high suction (MM 37-10-00 pp. 101/207). Separate from instrument gyro inlet filter.",
  "#73AAA2",
  true,
);
unit(
  "Vacuum transducer tee",
  [D.vacTransducer[0], D.vacTransducer[1] - 0.025, D.vacTransducer[2]],
  [0.03, 0.017, 0.03],
  ["vacuum"],
  "Pressure sensing tee feeds the GEA engine indication; NAVIII vacuum is only for standby attitude (POH 7-63; MM 37-10-00 p. 201).",
  "#72A79D",
);
unit(
  "Defrost control valve",
  D.defrostValve,
  [0.035, 0.04, 0.05],
  ["environment"],
  "Rotary DEFROST cable operates valve under deck aft of windshield; meters heated/mixed air to two windshield outlets (POH 7-60; MM 21-40-00 p. 201).",
  "#538D87",
  true,
);
for (const side of [-1, 1])
  unit(
    "Cabin floor diffuser",
    P3(14, side * 16, 28),
    [0.06, 0.025, 0.07],
    ["environment"],
    "Outlet just aft of rudder pedals at floor level; separate heated distribution from unheated wing-root ventilation (POH 7-60, Figure 7-8).",
    "#5C9590",
    side > 0,
  );
for (const [name, pos, size] of [
  ["ELT battery pack", D.elt, [0.06, 0.06, 0.06]],
  ["ELT mounting tray", [D.elt[0], D.elt[1] - 0.046, D.elt[2]], [0.15, 0.007, 0.12]],
] as [string, Vec3, Vec3][])
  unit(
    name,
    pos,
    size,
    ["cabin"],
    "Pointer 3000-11 self-contained battery transmitter as delivered; five alkaline C cells and inertial activation in Supplement 1. Replacement 406 MHz equipment must follow its own supplement; no avionics-bus dependency invented.",
    "#976B34",
  );
