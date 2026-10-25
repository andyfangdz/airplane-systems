/**
 * The pitot-static system of a Cessna 172S with conventional instruments: a heated pitot head under the left wing, one
 * static port on the left side of the forward fuselage, a sump at the static line's low point, the ALT STATIC AIR
 * selector valve, and the airspeed indicator, altimeter, vertical speed indicator and blind encoder that share them.
 *
 * How the system and its failures behave comes from the FAA's Pilot's Handbook of Aeronautical Knowledge (chapter 8),
 * Instrument Flying Handbook (chapter 5) and the airframe maintenance handbook (chapter 10); the installation, the
 * airspeed calibration for both static sources, the markings and the procedures from the 172S POH and parts catalogue
 * (see SOURCES.md). Everything under `model` is a constant the documents don't give, chosen so the system behaves as
 * they describe: they are not Cessna data.
 */

export const PHAK = "FAA-H-8083-25C";
export const IFH = "FAA-H-8083-15B";
export const AMT = "FAA-H-8083-31B";
export const POH = "172S POH";
export const IPC = "172RPC24";
export const GPG = "Garmin 190-00498-07";

export type Flaps = "up" | "10" | "full";

/** An airspeed calibration: KIAS against KCAS, in the POH's own columns. */
export type Calibration = readonly (readonly [kias: number, kcas: number])[];

export const PITOT_STATIC = {
  id: "pitot-static",
  name: "Pitot-static system",
  sub: "Cessna 172S · six-pack or G1000",
  lead:
    "The pitot-static system of a Cessna 172S, with its six-pack or its G1000 air data computer and standby " +
    "instruments: fly it, block the pitot tube, its drain or the static port, pull the alternate static source and " +
    "watch every instrument respond the way the FAA handbooks, the POH and Garmin describe.",

  /** Printed in the Cessna 172S NAV III POH (172SPHBUS-00) and the Model 172 parts catalogue (172RPC24). */
  poh: {
    /**
     * Figure 5-1 Sheet 1 (p. 5-10), airspeed calibration, normal static source: KIAS → KCAS. "Power required for level
     * flight or maximum power descent."
     */
    normal: {
      up: [
        [50, 56],
        [60, 62],
        [70, 70],
        [80, 78],
        [90, 87],
        [100, 97],
        [110, 107],
        [120, 117],
        [130, 127],
        [140, 137],
        [150, 147],
        [160, 157],
      ],
      "10": [
        [40, 51],
        [50, 57],
        [60, 63],
        [70, 71],
        [80, 80],
        [90, 89],
        [100, 99],
        [110, 109],
      ],
      full: [
        [40, 50],
        [50, 56],
        [60, 63],
        [70, 72],
        [80, 81],
        [85, 86],
      ],
    },
    /**
     * Figure 5-1 Sheet 2 (p. 5-11), alternate static source: "Windows and ventilators closed. Cabin heat, cabin air and
     * defroster on maximum."
     */
    alternate: {
      up: [
        [50, 56],
        [60, 62],
        [70, 68],
        [80, 76],
        [90, 85],
        [100, 95],
        [110, 105],
        [120, 115],
        [130, 125],
        [140, 134],
        [150, 144],
        [160, 154],
      ],
      "10": [
        [40, 51],
        [50, 55],
        [60, 60],
        [70, 68],
        [80, 77],
        [90, 86],
        [100, 96],
        [110, 105],
      ],
      full: [
        [40, 49],
        [50, 54],
        [60, 61],
        [70, 69],
        [80, 78],
        [85, 83],
      ],
    },
    /** p. 3-32: with ALT STATIC AIR ON, the maximum variation from the normal source, with all windows closed. */
    altVariation: { kt: 11, ft: 50 },
    /** Figure 2-2 (p. 2-5), KIAS. The red arc (20–40) is on the G1000 airspeed tape only, not the round indicator. */
    markings: { white: [40, 85], green: [48, 129], yellow: [129, 163], redLine: 163 },
    /** Figure 2-1 (p. 2-4), KIAS: flaps 10° and flaps 10° to FULL. */
    vfe: { ten: 110, full: 85 },
    /** p. 4-4 and 4-6: the pitot tube is warm to the touch within 30 seconds of PITOT HEAT on. */
    heatCheckS: 30,
    /** 172RPC24 34-11-00 Figure 01: pitot line 55.0 in, static line 16.0 in (the lines named in the catalogue). */
    pitotLineIn: 55,
    staticLineIn: 16,
  },

  /**
   * The NAV III's G1000: Garmin's G1000 Pilot's Guide for Cessna NAV III (190-00498-07 Rev. A) and the NAV III POH.
   * The GDC 74A air data computer "processes data from the pitot/static system as well as the OAT probe" and gives
   * the G1000 pressure altitude, airspeed, vertical speed and OAT (p. 2; POH p. 7-70); the standby airspeed indicator
   * and altimeter share the pitot head and static port with it (POH p. 7-12).
   */
  g1000: {
    /** "Speed indication starts at 20 knots" (p. 50). */
    tapeMinKt: 20,
    /** The trend vectors show about where airspeed and altitude will be in six seconds (pp. 50, 53). */
    trendS: 6,
    /** Digits in the VSI pointer above 100 fpm; beyond 2,000 fpm it sits at the edge of the scale (p. 55; POH p. 7-20). */
    vsiDigitsFpm: 100,
    vsiScaleFpm: 2000,
    /** Red arc 20–40 KIAS for low-airspeed awareness, on the G1000 airspeed indicator only (POH Figure 2-2). */
    redArc: [20, 40] as const,
  },

  /** Printed in the FAA handbooks. */
  handbook: {
    /** The VSI needle "stabilizes after a short period (6–9 seconds)" (PHAK p. 8-8). */
    vsiLagS: [6, 9] as const,
    /** An altimeter off "more than 75 feet from the surveyed field elevation" goes to a repair station (PHAK p. 8-7). */
    altimeterCheckFt: 75,
    /** Barometric scale range "from 28.00 to 31.00 inches of mercury" (IFH p. 5-4). */
    kollsman: [28, 31] as const,
    /** Leak test: reduce static pressure to indicate 1,000 ft, seal, observe 1 minute: lose no more than 100 ft (AMT p. 10-81). */
    leakTest: { ft: 1000, s: 60, maxLossFt: 100 },
    /** Mode C reports "in increments of 100 feet" from 29.92 inHg (IFH p. 5-7). */
    modeCft: 100,
  },

  /**
   * Model constants (not published). The pneumatics are lumped volumes joined by restrictions; each `tau` is a
   * volume's time constant through one path alone, in seconds.
   */
  model: {
    /** Pitot line and ASI diaphragm through the ram inlet. */
    tauRam: 0.03,
    /** Drain hole against the ram inlet, as a ratio of flow conductances: through the drain alone the pitot side
     * empties in about 3 s, "not usually instantaneous but … very quickly" (PHAK p. 8-10). */
    drainRatio: 1 / 100,
    /** Static side (lines, ASI and altimeter cases, VSI diaphragm) through the static port. */
    tauPort: 0.15,
    /** Static side through the ALT STATIC AIR valve's cabin inlet. */
    tauAlt: 0.25,
    /** VSI case through its calibrated leak: a first-order lag that settles in 6–9 s. */
    tauVsi: 2.2,
    /** VSI case volume as a fraction of the static side's. */
    vsiCase: 0.45,
    /** Broken VSI glass: conductance from the case to the cabin, in calibrated leaks. */
    glass: 40,
    /** Static leak into the cabin: a seep that passes the leak test, a cracked fitting that fails it, and a line off
     * its fitting behind the panel. */
    leakTau: { seep: 1500, cracked: 120, disconnected: 0.4 },
    /** Pitot line leak into the cabin. */
    pitotLeakTau: 0.6,
    /** Water in the static line: the line's conductance, as a fraction, sloshing between these over `periodS`. */
    water: { min: 0.006, max: 0.08, periodS: 7, freezeS: 20, thawS: 60 },
    /** Instrument pointer lags (mechanism, not pneumatics). */
    pointer: { asi: 0.12, alt: 0.15, vsi: 0.2 },
    /** Sideslip: the windward side of the fuselage gains this fraction of impact pressure per degree. */
    slipCp: 0.01,
    /** Cabin suction outside Figure 5-1 Sheet 2's conditions, added to the table's (as fractions of it). The POH says
     * only that cabin pressure varies with open heaters, vents and windows (p. 7-64). */
    cabin: { vents: 1, heatOff: 0.08 },
    /** Pitot icing. Accretion fraction per second at 100 KTAS; the drain starts icing once the inlet is `drainAfter`
     * closed, at `drainRate` of the inlet's rate. Head temperature: OAT plus `heatRiseC` with the heater fully warm,
     * reached with time constant `heaterTau`. Ice melts at `meltPerDegS` per second per degree above 0 °C. */
    ice: { rate: 1 / 40, drainAfter: 0.6, drainRate: 0.4, heatRiseC: 50, heaterTau: 12, meltPerDegS: 1 / 300 },
    /** The bench airplane: acceleration (kt/s), vertical-speed lag (s), level-off (fpm per foot to go), and the
     * calibrated airspeed at which it leaves the ground. */
    airplane: { ktPerS: 4, vsTau: 0.8, levelOff: 6, liftOffKcas: 55 },
    /** Test set: how fast it changes the pressures it holds (ft/min and kt/s), and its adapters' time constant. */
    testSet: { ftPerMin: 1500, ktPerS: 8, tau: 0.1 },
    /** G1000 air data computer: display lag of airspeed and altitude, and the filters on its vertical speed and the
     * airspeed trend (s). Garmin doesn't publish them. */
    adc: { tau: 0.1, vsTau: 1, trendTau: 1 },
    /** Indicator stops: the VSI needle stops at ±2,000 fpm. */
    vsiStop: 2000,
    /** Largest integration step (s). */
    maxStep: 1 / 120,
  },
} as const;

export type PitotStaticSpec = typeof PITOT_STATIC;
