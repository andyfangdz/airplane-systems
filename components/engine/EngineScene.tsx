"use client";
/**
 * The engine drawn part by part (scene/): crankcase and accessory housing, crankshaft with counterweights, rods and
 * pistons, camshaft and valve train, cylinders, ignition, fuel injection or the carburetor, induction and exhaust,
 * lubrication, the drives and the propeller. Every part names itself on hover (in the engine's own words where its
 * spec gives them); each group can be hidden from the panel. Everything moves from the simulation's mutable state in
 * `useFrame`. Published dimensions set the scale; placement, labels and the camera come from the engine's scene layout
 * (scene/layout.ts), and the shapes are schematic.
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { EngineSim } from "./store";
import { makeSolidFinishes } from "./scene/io390/finishes";
import { Crankcase, Lubrication } from "./scene/Case";
import { IO360Airframe } from "./scene/io360/Airframe";
import { Cylinders } from "./scene/Cylinders";
import { dims, disposeMats, labelOccluder, makeMats, XRAY_MATS, type Dims, type Mats } from "./scene/kit";
import { layoutFor } from "./scene/layout";
import { accessorySpread, Separation, Spread, cylinderSpread } from "./scene/Separation";
import { Group, PartNotesProvider } from "./scene/parts";
import { ComponentStage } from "./ComponentStage";
import { Crankshaft, RodsAndPistons } from "./scene/Rotating";
import { Drives, FuelSystem, Ignition, Induction, Propeller } from "./scene/Systems";
import { Exhaust } from "./scene/Exhaust";
import { Turbo } from "./scene/Turbo";
import { Camshaft, ValveTrain } from "./scene/Valvetrain";

function EngineModel({ sim }: { sim: EngineSim }) {
  const reducedMotion = useReducedMotion();
  const d = useMemo(() => dims(sim.spec), [sim]);
  const L = layoutFor(sim.spec);
  const study = useMemo(() => makeMats(L), [L]);
  const finishes = useMemo(() => (L.detailed ? makeSolidFinishes(L) : null), [L]);
  const xray = sim.useUi((s) => s.view.xray);
  const mats = !xray && finishes ? finishes.mats : study;
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!L.detailed) return;
    const studio = new RoomEnvironment(),
      generator = new THREE.PMREMGenerator(gl);
    const reflection = generator.fromScene(studio, 0.04);
    studio.dispose();
    generator.dispose();
    const previous = scene.environment,
      intensity = scene.environmentIntensity;
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.65;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = intensity;
      reflection.dispose();
    };
  }, [L, gl, scene]);
  useEffect(() => () => disposeMats(study), [study]);
  useEffect(() => () => finishes?.dispose(), [finishes]);
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
      const a = !reducedMotion && s.rpm > 50 ? s.rough * 0.006 : 0;
      const t = state.clock.elapsedTime;
      body.current.position.set(0, Math.sin(t * 37) * a, Math.sin(t * 23 + 1) * a);
    }
  });
  return (
    <group ref={body}>
      <EngineAssemblies sim={sim} d={d} mats={mats} />
      <Labels sim={sim} d={d} />
    </group>
  );
}

export function EngineAssemblies(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  const { sim } = p;
  const L = layoutFor(sim.spec);
  const open = sim.useUi((x) => !!x.view.blowUp);
  return (
    <PartNotesProvider value={sim.spec.parts}>
      <Separation.Provider value={L.detailed ? open : null}>
        <Group sim={sim} id="rotating">
          <Crankshaft {...p} />
          <RodsAndPistons {...p} />
        </Group>
        <Group sim={sim} id="valvetrain">
          <Spread by={[0, 0.28, 0]}>
            <Camshaft {...p} />
          </Spread>
          <ValveTrain {...p} />
        </Group>
        <Group sim={sim} id="cylinders">
          <Cylinders {...p} />
        </Group>
        {L.parallelValve && (
          <Group sim={sim} id="installation">
            <IO360Airframe spec={sim.spec} d={p.d} mats={p.mats} />
          </Group>
        )}
        <Group sim={sim} id="case">
          <Crankcase {...p} />
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
        {L.turbo && (
          <Group sim={sim} id="turbo">
            <Turbo {...p} />
          </Group>
        )}
        {L.exhaust && (
          <Group sim={sim} id="exhaust">
            <Exhaust {...p} />
          </Group>
        )}
        <Group sim={sim} id="drives">
          <Drives {...p} />
        </Group>
        <Spread by={accessorySpread.Propeller}>
          <Propeller {...p} />
        </Spread>
      </Separation.Provider>
    </PartNotesProvider>
  );
}

/** The layout's labels left showing: a label tied to a part group hides while that group is hidden. */
export const shownLabels = <T extends [string, unknown, { group?: string }?]>(items: T[], hidden: readonly string[]) =>
  items.filter(([, , o]) => !(o?.group && hidden.includes(o.group)));

function explodedLabel(name: string, p: [number, number, number], sim: EngineSim): [number, number, number] {
  const c = sim.spec.geometry.cylinders.find((c) => name === `Cyl ${c.n}`);
  const offset = c ? cylinderSpread(c, 0.44) : accessorySpread[name];
  return offset ? [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]] : p;
}

export function Labels({ sim, d }: { sim: EngineSim; d: Dims }) {
  const open = sim.useUi((x) => !!x.view.blowUp && !!layoutFor(sim.spec).detailed);
  const show = sim.useUi((x) => x.view.labels);
  const propOn = sim.useUi((x) => x.view.prop);
  const turboHidden = sim.useUi((x) => x.view.hidden.includes("turbo"));
  const exhaustHidden = sim.useUi((x) => x.view.hidden.includes("exhaust"));
  const hidden = sim.useUi((x) => x.view.hidden);
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const items: [string, [number, number, number], { occlude?: true; group?: string }?][] = [
    ...(hidden.includes("cylinders")
      ? []
      : sim.spec.geometry.cylinders.map((c): [string, [number, number, number]] => [
          `Cyl ${c.n}`,
          [c.x, 0.2, (c.side === "R" ? 1 : -1) * (d.halfWidth - 0.04)],
        ])),
    ...shownLabels(layoutFor(sim.spec).labels(d, sim.spec), hidden),
    // the turbo group's labels go with its parts
    ...((!turboHidden && layoutFor(sim.spec).turbo?.labels) || []),
    ...((!exhaustHidden && layoutFor(sim.spec).exhaust?.labels) || []),
  ];
  if (propOn) items.push(["Propeller", [d.flangeX + 0.1, 0.55, 0]]);
  return (
    <>
      {items.map(([t, p, o]) => (
        <Html
          key={t}
          position={open ? explodedLabel(t, p, sim) : p}
          portal={portal}
          center
          occlude={o?.occlude && [labelOccluder(scene, t)]}
          // Html caches occlusion while its anchor is stationary. Its strict `movement > eps` check needs a
          // negative threshold to notice hidden groups, X-ray changes and moving blockers on every frame.
          eps={o?.occlude ? -1 : undefined}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="eng-label">{t}</div>
        </Html>
      ))}
    </>
  );
}

export default function EngineScene({ sim }: { sim: EngineSim }) {
  const cam = layoutFor(sim.spec).camera;
  const solid = sim.useUi((s) => !!layoutFor(sim.spec).detailed && !s.view.xray);
  const open = sim.useUi((x) => !!x.view.blowUp && !!layoutFor(sim.spec).detailed);
  const prop = sim.useUi((x) => x.view.prop),
    hidden = sim.useUi((x) => x.view.hidden);
  return (
    <ComponentStage
      frameKey={`${open}:${prop}:${hidden.join(",")}`}
      shadowExtent={solid ? (open ? 1.35 : prop ? 1.02 : 0.81) : undefined}
      ambient={solid ? 0.28 : undefined}
      keyLight={solid ? { position: [2.5, 3.8, 2], intensity: 2.05 } : undefined}
      camera={{ position: cam.position, fov: 38, near: 0.02, far: 40 }}
      target={cam.target}
      minDistance={0.5}
      maxDistance={cam.maxDistance}
    >
      <EngineModel sim={sim} />
    </ComponentStage>
  );
}
