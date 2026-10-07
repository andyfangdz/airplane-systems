"use client";
import { useTicker } from "@/components/ui/controls";
import type { AircraftDef } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { annunciations } from "./model";
import { Model } from "./Airplane";
import { Environment, Pitot, Vacuum } from "./panels/air";
import { Autopilot, Avionics } from "./panels/avionics";
import { Electrical, Lighting } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Cabin, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { CAT } from "./parts";
import "./parts-systems";
import { useC182 } from "./store";
import { SYS } from "./systems";
import { simTick } from "./tick";

/** G1000 annunciation window (with the KAP 140 PITCH TRIM): shown only while a display has power (oil pressure and vacuum change every frame, so poll). */
function useAlerts() {
  useTicker(400);
  const s = useC182((x) => x.s),
    E = useC182((x) => x.E);
  const powered = E.pfd || E.mfd;
  return { powered, msgs: powered ? annunciations(s, E) : [] };
}

export const C182T: AircraftDef = {
  id: "c182t",
  short: "C182T",
  name: "C182T Skylane",
  sub: "NAV III G1000 · KAP 140 · IO-540",
  doc: "POH §7",
  systems: SYS,
  groundY: GROUND_Y,
  pivotX: 0,
  Model,
  panels: {
    overview: Overview,
    airframe: Airframe,
    controls: Controls,
    gear: Gear,
    flaps: Flaps,
    cabin: Cabin,
    engine: Engine,
    propeller: Propeller,
    fuel: Fuel,
    electrical: Electrical,
    lighting: Lighting,
    environment: Environment,
    pitot: Pitot,
    vacuum: Vacuum,
    avionics: Avionics,
    autopilot: Autopilot,
  },
  tick: simTick,
  useAlerts,
  alertTitle: "ANNUNCIATIONS",
  labels: { cat: CAT, inside: inFus },
};
