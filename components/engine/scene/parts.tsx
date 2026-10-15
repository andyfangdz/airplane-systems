"use client";
/**
 * Named parts and part groups. Hovering any part shows its name and a note (the tooltip reads `useHover`); each group
 * can be hidden from the panel to see what is behind it.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { createContext, useContext, type ReactNode, type Ref } from "react";
import * as THREE from "three";
import { create } from "zustand";
import type { EngineSpec } from "@/engines/types";
import type { EngineSim } from "../store";

export const GROUPS = [
  { id: "case", name: "Crankcase, sump and accessory housing" },
  { id: "cylinders", name: "Cylinders: barrels, heads, rocker covers" },
  { id: "valvetrain", name: "Camshaft and valve train" },
  { id: "rotating", name: "Crankshaft, rods and pistons" },
  { id: "ignition", name: "Magnetos, harness and spark plugs" },
  { id: "fuel", name: "Fuel injection" },
  { id: "induction", name: "Induction and exhaust" },
  { id: "oil", name: "Lubrication" },
  { id: "drives", name: "Starter, alternator and governor" },
] as const;
export type GroupId = (typeof GROUPS)[number]["id"];

export interface HoverInfo {
  name: string;
  note: string;
  x: number;
  y: number;
}
export const useHover = create<{ hover: HoverInfo | null }>(() => ({ hover: null }));

const over = (name: string, note: string) => (e: ThreeEvent<PointerEvent>) => {
  // a part turned see-through by X-ray lets the pointer reach what is inside it
  const m = (e.object as THREE.Mesh).material as THREE.Material;
  if (m.transparent && m.opacity < 0.5) return;
  e.stopPropagation();
  useHover.setState({ hover: { name, note, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } });
};
const move = (e: ThreeEvent<PointerEvent>) => {
  const h = useHover.getState().hover;
  if (h) useHover.setState({ hover: { ...h, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } });
};
const out = () => useHover.setState({ hover: null });

/**
 * The engine's own names and notes for parts the scene draws for every engine (`EngineSpec.parts`), so each cites its
 * own manual. A key matches a part's default name exactly, or with its numbers written as "#" ("Cylinder # head").
 */
const PartNotes = createContext<EngineSpec["parts"]>(undefined);
export const PartNotesProvider = PartNotes.Provider;

/** A mesh with a name and a note for the hover tooltip. */
export function P({
  name: given,
  note: givenNote = "",
  geometry,
  material,
  position,
  rotation,
  scale,
  meshRef,
}: {
  name: string;
  note?: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  meshRef?: Ref<THREE.Mesh>;
}) {
  const parts = useContext(PartNotes);
  const own = parts?.[given] ?? parts?.[given.replace(/\d+/g, "#")];
  const name = own?.name ? own.name.replace(/#/g, () => given.match(/\d+/)?.[0] ?? "#") : given,
    note = own ? own.note : givenNote;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerOver={over(name, note)}
      onPointerMove={move}
      onPointerOut={out}
    />
  );
}

/** A part group the panel can hide. */
export function Group({ sim, id, children }: { sim: EngineSim; id: GroupId; children: ReactNode }) {
  const hidden = sim.useUi((x) => x.view.hidden.includes(id));
  // unmounted rather than invisible, so hidden parts don't catch the pointer
  return hidden ? null : <group>{children}</group>;
}

/** The hovered part's name and note, next to the pointer. */
export function HoverTip() {
  const h = useHover((x) => x.hover);
  if (!h) return null;
  return (
    <div className="eng-tip" style={{ left: h.x + 14, top: h.y + 14 }}>
      <b>{h.name}</b>
      {h.note && <span>{h.note}</span>}
    </div>
  );
}
