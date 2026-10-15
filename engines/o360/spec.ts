/**
 * Lycoming O-360-A1D (as installed in the 1968 Mooney M20C Ranger, aircraft/m20c). Every published number cites the
 * Lycoming O-360 and associated models Operator's Manual (OM), 60297-12; chart values were digitized from its
 * Section 3 figures (see SOURCES.md for how, and the reading uncertainty). `calibration`, the carburetor's internal
 * constants and the propeller's aerodynamics are model constants chosen to reproduce the documented points: they are
 * not Lycoming data.
 */
import type { EngineSpec } from "../types";

const OM = "Lycoming OM 60297-12";

export const O360: EngineSpec = {
  id: "o360",
  name: "O-360",
  model: "Lycoming O-360-A1D",
  lead:
    "A 361 cu in, four-cylinder, horizontally opposed, air-cooled engine with a float carburetor and dual magnetos: " +
    "180 hp at 2,700 rpm, driving the propeller directly (OM pp. 1-1, 2-1). The A1D has a Marvel-Schebler MA-4-5 " +
    "carburetor with manual mixture and idle cut-off, and a retard-breaker left magneto (OM Table 1, p. 1-3); the " +
    "1968 Mooney M20C uses it with a constant-speed propeller.",
  doc: "OM",
  refs: {
    start: "OM pp. 3-1–3-2",
    idle: "OM p. 5-4",
    magCheck: "OM pp. 3-4–3-5",
    cruise: "OM p. 3-12, p. 3-6",
    tables:
      "Lycoming OM 60297-12, Section 2 (pp. 2-1, 2-7–2-9), the engine flight chart (pp. 3-10–3-12) and the operating instructions (pp. 3-1–3-9).",
    leaning: "OM p. 3-6",
    carbHeat: "OM pp. 3-8–3-9",
  },
  modelNotes: [
    "Power comes from Lycoming's sea-level and altitude performance chart (OM Figure 3-42, curve 13358), digitized: sea-level power against manifold pressure for each rpm, and the full-throttle power at 20,000 ft. The running engine is calibrated so its full-throttle point and part-throttle lines land on that chart.",
    "Air flows through the carburetor's throttle as a compressible orifice into the manifold; the cylinders draw it by speed and density. The float carburetor meters fuel through its venturi (richer as the air thins or is heated), an idle circuit carries the engine with the throttle nearly closed, and an accelerator pump squirts fuel when the throttle opens. The engine-driven pump keeps the float bowl full at the OM's 0.5 to 8 psi carburetor inlet pressure (p. 3-10).",
    "Fuel flow at best power follows the performance-cruise point (135 hp at 10.5 gph, OM p. 3-12); at peak EGT it lands on the minimum fuel flow of Figure 3-39. The OM's economy-cruise figure (117 hp, 9.5 gph) is richer than both the model's flow at peak EGT (about 8.4 gph) and Figure 3-39's minimum for 65 % (8.26 gph); the model follows the figure.",
    "Carburetor ice: fuel evaporation and the pressure drop past the throttle cool the mixture, up to the OM's 70 °F below the incoming air (p. 3-8). With moist air and the chamber below freezing, ice narrows the bore; with a constant-speed propeller the sign is falling manifold pressure at steady rpm. Carburetor heat takes air warmed by a jacket around the exhaust (p. 3-9) and melts it. How fast ice builds and how much heat the muff gives are illustrative, not published.",
    "Each cylinder's mixture sets its power, EGT and head heat: best power is about 150 °F rich of peak EGT (the OM's leanest setting for maximum-power cruise, p. 3-6), power at peak EGT about 3.5 % lower, and the engine runs rough and quits far rich or lean. A carburetor feeds the cylinders less evenly than injection, so their mixtures spread more.",
    "Friction and pumping losses, starter torque, a constant-speed propeller with an oil-driven governor, and lumped thermal models for heads and oil complete the loop.",
    "The cylinder-pressure trace is drawn from the model's own work per cycle, with an assumed burn duration; it is illustrative, not measured data.",
    "The 3D engine: bore, stroke and the overall envelope (OM p. 2-9) set its scale. The parts are drawn on the same schematic layout as the IO-390's, with the carburetor under the sump in place of the fuel injector; their shapes, sizes and spacing are schematic.",
    "Not published, so chosen to fit the documented points: valve timing, rod length, idle rpm (left to the airframe maker, OM p. 5-4), the oil thermostat, the propeller's aerodynamics and inertia, the carburetor's internal constants, and the cooling and thermal constants. The propeller is the 1968 Mooney M20C's Hartzell, used only as the load.",
  ],
  sources: [
    {
      title: "Lycoming O-360 and associated models Operator's Manual, 60297-12",
      href: "https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf",
      note: "Section 1 (description and Table 1 model application, pp. 1-1–1-3), Section 2 (specifications, accessory drives, weights and dimensions, pp. 2-1, 2-7–2-9), engine flight chart (pp. 3-10–3-12), operating instructions (pp. 3-1–3-9), idle mixture adjustment (p. 5-4), Figures 3-39 and 3-42 (pp. 3-53, 3-56), Figure 7-4 (p. 7-7).",
    },
    {
      title: "1968 Mooney M20C Ranger Owner's Manual (as cited in aircraft/m20c)",
      note: "The propeller used as the load: Hartzell HC-C2YK-1B/7666A-2, two blades, 74 in diameter, 13° low to 29° high pitch at the 30 in station.",
    },
  ],

  geometry: {
    // Lycoming numbering seen from the rear: front to rear, odd numbers on the right (OM p. 1-1). Crankpins follow
    // from the 1-3-2-4 firing order; positions along the crank are schematic.
    cylinders: [
      { n: 1, side: "R", pin: 90, x: 0.1 },
      { n: 2, side: "L", pin: 270, x: 0.035 },
      { n: 3, side: "R", pin: 270, x: -0.075 },
      { n: 4, side: "L", pin: 90, x: -0.14 },
    ],
    firingOrder: [1, 3, 2, 4], // OM p. 2-1
    boreIn: 5.125, // OM p. 2-1
    strokeIn: 4.375, // OM p. 2-1
    displacementIn3: 361, // OM p. 2-1
    compressionRatio: 8.5, // OM p. 2-1
    rodIn: 6.75, // not published: drawing and pressure-trace kinematics only
    envelopeIn: { length: 29.81, width: 33.37, height: 24.59 }, // OM p. 2-9, -A1D
    valves: { ivo: 25, ivc: 60, evo: 60, evc: 20 }, // not published: animation and pressure trace only
    pendulumCounterweights: false, // OM p. 1-3: only models with a 6 in the suffix (O-360-A1G6) have them
  },

  ignition: {
    advanceBTC: 25, // OM p. 2-1 "Spark occurs, degrees BTC 25"; Figure 3-39 "25° BTC"
    retardMag: "L", // OM Table 1 p. 1-3: left S4LN-200, right S4LN-204 (S4LN-200 is the retard-breaker type, p. 1-5)
    startRetardATC: 0, // assumption
    topPlugMag: { 1: "L", 3: "L", 2: "R", 4: "R" }, // schematic: each magneto fires one plug in every cylinder
    minStartRpm: 50, // assumption (the OM gives none)
  },

  rating: {
    hp: 180,
    rpm: 2700, // OM p. 2-1, p. 3-12 "Normal rated 2700 180"
    cruise: [
      { label: "Performance cruise", pct: 75, hp: 135, rpm: 2450, gph: 10.5, mixture: "best power" },
      { label: "Economy cruise", pct: 65, hp: 117, rpm: 2350, gph: 9.5, mixture: "best economy" },
    ], // OM p. 3-12, O-360-A; mixtures per OM p. 3-6 ("maximum power mixture for performance cruise … best economy for economy cruise")
  },

  // Figure 3-42 (curve 13358, p. 3-56): sea-level panel lines read at 20 and 29 inHg, each line's full-throttle end,
  // and the altitude panel's full-throttle power at 20,000 ft. Read to about ±1 hp, ±0.05 inHg.
  performance: {
    curve: "Lycoming curve 13358 (OM Figure 3-42)",
    lines: [
      { rpm: 2000, a: [20, 77.7], b: [29, 138.8], ftMap: 29.08, hp20k: 67.4 },
      { rpm: 2200, a: [20, 87.1], b: [29, 151.3], ftMap: 28.97, hp20k: 72.3 },
      { rpm: 2400, a: [20, 95.0], b: [29, 164.6], ftMap: 28.87, hp20k: 76.1 },
      { rpm: 2600, a: [20, 103.7], b: [29, 175.6], ftMap: 28.77, hp20k: 79.3 },
      { rpm: 2700, a: [20, 106.2], b: [29, 182.0], ftMap: 28.7, hp20k: 80.8 },
    ],
  },

  // The OM has no part-throttle fuel chart for the O-360-A: best power burns the performance-cruise point's
  // 10.5 gph for 135 hp (p. 3-12, 6 lb/gal). Figure 3-39 (curve 13357, p. 3-53) is the minimum allowable fuel flow.
  fuelFlow: {
    kind: "bsfc",
    bsfc: (10.5 * 6) / 135,
    src: "OM p. 3-12: performance cruise, 135 hp at 10.5 gph",
    minimum: {
      curve: "Lycoming curve 13357 (OM Figure 3-39)",
      points: [
        [46, 5.78],
        [50, 6.33],
        [55, 6.95],
        [60, 7.61],
        [65, 8.26],
        [70, 8.84],
        [72, 9.06],
        [74, 9.4],
        [75, 9.7],
        [76, 9.91],
        [77, 10.26],
        [78, 10.86],
        [79, 11.29],
        [80, 11.62],
        [85, 12.53],
        [90, 13.26],
        [95, 13.96],
        [100, 14.85],
      ],
    },
  },

  fuelSystem: {
    kind: "carburetor",
    unit: "Marvel-Schebler MA-4-5", // OM Table 1 p. 1-3; single-barrel float type, manual mixture, idle cut-off (p. 1-2)
    inletPsi: { min: 0.5, desired: 3.0, max: 8.0, src: `${OM} p. 3-10 (inlet to carburetor)` },
    maxDropF: 70, // OM p. 3-8: "may drop as much as 70°F below the temperature of the incoming air"
    maxDropSrc: `${OM} p. 3-8`,
    bowlLb: 0.6,
    idleLbH: 12.5,
    accelLb: 0.0012,
    primeLb: 0.0004,
    heatRiseC: 50,
    iceKg: 0.1,
    iceCapture: 0.5,
  },

  limits: {
    rpmMax: { value: 2700, unit: "rpm", src: `${OM} p. 2-1, p. 3-12` },
    idleRpm: {
      min: 600,
      max: 700,
      assumed: true,
      src: `${OM} p. 5-4 (idle at the airframe manufacturer's recommended rpm; none given here)`,
    },
    oilPressMinIdle: { value: 25, unit: "psi", src: `${OM} p. 3-12 (idling)` },
    oilPressNormal: { min: 55, max: 95, unit: "psi", src: `${OM} p. 3-12 (rear, normal operation)` },
    oilPressMaxStart: { value: 115, unit: "psi", src: `${OM} p. 3-12 (start, warm-up, taxi, take-off)` },
    oilTempMax: { value: 245, unit: "°F", src: `${OM} p. 3-11 (oil inlet)` },
    oilTempBest: { value: 180, unit: "°F", src: `${OM} p. 3-11 (desired, above 30 °F ambient)` },
    chtMax: { value: 500, unit: "°F", src: `${OM} p. 3-12 (at the bayonet)` },
    chtBestAbove75: { value: 435, unit: "°F", src: `${OM} p. 3-6 (maximum service life, high performance cruise)` },
    chtBestAt75: { value: 400, unit: "°F", src: `${OM} p. 3-6 (maximum service life, economy cruise)` },
    magDropMax: { value: 175, unit: "rpm", src: `${OM} p. 3-5` },
    magDiffMax: { value: 50, unit: "rpm", src: `${OM} p. 3-5` },
    magCheckRpm: { min: 1800, max: 2000, src: `${OM} p. 3-5 (fixed-pitch propellers or no MAP gage)` },
    oilSumpQt: { value: 8, unit: "qt", src: `${OM} p. 3-11` },
    oilMinQt: { value: 2, unit: "qt", src: `${OM} p. 3-11 (minimum safe quantity)` },
    leanMaxPowerROP: {
      value: 150,
      unit: "°F",
      src: `${OM} p. 3-6 (maximum power cruise: never leaner than 150 °F rich of peak)`,
    },
  },

  oil: {
    thermostatF: 180, // assumption: the OM gives no thermostat setting (the cooler is optional, Figure 7-3)
    thermostatAssumed: true,
    pistonCoolingJets: false, // the OM's description (p. 1-2) has no piston-cooling oil jets
  },

  accessories: {
    starterRatio: 16.556, // OM p. 2-7
    alternatorRatio: 3.2, // OM p. 2-7
    magnetoRatio: 1.0, // OM p. 2-7
    tachRatio: 0.5, // OM p. 2-7
    governorRatio: 0.895, // OM p. 2-7, front-mounted governor (assumed: the OM doesn't say which the A1D uses)
    rotation: "Clockwise, viewed from the rear", // OM p. 2-1
    magnetos: "Bendix S4LN-200 (left, retard breaker), S4LN-204 (right)", // OM Table 1 p. 1-3
    weightLb: 289, // OM p. 2-8, -A1D
  },

  propeller: {
    name: "Hartzell HC-C2YK-1B/7666A-2",
    diameterIn: 74,
    blades: 2,
    src: "1968 M20C Owner's Manual (as cited in aircraft/m20c/parts/engine.ts)",
    // published: 13° low to 29° high at the 30 in station; the model uses them as its reference blade angles
    fineDeg: 13,
    coarseDeg: 29,
    governorMinRpm: 2000,
    inertia: 2.6,
    cpScale: 1.6,
    inducedInflow: true,
  },

  calibration: {
    idleArea: 0.03,
    lambdaBestPower: 0.85,
    lambdaFullRich: 0.78,
    peakEgtPower: 0.965,
    singlePlug: 0.93,
    egtBase: 1000,
    egtGain: 550,
    // a carburetor's charge reaches the cylinders less evenly than injected fuel
    fuelTrim: [1.03, 0.97, 1.02, 0.98],
    coolingTrim: [1.04, 1.0, 0.97, 0.99],
    chtRise: 400,
    chtTau: 150,
    oilRise: 165,
    oilTau: 270,
    oilPressPerRpm: 52.8,
    oilRelief: 78,
  },

  // The scene's parts are drawn for every engine and its notes cite the IO-390's manual; these replace them with the
  // O-360 OM's own words (keys are the default part names, "#" for a number).
  parts: {
    "Crankcase, right half": {
      note: "Two reinforced aluminium alloy castings fastened together by studs, bolts and nuts and joined without a gasket; the main bearing bores take precision-type inserts (OM p. 1-1).",
    },
    "Crankcase, left half": {
      note: "Two reinforced aluminium alloy castings fastened together by studs, bolts and nuts (OM p. 1-1).",
    },
    "Crankcase bolts": { note: "Studs, bolts and nuts hold the two halves together (OM p. 1-1)." },
    "Accessory housing": {
      note: "Aluminium casting fastened to the rear of the crankcase and the top rear of the sump: houses the oil pump and the accessory drives (OM p. 1-2).",
    },
    "Oil sump": {
      note: "Holds the oil and carries the drain plug, the oil suction screen, the carburetor's mounting pad, the intake riser and the intake pipe connections (OM p. 1-2).",
    },
    "Oil filter": {
      note: "External full-flow oil filter, where fitted; an engine without one has an oil pressure screen instead (OM p. 4-3).",
    },
    "Oil pump": {
      note: "Inside the accessory housing; the OM calls it an impeller type pump (p. 1-3). Drawn here as a pair of gears.",
    },
    "Oil pump gears": {
      note: "Drawn as two meshing gears carrying oil from the suction side to the pressure side; the OM describes the pump only as impeller type (p. 1-3).",
    },
    "Oil suction screen": {
      note: "Strains the oil on its way from the sump to the pump; removed, checked for metal particles and cleaned at each 100-hour inspection (OM p. 5-5).",
    },
    "Suction screen plug": { note: "Removed to take out the suction screen (OM p. 5-5)." },
    "Oil sump drain plug": { note: "In the oil sump (OM p. 1-2)." },
    "Oil level gage tube": {
      note: "Oil filler and level gage, the dipstick: check the level before the first flight of the day (OM p. 4-2).",
    },
    "Filtered oil line": {
      note: "From the filter into the crankcase's oil galleries, which feed the bearings and the propeller governor.",
    },
    "Cylinder # barrel": {
      note: "Deep integral cooling fins; the inside is ground and honed. Head and barrel are screwed and shrunk together (OM p. 1-1).",
    },
    "Cylinder # head": {
      note: "Aluminium alloy casting with a fully machined combustion chamber; the rocker boxes are cast integral with it (OM p. 1-1). Tinted here by its cylinder head temperature.",
    },
    "Intake port": { note: "Intake pipe flange." },
    "Spark plug, cylinder # top": {
      note: "Dual ignition: two plugs per cylinder, fired by two Bendix magnetos (OM p. 1-3); each magneto fires one plug in every cylinder.",
    },
    "Spark plug, cylinder # bottom": {
      note: "Dual ignition: two plugs per cylinder (OM p. 1-3). If the plugs foul, rotate the bottom plugs to the top every 50 hours (OM p. 4-2).",
    },
    "Main bearings": { note: "Precision-type inserts in the crankcase's main bearing bores (OM p. 1-1)." },
    Crankshaft: {
      note: "Chrome nickel molybdenum steel forging with nitrided bearing journals (OM p. 1-1). The A1D's has no pendulum counterweights: only models with a 6 in the suffix do (OM p. 1-3).",
    },
    "Propeller flange": {
      note: "Bolts the propeller to the crankshaft; for a constant-speed propeller the governor's oil goes to the hub (OM Figure 7-4 shows the oil line to the propeller).",
    },
    "Starter ring gear": {
      note: "The starter's pinion engages it to crank the engine. Drawn with 149 teeth against a 9-tooth pinion, which gives the 16.556:1 starter drive ratio (OM p. 2-7); the tooth counts themselves are inferred.",
    },
    "Alternator drive pulley": {
      note: "Belt drive to the alternator: 3.20 alternator turns per crankshaft turn (OM p. 2-7).",
    },
    "Piston, cylinder #": {
      note: "Machined from aluminium alloy, with three or four rings depending on the cylinder assembly (OM p. 1-2).",
    },
    "Piston pin": { note: "Full floating type, with a plug in each end (OM p. 1-2)." },
    "Connecting rod, cylinder #": {
      note: "H-section alloy steel forging: replaceable bearing inserts at the crankshaft end, a bronze bushing at the piston end, and two bolts and nuts through each cap (OM p. 1-2).",
    },
    Camshaft: {
      note: "Above and parallel to the crankshaft; it works hydraulic tappets, which operate the valves through push rods and rockers (OM p. 1-1). One lobe per valve, at half crankshaft speed.",
    },
    "Governor drive gear": {
      note: "Drives the propeller governor at 0.895:1, the OM's front-mounted governor drive (p. 2-7). The OM also lists a rear-mounted one (0.866:1) and doesn't say which the A1D uses; front is assumed.",
    },
    "Rocker shaft": { note: "Full-floating steel shaft the rockers pivot on inside the rocker box (OM p. 1-1)." },
    "Valve spring": {
      note: "Bears against a hardened steel seat and is held on the valve stem by split keys (OM p. 1-1); closes the valve.",
    },
    "Left magneto (retard breaker)": {
      note: "Bendix S4LN-200, a retard-breaker magneto (OM Table 1, pp. 1-3, 1-5): it alone fires, late, while the starter cranks.",
    },
    "Right magneto": { note: "Bendix S4LN-204 (OM Table 1, p. 1-3); grounded while the starter cranks." },
    "Magneto drive gear": {
      note: "Meshes with the camshaft gear: half as many teeth, so the magneto turns at crankshaft speed (magneto drive ratio 1.000:1, OM p. 2-7).",
    },
    "Ignition harness": {
      note: "Shielded leads from each magneto to one plug in every cylinder; check its clamps and terminals every 50 hours (OM p. 4-3).",
    },
    "Induction plenum": {
      name: "Intake riser",
      note: "Center zone induction: the riser is part of the oil sump and submerged in oil, which vaporizes the fuel more evenly and helps cool the oil (OM p. 1-2). Drawn schematically under the sump.",
    },
    "Tuned induction runners": {
      name: "Intake pipes",
      note: "Individual intake pipes carry the fuel–air mixture from the riser to each cylinder (OM p. 1-2).",
    },
    "Exhaust pipe, cylinder #": {
      note: "The exhaust system belongs to the airframe and is drawn to show where the gas goes; the pipe glows with this cylinder's exhaust gas temperature.",
    },
    Starter: { note: "Drive ratio 16.556:1 (OM p. 2-7). Engaged while the switch is held at START." },
    Alternator: { note: "Belt-driven from the pulley behind the starter ring gear at 3.20:1 (OM p. 2-7)." },
    "Alternator belt": { note: "3.20:1 alternator drive ratio (OM p. 2-7)." },
    "Propeller governor": {
      note: "Sets propeller pitch to hold the selected rpm. Drawn on the front of the crankcase, driven at 0.895:1 (OM p. 2-7); the OM lists front and rear governor drives without saying which the A1D uses.",
    },
  },
};
