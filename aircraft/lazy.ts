/**
 * The fleet as the app loads it: each airplane's light meta (aircraft/<id>/meta.ts) in picker order, and a dynamic
 * import of the rest of it (aircraft/<id>/index.tsx), so a page ships only the airplanes it shows. Importing this module
 * registers it with lib/fleet. Tests and scripts that want every full definition import aircraft/index.ts instead.
 */
import { registerFleet } from "@/lib/fleet";
import type { AircraftId } from "@/lib/systems";
import type { AircraftDef } from "./types";
import { C172S_META } from "./c172s/meta";
import { C182T_META } from "./c182t/meta";
import { DA40_META } from "./da40/meta";
import { M20C_META } from "./m20c/meta";
import { SR20_META } from "./sr20/meta";
import { SR22T_META } from "./sr22t/meta";

export const FLEET_META = [SR20_META, SR22T_META, C172S_META, C182T_META, DA40_META, M20C_META];

/** Each airplane's code, by id (also used by tests/fleet.test.ts to check each loads the definition its meta names). */
export const LOADERS = {
  sr20: () => import("./sr20").then((m) => m.SR20),
  sr22t: () => import("./sr22t").then((m) => m.SR22T),
  c172s: () => import("./c172s").then((m) => m.C172S),
  c182t: () => import("./c182t").then((m) => m.C182T),
  da40: () => import("./da40").then((m) => m.DA40),
  m20c: () => import("./m20c").then((m) => m.M20C),
} satisfies Record<AircraftId, () => Promise<AircraftDef>>;

registerFleet(FLEET_META, LOADERS);

export * from "@/lib/fleet";
