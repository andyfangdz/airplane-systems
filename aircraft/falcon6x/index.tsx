"use client";
import type { AircraftDef } from "../types";
import { Model } from "./Airplane";
import { FUSE, GROUND_Y } from "./geometry";
import { FALCON6X_META } from "./meta";
import { PANELS } from "./panels";
import { CAT } from "./parts";

export const FALCON6X: AircraftDef = {
  ...FALCON6X_META,
  groundY: GROUND_Y,
  pivotX: 0,
  Model,
  panels: PANELS,
  // This study shows pilot-selected poses without running a flight or systems simulation.
  advance: () => {},
  Alerts: () => null,
  labels: { cat: CAT, inside: FUSE.inside },
};
