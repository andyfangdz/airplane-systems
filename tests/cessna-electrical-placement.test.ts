import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAT as skyhawk } from "@/aircraft/c172s/parts";
import { CAT as skylane } from "@/aircraft/c182t/parts";
import { AF as skyhawkAirframe } from "@/aircraft/c172s/geometry";
import { AF as skylaneAirframe } from "@/aircraft/c182t/geometry";
import { FLOWS } from "@/aircraft/c172s/flows";
import { namedPart, partBounds, points, worldGeometry } from "./placement-helpers";

describe.each([
  { cat: skyhawk, airframe: skyhawkAirframe },
  { cat: skylane, airframe: skylaneAirframe },
])("$cat.prefix electrical equipment clearance", ({ cat, airframe }) => {
  it("keeps battery cases, controller, J-box and internals inside the skin", () => {
    for (const name of [
      "Main battery — 24 V",
      "Standby battery",
      "Standby battery controller",
      "Power distribution module (J-box)",
      "Alternator Control Unit (ACU)",
      "Main battery current shunt",
      "Alternator — 28 V, 60 A",
    ]) {
      const geometry = worldGeometry(namedPart(cat, name));
      for (const p of points(geometry)) expect(airframe.inFus(p, 0.002), name).toBe(true);
      geometry.dispose();
    }
  });

  it("places the ACU and shunt inside their J-box, without overlapping each other", () => {
    const enclosure = partBounds(namedPart(cat, "Power distribution module (J-box)"));
    const acu = partBounds(namedPart(cat, "Alternator Control Unit (ACU)"));
    const shunt = partBounds(namedPart(cat, "Main battery current shunt"));
    expect(enclosure.containsBox(acu)).toBe(true);
    expect(enclosure.containsBox(shunt)).toBe(true);
    expect(acu.intersectsBox(shunt)).toBe(false);
  });

  it("separates the standby battery case and controller", () => {
    expect(
      partBounds(namedPart(cat, "Standby battery")).intersectsBox(
        partBounds(namedPart(cat, "Standby battery controller")),
      ),
    ).toBe(false);
  });
});

it("retains the C172S battery arm and case size while clearing the engine mount and J-box", () => {
  const spec = namedPart(skyhawk, "Main battery — 24 V");
  const battery = partBounds(spec);
  expect(spec.pos![0]).toBeCloseTo(skyhawkAirframe.X(-5), 6); // POH equipment-list arm
  const size = battery.getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(0.12, 6);
  expect(size.y).toBeCloseTo(0.2, 6);
  expect(size.z).toBeCloseTo(0.18, 6);
  expect(battery.intersectsBox(partBounds(namedPart(skyhawk, "Power distribution module (J-box)")))).toBe(false);
  for (const mount of skyhawk.parts.filter((p) => p.name === "Engine mount")) {
    const geometry = worldGeometry(mount);
    for (const p of points(geometry)) expect(battery.distanceToPoint(p)).toBeGreaterThan(0.01);
    geometry.dispose();
  }
  const cable = FLOWS.find((f) => f.key === "bat")!;
  const terminal = new THREE.Vector3(...(cable.pts[0] as [number, number, number]));
  expect(terminal.y).toBeCloseTo(battery.min.y, 6);
  expect(battery.clone().expandByScalar(1e-6).containsPoint(terminal)).toBe(true);
});

it("fits the C172S alternator body clear of the crankcase and sump at its documented arm", () => {
  const alternator = namedPart(skyhawk, "Alternator — 28 V, 60 A");
  expect(alternator.pos![0]).toBeCloseTo(skyhawkAirframe.X(-29), 6);
  const geometry = worldGeometry(alternator);
  for (const name of ["Lycoming IO-360-L2A", "Oil sump"]) {
    const occupied = partBounds(namedPart(skyhawk, name));
    for (const p of points(geometry)) expect(occupied.distanceToPoint(p), name).toBeGreaterThan(0.001);
  }
  geometry.dispose();
});
