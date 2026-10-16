/** The DA40's light definition, loaded with every page (aircraft/lazy.ts); the rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const DA40_META: AircraftMeta = {
  id: "da40",
  short: "DA40",
  name: "DA40 XLS",
  sub: "G1000 · GFC 700 · IO-360",
  doc: "AFM §7",
  systems: SYS,
};
