/** The fleet, in picker order. Importing this module registers it with lib/fleet. */
import { registerFleet } from "@/lib/fleet";
import { C172S } from "./c172s";
import { C182T } from "./c182t";
import { DA40 } from "./da40";
import { SR20 } from "./sr20";

export const FLEET = [SR20, C172S, C182T, DA40];
registerFleet(FLEET);

export * from "@/lib/fleet";
