"use client";
import { AlertWindow } from "@/components/AlertWindow";
import { fleetWalkUi } from "@/components/FleetWalkaround";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { AircraftDef, ModelRefs } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { casMessages, live } from "./model";
import { Model } from "./Airplane";
import { Parachute, capsPhase } from "./Parachute";
import { CAT } from "./parts";
import { Caps } from "./panels/caps";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Avionics, Cabin, Doors, Lighting, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { Environment, Pitot } from "./panels/air";
import { resetCaps, useSR20 } from "./store";
import { CAPS_CAM } from "./systems";
import { SR20_META } from "./meta";
import { simTick } from "./tick";
import { useView } from "@/lib/view";
import { walkController } from "./walk-store";

const WALK = fleetWalkUi(walkController);

function Overlay(refs: ModelRefs) {
  return (
    <>
      <Parachute {...refs} />
      <WALK.Marker />
    </>
  );
}

/** CAPS timeline readout in the viewport while the CAPS view is open. */
function CapsHud() {
  const snapshot = useLiveSnapshot(live, 100);
  const sys = useView((x) => x.sys);
  if (sys !== "caps") return null;
  const t = Math.max(0, snapshot.capsT),
    [, title, sub] = snapshot.capsT < 0 ? [0, "Ready", ""] : capsPhase(t);
  return (
    <div className="caps-hud">
      <span>T + {t.toFixed(1)} s</span>
      <b>{title}</b>
      <span className="sub">{sub}</span>
    </div>
  );
}

function Alerts() {
  const s = useSR20((x) => x.s),
    E = useSR20((x) => x.E);
  const powered = E.pfd || E.mfd;
  return <AlertWindow title="CAS" powered={powered} msgs={powered ? casMessages(s, E) : []} />;
}

export const SR20: AircraftDef = {
  ...SR20_META,
  groundY: GROUND_Y,
  pivotX: 1,
  Model,
  Overlay,
  panels: {
    overview: Overview,
    airframe: Airframe,
    controls: Controls,
    flaps: Flaps,
    gear: Gear,
    doors: Doors,
    engine: Engine,
    propeller: Propeller,
    fuel: Fuel,
    electrical: Electrical,
    lighting: Lighting,
    environment: Environment,
    pitot: Pitot,
    avionics: Avionics,
    cabin: Cabin,
    caps: Caps,
  },
  tick: simTick,
  Alerts,
  Hud: CapsHud,
  onSelect: (to) => {
    if (to !== "caps" && useSR20.getState().s.capsOn) resetCaps();
  },
  labels: { cat: CAT, inside: inFus },
  resetCam: () => (useSR20.getState().s.capsOn ? CAPS_CAM : null),
  walk: WALK.walk,
};
