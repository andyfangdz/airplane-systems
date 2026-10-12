/** Expanded circuits for the 1968 manual-system M20C. Routes/tube sizes are schematic; MAN 106/IPC 205
 * establish topology. Engine-internal passages use particles only. External apertures are audited separately. */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { DEPTH, depthWing, tankPickup } from "./depth-anchors";
import { live, pcEngaged, fuelAvail, type Sim, type Elec } from "./model";
import { breatherOpening, pumpDrainOpening, selectorDrain } from "./airframe-ports";
import { EQUIPMENT, OVERHEAD } from "./placement";
import { CYLS } from "./parts/engine";
import { SERVO, JACK, TRIM_WHEEL } from "./rig";

const F: FlowSpec[] = [];
const add = (key: string, pts: Vec3[], sys: SysId[], name: string, note: string, o: Partial<FlowSpec> = {}) =>
  F.push({
    key,
    pts,
    sys,
    name,
    note: note + " Route and diameter illustrative.",
    r: 0.0025,
    tension: 0,
    count: 4,
    ...o,
  });
const oil = { color: "#B85A2A", pcolor: "#EAB36C", tube: false, size: 0.025 };
add(
  "dOilPickup",
  [[2.58, -0.2, 0], DEPTH.suction, DEPTH.oilPump],
  ["engine"],
  "Sump → suction screen → pump",
  "Lycoming 60297-12 §§ 1,7-1: coarse suction screen and pressure pump.",
  oil,
);
add(
  "dOilScreen",
  [DEPTH.oilPump, DEPTH.pressureScreen, DEPTH.oilBypass],
  ["engine"],
  "Oil pressure-screen/bypass assembly",
  "Oil pressure filtration and cooler control are different functions. Functional oil passages, not surveyed drilled galleries (1968 OM scan p. 16; Lycoming 60297-12 §§ 1,7).",
  oil,
);
add(
  "dOilCooler",
  [DEPTH.oilBypass, [2.36, -0.18, -0.17], [2.55, -0.26, -0.3]],
  ["engine"],
  "Oil cooler feed",
  "Full-pressure wet-sump cooler branch; automatic bypass when cold/blocked (1968 OM scan p. 16).",
  { ...oil, tube: true, r: 0.006 },
);
add(
  "dOilReturn",
  [[2.55, -0.26, -0.3], [2.27, -0.16, -0.16], DEPTH.oilGallery],
  ["engine"],
  "Cooled oil → engine galleries",
  "Return oil distributes to engine lubrication galleries. Optional filter installation/adapter changes external detail and is not identified from aircraft records.",
  { ...oil, tube: true, r: 0.006 },
);
add(
  "dOilBypass",
  [DEPTH.oilBypass, DEPTH.oilGallery],
  ["engine"],
  "Oil cooler bypass passage",
  "Cold oil or cooler obstruction opens bypass; fault display is qualitative (1968 OM scan p. 16).",
  oil,
);
add(
  "dOilRelief",
  [DEPTH.oilGallery, DEPTH.oilRelief, [2.58, -0.2, 0]],
  ["engine"],
  "Oil pressure relief return",
  "Pressure regulator returns excess oil; not a fuel/propeller return line (Lycoming 60297-12 § 7-1).",
  oil,
);
add(
  "dOilGovernor",
  [DEPTH.oilGallery, [2.7, -0.08, 0], DEPTH.governor],
  ["engine", "propeller"],
  "Engine gallery → governor pump",
  "Pressure oil supplied to single-acting constant-speed governor (Hartzell 115N Description).",
  oil,
);
for (const c of CYLS) {
  add(
    "dOilValve" + c.n,
    [DEPTH.oilGallery, [c.x, -0.015, c.s * 0.1], [c.x, 0.03, c.s * 0.27]],
    ["engine"],
    "Valve-gear oil — cylinder " + c.n,
    "Cam/tappet/pushrod/rocker lubrication is depicted as an internal functional path (Lycoming 60297-12 § 1).",
    oil,
  );
  add(
    "dOilGravity" + c.n,
    [
      [c.x, 0.03, c.s * 0.27],
      [c.x, -0.05, c.s * 0.14],
      [2.58, -0.2, 0],
    ],
    ["engine"],
    "Gravity oil return — cylinder " + c.n,
    "Oil drains back from valve gear to the wet sump; this is not a scavenge-pump AIO installation (Lycoming 60297-12 § 1).",
    oil,
  );
  const lower = [c.x - 0.09, -0.055, c.s * 0.34] as Vec3,
    upper = [c.x - 0.09, 0.055, c.s * 0.34] as Vec3;
  for (const [level, end] of [
    ["U", upper],
    ["L", lower],
  ] as const) {
    const mag = c.s > 0 === (level === "L") ? "R" : "L",
      start = [2.26, 0.07, mag === "R" ? 0.11 : -0.11] as Vec3;
    add(
      "dIgn" + c.n + level,
      [start, [2.31, 0.005, c.s * 0.13], [c.x - 0.14, 0.005, c.s * 0.22], end],
      ["engine"],
      "Shielded ignition lead — cylinder " + c.n + " " + level,
      "Two independent magneto circuits and shielded leads (Lycoming 60297-12 §§ 1-3,4-2). Cross-firing assignment is the retained study convention; installed harness wiring unverified.",
      { r: 0.002, color: "#B66B96", pcolor: "#FFCA4A", size: 0.025 },
    );
  }
}
add(
  "dLeftPlead",
  [
    [1.55, -0.14, -0.44],
    [1.8, -0.15, -0.27],
    [2.15, 0.03, -0.13],
    [2.26, 0.07, -0.11],
  ],
  ["engine", "electrical"],
  "Left magneto grounding lead",
  "Ignition switch grounds the P-lead to stop the magneto. This is a grounding/command line, not bus-supplied running ignition (1968 OM scan p. 15).",
  { color: "#B66B96", tube: true },
);
add(
  "dRightPlead",
  [
    [1.55, -0.14, -0.44],
    [1.8, -0.15, -0.15],
    [2.15, 0.03, 0.1],
    [2.26, 0.07, 0.11],
  ],
  ["engine", "electrical"],
  "Right magneto grounding lead",
  "Right magneto grounded in START, left retard points supplied by starting vibrator (1968 OM scan p. 15).",
  { color: "#B66B96" },
);
add(
  "dRetard",
  [
    [1.99, 0.12, 0],
    [2.12, 0.06, -0.05],
    [2.26, 0.07, -0.11],
  ],
  ["engine", "electrical"],
  "Starting vibrator → left retard circuit",
  "Battery vibrator provides interrupted starting energy to the left magneto retard points (1968 OM scan p. 15).",
  { color: "#74BED4" },
);
add(
  "dBreather",
  [[2.21, -0.09, 0.1], [2.15, -0.28, 0.08], [2.09, breatherOpening[1] + 0.035, 0.1], breatherOpening],
  ["engine"],
  "Crankcase breather line",
  "Engine breather exits at the lower cowling, unconnected to fuel/induction systems (Lycoming 60297-12 §§ 4,7).",
  { color: "#ADB4B7", r: 0.005 },
);
add(
  "dFuelPumpDrain",
  [[2.3, -0.24, -0.16], [2.2, -0.38, 0.12], [2.15, pumpDrainOpening[1] + 0.025, 0.13], pumpDrainOpening],
  ["engine", "fuel"],
  "Engine fuel-pump leakage drain",
  "Engine pump/manifold drain juncture leads to an overboard outlet; no fuel return to tanks (MAN 106 § 4-10).",
  { r: 0.003, color: "#5389AF" },
);
add(
  "dFuelPressure",
  [[2.57, -0.285, -0.045], [2.2, -0.25, -0.15], [1.95, -0.2, -0.15], [1.6, -0.05, 0.26], DEPTH.engineGauges],
  ["fuel", "engine"],
  "Carburetor-line pressure → gauge",
  "Mechanical pressure indication line is distinct from the fuel-delivery hose (1968 OM scan p. 16; IPC 205 Fig. 37).",
  { r: 0.002, color: "#5389AF" },
);
add(
  "dOilPressure",
  [DEPTH.oilPressure, [2.05, -0.03, 0.16], [1.95, -0.03, 0.2], [1.62, 0.03, 0.27], [1.55, 0.03, 0.27]],
  ["engine"],
  "Engine oil pressure → mechanical gauge",
  "1968 cluster hose/line and firewall fittings (IPC 205 Fig. 42).",
  { r: 0.002, color: "#B85A2A" },
);
add(
  "dManifoldPressure",
  [
    [2.57, -0.24, 0],
    [2.07, -0.09, 0.08],
    [1.62, -0.045, 0.18],
    [1.55, -0.05, 0.25],
  ],
  ["engine"],
  "Intake manifold pressure → gauge",
  "Mechanical pressure instrument taps induction pressure, not the electric fuel-quantity circuit (IPC 205 Fig. 37; MAN 106 § 7-3).",
  { r: 0.002, color: "#74A8BA" },
);
add(
  "dTach",
  [
    [2.22, 0.11, 0.04],
    [2.05, 0.03, 0.08],
    [1.75, 0.025, 0.19],
    [1.55, 0.05, 0.42],
  ],
  ["engine"],
  "Mechanical tachometer cable",
  "Engine-driven flexible shaft runs to tachometer; instrument survives a dead master (MAN 106 § 7-3; IPC 205 Fig. 37).",
  { r: 0.003, color: "#8C949A" },
);
for (const side of [-1, 1]) {
  add(
    "dTankScreen" + (side < 0 ? "L" : "R"),
    [tankPickup(side), depthWing(side, 0.75, 0.3)],
    ["fuel"],
    "Tank pickup → outlet fitting",
    "Tank pickup/screen precedes selector (MAN 106 §§ 4-1,4-2; IPC 205 Fig. 36).",
    { r: 0.004, color: "#5389AF" },
  );
  add(
    "dFuelSender" + (side < 0 ? "L" : "R"),
    [
      depthWing(side, 1.3, 0.2),
      depthWing(side, 0.8, 0.2),
      [1.2, -0.54, side * 0.25],
      [1.6, -0.2, side * 0.2],
      [1.55, 0.075, side < 0 ? 0.27 : 0.36],
    ],
    ["fuel", "electrical"],
    "Tank sender → quantity gauge",
    "Electrical quantity circuit; open wires, grounds and transmitter faults can affect reading without stopping engine feed (MAN 106 § 4-2,4-12).",
    { r: 0.0015, color: "#C69B42" },
  );
}
add(
  "dSelectorScreen",
  [[1.35, -0.63, -0.3], DEPTH.selectorScreen, DEPTH.selectorBowl],
  ["fuel"],
  "Selector strainer and low-point bowl",
  "Integral strainer/drain assembly before electric pump (MAN 106 §§ 4-1,4-5).",
  { r: 0.003, color: "#5389AF" },
);
add(
  "dSelectorDrain",
  [DEPTH.selectorBowl, selectorDrain],
  ["fuel"],
  "Selector bowl → overboard drain",
  "Pull ring opens the selector's low-point drain; normal flight requires it closed (1968 OM scan p. 87).",
  { r: 0.003, color: "#5389AF" },
);
add(
  "dBoostScreen",
  [EQUIPMENT.boost, DEPTH.boostScreen, DEPTH.fuelFirewall],
  ["fuel"],
  "Boost inlet strainer → firewall",
  "Pump inlet obstruction can reduce fuel pressure; engine pump remains separate (MAN 106 § 4-2).",
  { r: 0.004, color: "#5389AF" },
);
add(
  "dCarbFloat",
  [DEPTH.carbScreen, DEPTH.carbFloat, [2.57, -0.26, 0]],
  ["fuel", "engine"],
  "Inlet needle/float bowl → metering",
  "MA-4-5 single-barrel updraft float carburetor with mixture and idle cutoff (MAN 106 § 4-9).",
  { tube: false, pcolor: "#83B7F3", size: 0.025 },
);

const electric = { color: "#C69B42", pcolor: "#FFE287", r: 0.002, size: 0.025 };
add(
  "dAlternatorField",
  [DEPTH.bus, DEPTH.fieldBreaker, [1.78, -0.15, -0.15], DEPTH.overvoltage, [2.07, 0.1, -0.3], [2.8, -0.18, -0.2]],
  ["electrical"],
  "Bus → field breaker → regulator/relay → alternator field",
  "Alternator option field is separate from main output (1968 OM scan p. 24–27; MAN 106 §§ 9-1,9-3).",
  electric,
);
add(
  "dAmmeter",
  [[2.2, -0.08, -0.3], DEPTH.shunt, [1.67, -0.2, 0.1], [1.55, -0.015, 0.36]],
  ["electrical"],
  "Battery-current shunt → ammeter",
  "Ammeter measures battery current, not alternator load. Sense wiring schematic (MAN 106 § 9-1;1968 OM scan p. 24).",
  electric,
);
add(
  "dMasterCoil",
  [
    [1.47, 0, -0.52],
    [1.7, -0.1, -0.35],
    [2.2, -0.08, -0.3],
  ],
  ["electrical"],
  "Master switch → battery-relay coil",
  "Single master switches source/contact relay, leaving magnetos independent (MAN 106 § 9-2).",
  electric,
);
add(
  "dStarterControl",
  [DEPTH.bus, [1.55, -0.14, -0.44], DEPTH.starterRelay],
  ["electrical", "engine"],
  "Ignition START → starter solenoid coil",
  "Low-current key circuit closes contactor; heavy cable supplies starter motor separately (MAN 106 § 9-6).",
  electric,
);
add(
  "dStarterPower",
  [[2.2, -0.08, -0.3], DEPTH.starterRelay, [2.35, -0.18, 0.08], EQUIPMENT.starter],
  ["electrical", "engine"],
  "Starter contactor → starter motor",
  "Starter-current cable does not power magneto running ignition (MAN 106 § 9-6).",
  { ...electric, r: 0.006 },
);
for (const [key, end, name] of [
  ["com1", [1.64, 0.005, -0.08], "NAV/COM 1"],
  ["com2", [1.64, -0.04, -0.08], "NAV/COM 2"],
  ["xpdr", [1.64, -0.085, -0.08], "Transponder"],
  ["gauges", DEPTH.engineGauges, "Engine-cluster electrical instruments"],
  ["turnBank", DEPTH.pcRate, "Turn coordinator electric supply"],
  ["vacWarn", DEPTH.vacuumSwitch, "Vacuum warning switch"],
  ["fuelPump", EQUIPMENT.boost, "Electric boost pump"],
  ["instLts", [1.55, -0.19, -0.34], "Instrument light rheostat"],
  ["gearWarn", [1.31, -0.58, 0.035], "Manual gear warning switch"],
  ["overvoltage", [1.49, 0.1, 0.32], "Overvoltage lamp"],
] as const)
  add(
    "dLoad" + key,
    [DEPTH.bus, [1.6, -0.22, 0.1], [...end]],
    ["electrical"],
    "Protected feed → " + name,
    "Single-bus circuit with the selected study breaker loads. Radio models/breaker ratings are configuration assumptions; power/warning topology follows 1968 OM scan p. 24–27 and MAN 106 § 9.",
    electric,
  );
add(
  "dPitotHeat",
  [DEPTH.bus, [1.6, -0.34, -0.2], [1.2, -0.5, -0.28], depthWing(-1, 0.75, 0.3), depthWing(-1, 2.2, 0.3)],
  ["electrical", "pitot"],
  "PITOT HEAT switch-breaker → heated probe",
  "Heated pitot is optional 1968 equipment and fitted in this study (1968 OM scan p. 18; IPC 205 Fig. 44).",
  electric,
);
for (const side of [-1, 1])
  add(
    "dNav" + (side < 0 ? "L" : "R"),
    [
      DEPTH.bus,
      [1.2, -0.4, side * 0.2],
      depthWing(side, 0.8, 0.4),
      depthWing(side, 2, 0.4),
      depthWing(side, 3.5, 0.4),
      depthWing(side, 5.2, 0.4),
    ],
    ["electrical", "lighting"],
    "NAV switch-breaker → wingtip light",
    "Color-position light wiring follows wing interiors; small terminal connection within wingtip, not an exposed diagonal (1968 OM scan p. 14; IPC 205 lighting figures).",
    electric,
  );
add(
  "dNavTail",
  [DEPTH.bus, [0, -0.38, 0], [-1.4, -0.36, 0], [-2.5, -0.35, 0], [-3.5, -0.455, 0]],
  ["electrical", "lighting"],
  "NAV switch-breaker → tail position light",
  "Tail-light wiring remains within tail-cone centerline. Tail articulation/terminal pigtail is schematic (1968 OM; IPC 205 lighting figures).",
  electric,
);
add(
  "dBeacon",
  [DEPTH.bus, [0.2, -0.5, 0], [-0.35, -0.55, 0]],
  ["electrical", "lighting"],
  "BEACON circuit → belly lamp",
  "Belly beacon is retained from photographed baseline; wiring route approximate (1968 OM scan p. 14 switch list).",
  electric,
);
add(
  "dLanding",
  [DEPTH.bus, [1.82, -0.28, 0], [2.5, -0.28, 0], [2.85, -0.14, 0]],
  ["electrical", "lighting"],
  "Landing-light circuit → nose lamp",
  "Nose landing lamp supplied through its switch-breaker (1968 OM scan p. 14).",
  { ...electric, r: 0.003 },
);
add(
  "dCabinLamp",
  [DEPTH.bus, [1.4, 0.12, 0], OVERHEAD.dome],
  ["electrical", "lighting"],
  "Cabin light switch → dome lamp",
  "Separate cabin lighting; follows central cabin interior to headliner (1968 OM scan p. 28).",
  electric,
);
add(
  "dSelectLamp",
  [DEPTH.bus, [1.6, -0.3, -0.15], [1.6, -0.4, -0.3]],
  ["electrical", "lighting", "fuel"],
  "Selector-light feed",
  "Illuminated floor selector allows night identification (1968 OM scan p. 16,28).",
  electric,
);

const vac = { color: "#79A890", pcolor: "#D4EFDF", r: 0.004, size: 0.025 };
const regulator = [1.87, 0.1, -0.15] as Vec3,
  filter = [1.85, 0, -0.35] as Vec3;
add(
  "dVacAH",
  [regulator, [1.68, 0.055, -0.23], DEPTH.attitude],
  ["vacuum"],
  "Suction manifold → artificial horizon",
  "Gyro suction branch; physical airflow goes from filtered instrument inlet toward the pump (IPC 205 Fig. 43;1968 OM scan p. 17).",
  vac,
);
add(
  "dVacDG",
  [regulator, [1.68, 0.02, -0.24], DEPTH.directional],
  ["vacuum"],
  "Suction manifold → directional gyro",
  "Separate gyro branch (IPC 205 Fig. 43).",
  vac,
);
add(
  "dFilterAH",
  [filter, [1.68, -0.01, -0.3], DEPTH.attitude],
  ["vacuum"],
  "Central filter → artificial horizon inlet",
  "Cabin air enters gyro through common filter; clogged inlet can make gyro sluggish even with a turning pump (1968 OM scan p. 17).",
  vac,
);
add(
  "dFilterDG",
  [filter, [1.68, -0.01, -0.32], DEPTH.directional],
  ["vacuum"],
  "Central filter → directional gyro inlet",
  "Filtered-air inlet is separate from suction outlet (IPC 205 Fig. 43).",
  vac,
);
add(
  "dVacSwitch",
  [regulator, DEPTH.vacuumSwitch],
  ["vacuum", "electrical"],
  "Vacuum manifold → HI/LO pressure switch",
  "Pressure sensing, not an electrical vacuum pump. Lamps require bus power (MAN 106 § 9-4).",
  vac,
);
add(
  "dPCSupply",
  [regulator, [1.77, -0.05, -0.2], DEPTH.pcPilot],
  ["autopilot", "vacuum"],
  "Primary suction → PC pneumatic relay",
  "Relay responds to the pilot's wheel cut-off valve (Brittain 11968 §§ 2,3.4).",
  vac,
);
add(
  "dPCRate",
  [DEPTH.pcPilot, DEPTH.pcRate],
  ["autopilot"],
  "PC relay → rate-gyro spool/sleeve valve",
  "Command valve meters balanced/opposed vacuum outputs; PC has no pitch or selected-heading channel (Brittain 11968 §§ 1.3,2.2).",
  vac,
);
add(
  "dPCTrim",
  [DEPTH.pcTrim, DEPTH.pcRate],
  ["autopilot"],
  "Roll-trim valve → rate valve",
  "Trim biases command for asymmetric loading (Brittain 11968 § 2.2).",
  vac,
);
add(
  "dPCCut",
  [[1.3, 0.02, -0.43], [1.48, -0.11, -0.39], DEPTH.pcPilot],
  ["autopilot"],
  "Wheel cut-off valve → pneumatic relay",
  "Pressing button vents the pilot-valve command and relieves servo suction.1968 pneumatic version, unlike 1975+electric valve (Brittain 11968 § 3.3; MAN 106 § 6-9).",
  vac,
);
for (const side of [-1, 1]) {
  const suffix = side < 0 ? "L" : "R";
  add(
    "dPCServo" + suffix,
    [
      DEPTH.pcRate,
      [1.2, -0.44, side * 0.2],
      depthWing(side, 0.8, 0.62),
      depthWing(side, 1.5, 0.62),
      depthWing(side, 2.5, 0.62),
      [SERVO.roll[0], SERVO.roll[1], side * Math.abs(SERVO.roll[2])],
    ],
    ["autopilot", "vacuum"],
    "PC " + suffix + " aileron servo command",
    "Rate valve applies suction to one servo and vents the opposing output; leaks/pinched lines create command imbalance (Brittain 11968 § 2.2,9.3).",
    vac,
  );
  add(
    "dPCYaw" + suffix,
    [
      DEPTH.pcRate,
      [1.1, -0.38, side * 0.12],
      [0, -0.4, side * 0.12],
      [-1, -0.4, side * 0.1],
      [SERVO.yaw[0], SERVO.yaw[1], side * 0.1],
    ],
    ["autopilot", "vacuum"],
    "PC " + suffix + " rudder servo command",
    "The same rate-gyro valve applies suction to one rudder servo and vents the opposing output; rudder servos sit in the tail cone (Brittain 11968 § 2.2; MAN 106 § 6-9).",
    vac,
  );
}
const hyd = { color: "#8B75AD", pcolor: "#DBC1F4", r: 0.003, size: 0.025 };
add(
  "dFlapInlet",
  [DEPTH.hydraulic, [1.78, -0.3, 0.1], DEPTH.flapInlet, DEPTH.flapPump],
  ["flaps", "gear"],
  "Common reservoir → flap pump inlet check",
  "Refill stroke admits common brake/flap fluid; gear retraction itself is mechanical (1968 OM scan p. 20; IPC 205 Fig. 30).",
  hyd,
);
add(
  "dFlapOutlet",
  [DEPTH.flapPump, DEPTH.flapOutlet, [0.6, -0.61, 0.05], DEPTH.flapActuator],
  ["flaps"],
  "Pump outlet check → flap actuator",
  "Hand-pump strokes deliver pressure; pressure held inDOWN, without electricity (MAN 106 § 6-6; IPC 205 Fig. 30).",
  hyd,
);
add(
  "dFlapRelease",
  [DEPTH.flapActuator, [0.6, -0.59, 0.03], DEPTH.flapRelease, [1.75, -0.2, 0.12], DEPTH.hydraulic],
  ["flaps"],
  "Actuator → release valve → reservoir",
  "UP allows return while spring/air forces raise flaps; release leak demonstrates creep, not a quantified real leak rate (1968 OM scan p. 20–21; MAN 106 § 8-2).",
  hyd,
);
for (const side of [-1, 1]) {
  const suffix = side < 0 ? "L" : "R";
  add(
    "dBrakeSupply" + suffix,
    [DEPTH.hydraulic, [1.8, -0.3, 0.1], [1.75, -0.45, side * 0.28]],
    ["gear"],
    "Reservoir → " + suffix + " brake master cylinder",
    "Shared low-pressure reservoir; toe brakes separately pressurize each wheel circuit (MAN 106 § 5-14).",
    hyd,
  );
  add(
    "dBrakePark" + suffix,
    [[1.75, -0.45, side * 0.28], [1.65, -0.45, side * 0.2], DEPTH.parkValve],
    ["gear"],
    suffix + " master cylinder → parking valve",
    "Parking valve traps existing pressure; independent left/right hydraulic circuits share supply (MAN 106 § 5-16).",
    hyd,
  );
}
// Mechanical paths have no electricity; particles indicate actuation, never hydraulic gear power.
add(
  "dTrimTorque",
  [TRIM_WHEEL.c, [0.3, -0.6, 0], [-0.7, -0.55, 0], [-1.8, -0.45, 0], JACK],
  ["controls"],
  "Trim wheel → torque tube → aft gearbox/jackscrew",
  "Gear reduction/torque tubes rotate jackscrew to pivot entire empennage; no elevator trim tab (MAN 106 § 6-3; IPC 205 Fig. 28).",
  { r: 0.005, color: "#A496B6", chan: ["elevator"] },
);
add(
  "dTrimIndicator",
  [
    [0.93, -0.57, 0.04],
    [1.1, -0.5, 0.035],
    [1.4, -0.27, 0.04],
  ],
  ["controls"],
  "Trim wheel mechanism → position pointer",
  "Mechanical cable indicator shows stabilizer trim (IPC 205 Fig. 28).",
  { r: 0.002, color: "#A496B6", chan: ["elevator"] },
);
add(
  "dFlapIndicator",
  [
    [0.25, -0.58, 0.025],
    [0.9, -0.53, 0.04],
    [1.4, -0.25, 0.04],
  ],
  ["flaps"],
  "Flap actuator → cabin position pointer",
  "Cable rigging sets takeoff mark and travel indication (MAN 106 Fig. 6-13).",
  { r: 0.002, color: "#A496B6" },
);
add(
  "dPCLink",
  [
    [1.4, -0.58, 0.13],
    [1.4, -0.58, 0.03],
  ],
  ["controls"],
  "Aileron/rudder mechanical interconnect",
  "Spring-loaded interconnect is independent of vacuum PC (1968 OM scan p. 18).",
  { r: 0.005, color: "#A496B6", chan: ["aileron", "rudder"] },
);

const air = { r: 0.008, color: "#62A59B", pcolor: "#AFF5E0", size: 0.04 };
for (const [key, end, name] of [
  ["AH", [1.55, 0.055, -0.36], "Airspeed static reference"],
  ["Alt", [1.55, 0.055, -0.18], "Altimeter"],
  ["VSI", [1.55, -0.065, -0.18], "Vertical-speed indicator"],
] as const)
  add(
    "dStatic" + key,
    [[1.6, -0.2, -0.25], [1.6, -0.05, -0.23], [...end]],
    ["pitot"],
    "Static manifold → " + name,
    "Common two-port static system and optional cabin alternate source; instruments do not require bus power (1968 OM scan p. 18; IPC 205 Fig. 44).",
    { r: 0.0025, color: "#4384AF" },
  );
add(
  "dRadioCoolL",
  [
    [1.46, -0.35, -0.4],
    [1.49, -0.2, -0.34],
    [1.64, 0.005, -0.08],
  ],
  ["environment"],
  "Left scoop → upper radio cooling tube",
  "Left scoop has two radio-cooling tubes (1968 OM scan p. 29); route illustrative.",
  air,
);
add(
  "dRadioCoolR",
  [
    [1.46, -0.35, -0.4],
    [1.49, -0.15, -0.3],
    [1.64, -0.04, -0.08],
  ],
  ["environment"],
  "Left scoop → lower radio cooling tube",
  "Cooling branch independent of electrical radio operation (1968 OM scan p. 29).",
  air,
);
add(
  "dDefrostL",
  [DEPTH.heatBox, [1.62, 0.15, 0.08], [1.62, 0.2, -0.17]],
  ["environment"],
  "Junction box → left windshield outlet",
  "Heated/fresh-air junction distributes to defroster; no compressor/heater combustor installed (1968 OM scan p. 29; MAN 106 § 8-1).",
  air,
);
add(
  "dDefrostR",
  [DEPTH.heatBox, [1.62, 0.15, 0.08], [1.62, 0.2, 0.17]],
  ["environment"],
  "Junction box → right windshield outlet",
  "Separate defroster outlet on shared manifold (1968 OM scan p. 29).",
  air,
);
export const DEPTH_FLOWS = F;

export function depthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {},
    run = s.eng.running,
    oilOn = live.oilP > 5,
    pc = pcEngaged(s);
  for (const f of F) {
    const k = f.key;
    if (k.startsWith("dOil")) R[k] = oilOn ? 0.6 : 0;
    else if (k.startsWith("dIgn")) {
      const m = /dIgn(\d)([UL])/.exec(k)!;
      const c = CYLS.find((c) => c.n === Number(m[1]))!;
      const right = c.s > 0 === (m[2] === "L");
      R[k] =
        live.rpm > 100 &&
        !(right ? s.faults.magR : s.faults.magL) &&
        (s.eng.key === "START" ? !right && E.vibrator : s.eng.key === "BOTH" || s.eng.key === (right ? "R" : "L"))
          ? 0.6
          : 0;
    } else if (k.startsWith("dPC")) R[k] = pc ? -0.4 : 0;
    else if (k.startsWith("dVac")) R[k] = live.vac > 1 ? -0.4 : 0;
    else if (k.startsWith("dFilter")) R[k] = live.vac > 1 ? 0.4 : 0;
    else if (k.startsWith("dStatic")) R[k] = s.air ? 0.25 : 0;
    else if (k.startsWith("dRadioCool") || k.startsWith("dDefrost"))
      R[k] = (s.air ? 0.6 : run ? 0.25 : 0) * Math.max(s.env.heat, s.env.vent);
    else if (k.startsWith("dTrim")) R[k] = Math.min(1, Math.abs(live.trimRate) * 2);
    else if (k.startsWith("dBrake")) R[k] = Math.abs(s.gear.diff) > 0.05 || s.gear.park ? 0.3 : 0;
    else if (k.startsWith("dTank") || k === "dSelectorScreen" || k === "dBoostScreen" || k === "dCarbFloat")
      R[k] = fuelAvail(s) && (E.fuelPump || (live.rpm > 100 && !s.eng.fail.mechPump)) ? 0.5 : 0;
    else R[k] = E.bus > 0 ? 0.2 : 0;
  }
  // Brittain 11968 § 2.2: the metering valve draws from one output while admitting atmospheric air to the other.
  // Negative is servo → valve suction; positive is valve → servo vent admission. Neutral has no differential movement.
  // Particle speed/deadband illustrate the live control demand, not calibrated pneumatic flow or independent gyro axes.
  const servoRate = (demand: number, side: -1 | 1) =>
    pc && Math.abs(demand) > 0.02 ? (Math.sign(demand) === side ? -1 : 1) * (0.4 + Math.abs(demand)) : 0;
  R.dPCServoL = servoRate(live.pcRoll, -1);
  R.dPCServoR = servoRate(live.pcRoll, 1);
  R.dPCYawL = servoRate(live.pcYaw, -1);
  R.dPCYawR = servoRate(live.pcYaw, 1);
  // Primary suction reaches the pilot relay even when it cuts off sequenced vacuum or servo leakage disables PC.
  R.dPCSupply = live.vac > 1 ? -0.4 : 0;
  R.dPCCut = live.vac > 1 && s.pc.cutoff ? 0.4 : 0;
  // 180°F is an illustrative display crossover, not a specified 1968 bypass-valve calibration.
  R.dOilBypass = oilOn && (live.oilT < 180 || s.faults.oilCooler) ? 0.5 : 0;
  R.dOilCooler = R.dOilReturn = oilOn && !s.faults.oilCooler && live.oilT >= 180 ? 0.5 : 0;
  R.dOilGovernor = oilOn && !s.eng.fail.governor ? 0.4 : 0;
  R.dRetard = E.vibrator && !s.faults.magL ? 0.6 : 0;
  R.dStarterControl = R.dStarterPower = E.starterOn ? 0.6 : 0;
  R.dAlternatorField = E.genOn ? 0.5 : 0;
  R.dAmmeter = E.amps === 0 ? 0 : Math.sign(E.amps) * 0.3;
  R.dPitotHeat = E.pitotHeat ? 0.5 : 0;
  R.dNavL = R.dNavR = R.dNavTail = E.nav ? 0.4 : 0;
  R.dBeacon = E.beacon ? 0.4 : 0;
  R.dLanding = E.landing ? 0.4 : 0;
  R.dCabinLamp = E.bus > 0 && s.lights.cabin ? 0.3 : 0;
  R.dFlapInlet = R.dFlapOutlet = s.flaps.valve === "DOWN" && live.pumpAnim > 0 ? 0.5 : 0;
  R.dFlapRelease = live.flapAng > 0 && (s.flaps.valve === "UP" || s.faults.flapLeak) ? 0.5 : 0;
  R.dFlapIndicator = live.pumpAnim > 0 || (s.flaps.valve === "UP" && live.flapAng > 0) ? 0.3 : 0;
  for (const k of [
    "com1",
    "com2",
    "xpdr",
    "turnBank",
    "vacWarn",
    "fuelPump",
    "instLts",
    "gearWarn",
    "overvoltage",
  ] as const)
    R["dLoad" + k] = E[k] ? 0.4 : 0;
  R.dLoadgauges = E.gaugesPwr ? 0.3 : 0;
  R.dFuelSenderL = R.dFuelSenderR = E.gaugesPwr ? 0.25 : 0;
  R.dBreather = run ? 0.3 : 0;
  R.dFuelPumpDrain = 0; // Drain depiction is normally dry; no invented leak rate.
  R.dSelectorDrain = 0;
  R.dTankScreenL = s.fuel.sel === "L" ? R.dTankScreenL : 0;
  R.dTankScreenR = s.fuel.sel === "R" ? R.dTankScreenR : 0;
  R.dFuelPressure = live.fuelP > 0.5 ? 0.2 : 0;
  R.dOilPressure = oilOn ? 0.2 : 0;
  R.dManifoldPressure = R.dTach = run ? 0.3 : 0;
  R.dPCCut = s.pc.cutoff ? 0.3 : 0;
  R.dLeftPlead = s.eng.key === "OFF" || s.eng.key === "R" ? 0.3 : 0;
  R.dRightPlead = s.eng.key === "OFF" || s.eng.key === "L" || s.eng.key === "START" ? 0.3 : 0;
  return R;
}
