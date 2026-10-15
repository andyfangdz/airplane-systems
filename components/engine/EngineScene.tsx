"use client";
/**
 * The engine drawn part by part (scene/): crankcase and accessory housing, crankshaft with counterweights, rods and
 * pistons, camshaft and valve train, cylinders, ignition, fuel injection or the carburetor, induction and exhaust,
 * lubrication, the drives and the propeller. Every part names itself on hover (in the engine's own words where its
 * spec gives them); each group can be hidden from the panel. Everything moves from the simulation's mutable state in
 * `useFrame`. Published dimensions set the scale; placement follows the IO-390 IOM's figures and the shapes are
 * schematic.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EngineSim } from "./store";
import { Crankcase, Lubrication } from "./scene/Case";
import { Cylinders } from "./scene/Cylinders";
import { dims, makeMats, XRAY_MATS, type Dims } from "./scene/kit";
import { Group, HoverTip, PartNotesProvider, useHover } from "./scene/parts";
import { Crankshaft, RodsAndPistons } from "./scene/Rotating";
import { Drives, FuelSystem, Ignition, Induction, Propeller } from "./scene/Systems";
import { Camshaft, ValveTrain } from "./scene/Valvetrain";

function EngineModel({ sim }: { sim: EngineSim }) {
  const d = useMemo(() => dims(sim.spec), [sim]);
  const mats = useMemo(makeMats, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const body = useRef<THREE.Group>(null);
  useFrame((state) => {
    const s = sim.s,
      xray = sim.useUi.getState().view.xray;
    for (const k of XRAY_MATS) {
      mats[k].opacity = xray ? (k === "barrel" || k === "head" ? 0.28 : 0.16) : 1;
      mats[k].depthWrite = !xray;
    }
    // a rough engine shakes on its mounts
    if (body.current) {
      const a = s.rpm > 50 ? s.rough * 0.006 : 0;
      const t = state.clock.elapsedTime;
      body.current.position.set(0, Math.sin(t * 37) * a, Math.sin(t * 23 + 1) * a);
    }
  });
  const p = { sim, d, mats };
  return (
    <PartNotesProvider value={sim.spec.parts}>
      <group ref={body}>
        <Group sim={sim} id="rotating">
          <Crankshaft {...p} />
          <RodsAndPistons {...p} />
        </Group>
        <Group sim={sim} id="valvetrain">
          <Camshaft {...p} />
          <ValveTrain {...p} />
        </Group>
        <Group sim={sim} id="cylinders">
          <Cylinders {...p} />
        </Group>
        <Group sim={sim} id="case">
          <Crankcase d={d} mats={mats} />
        </Group>
        <Group sim={sim} id="oil">
          <Lubrication {...p} />
        </Group>
        <Group sim={sim} id="ignition">
          <Ignition {...p} />
        </Group>
        <Group sim={sim} id="fuel">
          <FuelSystem {...p} />
        </Group>
        <Group sim={sim} id="induction">
          <Induction {...p} />
        </Group>
        <Group sim={sim} id="drives">
          <Drives {...p} />
        </Group>
        <Propeller {...p} />
        <Labels sim={sim} d={d} />
      </group>
    </PartNotesProvider>
  );
}

function Labels({ sim, d }: { sim: EngineSim; d: Dims }) {
  const show = sim.useUi((x) => x.view.labels);
  const propOn = sim.useUi((x) => x.view.prop);
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const items: [string, [number, number, number]][] = [
    ...sim.spec.geometry.cylinders.map((c): [string, [number, number, number]] => [
      `Cyl ${c.n}`,
      [c.x, 0.2, (c.side === "R" ? 1 : -1) * (d.halfWidth - 0.04)],
    ]),
    ["Magnetos", [d.accRear - 0.08, 0.22, 0]],
    ["Oil filter", [d.accRear - 0.12, -0.04, 0]],
    ...((sim.spec.fuelSystem.kind === "carburetor"
      ? [["Carburetor", [d.front + 0.02, d.sumpBottom - 0.13, 0]]]
      : [
          ["Fuel injector", [d.front + 0.02, d.sumpBottom - 0.1, 0]],
          ["Fuel manifold", [0, d.caseTop + 0.09, 0]],
        ]) as [string, [number, number, number]][]),
    ["Starter", [d.flangeX - 0.02, -0.17, -0.22]],
    ["Alternator", [d.flangeX - 0.1, -0.27, 0.25]],
    ["Governor", [d.front + 0.04, 0.16, -0.07]],
  ];
  if (propOn) items.push(["Propeller", [d.flangeX + 0.1, 0.55, 0]]);
  return (
    <>
      {items.map(([t, p]) => (
        <Html key={t} position={p} portal={portal} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label">{t}</div>
        </Html>
      ))}
    </>
  );
}

export default function EngineScene({ sim }: { sim: EngineSim }) {
  useEffect(() => () => useHover.setState({ hover: null }), []);
  return (
    <>
      <Canvas
        camera={{ position: [1.15, 0.62, 1.35], fov: 38, near: 0.02, far: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => useHover.setState({ hover: null })}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 2]} intensity={1.6} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <EngineModel sim={sim} />
        <OrbitControls makeDefault target={[0, -0.02, 0]} enableDamping minDistance={0.5} maxDistance={6} />
      </Canvas>
      <HoverTip />
    </>
  );
}
