/**
 * Continental TSIO-550-K as installed in the Cirrus SR22T. Every published number cites its page: the SR22T POH/AFM
 * P/N 13772-007 Reissue A (POH), the Cirrus AMM 13773-002 Rev 7 (AMM, chapter and PDF page) and the Continental
 * TSIO-550 Permold Series Engine Maintenance and Overhaul Manual M-18, 21 September 2017 (M-18). Where they disagree
 * the POH wins, then the AMM, then Continental (SOURCES.md lists every conflict). Chart values were digitized from
 * M-18 Figures 2-36 and 2-37 (see SOURCES.md for how, and the reading uncertainty). `calibration`, `turbo`,
 * `fuelSystem.fullRichLambda`, the `induction` constants, the propeller's aerodynamics, the starter, the oil pickup and
 * the nozzle curve are model constants chosen to reproduce the documented points: they are not Continental or Cirrus
 * data, and they are starting values until the model runs this engine.
 *
 * Data only: the engine is not in `ENGINES` (engines/index.ts). The model has no Continental chart, Continental
 * metering or turbocharger yet, so it cannot run this spec.
 */
import type { EngineSpec } from "../types";

const POH = "POH 13772-007";
const AMM = "AMM 13773-002 Rev 7";
const M18 = "Continental M-18";

export const TSIO550K: EngineSpec = {
  id: "tsio550k",
  name: "TSIO-550-K",
  model: "Continental TSIO-550-K", // POH 1-7, 7-31
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
  },
  modelNotes: [
    "Power follows Continental's sea-level chart (M-18 Fig 2-37): full rich above 30.5 in.Hg, best power at or below; " +
      "1 % per 6 °F of compressor-inlet temperature (Table 2-2 note 1). No altitude chart is published for the -K.",
    "The turbochargers are a quasi-steady power balance with a spool lag. No compressor or turbine map is published, " +
      "so the turbine speed shown is illustrative.",
    "Percent power here is brake hp ÷ 315. The airplane's display uses its own algorithm (POH 7-36).",
    "Turbo, controller and calibration constants are chosen to fit the POH and AMM points listed in SOURCES.md. They " +
      "are not Continental or Cirrus data.",
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
      note: "Three composite blades, 78.0 in (POH 1-7, 2-8). The governor is factory-set to 2,500 rpm with no propeller control (POH 7-32, 7-39; AMM 61-20).",
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
    // Not published: a square-root law through the rated nozzle pressure and the AMM full-power flow (38.2 GPH at
    // 6.0 lb/gal = 229.2 lb/h). Total engine flow against metered nozzle pressure.
    nozzle: {
      curve: "Square-root law through 14.5 psid at 229 lb/h (fit, not Continental data)",
      points: [
        [0, 0],
        [0.5, 42.6],
        [1, 60.2],
        [2, 85.1],
        [4, 120.4],
        [6, 147.4],
        [8, 170.2],
        [10, 190.3],
        [12, 208.5],
        [14, 225.2],
        [14.5, 229.2],
        [16, 240.8],
      ],
    },
    // Not published: [fraction of rated air flow, λ at full rich], to be fitted to the AMM full-power band (AMM Figure
    // 73-20-2 PDF 2592) and to Figure 2-36's full-rich band at part power. First cut λ(x) = 0.58 · x · F(1) / F(x),
    // F the Figure 2-36 mid-band ((rich + lean full rich) / 2), air fraction taken as bhp / 315. Flat beyond the ends.
    fullRichLambda: [
      [0.55, 0.775],
      [0.65, 0.773],
      [0.75, 0.76],
      [0.83, 0.752],
      [0.89, 0.722],
      [0.92, 0.693],
      [0.95, 0.654],
      [0.98, 0.606],
      [1.0, 0.58],
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
    altAirDeltaC: 12, // not published: alternate air costs 3–5 % power (POH 3A-11) at 1 % per 6 °F
    filterBlockedArea: 0.12, // not published: the model's default; to fit the door closing at cruise power (POH 3A-11)
    doorOpenInH2O: 4, // not published: magnet hold-closed suction
    throttleLossInHg: 0.75, // not published: open throttle-body loss at rated flow
    ramEta: 0.7, // not published: the model's default inlet recovery
  },

  // Not published: no compressor or turbine map exists for the -K. Starting values sized by a power balance at the
  // 18,000 ft critical altitude (M-18 Table 2-2; pressure ratio ≈ 2.45, gate closed), to be fitted to 36.0 in.Hg at
  // full throttle up to that altitude (POH 4-14, 4-17) and to the cold-oil 36.0–37.0 (POH 4-17); see SOURCES.md,
  // "Not published: chosen to fit".
  turbo: {
    count: 2,
    etaCompressor: 0.7,
    etaTurbine: 0.7,
    turbineArea: 1.6e-3,
    spoolTauS: 1.5,
    rpmRef: 105000,
    prRef: 2.45,
    wastegate: { pCrackPsi: 10, pFullPsi: 35, tauS: 0.7, area: 2.0e-3 },
    controller: { c0: 0.75, c1: 0.05, deckRef: 36.75, kBleed: 0.5, b0: 0.5, ratio: 3, misadjustInHg: 1.0 },
    intercooler: { effectiveness: 0.55, dpInHgRated: 0.5, coolRiseC: 10 }, // ε 0.5–0.6: M-18 Figure 2-39 p. 2-47
    // Deck crack above every normal case (cold-oil 37.0 in.Hg MAP included): lifts at MAP ≈ 37.5–38 with a wastegate
    // seized closed (POH 3-29, 3-30). The AMM 81-20 "35 inHg" is below the normal 36.0 and is not used.
    overboost: { crackInHg: 38.5, hystInHg: 1.0, area: 6e-4 },
    leaks: { inductionArea: 1.5e-3, intercoolerArea: 8e-4, exhaustArea: 8e-4 },
    oil: { bearingHeatK: 1.0, bleedPsi: 2, leakQtPerMin: 0.2 },
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
    // M-18 names them squirt nozzles and does not say what they cool; `pistonCoolingJets` is the flag that draws them.
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
    starterTorque: 300, // not published: chosen for the POH 4-12 start (running within 10 s)
    starterFreeRpm: 380, // not published
  },

  propeller: {
    name: "Hartzell PHC-J3Y1F-1N/N7605(B)",
    diameterIn: 78,
    blades: 3,
    src: "SR22T POH 1-7, 2-8; governor 7-32, 7-39; AMM 61-20",
    control: "fixed", // POH 7-32: "No propeller control is required"; AMM 61-20: factory-set to 2500 RPM
    // Not published: fine stop below the static full-power blade angle (≈ 16° for 312 hp at 2,500 rpm with this
    // model's power coefficient), so the governor can hold 2,500 at a static run-up (POH 4-17 "approximately 2500").
    fineDeg: 15,
    coarseDeg: 45,
    governorMinRpm: 2500,
    inertia: 3.8, // not published: engine and propeller; above M-18 Table 2-7's propeller minimum (1.81 kg·m² at 700)
  },

  calibration: {
    idleArea: 0.02,
    lambdaBestPower: 0.85,
    lambdaFullRich: 0.58, // the rated end of `fuelSystem.fullRichLambda`, which meters this engine
    peakEgtPower: 0.965,
    singlePlug: 0.93,
    egtBase: 1000,
    egtGain: 550,
    fuelTrim: [1.0, 0.985, 1.012, 0.995, 1.006, 0.992],
    coolingTrim: [1.04, 1.0, 0.97, 0.99, 1.02, 0.98],
    chtRise: 400,
    chtTau: 150,
    oilRise: 165,
    oilTau: 270,
    oilPressPerRpm: 24,
    oilRelief: 60,
    // Not published: volumetric efficiency (no Lycoming-style chart to derive it from), to be fitted to the AMM
    // full-power fuel flow (AMM Figure 73-20-2 PDF 2592) with `fuelSystem.fullRichLambda`.
    ve: [
      [1000, 0.88],
      [2000, 0.91],
      [2500, 0.92],
    ],
    // Not published: the λ a lean-of-peak cruise setting aims for, to be fitted to the POH 5-32 to 5-34 fuel flows
    lambdaTarget: 1.12,
    // Not published: TIT over the mean EGT of the cylinders feeding each turbocharger, to be fitted to the POH 4-22
    // target fuel flow 50–75 °F lean of peak TIT
    titOffsetF: 0,
    titCrossover: 0.2,
    titTauS: 5,
    slipKt: 55, // not published: the model's default slipstream
  },
};
