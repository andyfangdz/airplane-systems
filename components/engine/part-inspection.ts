import { createStore } from "zustand/vanilla";

export interface InspectedPart {
  id: string;
  name: string;
  note: string;
}

interface RegisteredPart extends InspectedPart {
  /** Mesh visibility, including its ancestors; transparent cutaways are still available to inspect. */
  available: () => boolean;
}

interface InspectionState {
  parts: readonly InspectedPart[];
  selected: string | null;
  reveal: number;
  select: (name: string | null, fromModel?: boolean) => void;
  register: (part: RegisteredPart) => () => void;
  refresh: () => void;
}

/** One registry per mounted study page. Duplicate mesh names share one explanation and selection. */
export function createPartInspection() {
  const registered = new Map<string, RegisteredPart>();
  return createStore<InspectionState>((set, get) => {
    const refresh = () => {
      const parts = [...registered.values()].filter((part) => part.available());
      const previous = get();
      const selected = parts.some((part) => part.name === previous.selected) ? previous.selected : null;
      if (
        selected !== previous.selected ||
        parts.length !== previous.parts.length ||
        parts.some((part, index) => part !== previous.parts[index])
      )
        set({ parts, selected });
    };
    return {
      parts: [],
      selected: null,
      reveal: 0,
      select: (name, fromModel = false) => {
        refresh();
        const selected = name !== null && get().parts.some((part) => part.name === name) ? name : null;
        set({ selected, reveal: get().reveal + (selected && fromModel ? 1 : 0) });
      },
      register: (part) => {
        registered.set(part.id, part);
        refresh();
        return () => {
          // A stale effect cleanup cannot unregister a newer registration with the same React identity.
          if (registered.get(part.id) !== part) return;
          registered.delete(part.id);
          refresh();
        };
      },
      refresh,
    };
  });
}

export type PartInspectionStore = ReturnType<typeof createPartInspection>;

/** Keep parts with a documented explanation first when a name occurs on multiple meshes. */
export function distinctParts(parts: readonly InspectedPart[], query = "") {
  const byName = new Map<string, InspectedPart>();
  for (const part of parts) {
    const previous = byName.get(part.name);
    if (!previous || (!previous.note && part.note)) byName.set(part.name, part);
  }
  const needle = query.trim().toLocaleLowerCase();
  return [...byName.values()]
    .filter((part) => `${part.name} ${part.note}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
}
