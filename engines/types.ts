/**
 * An engine definition: the manufacturer's published data (with the page it came from) plus the few calibration
 * constants the physics needs that no document gives. `engines/model/` runs any `EngineSpec`; an engine folder
 * (`engines/io390/`) only supplies data.
 */

/** One rpm line of a Lycoming sea-level performance chart: brake hp at two manifold pressures (the lines are straight). */
export interface SeaLevelLine {
  rpm: number;
  /** [manifold pressure inHg, brake hp] at best-power mixture and standard temperature. */
  a: [number, number];
  b: [number, number];
  /** Where the line ends: full-throttle manifold pressure at sea level, inHg. */
  ftMap: number;
  /** Full-throttle brake hp at 20,000 ft from the altitude chart (straight in density ratio, see `performance.ts`). */
  hp20k: number;
}

export type Side = "L" | "R";

export interface CylinderDef {
  /** Manufacturer's cylinder number. */
  n: number;
  side: Side;
  /** Crankpin angle at crank angle 0, degrees, positive in the direction of rotation. */
  pin: number;
  /** Position along the crankshaft from the front main bearing, metres (forward is +x). Schematic. */
  x: number;
}

export interface Limit {
  value: number;
  unit: string;
  src: string;
}

/** One rpm line of a Continental performance chart: brake hp against manifold pressure (curved, so a point list). */
export interface ContinentalLine {
  rpm: number;
  /** [absolute dry manifold pressure inHg, brake hp], increasing in manifold pressure. */
  points: [number, number][];
}

/** One coloured arc of an instrument marking (one cell of a limitations table row). */
export interface Band {
  from: number;
  to: number;
  color: "red" | "yellow" | "green";
  /** The crew-alerting message this band raises, exactly as the airplane's handbook prints it. */
  cas?: string;
  level?: "caution" | "warning";
}

/** An instrument's scale and arcs, as the handbook prints them: the one source for its gauge bands and named flags. */
export interface Marking {
  gauge: "cht" | "rpm" | "egt" | "map" | "oilP" | "oilT" | "pct" | "tit" | "ff";
  scale: [number, number];
  unit: string;
  bands: Band[];
  src: string;
}

/**
 * Twin turbochargers with a wastegate, a differential ("sloped") controller, intercoolers and an overboost relief valve.
 * No compressor or turbine map is published for such an engine, so every constant here is chosen to fit.
 */
export interface TurboSpec {
  count: 2;
  etaCompressor: number;
  etaTurbine: number;
  /**
   * Compressor map edge: [pressure ratio, fraction of `etaCompressor`], linear between points and flat beyond the
   * ends. No map is published; the efficiency falling toward the edge is what gives a critical altitude. Absent:
   * `etaCompressor` at every pressure ratio.
   */
  compressorEta?: [number, number][];
  /** Turbine nozzle effective area (per side), m². */
  turbineArea: number;
  /** First-order spool lag on the upper-deck pressure, s. */
  spoolTauS: number;
  /** Shaft speed (rpm) at the reference compressor pressure ratio: display and the turbine speed limit. */
  rpmRef: number;
  prRef: number;
  /** Spring-open wastegate: actuator oil pressure (psi) where it starts to close and where it is shut; lag; area (m²). */
  wastegate: { pCrackPsi: number; pFullPsi: number; tauS: number; area: number };
  /**
   * Differential controller: set point Δ = c0 + c1 (deck − deckRef) inHg; bleed b = b0 + kBleed (Δ − set); actuator
   * pressure = oil pressure / (1 + (b · ratio)²). `misadjustInHg` shifts the set point for that failure.
   */
  controller: {
    c0: number;
    c1: number;
    deckRef: number;
    kBleed: number;
    b0: number;
    ratio: number;
    misadjustInHg: number;
  };
  /** Effectiveness, pressure drop at rated flow (inHg), cooling-air temperature rise over outside air (°C). */
  intercooler: { effectiveness: number; dpInHgRated: number; coolRiseC: number };
  /** Relief valve on the upper deck: opens at `crackInHg`, reseats `hystInHg` lower; flow area m². */
  overboost: { crackInHg: number; hystInHg: number; area: number };
  /** Leak areas for the turbo-system failures, m². */
  leaks: { inductionArea: number; intercoolerArea: number; exhaustArea: number };
  /** Bearing heat into the oil (coefficient), oil bled to the turbochargers (psi), oil lost through a leak (qt/min). */
  oil: { bearingHeatK: number; bleedPsi: number; leakQtPerMin: number };
}

/**
 * Every optional member below that has no counterpart in the IO-390 or O-360 data describes a turbocharged Continental
 * engine (the TSIO-550-K): absent, the model runs the code path it always has. Where one replaces a constant the model
 * used to hard-code, its comment gives that constant as the default.
 */
export interface EngineSpec {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** Model designation as printed by the manufacturer. */
  model: string;
  /** One-paragraph description for the panel. */
  lead: string;
  /**
   * Short name of the engine maker's manual, as the page cites it ("IOM", "OM"), or of the airplane's handbook where it
   * governs the engine's limits and procedures ("POH" for the TSIO-550-K).
   */
  doc: string;
  /** Where the page's notes point in that manual. */
  refs: {
    start: string;
    idle: string;
    magCheck: string;
    cruise: string;
    /** Specifications and limits, for the panel's footnote. */
    tables: string;
    leaning: string;
    /** Carburetor heat and icing (carbureted engines). */
    carbHeat?: string;
  };
  /** Engine-specific names and notes for 3D parts, keyed by the part's default name (scene/parts.tsx). */
  parts?: Record<string, { name?: string; note: string }>;
  /** "How the model works" notes for the panel: what is charted, what is fitted, what is schematic. */
  modelNotes: string[];
  /** Where the data comes from, shown in the panel. */
  sources: { title: string; href?: string; note: string }[];
  /**
   * The panel's header line, e.g. "Engine simulation · Continental M-18 · Cirrus SR22T POH". Absent: "Engine
   * simulation · <maker> <doc>", which reads wrongly when `doc` is an airframe's handbook.
   */
  ref?: string;

  geometry: {
    cylinders: CylinderDef[];
    firingOrder: number[];
    boreIn: number;
    strokeIn: number;
    displacementIn3: number;
    compressionRatio: number;
    /** Connecting rod centre distance, inches. Not published; drawing and cylinder-pressure kinematics only. */
    rodIn: number;
    /** Overall envelope, inches (length along the crankshaft, width, height). */
    envelopeIn: { length: number; width: number; height: number };
    /** Valve events, degrees from the nearest dead centre. Not published; animation and pressure trace only. */
    valves: { ivo: number; ivc: number; evo: number; evc: number };
    /** Pendulum (dynamic) counterweights on the crankshaft. */
    pendulumCounterweights: boolean;
  };

  ignition: {
    /** Spark advance, degrees before top centre. */
    advanceBTC: number;
    /** Which magneto has the retard breaker (fires alone, retarded, during START). */
    retardMag: Side;
    /** Retard during start, degrees after top centre. Not published for this magneto; an assumption. */
    startRetardATC: number;
    /** For each cylinder number, which magneto fires its top plug; the other magneto fires the bottom plug. Schematic. */
    topPlugMag: Record<number, Side>;
    /** Below this crank speed a start may fail (magneto output, cranking), rpm. */
    minStartRpm: number;
    /** Magnetos firing at START: "retard" (absent) the retard magneto alone; "both" (impulse couplings, spark at TDC). */
    startMags?: "retard" | "both";
    /** Where `advanceBTC` is printed, for the pressure chart's caption. */
    advanceSrc?: string;
  };

  rating: {
    hp: number;
    rpm: number;
    /** Installed full-throttle manifold pressure, inHg, where the airplane's handbook sets one (turbocharged). */
    map?: number;
    /** Published cruise points: % rated, hp, rpm, fuel consumption gph, mixture. */
    cruise: {
      label: string;
      pct: number;
      hp: number;
      rpm: number;
      gph: number;
      /** "lean of peak" is a label for cruise tables flown lean of peak EGT. */
      mixture: "best power" | "best economy" | "lean of peak";
    }[];
  };

  /** Brake hp map: Lycoming's sea-level lines and full-throttle altitude points, or Continental's curves. */
  performance: LycomingPerformance | ContinentalPerformance;

  /** Best-power fuel consumption: what the engine burns, used to size its air flow (volumetric efficiency). */
  fuelFlow: FuelFlowChart | FuelFlowBsfc | FuelFlowContinental;

  /** How fuel is metered: a servo fuel injector with nozzles, a float carburetor, or Continental continuous flow. */
  fuelSystem: InjectedFuel | Carburetor | ContinentalInjection;

  /** Induction air. Every member is optional; an absent member takes the default its comment gives. */
  induction?: {
    /** "manual" (absent) the pilot's alternate-air control; "automatic" a door upstream of the compressors. */
    altAir?: "manual" | "automatic";
    /** Alternate air is this much warmer than outside air, °C. Default 15 (an assumption). */
    altAirDeltaC?: number;
    /** A blocked filter's flow area as a fraction of the throttle's, in series (injected engines). Default 0.12. */
    filterBlockedArea?: number;
    /** Filter restriction that opens an automatic alternate-air door, inH₂O. */
    doorOpenInH2O?: number;
    /** Pressure drop across the open throttle body at rated flow, inHg. */
    throttleLossInHg?: number;
    /** Fraction of the ideal ram pressure rise the inlet recovers. Default 0.7. */
    ramEta?: number;
  };

  /** Turbocharging. Absent: normally aspirated. */
  turbo?: TurboSpec;

  limits: {
    rpmMax: Limit;
    /** `assumed`: the engine maker leaves idle speed to the airframe; the range is the model's, not a document's. */
    idleRpm: { min: number; max: number; src: string; assumed?: boolean };
    oilPressMinIdle: Limit;
    oilPressNormal: { min: number; max: number; unit: string; src: string };
    oilPressMaxStart: Limit;
    oilTempMax: Limit;
    oilTempBest: Limit;
    chtMax: Limit;
    chtBestAbove75: Limit;
    chtBestAt75: Limit;
    magDropMax: Limit;
    magDiffMax: Limit;
    magCheckRpm: { min: number; max: number; src: string };
    oilSumpQt: Limit;
    oilMinQt: Limit;
    /** Not every manual gives a starter duty limit. */
    starterMaxS?: Limit;
    /** Leanest permitted mixture at maximum power, °F rich of peak, where the manual gives one. */
    leanMaxPowerROP?: Limit;
    /** Minimum manifold pressure above an altitude (inHg, ft). */
    mapMinAbove?: { map: number; altFt: number; src: string };
    /** Transient turbine-inlet temperature limit (°F) and how long it may last (s). */
    titTransient?: { value: number; seconds: number; src: string };
    /** Turbine speed limit against turbine-inlet temperature: [TIT °F, rpm]. */
    turbineRpmMax?: { points: [number, number][]; src: string };
    /** Minimum oil temperature for takeoff. */
    oilTempMinTakeoff?: Limit;
    /** Minimum cylinder head temperature in a descent. */
    chtMinDescent?: Limit;
    /** Leaning permitted only at or below this manifold pressure. */
    leanMaxMap?: Limit;
    /** Maximum exhaust back pressure. */
    exhaustBackPressureMax?: Limit;
    /** Maximum operating altitude. */
    maxAltFt?: Limit;
    /** Starter-engaged caution and warning after the starter has been engaged this long, s. */
    startEngaged?: { caution: number; warning: number; src: string };
    /** The low oil-pressure caution applies at and above this rpm. */
    oilPressCautionMinRpm?: Limit;
  };

  /** Instrument markings as the airplane's handbook prints them: gauge bands and the flags named after its messages. */
  markings?: Marking[];

  /** Page slider maxima: altitude (ft), true airspeed (kt), oil (US qt). */
  envelope?: { maxAltFt: number; maxTasKt: number; maxOilQt: number };

  oil: {
    /** Thermostatic valve: closes at this oil temperature, routing all oil through the cooler, °F. */
    thermostatF: number;
    /** The thermostat setting is a model assumption (the manual doesn't give one). */
    thermostatAssumed?: boolean;
    /** Oil flow through the cooler at rated power, US gal/min (where published). */
    coolerFlowGpm?: number;
    /** Cooler heat rejection must not exceed this, Btu/min (where published). */
    coolerMaxBtuMin?: number;
    /** Oil jets in the crankcase cool the pistons from inside (drawn only where the manual describes them). */
    pistonCoolingJets: boolean;
    /**
     * Sump quantity (US qt) where the oil pump pickup is fully uncovered and where it is fully covered: oil pressure
     * fades between them. Default [1.5, 3].
     */
    pickupQt?: [number, number];
  };

  accessories: {
    starterRatio: number;
    alternatorRatio: number;
    magnetoRatio: number;
    tachRatio: number;
    governorRatio: number;
    rotation: string;
    magnetos: string;
    weightLb: number;
    /** Starter stall torque at the crankshaft, N·m. Default 230. */
    starterTorque?: number;
    /** Crank speed where the starter's torque falls to nothing, rpm. Default 380. */
    starterFreeRpm?: number;
  };

  /** The propeller used as the engine's load. */
  propeller: {
    name: string;
    diameterIn: number;
    blades: number;
    src: string;
    /** Below: not published; chosen so the documented operating points come out (see engines/README.md). */
    fineDeg: number;
    coarseDeg: number;
    governorMinRpm: number;
    inertia: number;
    /** "lever" (absent) a pilot propeller control; "fixed" a governor with no pilot control. */
    control?: "lever" | "fixed";
    /** Scales the model's power coefficient (blade count and planform); 1 if absent. */
    cpScale?: number;
    /** Lower the blades' angle of attack by the inflow the propeller induces (momentum theory, propeller.ts). */
    inducedInflow?: boolean;
  };

  /** Constants the documents don't give, chosen to reproduce the documented points. Each says what it does. */
  calibration: {
    /** Closed-throttle leakage area as a fraction of the open area: sets idle rpm (600–700 in the IOM). */
    idleArea: number;
    /** Excess-air ratio λ that the charts' "best power" mixture corresponds to. */
    lambdaBestPower: number;
    /** λ at full rich, sea level standard day (the servo richens as the air thins). */
    lambdaFullRich: number;
    /** Power at peak EGT ("best economy") relative to best power. */
    peakEgtPower: number;
    /** Power factor with one plug firing instead of two. */
    singlePlug: number;
    /** Peak EGT, °F = egtBase + egtGain × √(load fraction). */
    egtBase: number;
    egtGain: number;
    /** Per-cylinder fuel share (nozzle tolerance, or a carburetor's intake-pipe distribution) and cooling, illustrative. */
    fuelTrim: number[];
    coolingTrim: number[];
    /** Cylinder head: steady rise over outside air (°F) at rated power, best power, reference cooling; time constant (s). */
    chtRise: number;
    chtTau: number;
    /** Oil: steady rise over outside air (°F) at rated power, reference cooling, cooler open; time constant (s). */
    oilRise: number;
    oilTau: number;
    /** Oil pump pressure (psi) at 1,000 rpm and 180 °F before the relief valve, and the relief setting. */
    oilPressPerRpm: number;
    oilRelief: number;
    /** Volumetric efficiency as a fit, [rpm, VE], for an engine without a Lycoming chart to derive it from. */
    ve?: [number, number][];
    /** λ the page's lean-of-peak setting aims for. */
    lambdaTarget?: number;
    /**
     * Turbine-inlet temperature: offset over the bank mean EGT (°F), crossover mixing fraction, lag (s), and `titGain`:
     * the TIT's rise above outside air over the mixed bank EGT's (absent: 1), so a stopped, cold engine reads outside
     * air whatever the gain.
     */
    titOffsetF?: number;
    titGain?: number;
    titCrossover?: number;
    titTauS?: number;
    /** Propeller slipstream over the cylinders at rated power, kt (∝ power^⅓). Default 55. */
    slipKt?: number;
    /** The oil cooler's share of the slipstream at rated power, kt. Absent: `slipKt`, the cylinders'. */
    oilSlipKt?: number;
    /**
     * The rich misfire edge, λ: below it cycles start to misfire, gone 0.15 lower (mixture.ts `stability`). Default
     * 0.55.
     */
    richMisfireLambda?: number;
    /**
     * The most a cylinder's work may gain over full rich when leaned at a Continental chart's full-rich manifold
     * pressures, phased in with the full-rich basis (performance.ts `fullRichWeight`). Absent: no cap.
     */
    leanGainMax?: number;
  };
}

/** A part-throttle fuel consumption chart: lb/h = base(rpm) + slope × bhp (Lycoming's injected-engine charts). */
export interface FuelFlowChart {
  kind: "chart";
  curve: string;
  slope: number;
  bestPower: { rpm: number; base: number }[];
  bestEconomy: { rpm: number; base: number }[];
}

/**
 * Where the manual gives only a table of cruise fuel flows and a minimum-fuel-flow curve: best-power fuel is a
 * constant specific consumption taken from a published cruise point.
 */
export interface FuelFlowBsfc {
  kind: "bsfc";
  /** lb per brake hp per hour at best-power mixture, and the point it comes from. */
  bsfc: number;
  src: string;
  /** Minimum allowable fuel flow against % rated power: [%, US gal/h]. */
  minimum: { curve: string; points: [number, number][] };
}

/** Lycoming's performance chart: straight sea-level rpm lines and full-throttle altitude points. */
export interface LycomingPerformance {
  kind: "lycoming";
  curve: string;
  lines: SeaLevelLine[];
}

/**
 * Continental's sea-level performance chart: curved rpm lines against absolute dry manifold pressure, with no altitude
 * chart. Full rich above `fullRichAboveInHg` and best power at or below it, blended over ±`blendInHg`; power falls
 * `tempPctPerF` % per °F of compressor-inlet temperature.
 */
export interface ContinentalPerformance {
  kind: "continental";
  curve: string;
  lines: ContinentalLine[];
  fullRichAboveInHg: number;
  blendInHg: number;
  tempPctPerF: number;
  /**
   * The charge (manifold air) temperature, °C, the chart's power is read at. With it the running engine's chart power
   * scales with its intercooled charge's density, the kelvin ratio, in place of the compressor-inlet law. Absent: no
   * charge correction.
   */
  chargeRefC?: number;
}

/**
 * Continental's fuel flow against sea-level standard brake hp, [bhp, lb/h]: rich and lean full rich, best power and best
 * economy, one curve set for every rpm. An engine with this chart gives its volumetric efficiency as `calibration.ve`.
 */
export interface FuelFlowContinental {
  kind: "continental";
  curve: string;
  richFullRich: [number, number][];
  leanFullRich: [number, number][];
  bestPower: [number, number][];
  bestEconomy: [number, number][];
}

export interface InjectedFuel {
  kind: "injected";
  /** Model name(s), as the manual lists them. */
  unit: string;
  /** Injector: fuel flow (lb/h) against nozzle pressure (psig), nominal curve. */
  nozzle: { curve: string; points: [number, number][] };
  /** Engine-driven pump outlet pressure at and above 900 rpm, psi (it ramps from zero below). Default 28. */
  pumpPsi?: number;
  /** Electric boost pump pressure, psi. Default 26. */
  boostPsi?: number;
}

/**
 * Continental continuous-flow injection: an engine-driven pump with the mixture valve, metering linked to the throttle,
 * a manifold valve and air-bled nozzles. A full-rich λ schedule against air flow, with no density richening.
 */
export interface ContinentalInjection {
  kind: "continental";
  /** The system as the manuals describe it. */
  unit: string;
  /** Nominal fuel flow (lb/h) against metered nozzle pressure (psid to the upper deck), all nozzles together. */
  nozzle: { curve: string; points: [number, number][] };
  /** [fraction of rated air flow, λ at full rich]. */
  fullRichLambda: [number, number][];
  /** Engine-driven pump outlet pressure bands, psi: [min, max] at idle and at rated power. */
  pumpPsi: { idle: [number, number]; rated: [number, number] };
  /** Boost pump pressure band, psi. */
  boostPsi: [number, number];
  /** High boost is available at or above both this manifold pressure and pressure altitude, or below `belowRpm`. */
  highBoost: { mapInHg: number; altFt: number; belowRpm: number };
  /** Nozzle pressure differential at rated power, psid. */
  nozzleRatedPsid: number;
}

/** A float carburetor with manual mixture and idle cut-off, an accelerator pump, and a carburetor heat valve. */
export interface Carburetor {
  kind: "carburetor";
  unit: string;
  /** Fuel pressure at the carburetor inlet, psi. */
  inletPsi: { min: number; desired: number; max: number; src: string };
  /** The mixture chamber can run this much colder than the incoming air (°F), from fuel evaporation and the venturi. */
  maxDropF: number;
  maxDropSrc: string;
  /** Below: not published; chosen so the documented behaviour comes out. Each says what it does. */
  /** Fuel in a full float bowl, lb. */
  bowlLb: number;
  /** Idle circuit flow at full manifold vacuum, lb/h (sets the idle mixture). */
  idleLbH: number;
  /** Accelerator pump: fuel for one full closed-to-open throttle stroke, lb. */
  accelLb: number;
  /** One stroke of the primer, lb of fuel into each cylinder's intake port. */
  primeLb: number;
  /** Full carburetor heat raises the induction air this much (°C) with the exhaust at cruise heat. */
  heatRiseC: number;
  /** Ice that blocks the venturi completely, kg, and the fraction of the condensed water that sticks. */
  iceKg: number;
  iceCapture: number;
}
