/** Door assemblies must pass through their apertures without crossing fixed exterior skins.
 * Sampled operating poses of the schematic model, not surveyed installation tolerances. */
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { PartSpec } from "@/lib/catalogue";
import { describe, expect, it } from "vitest";
import * as SR20 from "@/aircraft/sr20/geometry";
import * as C172 from "@/aircraft/c172s/geometry";
import * as C182 from "@/aircraft/c182t/geometry";
import * as M20C from "@/aircraft/m20c/geometry";
import { CAT as sr20 } from "@/aircraft/sr20/parts";
import { CAT as c172 } from "@/aircraft/c172s/parts";
import { CAT as c182 } from "@/aircraft/c182t/parts";
import { CAT as m20c } from "@/aircraft/m20c/parts";
import { doorMatrix } from "@/lib/doors";
import { firstSurfaceSample } from "./placement-helpers";
import { useSR20 } from "@/aircraft/sr20/store";
import { useC172 } from "@/aircraft/c172s/store";
import { useC182 } from "@/aircraft/c182t/store";
import { useM20C } from "@/aircraft/m20c/store";

const fleet = [
  { id: "sr20", geo: SR20, cat: sr20 },
  { id: "c172s", geo: C172, cat: c172 },
  { id: "c182t", geo: C182, cat: c182 },
  { id: "m20c", geo: M20C, cat: m20c },
];
describe.each(fleet)("$id door surface crossings", ({ geo, cat }) => {
  it("keeps attached panels and hardware clear of fixed skins at eight opening poses", () => {
    const skins = cat.shells.map((s) => {
      const g = s.geo().clone();
      return { name: s.name, g, bvh: new MeshBVH(g) };
    });
    const failures: string[] = [];
    const saved = [useSR20.getState(), useC172.getState(), useC182.getState(), useM20C.getState()] as const;
    saved[0].update((s) => {
      s.lights.door = s.lights.doorR = s.lights.bag = true;
    });
    saved[1].update((s) => {
      s.cabin.doorL = s.cabin.doorR = s.cabin.bag = s.cabin.windowL = s.cabin.windowR = true;
    });
    saved[2].update((s) => {
      s.cabin.doorL = s.cabin.doorR = s.cabin.bag = s.cabin.windowL = s.cabin.windowR = true;
    });
    saved[3].update((s) => {
      s.doors.cabin = s.doors.baggage = false;
    });
    try {
      for (const part of cat.parts.filter((p) => p.parent?.startsWith("door:"))) {
        const door = geo.DOORS.find((d) => `door:${d.key}` === part.parent)!;
        const mesh = new THREE.Mesh(part.geo().clone(), new THREE.MeshStandardMaterial());
        if (part.pos) mesh.position.fromArray(part.pos);
        if (part.rot) mesh.rotation.set(...part.rot);
        if (part.scale) mesh.scale.fromArray(part.scale);
        part.anim?.(mesh, 0);
        mesh.updateMatrix();
        const g = mesh.geometry.applyMatrix4(mesh.matrix);
        mesh.material.dispose();
        // The outside lever intentionally rises out of its recess when released
        // (SR20 AMM 52-10 Fig 52-10-3). Bound the illustrative travel to 15 mm.
        const allowance = part.name === "Exterior cabin door handle" ? 0.015 : 0.0001;
        if (!part.ext && firstSurfaceSample(g, (p) => !geo.FUSE.inside(p, -allowance)))
          failures.push(`${part.name}: unlocked hardware protrudes through closed door skin`);
        Object.assign(g, { boundsTree: new MeshBVH(g) });
        try {
          for (const fraction of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
            const transform = doorMatrix(door, fraction);
            if (door.parent)
              transform.premultiply(
                doorMatrix(
                  geo.DOORS.find((d) => d.key === door.parent)!,
                  fraction,
                ),
              );
            for (const skin of skins) {
              if (skin.bvh.intersectsGeometry(g, transform)) {
                failures.push(`${part.name} / ${skin.name} @ ${fraction}`);
                break;
              }
            }
            if (failures.at(-1)?.startsWith(`${part.name} /`)) break;
          }
        } finally {
          g.dispose();
        }
      }
    } finally {
      skins.forEach((s) => s.g.dispose());
      useSR20.setState(saved[0]);
      useC172.setState(saved[1]);
      useC182.setState(saved[2]);
      useM20C.setState(saved[3]);
    }
    expect(failures).toEqual([]);
  }, 30_000);
});

import { CAT as da40, CANOPY_SHELL, DOOR_SHELL, CANOPY_HINGE, DOOR_HINGE } from "@/aircraft/da40/parts";
import { DOOR_POSE as diamondPose } from "@/aircraft/da40/parts/mechanisms";
import { DOOR_POSE as cirrusPose } from "@/aircraft/sr20/parts/door-motion";
import { useDA40 } from "@/aircraft/da40/store";

it("DA40 canopy, rear door, locks and strut do not cross fixed exterior skins through opening", () => {
  const saved = useDA40.getState();
  const skins = da40.shells.map((s) => {
    const g = s.geo().clone();
    return { name: s.name, g, bvh: new MeshBVH(g) };
  });
  const moving: PartSpec[] = [
    ...da40.parts.filter(
      (p) => p.parent === "door" || p.parent === "canopy" || p.name?.startsWith("Rear door gas strut"),
    ),
    { ...CANOPY_SHELL, sys: [], parent: "canopy" },
    { ...DOOR_SHELL, sys: [], parent: "door" },
  ];
  const failures: string[] = [];
  try {
    saved.update((s) => {
      s.doors.canopy = "OPEN";
      s.doors.rear = false;
    });
    for (const fraction of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      diamondPose.rear = fraction;
      for (const part of moving) {
        const mesh = new THREE.Mesh(part.geo().clone(), new THREE.MeshStandardMaterial());
        if (part.pos) mesh.position.fromArray(part.pos);
        if (part.rot) mesh.rotation.set(...part.rot);
        if (part.scale) mesh.scale.fromArray(part.scale);
        part.anim?.(mesh, 0);
        mesh.updateMatrix();
        if (part.parent)
          mesh.matrix.premultiply(
            new THREE.Matrix4()
              .makeTranslation(...(part.parent === "canopy" ? CANOPY_HINGE : DOOR_HINGE))
              .multiply(
                part.parent === "canopy"
                  ? new THREE.Matrix4().makeRotationZ((-fraction * 52 * Math.PI) / 180)
                  : new THREE.Matrix4().makeRotationX((fraction * 82 * Math.PI) / 180),
              ),
          );
        Object.assign(mesh.geometry, { boundsTree: new MeshBVH(mesh.geometry) });
        for (const skin of skins)
          if (skin.bvh.intersectsGeometry(mesh.geometry, mesh.matrix))
            failures.push(`${part.name} / ${skin.name} @ ${fraction}`);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  } finally {
    skins.forEach((s) => s.g.dispose());
    diamondPose.rear = 0;
    useDA40.setState(saved);
  }
  expect(failures).toEqual([]);
}, 30_000);

it("SR20 telescoping struts clear the fixed skin through opening", () => {
  const g = sr20.shells
    .find((s) => s.name === "Fuselage")!
    .geo()
    .clone();
  const bvh = new MeshBVH(g),
    failures: string[] = [];
  try {
    for (const fraction of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      cirrusPose.L = cirrusPose.R = fraction;
      for (const part of sr20.parts.filter((p) => p.name?.startsWith("Cabin door gas strut"))) {
        const mesh = new THREE.Mesh(part.geo().clone());
        part.anim?.(mesh, 0);
        mesh.updateMatrix();
        Object.assign(mesh.geometry, { boundsTree: new MeshBVH(mesh.geometry) });
        if (bvh.intersectsGeometry(mesh.geometry, mesh.matrix)) failures.push(`${part.name} @ ${fraction}`);
        mesh.geometry.dispose();
      }
    }
  } finally {
    g.dispose();
    cirrusPose.L = cirrusPose.R = 0;
  }
  expect(failures).toEqual([]);
}, 30_000);

it.each(fleet.filter((f) => f.id === "c172s" || f.id === "c182t"))(
  "$id opening windows clear their own door panels",
  ({ geo, cat }) => {
    const failures: string[] = [];
    const saved = useC172.getState();
    saved.update((s) => {
      s.cabin.windowL = s.cabin.windowR = true;
    });
    try {
      for (const door of geo.DOORS.filter((d) => d.parent)) {
        const panels = cat.parts
          .filter((p) => p.fairing && p.parent === `door:${door.parent}`)
          .map((p) => {
            const g = p.geo().clone();
            return { g, bvh: new MeshBVH(g) };
          });
        try {
          for (const part of cat.parts.filter((p) => p.parent === `door:${door.key}`)) {
            const mesh = new THREE.Mesh(part.geo().clone());
            if (part.pos) mesh.position.fromArray(part.pos);
            if (part.rot) mesh.rotation.set(...part.rot);
            if (part.scale) mesh.scale.fromArray(part.scale);
            part.anim?.(mesh, 0);
            mesh.updateMatrix();
            const g = mesh.geometry.applyMatrix4(mesh.matrix);
            Object.assign(g, { boundsTree: new MeshBVH(g) });
            try {
              for (const fraction of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1])
                if (panels.some((p) => p.bvh.intersectsGeometry(g, doorMatrix(door, fraction))))
                  failures.push(`${part.name} @ ${fraction}`);
            } finally {
              g.dispose();
            }
          }
        } finally {
          panels.forEach((p) => p.g.dispose());
        }
      }
    } finally {
      useC172.setState(saved);
    }
    expect(failures).toEqual([]);
  },
  30_000,
);
