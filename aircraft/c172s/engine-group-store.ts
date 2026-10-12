"use client";
import { create } from "zustand";
import { useView } from "@/lib/view";
import { allGroups, type ShownGroups, type EngineGroup } from "./engine-groups";
export const useEngineGroups = create<{ shown: ShownGroups; set: (group: EngineGroup, on: boolean) => void }>(
  (set) => ({
    shown: allGroups(),
    set: (group, on) => {
      set((s) => ({ shown: { ...s.shown, [group]: on } }));
      useView.getState().setHover(null);
    },
  }),
);
