import type { ComponentEntry } from "@/engines/components";
import type { EngineSpec } from "@/engines/types";
import { FLEET_INDEX } from "@/lib/fleet-index";
import type { PickerEntry } from "./Picker";

/** An engine's line under its name: model and rated power. */
export const engineSub = (e: EngineSpec) => `${e.model} · ${e.rating.hp} hp`;

/** The engine simulations as picker entries, each a link to its page. */
export const engineEntries = (engines: EngineSpec[], current?: string): PickerEntry[] =>
  engines.map((e) => ({
    id: e.id,
    name: e.name,
    sub: engineSub(e),
    current: e.id === current,
    href: `/engines/${e.id}`,
  }));

/** The airplanes as links, for pages that don't load them (the engine pages). */
export const airplaneLinks = (): PickerEntry[] => FLEET_INDEX.map((a) => ({ ...a, current: false, href: `/${a.id}` }));

/** The component simulations as picker entries, each a link to its page. */
export const componentEntries = (components: readonly ComponentEntry[], current?: string): PickerEntry[] =>
  components.map((c) => ({ ...c, current: c.id === current, href: `/components/${c.id}` }));
