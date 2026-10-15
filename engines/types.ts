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

export interface EngineSpec {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** Model designation as printed by the manufacturer. */
  model: string;
  /** One-paragraph description for the panel. */
  lead: string;
  /** Short name of the engine maker's manual, as the page cites it ("IOM", "OM"). */
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
  };

  rating: {
    hp: number;
    rpm: number;
    /** Published cruise points: % rated, hp, rpm, fuel consumption gph, mixture. */
    cruise: {
      label: string;
      pct: number;
      hp: number;
      rpm: number;
      gph: number;
      mixture: "best power" | "best economy";
    }[];
  };

  /** Brake hp map (sea-level lines and full-throttle altitude points). */
  performance: { curve: string; lines: SeaLevelLine[] };

  /** Best-power fuel consumption: what the engine burns, used to size its air flow (volumetric efficiency). */
  fuelFlow: FuelFlowChart | FuelFlowBsfc;

  /** How fuel is metered: a servo fuel injector with nozzles, or a float carburetor. */
  fuelSystem: InjectedFuel | Carburetor;

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
    leanMaxPowerROP: Limit;
  };

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

export interface InjectedFuel {
  kind: "injected";
  /** Model name(s), as the manual lists them. */
  unit: string;
  /** Injector: fuel flow (lb/h) against nozzle pressure (psig), nominal curve. */
  nozzle: { curve: string; points: [number, number][] };
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
