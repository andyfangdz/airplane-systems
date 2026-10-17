/** The DA40's light definition: its route's paths and title (app/(fleet)/), and aircraft/metas.ts. The rest is in index.tsx. */
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
