"use client";
import { AlertWindow } from "@/components/AlertWindow";
import { fleetWalkUi } from "@/components/FleetWalkaround";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { AircraftDef } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { live, annunciations } from "./model";
import { Model } from "./Airplane";
import { Environment, Pitot, Vacuum } from "./panels/air";
import { Autopilot, Avionics } from "./panels/avionics";
import { Electrical, Lighting } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Cabin, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { CAT } from "./parts";
import { c172Runtime, useC172 } from "./store";
import { C172S_META } from "./meta";
import { walkController } from "./walk-store";

/** G1000 annunciation window: shown only while a display has power (oil pressure and vacuum change every frame, so poll). */
function Alerts() {
  const snapshot = useLiveSnapshot(live, 400);
  const s = useC172((x) => x.s),
    E = useC172((x) => x.E);
  const powered = E.pfd || E.mfd;
  return <AlertWindow title="ANNUNCIATIONS" powered={powered} msgs={powered ? annunciations(s, E, snapshot) : []} />;
}

const WALK = fleetWalkUi(walkController);

export const C172S: AircraftDef = {
  ...C172S_META,
  groundY: GROUND_Y,
  pivotX: 0,
  Model,
  Overlay: WALK.Marker,
  panels: {
    overview: Overview,
    airframe: Airframe,
    controls: Controls,
    flaps: Flaps,
    gear: Gear,
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
  advance: c172Runtime.advance,
  Alerts,
  labels: { cat: CAT, inside: inFus },
  walk: WALK.walk,
};
