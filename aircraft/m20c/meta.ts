/** The M20C's light definition, loaded with every page (aircraft/lazy.ts); the rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const M20C_META: AircraftMeta = {
  id: "m20c",
  short: "M20C",
  name: "M20C Ranger",
  sub: "1968 · Johnson bar · O-360-A1D",
  doc: "OM Part I",
  systems: SYS,
};
