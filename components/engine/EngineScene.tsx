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
import * as THREE from "three";
import type { EngineSim } from "./store";
import { Crankcase, Lubrication } from "./scene/Case";
import { Cylinders } from "./scene/Cylinders";
import { dims, labelOccluder, makeMats, XRAY_MATS, type Dims } from "./scene/kit";
import { layoutFor } from "./scene/layout";
import { Group, PartNotesProvider } from "./scene/parts";
import { ComponentStage } from "./ComponentStage";
import { Crankshaft, RodsAndPistons } from "./scene/Rotating";
import { Drives, FuelSystem, Ignition, Induction, Propeller } from "./scene/Systems";
import { Exhaust } from "./scene/Exhaust";
import { Turbo } from "./scene/Turbo";
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
        {layoutFor(sim.spec).turbo && (
          <Group sim={sim} id="turbo">
            <Turbo {...p} />
          </Group>
        )}
        {layoutFor(sim.spec).exhaust && (
          <Group sim={sim} id="exhaust">
            <Exhaust {...p} />
          </Group>
        )}
        <Group sim={sim} id="drives">
          <Drives {...p} />
        </Group>
        <Propeller {...p} />
        <Labels sim={sim} d={d} />
      </group>
    </PartNotesProvider>
  );
}

/** The layout's labels left showing: a label tied to a part group hides while that group is hidden. */
export const shownLabels = <T extends [string, unknown, { group?: string }?]>(items: T[], hidden: readonly string[]) =>
  items.filter(([, , o]) => !(o?.group && hidden.includes(o.group)));

export function Labels({ sim, d }: { sim: EngineSim; d: Dims }) {
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
    ...sim.spec.geometry.cylinders.map((c): [string, [number, number, number]] => [
      `Cyl ${c.n}`,
      [c.x, 0.2, (c.side === "R" ? 1 : -1) * (d.halfWidth - 0.04)],
    ]),
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
          position={p}
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
  return (
    <ComponentStage
      camera={{ position: cam.position, fov: 38, near: 0.02, far: 40 }}
      target={cam.target}
      minDistance={0.5}
      maxDistance={cam.maxDistance}
    >
      <EngineModel sim={sim} />
    </ComponentStage>
  );
}
