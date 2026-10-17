"use client";
import { AlertWindow } from "@/components/AlertWindow";
import { fleetWalkUi } from "@/components/FleetWalkaround";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { AircraftDef } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { live, annunciations, displays } from "./model";
import { Model } from "./Airplane";
import { CAT } from "./parts";
import { Environment, Pitot } from "./panels/air";
import { Autopilot, Avionics } from "./panels/avionics";
import { Cabin } from "./panels/cabin";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Lighting, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { da40Runtime, useDA40 } from "./store";
import { DA40_META } from "./meta";
import { walkController } from "./walk-store";

/** G1000 annunciation window: shown only while a display has power (PFD, or the MFD in reversionary mode). */
function Alerts() {
  const snapshot = useLiveSnapshot(live, 250);
  const s = useDA40((x) => x.s),
    E = useDA40((x) => x.E);
  const d = displays(s, E),
    powered = d.pfd || d.mfd;
  return <AlertWindow title="ANNUNCIATIONS" powered={powered} msgs={powered ? annunciations(s, E, snapshot) : []} />;
}

const WALK = fleetWalkUi(walkController);

export const DA40: AircraftDef = {
  ...DA40_META,
  groundY: GROUND_Y,
  pivotX: 0.3,
  Model,
  Overlay: WALK.Marker,
  panels: {
    overview: Overview,
    airframe: Airframe,
    controls: Controls,
    flaps: Flaps,
    gear: Gear,
    engine: Engine,
    propeller: Propeller,
    fuel: Fuel,
    electrical: Electrical,
    lighting: Lighting,
    environment: Environment,
    pitot: Pitot,
    avionics: Avionics,
    autopilot: Autopilot,
    cabin: Cabin,
  },
  advance: da40Runtime.advance,
  Alerts,
  labels: { cat: CAT, inside: inFus },
  walk: WALK.walk,
};
