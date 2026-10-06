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
import { useC172 } from "./store";
import { SYS } from "./systems";
import { simTick } from "./tick";

/** G1000 annunciation window: shown only while a display has power (oil pressure and vacuum change every frame, so poll). */
function useAlerts() {
  useTicker(400);
  const s = useC172((x) => x.s), E = useC172((x) => x.E);
  const powered = E.pfd || E.mfd;
  return { powered, msgs: powered ? annunciations(s, E) : [] };
}

export const C172S: AircraftDef = {
  id: "c172s",
  short: "C172S",
  name: "C172S Skyhawk",
  sub: "NAV III G1000 · GFC 700 · IO-360",
  doc: "POH §7",
  systems: SYS,
  groundY: GROUND_Y,
  pivotX: 0,
  Model,
  panels: {
    overview: Overview, airframe: Airframe, controls: Controls, flaps: Flaps, gear: Gear, cabin: Cabin, engine: Engine, propeller: Propeller,
    fuel: Fuel, electrical: Electrical, lighting: Lighting, environment: Environment, pitot: Pitot, vacuum: Vacuum, avionics: Avionics, autopilot: Autopilot,
  },
  tick: simTick,
  useAlerts,
  alertTitle: "ANNUNCIATIONS",
  labels: { cat: CAT, inside: inFus },
};
