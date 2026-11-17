import { act } from "@react-three/fiber";
import { createElement } from "react";
import * as THREE from "three";
import { expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { EngineAssemblies } from "@/components/engine/EngineScene";
import { createEngineSimulation } from "@/components/engine/store";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { layoutFor } from "@/components/engine/scene/layout";
import { useHover } from "@/components/engine/scene/parts";
import { mountScene } from "./engine-mount";

test("PC-IO-390-C Figs. 10–13: the two banks and their hardware separate and return to the same running pose", async () => {
  const sim = createEngineSimulation(IO390);
  sim.anim.crank = 137;
  const d = dims(IO390),
    mats = makeMats(layoutFor(IO390));
  const mounted = await mountScene(createElement(EngineAssemblies, { sim, d, mats }));
  const state = sim.checkpoint();
  const pose = new Map<THREE.Mesh, THREE.Matrix4>(),
    named = new Map<string, THREE.Mesh>();
  try {
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
      mounted.frame();
    };
    await toggle(true);
    const travel = (name: string) => {
      const mesh = named.get(name);
      expect(mesh, name).toBeDefined();
      return mesh!
        .getWorldPosition(new THREE.Vector3())
        .sub(new THREE.Vector3().setFromMatrixPosition(pose.get(mesh!)!));
    };
    for (const c of IO390.geometry.cylinders) {
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
    expect(travel("Crankcase, left half").z).toBeLessThan(0);
    expect(travel("Crankcase, right half").z).toBeGreaterThan(0);
    expect(travel("Oil sump").y).toBeLessThan(0);
    expect(travel("Starter ring gear").x).toBeGreaterThan(travel("Starter ring gear support").x);
    expect([...named.keys()].filter((n) => n.startsWith("Rocker cover screw ("))).toHaveLength(32);
    expect([...named.keys()].filter((n) => n.startsWith("Sump flange plain washer ("))).toHaveLength(32);
    const first = named.get("Rocker cover screw (1), cylinder 1")!;
    const next = named.get("Rocker cover screw (2), cylinder 1")!;
    const pick = async (object: THREE.Mesh) => {
      const event = { object, delta: 0, stopPropagation() {}, nativeEvent: { clientX: 12, clientY: 24 } };
      const handlers = (object as THREE.Mesh & { __r3f: { handlers: Record<string, (e: typeof event) => void> } }).__r3f
        .handlers;
      await act(async () => {
        handlers.onPointerDown(event);
        handlers.onClick(event);
      });
    };
    const outlined = (object: THREE.Mesh) => object.children.some((child) => child instanceof THREE.LineSegments);
    await pick(first);
    expect(outlined(first)).toBe(true);
    expect(outlined(next)).toBe(false);
    await pick(next);
    expect(outlined(first)).toBe(false);
    expect(outlined(next)).toBe(true);
    for (const [inside, shell] of [
      ["Ignition coil, left magneto", "Left magneto (retard breaker)"],
      ["Rotor field winding, ALT 1", "ALT 1"],
      ["Rotor field winding, ALT 2", "ALT 2"],
      ["Starter armature", "Starter"],
      ["Fuel pump diaphragm", "Engine-driven fuel pump"],
      ["Injector air diaphragm", "Fuel injector"],
      ["Flow divider spring", "Fuel manifold"],
      ["Governor speeder spring", "Propeller governor"],
      ["Oil filter centre tube", "Oil filter"],
    ])
      expect(travel(inside).distanceTo(travel(shell)), inside).toBeGreaterThan(0.045);
    expect(named.has("Retard breaker points, right magneto")).toBe(false);
    expect(named.has("Retard breaker points, left magneto")).toBe(true);
    const fork = sim.fork();
    expect(fork.useUi.getState().view.blowUp).toBe(true);
    fork.dispose();
    await toggle(false);
    expect(outlined(next)).toBe(true);
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
  } finally {
    await mounted.unmount();
    sim.dispose();
    Object.values(mats).forEach((m) => m.dispose());
    useHover.setState({ hover: null });
  }
});
