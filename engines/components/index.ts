/**
 * Standalone component simulations (`/components/<id>`): one aircraft system or engine accessory on its own, bigger than it is drawn on
 * an engine, with its own controls. Each folder here holds a component's model and its SOURCES.md; its page is in
 * `components/engine/<id>/`, loaded by `components/engine/ComponentPage.tsx`, whose map is keyed by `ComponentId` so
 * the two can't drift (and `tests/component-pages.test.ts` checks it). This list is the picker order.
 */
import { GOVERNOR } from "./governor/spec";

export interface ComponentEntry {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** The picker's line under the name: the type modelled. */
  sub: string;
  /** One sentence for the page description. */
  lead: string;
}

export const COMPONENTS = [
  {
    id: "pitot-static",
    name: "Pitot-static system",
    sub: "Pressure instruments · alternate static",
    lead: "Explore pitot and static pressures, airspeed, altitude and vertical speed, alternate static, icing, leaks and trapped-pressure failures.",
  },
  {
    id: "piston-cylinder",
    name: "Piston cylinder",
    sub: "Four-stroke cycle · IO-390 geometry",
    lead: "Explore a piston, connecting rod, crankshaft and valves through the four-stroke cycle in an animated cutaway.",
  },
  {
    id: "carburetor",
    name: "Carburetor",
    sub: "Marvel-Schebler MA-4-5 float carburetor",
    lead: "The float carburetor of a Lycoming O-360-A1D in cutaway, running: float chamber, venturi and nozzle, idle system, accelerating pump, mixture valve and carburetor ice.",
  },
  {
    id: "fuel-injector",
    name: "Fuel injection",
    sub: "RSA-type servo, flow divider, nozzles",
    lead: "The RSA continuous-flow fuel injection system on the IO-390: servo injector, flow divider and air-bleed nozzles, cut away.",
  },
  {
    id: "surefly",
    name: "SureFly SIM",
    sub: "Electronic ignition",
    lead: "SureFly SIM4P electronic ignition module: dip switch timing, advance with rpm and manifold pressure, the timing light and wasted spark.",
  },
  { id: GOVERNOR.id, name: GOVERNOR.name, sub: GOVERNOR.sub, lead: GOVERNOR.lead },
] as const satisfies readonly ComponentEntry[];

export type ComponentId = (typeof COMPONENTS)[number]["id"];

export const COMPONENT_IDS = COMPONENTS.map((c) => c.id);

export const componentById = (id: string) => COMPONENTS.find((c) => c.id === id);
