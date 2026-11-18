import { act } from "@react-three/fiber";
import { createElement } from "react";
import * as THREE from "three";
import { expect, onTestFinished, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import type { AssemblyId, StudyDetail } from "@/components/engine/assembly-study";
import { componentBounds, fitComponentCamera } from "@/lib/component-stage";
import { EngineAssemblies } from "@/components/engine/EngineScene";
import { createEngineSimulation } from "@/components/engine/store";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { layoutFor } from "@/components/engine/scene/layout";
import { useHover } from "@/components/engine/scene/parts";
import { mountScene } from "./engine-mount";

async function mountStudy() {
  const sim = createEngineSimulation(IO390);
  sim.anim.crank = 137;
  const d = dims(IO390),
    mats = makeMats(layoutFor(IO390));
  const mounted = await mountScene(createElement(EngineAssemblies, { sim, d, mats }));
  const state = sim.checkpoint();
  const pose = new Map<THREE.Mesh, THREE.Matrix4>(),
    named = new Map<string, THREE.Mesh>();
  onTestFinished(async () => {
    await mounted.unmount();
    sim.dispose();
    Object.values(mats).forEach((m) => m.dispose());
    useHover.setState({ hover: null });
  });
  mounted.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    pose.set(object, object.matrixWorld.clone());
    const hit = (object as THREE.Mesh & { __r3f?: { handlers: { onPointerOver?: (event: unknown) => void } } }).__r3f
      ?.handlers.onPointerOver;
    if (hit) {
      useHover.setState({ hover: null });
      hit({ object, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
      const hover = useHover.getState().hover;
      if (hover) {
        if (/\b(bolt|nut|screw|washer|stud|cotter pin|keeper|retaining ring|baffle hook|clamp)\b/i.test(hover.name))
          expect(named.has(hover.name), "duplicate fastener pick target: " + hover.name).toBe(false);
        named.set(hover.name, object);
      }
    }
  });
  const toggle = async (on: boolean) => {
    await act(async () => sim.useUi.getState().setView({ blowUp: on }));
  };
  const focus = async (id: AssemblyId, exploded = true) => {
    await act(async () => sim.useUi.getState().setView({ assembly: { id, exploded } }));
    mounted.frame(1);
  };
  const travel = (name: string) => {
    const mesh = named.get(name);
    expect(mesh, name).toBeDefined();
    return mesh!.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3().setFromMatrixPosition(pose.get(mesh!)!));
  };
  const pick = async (object: THREE.Mesh) => {
    const event = {
      object,
      delta: 0,
      stopPropagation() {},
      nativeEvent: { clientX: 12, clientY: 24, timeStamp: performance.now() },
    };
    const handlers = (object as THREE.Mesh & { __r3f: { handlers: Record<string, (e: typeof event) => void> } }).__r3f
      .handlers;
    await act(async () => {
      handlers.onPointerDown(event);
      handlers.onClick(event);
    });
  };
  return { sim, mounted, state, pose, named, travel, toggle, focus, pick };
}

test("PC-IO-390-C Figs. 10–13: the two banks and their hardware separate and return to the same running pose", async () => {
  const { sim, mounted, state, pose, named, travel, toggle, focus, pick } = await mountStudy();
  await toggle(true);
  mounted.frame(0.35);
  const halfway = travel("Cylinder 1 head");
  expect(halfway.length()).toBeGreaterThan(0);
  await toggle(false);
  mounted.frame(0.1);
  expect(travel("Cylinder 1 head").length()).toBeLessThan(halfway.length());
  await toggle(true);
  mounted.frame(1);
  for (const { n } of IO390.geometry.cylinders) {
    const offset = travel(`Cylinder ${n} head`);
    expect(offset.length()).toBeGreaterThan(halfway.length());
    for (const part of ["Piston", "Rocker cover screw (1)", "Intake valve"]) {
      expect(travel(`${part}, cylinder ${n}`).distanceTo(offset)).toBeLessThan(1e-9);
    }
  }
  const groupPose = travel("Rocker cover screw (1), cylinder 1");
  await focus("cylinder-1", false);
  const visible = () => {
    const meshes = new Set<THREE.Object3D>();
    mounted.scene.traverseVisible((m) => meshes.add(m));
    return meshes;
  };
  expect(visible().has(named.get("Cylinder 2 head")!)).toBe(false);
  expect(visible().has(named.get("Piston, cylinder 1")!)).toBe(true);
  await act(async () => sim.useUi.getState().setView({ assembly: { id: "cylinder-1", exploded: true } }));
  const destination = componentBounds(mounted.scene);
  mounted.frame(0.25);
  const partial = travel("Rocker cover screw (1), cylinder 1").distanceTo(groupPose);
  mounted.frame(1);
  expect(partial).toBeGreaterThan(0);
  expect(partial).toBeLessThan(travel("Rocker cover screw (1), cylinder 1").distanceTo(groupPose));
  expect(componentBounds(mounted.scene).max.distanceTo(destination.max)).toBeLessThan(1e-9);
  await focus("cylinder-1", false);
  expect(travel("Rocker cover screw (1), cylinder 1").equals(groupPose)).toBe(true);
  for (const c of IO390.geometry.cylinders) {
    await focus(`cylinder-${c.n}`);
    const sign = c.side === "R" ? 1 : -1;
    const out = (name: string) => travel(name + ", cylinder " + c.n).z * sign;
    const head = travel(`Cylinder ${c.n} head`).z * sign;
    expect(head).toBeGreaterThan(0);
    expect(out("Rocker cover gasket")).toBeGreaterThan(head);
    expect(out("Rocker cover")).toBeGreaterThan(out("Rocker cover gasket"));
    expect(out("Rocker cover screw (1)")).toBeGreaterThan(out("Rocker cover"));
    expect(out("Top compression ring")).toBeGreaterThan(out("Second compression ring"));
    expect(out("Second compression ring")).toBeGreaterThan(out("Oil control ring"));
    expect(out("Oil control ring")).toBeGreaterThan(out("Piston"));
    const spring = (type: string) => travel(type + " valve spring, cylinder " + c.n + " intake").z * sign;
    expect(spring("Outer")).toBeGreaterThan(spring("Inner"));
  }
  // The shielded leads reach every cylinder. Both the installed and separated ignition
  // views should pivot near the two magnetos, including during the flight to the exploded pose.
  const magCentre = (mesh: THREE.Mesh) =>
    mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const magnetos = [...named].filter(([name]) => /^(Left|Right) magneto(?:$| \()/.test(name)).map(([, mesh]) => mesh);
  expect(magnetos).toHaveLength(2);
  const fit = (focused: boolean) =>
    fitComponentCamera(
      mounted.scene,
      new THREE.Vector3(...layoutFor(IO390).camera.position),
      38,
      1020,
      900,
      { left: 28, right: 992, top: 70, bottom: 660 },
      focused,
    )!;
  for (const exploded of [false, true]) {
    await act(async () => sim.useUi.getState().setView({ assembly: { id: "ignition", exploded } }));
    const destination = fit(true);
    mounted.frame(1);
    const pose = fit(true);
    expect(pose.target.distanceTo(destination.target)).toBeLessThan(1e-9);
    const midpoint = magCentre(magnetos[0]).lerp(magCentre(magnetos[1]), 0.5);
    expect(pose.target.distanceTo(midpoint)).toBeLessThan(0.07);
    expect(pose.position.distanceTo(pose.target)).toBeLessThan(fit(false).position.distanceTo(fit(false).target));
  }
  await focus("case");
  expect(travel("Crankcase, left half").z).toBeLessThan(0);
  expect(travel("Crankcase, right half").z).toBeGreaterThan(0);
  expect(travel("Oil sump").y).toBeLessThan(0);
  await focus("shafts");
  expect(travel("Starter ring gear").x).toBeGreaterThan(travel("Starter ring gear support").x);
  expect([...named.keys()].filter((n) => n.startsWith("Rocker cover screw ("))).toHaveLength(32);
  expect([...named.keys()].filter((n) => n.startsWith("Sump flange plain washer ("))).toHaveLength(32);
  const first = named.get("Rocker cover screw (1), cylinder 1")!;
  const next = named.get("Rocker cover screw (2), cylinder 1")!;
  const outlined = (object: THREE.Mesh) => object.children.some((child) => child instanceof THREE.LineSegments);
  await act(async () => sim.useUi.getState().setView({ assembly: undefined }));
  mounted.frame(1);
  await pick(first);
  expect(sim.useUi.getState().view.assembly).toBeUndefined();
  await pick(next);
  expect(sim.useUi.getState().view.assembly).toEqual({ id: "cylinder-1", exploded: false });
  await focus("cylinder-1");
  await pick(first);
  expect(outlined(first)).toBe(true);
  expect(outlined(next)).toBe(false);
  await pick(next);
  expect(outlined(first)).toBe(false);
  expect(outlined(next)).toBe(true);
  for (const [group, inside, shell] of [
    ["ignition", "Ignition coil, left magneto", "Left magneto (retard breaker)"],
    ["drives", "Rotor field winding, ALT 1", "ALT 1"],
    ["drives", "Rotor field winding, ALT 2", "ALT 2"],
    ["drives", "Starter armature", "Starter"],
    ["fuel", "Fuel pump diaphragm", "Engine-driven fuel pump"],
    ["fuel", "Injector air diaphragm", "Fuel injector"],
    ["fuel", "Flow divider spring", "Fuel manifold"],
    ["drives", "Governor speeder spring", "Propeller governor"],
    ["oil", "Oil filter centre tube", "Oil filter"],
  ] as const) {
    await focus(group);
    expect(travel(inside).distanceTo(travel(shell)), inside).toBeGreaterThan(0.045);
  }
  expect(named.has("Retard breaker points, right magneto")).toBe(false);
  expect(named.has("Retard breaker points, left magneto")).toBe(true);
  const fork = sim.fork();
  expect(fork.useUi.getState().view.assembly).toEqual({ id: "oil", exploded: true });
  expect(fork.useUi.getState().view.blowUp).toBe(true);
  fork.dispose();
  await toggle(false);
  mounted.frame(1);
  let restored = 0;
  mounted.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    expect(object.matrixWorld.equals(pose.get(object)!)).toBe(true);
    restored++;
  });
  // A four-cylinder Slick distributor turns at half rotor speed in the opposite direction.
  const angle = (name: string) => new THREE.Quaternion().setFromRotationMatrix(named.get(name)!.matrixWorld);
  const rotor = "Magnetic rotor, left magneto",
    distributor = "Distributor gear, left magneto";
  const beforeRotor = angle(rotor),
    beforeDist = angle(distributor),
    beforeArmature = angle("Starter armature");
  sim.anim.crank += 22;
  mounted.frame();
  expect(angle(rotor).angleTo(beforeRotor)).toBeCloseTo((22 * Math.PI) / 180, 6);
  expect(angle(distributor).angleTo(beforeDist)).toBeCloseTo((11 * Math.PI) / 180, 6);
  expect(angle("Starter armature").angleTo(beforeArmature)).toBeCloseTo(0, 6);
  sim.anim.crank -= 22;
  mounted.frame();
  expect(restored).toBe(pose.size);
  expect(sim.checkpoint()).toEqual({ ...state, ui: { ...state.ui, view: { ...state.ui.view, blowUp: false } } });
});

test("an isolated accessory separates on its own and a paired cylinder follows the installed crank geometry", async () => {
  const { sim, mounted, named, travel, toggle, focus, pick } = await mountStudy();
  await toggle(true);
  const detail = async (next: StudyDetail | undefined) => {
    const { view, setView } = sim.useUi.getState();
    await act(async () => setView({ assembly: { ...view.assembly!, detail: next } }));
    mounted.frame(1);
  };
  await focus("drives");
  await pick(named.get("ALT 2")!);
  await pick(named.get("ALT 2 pulley")!);
  expect(sim.useUi.getState().view.assembly?.detail).toEqual({
    kind: "component",
    id: "alternator-2",
    exploded: false,
  });
  mounted.frame(1);
  const seen = (name: string) => {
    const mesh = named.get(name);
    expect(mesh, name).toBeDefined();
    for (let part: THREE.Object3D | null = mesh!; part; part = part.parent) if (!part.visible) return false;
    return true;
  };
  expect(seen("ALT 2")).toBe(true);
  expect(seen("ALT 1")).toBe(false);
  expect(seen("Starter")).toBe(false);
  expect(seen("ALT 2 belt")).toBe(false);
  const field = "Rotor field winding, ALT 2";
  expect(travel(field).distanceTo(travel("ALT 2"))).toBeLessThan(1e-9);
  const opening = { kind: "component", id: "alternator-2", exploded: true } as const;
  await act(async () => sim.useUi.getState().setView({ assembly: { id: "drives", exploded: true, detail: opening } }));
  mounted.frame(0.3);
  const halfway = travel(field).distanceTo(travel("ALT 2"));
  mounted.frame(1);
  expect(halfway).toBeGreaterThan(0);
  expect(travel(field).distanceTo(travel("ALT 2"))).toBeGreaterThan(halfway);
  await detail({ kind: "component", id: "alternator-2", exploded: false });
  expect(travel(field).distanceTo(travel("ALT 2"))).toBeLessThan(1e-9);
  await detail(undefined);
  expect(seen("ALT 1")).toBe(true);
  expect(travel(field).distanceTo(travel("ALT 2"))).toBeGreaterThan(0.045);
  await focus("ignition");
  await detail({ kind: "component", id: "left-magneto", exploded: true });
  expect(seen("Ignition coil, left magneto")).toBe(true);
  expect(seen("Ignition coil, right magneto")).toBe(false);
  expect(seen("Ignition harness")).toBe(false);
  // IOM Fig. 4: both banks share the installed crankshaft. At a hand-turned angle,
  // every visible part must match its pose in the complete engine at that angle.
  await focus("shafts");
  for (const { n } of IO390.geometry.cylinders) {
    const parts = [
      "Crankshaft",
      `Piston, cylinder ${n}`,
      `Connecting rod, cylinder ${n}`,
      `Intake valve, cylinder ${n}`,
    ];
    await detail({ kind: "linkage", cylinder: n });
    expect(seen(`Piston, cylinder ${n === 1 ? 2 : 1}`)).toBe(false);
    for (const name of parts) {
      expect(seen(name), name).toBe(true);
      expect(travel(name).length(), name).toBeLessThan(1e-9);
    }
    await detail({ kind: "linkage", cylinder: n, angle: 47 });
    expect(travel(parts[1]).length()).toBeGreaterThan(0.01);
    const scrubbed = parts.map((name) => named.get(name)!.matrixWorld.clone());
    expect(sim.anim.crank).toBe(137);
    sim.anim.crank = 47;
    await detail({ kind: "linkage", cylinder: n });
    parts.forEach((name, i) => expect(named.get(name)!.matrixWorld.equals(scrubbed[i]), name).toBe(true));
    sim.anim.crank = 137;
  }
  await detail({ kind: "linkage", cylinder: "all", angle: 268 });
  const parts = [
    "Crankshaft",
    ...IO390.geometry.cylinders.flatMap(({ n }) => [
      `Piston, cylinder ${n}`,
      `Connecting rod, cylinder ${n}`,
      `Intake valve, cylinder ${n}`,
    ]),
  ];
  const allPoses = parts.map((name) => {
    expect(seen(name), name).toBe(true);
    return named.get(name)!.matrixWorld.clone();
  });
  expect(seen("Starter")).toBe(false);
  expect(sim.anim.crank).toBe(137);
  sim.anim.crank = 268;
  await toggle(false);
  mounted.frame(1);
  parts.forEach((name, i) => expect(named.get(name)!.matrixWorld.equals(allPoses[i]), name).toBe(true));
});
