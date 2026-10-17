"use client";
import type { AircraftDef } from "@/aircraft/types";
import { clearSceneCamera, clearSceneParts } from "./registry";
import { useAircraftHover, useView, type AircraftSessionOwner } from "./view";

export interface AircraftSession {
  owner: AircraftSessionOwner;
  advance: (elapsed: number) => void;
  dispose: () => void;
}

let mounted: AircraftSession | null = null;

/**
 * Own the mounted aircraft, including its temporary study mode. Navigation within the aircraft keeps this session;
 * leaving for any route disposes it. A stale React cleanup cannot dispose a more recently mounted session.
 */
export function mountAircraftSession(def: AircraftDef): AircraftSession {
  mounted?.dispose();
  const owner: AircraftSessionOwner = { aircraft: def.id, token: Symbol(def.id) };
  const session: AircraftSession = {
    owner,
    advance(elapsed) {
      if (mounted === session && useView.getState().session === owner) def.advance(elapsed);
    },
    dispose() {
      if (mounted !== session) return;
      def.walk?.close();
      clearSceneCamera(owner);
      clearSceneParts(owner);
      useAircraftHover.getState().setHover(null);
      useView.setState({ session: null, walking: false, spot: null, focus: null });
      mounted = null;
    },
  };
  mounted = session;
  useView.setState({ session: owner });
  return session;
}
