import { describe, expect, it } from "vitest";
import { CAT as C172, MANIFOLD as M172 } from "@/aircraft/c172s/parts";
import { CAT as C182, MANIFOLD as M182, STALL_HORN } from "@/aircraft/c182t/parts";
import { FLOWS as F172 } from "@/aircraft/c172s/flows";
import { FLOWS as F182 } from "@/aircraft/c182t/flows";
import { RIG as R172, RIG_SPEC as S172 } from "@/aircraft/c172s/rig";
import { RIG as R182, RIG_SPEC as S182 } from "@/aircraft/c182t/rig";
import * as G172 from "@/aircraft/c172s/geometry";
import * as G182 from "@/aircraft/c182t/geometry";
import { namedPart, partBounds, points, worldGeometry } from "./placement-helpers";

// These are consistency checks against the approximate scene, not certified installation dimensions.
describe.each([
  ["C172S", C172, G172, R172, S172, F172, M172, "GFC 700 roll servo", 59.5],
  ["C182T", C182, G182, R182, S182, F182, M182, "KS 271C roll servo", 52],
] as const)("%s cabin placement", (_id, cat, geometry, rig, spec, flows, manifold, servoName, sourceArm) => {
  it("keeps the console, shoulder-harness reels and roll servo separate (POH cabin descriptions; servo equipment-list arms)", () => {
    const parts = cat.parts.filter((p) =>
      ["Overhead console", "Inertia reel (front seat)", servoName].includes(p.name ?? ""),
    );
    expect(parts).toHaveLength(4);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        expect(partBounds(parts[i]).intersectsBox(partBounds(parts[j])), `${parts[i].name} / ${parts[j].name}`).toBe(
          false,
        );
      }
    }
    expect(spec.servo.roll[0]).toBe(sourceArm);
    const cable = rig.cable("ailBal");
    expect(
      cable.pts.some(
        (p) => Math.abs(p[0] - geometry.X(sourceArm)) < 1e-9 && Math.abs(p[2] - geometry.Z(spec.servo.roll[1])) < 1e-9,
      ),
    ).toBe(true);
  });

  it("places the manifold above the rudder bars and connects its ducts to the same anchor (POH Fig. 7-8)", () => {
    const housing = namedPart(cat, "Cabin manifold");
    expect(housing.pos).toEqual(manifold);
    const bars = cat.parts.filter((p) => p.name === "Rudder bars");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(partBounds(housing).intersectsBox(partBounds(bar))).toBe(false);
    expect(flows.find((f) => f.key === "toMan")!.pts.at(-1)).toEqual(manifold);
    expect(flows.find((f) => f.key === "defrostL")!.pts[0]).toEqual(manifold);
  });

  it("puts the illustrative control-lock pin at the pilot shaft rather than through the PFD", () => {
    const lock = namedPart(cat, "Control lock");
    expect(lock.pos![1]).toBe(geometry.Y(spec.yoke.h));
    expect(lock.pos![2]).toBe(geometry.Z(-spec.yoke.bl));
    expect(partBounds(lock).intersectsBox(partBounds(namedPart(cat, "PFD — GDU 1040")))).toBe(false);
  });

  it("keeps cabin fittings, seats and tailcone avionics inside the modelled fuselage", () => {
    const names = [
      "Overhead console",
      "Inertia reel (front seat)",
      servoName,
      "Pilot seat",
      "Front passenger seat",
      "Rear bench seat",
      ...(cat === C172 ? ["GIA 63W #1", "GIA 63W #2"] : ["GIA 63 #1", "GIA 63 #2"]),
      "GRS 77 AHRS",
      "GTX 33 transponder",
    ];
    const parts = cat.parts.filter((p) => names.includes(p.name ?? ""));
    expect(parts).toHaveLength(14);
    for (const part of parts) {
      const mesh = worldGeometry(part);
      try {
        expect(
          points(mesh).every((p) => geometry.inFus(p, -0.004)),
          part.name,
        ).toBe(true);
      } finally {
        mesh.dispose();
      }
    }
  });
});

it("keeps the C182 stall horn inside the headliner at source arm 40.0 and its wire attached (POH 7-65, 6-22)", () => {
  const horn = namedPart(C182, "Stall warning horn");
  expect(horn.pos).toEqual(STALL_HORN);
  expect(horn.pos![0]).toBe(G182.X(40));
  const mesh = worldGeometry(horn);
  try {
    expect(points(mesh).every((p) => G182.inFus(p, -0.004))).toBe(true);
  } finally {
    mesh.dispose();
  }
  expect(F182.find((f) => f.key === "stall")!.pts.at(-1)).toEqual(STALL_HORN);
});

it("keeps the C182 forward cooling fan clear of the ADC while preserving its source arm (POH 7-69, 6-23)", () => {
  const fan = namedPart(C182, "Forward avionics cooling fan");
  expect(fan.pos![0]).toBe(G182.X(12.7));
  expect(partBounds(fan).intersectsBox(partBounds(namedPart(C182, "GDC 74A air data computer")))).toBe(false);
});

it("keeps the C172 aft baggage floor above the control-cable turnbuckles", () => {
  const floor = partBounds(namedPart(C172, "Baggage area B (FS 108–142)"));
  for (const part of C172.parts.filter((p) => p.name === "Turnbuckle"))
    expect(floor.intersectsBox(partBounds(part))).toBe(false);
});
