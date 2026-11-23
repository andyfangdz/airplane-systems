import {
  Box3,
  DoubleSide,
  Euler,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector3,
  type BufferGeometry,
} from "three";
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

// EASA IM.E.096, p. 7, gives dimensions for the bare PW812D inside its nacelle.
it("matches the PW812D fan case diameter and spinner-to-tailcone length on each side", () => {
  const cases = CAT.parts.filter((part) => part.name === "Fan case");
  expect(cases).toHaveLength(2);
  for (const fanCase of cases) {
    // Only part of the circular wall remains in the cutaway. Measure its radius about the shaft.
    const geometry = fanCase.geo();
    const vertices = geometry.getAttribute("position");
    let radius = 0;
    for (let i = 0; i < vertices.count; i++) radius = Math.max(radius, Math.hypot(vertices.getY(i), vertices.getZ(i)));
    geometry.dispose();
    expect(radius * 2).toBeCloseTo(1.109, 3);

    const installed = CAT.parts.filter((part) => part.pos?.[2] === fanCase.pos?.[2]);
    const spinner = installed.find((part) => part.name === "Fan spinner")!;
    const tailcone = installed.find((part) => part.name === "Exhaust centerbody")!;
    const forward = placedBounds(spinner.geo(), spinner.pos, spinner.rot, spinner.scale).max.x;
    const aft = placedBounds(tailcone.geo(), tailcone.pos, tailcone.rot, tailcone.scale).min.x;
    expect(forward - aft).toBeCloseTo(2.874, 3);
  }
});

// Dassault's 14-place day plan and the LX-TIN photographs show four club chairs,
// four conference chairs and two three-place divans within a 12.30 m cabin.
it("fits the illustrated 14-passenger layout within the published cabin length", () => {
  for (const [id, count] of [
    ["club-seat", 4],
    ["conference-seat", 4],
    ["aft-divan", 2],
  ] as const) {
    expect(CAT.parts.filter((part) => part.id.startsWith(`falcon6x/cabin.${id}@`))).toHaveLength(count);
  }
  const deck = CAT.parts.find((part) => part.name === "Cabin floor")!;
  const bounds = placedBounds(deck.geo(), deck.pos, deck.rot, deck.scale);
  expect(bounds.max.x - bounds.min.x).toBeCloseTo(12.3, 2);
});

it("keeps the wing-body fairing below the visible cabin floor", () => {
  const deck = CAT.parts.find((part) => part.name === "Cabin floor")!;
  const fairing = CAT.shells.find((shell) => shell.name === "Wing-body fairing")!;
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const floorMesh = new Mesh(deck.geo(), material);
  const fairingMesh = new Mesh(fairing.geo(), material);
  for (const x of [-2, 1, 3]) {
    const ray = new Raycaster(new Vector3(x, 0.4, 0), new Vector3(0, -1, 0));
    const firstSurface = ray.intersectObjects([floorMesh, fairingMesh])[0];
    expect(firstSurface?.object.uuid).toBe(floorMesh.uuid);
  }
  floorMesh.geometry.dispose();
  fairingMesh.geometry.dispose();
  material.dispose();
});

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

// EASA.A.580, p. 12: 16 × 6.0 R6 nose tires and H33 × 10.5 R17 main tires.
it("uses the nominal tire diameter and width on all six installed wheels", () => {
  for (const [name, count, diameter, width] of [
    ["Nose wheel", 2, 0.4064, 0.1524],
    ["Main wheel", 4, 0.8382, 0.2667],
  ] as const) {
    const tires = CAT.parts.filter((part) => part.name === name);
    expect(tires).toHaveLength(count);
    for (const tire of tires) {
      const size = placedBounds(tire.geo(), tire.pos, tire.rot, tire.scale).getSize(new Vector3());
      expect(size.x).toBeCloseTo(diameter, 4);
      expect(size.y).toBeCloseTo(diameter, 4);
      expect(size.z).toBeCloseTo(width, 4);
    }
  }
});
