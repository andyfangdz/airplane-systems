import { act } from "@react-three/fiber";
import { createElement } from "react";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { expect, test } from "vitest";
import type { EngineSpec } from "@/engines/types";
import { IO360_C172S } from "@/engines/io360-l2a/spec";
import { IO360_DA40 } from "@/engines/io360-m1a/spec";
import { firewallX } from "@/components/engine/scene/io360/installation";
import { IO390 } from "@/engines/io390/spec";
import { assemblyStations } from "@/components/engine/assembly-study";
import { EngineAssemblies } from "@/components/engine/EngineScene";
import { createEngineSimulation } from "@/components/engine/store";
import { dims, disposeMats, headPoints, magnetoPose, makeMats, toWorld } from "@/components/engine/scene/kit";
import { plugLead } from "@/components/engine/scene/io390/lines";
import { layoutFor } from "@/components/engine/scene/layout";
import { useHover } from "@/components/engine/scene/parts";
import { mountScene } from "./engine-mount";

// Contacts at installed joints and cushioned supports are intentional. The same meshes
// must be entirely separate when their catalog offsets are applied.
function routingJoints(spec: EngineSpec) {
  const cirrus = spec === IO390,
    cessna = spec === IO360_C172S;
  const installedJoints = new Map<string, string[]>([
    ["Fuel pump outlet hose", ["Engine-driven fuel pump", "Servo inlet hose fitting"]],
    ["Metered fuel hose", ["Fuel manifold", "Servo metered outlet fitting", "Fuel injector"]],
    ["Tailpipe", [cirrus || cessna ? "Exhaust muffler" : "Exhaust collector"]],
    ["Ignition harness", ["Magneto distributor cap"]],
  ]);
  for (const side of ["feed", "return"])
    installedJoints.set(`Oil cooler ${side} hose`, [
      `Accessory housing cooler ${side} fitting`,
      cirrus ? `Oil cooler ${side} hose coupling` : "Oil cooler",
    ]);
  if (cirrus) {
    installedJoints.set("Oil cooler air duct", [
      "Oil cooler diffuser",
      "Oil cooler baffle outlet",
      "Oil cooler duct clamp",
    ]);
    installedJoints.set("Induction inlet duct", [
      "Induction air box",
      "Induction filter outlet clamp",
      "Throttle inlet hose coupling",
    ]);
    installedJoints.set("Alternate air duct", ["Induction air box"]);
  } else {
    installedJoints.get(cessna ? "Metered fuel hose" : "Fuel pump outlet hose")!.push("Fuel-flow transducer");
    installedJoints.set("Injector air inlet gaskets", ["Fuel injector", "Throttle body"]);
    if (cessna) {
      installedJoints.set("Left cooling inlet ramp", ["Cabin heat inlet hose"]);
      installedJoints.set("Right cooling inlet ramp", []);
      installedJoints.set("Cabin heat inlet hose", ["Left cooling inlet ramp", "Cabin heat muff"]);
      installedJoints.set("Fuel return line", ["Fuel injector"]);
    } else {
      installedJoints.set("Cabin heat inlet hose", ["Accessory air Y connector", "Cabin heat muff"]);
      installedJoints.set("Oil cooler air duct", ["Right accessory air inlet", "Oil cooler duct seal"]);
      installedJoints.set("Oil cooler duct seal", ["Oil cooler air duct", "Oil cooler"]);
      installedJoints.set("Right accessory air inlet", [
        "Oil cooler air duct",
        "Supplemental engine cooling outlet",
        "Accessory air Y connector",
      ]);
      installedJoints.set("Supplemental engine cooling outlet", ["Right accessory air inlet"]);
      installedJoints.set("Accessory air Y connector", [
        "Right accessory air inlet",
        "Alternator cooling hose",
        "Cabin heat inlet hose",
        "Battery cooling hose",
      ]);
      installedJoints.set("Battery cooling hose", ["Accessory air Y connector", "Main battery"]);
      installedJoints.set("Alternator cooling hose", [
        "Accessory air Y connector",
        "Slip-ring end housing, Alternator",
      ]);
      installedJoints.set("SlickSTART lead", ["SlickSTART ignition booster", "Magneto distributor cap"]);
      installedJoints.set("Left cooling inlet ramp", ["Upper intake baffle"]);
      for (const side of ["Left", "Right"])
        installedJoints.set(side + " baffle tie bar", [side + " cylinder bank baffle", side + " rear cooling baffle"]);
    }
  }
  for (const { n } of spec.geometry.cylinders) {
    const suffix = ", cylinder " + n;
    const clamp = (name: string, i: number) => name + suffix + " (" + i + ")";
    installedJoints.set("Rocker box oil drain" + suffix, ["Rocker box" + suffix, "Drain hose" + suffix]);
    installedJoints.set("Drain hose" + suffix, [
      "Rocker box oil drain" + suffix,
      "Drain nipple" + suffix,
      clamp("Drain hose clamp", 1),
      clamp("Drain hose clamp", 2),
    ]);
    installedJoints.set("Intake pipe" + suffix, [
      "Intake port" + suffix,
      "Intake pipe seal" + suffix,
      "Induction plenum",
    ]);
    installedJoints.set("Exhaust pipe" + suffix, [
      "Exhaust port" + suffix,
      cirrus ? "Exhaust collector" : cessna ? "Exhaust muffler" : "Power Flow collector",
    ]);
    installedJoints.set("Injector line" + suffix, [
      "Flow-divider outlet" + suffix,
      "Fuel injection nozzle" + suffix,
      clamp("Nozzle line clamp", 1),
      clamp("Nozzle line clamp", 2),
    ]);
    installedJoints
      .get("Ignition harness")!
      .push("Shielded lead terminal" + suffix + " top", "Shielded lead terminal" + suffix + " bottom");
  }

  return installedJoints;
}

function surface(name: string, mesh: THREE.Mesh) {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox();
  // The BVHs and their index buffers belong to these test copies.
  g.boundsTree = new MeshBVH(g);
  return { name, g, box: g.boundingBox! };
}
const identity = new THREE.Matrix4();

for (const spec of [IO390, IO360_C172S, IO360_DA40]) {
  test(spec.model + " external routes meet only their installed joints and separate in the exploded view", async () => {
    const installedJoints = routingJoints(spec);
    const sim = createEngineSimulation(spec),
      d = dims(spec),
      mats = makeMats(layoutFor(spec));
    sim.useUi.getState().setView({ prop: true });
    sim.anim.crank = 137;
    sim.s.beta = spec.propeller.coarseDeg;
    const mounted = await mountScene(createElement(EngineAssemblies, { sim, d, mats }));
    const named: { name: string; mesh: THREE.Mesh }[] = [];
    try {
      for (const target of mounted.hoverTargets()) {
        if (!(target instanceof THREE.Mesh)) continue;
        let visible = true;
        target.traverseAncestors((p) => {
          if (!p.visible) visible = false;
        });
        if (!visible || !target.visible) continue;
        const hit = (target as THREE.Mesh & { __r3f: { handlers: { onPointerOver?: (event: unknown) => void } } }).__r3f
          .handlers.onPointerOver;
        if (!hit) continue;
        useHover.setState({ hover: null });
        hit({ object: target, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
        const hover = useHover.getState().hover;
        if (hover) named.push({ name: hover.name, mesh: target });
      }
      const testedLines = new Set<string>();
      for (const view of [undefined, "groups" as const, ...assemblyStations(spec).map((s) => s.id)]) {
        const id = view !== "groups" ? view : undefined;
        const exploded = !!id;
        await act(async () =>
          sim.useUi.getState().setView({ blowUp: !!view, assembly: id ? { id, exploded } : undefined }),
        );
        mounted.frame(1);
        const visible = new Set<THREE.Object3D>();
        mounted.scene.traverseVisible((obj) => visible.add(obj));
        const parts = named.filter((p) => visible.has(p.mesh)).map(({ name, mesh }) => surface(name, mesh));
        try {
          const lines = parts.filter((p) => installedJoints.has(p.name));
          if (exploded) lines.forEach((p) => testedLines.add(p.name));
          if (!exploded) {
            expect(lines.map((p) => p.name).sort()).toEqual([...installedJoints.keys()].sort());
            // Rotation about x preserves the blades' aftmost station. Coarse pitch gives the
            // largest aft reach of the trailing edge throughout this propeller's pitch range.
            const bladePlane = Math.min(...parts.filter((p) => p.name === "Propeller blade").map((p) => p.box.min.x));
            expect(Number.isFinite(bladePlane)).toBe(true);
            for (const line of lines) expect(line.box.max.x, line.name).toBeLessThan(bladePlane);
          }
          for (const line of lines) {
            // The aft ends of the exposed hoses stay forward of the mount's firewall attachments.
            if (!view)
              expect(line.box.min.x, line.name).toBeGreaterThan(
                spec === IO390 ? d.accRear - 0.21 : firewallX(d, spec === IO360_C172S),
              );

            const hits = parts
              .filter(
                (p) =>
                  p !== line && p.box.intersectsBox(line.box) && line.g.boundsTree!.intersectsGeometry(p.g, identity),
              )
              .map((p) => p.name);
            const joints = installedJoints.get(line.name)!;
            expect(
              hits.filter((name) => exploded || !joints.includes(name)),
              line.name,
            ).toEqual([]);
            if (!view) {
              // A small clearance is allowed inside the nozzle tubes' cushioned clamps.
              for (const end of joints.filter((n) => !n.startsWith("Nozzle line clamp")))
                expect(hits, line.name).toContain(end);
            }
          }
        } finally {
          parts.forEach((p) => p.g.dispose());
        }
      }
      expect([...testedLines].sort()).toEqual([...installedJoints.keys()].sort());
    } finally {
      await mounted.unmount();
      disposeMats(mats);
      sim.dispose();
      useHover.setState({ hover: null });
    }
  });

  test(spec.model + " ignition leads clear one another between their cap sockets and plug terminals", () => {
    const d = dims(spec),
      head = headPoints(d);
    const leads = spec.geometry.cylinders.flatMap((c) =>
      [true, false].map((upper) => {
        const top = spec.ignition.topPlugMag[c.n];
        const side = upper ? top : top === "L" ? "R" : "L";
        const g = plugLead(
          d,
          c,
          magnetoPose(spec, d, side, layoutFor(spec)).capEnd,
          toWorld(c, upper ? head.topLead : head.botLead),
          upper,
          layoutFor(spec).parallelValve,
        );
        g.boundsTree = new MeshBVH(g);
        return { name: `cylinder ${c.n} ${upper ? "top" : "bottom"}`, g };
      }),
    );
    try {
      for (const [i, a] of leads.entries())
        for (const b of leads.slice(i + 1))
          expect(a.g.boundsTree!.intersectsGeometry(b.g, identity), a.name + " and " + b.name).toBe(false);
    } finally {
      leads.forEach((p) => p.g.dispose());
    }
  });
}
