"use client";
import { useTicker } from "@/components/ui/controls";
import type { AircraftDef } from "../types";
import { GROUND_Y } from "./geometry";
import { casMessages, live } from "./model";
import { Model } from "./Model";
import { Parachute, capsPhase } from "./Parachute";
import { Caps } from "./panels/caps";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Avionics, Cabin, Lighting, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { Environment, Pitot } from "./panels/air";
import { resetCaps, useSR20 } from "./store";
import { CAPS_CAM, SYS } from "./systems";
import { simTick } from "./tick";
import { useView } from "@/lib/view";

/** CAPS timeline readout in the viewport while the CAPS view is open. */
function CapsHud() {
  useTicker(100);
  const sys = useView((x) => x.sys);
  if (sys !== "caps") return null;
  const t = Math.max(0, live.capsT), [, title, sub] = live.capsT < 0 ? [0, "Ready", ""] : capsPhase(t);
  return <div className="caps-hud"><span>T + {t.toFixed(1)} s</span><b>{title}</b><span>{sub}</span></div>;
}

function useAlerts() {
  const s = useSR20((x) => x.s), E = useSR20((x) => x.E);
  const powered = E.pfd || E.mfd;
  return { powered, msgs: powered ? casMessages(s, E) : [] };
}

export const SR20: AircraftDef = {
  id: "sr20",
  short: "SR20",
  name: "SR20 G6",
  sub: "Perspective+ · IO-390 · 3D study model",
  doc: "POH §7",
  systems: SYS,
  groundY: GROUND_Y,
  pivotX: 1,
  Model,
  Overlay: Parachute,
  panels: {
    overview: Overview, airframe: Airframe, controls: Controls, flaps: Flaps, gear: Gear, engine: Engine, propeller: Propeller,
    fuel: Fuel, electrical: Electrical, lighting: Lighting, environment: Environment, pitot: Pitot, avionics: Avionics, cabin: Cabin, caps: Caps,
  },
  tick: simTick,
  useAlerts,
  alertTitle: "CAS",
  Hud: CapsHud,
  onSelect: (to) => { if (to !== "caps" && useSR20.getState().s.capsOn) resetCaps(); },
  resetCam: () => (useSR20.getState().s.capsOn ? CAPS_CAM : null),
};
