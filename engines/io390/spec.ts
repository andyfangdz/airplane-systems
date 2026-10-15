/**
 * Lycoming IO-390-C series (C3B6 as installed in the Cirrus SR20 G6). Every published number cites the
 * IO-390-C Installation and Operation Manual (IOM), January 2017; chart values were digitized from its Appendix C
 * figures (see SOURCES.md for how, and the reading uncertainty). `calibration` and the propeller's aerodynamics are
 * model constants chosen to reproduce the documented points: they are not Lycoming data.
 */
import type { EngineSpec } from "../types";

const IOM = "Lycoming IOM-IO-390-C, Jan 2017";

export const IO390: EngineSpec = {
  id: "io390",
  name: "IO-390",
  model: "Lycoming IO-390-C3B6",
  lead:
    "A 389 cu in, four-cylinder, horizontally opposed, air-cooled engine with continuous-flow fuel injection and " +
    "dual magnetos: 215 hp at 2,700 rpm, driving the propeller directly (IOM Table A-1, p. 51). The C3B6 is the " +
    "front-governor model the Cirrus SR20 G6 uses.",
  doc: "IOM",
  refs: {
    start: "IOM p. 30",
    idle: "IOM p. 26",
    magCheck: "IOM pp. 31–32",
    cruise: "IOM Table A-1, p. 39",
    tables:
      "Lycoming IOM, Table A-1 (p. 51), Table A-2 (p. 53), Table 2 (p. 14) and the operating procedures (pp. 26–40).",
    leaning: "IOM p. 39",
  },
  modelNotes: [
    "Power comes from Lycoming's own performance chart (Figure C-1), digitized: sea-level power against manifold pressure for each rpm, and the altitude correction to 20,000 ft. The running engine is calibrated so its full-throttle point and part-throttle lines land on that chart.",
    "Air flows through the throttle as a compressible orifice into the manifold; the cylinders draw it by speed and density. Fuel follows the fuel injector's metering (richer as the air thins), the fuel manifold and the nozzle curve (Figure C-2).",
    "Each cylinder's mixture sets its power, EGT and head heat: best power is about 150 °F rich of peak EGT (the IOM's leanest setting for maximum-power cruise, p. 39), power at peak EGT about 3.5 % lower, and the engine runs rough and quits far rich or lean. Fuel flow reproduces Figure C-3 and the Table A-1 cruise figures.",
    "Friction and pumping losses, starter torque, a constant-speed propeller with an oil-driven governor, and lumped thermal models for heads and oil (the thermostat and cooler from Table 2) complete the loop.",
    "The cylinder-pressure trace is drawn from the model's own work per cycle, with an assumed burn duration; it is illustrative, not measured data.",
    "The 3D engine: bore, stroke and the overall envelope (Table A-1) set its scale, and where each part sits follows the IOM's System Description figures (Figures 1B–9). The shapes and sizes of individual parts, the cylinders' spacing along the crankshaft, and the valve lift are schematic; the valves are drawn parallel to the cylinder where the real guides are angled.",
    "Not published, so chosen to fit the documented points: valve timing, rod length, the propeller's pitch range and inertia, the cooling and thermal constants, and the per-cylinder spread. The propeller is the SR20's Hartzell, used only as the load.",
  ],
  sources: [
    {
      title: "Lycoming IO-390-C Series Installation and Operation Manual, January 2017",
      href: "https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf",
      note: "Table A-1 (specifications, p. 51–52), Table A-2 (operating limits, p. 53), Tables A-3/A-4 (accessory drives, p. 54), Figures C-1 to C-3 (performance and fuel flow, p. 57–59), operating procedures (pp. 26–40).",
    },
    {
      title: "Cirrus SR20 POH 11934-005 (as cited in aircraft/sr20)",
      note: "The propeller used as the load: Hartzell HC-E3YR-1RF/F7392S-1, three blades, 74 in nominal diameter (POH 2-8, 7-40).",
    },
  ],

  geometry: {
    // Lycoming numbering seen from above: right 1 (front) and 3, left 2 (front) and 4 (IOM p. 6, Figure 9).
    // Crankpins follow from the 1-3-2-4 firing order; positions along the crank are schematic.
    cylinders: [
      { n: 1, side: "R", pin: 90, x: 0.1 },
      { n: 2, side: "L", pin: 270, x: 0.035 },
      { n: 3, side: "R", pin: 270, x: -0.075 },
      { n: 4, side: "L", pin: 90, x: -0.14 },
    ],
    firingOrder: [1, 3, 2, 4], // IOM p. 6; Table A-1 p. 51
    boreIn: 5.319, // Table A-1
    strokeIn: 4.375, // Table A-1
    displacementIn3: 389, // Table A-1
    compressionRatio: 8.9, // Table A-1
    rodIn: 6.75, // not published: drawing and pressure-trace kinematics only
    envelopeIn: { length: 32.56, width: 34.37, height: 22.19 }, // Table A-1
    valves: { ivo: 25, ivc: 60, evo: 60, evc: 20 }, // not published: animation and pressure trace only
    pendulumCounterweights: true, // IOM p. 2, Figure 4
  },

  ignition: {
    advanceBTC: 20, // Table A-1 "Spark plug advance 20º BTC"; Figure C-3 "20º BTDC"
    retardMag: "L", // Table A-1: Slick 4345 retard (left), 4370 plain (right)
    startRetardATC: 0, // assumption
    topPlugMag: { 1: "L", 3: "L", 2: "R", 4: "R" }, // schematic: each magneto fires one plug in every cylinder
    minStartRpm: 50, // IOM p. 30, p. 36: "engine speed less than 50 rpm … can prevent engine start"
  },

  rating: {
    hp: 215,
    rpm: 2700, // Table A-1 "Maximum Continuous Horsepower 215 HP @ 2700 rpm"
    cruise: [
      { label: "Performance cruise", pct: 75, hp: 161, rpm: 2450, gph: 12.8, mixture: "best power" },
      { label: "Economy cruise", pct: 65, hp: 140, rpm: 2350, gph: 9.8, mixture: "best economy" },
    ], // Table A-1; mixtures per IOM p. 39 ("maximum power mixture for performance cruise … best economy for economy cruise")
  },

  // Figure C-1 (curve 13601, p. 57): sea-level panel lines read at 20 and 29 inHg, each line's full-throttle end,
  // and the altitude panel's full-throttle power at 20,000 ft. Read to about ±1 hp, ±0.05 inHg.
  performance: {
    curve: "Lycoming curve 13601 (IOM Figure C-1)",
    lines: [
      { rpm: 2000, a: [20, 84.3], b: [29, 155.7], ftMap: 29.6, hp20k: 72.1 },
      { rpm: 2100, a: [20, 90.2], b: [29, 164.8], ftMap: 29.57, hp20k: 79.8 },
      { rpm: 2200, a: [20, 96.1], b: [29, 171.9], ftMap: 29.5, hp20k: 84.9 },
      { rpm: 2300, a: [20, 103.4], b: [29, 178.3], ftMap: 29.49, hp20k: 88.2 },
      { rpm: 2400, a: [20, 110.0], b: [29, 185.8], ftMap: 29.47, hp20k: 93.2 },
      { rpm: 2500, a: [20, 115.2], b: [29, 195.2], ftMap: 29.45, hp20k: 95.9 },
      { rpm: 2600, a: [20, 120.6], b: [29, 203.9], ftMap: 29.4, hp20k: 100.5 },
      { rpm: 2700, a: [20, 127.7], b: [29, 212.4], ftMap: 29.26, hp20k: 103.7 },
    ],
  },

  // Figure C-3 (curve 13602, p. 59): parallel straight lines, 0.40 lb/h per hp; offsets read at 110 and 130 hp.
  fuelFlow: {
    kind: "chart",
    curve: "Lycoming curve 13602 (IOM Figure C-3)",
    slope: 0.4,
    bestPower: [
      { rpm: 2000, base: 8.05 },
      { rpm: 2100, base: 9.0 },
      { rpm: 2200, base: 9.95 },
      { rpm: 2300, base: 10.9 },
      { rpm: 2400, base: 11.9 },
      { rpm: 2500, base: 13.0 },
      { rpm: 2600, base: 14.05 },
      { rpm: 2700, base: 15.2 },
    ],
    bestEconomy: [
      { rpm: 2000, base: 0.6 },
      { rpm: 2100, base: 1.5 },
      { rpm: 2200, base: 2.3 },
      { rpm: 2300, base: 3.1 },
      { rpm: 2400, base: 4.0 },
      { rpm: 2500, base: 4.85 },
      { rpm: 2600, base: 5.85 },
      { rpm: 2700, base: 6.8 },
    ],
  },

  // Figure C-2 (p. 58), nominal curve. The figure is titled for the RSA-5AD1 injector although Table A-1 lists the
  // RSA-10AD1/-10AD2 for the IO-390-C; the manual prints it as the IO-390's nozzle curve, and so do we.
  fuelSystem: {
    kind: "injected",
    unit: "AVStar RSA-10AD1 or -10AD2", // Table A-1
    nozzle: {
      curve: "Fuel flow vs nozzle pressure, C-12855B (IOM Figure C-2)",
      points: [
        [0, 0],
        [0.5, 22],
        [1, 33],
        [2, 49.5],
        [3, 60],
        [4, 70],
        [5, 79],
        [6, 87],
        [7, 94],
        [8, 100.5],
        [9, 106],
        [10, 111.5],
        [11, 117],
        [11.5, 120],
      ],
    },
  },

  limits: {
    rpmMax: { value: 2700, unit: "rpm", src: `${IOM} Table A-1 p. 51` },
    idleRpm: { min: 600, max: 700, src: `${IOM} p. 26 ("usual idle speed (600 to 700 rpm)")` },
    oilPressMinIdle: { value: 25, unit: "psi", src: `${IOM} Table A-2 p. 53` },
    oilPressNormal: { min: 55, max: 95, unit: "psi", src: `${IOM} Table A-2 p. 53 (rear of engine)` },
    oilPressMaxStart: { value: 115, unit: "psi", src: `${IOM} Table A-2 p. 53 (starting, warm-up, taxi, take-off)` },
    oilTempMax: { value: 235, unit: "°F", src: `${IOM} Table A-2 p. 53` },
    oilTempBest: { value: 180, unit: "°F", src: `${IOM} Table A-2 p. 53 (for maximum engine life)` },
    chtMax: { value: 465, unit: "°F", src: `${IOM} Table A-2 p. 53 (at the thermocouple)` },
    chtBestAbove75: { value: 450, unit: "°F", src: `${IOM} Table A-2 p. 53 (maximum life, above 75 % power)` },
    chtBestAt75: { value: 435, unit: "°F", src: `${IOM} Table A-2 p. 53 (maximum life, 75 % and below)` },
    magDropMax: { value: 175, unit: "rpm", src: `${IOM} pp. 31–32, 37` },
    magDiffMax: { value: 50, unit: "rpm", src: `${IOM} pp. 31–32, 37` },
    magCheckRpm: { min: 2100, max: 2200, src: `${IOM} p. 31 (fixed-pitch propellers or no MAP gage)` },
    oilSumpQt: { value: 7, unit: "qt", src: `${IOM} Table A-1 p. 51` },
    oilMinQt: { value: 3.5, unit: "qt", src: `${IOM} Table A-1 p. 51 (minimum in flight)` },
    starterMaxS: { value: 10, unit: "s", src: `${IOM} p. 30 (then 30 s to cool)` },
    leanMaxPowerROP: {
      value: 150,
      unit: "°F",
      src: `${IOM} p. 39 (maximum power cruise: never leaner than 150 °F rich of peak)`,
    },
  },

  oil: {
    thermostatF: 185, // IOM Table 2 p. 14: "The valve closes at 185ºF (85ºC) routing all engine oil flow through the cooler"
    coolerFlowGpm: 7.5, // IOM Table 2 p. 14
    coolerMaxBtuMin: 925, // IOM Table 2 p. 14: "heat rejection will not exceed 925 Btu per minute"
    pistonCoolingJets: true, // IOM p. 2
  },

  accessories: {
    starterRatio: 16.556, // Table A-1
    alternatorRatio: 3.2, // Table A-4 (3.10 in pulley)
    magnetoRatio: 1.0, // Table A-1
    tachRatio: 0.5, // Table A-1
    governorRatio: 0.895, // Table A-4 (C1B6/C3B6)
    rotation: "Clockwise, viewed from the anti-propeller end", // Table A-1 and its notice
    magnetos: "Slick 4345 retard (left), 4370 plain (right)", // Table A-1
    weightLb: 301, // Table A-1, C1B6 and C3B6, ±2 %
  },

  propeller: {
    name: "Hartzell HC-E3YR-1RF/F7392S-1",
    diameterIn: 74,
    blades: 3,
    src: "SR20 POH 11934-005 2-8, 7-40 (as cited in aircraft/sr20/parts/engine.ts)",
    fineDeg: 10,
    coarseDeg: 45,
    governorMinRpm: 2000,
    inertia: 3.2,
  },

  calibration: {
    idleArea: 0.02,
    lambdaBestPower: 0.85,
    lambdaFullRich: 0.8,
    peakEgtPower: 0.965,
    singlePlug: 0.93,
    egtBase: 1000,
    egtGain: 550,
    fuelTrim: [1.0, 0.985, 1.012, 0.995],
    coolingTrim: [1.04, 1.0, 0.97, 0.99],
    chtRise: 400,
    chtTau: 150,
    oilRise: 165,
    oilTau: 270,
    oilPressPerRpm: 52.8,
    oilRelief: 78,
  },
};
