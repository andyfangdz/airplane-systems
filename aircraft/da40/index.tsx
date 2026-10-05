"use client";
import { useTicker } from "@/components/ui/controls";
import type { AircraftDef } from "../types";
import { GROUND_Y, inFus } from "./geometry";
import { annunciations, displays } from "./model";
import { Model } from "./Model";
import { CAT } from "./parts";
import { Environment, Pitot } from "./panels/air";
import { Autopilot, Avionics } from "./panels/avionics";
import { Cabin } from "./panels/cabin";
import { Electrical } from "./panels/electrical";
import { Controls, Flaps, Gear } from "./panels/flight";
import { Airframe, Lighting, Overview } from "./panels/general";
import { Engine, Fuel, Propeller } from "./panels/powerplant";
import { useDA40 } from "./store";
import { SYS } from "./systems";
import { simTick } from "./tick";

/** G1000 annunciation window: shown only while a display has power (PFD, or the MFD in reversionary mode). */
function useAlerts() {
  useTicker(250);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E);
  const d = displays(s, E), powered = d.pfd || d.mfd;
  return { powered, msgs: powered ? annunciations(s, E) : [] };
}

export const DA40: AircraftDef = {
  id: "da40",
  short: "DA40",
  name: "DA40 XLS",
  sub: "G1000 · GFC 700 · IO-360",
  doc: "AFM §7",
  systems: SYS,
  groundY: GROUND_Y,
  pivotX: 0.3,
  Model,
  panels: {
    overview: Overview, airframe: Airframe, controls: Controls, flaps: Flaps, gear: Gear, engine: Engine, propeller: Propeller,
    fuel: Fuel, electrical: Electrical, lighting: Lighting, environment: Environment, pitot: Pitot, avionics: Avionics,
    autopilot: Autopilot, cabin: Cabin,
  },
  tick: simTick,
  useAlerts,
  alertTitle: "ANNUNCIATIONS",
  labels: { cat: CAT, inside: inFus },
};
