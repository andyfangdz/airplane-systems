/**
 * A single-acting flyweight propeller governor on the Lycoming IO-390-C (the Cirrus SR20 G6's engine), driving its
 * Hartzell constant-speed propeller. How a governor works, and the pump and relief-valve pressures, come from the FAA's
 * Aviation Maintenance Technician Handbook – Powerplant, chapter 7; the drive ratio, rated rpm and power from the IO-390
 * IOM; the propeller from the SR20 POH and AMM (see SOURCES.md). Everything under `model` is a constant the documents
 * don't give, chosen so the governor holds speed the way the handbook describes: they are not manufacturer data.
 */
import { IO390 } from "@/engines/io390/spec";

export const AMT = "FAA-H-8083-32B, ch. 7";

export const GOVERNOR = {
  id: "governor",
  name: "Propeller governor",
  sub: "Flyweight governor · IO-390 · Hartzell hub",
  lead:
    "A single-acting flyweight governor holding the rpm of a Lycoming IO-390-C and its Hartzell constant-speed " +
    "propeller: flyweights against a speeder spring move a pilot valve that meters boosted oil to or from the hub.",

  /** Engine and propeller, as the IO-390 simulation uses them (engines/io390/spec.ts cites each). */
  engine: {
    name: IO390.model,
    ratedHp: IO390.rating.hp,
    ratedRpm: IO390.rating.rpm,
    /** Governor drive: 0.895 × crankshaft speed, the C1B6/C3B6 front governor (IOM Table A-4). */
    driveRatio: IO390.accessories.governorRatio,
    /** Normal oil pressure at the rear of the engine, the governor's supply (IOM Table A-2). */
    oilPsi: IO390.limits.oilPressNormal,
  },
  propeller: IO390.propeller,

  /** Printed in the FAA handbook. */
  handbook: {
    /** "The higher oil pressure (approximately 300 pounds per square inch (psi)) provides a quicker blade-angle change." */
    boostPsi: { value: 300, src: `${AMT} p. 7-6` },
    /** The typical governor's relief valve, "set 275 psi". */
    reliefPsi: { value: 275, src: `${AMT} Figure 7-16` },
  },

  /**
   * Model constants (not published). Forces are along the pilot valve's axis; lengths in millimetres.
   */
  model: {
    /** Flyweight lift on the pilot valve at rated speed (N); it grows with the square of governor speed. */
    flyweightN: 90,
    /** Speeder spring rate (N/mm). The control lever sets its compression. */
    springRate: 4,
    /** Pilot valve travel to either stop from the centred position (mm). */
    valveTravel: 3,
    /** Land overlap: the valve covers the metering port within this much of centre (mm). */
    lap: 0.03,
    /** Port fully open this far past the land edge (mm). */
    portOpen: 2.4,
    /** Flyweight and valve lag (s). */
    valveTau: 0.025,
    /** Sticking pilot valve: it holds until the force imbalance moves it this far (mm), then jumps. */
    stickMm: 0.45,
    /** Governor gear pump: oil delivered per governor revolution as hub piston strokes (1 = a full stroke). */
    pumpStrokesPerRev: 0.01,
    /** Metering port flow: hub strokes per second through a fully open port with 100 psi across it. */
    portStrokesPerS: 0.4,
    /** Leakage out of the hub (transfer bushing, piston seal): strokes per second at 100 psi. */
    leakStrokesPerS: 0.02,
    /** Pressure in the hub that holds the blades against their return force at rated speed (psi): twisting moment
     * (non-counterweighted) or counterweights (counterweighted). It grows with the square of speed. */
    returnPsi: 100,
    /** The hub's return spring (Figure 7-24 draws one in the non-counterweighted hub), psi equivalent. */
    springPsi: 25,
    /** A worn governor pump delivers this fraction of its flow. */
    wornPump: 0.12,
    /** Relief valve stuck open: the pump can only raise this much pressure (psi). */
    stuckReliefPsi: 90,
  },
} as const;

export type GovernorSpec = typeof GOVERNOR;
