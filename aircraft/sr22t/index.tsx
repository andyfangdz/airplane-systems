"use client";
import { AlertWindow } from "@/components/AlertWindow";
import { fleetWalkUi } from "@/components/FleetWalkaround";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { AircraftDef, ModelRefs } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { casMessages, live } from "./model";
import { SceneModel } from "./Airplane";
import { fuselageInWorker } from "./fuselage-geo";
import { Parachute, capsPhase } from "./Parachute";
import { CAT } from "./parts";
import { Caps } from "./panels/caps";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Avionics, Cabin, Doors, Lighting, Overview } from "./panels/general";
import { Oxygen } from "./panels/oxygen";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { Ice } from "./panels/ice";
import { Environment, Pitot } from "./panels/air";
import { resetCaps, sr22Runtime, useSR22T } from "./store";
import { CAPS_CAM } from "./systems";
import { SR22T_META } from "./meta";
import { useView } from "@/lib/view";
import { walkController } from "./walk-store";

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

const WALK = fleetWalkUi(walkController);

/** Scene effects: the CAPS deployment and the walk-around's item marker. */
function Overlay(refs: ModelRefs) {
  return (
    <>
      <Parachute {...refs} />
      <WALK.Marker />
    </>
  );
}

function Alerts() {
  const s = useSR22T((x) => x.s),
    E = useSR22T((x) => x.E);
  const powered = E.pfd || E.mfd;
  return <AlertWindow title="CAS" powered={powered} msgs={powered ? casMessages(s, E) : []} />;
}

export const SR22T: AircraftDef = {
  ...SR22T_META,
  groundY: GROUND_Y,
  pivotX: 1,
  Model: SceneModel,
  progressive: true,
  // Warm-up errors are surfaced by the mounted scene's awaited preparation and Retry boundary.
  prepare: () => void fuselageInWorker().catch(() => {}),
  Overlay,
  panels: {
    overview: Overview,
    airframe: Airframe,
    doors: Doors,
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
    ice: Ice,
    avionics: Avionics,
    cabin: Cabin,
    oxygen: Oxygen,
    caps: Caps,
  },
  advance: sr22Runtime.advance,
  Alerts,
  Hud: CapsHud,
  onSelect: (to) => {
    if (to !== "caps" && useSR22T.getState().s.capsOn) resetCaps();
  },
  labels: { cat: CAT, inside: inFus },
  resetCam: () => (useSR22T.getState().s.capsOn ? CAPS_CAM : null),
  walk: WALK.walk,
};
