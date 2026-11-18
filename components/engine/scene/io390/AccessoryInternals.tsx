import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { injectorView } from "@/engines/components/fuel-injector/model";
import type { EngineSim } from "../../store";
import { D2R, type Mats } from "../kit";
import { Spread } from "../Separation";
import { P } from "../parts";
import { useDetailDisposal } from "./Details";
import { accessoryInternals, reduction, type Accessory, type Internal } from "./internals";
import type { Point } from "./shapes";

export function AccessoryInternals({
  kind,
  sim,
  mats,
  position,
  rotationZ = 0,
  spread,
  suffix = "",
  retard = false,
  length = 0.08,
  ratio = 1,
}: {
  kind: Accessory;
  sim: EngineSim;
  mats: Mats;
  position?: Point;
  rotationZ?: number;
  spread?: Point;
  suffix?: string;
  retard?: boolean;
  length?: number;
  ratio?: number;
}) {
  const parts = useMemo(() => accessoryInternals(kind, retard, length), [kind, retard, length]);
  useDetailDisposal(parts);
  const moving = useRef(new Map<Internal, THREE.Group>());
  useFrame(() => {
    if (!moving.current.size) return;
    const ui = sim.useUi.getState();
    const meter =
      kind === "servo" || kind === "divider" ? injectorView(sim.spec, sim.s, ui.controls, ui.failures) : null;
    const angle = sim.anim.crank * ratio * D2R;
    for (const [part, g] of moving.current) {
      switch (part.motion) {
        case "shaft":
          g.rotation.x = angle;
          break;
        case "driven":
          g.rotation.x = kind === "magneto" ? -angle / 2 : -angle;
          break;
        case "armature":
          if (sim.s.starterEngaged) g.rotation.x = angle * (1 + reduction.ring / reduction.sun);
          break;
        case "carrier":
          if (sim.s.starterEngaged) g.rotation.x = angle;
          break;
        case "planet":
          if (sim.s.starterEngaged) {
            const [, y, z] = part.pivot!;
            g.position.y = y * (Math.cos(angle) - 1) - z * Math.sin(angle);
            g.position.z = y * Math.sin(angle) + z * (Math.cos(angle) - 1);
            g.rotation.x = angle * (1 - reduction.ring / reduction.planet);
          }
          break;
        case "flyweight": {
          const [, y] = part.pivot!;
          g.position.y = y * (Math.cos(angle) - 1);
          g.position.z = y * Math.sin(angle);
          g.rotation.x = angle;
          g.rotation.z = Math.sign(y) * 0.45 * Math.min(1, (sim.s.rpm / 2700) ** 2);
          break;
        }
        case "shiftLever":
          g.rotation.z = sim.s.starterEngaged ? -0.24 : 0;
          break;
        case "pumpLever":
          g.rotation.z = 0.12 * Math.cos(angle);
          break;
        case "solenoid":
          g.position.x = sim.s.starterEngaged ? 0.006 : 0;
          break;
        case "diaphragm":
          g.position.x = 0.0025 * Math.cos(angle);
          break;
        case "regulator":
          g.position.z = 0.0015 * meter!.ball;
          break;
        case "divider":
          g.position.y = 0.003 * meter!.divider;
          break;
        case "mixture":
          g.rotation.z = (ui.controls.mixture * Math.PI) / 2;
          break;
        case "pilot":
          g.position.x = 0.003 * Math.max(-1, Math.min(1, (sim.s.rpm - sim.s.govRpm) / 150));
          break;
      }
    }
  });
  const group = (
    <group position={position} rotation={[0, 0, rotationZ]}>
      {parts.map((p) => (
        <Spread key={p.name} by={p.spread!}>
          <group position={p.pivot}>
            <group
              ref={
                p.motion
                  ? (g) => {
                      if (g) moving.current.set(p, g);
                      else moving.current.delete(p);
                    }
                  : undefined
              }
            >
              <P
                name={p.name + suffix}
                note={p.note}
                installationNote={p.role}
                material={mats[p.material]}
                geometry={p.geometry}
              />
            </group>
          </group>
        </Spread>
      ))}
    </group>
  );
  return spread ? <Spread by={spread}>{group}</Spread> : group;
}
