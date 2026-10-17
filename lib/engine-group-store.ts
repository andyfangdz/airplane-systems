"use client";
import { create } from "zustand";
import { allGroups, type EngineGroup, type ShownGroups } from "./engine-groups";
import { useView } from "./view";

export interface EngineGroupState {
  shown: ShownGroups;
  set: (group: EngineGroup, on: boolean) => void;
}

/**
 * One airplane's Engine-view group toggles (see `engine-groups.ts`), `shown` at first. Toggling clears the hover, since
 * the hovered part may have just been hidden.
 */
export const createEngineGroupStore = (shown: ShownGroups = allGroups()) =>
  create<EngineGroupState>((set) => ({
    shown,
    set: (group, on) => {
      set((state) => ({ shown: { ...state.shown, [group]: on } }));
      useView.getState().setHover(null);
    },
  }));
