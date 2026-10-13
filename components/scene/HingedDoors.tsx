"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { Catalogue } from "@/lib/catalogue";
import { doorMatrix, type StudyDoor } from "@/lib/doors";
import { Parts } from "./Part";

/** The supplied pose is also read by struts and other hardware, so their attachments never lag the panel. */
export function HingedDoors({
  cat,
  doors,
  pose,
  target,
}: {
  cat: Catalogue;
  doors: StudyDoor[];
  pose: Record<string, number>;
  target: (key: string) => number;
}) {
  const groups = useRef<Record<string, THREE.Group | null>>({});
  useFrame((_, dt) => {
    for (const door of doors) {
      const amount = target(door.key);
      pose[door.key] += (amount - pose[door.key]) * (1 - Math.exp(-6 * Math.min(dt, 0.1)));
      if (Math.abs(amount - pose[door.key]) < 0.0001) pose[door.key] = amount;
      const group = groups.current[door.key];
      if (group) {
        doorMatrix(door, pose[door.key], group.matrix);
        group.matrixWorldNeedsUpdate = true;
      }
    }
  }, -1);
  const render = (parent?: string): React.ReactNode =>
    doors
      .filter((d) => d.parent === parent)
      .map((door) => (
        <group
          key={door.key}
          matrixAutoUpdate={false}
          ref={(group) => {
            groups.current[door.key] = group;
          }}
        >
          <Parts cat={cat} parent={`door:${door.key}`} />
          {render(door.key)}
        </group>
      ));
  return <>{render()}</>;
}
