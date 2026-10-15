import type { AircraftId } from "./systems";

/**
 * The fleet's picker entries, in picker order, for pages that don't load the airplanes (the engine pages link back to
 * them). Each airplane's own definition is the source; tests/fleet.test.ts checks this list against it.
 */
export const FLEET_INDEX: { id: AircraftId; name: string; sub: string; walk: boolean }[] = [
  { id: "sr20", name: "SR20 G6", sub: "Perspective+ · GFC 700 · IO-390", walk: true },
  { id: "sr22t", name: "SR22T G6", sub: "Perspective+ · GFC 700 · TSIO-550-K", walk: true },
  { id: "c172s", name: "C172S Skyhawk", sub: "NAV III G1000 · GFC 700 · IO-360", walk: true },
  { id: "c182t", name: "C182T Skylane", sub: "NAV III G1000 · KAP 140 · IO-540", walk: true },
  { id: "da40", name: "DA40 XLS", sub: "G1000 · GFC 700 · IO-360", walk: true },
  { id: "m20c", name: "M20C Ranger", sub: "1968 · Johnson bar · O-360-A1D", walk: true },
];
