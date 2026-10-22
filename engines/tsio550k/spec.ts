/**
 * Continental TSIO-550-K as installed in the Cirrus SR22T. Every published number cites its page: the SR22T POH/AFM
 * P/N 13772-007 Reissue A (POH), the Cirrus AMM 13773-002 Rev 7 (AMM, chapter and PDF page) and the Continental
 * TSIO-550 Permold Series Engine Maintenance and Overhaul Manual M-18, 21 September 2017 (M-18). Where they disagree
 * the POH wins, then the AMM, then Continental (SOURCES.md lists every conflict). Chart values were digitized from
 * M-18 Figures 2-36 and 2-37 (see SOURCES.md for how, and the reading uncertainty). `calibration`, `turbo`,
 * `fuelSystem.fullRichLambda`, the `induction` constants, the propeller's aerodynamics, the starter, the oil pickup and
 * the nozzle curve are model constants fitted on the running engine to reproduce the documented points (SOURCES.md,
 * "Not published: chosen to fit"): they are not Continental or Cirrus data.
 */
import type { EngineSpec } from "../types";

const POH = "POH 13772-007";
const AMM = "AMM 13773-002 Rev 7";
const M18 = "Continental M-18";

export const TSIO550K: EngineSpec = {
  id: "tsio550k",
  name: "TSIO-550-K",
  model: "Continental TSIO-550-K", // POH 1-7, 7-31
  ref: "Engine simulation · Continental M-18 · Cirrus SR22T POH",
  lead:
    "A 550 cu in, six-cylinder, horizontally opposed, air-cooled engine with continuous-flow fuel injection, twin " +
    "turbochargers and intercoolers: 315 bhp at 2,500 rpm (POH 2-6, 7-31). The turbochargers hold 36.0 in.Hg for " +
    "every takeoff (POH 4-14, 4-17). The -K is the engine of the Cirrus SR22T.",
  // `doc` is the airframe POH, not Continental's manual: the POH governs this engine's limits and procedures (header
  // comment), and every page reference on the page is a POH page. `refs` reuse the pages the limits and cruise points
  // below cite.
  doc: "POH",
  refs: {
    start: "POH 4-12",
    idle: "POH 4-15",
    magCheck: "POH 4-15",
    cruise: "POH 5-32 to 5-34",
    tables:
      "Cirrus SR22T POH 13772-007, Section 2 (pp. 2-6, 2-9, 2-10, 2-19), and Continental M-18, Tables 2-1 to 2-9 " +
      "(pp. 2-24 to 2-30).",
    leaning: "POH 4-22",
    altAirOpen: "POH 3A-11 (ALT AIR OPEN caution); 7-37",
    relief: "POH 3-29, 3-30 (Overboost / Pressure Relief Valve)",
    lossOfMap: "POH 3-27, 3-28 (Unexpected Loss of Manifold Pressure)",
    manPressure: "POH 3-29, 3A-9 (MAN PRESSURE); 4-17",
    sensorFailure: "POH 3-31 (EGT, TIT or CHT Temperature Sensor Failure)",
  },
  modelNotes: [
    "Power follows Continental's sea-level chart (M-18 Fig 2-37): full rich above 30.5 in.Hg, best power at or below; " +
      "1 % per 6 °F of compressor-inlet temperature (Table 2-2 note 1). No altitude chart is published for the -K.",
    "The turbochargers are a quasi-steady power balance with a spool lag. No compressor or turbine map is published, " +
      "so the turbine speed shown is illustrative.",
    "Percent power here is brake hp ÷ 315. The airplane's display uses its own algorithm (POH 7-36).",
    "Turbo, controller and calibration constants are fitted to the POH and AMM points listed in SOURCES.md. They are " +
      "not Continental or Cirrus data.",
  ],
  sources: [
    {
      title:
        "Cirrus SR22T Pilot's Operating Handbook and FAA Approved Airplane Flight Manual, P/N 13772-007, Reissue A",
      note: "Limitations (2-6, 2-9, 2-10, 2-19), normal procedures (4-12 to 4-23), cruise performance (5-32 to 5-34), engine and fuel system description (7-31 to 7-41). The airplane's documents govern.",
    },
    {
      title: "Cirrus Airplane Maintenance Manual, Models SR22 and SR22T, P/N 13773-002, Revision 7",
      note: "61-20 (governor), 71-60 (air intakes), 73-20 (fuel setup, Figure 73-20-2), 74-00 (ignition), 79-00 (oil), 81-20 (turbocharger); cited by chapter and PDF page.",
    },
    {
      title:
        "Continental Motors TSIO-550 Permold Series Engine Maintenance and Overhaul Manual (M-18), 21 September 2017",
      note: "Tables 2-1 to 2-9 (pp. 2-24 to 2-30), Figures 2-36 to 2-41 (pp. 2-44 to 2-49), installation drawing Figure 5-34 (p. 5-54). Engine items only, where Cirrus is silent.",
    },
    {
      title: "Propeller: Hartzell PHC-J3Y1F-1N/N7605(B)",
      note: "Or PHC-J3Y1F-1N/N7605C(B); both three composite blades, 78.0 in (POH 1-7, 2-8). The governor is factory-set to 2,500 rpm with no propeller control (POH 7-32, 7-39; AMM 61-20).",
    },
  ],

  geometry: {
    // M-18 2-1.2 Figure 2-3 (p. 2-3): viewed from the rear, right 1-3-5 and left 2-4-6, No. 1 and No. 2 rearmost.
    // Crankpins follow from the 1-6-3-2-5-4 firing order at 120° (each cylinder fires at top centre when its pin
    // points at it). x: Figure 5-34 (p. 5-54) puts #1 5.42 in and #2 7.89 in forward of the accessory face with a
    // 7.31 in pitch on both banks; x = (station − 16.25 in) × 0.0254, origin at mid-length (Figure 5-33's 32.50 in).
    cylinders: [
      { n: 1, side: "R", pin: 90, x: -0.2751 },
      { n: 2, side: "L", pin: 270, x: -0.2123 },
      { n: 3, side: "R", pin: 210, x: -0.0894 },
      { n: 4, side: "L", pin: 30, x: -0.0267 },
      { n: 5, side: "R", pin: 330, x: 0.0963 },
      { n: 6, side: "L", pin: 150, x: 0.159 },
    ],
    firingOrder: [1, 6, 3, 2, 5, 4], // M-18 Table 2-1 p. 2-24; 2-1.2 p. 2-3
    boreIn: 5.25, // M-18 Table 2-1
    strokeIn: 4.25, // M-18 Table 2-1
    displacementIn3: 552, // M-18 Table 2-1 (the POH's "550" is the model name)
    compressionRatio: 7.5, // M-18 Table 2-1
    rodIn: 6.875, // not published: drawing and pressure-trace kinematics only
    envelopeIn: { length: 39.2, width: 42.4, height: 34.0 }, // M-18 Table 2-8 p. 2-30 (width across the intercoolers)
    valves: { ivo: 20, ivc: 55, evo: 55, evc: 20 }, // not published: animation and pressure trace only
    // M-18 2-2.2.1 p. 2-6: two sixth-order counterweights on the No. 2 cheek hangers, a fifth and a fourth on No. 5
    pendulumCounterweights: true,
  },

  ignition: {
    advanceBTC: 24,
    advanceSrc: `${M18} Table 2-1 p. 2-24: 24° BTC ± 1°`,
    // START "energizes the starter and activates both magnetos" (POH 7-37); each magneto has an impulse coupling that
    // holds the spark to top centre (AMM 74-00 PDF 2604). `retardMag` is not used with `startMags: "both"`.
    startMags: "both",
    retardMag: "R",
    startRetardATC: 0,
    // POH 7-37: the right magneto fires the lower right and upper left plugs, the left the lower left and upper right
    // (the AMM 74-00 and M-18 Figure 2-19 wiring is the reverse; the POH governs).
    topPlugMag: { 1: "L", 3: "L", 5: "L", 2: "R", 4: "R", 6: "R" },
    minStartRpm: 50, // not published: the model's cranking threshold
  },

  rating: {
    hp: 315,
    rpm: 2500, // POH 2-6 "315 bhp @ 2500 RPM"
    map: 36.0, // POH 4-14, 4-17: 36.0 in.Hg for all takeoffs (M-18 Table 2-2 rates the engine at 37.5)
    // POH 5-32 to 5-34 cruise performance: % of 315 hp, lean of peak at the target fuel flow, 2,000–25,000 ft.
    cruise: [
      { label: "Cruise 85 %", pct: 85, hp: 267.75, rpm: 2500, gph: 18.3, mixture: "lean of peak" },
      { label: "Cruise 80 % (20,000–25,000 ft)", pct: 80, hp: 252, rpm: 2500, gph: 17.4, mixture: "lean of peak" },
      { label: "Cruise 75 %", pct: 75, hp: 236.25, rpm: 2500, gph: 16.4, mixture: "lean of peak" },
      { label: "Cruise 65 %", pct: 65, hp: 204.75, rpm: 2500, gph: 14.6, mixture: "lean of peak" },
      { label: "Cruise 55 %", pct: 55, hp: 173.25, rpm: 2500, gph: 12.7, mixture: "lean of peak" },
    ],
  },

  // Continental's chart is curved and has no altitude panel (M-18 2-3.3.5 prints Figures 2-36 and 2-37 only).
  performance: {
    kind: "continental",
    curve: "Continental M-18 Figure 2-37, TSIO-550-K & N Sea Level Performance (p. 2-45)",
    // Corrected brake hp against absolute dry manifold pressure, read at 300 dpi against the chart's grid: ±1 hp on
    // 2300 and 2500. The 2400 line runs under the hatching above 29 in.Hg and under text at 24: the points at 24, 30,
    // 32, 34 and 36 in.Hg are midline estimates, ±3 hp.
    lines: [
      {
        rpm: 2300,
        points: [
          [20, 136.0],
          [21, 146.3],
          [22, 156.5],
          [23, 166.4],
          [24, 176.1],
          [25, 185.5],
          [26, 194.7],
          [27, 203.7],
          [28, 212.3],
          [29, 220.7],
          [30, 229.0],
          [30.5, 232.7],
          [31, 236.3],
          [32, 244.0],
          [33, 251.0],
          [34, 258.8],
          [35, 266.1],
          [36, 272.5],
          [36.5, 275.5],
        ],
      },
      {
        rpm: 2400,
        points: [
          [20, 146.6],
          [21, 157.2],
          [22, 167.8],
          [23, 178.3],
          [24, 188.2],
          [25, 198.2],
          [26, 208.1],
          [27, 217.7],
          [28, 226.8],
          [29, 236.1],
          [30, 245.0],
          [32, 261.5],
          [34, 277.3],
          [36, 292.1],
          [36.5, 297.9],
        ],
      },
      {
        rpm: 2500,
        points: [
          [20, 156.2],
          [21, 167.9],
          [22, 179.3],
          [23, 190.4],
          [24, 201.3],
          [25, 211.9],
          [26, 222.3],
          [27, 232.4],
          [28, 242.2],
          [29, 251.7],
          [30, 261.0],
          [30.5, 265.7],
          [31, 270.4],
          [32, 279.1],
          [33, 287.6],
          [34, 295.8],
          [35, 303.9],
          [36, 311.7],
          [36.5, 315.1],
        ],
      },
    ],
    fullRichAboveInHg: 30.5, // Figure 2-37 hatch "Full Rich Operation Only"; POH 4-22 leaning only at ≤ 30.5
    blendInHg: 1, // not published: keeps power continuous across the full-rich / best-power switch
    tempPctPerF: 1 / 6, // M-18 Table 2-2 note 1: 1 % per 6 °F of compressor inlet air temperature
    // Not published: the manifold-air temperature the chart is read at, the model's own at the rated sea-level standard
    // point (so that point is unchanged). The running engine's chart power then scales with its charge's density: lean
    // of peak the power follows the fuel flow at every altitude (POH 4-22, 5-32 to 5-34), however hot the intercooled
    // charge.
    chargeRefC: 24.1,
  },

  fuelFlow: {
    kind: "continental",
    curve: "Continental M-18 Figure 2-36, TSIO-550-K & N Fuel Flow vs. Sea Level Standard Brake Horsepower (p. 2-44)",
    // Figure 2-36, [bhp, lb/h], read at 300 dpi (±0.5 lb/h). The chart includes return flow (M-18 Table 2-4). Best
    // Power and Best Economy are drawn from 173 to 262 bhp only; the Best Power point at 250 bhp is approximate.
    richFullRich: [
      [173, 93.4],
      [180, 96.3],
      [190, 101.6],
      [200, 107.3],
      [205, 110],
      [220, 118.8],
      [230, 124.3],
      [236, 128],
      [250, 135.4],
      [262, 143],
      [270, 149.3],
      [280, 158.6],
      [290, 170.7],
      [300, 186.5],
      [310, 207.4],
      [315, 220],
    ],
    leanFullRich: [
      [173, 83.4],
      [180, 86.3],
      [190, 91.6],
      [200, 97.3],
      [205, 100],
      [220, 108.8],
      [230, 114.2],
      [236, 118],
      [250, 125.6],
      [262, 133],
      [270, 139.3],
      [280, 148.6],
      [290, 160.7],
      [300, 176.5],
      [310, 197.5],
      [315, 210],
    ],
    bestPower: [
      [173, 78.8],
      [180, 81],
      [190, 84.5],
      [200, 88.1],
      [205, 90.2],
      [220, 96],
      [230, 100],
      [236, 103],
      [250, 108],
      [262, 114],
    ],
    bestEconomy: [
      [173, 67.4],
      [180, 69.9],
      [190, 73.4],
      [200, 77],
      [205, 79],
      [220, 83.5],
      [230, 86.7],
      [236, 89],
      [250, 92.4],
      [262, 96],
    ],
  },

  fuelSystem: {
    kind: "continental",
    unit:
      "Continental continuous-flow injection: engine-driven pump with mixture valve, throttle-body metering valve, " +
      "manifold valve, six air-bled nozzles (POH 7-38; M-18 2-1)",
    // Not published: a square-root law through the rated nozzle pressure at the model's settled full-power flow when it
    // was anchored (37.23 GPH at 6.0 lb/gal = 223.4 lb/h, inside the AMM Figure 73-20-2 band); full power settles at
    // 36.9 GPH and reads 14.3 psid, inside M-18 Table 2-4's 14.2–14.8. Total engine flow against metered nozzle
    // pressure.
    nozzle: {
      curve: "Square-root law through 14.5 psid at 223 lb/h (fit, not Continental data)",
      points: [
        [0, 0],
        [0.5, 41.5],
        [1, 58.7],
        [2, 83.0],
        [4, 117.3],
        [6, 143.7],
        [8, 165.9],
        [10, 185.5],
        [12, 203.2],
        [14, 219.5],
        [14.5, 223.4],
        [16, 234.6],
      ],
    },
    // Not published: [air fraction of rated (fuel.ts ratedAirLbH), λ at full rich]. The turbocharged -K meters on
    // throttle angle and deck pressure (engines/model/turbo.ts turboMetering), so the fraction is the air at the MAP
    // the throttle would give from the rated deck. With `calibration.ve`, sea-level full rich at 2,500 rpm burns inside
    // Figure 2-36's band (lean to rich full rich, M-18 p. 2-44) at 173, 205, 236 and 262 bhp (air fractions about 0.64
    // to 0.95). The rated point, 0.582 at 1, holds at full throttle at every altitude: 36.9 GPH at 35.8 in.Hg, inside
    // AMM Figure 73-20-2's band (PDF 2592), and the POH 5-28 climb's 36.08 GPH, falling with the deck above the
    // critical altitude (POH 5-29). Flat beyond the ends.
    fullRichLambda: [
      [0.64, 0.8],
      [0.74, 0.78],
      [0.855, 0.768],
      [0.946, 0.76],
      [1.0, 0.582],
    ],
    // AMM 73-20 PDF 2589 (z) 7.0–9.0 psi at 600 rpm, (x) 21.0–24.5 psi at 2,500 (M-18 Table 2-4 gives 20.5–28.5; the
    // AMM governs).
    pumpPsi: { idle: [7.0, 9.0], rated: [21.0, 24.5] },
    boostPsi: [4, 6], // POH 7-41: BOOST "a continuous 4-6 psi boost"
    highBoost: { mapInHg: 24, altFt: 10000, belowRpm: 500 }, // POH 7-41 lockout (software 2647.M4 or later)
    nozzleRatedPsid: 14.5, // M-18 Table 2-4: 14.2–14.8 psid at 2,500 rpm, upper-deck referenced
  },

  induction: {
    altAir: "automatic", // POH 7-37: the door opens by engine suction; no pilot control
    // Not published: cowl air over outside air. With the door open at 10,000 ft and 75 % power it costs 3.4 % with MAP
    // 0.27 in.Hg higher, from a settled point (POH 3A-11: 3–5 %). The intercoolers take most of the warmer air's heat
    // out before the charge, whose density sets the power (`performance.chargeRefC`).
    altAirDeltaC: 23,
    // Not published: the obstructed filter of the "filter blocked" failure, as a fraction of the throttle body's
    // wide-open area. The door opens at full power (about 5 inH₂O at 10,000 ft, 120 KIAS) and closes again once power
    // is reduced to 30.5 in.Hg (about 1 inH₂O; POH 3A-11 "likely close the alternate air door").
    filterBlockedArea: 0.85,
    // Not published: the suction that overcomes the strip of magnets holding the flap (AMM 71-60). The starting
    // value kept: with `filterBlockedArea` the door opens at full power and closes at 30.5 in.Hg (POH 3A-11, T-42),
    // and it stays shut in every unblocked run (the relief-valve and door test).
    doorOpenInH2O: 4,
    // Not published: open throttle-body loss at rated flow. With `turbo` it sets the deck the controller holds for
    // 36.0 in.Hg at rated (T-1; deck − MAP 0.5 ± 0.1) and sizes the throttle (induction.ts).
    throttleLossInHg: 0.5,
    ramEta: 0.7, // not published: the model's default inlet recovery
  },

  // Not published: no compressor or turbine map exists for the -K. Fitted on the running engine (see SOURCES.md,
  // "Not published: chosen to fit"): 36.0 in.Hg at sea level static and in the 120 KIAS climb to 17,000 ft (POH 4-14,
  // 4-17), the gate shut and MAP falling from about 21,000 ft (M-18 Table 2-2 critical altitude 18,000), 30.9 in.Hg at
  // 25,000 ft (POH 5-29 climb fuel flow, 2-19 maximum altitude), cold oil raising MAP 0.1 in.Hg (POH 4-17). The
  // turbines are sized for a reserve: the gate about half open at sea level, so a takeoff at ISA +30 °C still holds
  // 36.0 in.Hg to 10,000 ft (POH 4-14 "for all takeoffs", 5-20) and an ISA +30 °C climb keeps most of its power to
  // 18,000 ft (POH 5-26).
  turbo: {
    count: 2,
    etaCompressor: 0.75,
    etaTurbine: 0.75,
    // Compressor map edge, [pressure ratio, fraction of etaCompressor]: no map is published. With a constant
    // efficiency the gate-closed turbocharger has no stable point between idling and running away; this edge gives
    // the critical altitude (M-18 Table 2-2) and the 25,000 ft manifold pressure above.
    compressorEta: [
      [2.0, 1.0],
      [2.3, 0.85],
      [2.6, 0.62],
      [3.2, 0.52],
      [5.0, 0.1],
    ],
    turbineArea: 0.65e-3,
    spoolTauS: 1.5,
    rpmRef: 105000,
    prRef: 2.45,
    // A 14–30 psi actuator band and a negative controller slope hold MAP through the climb and against warm-oil
    // pressure (36.0 ± 0.2 from 150 to about 225 °F oil, POH 3-29; T-8) while 100 °F oil still raises it (POH 4-17);
    // see turbo.ts. The wide band and an area scaled to the turbines keep the regulating gate from hunting at full
    // throttle.
    wastegate: { pCrackPsi: 14, pFullPsi: 30, tauS: 0.7, area: 1.5e-3 },
    // gainFalloff: not published; the fitted metering-port flow restriction leaves the 2.8 full-throttle gain intact,
    // then lowers it once the sloped set point rises more than 0.5 in.Hg above c0. At 30.5 in.Hg cruise this gives an
    // effective gain near 0.5 and settles MAP inside 0.05 in.Hg from 10,000 to 25,000 ft (SOURCES.md).
    // misadjustInHg: the "controller misadjusted" failure's set-point shift. The sloped controller multiplies it about
    // threefold at full throttle, so 0.35 puts sea-level full power at about 37.0 in.Hg with warm oil (37.3 with 100 °F
    // oil): inside the MAN PRESSURE caution band, relief valve shut, the "maintenance adjustment" case of POH 3-29, 3A-9
    controller: {
      c0: 0.45,
      c1: -0.3,
      deckRef: 36.5,
      kBleed: 2.8,
      b0: 0.34,
      ratio: 3,
      misadjustInHg: 0.35,
      gainFalloff: { startInHg: 0.5, perInHg: 5.75 },
    },
    // ε at the top of 0.5–0.6 (M-18 Figure 2-39 p. 2-47), cooling air at outside temperature: 76 °F MAT at rated (at
    // most 130 °F, M-18 Table 2-6)
    intercooler: { effectiveness: 0.6, dpInHgRated: 0.3, coolRiseC: 0 },
    // Deck crack above every normal case (cold-oil 37.0 in.Hg MAP included; the highest normal deck is about 37.0).
    // The valve's area keeps a seized-closed wastegate surging rather than holding the valve open with MAP climbing
    // past it: from ISA −30 °C to ISA, full rich to λ ≈ 0.8, MAP cycles between about 38.0 and 39.1 in.Hg inside the
    // MAN PRESSURE warning band (POH 3-29, 3-30: "Engine will be adequately protected by the pressure relief valve").
    // Reducing power to 30.5 in.Hg lowers the relief duty, as POH 3-30's NOTE says ("reducing the energy available to
    // drive the turbine"), and may not end the surge (its "If noticeable surging is present"); at 24 in.Hg the valve
    // reseats (fit). The AMM 81-20 "35 inHg" is below the normal 36.0 and is not used.
    overboost: { crackInHg: 39.5, hystInHg: 1.0, area: 4.0e-3 },
    // Not published: the failure leak areas, m². inductionArea, about one induction duct's section: a split coupling at
    // the 10,000 ft cruise point brings MAP to within 1 in.Hg of normally aspirated (POH 3-27 cause 1). The model's
    // compressor has no choke line, so it is the area, not a flow limit, that sets how far the boost falls.
    // intercoolerArea per leaking side: larger than the controller's reserve at that cruise point, so MAP falls, less
    // than with a split coupling. deadCompressorArea: the effective stopped-compressor return path, including its
    // intercooler and duct losses, refitted with recirculation and the working path's rated-flow reference; the passage runs
    // from the deck back to its air box, so the working one cannot hold the cruise deck (POH 3-28 cause 4, "a sudden
    // loss of manifold pressure"). exhaustArea, ahead of the turbines, is illustrative (POH 3-28 cause 2).
    leaks: { inductionArea: 3e-3, intercoolerArea: 1.4e-3, exhaustArea: 8e-4, deadCompressorArea: 8.41287e-4 },
    // bearingHeatK: hp per turbocharger at rpmRef (∝ N²); bleedPsi: oil-pressure drop the turbochargers' supply takes
    // at rated rpm. Not published; small against the engine's own oil heat and pressure (AMM 79-00 PDF 2764).
    // leakQtPerMin: the oil an engine oil leak or a failed turbocharger's bearing loses, not published: from the POH
    // 4-8 minimum of six quarts, oil pressure falls about 5–7 min after a turbocharger fails, the MAP loss coming first
    // (POH 3-28 cause 4: "later observes declining oil pressure").
    oil: { bearingHeatK: 1.0, bleedPsi: 2, leakQtPerMin: 0.5 },
  },

  limits: {
    rpmMax: { value: 2500, unit: "rpm", src: `${POH} 2-6` },
    idleRpm: { min: 600, max: 750, src: `${POH} 4-15 (${AMM} 73-20 PDF 2589 sets 700 ± 25)` },
    oilPressMinIdle: { value: 10, unit: "psi", src: `${POH} 2-6, 2-9` },
    oilPressNormal: { min: 30, max: 60, unit: "psi", src: `${POH} 2-9; ${M18} Table 2-3 (at the oil cooler adapter)` },
    oilPressMaxStart: { value: 100, unit: "psi", src: `${POH} 2-6, 2-9; ${M18} Table 2-3 (cold oil)` },
    oilTempMax: { value: 240, unit: "°F", src: `${POH} 2-6, 2-9` },
    oilTempBest: {
      value: 180,
      unit: "°F",
      src: `${POH} 7-36 (cooler bypass below about 180 °F); ${AMM} 79-00 PDF 2764`,
    },
    chtMax: { value: 460, unit: "°F", src: `${POH} 2-9; 4-19 ("Maximum CHT value remains 460 ºF")` },
    chtBestAbove75: { value: 420, unit: "°F", src: `${POH} 4-19, 2-9 (do not continuously exceed 420 °F)` },
    chtBestAt75: { value: 420, unit: "°F", src: `${POH} 4-22 (keep cylinders below 420 °F in cruise)` },
    magDropMax: { value: 150, unit: "rpm", src: `${POH} 4-15` },
    magDiffMax: { value: 75, unit: "rpm", src: `${POH} 4-15 (${M18} 7-3.3 gives 50; the POH governs)` },
    magCheckRpm: { min: 1700, max: 1700, src: `${POH} 4-15 (run-up at 1700 rpm)` },
    oilSumpQt: { value: 8, unit: "qt", src: `${POH} 1-8` },
    oilMinQt: { value: 6, unit: "qt", src: `${POH} 4-8 ("should not be operated with less than six quarts")` },
    starterMaxS: { value: 10, unit: "s", src: `${POH} 4-12 (then 20 s to cool)` },
    oilTempMinTakeoff: { value: 75, unit: "°F", src: `${POH} 2-6 (${M18} Table 2-3 gives 100 °F; the POH governs)` },
    chtMinDescent: { value: 240, unit: "°F", src: `${POH} 4-23` },
    leanMaxMap: { value: 30.5, unit: "inHg", src: `${POH} 4-22 (cruise leaning only at 30.5 in.Hg or less)` },
    mapMinAbove: { map: 15, altFt: 18000, src: `${POH} 2-6` },
    titTransient: { value: 1850, seconds: 30, src: `${M18} Table 2-1 (1750 °F continuous)` },
    turbineRpmMax: {
      points: [
        [1200, 132000],
        [1440, 132000],
        [1750, 122000],
      ],
      src: `${M18} Figure 2-41 p. 2-49 (TA3606; read ±500 rpm)`,
    },
    exhaustBackPressureMax: { value: 2.5, unit: "inHg", src: `${M18} Table 2-1` },
    maxAltFt: { value: 25000, unit: "ft", src: `${POH} 2-19` },
    startEngaged: { caution: 15, warning: 30, src: `${POH} 3A-10, 3-49` },
    oilPressCautionMinRpm: { value: 1000, unit: "rpm", src: `${POH} 3A-8 (OIL PRESS caution 10–30 psi)` },
  },

  // POH 2-9 "Engine Instrument Markings & Annunciations", row by row. Yellow is the caution column and red the warning
  // column where 2-9 prints a CAS name. An upper red band printed "> x" runs to the end of the scale and is
  // open-ended: a value above `from` is in it (oil pressure "> 100" sits at the end of its 0–100 scale).
  markings: [
    {
      gauge: "cht",
      scale: [100, 500],
      unit: "°F",
      bands: [
        { from: 240, to: 420, color: "green" },
        { from: 420, to: 460, color: "yellow", cas: "CHT", level: "caution" },
        { from: 460, to: 500, color: "red", cas: "CHT", level: "warning" },
      ],
      src: `${POH} 2-9`,
    },
    {
      gauge: "rpm",
      scale: [0, 3000],
      unit: "rpm",
      bands: [
        { from: 500, to: 2550, color: "green" },
        { from: 2550, to: 3000, color: "red", cas: "RPM", level: "warning" },
      ],
      src: `${POH} 2-9`,
    },
    {
      gauge: "egt",
      scale: [1000, 1800],
      unit: "°F",
      bands: [{ from: 1000, to: 1800, color: "green" }],
      src: `${POH} 2-9`,
    },
    {
      gauge: "map",
      scale: [10, 40],
      unit: "inHg",
      bands: [
        { from: 15, to: 36.5, color: "green" },
        { from: 36.5, to: 37.5, color: "yellow", cas: "MAN PRESSURE", level: "caution" },
        { from: 37.5, to: 40, color: "red", cas: "MAN PRESSURE", level: "warning" },
      ],
      src: `${POH} 2-9 (bands); the CAS name is ${POH} 3-29, 3A-9, which print no trigger: the band edges are used`,
    },
    {
      gauge: "oilP",
      scale: [0, 100],
      unit: "psi",
      bands: [
        { from: 0, to: 10, color: "red", cas: "OIL PRESS", level: "warning" },
        { from: 10, to: 30, color: "yellow", cas: "OIL PRESS", level: "caution" },
        { from: 30, to: 60, color: "green" },
        { from: 60, to: 100, color: "yellow" },
        { from: 100, to: 100, color: "red", cas: "OIL PRESS", level: "warning" },
      ],
      src: `${POH} 2-9 (the caution applies at or above 1000 rpm, ${POH} 3A-8)`,
    },
    {
      gauge: "oilT",
      scale: [75, 250],
      unit: "°F",
      bands: [
        { from: 100, to: 240, color: "green" },
        { from: 240, to: 250, color: "red", cas: "OIL TEMP", level: "warning" },
      ],
      src: `${POH} 2-9`,
    },
    {
      gauge: "pct",
      scale: [0, 100],
      unit: "%",
      bands: [{ from: 0, to: 100, color: "green" }],
      src: `${POH} 2-9`,
    },
    {
      gauge: "tit",
      scale: [1000, 1800],
      unit: "°F",
      bands: [
        { from: 1000, to: 1750, color: "green" },
        { from: 1750, to: 1800, color: "red", cas: "TIT", level: "warning" },
      ],
      src: `${POH} 2-9`,
    },
    {
      gauge: "ff",
      scale: [0, 45],
      unit: "GPH",
      bands: [],
      src: `${POH} 2-9/2-10 (Fuel: the green arc "dynamically changes based on engine parameters"; 4-17, 4-22)`,
    },
  ],

  envelope: { maxAltFt: 25000, maxTasKt: 220, maxOilQt: 8 }, // POH 2-19; 5-34 (largest table TAS); 1-8

  oil: {
    thermostatF: 180, // POH 7-36: the cooler is bypassed below about 180 °F; AMM 79-00 PDF 2764
    coolerFlowGpm: 7, // M-18 Figure 2-38 p. 2-46: the chart's 7 GPM oil-flow curve
    coolerMaxBtuMin: 650, // M-18 Figure 2-38: 7 GPM curve at its 2,000 cfm end, read ±15 Btu/min
    // M-18 Table D-19 p. D-30 (K and N): six crankcase oil squirt nozzles, not field replaceable (13-9.2 p. 13-24).
    // Approximate: M-18 names them squirt nozzles and does not say what they cool; `pistonCoolingJets` is the flag that
    // draws them.
    pistonCoolingJets: true,
    pickupQt: [2.5, 3.5], // not published: inside the 3.0–3.5 qt left of 8 at the usable 4.5–5.0 (M-18 Table 2-3)
  },

  accessories: {
    starterRatio: 48, // M-18 Table 2-9 p. 2-30
    alternatorRatio: 3, // M-18 Table 2-9 (gear-driven primary alternator, POH 7-31)
    magnetoRatio: 1.5, // M-18 Table 2-9
    tachRatio: 0.5, // M-18 Table 2-9 (optional pad; the SR22T reads rpm from the right magneto, POH 7-35)
    governorRatio: 1, // M-18 Table 2-9
    rotation: "To locate: not stated in the pages read",
    magnetos:
      "Two pressurized magnetos, an impulse coupling on each (POH 7-37; AMM 74-00). The -K options are CMI " +
      "S6RSC-25P (two), Champion (Slick) 6220 (two), or CM S6RN-201 and S6RN-205 (M-18 Table 2-1); the pair " +
      "Cirrus fits is to locate",
    weightLb: 522.8, // M-18 Table 2-8, dry ± 2.5 %
    starterTorque: 300, // not published: fitted to the POH 4-12 start (running within 10 s)
    starterFreeRpm: 380, // not published
  },

  propeller: {
    name: "Hartzell PHC-J3Y1F-1N/N7605(B)",
    diameterIn: 78,
    blades: 3,
    src: "SR22T POH 1-7, 2-8; governor 7-32, 7-39; AMM 61-20",
    control: "fixed", // POH 7-32: "No propeller control is required"; AMM 61-20: factory-set to 2500 RPM
    // Not published: the pitch range and the power-coefficient scale (three blades) are chosen so the governor holds
    // 2,500 rpm wherever the POH says it does (POH 4-17, 7-32, 7-39). The fine stop sits below the static full-power
    // blade angle (≈ 7°), so a static run-up governs 2,500 (POH 4-17 "approximately 2500"); the coarse stop sits above
    // the angle full throttle needs at 25,000 ft and POH 5-34's largest cruise TAS, 220 kt (≈ 47°), so the engine
    // never overspeeds.
    cpScale: 2.0,
    fineDeg: 5,
    coarseDeg: 50,
    governorMinRpm: 2500,
    inertia: 3.8, // not published: engine and propeller; above M-18 Table 2-7's propeller minimum (1.81 kg·m² at 700)
  },

  // Not published: fitted on the running engine to the points each comment names (SOURCES.md, "Not published: chosen
  // to fit").
  calibration: {
    // the idle stop: 700 ± 25 rpm at idle with the mixture as leaned for taxi (AMM 73-20 PDF 2589 (ab); POH 4-15)
    idleArea: 0.013,
    // the IO-390 value kept: Figure 2-36's 236 bhp best-power flow holds with it (T-14)
    lambdaBestPower: 0.85,
    // not read for this engine, which meters from `fuelSystem.fullRichLambda`: its rated end, 0.582, to two places
    lambdaFullRich: 0.58,
    // power at peak EGT relative to best power: lean of peak the power follows the fuel flow at 13.3–14.8 hp/GPH, the
    // POH 5-32 to 5-34 cruise table within 3 %
    peakEgtPower: 0.955,
    // the IO-390 value kept: the POH 4-15 magneto drop, more than 25 and at most 150 rpm, holds with it (T-16)
    singlePlug: 0.93,
    // the IO-390 values kept: with `titGain` below they give the TIT targets (T-22 to T-25)
    egtBase: 1000,
    egtGain: 550,
    fuelTrim: [1.0, 0.985, 1.012, 0.995, 1.006, 0.992],
    coolingTrim: [1.04, 1.0, 0.97, 0.99, 1.02, 0.98],
    // head heat with the slipstream below: the 120 KIAS climb under 420 °F (POH 4-19), 85 % lean of peak at 10,000 ft
    // under 420 °F on a standard day and above it at ISA +30 °C (POH 5-33 shading), and a static full-power run past
    // 460 °F (POH 4-14, 2-9)
    chtRise: 420,
    // the IO-390 value kept: the CHT targets hold with it (T-21, T-26, T-27)
    chtTau: 150,
    // the oil's rise at rated power: 180 °F or more in the 120 KIAS climb at 15,000 ft (POH 2-9 green from 100)
    oilRise: 170,
    // the IO-390 value kept: the oil temperatures hold with it (T-26, T-28)
    oilTau: 270,
    // the IO-390 values kept: the POH 2-6/2-9 oil pressures hold with them, at least 10 psi at a hot idle, 30–60 psi in
    // cruise and the climb, 60–100 psi cold (T-15, T-26, T-29)
    oilPressPerRpm: 24,
    oilRelief: 60,
    // Not published: volumetric efficiency, flat (no data on how it varies with rpm). 0.863 meters 36.9 GPH at full
    // power, inside AMM Figure 73-20-2's band (PDF 2592), which governs. It puts the 236 bhp best-power and peak-EGT
    // flows at 107.9 and 96.9 lb/h, at the top of Figure 2-36's 103 ± 8 and 89 ± 8 (SOURCES.md).
    ve: [
      [2300, 0.863],
      [2500, 0.863],
    ],
    // the λ a lean-of-peak cruise setting aims for: the POH 5-32 to 5-34 table flows lean of peak (POH 4-22)
    lambdaTarget: 1.12,
    // TIT probe (turbo.ts titTargets): each side's bank mean EGT, a fifth of the other bank's mixed in through the
    // crossover and a 5 s lag, its rise above outside air × 1.135 (about 200 °F over the bank mean near peak): leaned
    // toward peak at sea-level full throttle the TIT warning is reachable (POH 3-30, 4-14), 85 % lean of peak at
    // 10,000 ft stays under 1750 °F (POH 5-33), the 75 % target fuel flow sits 50–75 °F lean of peak TIT (POH 4-22), and
    // a stopped engine reads outside air
    titOffsetF: 0,
    titGain: 1.135,
    titCrossover: 0.2,
    titTauS: 5,
    // the propeller's slipstream over the cylinders at rated power: little enough that a static full-power run
    // overheats them (POH 4-14 "avoid overheating during prolonged ground engine operation"). The oil cooler keeps the
    // 55 kt the oil fit was made with (the wastegate actuator runs on that oil)
    slipKt: 15,
    oilSlipKt: 55,
    // the rich misfire edge (mixture.ts stability): the model's λ runs about a quarter richer than the engine's (its
    // fitted VE 0.863 against the air M-18 Table 2-6 prints, SOURCES.md C7), so the -K's full rich (λ 0.55 at rated,
    // about 0.50 on an ISA +30 °C day) sits where the textbook 0.55 edge would misfire. 0.45 keeps a hot day's full
    // rich burning and leaning at full throttle there stable
    richMisfireLambda: 0.45,
    // leaned at full throttle (above 30.5 in.Hg, where the chart is full rich and POH 4-22 does not approve leaning) a
    // cylinder gains at most 1.16 × its full-rich work: just above a standard day's own gain (1 / 0.867, full rich at
    // rated), so a standard day is untouched, while a hot day's very rich full rich no longer lends leaning 30 % more
    // power than the propeller can absorb (2,780 rpm at 25,000 ft ISA +30 °C; now under the 2,550 rpm red line)
    leanGainMax: 1.16,
  },
};
