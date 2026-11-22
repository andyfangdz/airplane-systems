import type * as THREE from "three";
import { createStore } from "zustand/vanilla";

export interface InspectedPart {
  id: string;
  name: string;
  note: string;
}

export interface SelectedPartAnchor {
  /** Stage-relative click coordinates when picked directly on the canvas. */
  x?: number;
  y?: number;
  /** 3D mesh and local hit point so the tooltip tracks camera and assembly motion. */
  object?: THREE.Object3D;
  local?: THREE.Vector3;
}

interface RegisteredPart extends InspectedPart {
  /** Mesh visibility, including its ancestors; transparent cutaways are still available to inspect. */
  available: () => boolean;
  /** Live 3D mesh for projecting the selected part's tooltip when picked from the inspector list. */
  getObject?: () => THREE.Object3D | null;
}

interface InspectionState {
  parts: readonly InspectedPart[];
  selected: string | null;
  anchor: SelectedPartAnchor | null;
  reveal: number;
  select: (name: string | null, fromModel?: boolean, anchor?: SelectedPartAnchor | null) => void;
  objectFor: (name: string) => THREE.Object3D | null;
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
      const anchor = selected ? previous.anchor : null;
      if (
        selected !== previous.selected ||
        anchor !== previous.anchor ||
        parts.length !== previous.parts.length ||
        parts.some((part, index) => part !== previous.parts[index])
      )
        set({ parts, selected, anchor });
    };
    return {
      parts: [],
      selected: null,
      anchor: null,
      reveal: 0,
      select: (name, fromModel = false, anchor = null) => {
        refresh();
        const selected = name !== null && get().parts.some((part) => part.name === name) ? name : null;
        set({ selected, anchor: selected ? anchor : null, reveal: get().reveal + (selected && fromModel ? 1 : 0) });
      },
      objectFor: (name) => {
        for (const part of registered.values()) {
          if (part.name === name && part.available()) {
            const object = part.getObject?.() ?? null;
            if (object) return object;
          }
        }
        return null;
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
