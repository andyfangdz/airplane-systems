/** Headliner equipment: OM pp. 3, 11 and Ranger 2-7.
 * Checks the approximate model's attachment/containment, not installation dimensions. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAT } from "@/aircraft/m20c/parts";
import { FLOWS } from "@/aircraft/m20c/flows";
import { fuselageGeo, inFus, windowOutlines } from "@/aircraft/m20c/geometry";
import { useM20C } from "@/aircraft/m20c/store";
import { curveOf } from "@/lib/geometry";
import { V } from "@/lib/math";
import { namedPart, points, worldGeometry } from "./placement-helpers";

describe("M20C overhead attachments", () => {
  it("keeps windshield and door outlines on the skin rather than above the roof", () => {
    for (const loop of windowOutlines()) {
      for (const p of loop) {
        expect(inFus(p, -0.006), p.toArray().join(", ")).toBe(true);
        expect(inFus(p, 0.006), p.toArray().join(", ")).toBe(false);
      }
    }
  });

  it("keeps the lights, horn and four vents just inside the curved headliner", () => {
    const names = ["Adjustable spot light", "Cabin dome light", "Stall warning horn", "Ceiling outlet"];
    const parts = CAT.parts.filter((p) => names.includes(p.name ?? ""));
    expect(parts).toHaveLength(8);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const skin = new THREE.Mesh(fuselageGeo(), material);
    try {
      for (const part of parts) {
        const geometry = worldGeometry(part);
        try {
          const vertices = points(geometry);
          expect(
            vertices.every((p) => inFus(p)),
            part.name,
          ).toBe(true);
          const top = vertices.reduce((a, b) => (a.y > b.y ? a : b));
          const roof = new THREE.Raycaster(V(top.x, 2, top.z), V(0, -1, 0)).intersectObject(skin)[0];
          expect(roof, part.name).toBeDefined();
          // Close to the skin instead of floating in the middle of the cabin.
          expect(roof.point.y - top.y, part.name).toBeGreaterThanOrEqual(0);
          expect(roof.point.y - top.y, part.name).toBeLessThan(0.012);
        } finally {
          geometry.dispose();
        }
      }
    } finally {
      skin.geometry.dispose();
      material.dispose();
    }
  });

  it("keeps the ceiling ducts inside the roof and joined to their outlets", () => {
    const vents = CAT.parts.filter((p) => p.name === "Ceiling outlet");
    const ducts = FLOWS.filter((f) => /^ceil\d$/.test(f.key));
    expect(ducts).toHaveLength(4);
    for (const [i, duct] of ducts.entries()) {
      expect(duct.pts.at(-1)).toEqual(vents[i].pos);
      const curve = curveOf(duct.pts, duct.tension ?? 0.3);
      const geometry = new THREE.TubeGeometry(
        curve,
        Math.max(24, Math.round(curve.getLength() * 28)),
        duct.r,
        6,
        false,
      );
      try {
        expect(
          points(geometry).every((p) => inFus(p)),
          duct.key,
        ).toBe(true);
      } finally {
        geometry.dispose();
      }
    }
  });

  it("terminates the stall-warning circuit at the horn inside the cabin", () => {
    const horn = namedPart(CAT, "Stall warning horn");
    const wire = FLOWS.find((f) => f.key === "stall")!;
    expect(wire.pts.at(-1)).toEqual(horn.pos);
    const overhead = curveOf(wire.pts, wire.tension ?? 0.3)
      .getPoints(200)
      .filter((p) => p.y > 0);
    expect(overhead.length).toBeGreaterThan(0);
    expect(overhead.every((p) => inFus(p))).toBe(true);
  });

  it("keeps the retractable scoop attached to the roof throughout its actual animation", () => {
    const part = namedPart(CAT, "Overhead ram-air scoop (retractable)");
    const mesh = new THREE.Mesh(part.geo(), new THREE.MeshBasicMaterial());
    mesh.position.set(...part.pos!);
    mesh.rotation.set(...(part.rot ?? [0, 0, 0]));
    const scoop = useM20C.getState().s.env.scoop;
    const heights: number[] = [];
    try {
      for (let i = 0; i <= 20; i++) {
        useM20C.getState().update((d) => {
          d.env.scoop = i / 20;
        });
        part.anim!(mesh, 0);
        mesh.updateMatrix();
        const vertices = points(mesh.geometry).map((p) => p.applyMatrix4(mesh.matrix));
        expect(
          vertices.some((p) => inFus(p)),
          `scoop setting ${i / 20}`,
        ).toBe(true);
        expect(vertices.some((p) => !inFus(p))).toBe(true);
        heights.push(Math.max(...vertices.map((p) => p.y)));
      }
      expect(heights.at(-1)! - heights[0]).toBeGreaterThan(0.025);
    } finally {
      useM20C.getState().update((d) => {
        d.env.scoop = scoop;
      });
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
});
