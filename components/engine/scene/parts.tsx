"use client";
/**
 * Named parts and part groups. Hovering any part shows its name and a note (the tooltip reads `useHover`); each group
 * can be hidden from the panel to see what is behind it.
 */
import type { ThreeEvent } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import * as THREE from "three";
import { create } from "zustand";
import type { EngineSpec } from "@/engines/types";
import type { EngineSim } from "../store";
import { useView } from "@/lib/view";
import { usePartInspection, usePartInspectionStore } from "../PartInspector";
import { layoutFor } from "./layout";

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

/** A turbocharged engine's groups: exhaust apart from induction, and the turbochargers with their controls. */
const TURBO_GROUPS = [
  { id: "case", name: "Crankcase, sump and accessory housing" },
  { id: "cylinders", name: "Cylinders: barrels, heads, rocker covers" },
  { id: "valvetrain", name: "Camshaft and valve train" },
  { id: "rotating", name: "Crankshaft, rods and pistons" },
  { id: "ignition", name: "Magnetos, harness and spark plugs" },
  { id: "fuel", name: "Fuel injection" },
  { id: "induction", name: "Induction: air boxes, intercooler ducts, throttle and intake" },
  { id: "exhaust", name: "Exhaust, crossover and tailpipes" },
  { id: "turbo", name: "Turbochargers, wastegate, controller and intercoolers" },
  { id: "oil", name: "Lubrication" },
  { id: "drives", name: "Starter, alternators and governor" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"] | (typeof TURBO_GROUPS)[number]["id"];

/** The part groups an engine's panel lists: the turbo and exhaust groups only for a layout with a turbo block. */
export const groupsFor = (spec: EngineSpec, L = layoutFor(spec)): readonly { id: GroupId; name: string }[] =>
  L.turbo ? TURBO_GROUPS : GROUPS;

export interface HoverInfo {
  name: string;
  note: string;
  x: number;
  y: number;
}
export const useHover = create<{ hover: HoverInfo | null }>(() => ({ hover: null }));

const over = (name: string, note: string) => (e: ThreeEvent<PointerEvent>) => {
  // a part turned see-through by X-ray lets the pointer reach what is inside it, unless its material says otherwise
  const m = (e.object as THREE.Mesh).material as THREE.Material;
  if (m.transparent && m.opacity < 0.5 && !m.userData.hoverWhenClear) return;
  e.stopPropagation();
  useHover.setState({ hover: { name, note, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } });
};
const move = (e: ThreeEvent<PointerEvent>) => {
  const h = useHover.getState().hover;
  if (h) useHover.setState({ hover: { ...h, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } });
};
const out = () => useHover.setState({ hover: null });

const canPick = (mesh: THREE.Mesh) => {
  const material = mesh.material as THREE.Material;
  return !material.transparent || material.opacity >= 0.5 || !!material.userData.hoverWhenClear;
};

/** Ancestor visibility covers animated groups such as a hidden propeller as well as an individual mesh. */
const isVisible = (mesh: THREE.Mesh | null) => {
  if (!mesh) return false;
  for (let object: THREE.Object3D | null = mesh; object; object = object.parent) {
    if (!object.visible) return false;
  }
  return true;
};

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
  const mesh = useRef<THREE.Mesh>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const inspection = usePartInspectionStore();
  const selected = usePartInspection((state) => state.selected === name);
  const theme = useView((state) => state.theme);
  const id = useId();
  useImperativeHandle(meshRef, () => mesh.current!, []);
  useLayoutEffect(
    () => inspection.getState().register({ id, name, note, available: () => isVisible(mesh.current) }),
    [id, name, note, inspection],
  );
  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerOver={over(name, note)}
      onPointerDown={(event) => {
        if (!canPick(event.object as THREE.Mesh)) return;
        event.stopPropagation();
        down.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const start = down.current;
        if (start && Math.hypot(event.nativeEvent.clientX - start.x, event.nativeEvent.clientY - start.y) > 4)
          start.moved = true;
        move(event);
      }}
      onPointerOut={out}
      onClick={(event) => {
        const start = down.current;
        down.current = null;
        if (!start || start.moved || event.delta > 4 || !canPick(event.object as THREE.Mesh)) return;
        event.stopPropagation();
        inspection.getState().select(name, true);
        out();
      }}
    >
      {selected && (
        <lineSegments raycast={() => null} renderOrder={100} userData={{ cameraBounds: false }}>
          <edgesGeometry args={[geometry, 30]} />
          <lineBasicMaterial color={theme === "dark" ? "#63b4e6" : "#1b5e88"} depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
    </mesh>
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
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = ref.current;
    if (!tip || !h) return;
    const place = () => {
      const width = tip.offsetWidth,
        height = tip.offsetHeight;
      tip.style.left = `${Math.max(8, Math.min(h.x + 14, innerWidth - width - 8))}px`;
      tip.style.top = `${Math.max(8, Math.min(h.y + 14, innerHeight - height - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [h]);
  if (!h) return null;
  return (
    <div ref={ref} className="eng-tip" style={{ left: h.x + 14, top: h.y + 14, maxWidth: "calc(100vw - 16px)" }}>
      <b>{h.name}</b>
      {h.note && <span>{h.note}</span>}
    </div>
  );
}
