import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import type { EngineSim } from "../../store";
import type { Mats } from "../kit";
import type { Point } from "../io390/shapes";
import { Details, useDetailDisposal } from "../io390/Details";
import { Spread } from "../Separation";
import { P } from "../parts";
import { io360Inlet } from "./installation";

export function IO360Inlet({ sim, servo, mats }: { sim: EngineSim; servo: Point; mats: Mats }) {
  const cessna = sim.spec.induction?.altAir === "automatic";
  const [x, y, z] = servo;
  const inlet = useMemo(() => io360Inlet([x, y, z], cessna), [x, y, z, cessna]);
  useDetailDisposal(inlet.parts);
  useEffect(() => () => inlet.door.dispose(), [inlet]);
  const mechanism = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!mechanism.current) return;
    if (cessna) mechanism.current.rotation.y = sim.s.altAirOpen ? Math.PI / 3 : 0;
    else mechanism.current.rotation.x = sim.useUi.getState().controls.altAir ? 0 : Math.PI / 6;
  });
  return (
    <>
      <Details parts={inlet.parts} mats={mats} />
      <Spread by={[0.32, -0.52, 0.12]}>
        <group position={inlet.pivot}>
          <group ref={mechanism}>
            <P
              name={cessna ? "Automatic alternate air door" : "Rotary alternate air sleeve"}
              material={mats.shroud}
              geometry={inlet.door}
              installationNote={
                cessna
                  ? "Suction opens the spring-loaded door when the filter is obstructed (C172S POH 7-36)."
                  : "The cockpit alternate-air lever rotates the sleeve to uncover six ports, bypassing the normal filter (DA40 AMM 71-60)."
              }
            />
          </group>
        </group>
      </Spread>
    </>
  );
}
