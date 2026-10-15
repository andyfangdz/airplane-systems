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

  /** Part-throttle fuel consumption chart: lb/h = base(rpm) + slope × bhp. */
  fuelFlow: {
    curve: string;
    slope: number;
    bestPower: { rpm: number; base: number }[];
    bestEconomy: { rpm: number; base: number }[];
  };

  /** Injector: fuel flow (lb/h) against nozzle pressure (psig), nominal curve. */
  nozzle: { curve: string; points: [number, number][] };

  limits: {
    rpmMax: Limit;
    idleRpm: { min: number; max: number; src: string };
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
    starterMaxS: Limit;
    leanMaxPowerROP: Limit;
  };

  oil: {
    /** Thermostatic valve: closes at this oil temperature, routing all oil through the cooler, °F. */
    thermostatF: number;
    /** Oil flow through the cooler at rated power, US gal/min. */
    coolerFlowGpm: number;
    /** Cooler heat rejection must not exceed this, Btu/min. */
    coolerMaxBtuMin: number;
  };

  accessories: {
    starterRatio: number;
    alternatorRatio: number;
    magnetoRatio: number;
    tachRatio: number;
    governorRatio: number;
    rotation: string;
    magnetos: string;
    injector: string;
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
    /** Per-cylinder nozzle flow (tolerance) and cooling, illustrative. */
    nozzleTrim: number[];
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
