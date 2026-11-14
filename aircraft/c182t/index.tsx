"use client";
import { AlertWindow } from "@/components/AlertWindow";
import { fleetWalkUi } from "@/components/FleetWalkaround";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { useView } from "@/lib/view";
import type { AircraftDef, ModelRefs } from "../types";
import { BRS_CAM, brsPhase } from "./brs";
import { GROUND_Y, inFus } from "./geometry";
import { live, annunciations } from "./model";
import { Model } from "./Airplane";
import { Parachute } from "./Parachute";
import { Brs } from "./panels/brs";
import { Environment, Pitot, Vacuum } from "./panels/air";
import { Autopilot, Avionics } from "./panels/avionics";
import { Electrical, Lighting } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Cabin, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { CAT } from "./parts";
import { c182Runtime, resetBrs, useC182 } from "./store";
import { C182T_META } from "./meta";
import { walkController } from "./walk-store";

/** G1000 annunciation window (with the KAP 140 PITCH TRIM): shown only while a display has power (oil pressure and vacuum change every frame, so poll). */
function Alerts() {
  const snapshot = useLiveSnapshot(live, 400);
  const s = useC182((x) => x.s),
    E = useC182((x) => x.E);
  const powered = E.pfd || E.mfd;
  return (
    <AlertWindow
      title="ANNUNCIATIONS"
      powered={powered}
      msgs={powered ? annunciations(s, E, undefined, snapshot) : []}
    />
  );
}

const WALK = fleetWalkUi(walkController);

/** The walk marker, and the optional BRS deployment (drawn only while it is installed and deployed). */
function Overlay(refs: ModelRefs) {
  return (
    <>
      <Parachute {...refs} />
      <WALK.Marker />
    </>
  );
}

/** BRS deployment timeline readout in the viewport while the BRS view is open with the parachute installed. */
function BrsHud() {
  const snapshot = useLiveSnapshot(live, 100);
  const sys = useView((x) => x.sys);
  const installed = useC182((x) => x.s.brs.installed);
  if (sys !== "brs" || !installed) return null;
  const t = Math.max(0, snapshot.brsT),
    [, title, sub] = snapshot.brsT < 0 ? [0, "Ready", ""] : brsPhase(t);
  return (
    <div className="caps-hud">
      <span>T + {t.toFixed(1)} s</span>
      <b>{title}</b>
      <span className="sub">{sub}</span>
    </div>
  );
}

export const C182T: AircraftDef = {
  ...C182T_META,
  groundY: GROUND_Y,
  pivotX: 0,
  Model,
  Overlay,
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
    brs: Brs,
  },
  advance: c182Runtime.advance,
  Alerts,
  Hud: BrsHud,
  onSelect: (to) => {
    if (to !== "brs" && useC182.getState().s.brs.deployed) resetBrs();
  },
  resetCam: () => (useC182.getState().s.brs.deployed ? BRS_CAM : null),
  labels: { cat: CAT, inside: inFus },
  walk: WALK.walk,
};
