/** The C172S's light definition, loaded with every page (aircraft/lazy.ts); the rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const C172S_META: AircraftMeta = {
  id: "c172s",
  short: "C172S",
  name: "C172S Skyhawk",
  sub: "NAV III G1000 · GFC 700 · IO-360",
  doc: "POH §7",
  systems: SYS,
};
