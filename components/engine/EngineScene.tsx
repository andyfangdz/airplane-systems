"use client";
/**
 * The engine drawn part by part (scene/): crankcase and accessory housing, crankshaft with counterweights, rods and
 * pistons, camshaft and valve train, cylinders, ignition, fuel injection or the carburetor, induction and exhaust,
 * lubrication, the drives and the propeller. Every part names itself on hover (in the engine's own words where its
 * spec gives them); each group can be hidden from the panel. Everything moves from the simulation's mutable state in
 * `useFrame`. Published dimensions set the scale; placement, labels and the camera come from the engine's scene layout
 * (scene/layout.ts), and the shapes are schematic.
 */
import { rodEnds } from "@/engines/model/cycle";
import type { CylinderDef } from "@/engines/types";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { EngineSim } from "./store";
import { makeSolidFinishes } from "./scene/io390/finishes";
import { Crankcase, Lubrication } from "./scene/Case";
import { IO360Airframe } from "./scene/io360/Airframe";
import { Cylinders } from "./scene/Cylinders";
import { dims, disposeMats, labelOccluder, magDrive, makeMats, XRAY_MATS, type Dims, type Mats } from "./scene/kit";
import { layoutFor, type V3 } from "./scene/layout";
import { Assembly, AssemblyStudy, accessorySpread, Spread, cylinderSpread } from "./scene/Separation";
import { Group, PartNotesProvider } from "./scene/parts";
import {
  assemblyAvailable,
  assemblyStations,
  inCrankLinkage,
  studyCrank,
  studyXray,
  type AssemblyFocus,
  type AssemblyId,
} from "./assembly-study";
import { ComponentStage } from "./ComponentStage";
import { Crankshaft, RodsAndPistons } from "./scene/Rotating";
import { CrankshaftIdler, Drives, FuelSystem, Ignition, Induction, Propeller } from "./scene/Systems";
import { Exhaust } from "./scene/Exhaust";
import { Turbo } from "./scene/Turbo";
import { Camshaft, ValveTrain } from "./scene/Valvetrain";

function EngineModel({ sim }: { sim: EngineSim }) {
  const reducedMotion = useReducedMotion();
  const d = useMemo(() => dims(sim.spec), [sim]);
  const L = layoutFor(sim.spec);
  const study = useMemo(() => makeMats(L), [L]);
  const finishes = useMemo(() => (L.detailed ? makeSolidFinishes(L) : null), [L]);
  const xray = sim.useUi((s) => studyXray(s.view));
  const linkage = sim.useUi((s) => s.view.assembly?.detail?.kind === "linkage");
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
    const s = sim.s;
    for (const k of XRAY_MATS) {
      mats[k].opacity = xray ? (linkage ? 0.065 : k === "barrel" || k === "head" ? 0.28 : 0.16) : 1;
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
      <EngineAssemblies sim={sim} d={d} mats={mats}>
        <Labels sim={sim} d={d} />
      </EngineAssemblies>
    </group>
  );
}

export function EngineAssemblies({ children, ...p }: { sim: EngineSim; d: Dims; mats: Mats; children?: ReactNode }) {
  const { sim } = p;
  const L = layoutFor(sim.spec);
  const model = (
    <PartNotesProvider value={sim.spec.parts}>
      <Group sim={sim} id="rotating">
        <Assembly id="shafts">
          <Crankshaft {...p} />
        </Assembly>
        <RodsAndPistons {...p} />
      </Group>
      <Group sim={sim} id="valvetrain">
        <Assembly id="shafts">
          <Spread by={[0, 0.28, 0]}>
            <Camshaft {...p} />
          </Spread>
        </Assembly>
        <ValveTrain {...p} />
      </Group>
      <Group sim={sim} id="cylinders">
        <Cylinders {...p} />
      </Group>
      {L.parallelValve && (
        <Group sim={sim} id="installation">
          <Assembly id="installation">
            <IO360Airframe spec={sim.spec} d={p.d} mats={p.mats} />
          </Assembly>
        </Group>
      )}
      <Group sim={sim} id="case">
        <Assembly id="case">
          <Crankcase {...p} />
        </Assembly>
      </Group>
      <Group sim={sim} id="oil">
        <Lubrication {...p} />
      </Group>
      <Group sim={sim} id="ignition">
        <Assembly id="ignition">
          <Ignition {...p} />
        </Assembly>
      </Group>
      {L.detailed && (
        <>
          <CrankshaftIdler {...p} side="L" />
          <CrankshaftIdler {...p} side="R" />
        </>
      )}
      <Group sim={sim} id="fuel">
        <Assembly id="fuel">
          <FuelSystem {...p} />
        </Assembly>
      </Group>
      <Group sim={sim} id="induction">
        <Assembly id="induction">
          <Induction {...p} />
        </Assembly>
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
        <Assembly id="drives">
          <Drives {...p} />
        </Assembly>
      </Group>
      <Assembly id="propeller">
        <Propeller {...p} />
      </Assembly>
      {children}
    </PartNotesProvider>
  );
  return L.detailed ? <AssemblyStudy sim={sim}>{model}</AssemblyStudy> : model;
}

/** Keep each label on its end of the linkage while the user turns the crank. */
function LinkagePins({ sim, cylinder }: { sim: EngineSim; cylinder: CylinderDef }) {
  const rod = useRef<THREE.Group>(null),
    wrist = useRef<THREE.Group>(null);
  useFrame(() => {
    const { pin, piston } = rodEnds(sim.spec, cylinder, studyCrank(sim));
    rod.current?.position.set(cylinder.x, (pin.y + piston.y) / 2, (pin.z + piston.z) / 2);
    wrist.current?.position.set(cylinder.x, piston.y, piston.z);
  });
  return (
    <>
      <group ref={rod}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label eng-link-pin below">Connecting rod</div>
        </Html>
      </group>
      <group ref={wrist}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label eng-link-pin">Piston</div>
        </Html>
      </group>
    </>
  );
}

/** The layout's labels left showing: a label tied to a part group hides while that group is hidden. */
export const shownLabels = <T extends [string, unknown, { group?: string }?]>(items: T[], hidden: readonly string[]) =>
  items.filter(([, , o]) => !(o?.group && hidden.includes(o.group)));

export function Labels({ sim, d }: { sim: EngineSim; d: Dims }) {
  const open = sim.useUi((x) => !!x.view.blowUp && !!layoutFor(sim.spec).detailed);
  const focus = sim.useUi((x) => x.view.assembly?.id);
  const component = sim.useUi(({ view }) =>
    view.assembly?.detail?.kind === "component" ? view.assembly.detail.id : undefined,
  );
  const paired = sim.useUi(({ view }) =>
    view.assembly?.detail?.kind === "linkage" ? view.assembly.detail.cylinder : undefined,
  );
  const show = sim.useUi((x) => x.view.labels);
  const propOn = sim.useUi((x) => x.view.prop);
  const turboHidden = sim.useUi((x) => x.view.hidden.includes("turbo"));
  const exhaustHidden = sim.useUi((x) => x.view.hidden.includes("exhaust"));
  const hidden = sim.useUi((x) => x.view.hidden);
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show || component) return null;
  const L = layoutFor(sim.spec);
  const stations = assemblyStations(sim.spec);
  const cylinders = sim.spec.geometry.cylinders;
  type Pin = { name: string; at: V3; station?: AssemblyId; by?: V3; occlude?: boolean; leader?: boolean };
  const items: Pin[] = [
    ...(hidden.includes("cylinders")
      ? []
      : cylinders.map((c): Pin => ({
          name: `Cyl ${c.n}`,
          at: [c.x, 0.2, (c.side === "R" ? 1 : -1) * (d.halfWidth - 0.04)],
          station: `cylinder-${c.n}`,
          by: cylinderSpread(c, 0.44),
        }))),
    ...shownLabels(L.labels(d, sim.spec), hidden).map(([name, at, options]): Pin => ({
      name,
      at,
      occlude: options?.occlude,
      station: stations.find((s) => s.id === options?.group)?.id,
      by: accessorySpread[name],
    })),
    ...[...((!turboHidden && L.turbo?.labels) || []), ...((!exhaustHidden && L.exhaust?.labels) || [])].map(
      ([name, at]) => ({ name, at }),
    ),
  ];
  if (paired !== undefined) items.push({ name: "Crankshaft", at: [d.rear + 0.12, 0, 0], station: "shafts" });
  if (L.detailed && (focus === "shafts" || paired !== undefined) && !hidden.includes("rotating")) {
    const idler = magDrive(sim.spec, d, L, "L").idler!;
    items.push({
      name: "Timing idler",
      at: [idler.x, idler.y, idler.z],
      station: "shafts",
      by: accessorySpread["Timing idler"],
      leader: true,
    });
  }
  if (propOn) items.push({ name: "Propeller", at: [d.flangeX + 0.1, 0.55, 0], station: "propeller", by: [0.23, 0, 0] });
  const pin = ({ name, at, occlude, leader }: Pin) => (
    <Html
      key={name}
      position={at}
      portal={portal}
      center
      occlude={occlude && [labelOccluder(scene, name)]}
      // Re-evaluate moving blockers even when the camera and this anchor are stationary.
      eps={occlude ? -1 : undefined}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className={leader ? "eng-label eng-link-pin" : "eng-label"}>{name}</div>
    </Html>
  );
  if (!L.detailed) return items.map(pin);
  // Keep each anchor's assembly mounted as the label changes so labels travel with the hardware.
  return stations
    .filter((station) => assemblyAvailable(station, { prop: propOn, hidden }))
    .map((station) => {
      const cylinder = cylinders.find((c) => station.id === `cylinder-${c.n}`);
      const at: V3 = cylinder ? [cylinder.x, 0.16, (cylinder.side === "R" ? 1 : -1) * d.halfWidth] : [0, d.caseTop, 0];
      return (
        <Assembly key={station.id} id={station.id}>
          {paired !== undefined && cylinder?.n === paired && <LinkagePins sim={sim} cylinder={cylinder} />}
          {open && !focus ? (
            <Html position={at} portal={portal} center zIndexRange={[10, 0]}>
              <button
                type="button"
                className="eng-label eng-assembly-label"
                onClick={() => sim.useUi.getState().setView({ assembly: { id: station.id, exploded: false } })}
              >
                {station.name}
              </button>
            </Html>
          ) : (
            (paired !== undefined ? inCrankLinkage(station.id, paired) : !focus || focus === station.id) &&
            items
              .filter((p) => p.station === station.id)
              .map((p) => (
                <Spread key={p.name} by={p.by ?? [0, 0, 0]}>
                  {pin(p)}
                </Spread>
              ))
          )}
        </Assembly>
      );
    });
}

/** Upright viewing direction for focused assembly and crankshaft-linkage studies (all keep y > 0, above the engine). */
export function studyFitDirection(
  assembly: AssemblyFocus | undefined,
  cylinders: readonly CylinderDef[],
): V3 | undefined {
  const detail = assembly?.detail;
  const paired = detail?.kind === "linkage" ? detail.cylinder : undefined;
  if (paired === "all") return [-1.15, 0.92, -1.05];
  const cylinder = paired !== undefined ? cylinders.find((c) => c.n === paired) : undefined;
  if (cylinder) return [-1.25, 0.68, cylinder.side === "R" ? 0.72 : -0.72];
  if (assembly?.id === "shafts") return [-1.45, 0.65, -1.35];
  if (assembly?.id === "ignition") return [-1.2, 0.7, 1.45];
  return undefined;
}

export default function EngineScene({ sim }: { sim: EngineSim }) {
  const cam = layoutFor(sim.spec).camera;
  const solid = sim.useUi((s) => !!layoutFor(sim.spec).detailed && !studyXray(s.view));
  const open = sim.useUi((x) => !!x.view.blowUp && !!layoutFor(sim.spec).detailed);
  const assembly = sim.useUi((x) => x.view.assembly);
  const detail = assembly?.detail;
  const paired = detail?.kind === "linkage" ? detail.cylinder : undefined;
  const prop = sim.useUi((x) => x.view.prop),
    hidden = sim.useUi((x) => x.view.hidden);
  return (
    <ComponentStage
      focused={!!assembly}
      // Look from above toward the rear timing gears so every study transition stays upright over the engine.
      fitDirection={studyFitDirection(assembly, sim.spec.geometry.cylinders)}
      motionKey={`${open}:${assembly?.id ?? ""}:${!!assembly?.exploded}:${detail?.kind === "component" ? detail.id + detail.exploded : (paired ?? "")}`}
      frameKey={`${prop}:${hidden.join(",")}`}
      shadowExtent={solid ? (open ? 1.35 : prop ? 1.02 : 0.81) : undefined}
      ambient={solid ? 0.28 : undefined}
      keyLight={solid ? { position: [2.5, 3.8, 2], intensity: 2.05 } : undefined}
      camera={{ position: cam.position, fov: 38, near: 0.02, far: 40 }}
      target={cam.target}
      minDistance={assembly ? 0.12 : 0.5}
      maxDistance={cam.maxDistance}
    >
      <EngineModel sim={sim} />
    </ComponentStage>
  );
}
