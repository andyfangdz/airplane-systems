"use client";
/**
 * The Cirrus flight-control linkage drawn from an airplane's `rig.ts` (SR20, SR22T): the moving groups of POH Figures 7-1
 * (elevator), 7-2 (aileron) and 7-3 (rudder) and the links between them. The airplane passes its parts catalogue, its rig
 * module and a getter for its sim state; the cable runs and pulleys themselves stay in each airplane's `rig.ts`.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Links, type LinkSpec } from "@/components/scene/Links";
import { Parts } from "@/components/scene/Part";
import type { Catalogue } from "@/lib/catalogue";
import type { Axis } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";

/** The pose `rigPose` returns: angles of the moving groups, pedal travel and each pulley's turn. */
export interface CirrusRigPose {
  ett: number;
  carr: number;
  ailSector: number;
  rudHorn: number;
  pedal: number;
  pulley: Record<string, number>;
}

/** What the drawing needs from an airplane's `rig.ts` (pass the module: `import * as RIG from "./rig"`). */
export interface CirrusRig<S, P extends CirrusRigPose> {
  ETT: { c: Vec3 };
  CARR: { x: number; y: number; z: number };
  AIL_SECTOR: { c: Vec3 };
  RUD_HORN: { c: Vec3 };
  PULLEYS: Record<string, { c: Vec3; axis: Axis }>;
  rigPose: (s: S) => P;
  linkPoints: (s: S, p: P) => Record<string, [THREE.Vector3, THREE.Vector3]>;
}

/** Links whose end points move every frame. */
const LINKS: Record<string, LinkSpec> = {
  "drop-1": {
    name: "Elevator drop link",
    note: "Push-pull link from the yoke tube to the lever on the elevator torque tube (POH Fig. 7-1).",
    r: 0.007,
    chan: "elevator",
    sys: ["controls"],
  },
  drop1: {
    name: "Elevator drop link",
    note: "Push-pull link from the yoke tube to the lever on the elevator torque tube (POH Fig. 7-1).",
    r: 0.007,
    chan: "elevator",
    sys: ["controls"],
  },
  ailRod: {
    name: "Aileron push rod",
    note: "Links both pivoting yoke carriages to the central pulley sector (POH Fig. 7-2).",
    r: 0.006,
    chan: "aileron",
    sys: ["controls"],
  },
  elevPush: {
    name: "Elevator push-pull tube",
    note: "From the aft sector pulley's crank pin to the elevator bellcrank.",
    r: 0.01,
    chan: "elevator",
    sys: ["controls"],
  },
  rudPush: {
    name: "Rudder push-pull tube",
    note: "From the aft rudder sector to the rudder bellcrank.",
    r: 0.009,
    chan: "rudder",
    sys: ["controls"],
  },
  "ped-1": {
    name: "Pedal link",
    note: "Connects the left pedal pair to its end of the rudder cable horn.",
    r: 0.006,
    chan: "rudder",
    sys: ["controls", "gear"],
  },
  ped1: {
    name: "Pedal link",
    note: "Connects the right pedal pair to its end of the rudder cable horn.",
    r: 0.006,
    chan: "rudder",
    sys: ["controls", "gear"],
  },
  "cone-1": {
    name: "Aileron drive link",
    note: "Right-angle drive: the wing sector's crank swings fore-aft and this link turns the aileron's drive arm about the hinge.",
    r: 0.006,
    chan: "aileron",
    sys: ["controls"],
  },
  cone1: {
    name: "Aileron drive link",
    note: "Right-angle drive: the wing sector's crank swings fore-aft and this link turns the aileron's drive arm about the hinge.",
    r: 0.006,
    chan: "aileron",
    sys: ["controls"],
  },
};

/** Animated cable-control mechanisms from POH Figures 7-1 (elevator), 7-2 (aileron), 7-3 (rudder). */
export function ControlRig<S, P extends CirrusRigPose>({
  cat,
  rig,
  sim,
}: {
  cat: Catalogue;
  rig: CirrusRig<S, P>;
  sim: () => S;
}) {
  const { AIL_SECTOR, CARR, ETT, PULLEYS, RUD_HORN } = rig;
  const points = () => {
    const s = sim();
    return rig.linkPoints(s, rig.rigPose(s));
  };
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => {
    g.current[k] = o;
  };

  useFrame(() => {
    const s = sim(),
      p = rig.rigPose(s),
      G = g.current;
    if (G.ett) G.ett.rotation.z = p.ett;
    if (G.carrL) G.carrL.rotation.x = p.carr;
    if (G.carrR) G.carrR.rotation.x = p.carr;
    if (G.ailSector) G.ailSector.rotation.x = p.ailSector;
    if (G.rudHorn) G.rudHorn.rotation.y = p.rudHorn;
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
    for (const [k, d] of Object.entries(PULLEYS)) {
      const o = G["pul:" + k];
      if (o) o.rotation[d.axis] = p.pulley[k];
    }
  });

  return (
    <>
      <group ref={set("ett")} position={ETT.c}>
        <Parts cat={cat} parent="rig:ett" />
      </group>
      <group ref={set("carrL")} position={[CARR.x, CARR.y, -CARR.z]}>
        <Parts cat={cat} parent="rig:carr:L" />
      </group>
      <group ref={set("carrR")} position={[CARR.x, CARR.y, CARR.z]}>
        <Parts cat={cat} parent="rig:carr:R" />
      </group>
      <group ref={set("ailSector")} position={AIL_SECTOR.c}>
        <Parts cat={cat} parent="rig:ailSector" />
      </group>
      <group ref={set("rudHorn")} position={RUD_HORN.c}>
        <Parts cat={cat} parent="rig:rudHorn" />
      </group>
      <group ref={set("pedL")}>
        <Parts cat={cat} parent="rig:pedL" />
      </group>
      <group ref={set("pedR")}>
        <Parts cat={cat} parent="rig:pedR" />
      </group>
      {Object.entries(PULLEYS).map(([k, d]) => (
        <group key={k} ref={set("pul:" + k)} position={d.c}>
          <Parts cat={cat} parent={"rig:pul:" + k} />
        </group>
      ))}
      <Links links={LINKS} points={points} />
    </>
  );
}
