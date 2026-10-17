/** The SR20's light definition: its route's paths and title (app/(fleet)/), and aircraft/metas.ts. The rest is in index.tsx. */
import type { AircraftMeta } from "../types";
import { SYS } from "./systems";

export const SR20_META: AircraftMeta = {
  id: "sr20",
  short: "SR20",
  name: "SR20 G6",
  sub: "Perspective+ · GFC 700 · IO-390",
  doc: "POH §7",
  systems: SYS,
};
