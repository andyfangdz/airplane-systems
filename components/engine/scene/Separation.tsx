"use client";
import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Group, Matrix4, Vector3 } from "three";
import { ease } from "@/lib/math";
import { prefersReducedMotion } from "@/lib/useReducedMotion";
import type { EngineSim } from "../store";
import { assemblyStations, type AssemblyId, type AssemblyStation } from "../assembly-study";
import type { CylinderDef } from "@/engines/types";
import type { V3 } from "./layout";

const origin: V3 = [0, 0, 0];
const Separation = createContext(false);
export const usePartsExploded = () => useContext(Separation);

type Motion = { from: Vector3; to: Vector3; scale: number; show: boolean; time: number };
const Motions = createContext<Map<Group, Motion> | null>(null);
const Study = createContext<{
  sim: EngineSim;
  stations: Map<AssemblyId, AssemblyStation>;
  open: boolean;
  focus: AssemblyId | undefined;
  exploded: boolean;
} | null>(null);

export function AssemblyStudy({ sim, children }: { sim: EngineSim; children: ReactNode }) {
  const motions = useMemo(() => new Map<Group, Motion>(), []);
  const stations = useMemo(() => new Map(assemblyStations(sim.spec).map((s) => [s.id, s])), [sim]);
  const open = sim.useUi((s) => !!s.view.blowUp);
  const assembly = sim.useUi((s) => s.view.assembly);
  useFrame((_, dt) => {
    for (const [g, motion] of motions) {
      motion.time = Math.min(1, prefersReducedMotion() ? 1 : motion.time + dt / 0.7);
      const u = ease(motion.time);
      g.position.lerpVectors(motion.from, motion.to, u);
      g.scale.setScalar(motion.scale + (Number(motion.show) - motion.scale) * u);
      if (motion.time === 1) {
        g.position.copy(motion.to);
        g.visible = motion.show;
        delete g.userData.cameraDestination;
        motions.delete(g);
      }
    }
  }, -2);
  return (
    <Motions value={motions}>
      <Study value={{ sim, stations, open, focus: assembly?.id, exploded: !!assembly?.exploded }}>{children}</Study>
    </Motions>
  );
}

/** Only wrappers in transit have frame work. A reversal starts at the pose on screen. */
function MovingGroup({ at, show = true, children }: { at: V3; show?: boolean; children: ReactNode }) {
  const motions = useContext(Motions)!;
  const group = useRef<Group>(null);
  const mounted = useRef(false);
  const [x, y, z] = at;
  useLayoutEffect(() => {
    const g = group.current!;
    const to = new Vector3(x, y, z);
    g.userData.cameraBounds = show;
    if (!mounted.current || prefersReducedMotion() || (g.position.equals(to) && g.scale.x === Number(show))) {
      g.position.copy(to);
      g.scale.setScalar(Number(show));
      g.visible = show;
    } else {
      // Fit the camera to the destination while the rendered geometry travels there.
      g.userData.cameraDestination = new Matrix4().makeTranslation(x, y, z);
      g.visible = true;
      motions.set(g, { from: g.position.clone(), to, scale: g.scale.x, show, time: 0 });
    }
    mounted.current = true;
    return () => {
      motions.delete(g);
      delete g.userData.cameraDestination;
    };
  }, [motions, x, y, z, show]);
  return <group ref={group}>{children}</group>;
}

export const AssemblyPick = createContext<{ hidden: boolean; focus?: () => void } | null>(null);

/** Independent members of one physical assembly share the same overview transform. */
export function Assembly({ id, children }: { id: AssemblyId; children: ReactNode }) {
  const study = useContext(Study);
  if (!study) return children;
  const { sim, open, focus, exploded, stations } = study;
  const station = stations.get(id)!;
  const hidden = !!focus && id !== focus;
  return (
    <AssemblyPick
      value={{
        hidden,
        focus: open && !focus ? () => sim.useUi.getState().setView({ assembly: { id, exploded: false } }) : undefined,
      }}
    >
      <MovingGroup at={open ? station.by : origin} show={!hidden}>
        <Separation value={id === focus && exploded}>{children}</Separation>
      </MovingGroup>
    </AssemblyPick>
  );
}

export function Spread({ by, children }: { by: V3; children: ReactNode }) {
  const motions = useContext(Motions);
  const exploded = usePartsExploded();
  return motions ? <MovingGroup at={exploded ? by : origin}>{children}</MovingGroup> : children;
}

/** Four separate stations leave room beside each head for the parts removed along its barrel axis. */
export function cylinderSpread(c: CylinderDef, distance: number): V3 {
  return [c.n <= 2 ? 0.14 : -0.14, 0, (c.side === "R" ? 1 : -1) * distance];
}

/** Shared between the installed accessory and its external label. */
export const accessorySpread: Record<string, V3> = {
  Magnetos: [-0.42, 0.1, 0],
  "Oil filter": [-0.46, -0.04, 0],
  "Fuel injector": [0.18, -0.37, 0],
  "Fuel manifold": [0, 0.52, 0],
  Starter: [0.11, -0.16, -0.18],
  Governor: [0.24, 0.16, -0.07],
  Alternator: [0.12, -0.1, 0.23],
  "ALT 1": [0.12, -0.1, 0.23],
  "ALT 2": [0.12, -0.1, -0.23],
};
