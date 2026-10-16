/** The SR22T's light definition, loaded with every page (aircraft/lazy.ts); the rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const SR22T_META: AircraftMeta = {
  id: "sr22t",
  short: "SR22T",
  name: "SR22T G6",
  sub: "Perspective+ · GFC 700 · TSIO-550-K",
  doc: "POH §7",
  systems: SYS,
};
