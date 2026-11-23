import { Box3, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from "three";
import { expect, it } from "vitest";
import type { Vec3 } from "@/lib/math";
import { GROUND_Y, WING } from "@/aircraft/falcon6x/geometry";
import { CAT } from "@/aircraft/falcon6x/parts";

function placedBounds(geometry: BufferGeometry, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  geometry.computeBoundingBox();
  const placement = new Matrix4().compose(
    new Vector3(...pos),
    new Quaternion().setFromEuler(new Euler(...rot)),
    new Vector3(...scale),
  );
  const box = geometry.boundingBox!.clone().applyMatrix4(placement);
  geometry.dispose();
  return box;
}

// Dassault's Falcon 6X external dimensions and Facts & Figures (September 2023), p. 3.
// Measure the assembled aircraft, including the raised wingtips and hinge-relative tail surfaces.
it("matches the Falcon 6X exterior envelope in metres with the gear on the ground", () => {
  const bounds = new Box3();
  for (const shell of CAT.shells) bounds.union(placedBounds(shell.geo()));
  for (const surface of CAT.surfaces) bounds.union(placedBounds(surface.geo(), surface.pivot));
  for (const part of CAT.parts) bounds.union(placedBounds(part.geo(), part.pos, part.rot, part.scale));
  const { x, y, z } = bounds.getSize(new Vector3());
  expect(x).toBeCloseTo(25.68, 1);
  expect(y).toBeCloseTo(7.47, 1);
  expect(z).toBeCloseTo(25.94, 1);
  expect(bounds.min.y).toBeCloseTo(GROUND_Y, 1);
}, 30_000);

// June 2026 Overview, p. 7, embedded 1280 px plan view. Nose/tail at columns 15/1232
// span 25.68 m. Inlet/nozzle at columns 833/1057 put the nacelles 17.26–21.99 m aft.
// A 0.20 m allowance covers tracing the rounded inlet and the edge of the exhaust.
it("places both nacelles at the stations shown in Dassault's three-view", () => {
  const nose = placedBounds(CAT.shells.find((s) => s.name === "Fuselage")!.geo()).max.x;
  for (const [name, edge, station] of [
    ["Inlet lip", "max", 17.26],
    ["Exhaust nozzle", "min", 21.99],
  ] as const) {
    const parts = CAT.parts.filter((p) => p.name === name);
    expect(parts).toHaveLength(2);
    const centers = parts.map((part) => {
      const bounds = placedBounds(part.geo(), part.pos, part.rot, part.scale);
      expect(Math.abs(nose - bounds[edge].x - station), part.id).toBeLessThan(0.2);
      return bounds.getCenter(new Vector3()).z;
    });
    // The front view places the shaft axes 140 px apart across an 835 px wingspan.
    expect(Math.abs(Math.abs(centers[0] - centers[1]) - 4.35)).toBeLessThan(0.15);
  }
}, 30_000);

it("anchors the main legs and gear doors under the wing skin", () => {
  const supports = CAT.parts.filter((p) => p.name === "Main landing gear" || p.name === "Main gear door");
  expect(supports).toHaveLength(4);
  for (const part of supports) {
    const geo = part.geo();
    const points = geo.getAttribute("position");
    const origin = new Vector3(...part.pos!);
    const vertex = new Vector3();
    let joined = false;
    let highest = -Infinity;
    for (let i = 0; i < points.count; i++) {
      vertex.fromBufferAttribute(points, i).add(origin);
      const chord = (WING.le(vertex.z) - vertex.x) / WING.chord(vertex.z);
      if (chord < 0 || chord > 1) continue;
      highest = Math.max(highest, vertex.y - WING.p(vertex.z, chord, 1).y);
      joined ||= vertex.y >= WING.p(vertex.z, chord, -1).y;
    }
    geo.dispose();
    expect(joined, part.id).toBe(true);
    expect(highest, part.id).toBeLessThan(0);
  }
});
