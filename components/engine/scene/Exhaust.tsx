"use client";
/**
 * The exhaust of a turbocharged engine whose scene layout has an exhaust block (`EngineLayout.exhaust`): a riser down
 * from each cylinder's exhaust port into its bank's collector, each collector's transition to its own turbocharger's
 * turbine inlet, the crossover from the right bank to the transition that feeds the wastegate, the drop from the
 * wastegate into the left tailpipe, and the two tailpipes from the turbine outlets. Where the runs go comes from the
 * layout (`engines/<id>/layout.ts`) and ends on the turbo layout's flanges; shapes are schematic. Each riser is tinted
 * with its cylinder's exhaust gas temperature, a collector with its bank's mean, the crossover and the wastegate
 * transition with the mean of all six, and each tailpipe with its turbine inlet temperature (illustrative).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { EngineSpec } from "@/engines/types";
import type { EngineSim } from "../store";
import { egtColor, headPoints, merge, toWorld, tube, type Dims, type Mats } from "./kit";
import { layoutFor, type EngineLayout, type V3 } from "./layout";
import { P } from "./parts";

/** One bank's collector: its height and side offset under the heads, then on to its turbine inlet. */
export interface ExhaustBankDef {
  side: "L" | "R";
  /** Collector height and side offset (the risers end on it), m. */
  y: number;
  z: number;
  /** From the bank's rearmost riser on to the turbine inlet flange (the last point, on the turbo layout's flange). */
  toTurbine: V3[];
}

/** An engine's exhaust layout (scene metres; `engines/<id>/layout.ts`). */
export interface ExhaustLayout {
  /** Pipe radii: risers, collectors and transitions, tailpipes. */
  r: { riser: number; pipe: number; tail: number };
  /**
   * Each riser's offset along its cylinder (the cylinder's own x, m) from the exhaust port's centre: at its foot on the
   * port flange, and from where it passes the pushrods' height down to the collector.
   */
  riser: { foot: number; clear: number };
  /** Left, then right. */
  banks: [ExhaustBankDef, ExhaustBankDef];
  /** The transition from the left bank's collector to the wastegate's top flange (its last point). */
  toWastegate: V3[];
  /** The crossover from the right bank's collector to the wastegate transition (its last point, on that run). */
  crossover: V3[];
  /** From the wastegate's bottom flange down into the left tailpipe. */
  wastegateDrop: V3[];
  /** Tailpipes from each turbine's discharge collar (the first point) aft and down. Left, then right. */
  tailpipes: [V3[], V3[]];
  notes: {
    riser: string;
    collector: string;
    crossover: string;
    toWastegate: string;
    wastegateDrop: string;
    tailpipe: string;
    clamp: string;
  };
  labels: [string, V3][];
}

/** One drawn run: the points its tube follows, its radius, and what tints it. */
export interface ExhaustRun {
  name: string;
  points: V3[];
  r: number;
  /** A cylinder's index (its EGT), a bank's mean, every cylinder's mean, or a side's TIT. */
  tint: { cyl: number } | { bank: "L" | "R" } | { all: true } | { tit: 0 | 1 };
  note: string;
}

const SIDE = { L: "LH", R: "RH" } as const;

/**
 * Every run the exhaust draws, from the engine's layouts (pure: tests measure it without rendering). A riser leaves the
 * bottom of its cylinder's exhaust port and drops to its bank's collector; each collector runs from the front cylinder
 * aft along the bank and on to its turbine inlet.
 */
export function exhaustRuns(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)): ExhaustRun[] {
  const E = L.exhaust;
  if (!E) return [];
  const hp = headPoints(d, L);
  const cyls = spec.geometry.cylinders;
  const runs: ExhaustRun[] = [];
  for (const b of E.banks) {
    const own = cyls.map((c, i) => ({ c, i })).filter(({ c }) => c.side === b.side);
    for (const { c, i } of own) {
      const [ex, ey, ez] = hp.exhaustPort;
      const foot = toWorld(c, [ex + E.riser.foot, ey - 0.004, ez]);
      const p = toWorld(c, [ex + E.riser.clear, ey - 0.03, ez]);
      runs.push({
        name: `Exhaust riser, cylinder ${c.n}`,
        points: [foot, p, [p[0], (p[1] + b.y) / 2, (p[2] + b.z) / 2], [p[0], b.y, b.z]],
        r: E.r.riser,
        tint: { cyl: i },
        note: E.notes.riser,
      });
    }
    const xs = own.map(({ c }) => toWorld(c, [hp.exhaustPort[0] + E.riser.clear, 0, 0])[0]).sort((a, b) => b - a);
    runs.push({
      name: `${SIDE[b.side]} exhaust collector`,
      points: [...xs.map((x): V3 => [x, b.y, b.z]), ...b.toTurbine],
      r: E.r.pipe,
      tint: { bank: b.side },
      note: E.notes.collector,
    });
  }
  runs.push(
    {
      name: "Wastegate transition",
      points: E.toWastegate,
      r: E.r.pipe,
      tint: { all: true },
      note: E.notes.toWastegate,
    },
    { name: "Exhaust crossover", points: E.crossover, r: E.r.pipe, tint: { all: true }, note: E.notes.crossover },
    {
      name: "Wastegate outlet",
      points: E.wastegateDrop,
      r: E.r.pipe,
      tint: { tit: 0 },
      note: E.notes.wastegateDrop,
    },
    ...E.tailpipes.map((points, k): ExhaustRun => ({
      name: `${k ? "RH" : "LH"} tailpipe`,
      points,
      r: E.r.tail,
      tint: { tit: k as 0 | 1 },
      note: E.notes.tailpipe,
    })),
  );
  return runs;
}

/** The tube a run is drawn as (the test measures the same curve). */
export const runCurve = (run: ExhaustRun) => new THREE.CatmullRomCurve3(run.points.map((p) => new THREE.Vector3(...p)));

/** The exhaust group, drawn when the engine's layout has an exhaust block. */
export function Exhaust(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  return layoutFor(p.sim.spec).exhaust ? <ExhaustParts {...p} /> : null;
}

function ExhaustParts({ sim, d }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const E = L.exhaust!;
  const T = L.turbo;
  const runs = useMemo(() => exhaustRuns(spec, d, L), [spec, d, L]);
  const geo = useMemo(() => {
    const pipes = runs.map((r) => tube(r.points, r.r, Math.max(24, r.points.length * 12), 14));
    // a V-band clamp where each tailpipe meets its turbine's discharge collar
    const clamps = T
      ? merge(
          T.sides.map((t) =>
            new THREE.TorusGeometry(t.outlet.r + 0.002, 0.004, 8, 28)
              .rotateY(Math.PI / 2)
              .translate(t.outlet.x, t.y, t.z),
          ),
        )
      : null;
    return { pipes, clamps };
  }, [runs, T]);
  const mats = useMemo(
    () =>
      runs.map(
        () => new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.55, metalness: 0.5, emissive: "#000" }),
      ),
    [runs],
  );
  const clampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9aa3aa", metalness: 0.7, roughness: 0.4 }),
    [],
  );
  useEffect(
    () => () => {
      geo.pipes.forEach((g) => g.dispose());
      geo.clamps?.dispose();
      mats.forEach((m) => m.dispose());
      clampMat.dispose();
    },
    [geo, mats, clampMat],
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const s = sim.s;
    const cyls = spec.geometry.cylinders;
    const egt = (i: number) => s.cyl[i]?.egt ?? 60;
    const mean = (pick: (i: number) => boolean) => {
      const on = cyls.map((_, i) => i).filter(pick);
      return on.reduce((a, i) => a + egt(i), 0) / Math.max(1, on.length);
    };
    runs.forEach((r, k) => {
      const t = r.tint;
      const f =
        "cyl" in t
          ? egt(t.cyl)
          : "bank" in t
            ? mean((i) => cyls[i].side === t.bank)
            : "all" in t
              ? mean(() => true)
              : (s.tit?.[t.tit] ?? mean(() => true));
      const m = mats[k];
      egtColor(f, tmp);
      m.color.copy(tmp);
      m.emissive.copy(tmp);
      m.emissiveIntensity = Math.max(0, (f - 900) / 900);
    });
  });
  return (
    <>
      {runs.map((r, k) => (
        <P key={r.name} name={r.name} note={r.note} geometry={geo.pipes[k]} material={mats[k]} />
      ))}
      {geo.clamps && <P name="V-band clamp" note={E.notes.clamp} geometry={geo.clamps} material={clampMat} />}
    </>
  );
}
