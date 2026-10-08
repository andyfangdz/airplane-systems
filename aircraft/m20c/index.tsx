"use client";
import { useTicker } from "@/components/ui/controls";
import type { AircraftDef } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { warnings } from "./model";
import { Model } from "./Airplane";
import { CAT } from "./parts";
import { Environment, Pitot } from "./panels/air";
import { Cabin } from "./panels/cabin";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Lighting, Overview } from "./panels/general";
import { PositiveControl } from "./panels/pc";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { Vacuum } from "./panels/vacuum";
import { useM20C } from "./store";
import { SYS } from "./systems";
import { simTick } from "./tick";

/** Warning lights and horns: all dead with the master switch off (Ranger 4-9). */
function useAlerts() {
  useTicker(250);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E);
  const powered = E.bus > 0;
  return { powered, msgs: powered ? warnings(s, E) : [] };
}

/**
 * N6947N: the FAA registry lists it as a 1968 Mooney M20C Ranger, s/n 680194 (airworthiness date 25 Sep 1968), which fits
 * the photos (one-piece windshield, no dorsal fin) and the "Ranger" name Mooney introduced for 1968; the 1967 airplane was
 * still sold as the Mark 21. The model follows the 1968 configuration (fixed cowl flaps, fixed step, Vfe 125 mph) and says
 * where 1967 differed.
 */
export const M20C: AircraftDef = {
  id: "m20c",
  short: "M20C",
  name: "M20C Ranger",
  sub: "1968 · Johnson bar · O-360-A1D",
  doc: "OM Part I",
  systems: SYS,
  groundY: GROUND_Y,
  pivotX: 1.0,
  Model,
  panels: {
    overview: Overview,
    airframe: Airframe,
    controls: Controls,
    autopilot: PositiveControl,
    flaps: Flaps,
    gear: Gear,
    engine: Engine,
    propeller: Propeller,
    fuel: Fuel,
    electrical: Electrical,
    lighting: Lighting,
    vacuum: Vacuum,
    pitot: Pitot,
    environment: Environment,
    cabin: Cabin,
  },
  tick: simTick,
  useAlerts,
  alertTitle: "WARNING LIGHTS & HORNS",
  labels: { cat: CAT, inside: inFus },
};
