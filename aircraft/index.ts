/**
 * The whole fleet, every airplane's full definition, in picker order: for tests and scripts. Importing this module
 * registers it with lib/fleet, all loaded. The app imports aircraft/lazy.ts instead, which loads each airplane on demand.
 */
import { registerFleet } from "@/lib/fleet";
import { C172S } from "./c172s";
import { C182T } from "./c182t";
import { DA40 } from "./da40";
import { M20C } from "./m20c";
import { SR20 } from "./sr20";
import { SR22T } from "./sr22t";

export const FLEET = [SR20, SR22T, C172S, C182T, DA40, M20C];
registerFleet(FLEET);

export * from "@/lib/fleet";
