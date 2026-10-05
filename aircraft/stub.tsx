"use client";
/** Placeholder airplane used until an airplane's module is built (replace with a full AircraftDef). */
import type { AircraftId } from "@/lib/systems";
import type { AircraftDef } from "./types";

export function stubAircraft(o: Pick<AircraftDef, "short" | "name" | "sub" | "doc"> & { id: AircraftId }): AircraftDef {
  return {
    ...o,
    systems: [{ id: "overview", name: "Overview", pg: "7-1", key: "accent", cam: [[7.5, 4.2, 9.5], [0.5, -0.2, 0]], blurb: "" }],
    groundY: -1.39,
    pivotX: 0,
    Model: () => null,
    panels: { overview: () => <p className="lead">The {o.name} model is being built.</p> },
    tick: () => {},
    useAlerts: () => ({ powered: false, msgs: [] }),
    alertTitle: "ANNUNCIATIONS",
  };
}
