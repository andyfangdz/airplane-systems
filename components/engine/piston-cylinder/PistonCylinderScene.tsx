"use client";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { bore, cylinderAt, geometry, radius, rodLength, top } from "@/engines/components/piston-cylinder/model";
import { ComponentStage } from "../ComponentStage";
import type { CylinderPlayback } from "./PistonCylinderApp";

const R = bore / 2;
const crown = 0.022;
const head = top + crown + (2 * radius) / (geometry.compressionRatio - 1);
const COLORS = { intake: "#49b9ed", compression: "#b09af1", power: "#fb974b", exhaust: "#98a7ad" };
function Label({ at, children }: { at: [number, number, number]; children: React.ReactNode }) {
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  return (
    <Html position={at} portal={portal} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="piston-label">{children}</div>
    </Html>
  );
}
function Assembly({ live, labels }: { live: CylinderPlayback; labels: boolean }) {
  const piston = useRef<Group>(null);
  const rod = useRef<Group>(null);
  const crank = useRef<Group>(null);
  const intake = useRef<Group>(null);
  const exhaust = useRef<Group>(null);
  const gas = useRef<Mesh>(null);
  const spark = useRef<Mesh>(null);
  useFrame(() => {
    const x = cylinderAt(live.angle);
    if (piston.current) piston.current.position.y = x.pistonY;
    if (rod.current) {
      rod.current.position.set(x.pinX / 2, (x.pinY + x.pistonY) / 2, 0);
      rod.current.rotation.z = x.rodAngle;
    }
    if (crank.current) crank.current.rotation.z = (-x.phase * Math.PI) / 180;
    if (intake.current) intake.current.position.y = -x.valves.intake * 0.014;
    if (exhaust.current) exhaust.current.position.y = -x.valves.exhaust * 0.014;
    if (gas.current) {
      const height = head - x.pistonY - crown;
      gas.current.position.y = head - height / 2;
      gas.current.scale.y = height;
      (gas.current.material as MeshStandardMaterial).color.set(COLORS[x.stroke]);
    }
    if (spark.current) spark.current.visible = x.spark;
  });
  return (
    <>
      <mesh position={[0, (head + top - 2 * radius - crown) / 2, 0]}>
        <cylinderGeometry
          args={[R + 0.006, R + 0.006, head - top + 2 * radius + crown, 48, 1, true, Math.PI / 2, Math.PI]}
        />
        <meshStandardMaterial color="#798b99" metalness={0.65} roughness={0.35} side={DoubleSide} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, head - 0.012 - i * 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R + 0.008, 0.003, 8, 48, Math.PI]} />
          <meshStandardMaterial color="#9eacb5" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh ref={gas}>
        <cylinderGeometry args={[R * 0.95, R * 0.95, 1, 40]} />
        <meshStandardMaterial transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <group ref={piston} position={[0, top, 0]}>
        <mesh>
          <cylinderGeometry args={[R * 0.97, R * 0.97, crown * 2, 48]} />
          <meshStandardMaterial color="#d4dce0" metalness={0.7} roughness={0.28} />
        </mesh>
        {[0.01, 0.016].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[R * 0.97, 0.0015, 8, 48]} />
            <meshStandardMaterial color="#354753" />
          </mesh>
        ))}
      </group>
      <group ref={rod}>
        <mesh>
          <boxGeometry args={[0.013, rodLength, 0.015]} />
          <meshStandardMaterial color="#c8b28c" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      <group ref={crank}>
        <mesh position={[0, radius / 2, -0.018]}>
          <boxGeometry args={[0.027, radius + 0.025, 0.018]} />
          <meshStandardMaterial color="#718b9e" metalness={0.7} roughness={0.3} />
        </mesh>
        {[0, radius].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.05, 32]} />
            <meshStandardMaterial color="#8da7bb" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
      </group>
      {([-1, 1] as const).map((side) => (
        <group key={side} ref={side === -1 ? intake : exhaust}>
          <mesh position={[side * R * 0.48, head + 0.022, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.048, 16]} />
            <meshStandardMaterial color="#b8c5ce" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[side * R * 0.48, head, 0]}>
            <cylinderGeometry args={[0.019, 0.019, 0.005, 32]} />
            <meshStandardMaterial color={side === -1 ? "#49b9ed" : "#e69474"} metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, head + 0.02, 0.018]}>
        <cylinderGeometry args={[0.006, 0.006, 0.035, 16]} />
        <meshStandardMaterial color="#eee7cf" />
      </mesh>
      <mesh ref={spark} position={[0, head - 0.003, 0.018]}>
        <sphereGeometry args={[0.008, 16, 16]} />
        <meshBasicMaterial color="#fff19b" />
      </mesh>
      {labels && (
        <>
          <Label at={[-0.07, head + 0.035, 0]}>Intake valve</Label>
          <Label at={[0.07, head + 0.035, 0]}>Exhaust valve</Label>
          <Label at={[0.1, top - 0.02, 0]}>Piston & rings</Label>
          <Label at={[-0.09, 0.1, 0]}>Connecting rod</Label>
          <Label at={[0.07, -0.025, 0]}>Crankshaft</Label>
        </>
      )}
    </>
  );
}
export default function PistonCylinderScene(props: { live: CylinderPlayback; labels: boolean }) {
  return (
    <ComponentStage
      camera={{ position: [0.32, 0.3, 0.65], fov: 38, near: 0.01, far: 10 }}
      target={[0, 0.13, 0]}
      minDistance={0.35}
      maxDistance={1.3}
    >
      <Assembly {...props} />
    </ComponentStage>
  );
}
