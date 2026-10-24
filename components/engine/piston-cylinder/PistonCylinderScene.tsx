"use client";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, type Mesh, type MeshStandardMaterial, type MeshBasicMaterial } from "three";
import {
  bore,
  cylinderAt,
  benchValves,
  combustionEvent,
  geometry,
  radius,
  rodLength,
  top,
  type BenchControls,
  type CylinderBench,
} from "@/engines/components/piston-cylinder/model";
import { ComponentStage } from "../ComponentStage";

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
function SparkPlug({ live, index }: { live: CylinderBench; index: 0 | 1 }) {
  const flash = useRef<Mesh>(null);
  const tip = useRef<Mesh>(null);
  useFrame(() => {
    if (flash.current) flash.current.visible = cylinderAt(live.angle).spark && live.sparks[index];
    if (tip.current)
      (tip.current.material as MeshStandardMaterial).color.setRGB(
        0.7 * (1 - live.deposits[index]) + 0.06,
        0.65 * (1 - live.deposits[index]) + 0.04,
        0.55 * (1 - live.deposits[index]) + 0.03,
      );
  });
  const side = index === 0 ? -1 : 1;
  return (
    <group position={[side * 0.021, head + 0.003, 0.04]} rotation={[0, 0, -side * 0.25]}>
      <mesh position={[0, 0.028, 0]}>
        <cylinderGeometry args={[0.005, 0.007, 0.027, 20]} />
        <meshStandardMaterial color="#ece7db" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.047, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.012, 16]} />
        <meshStandardMaterial color="#bcaa77" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.009, 6]} />
        <meshStandardMaterial color="#aab6bf" metalness={0.8} roughness={0.25} />
      </mesh>
      {[0, 0.003, 0.006].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.006, 0.0008, 6, 20]} />
          <meshStandardMaterial color="#737c83" />
        </mesh>
      ))}
      <mesh ref={tip} position={[0, -0.004, 0]}>
        <cylinderGeometry args={[0.004, 0.003, 0.008, 16]} />
        <meshStandardMaterial />
      </mesh>
      <mesh position={[0.003, -0.009, 0]}>
        <boxGeometry args={[0.006, 0.002, 0.002]} />
        <meshStandardMaterial color="#777c81" />
      </mesh>
      <mesh ref={flash} position={[0, -0.008, 0]}>
        <sphereGeometry args={[0.004, 12, 12]} />
        <meshBasicMaterial color="#b3eaff" />
      </mesh>
    </group>
  );
}
function Flow({ live, controls, side }: { live: CylinderBench; controls: BenchControls; side: -1 | 1 }) {
  const particles = useRef<Group>(null);
  useFrame(() => {
    if (!particles.current) return;
    const valves = benchValves(live.angle, controls);
    const phase = cylinderAt(live.angle).stroke;
    const backfire = side < 0 && combustionEvent(live, controls) === "backfire";
    const active =
      backfire ||
      (controls.rpm > 0 &&
        (side < 0 ? phase === "intake" && valves.intake > 0.01 : phase === "exhaust" && valves.exhaust > 0.01));
    particles.current.visible = active;
    particles.current.children.forEach((p, i) => {
      const t = (live.angle / 180 + i / 5) % 1;
      p.position.x = side < 0 ? (backfire ? -0.055 - t * 0.11 : -0.14 + t * 0.085) : 0.055 + t * 0.085;
      ((p as Mesh).material as MeshBasicMaterial).color.set(backfire ? "#ff6a22" : side < 0 ? "#81dbff" : "#ffba7d");
    });
  });
  return (
    <group ref={particles}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, head + 0.005, -0.018]}>
          <sphereGeometry args={[0.003, 8, 8]} />
          <meshBasicMaterial color={side < 0 ? "#81dbff" : "#ffba7d"} />
        </mesh>
      ))}
    </group>
  );
}
function CombustionEffects({ live, controls }: { live: CylinderBench; controls: BenchControls }) {
  const waves = useRef<Group>(null);
  const earlyFlame = useRef<Mesh>(null);
  const hotSpot = useRef<Mesh>(null);
  const intakeFlame = useRef<Mesh>(null);
  useFrame(() => {
    const event = combustionEvent(live, controls);
    if (waves.current) {
      waves.current.visible = event === "detonation";
      waves.current.scale.setScalar(0.75 + 0.25 * Math.sin((live.angle * Math.PI) / 15) ** 2);
    }
    if (earlyFlame.current) earlyFlame.current.visible = event === "preignition";
    if (hotSpot.current) hotSpot.current.visible = live.abnormal === "preignition";
    if (intakeFlame.current) intakeFlame.current.visible = event === "backfire";
  });
  return (
    <>
      <group ref={waves} visible={false} position={[0, head - 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {[0.014, 0.03, 0.047].map((r) => (
          <mesh key={r}>
            <torusGeometry args={[r, 0.002, 8, 40]} />
            <meshBasicMaterial color="#ff4f20" transparent opacity={0.85} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={hotSpot} visible={false} position={[-0.04, head - 0.003, 0.025]}>
        <sphereGeometry args={[0.004, 12, 12]} />
        <meshBasicMaterial color="#ff3828" />
      </mesh>
      <mesh ref={earlyFlame} visible={false} position={[-0.025, head - 0.013, 0.025]} scale={[1.7, 0.6, 1]}>
        <sphereGeometry args={[0.02, 20, 16]} />
        <meshBasicMaterial color="#ff5138" transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <mesh ref={intakeFlame} visible={false} position={[-0.16, head + 0.005, -0.018]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.015, 0.055, 20]} />
        <meshBasicMaterial color="#ff6726" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </>
  );
}
function Assembly({ live, controls, labels }: { live: CylinderBench; controls: BenchControls; labels: boolean }) {
  const piston = useRef<Group>(null);
  const rod = useRef<Group>(null);
  const crank = useRef<Group>(null);
  const intake = useRef<Group>(null);
  const exhaust = useRef<Group>(null);
  const gas = useRef<Mesh>(null);

  useFrame(() => {
    const x = cylinderAt(live.angle);
    const valves = benchValves(live.angle, controls);
    if (piston.current) piston.current.position.y = x.pistonY;
    if (rod.current) {
      rod.current.position.set(x.pinX / 2, (x.pinY + x.pistonY) / 2, 0);
      rod.current.rotation.z = x.rodAngle;
    }
    if (crank.current) crank.current.rotation.z = (-x.phase * Math.PI) / 180;
    if (intake.current) intake.current.position.y = -valves.intake * 0.014;
    if (exhaust.current) exhaust.current.position.y = -valves.exhaust * 0.014;
    if (gas.current) {
      const height = head - x.pistonY - crown;
      gas.current.position.y = head - height / 2;
      gas.current.scale.y = height;
      const material = gas.current.material as MeshStandardMaterial;
      material.color.set(x.stroke === "power" && !live.firing ? "#86939c" : COLORS[x.stroke]);
      material.opacity = x.stroke === "power" ? 0.08 + 0.3 * live.work : 0.2;
    }
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
      <group name="cylinder-piston" ref={piston} position={[0, top, 0]}>
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
      <group name="cylinder-rod" ref={rod}>
        <mesh>
          <boxGeometry args={[0.013, rodLength, 0.015]} />
          <meshStandardMaterial color="#c8b28c" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      <group name="cylinder-crank" ref={crank}>
        <mesh position={[0, radius / 2, -0.018]}>
          <boxGeometry args={[0.027, radius + 0.025, 0.018]} />
          <meshStandardMaterial color="#718b9e" metalness={0.7} roughness={0.3} />
        </mesh>
        {[0, radius].map((y) => (
          <mesh
            name={y === 0 ? "cylinder-shaft" : "cylinder-crankpin"}
            key={y}
            position={[0, y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.014, 0.014, 0.05, 32]} />
            <meshStandardMaterial color="#8da7bb" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
      </group>
      {([-1, 1] as const).map((side) => (
        <group
          name={side === -1 ? "cylinder-intake" : "cylinder-exhaust"}
          key={side}
          ref={side === -1 ? intake : exhaust}
        >
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
      <CombustionEffects live={live} controls={controls} />
      <SparkPlug live={live} index={0} />
      <SparkPlug live={live} index={1} />
      {/* Rear half of the cylinder head, leaving the chamber visible. */}
      <mesh position={[0, head + 0.008, 0]}>
        <cylinderGeometry args={[R + 0.012, R + 0.012, 0.016, 48, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#a8b3bc" metalness={0.65} roughness={0.4} side={DoubleSide} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * 0.095, head + 0.005, -0.018]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.09, 24, 1, true]} />
            <meshStandardMaterial
              color={side < 0 ? "#417f9b" : "#a67358"}
              side={DoubleSide}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          <Flow live={live} controls={controls} side={side} />
        </group>
      ))}
      <mesh position={[0.12, head + 0.022, -0.018]}>
        <cylinderGeometry args={[0.003, 0.003, 0.04, 12]} />
        <meshStandardMaterial color="#e9ad59" />
      </mesh>
      <mesh position={[-R - 0.006, head - 0.035, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, 0.025, 12]} />
        <meshStandardMaterial color="#6fd4ba" />
      </mesh>
      {labels && (
        <>
          <Label at={[-0.07, head + 0.035, 0]}>Intake valve</Label>
          <Label at={[0.07, head + 0.035, 0]}>Exhaust valve</Label>
          <Label at={[0.1, top - 0.02, 0]}>Piston & rings</Label>
          <Label at={[-0.09, 0.1, 0]}>Connecting rod</Label>
          <Label at={[0.07, -0.025, 0]}>Crankshaft</Label>
          <Label at={[-0.12, head - 0.035, 0]}>CHT probe</Label>
          <Label at={[0.18, head + 0.045, 0]}>EGT probe</Label>
          <Label at={[0, head + 0.08, 0.04]}>Dual spark plugs</Label>
        </>
      )}
    </>
  );
}
export default function PistonCylinderScene(props: { live: CylinderBench; controls: BenchControls; labels: boolean }) {
  return (
    <ComponentStage
      camera={{ position: [0.32, 0.34, 0.78], fov: 38, near: 0.01, far: 10 }}
      target={[0, 0.15, 0]}
      minDistance={0.35}
      maxDistance={1.3}
    >
      <Assembly {...props} />
    </ComponentStage>
  );
}
