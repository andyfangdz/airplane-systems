/** Sourced DA40 XLS component routes. Bends/bores and particles are explanatory, not surveyed installation. */
import type { FlowSpec } from "@/lib/catalogue";
import { V, toVec3, type Vec3 } from "@/lib/math";
import { FW, PANEL_X, ROLLBAR_X, fs, onSkin, wingP } from "./geometry";
import { CYLS, PROP } from "./parts/engine";
import { PITOT_Z, pitotBase } from "./parts/pitot";
import { LIGHTS } from "./parts/lights";
import { ALTERNATOR } from "./parts/engine";
import { PEDALS, SERVO } from "./rig";
import { engineTurning, fuelDeliveryAvailable, inductionAvailable, live, type Elec, type Sim } from "./model";
import * as A from "./depth-anchors";

const routes: FlowSpec[] = [];
const add = (
  key: string,
  points: FlowSpec["pts"],
  sys: FlowSpec["sys"],
  name: string,
  note: string,
  options: Partial<FlowSpec> = {},
) =>
  routes.push({
    key,
    pts: points,
    sys,
    name,
    note: note + " Bends and dimensions schematic.",
    r: 0.006,
    tension: 0.06,
    ...options,
  });
const signal = (key: string, a: Vec3, b: Vec3, note: string, sys: FlowSpec["sys"] = ["avionics"]) => {
  // Wing harnesses follow the mid-thickness wing to the root before entering the cabin.
  const pts: Vec3[] = [a];
  let from = a,
    to = b;
  if (Math.abs(a[2]) > 0.65) {
    const side = Math.sign(a[2]);
    for (const z of [Math.abs(a[2]) - 0.06, Math.abs(a[2]) * 0.72, 1.35, 0.7].filter(
      (z) => z > 0 && z < Math.abs(a[2]),
    ))
      pts.push(toVec3(wingP(side * z, 0.45, 0)));
    from = [fs(2.3), -0.46, side * 0.25];
    pts.push(from);
  }
  if (Math.abs(b[2]) > 0.65) to = [fs(2.3), -0.46, Math.sign(b[2]) * 0.25];
  if (Math.abs(from[0] - to[0]) > 0.3) {
    const toward = from[0] < to[0] ? 1 : -1;
    pts.push(
      [Math.min(from[0] + toward * 0.06, 1.85), -0.29, from[2] * 0.6],
      [to[0] - toward * 0.08, -0.43, to[2] * 0.6],
    );
  }
  if (to !== b) {
    pts.push(to);
    const side = Math.sign(b[2]);
    for (const z of [0.7, 1.35, Math.abs(b[2]) * 0.72, Math.abs(b[2]) - 0.06].filter(
      (z) => z > 0 && z < Math.abs(b[2]),
    ))
      pts.push(toVec3(wingP(side * z, 0.45, 0)));
  }
  pts.push(b);
  add(key, pts, sys, key, note, { r: 0.003, count: 5, color: "#C8399F", pcolor: "#EDAAE1" });
};
const staticRoute = { count: 0, color: "#738797" };

// Fuel selector is a lever and an under-floor valve; main supply follows the AFM/AMM Lycoming chain.
for (const s of [-1, 1]) {
  const suffix = s < 0 ? "L" : "R";
  add(
    `fuel${suffix}`,
    [wingP(s * 1.24, 0.42, 0), wingP(s * 0.7, 0.42, 0), [fs(2.6), -0.57, s * 0.12], A.FUEL_SELECTOR_BODY],
    ["fuel"],
    `${suffix} tank feed`,
    "Inboard finger filter → under-floor selector body (AMM 28-20-00 p 3).",
    { r: 0.008 },
  );
  for (const [i, z] of [2.1, 2.975].entries()) {
    add(
      `chamberFuel${suffix}${i}`,
      [A.tankPort(s, z + 0.035), A.tankPort(s, z - 0.035)],
      ["fuel"],
      "Fuel chamber coupling",
      "Large flexible coupling interconnects adjoining aluminum chambers (AMM 28-10-00 pp 5–6).",
      { r: 0.012 },
    );
    add(
      `chamberVent${suffix}${i}`,
      [A.tankPort(s, z - 0.035, true), A.tankPort(s, z + 0.035, true)],
      ["fuel"],
      "Chamber balance/vent hose",
      "Top hoses interconnect chamber vapor spaces; flow direction/rate not specified (AMM 28-10-00 p 6).",
      staticRoute,
    );
  }
  for (const check of [false, true]) {
    const end = A.VENT(s, check),
      key = check ? `ventCheck${suffix}` : `vent${suffix}`;
    add(
      key,
      [A.tankPort(s, 3.04, true), A.tankPort(s, 3.55), [end[0], end[1] + 0.055, end[2]], end],
      ["fuel"],
      check ? "Tank check-valve vent" : "Tank capillary vent",
      "Separate capillary pressure-balancing hose and one-way inlet vent; source gives no air-flow rate (AFM 7-34; AMM 28-10-00 p 6).",
      { ...staticRoute, r: 0.003 },
    );
  }
  for (const lr of [false, true])
    signal(
      `fuelProbe${suffix}${lr ? "LR" : "IB"}`,
      A.FUEL_PROBE(s, lr),
      A.GEA,
      "Capacitive probe → GEA measured fuel quantity; distinct from flow-integrating totalizer (AFM 7-34–37; Garmin SMM 4.6).",
      ["fuel", "avionics"],
    );
}
add(
  "fuelSel",
  [A.FUEL_SELECTOR_BODY, [fs(2.05), -0.575, 0], A.GASCOLATOR],
  ["fuel"],
  "Selector → gascolator",
  "Below-floor selector connects to low-point gascolator (AMM 28-20-00 p 3).",
  { r: 0.008 },
);
add(
  "fuelPump",
  [A.GASCOLATOR, [fs(1.75), -0.565, 0.04], A.ELECTRIC_PUMP],
  ["fuel"],
  "Gascolator → electric pump",
  "High-pressure rotary backup pump, below cockpit floor; off-state bypass permits normal engine-pump feed (AMM 28-20-00 pp 3–4; AFM 7-31).",
  { r: 0.008 },
);
add(
  "fuelFw",
  [A.ELECTRIC_PUMP, [FW - 0.06, -0.45, 0.025], A.FUEL_FIREWALL, [FW + 0.055, -0.35, -0.09], A.ENGINE_PUMP],
  ["fuel", "engine"],
  "Firesleeved firewall supply",
  "Bulkhead connector feeds firesleeved engine-pump hose (AMM 28-20-00 p 3).",
  { r: 0.008 },
);
add(
  "intake",
  [A.AIR_INLET, A.AIR_FILTER, A.ALTERNATE_AIR, A.FUEL_SERVO],
  ["engine"],
  "Lower-cowl filtered induction",
  "Molded lower-cowl duct → paper filter/housing → sleeve → fuel injector (AMM 71-60-00 pp 1–2).",
  { tube: false, pcolor: "#8FD3E8", size: 0.05 },
);
add(
  "altAir",
  [[A.ALTERNATE_AIR[0], A.ALTERNATE_AIR[1], 0.05], A.ALTERNATE_AIR, A.FUEL_SERVO],
  ["engine"],
  "Six-port alternate induction",
  "Bowden cable rotates sleeve ports to admit warm engine-compartment air (AMM 71-60-00 pp 1–2).",
  { tube: false, pcolor: "#EBC361", size: 0.05 },
);
for (const c of CYLS) {
  add(
    `inj${c.n}`,
    [A.FUEL_DIVIDER, [c.x, 0.12, c.s * 0.22], [c.x, 0.045, c.s * 0.33]],
    ["engine", "fuel"],
    `Injector line ${c.n}`,
    "Continuous-flow divider to nozzle at intake port (AMM 73-00-00; AFM 7-31).",
    { r: 0.004 },
  );
  signal(`cht${c.n}`, [c.x, -0.05, c.s * 0.35], A.GEA, "CHT thermocouple → GEA (Garmin SMM 2.2.4).", [
    "engine",
    "avionics",
  ]);
  signal(`egt${c.n}`, [c.x, -0.19, c.s * 0.33], A.GEA, "EGT thermocouple → GEA (Garmin SMM 2.2.4).", [
    "engine",
    "avionics",
  ]);
  for (const [level, dy] of [
    ["U", 0.055],
    ["L", -0.055],
  ] as const) {
    const mag = c.s > 0 === (level === "U") ? "R" : "L",
      m: Vec3 = [fs(1.27), 0.07, mag === "R" ? 0.1 : -0.1];
    add(
      `ign${c.n}${level}`,
      [m, [c.x - 0.12, 0.02, c.s * 0.22], [c.x - 0.1, dy - 0.05, c.s * 0.375]],
      ["engine"],
      `Magneto ${mag} → plug ${c.n}${level}`,
      "Left magneto feeds upper-left/lower-right plugs; right feeds upper-right/lower-left. Both are live in START with SlickSTART boost (AMM 74-00-00 pp. 6–7).",
      { r: 0.003, color: "#7BA4C1", pcolor: "#FFE17D", count: 4 },
    );
  }
  add(
    `oilHead${c.n}`,
    [A.OIL_GALLERY, [c.x, 0.02, c.s * 0.24], [c.x, 0.01, c.s * 0.35]],
    ["engine"],
    "Cylinder oil gallery",
    "Pressurized oil reaches bearings/valve train, then drains to sump (Lycoming IPC 72-30/72-60).",
    { r: 0.003, color: "#B85A2A" },
  );
  add(
    `oilHeadDrain${c.n}`,
    [[c.x, -0.02, c.s * 0.35], [c.x, -0.19, c.s * 0.2], A.OIL_SUMP],
    ["engine"],
    "Cylinder head oil drain",
    "Cylinder-head drain tube returns oil to crankcase/sump (Lycoming IPC 72-30 pp 28–29).",
    { r: 0.003, color: "#B85A2A" },
  );
}
add(
  "oil",
  [A.OIL_SUMP, A.OIL_SCREEN, A.OIL_PUMP, A.OIL_THERMOSTAT],
  ["engine"],
  "Oil suction and pump",
  "Sump inlet strainer → accessory pump → thermostatic bypass (AMM 79-00-00 p 1).",
  { r: 0.006, color: "#B85A2A" },
);
add(
  "oilCooler",
  [A.OIL_THERMOSTAT, [fs(1.05), -0.03, 0.17], A.OIL_COOLER, [fs(0.9), -0.16, 0.22], A.OIL_FILTER],
  ["engine"],
  "Warm-oil cooler circuit",
  "At operating temperature oil passes external cooler before full-flow filter (AMM 79-00-00 p 1).",
  { r: 0.006, color: "#B85A2A" },
);
add(
  "oilColdBypass",
  [A.OIL_THERMOSTAT, A.OIL_FILTER],
  ["engine"],
  "Cold-oil cooler bypass",
  "Cold oil bypasses cooler and goes directly to filter (AMM 79-00-00 p 1).",
  { r: 0.005, color: "#B85A2A" },
);
add(
  "oilGallery",
  [A.OIL_FILTER, A.OIL_RELIEF, A.OIL_GALLERY, A.OIL_SUMP],
  ["engine"],
  "Oil filter and engine galleries",
  "Filter → pressure regulation → lubrication galleries → sump (AMM 79-00-00 p 1).",
  { r: 0.005, color: "#B85A2A" },
);
add(
  "oilGov",
  [A.OIL_GALLERY, [fs(0.95), 0.1, 0], A.GOVERNOR, [fs(0.65), 0.04, 0], [PROP[0] - 0.06, 0, 0]],
  ["engine", "propeller"],
  "Governor oil to pitch piston",
  "Governor pump/pilot valve meters oil through hollow crankshaft to non-feathering pitch piston (AMM 61-20-00; MT E-1244.6).",
  { r: 0.004, color: "#B85A2A" },
);
add(
  "govReturn",
  [A.GOVERNOR, [fs(0.9), 0.07, -0.08], A.OIL_SUMP],
  ["propeller", "engine"],
  "Governor return oil",
  "Underspeed drains propeller oil through governor to engine sump; return spring/twisting moment decrease pitch (AMM 61-20-00 p 2).",
  { r: 0.004, color: "#B85A2A" },
);
signal("oilP", [fs(0.83), -0.25, -0.12], A.GEA, "Oil pressure transducer → GEA (Garmin SMM 2.2.4).", [
  "engine",
  "avionics",
]);
signal("oilT", [fs(1.16), -0.05, -0.11], A.GEA, "Oil temperature sensor → GEA (Garmin SMM 2.2.4).", [
  "engine",
  "avionics",
]);
signal("mapSensor", [fs(0.83), -0.265, -0.2], A.GEA, "Manifold-pressure transducer → GEA (Garmin SMM 2.2.4).", [
  "engine",
  "avionics",
]);
signal("rpmSensor", [fs(1.27) + 0.01, 0.07, 0.15], A.GEA, "Right-magneto tachometer pickup → GEA (Garmin SMM 2.2.4).", [
  "engine",
  "avionics",
]);
signal(
  "fuelFlow",
  A.FLOW_SENSOR,
  A.GEA,
  "Shadin flow transducer → GEA; flow is separate from pressure and measured tank quantity (Garmin SMM 2.2.4).",
  ["fuel", "avionics"],
);
signal("fuelPressure", [fs(0.83), -0.28, 0.08], A.GEA, "Kulite pressure sensor → GEA (Garmin SMM 2.2.4).", [
  "fuel",
  "avionics",
]);

// Instrument pressure feeds split around a parallel low-point loop and rejoin before instruments.
const PT: Vec3 = [PANEL_X + 0.06, -0.2, -0.3],
  ST: Vec3 = [PANEL_X + 0.075, -0.2, -0.26];
add(
  "pitot",
  [
    toVec3(pitotBase.clone().add(V(0, 0.012, 0))),
    wingP(PITOT_Z, 0.32, 0),
    wingP(-1.4, 0.32, 0),
    A.PITOT_FILTER,
    A.PITOT_SPLIT,
    A.PITOT_JOIN,
    [fs(2.05), -0.5, -0.22],
    PT,
    A.GDC,
  ],
  ["pitot"],
  "Pitot instrument feed",
  "Combined LH pressure mast → wing-root filter → parallel water-trap tees → GDC74A (AFM 7-54; AMM 34-10-00 p 1).",
  { r: 0.005 },
);
add(
  "static",
  [
    toVec3(pitotBase.clone().add(V(-0.03, 0.016, 0.03))),
    wingP(PITOT_Z, 0.36, 0),
    wingP(-1.4, 0.36, 0),
    A.STATIC_FILTER,
    A.STATIC_SPLIT,
    A.STATIC_JOIN,
    [fs(2.05), -0.5, -0.29],
    ST,
  ],
  ["pitot"],
  "Mast static source to common tee",
  "Mast static orifices → blue/purple tubing → parallel water-trap tees → instrument static tee; alternate valve selects cabin pressure instead (AFM 7-54; AMM 34-10-00 p. 1).",
  { r: 0.005, color: "#2E6FB0" },
);
add(
  "staticGdc",
  [ST, A.GDC],
  ["pitot"],
  "Common static tee to GDC",
  "Selected mast or cabin pressure shares this tubing to the air-data computer. Pressure connection remains independent of ADC power (AFM 7-54; AMM 34-10-00 p. 1).",
  { r: 0.004, color: "#2E6FB0" },
);
for (const [key, start, sump, end] of [
  ["pitotTrap", A.PITOT_SPLIT, A.PITOT_SUMP, A.PITOT_JOIN],
  ["staticTrap", A.STATIC_SPLIT, A.STATIC_SUMP, A.STATIC_JOIN],
] as const)
  add(
    key,
    [start, sump, end],
    ["pitot"],
    "Parallel moisture sump loop",
    "Lower branch collects water while upper branch feeds instruments; joins again at second tee (AMM 34-10-00 p 1). Pressure particles are illustrative, not steady airflow.",
    { r: 0.004, color: key === "staticTrap" ? "#2E6FB0" : "#3A9448", count: 0 },
  );
add(
  "pitot2",
  [PT, [PANEL_X + 0.06, 0.05, -0.2], [PANEL_X + 0.03, 0.15, -0.107]],
  ["pitot"],
  "Standby airspeed pitot",
  "Separate branch to standby airspeed; common pressure source, independent electronics (AFM 7-54).",
  { r: 0.004 },
);
add(
  "static2",
  [ST, [PANEL_X + 0.075, 0.05, -0.05], [PANEL_X + 0.03, 0.15, 0.089]],
  ["pitot"],
  "Standby altimeter static",
  "Static feeds standalone altimeter; standby airspeed also needs this static pressure (AFM 7-54).",
  { r: 0.004, color: "#2E6FB0" },
);
add(
  "staticAsi",
  [ST, [PANEL_X + 0.055, 0.05, -0.14], [PANEL_X + 0.03, 0.15, -0.107]],
  ["pitot"],
  "Standby airspeed static",
  "Airspeed compares total and static pressure; this separate static branch was previously missing (AFM 7-54; AMM 34-10-00).",
  { r: 0.004, color: "#2E6FB0" },
);
add(
  "altStatic",
  [A.ALTERNATE_STATIC, [PANEL_X + 0.025, -0.3, -0.36], ST],
  ["pitot"],
  "Alternate cabin static",
  "OAM 40-072 valve admits cabin pressure; close emergency window and cockpit vents (AFM 7-54/2-29).",
  { r: 0.004, color: "#2E6FB0" },
);

// Electrical power and data are separate; routes terminate on actual existing LRU ports.
for (const [key, from, to, label] of [
  ["tieWire", A.BUS.main, A.TIE_RELAY, "MAIN ↔ tie relay"],
  ["tieEss", A.TIE_RELAY, A.BUS.ess, "Tie relay ↔ ESS"],
  ["diodeMain", A.BUS.main, A.TIE_DIODE, "MAIN → bypass diode"],
  ["diodeEss", A.TIE_DIODE, A.BUS.ess, "Bypass diode → ESS"],
  ["avRelayFeed", A.BUS.main, A.AV_RELAY, "MAIN → avionics relay"],
  ["avRelayOut", A.AV_RELAY, A.BUS.av, "Avionics relay → AV bus"],
] as [string, Vec3, Vec3, string][])
  add(
    key,
    [from, to],
    ["electrical"],
    label,
    "Aircraft-specific tie relay, bypass diode and avionic relay (Garmin SMM Fig. 2-3).",
    { r: 0.004, count: 5, color: "#D9960F" },
  );
for (const [key, point, bus] of [
  ["pfdPower", A.PFD, "ess"],
  ["mfdPower", A.MFD, "main"],
  ["geaPower", A.GEA, "ess"],
  ["gdcPower", A.GDC, "ess"],
  ["grsPower", A.GRS, "ess"],
  ["gia1Power", A.GIA1, "ess"],
  ["gia2Power", A.GIA2, "av"],
  ["gtxPower", A.GTX, "ess"],
] as [string, Vec3, keyof typeof A.BUS][])
  signal(key, A.BUS[bus], point, "Dedicated breaker power from aircraft-specific bus (Garmin SMM 2-9).", [
    "electrical",
    "avionics",
  ]);
for (const [key, a, b, desc] of [
  ["displayHSDB", A.PFD, A.MFD, "Display HSDB"],
  ["pfdGia1", A.PFD, A.GIA1, "HSDB to primary GIA"],
  ["mfdGia2", A.MFD, A.GIA2, "HSDB to secondary GIA"],
  ["geaGia1", A.GEA, A.GIA1, "GEA engine/airframe data"],
  ["geaGia2", A.GEA, A.GIA2, "GEA backup data"],
  ["grsPfd", A.GRS, A.PFD, "AHRS attitude/heading"],
  ["grsMfd", A.GRS, A.MFD, "AHRS backup attitude/heading"],
  ["gdcPfd", A.GDC, A.PFD, "ADC pressure/airspeed/OAT"],
  ["gdcGia1", A.GDC, A.GIA1, "ADC to GIA"],
  ["gdcGia2", A.GDC, A.GIA2, "ADC to backup GIA"],
  ["audioGia1", A.GMA, A.GIA1, "COM1/NAV1 audio"],
  ["audioGia2", A.GMA, A.GIA2, "COM2/NAV2 audio"],
] as [string, Vec3, Vec3, string][])
  signal(key, a, b, desc + " (Garmin SMM 2-3–2-12,Fig 2-5).");
for (const [name, point] of Object.entries(SERVO)) {
  signal(
    `servoData${name}`,
    A.GIA1,
    point,
    "GFC 700 RS-485 servo data, separate enable/disconnect chain (Garmin SMM 2-7).",
    ["autopilot", "avionics"],
  );
  signal(
    `servoPower${name}`,
    A.BUS.av,
    point,
    "AFCS breaker → GSA 81/GSM 85 servo power; no yaw damper fitted (Garmin SMM 2-7–2-9).",
    ["autopilot", "electrical"],
  );
}
signal(
  "gmuData",
  toVec3(wingP(2.6, 0.45, 0)),
  A.GRS,
  "GMU44 magnetic data and power connect directly to GRS77 (Garmin SMM 2-4).",
);
signal(
  "oatData",
  [fs(2), -0.565, 0.3],
  A.GDC,
  "GTP59 OAT connected to GDC74A; individual probe station approximate (Garmin SMM 2.2.6).",
  ["pitot", "avionics"],
);
for (const side of [-1, 1]) {
  signal(
    `positionWire${side}`,
    A.BUS.main,
    LIGHTS[side < 0 ? "tipL" : "tipR"],
    "POSITION breaker → corresponding wingtip lamp (AFM 7-44; AMM 33-40).",
    ["lighting", "electrical"],
  );
  signal(
    `strobeWire${side}`,
    A.BUS.main,
    toVec3(wingP(side * 1.45, 0.3, 0)),
    "STROBE breaker → wing power supply, distinct from nav supply (AFM 7-44; AMM 33-40).",
    ["lighting", "electrical"],
  );
  const circuit = A.brakeCircuit(side);
  add(
    `brakeReservoir${side}`,
    [circuit.reservoir, circuit.copilot],
    ["gear"],
    "Reservoir to copilot brake master",
    "Both reservoirs attach to the copilot masters, one for each independent wheel circuit (AMM 32-40-00 p. 3).",
    { r: 0.003, count: 0 },
  );
  add(
    `brakeInterconnect${side}`,
    [
      circuit.copilot,
      [PEDALS.x + 0.01, -0.465, circuit.copilot[2]],
      [PEDALS.x + 0.01, -0.465, circuit.pilot[2]],
      circuit.pilot,
    ],
    ["gear"],
    "Copilot to pilot brake master",
    "Copilot-master outlet → same-wheel pilot-master inlet, in series (AMM 32-40-00 p. 3/Fig. 2).",
    { r: 0.003, count: 0 },
  );
  add(
    `brakePilotValve${side}`,
    [circuit.pilot, [fs(1.65), -0.49, circuit.pilot[2] * 0.7], A.BRAKE_VALVE],
    ["gear"],
    "Pilot brake master to parking valve",
    "Pilot-master outlet feeds its parking-valve channel; existing wheel brake line continues to caliper (AMM 32-40-00 p. 3/Fig. 2).",
    { r: 0.003, count: 0 },
  );
}
add(
  "alternatorCooling",
  [[fs(0.48), -0.06, 0.25], [fs(0.7), -0.2, 0.2], ALTERNATOR],
  ["environment", "electrical"],
  "Alternator cooling branch",
  "Small hose from RH intake adaptor cools alternator (AMM 21-00-00 p 1).",
  { r: 0.01, count: 5, pcolor: "#5FC8F0" },
);
add(
  "freshCross",
  [wingP(-0.75, 0.15, 0), [fs(2.3), -0.5, -0.3], [fs(2.3), -0.5, 0.3], wingP(0.75, 0.15, 0)],
  ["environment"],
  "Fresh-air cross-fuselage pipe",
  "LH stub-wing collector feeds RH closing rib across fuselage; side ducts feed roll-bar outlets (AMM 21-00-00 p 3).",
  { r: 0.013 },
);
// Optional panel ventilation has two independent front-fuselage inlets, not a wing-root branch.
for (const side of [-1, 1])
  add(
    side < 0 ? "freshPanel" : "freshPanelR",
    [
      toVec3(onSkin(fs(1.88), -0.16, side, 1.005)),
      [fs(1.92), -0.16, side * 0.43],
      [PANEL_X + 0.04, -0.03, side * 0.47],
    ],
    ["environment"],
    "Optional panel fresh-air hose",
    "OAM 40-099 separate front-fuselage NACA → adjustable panel nozzle (AMM 21-00-00 p 3).",
    { r: 0.01 },
  );

// Physical mechanical controls and separate low-voltage indication/enable circuits.
for (const [key, start, end, sys, desc] of [
  [
    "throttleCable",
    [fs(2), -0.34, -0.045],
    A.FUEL_SERVO,
    ["engine"],
    "Throttle Bowden cable changes injector throttle/idle linkage",
  ],
  [
    "mixtureCable",
    [fs(2), -0.34, 0.045],
    A.FUEL_SERVO,
    ["engine", "fuel"],
    "Mixture Bowden cable operates manual mixture cut-off valve",
  ],
  [
    "rpmCable",
    [fs(2), -0.34, 0],
    A.GOVERNOR,
    ["propeller"],
    "RPM Bowden cable changes governor speeder-spring preload",
  ],
  [
    "alternateAirCable",
    [fs(1.86), -0.33, -0.14],
    A.ALTERNATE_AIR,
    ["engine"],
    "Manual Bowden cable rotates alternate-air sleeve",
  ],
] as [string, Vec3, Vec3, FlowSpec["sys"], string][])
  add(
    key,
    [start, [FW - 0.07, -0.33, -0.06], [FW + 0.07, -0.31, -0.04], end],
    sys,
    key,
    desc + " (AMM 61-20/71-60/76-00).",
    { r: 0.003, count: 0 },
  );
for (const [mag, z] of [
  ["L", -0.1],
  ["R", 0.1],
] as const)
  signal(
    `pLead${mag}`,
    [PANEL_X - 0.035, -0.17, -0.01],
    [fs(1.27), 0.07, z],
    "Ignition-key P-lead grounds magneto when disabled; magneto energy is independent of battery (AFM 7-43).",
    ["engine", "electrical"],
  );
signal(
  "slickStartPower",
  A.START_RELAY,
  A.SLICKSTART,
  "START circuit powers SlickSTART spark booster during cranking (AFM 7-43; OAM 40-073).",
  ["engine", "electrical"],
);
for (const name of Object.keys(SERVO) as (keyof typeof SERVO)[]) {
  signal(
    `servoData2${name}`,
    A.GIA2,
    SERVO[name],
    "Second-GIA RS-485 connection to servo network; data and enable are separate (Garmin SMM Fig. 2-1,2-7).",
    ["autopilot", "avionics"],
  );
  signal(
    `servoEnable${name}`,
    [PANEL_X + 0.025, -0.15, -0.34],
    SERVO[name],
    "Normally closed AP DISC chain supplies SERVO ENABLE; opening either switch removes enable (Garmin SMM 2-7).",
    ["autopilot", "electrical"],
  );
}
for (const [key, a, b, desc] of [
  ["gdcMfd", A.GDC, A.MFD, "ADC to MFD"],
  ["gdcGrs", A.GDC, A.GRS, "Air data aids AHRS"],
  ["grsGia1", A.GRS, A.GIA1, "AHRS to primary GIA"],
  ["grsGia2", A.GRS, A.GIA2, "AHRS to secondary GIA"],
] as [string, Vec3, Vec3, string][])
  signal(key, a, b, desc + " (Garmin SMM Fig. 2-1).");
signal(
  "doorDiscrete",
  [ROLLBAR_X + 0.06, -0.1, -0.49],
  A.GEA,
  "Locked-door detection discrete to GEA, independent of pressure/attitude inputs (Garmin SMM 2.2.4).",
  ["cabin", "avionics"],
);
signal(
  "pitotHeatWire",
  A.BUS.ess,
  toVec3(pitotBase.clone().add(V(0, 0.012, 0))),
  "PITOT 10 A breaker → mast mounting connector → integral thermal switch/fuse/heater (AFM 7-45).",
  ["pitot", "electrical"],
);

export const DEPTH_FLOWS = routes;
export const DEPTH_REPLACEMENTS = new Set(routes.map((f) => f.key));
/** Study circulation rates: temperature crossover is illustrative; AFM gives no thermostat temperature. */
export function depthRates(s: Sim, E: Elec): Record<string, number> {
  const r: Record<string, number> = {},
    run = s.eng.running,
    turning = engineTurning(s, E),
    feed = fuelDeliveryAvailable(s, E) ? Math.max(0.3, live.ff / 9) : 0;
  for (const f of routes) {
    if (f.key.startsWith("fuelProbe")) r[f.key] = E.gea ? 0.5 : 0;
    else if (f.key.startsWith("chamberFuel")) r[f.key] = feed && f.key.includes(s.fuel.sel) ? 0.4 : 0;
    else if (f.key.startsWith("chamberVent") || f.key.startsWith("vent")) r[f.key] = 0;
    else if (f.key.startsWith("ign")) {
      const name = f.name ?? "",
        mag = name.includes("Magneto R") ? "R" : "L";
      r[f.key] =
        turning &&
        !s.eng.fail[mag === "L" ? "magL" : "magR"] &&
        (s.eng.key === "BOTH" || s.eng.key === "START" || s.eng.key === mag)
          ? 0.8
          : 0;
    } else if (f.key.startsWith("oil")) r[f.key] = run || live.oilP > 5 ? 0.7 : 0;
    else if (f.sys.includes("avionics")) r[f.key] = E.gea || E.gia1 || E.gia2 ? 0.5 : 0;
    else r[f.key] = 0;
  }
  r.fuelL = s.fuel.sel === "L" ? feed : 0;
  r.fuelR = s.fuel.sel === "R" ? feed : 0;
  r.fuelSel = r.fuelPump = r.fuelFw = r.fuelEng = feed;
  r.fuelDist = s.eng.mix > 0.02 ? feed : 0;
  const induction = turning && inductionAvailable(s) ? Math.max(0.1, live.rpm / 2400) : 0;
  r.intake = !s.eng.altAir ? induction : 0;
  r.altAir = s.eng.altAir ? induction : 0;
  for (const c of CYLS) {
    r[`man${c.n}`] = induction;
    r[`inj${c.n}`] = s.eng.mix > 0.02 ? feed : 0;
    r[`cht${c.n}`] = r[`egt${c.n}`] = E.gea ? 0.5 : 0;
  }
  r.bleed = 0;
  r.oilP = r.oilT = r.mapSensor = r.rpmSensor = r.fuelFlow = r.fuelPressure = E.gea ? 0.5 : 0;
  const oil = run || live.oilP > 5 ? 0.7 : 0;
  r.oil = r.oilGallery = oil;
  r.oilCooler = oil * (live.oilT >= 150 ? 1 : 0);
  r.oilColdBypass = oil * (live.oilT < 150 ? 1 : 0);
  r.oilGov = run && !s.eng.fail.governor && live.oilP > 15 ? 0.5 : 0;
  r.govReturn = r.oilGov * 0.4;
  r.pitot = r.pitot2 = s.air ? 0.4 : 0;
  r.static = s.pitot.altStatic ? 0 : s.air ? 0.4 : 0;
  r.staticGdc = r.static2 = r.staticAsi = s.air || s.pitot.altStatic ? 0.4 : 0;
  r.altStatic = s.pitot.altStatic ? 0.4 : 0;
  r.pitotTrap = r.staticTrap = 0;
  r.tieWire = r.tieEss = E.tieClosed && E.tieCb ? 0.7 : 0;
  r.diodeMain = r.diodeEss = E.essAlt ? 0.7 : 0;
  r.avRelayFeed = r.avRelayOut = E.av > 0 ? 0.7 : 0;
  for (const [key, power] of Object.entries({
    pfdPower: E.pfd,
    mfdPower: E.mfd,
    geaPower: E.gea,
    gdcPower: E.adc,
    grsPower: E.ahrs,
    gia1Power: E.gia1,
    gia2Power: E.gia2,
    gtxPower: E.xpdr,
  }))
    r[key] = power ? 0.5 : 0;
  r.displayHSDB = E.pfd && E.mfd ? 0.5 : 0;
  r.pfdGia1 = E.pfd && E.gia1 ? 0.5 : 0;
  r.mfdGia2 = E.mfd && E.gia2 ? 0.5 : 0;
  r.geaGia1 = E.gea && E.gia1 ? 0.5 : 0;
  r.geaGia2 = E.gea && E.gia2 ? 0.5 : 0;
  r.grsPfd = E.ahrs && E.pfd ? 0.5 : 0;
  r.grsMfd = E.ahrs && E.mfd ? 0.5 : 0;
  r.gdcPfd = E.adc && E.pfd ? 0.5 : 0;
  r.gdcGia1 = E.adc && E.gia1 ? 0.5 : 0;
  r.gdcGia2 = E.adc && E.gia2 ? 0.5 : 0;
  r.audioGia1 = E.audio && E.gia1 ? 0.5 : 0;
  r.audioGia2 = E.audio && E.gia2 ? 0.5 : 0;
  r.gmuData = E.ahrs ? 0.5 : 0;
  r.gdcMfd = E.adc && E.mfd ? 0.5 : 0;
  r.gdcGrs = E.adc && E.ahrs ? 0.5 : 0;
  r.grsGia1 = E.ahrs && E.gia1 ? 0.5 : 0;
  r.grsGia2 = E.ahrs && E.gia2 ? 0.5 : 0;
  r.doorDiscrete = E.gea ? 0.5 : 0;
  r.oatData = E.adc ? 0.5 : 0;
  for (const name of Object.keys(SERVO)) {
    // Each data link needs its own GIA and powered servo receiver; overall AP availability is separate.
    r[`servoData${name}`] = E.gia1 && E.afcsPwr ? 0.5 : 0;
    r[`servoPower${name}`] = E.afcsPwr ? 0.5 : 0;
    r[`servoData2${name}`] = E.gia2 && E.afcsPwr ? 0.5 : 0;
    r[`servoEnable${name}`] = E.afcsPwr ? 0.5 : 0;
  }
  for (const side of [-1, 1]) {
    r[`positionWire${side}`] = E.posPwr && s.lights.position ? 0.5 : 0;
    r[`strobeWire${side}`] = E.strobePwr && s.lights.strobe ? 0.5 : 0;
    r[`brakeReservoir${side}`] = 0;
  }
  r.pLeadL = r.pLeadR = 0;
  r.slickStartPower = E.starterOn ? 0.5 : 0;
  r.pitotHeatWire = E.pitotPwr && s.pitot.heat && !s.pitot.heaterFail ? 0.5 : 0;
  r.alternatorCooling = r.freshCross = s.air ? 1 : run ? 0.5 : 0;
  r.freshPanel = r.freshPanelR = s.env.extraVents ? (s.air ? 0.8 : run ? 0.25 : 0) : 0;
  return r;
}
