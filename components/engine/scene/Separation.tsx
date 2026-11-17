"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { CylinderDef } from "@/engines/types";
import type { V3 } from "./layout";

/** Only the IO-390 supplies a catalog layout. Offsets are in the parent assembly's frame, in model metres. */
export const Separation = createContext<boolean | null>(null);
const origin: V3 = [0, 0, 0];

export function Spread({ by, children }: { by: V3; children: ReactNode }) {
  const open = useContext(Separation);
  if (open === null) return children;
  return <group position={open ? by : origin}>{children}</group>;
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
  "ALT 1": [0.12, -0.1, 0.23],
  "ALT 2": [0.12, -0.1, -0.23],
  Propeller: [0.55, 0, 0],
};
