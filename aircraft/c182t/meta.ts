/** The C182T's light definition: its route's paths and title (app/(fleet)/), and aircraft/metas.ts. The rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const C182T_META: AircraftMeta = {
  id: "c182t",
  short: "C182T",
  name: "C182T Skylane",
  sub: "NAV III G1000 · KAP 140 · IO-540",
  doc: "POH §7",
  systems: SYS,
};
