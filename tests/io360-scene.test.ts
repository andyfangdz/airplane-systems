import { act } from "@react-three/fiber";
import { createElement } from "react";
import * as THREE from "three";
import { expect, test } from "vitest";
import { EngineAssemblies } from "@/components/engine/EngineScene";
import { createEngineSimulation } from "@/components/engine/store";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { coolerPosition } from "@/components/engine/scene/io360/installation";
import { layoutFor } from "@/components/engine/scene/layout";
import { useHover } from "@/components/engine/scene/parts";
import { IO360_C172S } from "@/engines/io360-l2a/spec";
import { IO360_DA40 } from "@/engines/io360-m1a/spec";
import { mountScene } from "./engine-mount";

for (const spec of [IO360_C172S, IO360_DA40]) {
  test(spec.model + " IPC ch. 72–74: the installed parts separate, remain inspectable and reassemble", async () => {
    const cessna = spec === IO360_C172S;
    const sim = createEngineSimulation(spec);
    const mats = makeMats(layoutFor(spec));
    const mounted = await mountScene(createElement(EngineAssemblies, { sim, d: dims(spec), mats }));
    const initial = sim.checkpoint();
    const parts = new Map<string, THREE.Mesh>();
    const assembled = new Map<THREE.Mesh, THREE.Matrix4>();
    try {
      mounted.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        assembled.set(object, object.matrixWorld.clone());
        const hit = (object as THREE.Mesh & { __r3f?: { handlers: { onPointerOver?: (e: unknown) => void } } }).__r3f
          ?.handlers.onPointerOver;
        if (!hit) return;
        useHover.setState({ hover: null });
        hit({ object, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
        const hover = useHover.getState().hover;
        if (!hover) return;
        expect(hover.note, hover.name).not.toMatch(/\b(?:SR20|C3B6|IO-390)\b/);
        parts.set(hover.name, object);
        if (hover.name === "Right intercylinder baffle grommet") expect(hover.note).toContain("MS35489-20X");
        if (hover.name === "Rocker cover, cylinder 1") expect(hover.note).toContain("61247");
      });
      const count = (prefix: string) => [...parts.keys()].filter((name) => name.startsWith(prefix)).length;
      expect(count("Rocker shaft, cylinder")).toBe(4);
      expect(count("Rocker shaft thrust button (")).toBe(8);
      const valveAxis = (name: string) => new THREE.Vector3(0, 0, 1).transformDirection(parts.get(name)!.matrixWorld);
      for (let n = 1; n <= 4; n++)
        expect(valveAxis("Intake valve, cylinder " + n).dot(valveAxis("Exhaust valve, cylinder " + n))).toBeCloseTo(
          1,
          8,
        );
      expect(count("Rocker cover screw (")).toBe(24);
      expect(count("Rocker shaft bushing (")).toBe(16);
      expect(count("Sump flange plain washer (")).toBe(cessna ? 28 : 26);
      expect(count("Sump attaching bolt (")).toBe(cessna ? 16 : 8);
      expect(parts.has("Propeller spacer")).toBe(cessna);
      expect(parts.has(cessna ? "McCauley propeller hub" : "MT propeller hub")).toBe(true);
      expect(parts.has("Propeller governor")).toBe(!cessna);
      expect(parts.has("Governor speeder spring")).toBe(!cessna);
      expect(parts.has("Right impulse coupling")).toBe(cessna);
      expect(parts.has("Fuel return line")).toBe(cessna);
      expect(parts.has("SlickSTART ignition booster")).toBe(!cessna);
      expect(parts.has("Power Flow collector")).toBe(!cessna);
      expect(parts.has("Fuel-flow transducer")).toBe(true);
      for (const side of ["Left", "Right"]) {
        for (const piece of [
          "cylinder bank baffle",
          "cylinder baffle seal",
          "rear cooling baffle",
          "rear baffle seal",
          "upper engine shock mount",
          "lower engine shock mount",
        ])
          expect(parts.has(side + " " + piece)).toBe(true);
      }
      for (const name of [
        "Engine mount weldment",
        "Cabin heat inlet hose",
        "Left cooling inlet ramp",
        "Right intercylinder baffle grommet",
        "Battery mounting tray",
        "Battery cover",
        "Battery hold-down",
      ])
        expect(parts.has(name), name).toBe(true);
      for (const name of ["Right cooling inlet ramp", "Engine-driven vacuum pump"])
        expect(parts.has(name), name).toBe(cessna);
      for (const name of [
        "Battery cooling hose",
        "Supplemental engine cooling outlet",
        "Upper intake baffle",
        "Accessory air Y connector",
        "Oil cooler air duct",
        "Oil cooler duct seal",
        "Alternator cooling hose",
        "Oil cooler mounting brackets",
        "Right baffle tie bar",
      ])
        expect(parts.has(name), name).toBe(!cessna);
      const battery = new THREE.Box3().setFromObject(parts.get("Main battery")!);
      expect(cessna ? battery.max.z < 0 : battery.min.z > 0).toBe(true);
      // The Cessna cooler sees the upper plenum through the rear baffle. The Diamond cooler has its own duct.
      const [, cy, cz] = coolerPosition(dims(spec), true);
      const hitsBaffle = (y: number) =>
        new THREE.Raycaster(new THREE.Vector3(1, y, cz), new THREE.Vector3(-1, 0, 0)).intersectObject(
          parts.get("Right rear cooling baffle")!,
        ).length > 0;
      expect(hitsBaffle(cy)).toBe(!cessna);
      expect(hitsBaffle(cy + 0.06)).toBe(true);
      expect(parts.has("ALT 2")).toBe(false);
      expect(parts.has("Dynamic counterweight")).toBe(false);
      const door = cessna ? "Automatic alternate air door" : "Rotary alternate air sleeve";
      const toggle = async (on: boolean) => {
        await act(async () => sim.useUi.getState().setView({ blowUp: on }));
        mounted.frame();
      };
      await toggle(true);
      const travel = (name: string) => {
        const part = parts.get(name);
        expect(part, name).toBeDefined();
        return part!
          .getWorldPosition(new THREE.Vector3())
          .sub(new THREE.Vector3().setFromMatrixPosition(assembled.get(part!)!));
      };
      expect(travel("Right cylinder bank baffle").z).toBeGreaterThan(0.2);
      expect(travel("Left cylinder bank baffle").z).toBeLessThan(-0.2);
      expect(travel("Engine mount weldment").x).toBeLessThan(-0.2);
      expect(travel(door).length()).toBeGreaterThan(0.2);
      expect(travel("Rocker cover screw (1), cylinder 1").z).toBeGreaterThan(travel("Cylinder 1 head").z);
      expect(travel("Rocker cover screw (1), cylinder 2").z).toBeLessThan(travel("Cylinder 2 head").z);
      await toggle(false);
      for (const [mesh, pose] of assembled) expect(mesh.matrixWorld.equals(pose)).toBe(true);
      expect(sim.checkpoint()).toEqual({
        ...initial,
        ui: { ...initial.ui, view: { ...initial.ui.view, blowUp: false } },
      });
    } finally {
      await mounted.unmount();
      sim.dispose();
      Object.values(mats).forEach((m) => m.dispose());
      useHover.setState({ hover: null });
    }
  });
}
