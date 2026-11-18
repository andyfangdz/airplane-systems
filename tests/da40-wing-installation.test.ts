import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/da40/parts";
import { FLOWS } from "@/aircraft/da40/flows";
import { WJ, wingP } from "@/aircraft/da40/geometry";
import { linkPoints, rigPose } from "@/aircraft/da40/rig";
import { FUEL_CHAMBERS, probePort, wingFuelVolume } from "@/aircraft/da40/wing-installation";
import { toV, V, D2R } from "@/lib/math";
import { partBounds } from "./placement-helpers";

describe.each([
  ["L", -1],
  ["R", 1],
] as const)("DA40 %s wing installation", (suffix, side) => {
  it("keeps fuel inside the three separate chambers and the two upper hoses distinct at each joint (AFM 7-35)", () => {
    const volume = wingFuelVolume(side);
    const positions = volume.getAttribute("position");
    const indices = volume.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
      const spans = [0, 1, 2].map((offset) => positions.getZ(indices.getX(i + offset)) * side);
      expect(FUEL_CHAMBERS.some((c) => spans.every((z) => z >= c.z0 - 1e-6 && z <= c.z1 + 1e-6))).toBe(true);
    }
    volume.dispose();
    for (const i of [0, 1]) {
      const routes = FLOWS.filter((f) => f.key.startsWith(`chamberVent${suffix}${i}`));
      expect(routes).toHaveLength(2);
      const liquid = FLOWS.find((f) => f.key === `chamberFuel${suffix}${i}`)!;
      for (const vent of routes) {
        const [a, b] = vent.pts.map(toV);
        expect(a.z * side).toBeCloseTo(FUEL_CHAMBERS[i].z1);
        expect(b.z * side).toBeCloseTo(FUEL_CHAMBERS[i + 1].z0);
        expect(a.y).toBeGreaterThan(toV(liquid.pts[1]).y);
      }
      expect(toV(routes[0].pts[0]).distanceTo(toV(routes[1].pts[0]))).toBeGreaterThan(0.05);
    }
    for (const lr of [false, true]) {
      const route = FLOWS.find((f) => f.key === `fuelProbe${suffix}${lr ? "LR" : "IB"}`)!;
      expect(toV(route.pts[0]).toArray()).toEqual(probePort(side, lr, "mount"));
      const guide = toV(probePort(side, lr, "guide"));
      expect(CAT.parts.some((p) => p.name === "Fuel probe guide" && partBounds(p).containsPoint(guide))).toBe(true);
    }
  });

  it("leaves the fuel opening clear in the root and tank ribs (AMM 57-10-00 p. 4)", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const ribs = CAT.parts.filter((p) => p.name === "Root rib / wing joint" || p.name === "Fuel tank support rib");
    const onSide = ribs.filter((p) => partBounds(p).getCenter(V(0, 0, 0)).z * side > 0);
    expect(onSide).toHaveLength(6);
    for (const rib of onSide) {
      const z = partBounds(rib).getCenter(V(0, 0, 0)).z;
      const mesh = new THREE.Mesh(rib.geo(), material);
      const through = (chord: number) => {
        const start = wingP(z, chord, 0);
        start.z -= 0.08;
        return new THREE.Raycaster(start, V(0, 0, 1), 0, 0.16).intersectObject(mesh);
      };
      expect(through(0.35)).toHaveLength(0);
      expect(through(0.18).length).toBeGreaterThan(0);
      mesh.geometry.dispose();
    }
    material.dispose();
  });

  it("keeps the idler-to-horn drive connected through flap travel (AMM 27-50-00 Figs. 1–2)", () => {
    const surface = CAT.surfaces.find((s) => s.key === "flap" + suffix)!;
    const horn = CAT.parts.find((p) => p.name === "Flap control horn" && p.parent === "surf:" + surface.key)!;
    const neutral = partBounds(horn);
    const tip = neutral.getCenter(V(0, 0, 0));
    tip.y = neutral.min.y;
    for (const degrees of [0, 10, 20, 31, 42]) {
      const links = linkPoints(rigPose({ pitch: 0, roll: 0, yaw: 0 }, degrees));
      const center = links["flapCenter" + suffix],
        wing = links["flapWing" + suffix],
        input = links["flapInputArm" + suffix],
        output = links["flapOutputArm" + suffix],
        rod = links["flapRod" + suffix];
      expect(links.flapAct[1]).toEqual(links.flapIdler[1]);
      expect(center[0]).toEqual(links.flapIdler[1]);
      expect(center[1]).toEqual(wing[0]);
      expect(center[1].z * side).toBeCloseTo(WJ, 1);
      expect(wing[1]).toEqual(input[0]);
      expect(input[1]).toEqual(output[0]);
      expect(output[1]).toEqual(rod[0]);
      const onSurface = tip
        .clone()
        .applyAxisAngle(toV(surface.axis), side * degrees * D2R)
        .add(toV(surface.pivot));
      expect(rod[1].distanceTo(onSurface)).toBeLessThan(1e-6);
    }
  });
});
