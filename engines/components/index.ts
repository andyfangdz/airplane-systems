/**
 * Standalone component simulations (`/components/<id>`): one engine accessory on its own, bigger than it is drawn on
 * an engine, with its own controls. Each folder here holds a component's model and its SOURCES.md; its page is in
 * `components/engine/<id>/`, listed in `components/engine/ComponentPage.tsx`. This list is the picker order.
 */
export interface ComponentEntry {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** The picker's line under the name: the type modelled. */
  sub: string;
  /** One sentence for the page description. */
  lead: string;
}

export const COMPONENTS: ComponentEntry[] = [];

export const COMPONENT_IDS = COMPONENTS.map((c) => c.id);

export const componentById = (id: string) => COMPONENTS.find((c) => c.id === id);
