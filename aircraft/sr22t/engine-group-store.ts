"use client";
import { createEngineGroupStore } from "@/lib/engine-group-store";
import { parseGroups } from "./engine-groups";

/** Viewing state survives simulation resets; reloads are initialised only from the URL. */
export const useEngineGroups = createEngineGroupStore(
  parseGroups(typeof location === "undefined" ? "" : location.search),
);
