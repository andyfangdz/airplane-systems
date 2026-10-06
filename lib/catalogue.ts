/**
 * Declarative part catalogue shared by every airplane.
 * Geometry is built lazily (browser only). Positions are in airplane coordinates unless the
 * part has a `parent`, in which case they are relative to that moving group.
 */
import type * as THREE from "three";
import type { Vec3 } from "./math";
import type { Chan, SysId } from "./systems";
import { narrowLayout } from "./view";

/** Per-frame hook for parts that animate or change material with the sim (t = clock seconds). */
export type PartAnim = (mesh: THREE.Mesh, t: number) => void;

export interface PartSpec {
  id: string;
  geo: () => THREE.BufferGeometry;
  sys: SysId[];
  name?: string;
  note?: string;
  /** Gets a label pin in its systems' views (first part of each name only). */
  pin?: boolean;
  /** Show the label pin only in these system views (it still appears in every pinned system's "tap to locate" list). */
  pinIn?: SysId[];
  /** Intentionally outside the skin (gear, antennas, probes…). */
  ext?: boolean;
  color?: string;
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  /** Moving group this part rides on (e.g. "surf:elevR", "blade:0"); the airplane's Model renders it. */
  parent?: string;
  anim?: PartAnim;
  /** Translucent plate (bulkheads, firewalls). */
  plate?: boolean;
  /**
   * Cover over other modelled parts (wheel pants, heater shrouds, rear windows, pedestals): in X-ray it ghosts like the skin —
   * rim-lit in the overview, tinted with its first system's colour in its own systems' views — and picks like the skin, so what
   * it covers stays visible and hoverable. Solid when X-ray is off.
   */
  fairing?: boolean;
  /** Flight-control channel(s) this part belongs to (for the channel focus view). */
  chan?: Chan[];
}

export interface ShellSpec {
  id: string;
  geo: () => THREE.BufferGeometry;
  name: string;
  note: string;
  /** Painter for the solid-mode skin texture (needs UVs on the geometry). */
  skin?: () => THREE.Texture;
}

/** Control surface hinged at `pivot` about `axis`; its geometry is already hinge-relative. */
export interface SurfaceSpec { key: string; geo: () => THREE.BufferGeometry; pivot: Vec3; axis: Vec3; sys: SysId[]; name: string; note: string; chan?: Chan[] }

/** Pipe / wire / duct / cable with moving particles. */
export interface FlowSpec {
  key: string;
  pts: (Vec3 | THREE.Vector3)[];
  sys: SysId[];
  name?: string;
  note?: string;
  color?: string;
  /** Particle colour (defaults to `color`, then the system colour). */
  pcolor?: string;
  r?: number;
  /** false = particles only, no pipe. */
  tube?: boolean;
  count?: number;
  size?: number;
  tension?: number;
  ext?: boolean;
  chan?: Chan[];
}

/** Channel from a surface/cable key prefix: elev…/el… → elevator, ail… → aileron, rud… → rudder. */
export const chanOfKey = (k: string): Chan[] | undefined =>
  k.startsWith("elev") || k.startsWith("el") ? ["elevator"] : k.startsWith("ail") ? ["aileron"] : k.startsWith("rud") ? ["rudder"] : undefined;

type PartOpts = Omit<PartSpec, "id" | "geo" | "sys">;

/**
 * Per-view label lists, by part name, for views that would otherwise pile labels up. Names that match no pinned part of the
 * view are reported in development, so renaming a part can't silently bring its label back.
 */
export interface LabelLists {
  /** Pinned parts that stay in a view's "tap to locate" list but carry no label pin there. */
  quiet?: Partial<Record<SysId, string[]>>;
  /** Phone layout (lib/view `narrowLayout`): the only parts labelled in a view; the list keeps them all. */
  narrow?: Partial<Record<SysId, string[]>>;
}

/** Collects one airplane's parts, shells and control surfaces. Methods are bound, so they can be destructured. */
export class Catalogue {
  readonly parts: PartSpec[] = [];
  readonly shells: ShellSpec[] = [];
  readonly surfaces: SurfaceSpec[] = [];
  private n = 0;
  private byParent = new Map<string, PartSpec[]>();
  private pins = new Map<SysId, PartSpec[]>();
  private pinIds = new Map<string, Set<string>>();

  constructor(readonly prefix: string, readonly labels: LabelLists = {}) {}

  uid = (s: string) => `${this.prefix}/${s}-${this.n++}`;

  part = (geo: () => THREE.BufferGeometry, sys: SysId[], o: PartOpts = {}) => {
    const spec: PartSpec = { id: this.uid(o.name || "part"), geo, sys, ...o };
    this.parts.push(spec);
    this.byParent.clear();
    return spec;
  };

  shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin?: () => THREE.Texture) => {
    const spec: ShellSpec = { id: this.uid(name), geo, name, note, skin };
    this.shells.push(spec);
    return spec;
  };

  surface = (spec: SurfaceSpec) => {
    this.surfaces.push({ chan: chanOfKey(spec.key), ...spec });
    return spec;
  };

  surfacePivot = (key: string) => this.surfaces.find((s) => s.key === key)!.pivot;

  /** Parts riding on a moving group (or the fixed airframe when parent is undefined). */
  partsFor = (parent?: string) => {
    const k = parent ?? "";
    let l = this.byParent.get(k);
    if (!l) { l = this.parts.filter((p) => (p.parent ?? "") === k); this.byParent.set(k, l); }
    return l;
  };

  /** Unique pinned, named parts for a system (labels and "tap to locate" lists). */
  pinned = (sys: SysId) => {
    let l = this.pins.get(sys);
    if (!l) {
      const seen = new Set<string>();
      l = this.parts.filter((p) => p.pin && p.name && p.sys.includes(sys) && !seen.has(p.name) && (seen.add(p.name), true));
      this.pins.set(sys, l);
    }
    return l;
  };

  /** Does this part carry the label pin in the given system view? (`pin`, `pinIn`, then the airplane's label lists.) */
  isPinned = (spec: PartSpec, sys: SysId) => {
    const nar = !!this.labels.narrow && narrowLayout(), key = nar ? sys + ":narrow" : sys;
    let s = this.pinIds.get(key);
    if (!s) {
      const pinned = this.pinned(sys), quiet = this.labels.quiet?.[sys] ?? [], only = nar ? this.labels.narrow?.[sys] ?? [] : null;
      if (process.env.NODE_ENV !== "production") {
        const names = new Set(pinned.map((p) => p.name));
        for (const n of [...quiet, ...(only ?? [])]) if (!names.has(n)) console.warn(`${this.prefix}: label list for "${sys}" names "${n}", which is not a pinned part of that view`);
      }
      s = new Set(pinned.filter((p) => (!p.pinIn || p.pinIn.includes(sys)) && (only ? only.includes(p.name!) : !quiet.includes(p.name!))).map((p) => p.id));
      this.pinIds.set(key, s);
    }
    return s.has(spec.id);
  };
}
