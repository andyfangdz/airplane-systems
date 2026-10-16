import type { ComponentType, RefObject } from "react";
import type * as THREE from "three";
import type { Catalogue } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { AircraftId, SysDef, SysId } from "@/lib/systems";

/** Crew-alerting level (defined in lib/systems.ts, re-exported for the airplanes). */
export type { CasLevel } from "@/lib/systems";

/** Groups the scene builds around the airplane model (used by effects like the CAPS deployment). */
export interface ModelRefs {
  /** Rotates the whole airplane about `pivotX` (pitch/roll during a CAPS descent). */
  rootRef: RefObject<THREE.Group | null>;
  /** The airplane model in airplane coordinates. */
  modelRef: RefObject<THREE.Group | null>;
  gridRef: RefObject<THREE.GridHelper | null>;
}

/**
 * The light part of an airplane: what the shell (rail, picker, panel heading, camera flights, URL) needs before the
 * airplane's code has loaded. Each lives in aircraft/<id>/meta.ts; aircraft/lazy.ts lists them and loads the rest on demand.
 */
export interface AircraftMeta {
  id: AircraftId;
  /** Fleet picker label, e.g. "C172S". */
  short: string;
  /** Rail heading, e.g. "C172S Skyhawk". */
  name: string;
  /** Rail sub-heading, e.g. "NAV III G1000 · GFC 700 · IO-360". */
  sub: string;
  /** Source document shorthand used in page refs, e.g. "POH §7" or "AFM §7". */
  doc: string;
  /** Systems in rail order; the first must be "overview". */
  systems: SysDef[];
}

/**
 * Everything the shared shell needs to show one airplane: its meta and its code (Model, panels, tick, alerts, …). Each
 * lives in aircraft/<id>/index.tsx, which the app loads only when that airplane is shown.
 */
export interface AircraftDef extends AircraftMeta {
  /** Ground plane height (m) for the grid. */
  groundY: number;
  /** x (m) about which the root group rotates; also the scene origin offset. */
  pivotX: number;
  /** Scene content in airplane coordinates (rendered inside the picking group). */
  Model: ComponentType;
  /**
   * The Model builds itself progressively (airframe first, then systems over several frames) and moves the loader's stages
   * itself (lib/build.ts); the scene then waits for the build before framing a camera preset on the model's bounds.
   */
  progressive?: boolean;
  /** Called once, when this airplane's code has loaded and before its Model mounts: start slow work early (SR22T: its
   * fuselage skin, in a worker, while the scene is still loading). */
  prepare?: () => void;
  /** Optional scene-level effect that needs the model groups (SR20 CAPS parachute). */
  Overlay?: ComponentType<ModelRefs>;
  /** Side-panel body per system. */
  panels: Partial<Record<SysId, ComponentType>>;
  /** Per-frame simulation step (dt seconds, clamped). */
  tick: (dt: number) => void;
  /** Aircraft-specific alert window with statically bound hooks. */
  Alerts: ComponentType;
  /** Optional overlay in the viewport (SR20 CAPS timeline HUD). */
  Hud?: ComponentType;
  /** Called when the selected system changes (e.g. stop the CAPS animation when leaving CAPS). */
  onSelect?: (to: SysId) => void;
  /** Label decluttering: rank pins by each part's own system and, in solid mode, hide interior labels when the camera is outside `inside`. */
  labels?: { cat: Catalogue; inside?: (p: THREE.Vector3) => boolean };
  /** Camera for "Reset view" when something special is going on (e.g. CAPS deployed); null = the system's camera. */
  resetCam?: () => [Vec3, Vec3] | null;
  /**
   * Optional guided preflight study walk: the toolbar's Preflight button opens and closes it, `Panel` replaces
   * the system panel while the view's `walking` is set, and `boot` handles the page's query string (`?walk=7`) on load.
   */
  walk?: { Panel: ComponentType; open: () => void; close: () => void; boot: (search: string) => void };
}
