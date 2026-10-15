/**
 * Component simulations: one engine accessory at a time, drawn large and cut away, at `/parts/<id>`. Each runs on one
 * of the standalone engines (`engines/`), so what it meters, governs or fires follows a calibrated engine.
 */

export interface PartSim {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** The picker's second line: the unit and the engine it is shown on. */
  sub: string;
  /** One paragraph for the panel. */
  lead: string;
}

export const PARTS: PartSim[] = [
  {
    id: "fuel-injector",
    name: "Fuel injection",
    sub: "RSA servo, flow divider, nozzles · IO-390",
    lead:
      "The Precision (Bendix) RSA continuous-flow fuel injection system as fitted to the Lycoming IO-390-C: a servo " +
      "fuel injector that meters fuel against the air flowing through its throttle body, a flow divider that keeps " +
      "the metered fuel under pressure and splits it four ways, and an air-bleed nozzle in each cylinder head. It " +
      "runs on the IO-390 engine simulation, so the fuel flows and nozzle pressures are the engine's own.",
  },
];

export const PART_IDS = PARTS.map((p) => p.id);

export const partById = (id: string) => PARTS.find((p) => p.id === id);
