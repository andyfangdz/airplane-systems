/** NAV III physical connections. Topology: POH Fig 7-7/7-9/7-10; Garmin 190-00352-00
 * Rev K 1-2–7; 172RPC24 Chapters21,23,24,27,28,34,37,77,79. All routing/radii schematic. */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { cessnaCabinHarness as cabinHarness } from "../cessna/cabin-routing";
import { DEPTH as D } from "./depth-anchors";
import { AF } from "./geometry";
import { RIG, RIG_SPEC } from "./rig";
import { type Sim, type Elec } from "./model";
import { engineTurning, magnetoOperating } from "./engine-operation";
import { CYLS, SPARK_PLUGS, MAGNETOS, ALTERNATOR, PITOT, OAT_PROBE } from "./parts";
import { CONTACTORS } from "./parts/depth-electrical";
const P = AF.P3;
const flows: FlowSpec[] = [];
const gate: Record<string, (s: Sim, E: Elec) => number> = {};
function add(
  key: string,
  pts: Vec3[],
  sys: SysId[],
  name: string,
  note: string,
  rate: (s: Sim, E: Elec) => number,
  o: Partial<FlowSpec> = {},
) {
  flows.push({
    key,
    pts,
    sys,
    name,
    note: note + " Route/radius schematic.",
    r: 0.003,
    tension: 0,
    color: "#D7B756",
    size: 0.025,
    count: 6,
    ...o,
  });
  gate[key] = rate;
}
function wire(
  key: string,
  a: Vec3,
  b: Vec3,
  name: string,
  rate: (s: Sim, E: Elec) => number,
  sys: SysId[] = ["electrical"],
  note = "POH Fig 7-7: individual protected equipment feed.",
) {
  // Forward equipment stays behind the panel; cabin runs use floor, sidewall and headliner lanes.
  const pts: Vec3[] = Math.min(a[0], b[0]) < AF.X(24) ? cabinHarness(AF, a, b, AF.X(14)) : [a, [a[0], a[1], b[2]], b];
  add(key, pts, sys, name, note, rate);
}
const on = (bus: string, label: string) => (_s: Sim, E: Elec) => (E.on[bus + ":" + label] ? 1 : 0);
const bool = (k: keyof Elec) => (_s: Sim, E: Elec) => (E[k] ? 1 : 0);
const oil = (s: Sim, E: Elec) => (engineTurning(s, E) && !s.eng.fail.oil ? 0.7 : 0);
const oilAdd = (key: string, pts: Vec3[], name: string, note: string) =>
  add(key, pts, ["engine"], name, note, oil, { color: "#B85A2A", r: 0.006 });
oilAdd(
  "oilPumpFilter",
  [D.oilPump, P(-6, -2, 47), D.oilAdapter],
  "Oil pump → full-flow filter",
  "POH 7-35; Lycoming IPC 17/20: pressure oil reaches the filter adapter.",
);
oilAdd(
  "oilThermostat",
  [D.oilAdapter, D.oilThermostat],
  "Filter → thermostatic bypass",
  "Lycoming IPC 20: cooler control is distinct from filter bypass.",
);
oilAdd(
  "oilCoolerSupply",
  [D.oilThermostat, P(-6, 7, 54), P(-11, 12.6, 55)],
  "Thermostatic control → oil cooler",
  "POH 7-35: warmed oil is cooled remotely; particles show the established warm-engine path, not valve timing.",
);
oilAdd(
  "oilCoolerReturn",
  [P(-11, 12.6, 55), P(-10, 6, 51), D.oilRelief],
  "Oil cooler return → pressure gallery",
  "POH 7-35; Lycoming IPC 20: return feeds pressure distribution. Hose shape schematic.",
);
for (const [key, at] of [
  ["oilGalleryL", D.oilGalleryL],
  ["oilGalleryR", D.oilGalleryR],
] as const)
  oilAdd(
    key,
    [D.oilRelief, at],
    "Pressure oil → " + key.slice(10) + " gallery",
    "POH 7-35; Lycoming Operator 1-3: pressure lubrication to bearings/valve gear.",
  );
oilAdd(
  "oilReliefReturn",
  [D.oilRelief, P(-7, 3, 43), D.oilScreen],
  "Pressure relief return",
  "POH 7-35: pressure-regulating bypass returns excess oil; depicted flow is a functional passage cue, not an always-open valve.",
);
for (const c of CYLS) {
  oilAdd(
    "oilHead" + c.n,
    [c.s < 0 ? D.oilGalleryL : D.oilGalleryR, P(c.fs, c.s * 8, 50), P(c.fs, c.s * 11, 51)],
    "Pressure oil to cylinder " + c.n,
    "Lycoming IPC 10–12: valve gear lubrication.",
  );
  oilAdd(
    "oilDrain" + c.n,
    [P(c.fs, c.s * 11, 49), P(c.fs + 1, c.s * 7, 42), D.oilScreen],
    "Cylinder " + c.n + " gravity oil return",
    "Lycoming IPC 12: head drain tube returns oil to the crankcase/sump. Pressure supply and gravity return are different paths.",
  );
  for (const [kind, h, bl] of [
    ["CHT", 52, 12],
    ["EGT", 45, 14],
  ] as const)
    wire(
      kind + c.n,
      P(c.fs, c.s * bl, h),
      D.gea,
      kind + " cylinder " + c.n + " signal",
      bool("engineData"),
      ["engine", "avionics"],
      "POH 7-30/34; 172RPC24 77-20: each cylinder sensor feeds GEA 71; a signal harness does not carry hot oil or exhaust.",
    );
  for (const mag of ["L", "R"] as const) {
    const upper = c.s < 0 === (mag === "L"),
      level = upper ? "upper" : "lower",
      plug = SPARK_PLUGS[c.n][upper ? "U" : "L"];
    add(
      "ign" + mag + c.n,
      [MAGNETOS[mag], P(c.fs + 3, c.s * 6, 52), plug],
      ["engine"],
      mag + " magneto → cyl " + c.n + " " + level + " plug",
      "POH 7-36: left magneto fires upper-left/lower-right plugs; right magneto fires lower-left/upper-right. Lycoming IPC Fig 24 p49 lists two impulse magnetos. START selection follows the reference model's dual-impulse installation; routing is schematic.",
      (s, E) => (magnetoOperating(s, E, mag) ? 1 : 0),
      { color: "#B3A065", r: 0.0025 },
    );
  }
}
for (const [key, at, name] of [
  ["oilPressSignal", P(-12.9, 8.92, 43), "Oil pressure transducer"],
  ["oilLowSignal", P(-10.9, 8.82, 43), "Low oil pressure switch"],
  ["rpmSignal", P(-8, 0, 54.65), "Engine RPM sensor"],
  ["fuelFlowSignal", P(-22.6, 3, 57), "Fuel flow transducer"],
  ["oilTempSignal", P(-5, 0, 47.5), "Oil temperature sensor"],
] as [string, Vec3, string][])
  wire(
    key,
    at,
    D.gea,
    name + " →GEA 71",
    bool("engineData"),
    ["engine", "avionics"],
    "POH 7-30–35; 172RPC24 Chapters73/77/79: engine sensor input to GEA 71.",
  );
for (const side of ["L", "R"] as const)
  wire(
    "pLead" + side,
    P(18.3, -17.1, 49.9),
    MAGNETOS[side],
    side + " magneto P-lead",
    (s) => (s.eng.mags === "OFF" || s.eng.mags === (side === "L" ? "R" : "L") ? 1 : 0),
    ["engine"],
    "POH 7-38: ignition switch grounds the magneto primary to stop it. Particle cue denotes grounding; no aircraft-bus supply is required.",
  );
wire(
  "altField",
  P(-1.75, -14, 44.5),
  ALTERNATOR,
  "ACU → alternator field",
  bool("altOn"),
  ["electrical", "engine"],
  "POH 7-47/Fig 7-7: regulated/protected field separate from high-current output. ACU location/port schematic.",
);
wire("masterCoil", P(18.3, -18.8, 59), CONTACTORS.master, "MASTER BAT → battery relay coil", (s) =>
  s.elec.bat ? 1 : 0,
);
wire(
  "starterCoil",
  P(18.3, -17.1, 49.9),
  CONTACTORS.starter,
  "START → starter relay coil",
  (s, E) => (s.eng.mags === "START" && E.starterPwr ? 1 : 0),
  ["electrical", "engine"],
  "POH Fig 7-7:WARN-protected START coil is separate from the high-current starter cable.",
);
wire("essentialFeed", D.panel, P(16, -7.3, 46.3), "Crossfeed/diode → essential bus", (_s, E) => (E.v.ESS > 0 ? 1 : 0));
wire("stbySense", D.stbyController, D.panel, "WARN main-bus sense → standby controller", on("XF", "WARN"));
wire("stbyCharge", D.stbyController, P(11.2, -14, 51), "Standby controller → battery charge", (_s, E) =>
  E.sBatt > 0 ? 1 : 0,
);
for (const [id, at, label, ess, main] of [
  ["pfd", D.pfd, "PFD", "ESS", "AV1"],
  ["adc", D.adc, "ADC AHRS", "ESS", "AV1"],
  ["ahrs", D.ahrs, "ADC AHRS", "ESS", "AV1"],
  ["gia1", D.gia1, "NAV 1 ENG", "ESS", "AV1"],
] as const)
  for (const bus of [ess, main])
    wire(
      id + "Power" + bus,
      D.panel,
      at,
      id.toUpperCase() + " " + bus + " supply",
      on(bus, label),
      ["electrical", "avionics"],
      "POH Fig 7-7: separately protected dual supply. Data connectivity does not replace a lost supply.",
    );
for (const [id, at, bus, label, name, sys] of [
  ["mfdPower", D.mfd, "AV2", "MFD", "MFD supply", ["electrical", "avionics"]],
  ["gia2Power", D.gia2, "AV2", "NAV 2", "GIA 2 NAV/processor supply", ["electrical", "avionics"]],
  ["gia1Com", D.gia1, "ESS", "COMM 1", "COM1 essential supply", ["electrical", "avionics"]],
  ["gia2Com", D.gia2, "AV2", "COMM 2", "COM2 supply", ["electrical", "avionics"]],
  ["audioPower", D.audio, "AV2", "AUDIO", "Audio panel supply", ["electrical", "avionics"]],
  ["xpdrPower", D.xpdr, "AV2", "XPNDR", "Transponder supply", ["electrical", "avionics"]],
  ["fwdFanPower", P(12.4, 0, 64), "AV1", "PFD", "Forward cooling fan supply", ["electrical", "avionics"]],
  ["aftFanPower", P(109.5, 0, 56), "AV2", "NAV 2", "Aft cooling fan supply", ["electrical", "avionics"]],
  ["flapPower", AF.P(AF.wingP(AF.Z(30), 0.6, 0)), "E1", "FLAPS", "Flap motor power", ["electrical", "flaps"]],
  ["pumpPower", P(9.5, -3, 26), "E1", "FUEL PUMP", "Auxiliary fuel pump power", ["electrical", "fuel"]],
] as [string, Vec3, string, string, string, SysId[]][])
  wire(id, D.panel, at, name, on(bus, label), sys);
for (const channel of ["roll", "pitch", "trim"] as const) {
  const at = RIG.p3(RIG_SPEC.servo[channel]);
  wire(channel + "ServoPower", D.panel, at, "GFC 700 " + channel + " supply", on("AV2", "AUTO PILOT"), [
    "electrical",
    "autopilot",
  ]);
  for (const i of [1, 2])
    wire(
      channel + "ServoData" + i,
      i === 1 ? D.gia1 : D.gia2,
      at,
      "GIA " + i + "→ " + channel + " servoRS-485",
      (_s, E) => (E.on["AV2:AUTO PILOT"] && (i === 1 ? E.gia1 : E.gia2) ? 1 : 0),
      ["avionics", "autopilot"],
      "Garmin 190-00352-00Rev K 1-4,1-7: both GIAs communicate with the GSA 81 servo network. Exact daisy-chain topology/termination schematic.",
    );
}
function data(key: string, a: Vec3, b: Vec3, name: string, rate: (s: Sim, E: Elec) => number, note: string) {
  wire(key, a, b, name, rate, ["avionics"], note);
  flows.at(-1)!.color = "#AC76C0";
}
const garmin = "Garmin 190-00352-00Rev K 1-2–7; 190-00498-07Rev A §1.1: ";
data(
  "hsdbPfd",
  D.gia1,
  D.pfd,
  "GIA 1 ↔PFD Ethernet HSDB",
  (_s, E) => (E.gia1 && E.pfd ? 1 : 0),
  garmin + "each IAU pairs to its display; the two GIAs are not directly Ethernet-linked.",
);
data(
  "hsdbMfd",
  D.gia2,
  D.mfd,
  "GIA 2 ↔MFD Ethernet HSDB",
  (_s, E) => (E.gia2 && E.mfd ? 1 : 0),
  garmin + "independent IAU/display link.",
);
data(
  "hsdbDisplays",
  D.pfd,
  D.mfd,
  "PFD ↔MFD Ethernet HSDB",
  (_s, E) => (E.pfd && E.mfd ? 1 : 0),
  garmin + "display crosslink supports shared/reversion information.",
);
for (const [id, from, ok] of [
  ["ahrs", D.ahrs, "ahrs"],
  ["adc", D.adc, "adc"],
] as const)
  for (const [to, target, receiver] of [
    ["Pfd", D.pfd, "pfd"],
    ["Mfd", D.mfd, "mfd"],
    ["Gia1", D.gia1, "gia1"],
    ["Gia2", D.gia2, "gia2"],
  ] as const)
    data(
      id + to,
      from,
      target,
      id.toUpperCase() + " →" + to + " ARINC 429",
      (_s, E) => (E[ok] && E[receiver] ? 1 : 0),
      garmin + "primary/secondary instrumentation paths to displays and GIAs.",
    );
data(
  "adcAhrs",
  D.adc,
  D.ahrs,
  "GDC 74A →GRS 77 air data",
  (_s, E) => (E.adc && E.ahrs ? 1 : 0),
  garmin + "AHRS uses independent air-data aiding.",
);
for (const i of [1, 2]) {
  data(
    "geaGia" + i,
    D.gea,
    i === 1 ? D.gia1 : D.gia2,
    "GEA 71 →GIA" + i + " RS-485",
    (_s, E) => (E.engineData && (i === 1 ? E.gia1 : E.gia2) ? 1 : 0),
    garmin +
      "processed sensor data sent to both IAUs; sensors and displays can fail independently from engine operation.",
  );
  data(
    "audioGia" + i,
    D.audio,
    i === 1 ? D.gia1 : D.gia2,
    "GMA 1347 ↔GIA" + i + " RS-232",
    (_s, E) => (E.audio && (i === 1 ? E.gia1 : E.gia2) ? 1 : 0),
    garmin + "audio selection/control interface.",
  );
  data(
    "xpdrGia" + i,
    D.xpdr,
    i === 1 ? D.gia1 : D.gia2,
    "GTX 33 ↔GIA" + i + " RS-232",
    (_s, E) => (E.xpdr && (i === 1 ? E.gia1 : E.gia2) ? 1 : 0),
    garmin + "transponder data/control via GIAs.",
  );
}
const gmu = AF.P(AF.wingP(AF.Z(-170), 0.42, 0));
add(
  "gmuData",
  [
    gmu,
    AF.P(AF.wingP(AF.Z(-40), 0.42, 0)),
    ...cabinHarness(AF, AF.P(AF.wingP(AF.Z(-12), 0.42, 0)), D.ahrs, AF.X(14), -1),
  ],
  ["avionics"],
  "GMU 44 →GRS 77RS-485",
  "Garmin1-3: AHRS supplies magnetometer power and receives magnetic data; no standalone wing bus feed.",
  bool("ahrs"),
  { color: "#AC76C0" },
);
wire(
  "oatSignal",
  OAT_PROBE,
  D.adc,
  "GTP 59 OAT →GDC 74A",
  bool("adc"),
  ["avionics", "pitot"],
  "POH 7-69; Garmin1-3: air-data computer accepts the outside-temperature probe; exact probe branch routing schematic.",
);
add(
  "staticAltimeter",
  [D.staticTee, P(14, 3, 48), D.standbyAlt],
  ["pitot"],
  "Static tee → standby altimeter",
  "POH 7-64: independent standby-altimeter pressure branch.",
  (s) => (s.pitot.altStatic ? 0.5 : s.pitot.staticBlocked ? 0 : 0.35),
  { color: "#2E7A3A", r: 0.005 },
);
add(
  "pitotAsi",
  [D.pressureTee, D.standbyAsi],
  ["pitot"],
  "Pitot tee → standby airspeed",
  "POH 7-64: mechanical standby ASI remains usable after display/ADC electrical failure, if pressure sources remain clear.",
  (s) => (s.pitot.pitotBlocked ? 0 : 0.35),
  { color: "#3A9448", r: 0.005 },
);
add(
  "staticAsi",
  [D.staticTee, D.standbyAsi],
  ["pitot"],
  "Static tee → standby airspeed",
  "POH 7-64: ASI needs both total and static pressure, unlike the altimeter.",
  (s) => (s.pitot.altStatic ? 0.5 : s.pitot.staticBlocked ? 0 : 0.35),
  { color: "#2E7A3A", r: 0.005 },
);
wire(
  "vacSignal",
  P(10.3, 6, 54),
  D.gea,
  "Vacuum transducer →GEA 71",
  bool("engineData"),
  ["vacuum", "avionics"],
  "POH 7-65/Fig 7-9: suction measurement is an electrical sensor path, not the instrument air supply.",
);
wire(
  "eltRemote",
  D.eltRemote,
  D.elt,
  "ELT remote control wiring",
  (s) => (s.cabin.elt !== "ARM" ? 1 : 0),
  ["cabin"],
  "POH 7-13; Section 9installed ELT supplement governs: remote activation/reset wiring separate from antenna coax. No aircraft-bus dependency inferred for the ELT battery.",
);
for (const side of [-1, 1])
  for (const fs of [40, 76])
    wire(
      "headset" + side + fs,
      D.audio,
      P(fs === 40 ? 27 : fs, side * 16, 50),
      (fs < 50 ? "Front" : "Rear") + " headset audio/intercom",
      bool("audio"),
      ["avionics", "cabin"],
      "POH 7-69; 172RPC24 23-50: microphone/headphone signals through GMA 1347 intercom.",
    );
wire(
  "speaker",
  D.audio,
  P(55, 0, 76),
  "Audio panel → overhead speaker",
  bool("audio"),
  ["avionics", "cabin"],
  "POH 7-69; 172RPC24 23-30: selected speaker audio path; selection simplified.",
);
for (const side of [-1, 1]) {
  const name = side < 0 ? "Left" : "Right",
    sd = side < 0 ? "L" : "R";
  add(
    "fuelQty" + sd,
    [
      AF.P(AF.wingP(AF.Z(side * 47), 0.36, 0)),
      AF.P(AF.wingP(AF.Z(side * 24), 0.55, 0)),
      // Descend the door post and cross forward below the display faces.
      // The GEA endpoint is forward of the instrument panel, not in the pilot's sightline.
      ...cabinHarness(AF, AF.P(AF.wingP(AF.Z(side * 12), 0.55, 0)), D.gea, AF.X(14), side),
    ],
    ["fuel", "avionics"],
    name + " tank quantity sender →GEA 71",
    "POH 7-40; 172RPC24 28-40: quantity signal separate from gravity supply and computed GAL REM. Door-post/behind-panel path is an illustrative harness route, not surveyed installation coordinates.",
    bool("engineData"),
    { color: "#8BADC7" },
  );
}
wire(
  "pitotHeater",
  D.panel,
  PITOT,
  "PITOT HEAT electrical supply",
  bool("pitotHeating"),
  ["pitot", "electrical"],
  "POH 7-64/Fig 7-7: heating element supplied byELECTRICAL BUS2; heater cannot clear a blocked static port.",
);
flows.at(-1)!.pts = [
  ...cabinHarness(AF, D.panel, AF.P(AF.wingP(AF.Z(-12), 0.25, 0)), AF.X(14), -1),
  AF.P(AF.wingP(AF.Z(-45), 0.25, 0)),
  AF.P(AF.wingP(AF.Z(-65), 0.25, 0)),
  [PITOT[0], PITOT[1] + 0.01, PITOT[2]],
];
for (const [key, at, bus, label] of [
  ["pfdFanPower", D.pfd, "AV1", "PFD"],
  ["mfdFanPower", D.mfd, "AV2", "MFD"],
] as const)
  wire(
    key,
    D.panel,
    [at[0] + 0.04, at[1], at[2]],
    key.startsWith("pfd") ? "PFD heat-sink fan supply" : "MFD heat-sink fan supply",
    on(bus, label),
    ["electrical", "avionics"],
    "POH 7-73/Fig 7-7: display cooling powered from avionics buses, not standby-only essential supply.",
  );
add(
  "fwdFanAir",
  [P(12.4, 0, 64), P(17, 0, 66.5)],
  ["avionics"],
  "Forward avionics fan discharge",
  "POH 7-73: moves warm air from behind panel toward inside of windshield. Ambient discharge cue; no physical outlet tube.",
  bool("fwdFan"),
  { tube: false, color: "#9CC8DD" },
);
add(
  "aftFanAir",
  [P(109.5, 0, 56), P(116, 0, 54), P(127, 1, 52)],
  ["avionics"],
  "Aft avionics cooling airflow",
  "POH 7-73: fan cools GIAs/transponder racks independently from their data buses. Air cue not a pressurized duct.",
  bool("aftFan"),
  { tube: false, color: "#9CC8DD" },
);
add(
  "altStaticValve",
  [P(18.4, -3.5, 50.5), D.staticTee],
  ["pitot"],
  "Alternate-static valve → distribution tee",
  "POH 7-64: cabin pressure reaches the same standbyASI/altimeter/ADC static network; closing the valve restores the external source.",
  (s) => (s.pitot.altStatic ? 0.5 : 0),
  { color: "#2E7A3A", r: 0.005 },
);
flows.find((f) => f.key === "flapPower")!.pts = [
  ...cabinHarness(AF, D.panel, AF.P(AF.wingP(AF.Z(12), 0.6, 0)), AF.X(14), 1),
  AF.P(AF.wingP(AF.Z(30), 0.6, 0)),
];
export const DEPTH_FLOWS = flows;
export const depthFlowRates = (s: Sim, E: Elec) =>
  Object.fromEntries(Object.entries(gate).map(([k, f]) => [k, f(s, E)]));
