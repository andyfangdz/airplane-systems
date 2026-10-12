"use client";
import { create } from "zustand";
import { useView } from "@/lib/view";
import { allGroups, type EngineGroup, type ShownGroups } from "./engine-groups";
export const useEngineGroups = create<{ shown: ShownGroups; set: (g: EngineGroup, on: boolean) => void }>((set) => ({
  shown: allGroups(),
  set: (g, on) => {
    set((s) => ({ shown: { ...s.shown, [g]: on } }));
    useView.getState().setHover(null);
  },
}));
