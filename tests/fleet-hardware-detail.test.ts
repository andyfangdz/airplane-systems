/** Existing POH/AMM equipment envelopes and mechanical controls remain authoritative. */
import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import "@/aircraft/sr20/parts";
import { CAT as C172 } from "@/aircraft/c172s/parts";
import "@/aircraft/c182t/parts";
import { CAT as DA40 } from "@/aircraft/da40/parts";
import "@/aircraft/m20c/parts";
import { HARDWARE_DETAILS as D20, BRAKE_RODS as R20 } from "@/aircraft/sr20/parts/hardware-detail";
import { HARDWARE_DETAILS as D172, BRAKE_RODS as R172, PARK_LOCKS } from "@/aircraft/c172s/parts/hardware-detail";
import { HARDWARE_DETAILS as D182, PARK_LINKS } from "@/aircraft/c182t/parts/hardware-detail";
import { HARDWARE_DETAILS as D40, AIR_BUTTERFLIES } from "@/aircraft/da40/parts/hardware-detail";
import { HARDWARE_DETAILS as DMC, THROTTLE_PLATE, MIXTURE_VALVE } from "@/aircraft/m20c/parts/hardware-detail";
import { useSR20 } from "@/aircraft/sr20/store";
import { useC172 } from "@/aircraft/c172s/store";
import { useC182 } from "@/aircraft/c182t/store";
import { useDA40 } from "@/aircraft/da40/store";
import { useM20C } from "@/aircraft/m20c/store";
import type { PartSpec } from "@/lib/catalogue";

function save<S>(store: { getState: () => S; setState: (state: S) => void }) {
  const state = store.getState();
  return () => store.setState(state);
}
const reset = [save(useSR20), save(useC172), save(useC182), save(useDA40), save(useM20C)];
afterEach(() => reset.forEach((restore) => restore()));
const meshFor = (spec: PartSpec) => {
  const m = new THREE.Mesh(spec.geo(), new THREE.MeshStandardMaterial());
  if (spec.pos) m.position.fromArray(spec.pos);
  if (spec.rot) m.rotation.set(...spec.rot);
  return m;
};

describe.each([
  { id: "sr20", details: D20 },
  { id: "c172s", details: D172 },
  { id: "c182t", details: D182 },
  { id: "da40", details: D40 },
  { id: "m20c", details: DMC },
])("$id component detail", ({ details }) => {
  it("stays inside every existing installation envelope with finite surface normals", () => {
    for (const { spec, source } of details) {
      const envelope = source();
      envelope.computeBoundingBox();
      const bounds = envelope.boundingBox!.clone().expandByScalar(1e-7);
      const g = spec.geo(),
        p = g.getAttribute("position"),
        v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) expect(bounds.containsPoint(v.fromBufferAttribute(p, i)), spec.id).toBe(true);
      expect(Array.from(g.getAttribute("normal").array).every(Number.isFinite), spec.id).toBe(true);
      expect(spec.note, spec.id).toContain("illustrative");
      g.dispose();
    }
  });
});

it("SR20 AMM 32-42 p.23 and C172 POH 7-46: corresponding pedals stroke the correct circuit, and release", () => {
  for (const [store, rods, axis, direction] of [
    [useSR20, R20, "y", -1],
    [useC172, R172, "x", 1],
  ] as const) {
    const meshes = rods.map(meshFor);
    for (const diff of [-1, 0, 1, 0]) {
      store.getState().update((s) => {
        s.gear.diff = diff;
        s.gear.park = false;
      });
      rods.forEach((spec, i) => {
        spec.anim!(meshes[i], 0);
        const amount = i % 2 === 0 ? Math.max(0, -diff) : Math.max(0, diff);
        expect(meshes[i].position[axis]).toBeCloseTo(spec.pos![axis === "y" ? 1 : 0] + direction * 0.012 * amount);
        const pose = meshes[i].position.clone();
        spec.anim!(meshes[i], 10);
        expect(meshes[i].position.equals(pose)).toBe(true);
      });
    }
  }
});

it("Cessna mechanical parking locks follow the handle and release without changing the brake architecture", () => {
  for (const [store, parts, stroke] of [
    [useC172, PARK_LOCKS, 0.008],
    [useC182, PARK_LINKS, 0.009],
  ] as const) {
    for (const park of [false, true, false]) {
      store.getState().update((s) => {
        s.gear.park = park;
      });
      for (const spec of parts) {
        const mesh = meshFor(spec);
        spec.anim!(mesh, 0);
        expect(mesh.position.y).toBeCloseTo(spec.pos![1] - (park ? stroke : 0));
      }
    }
  }
});

it("DA40 AMM 21-00: heat and distribution move independently and stay within their valve housings throughout travel", () => {
  const boxes = ["Heat valve", "Floor / defrost distributor valve"].map((name) => {
    const spec = DA40.parts.find((p) => p.name === name)!;
    const g = spec.geo();
    g.computeBoundingBox();
    return g.boundingBox!.clone().translate(new THREE.Vector3(...spec.pos!));
  });
  for (let n = 0; n <= 20; n++) {
    useDA40.getState().update((s) => {
      s.env.heat = n / 20;
      s.env.dist = 1 - n / 20;
    });
    AIR_BUTTERFLIES.forEach((spec, i) => {
      const m = meshFor(spec);
      spec.anim!(m, 0);
      m.updateMatrix();
      const p = m.geometry.getAttribute("position"),
        v = new THREE.Vector3();
      for (let j = 0; j < p.count; j++)
        expect(boxes[i].containsPoint(v.fromBufferAttribute(p, j).applyMatrix4(m.matrix)), spec.name).toBe(true);
      expect(m.rotation.z).toBeCloseTo(((i === 0 ? n / 20 : 1 - n / 20) * Math.PI) / 2);
    });
  }
});

it("C172 POH 7-30 and Mooney MAN106 §4-9: engine controls work mechanically with electrical power off", () => {
  const throttle = C172.parts.find((p) => p.name === "Throttle butterfly linkage")!;
  const mixture = C172.parts.find((p) => p.name === "Servo mixture linkage")!;
  for (const value of [0, 0.5, 1, 0]) {
    useC172.getState().update((s) => {
      s.eng.throttle = value;
      s.eng.mix = 1 - value;
      s.elec.bat = false;
    });
    useM20C.getState().update((s) => {
      s.eng.throttle = value;
      s.eng.mix = 1 - value;
      s.elec.master = false;
    });
    const t = meshFor(throttle),
      m = meshFor(mixture),
      plate = meshFor(THROTTLE_PLATE),
      valve = meshFor(MIXTURE_VALVE);
    throttle.anim!(t, 0);
    mixture.anim!(m, 0);
    THROTTLE_PLATE.anim!(plate, 0);
    MIXTURE_VALVE.anim!(valve, 0);
    expect(t.rotation.z).toBeCloseTo((value - 0.5) * 1.2);
    expect(m.rotation.z).toBeCloseTo((0.5 - value) * 1.2);
    expect(plate.rotation.z).toBeCloseTo((value * Math.PI) / 2);
    expect(valve.position.z).toBeCloseTo(MIXTURE_VALVE.pos![2] + (0.5 - value) * 0.008);
  }
});
