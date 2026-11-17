import { act } from "@react-three/fiber";
import { createElement } from "react";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { EngineAssemblies } from "@/components/engine/EngineScene";
import { createEngineSimulation } from "@/components/engine/store";
import { dims, disposeMats, headPoints, magnetoPose, makeMats, toWorld } from "@/components/engine/scene/kit";
import { plugLead } from "@/components/engine/scene/io390/lines";
import { layoutFor } from "@/components/engine/scene/layout";
import { useHover } from "@/components/engine/scene/parts";
import { mountScene } from "./engine-mount";

// Contacts at installed joints and cushioned supports are intentional. The same meshes
// must be entirely separate when their catalog offsets are applied.
const installedJoints = new Map<string, string[]>([
  ["Oil cooler air duct", ["Oil cooler diffuser", "Oil cooler baffle outlet", "Oil cooler duct clamp"]],
  ["Fuel pump outlet hose", ["Engine-driven fuel pump", "Servo inlet hose fitting"]],
  ["Metered fuel hose", ["Fuel manifold", "Servo metered outlet fitting", "Fuel injector"]],
  ["Induction inlet duct", ["Induction air box", "Induction filter outlet clamp", "Throttle inlet hose coupling"]],
  ["Alternate air duct", ["Induction air box"]],
  ["Tailpipe", ["Exhaust muffler"]],
  ["Ignition harness", ["Magneto distributor cap"]],
]);
for (const side of ["feed", "return"])
  installedJoints.set(`Oil cooler ${side} hose`, [
    `Accessory housing cooler ${side} fitting`,
    `Oil cooler ${side} hose coupling`,
  ]);
for (const { n } of IO390.geometry.cylinders) {
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
  installedJoints.set("Exhaust pipe" + suffix, ["Exhaust port" + suffix, "Exhaust collector"]);
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

function surface(name: string, mesh: THREE.Mesh) {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox();
  // The BVHs and their index buffers belong to these test copies.
  g.boundsTree = new MeshBVH(g);
  return { name, g, box: g.boundingBox! };
}
const identity = new THREE.Matrix4();

test("SR20 installation and IPC Fig. 26B: external lines seat at their joints and clear other parts in both views", async () => {
  const sim = createEngineSimulation(IO390),
    d = dims(IO390),
    mats = makeMats(layoutFor(IO390));
  sim.useUi.getState().setView({ prop: true });
  sim.anim.crank = 137;
  sim.s.beta = IO390.propeller.coarseDeg;
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
    for (const blowUp of [false, true]) {
      await act(async () => sim.useUi.getState().setView({ blowUp }));
      mounted.frame();
      const parts = named.map(({ name, mesh }) => surface(name, mesh));
      try {
        const lines = parts.filter((p) => installedJoints.has(p.name));
        expect(lines.map((p) => p.name).sort()).toEqual([...installedJoints.keys()].sort());
        if (!blowUp) {
          // Rotation about x preserves the blades' aftmost station. Coarse pitch gives the
          // largest aft reach of the trailing edge throughout this propeller's pitch range.
          const bladePlane = Math.min(...parts.filter((p) => p.name === "Propeller blade").map((p) => p.box.min.x));
          expect(Number.isFinite(bladePlane)).toBe(true);
          for (const line of lines) expect(line.box.max.x, line.name).toBeLessThan(bladePlane);
        }
        for (const line of lines) {
          // The aft ends of the exposed hoses stay forward of the mount's firewall attachments.
          if (!blowUp) expect(line.box.min.x, line.name).toBeGreaterThan(d.accRear - 0.21);

          const hits = parts
            .filter(
              (p) =>
                p !== line && p.box.intersectsBox(line.box) && line.g.boundsTree!.intersectsGeometry(p.g, identity),
            )
            .map((p) => p.name);
          const joints = installedJoints.get(line.name)!;
          expect(
            hits.filter((name) => blowUp || !joints.includes(name)),
            line.name,
          ).toEqual([]);
          if (!blowUp) {
            // A small clearance is allowed inside the nozzle tubes' cushioned clamps.
            for (const end of joints.filter((n) => !n.startsWith("Nozzle line clamp")))
              expect(hits, line.name).toContain(end);
          }
        }
      } finally {
        parts.forEach((p) => p.g.dispose());
      }
    }
  } finally {
    await mounted.unmount();
    disposeMats(mats);
    sim.dispose();
    useHover.setState({ hover: null });
  }
});

test("the eight ignition leads clear one another from their cap sockets to the individual plug terminals", () => {
  const d = dims(IO390),
    head = headPoints(d);
  const leads = IO390.geometry.cylinders.flatMap((c) =>
    [true, false].map((upper) => {
      const top = IO390.ignition.topPlugMag[c.n];
      const side = upper ? top : top === "L" ? "R" : "L";
      const g = plugLead(
        d,
        c,
        magnetoPose(IO390, d, side, layoutFor(IO390)).capEnd,
        toWorld(c, upper ? head.topLead : head.botLead),
        upper,
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
