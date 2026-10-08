import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAT as c172 } from "@/aircraft/c172s/parts";
import { RIG as rig172 } from "@/aircraft/c172s/rig";
import { live as live172 } from "@/aircraft/c172s/model";
import { CAT as c182 } from "@/aircraft/c182t/parts";
import { RIG as rig182, RUD_TRIM, rudTrimLinks } from "@/aircraft/c182t/rig";
import { live as live182 } from "@/aircraft/c182t/model";
import { useC182 } from "@/aircraft/c182t/store";
import { Y as y182 } from "@/aircraft/c182t/geometry";
import { FSEL } from "@/aircraft/c182t/parts/fuel";
import { CAT as da40 } from "@/aircraft/da40/parts";
import { TAB } from "@/aircraft/da40/rig";
import { V } from "@/lib/math";
import { namedPart, partBounds, worldGeometry } from "./placement-helpers";

const neutral = { pitch: 0, roll: 0, yaw: 0, trim: 0 };

for (const [name, cat, tab, key] of [
  ["C172S", c172, rig172.trimTab, "elevR"],
  ["C182T", c182, rig182.trimTab, "elevR"],
  ["DA40", da40, TAB, "elev"],
] as const) {
  describe(`${name} elevator trim-tab cutout (POH 7-6 / DA40 AFM 4A-7)`, () => {
    it("leaves the trim tab uncovered while retaining the elevator ahead and beside it", () => {
      const spec = cat.surfaces.find((s) => s.key === key)!;
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const elevator = new THREE.Mesh(spec.geo(), material);
      elevator.position.set(...spec.pivot);
      elevator.updateMatrixWorld();
      const trim = new THREE.Mesh(tab.geo(), material);
      trim.position.set(...tab.pivot);
      trim.updateMatrixWorld();
      const ray = new THREE.Raycaster();
      const hit = (mesh: THREE.Mesh, x: number, z: number) => {
        ray.set(V(x, tab.pivot[1] + 1, z), V(0, -1, 0));
        return ray.intersectObject(mesh).length > 0;
      };
      const x = tab.pivot[0] - tab.chord / 2;
      expect(hit(elevator, x, tab.pivot[2])).toBe(false);
      expect(hit(trim, x, tab.pivot[2])).toBe(true);
      expect(hit(elevator, tab.pivot[0] + 0.025, tab.pivot[2])).toBe(true);
      expect(hit(elevator, x, tab.z1 + 0.03)).toBe(true);
      elevator.geometry.dispose();
      trim.geometry.dispose();
      material.dispose();
    });
  });
}

it("keeps trim-tab skins inside their cutouts at the documented travel stops", () => {
  for (const [tab, down, up] of [
    [rig172.trimTab, 19, 22], // TCDS 3A12
    [rig182.trimTab, 15, 24], // TCDS 3A13
    [TAB, 12, 39], // DA40 TCDS
  ] as const) {
    const geo = tab.geo();
    const p = geo.getAttribute("position");
    const axis = V(...tab.axis);
    for (const angle of [-up, 0, down]) {
      for (let i = 0; i < p.count; i++) {
        const point = V(0, 0, 0)
          .fromBufferAttribute(p, i)
          .applyAxisAngle(axis, (angle * Math.PI) / 180)
          .add(V(...tab.pivot));
        const hingeX = tab.pivot[0] + ((point.z - tab.pivot[2]) * axis.x) / axis.z;
        expect(point.x, `tab ${tab.chord}, ${angle}° vertex ${i} ahead of hinge`).toBeLessThanOrEqual(hingeX + 1e-6);
        expect(point.z).toBeGreaterThanOrEqual(tab.z0 - 1e-6);
        expect(point.z).toBeLessThanOrEqual(tab.z1 + 1e-6);
      }
    }
    geo.dispose();
  }
});

for (const [name, cat, rig, trimState] of [
  ["C172S", c172, rig172, live172.afcs],
  ["C182T", c182, rig182, live182.kap],
] as const) {
  it(`${name} trim rod stays attached to the tab horn at both pitch and trim stops (POH Fig. 7-1)`, () => {
    const surface = (key: string) => cat.surfaces.find((s) => s.key === key)!;
    const elevator = surface("elevR");
    const pivots = {
      ailR: surface("ailR").pivot,
      ailL: surface("ailL").pivot,
      axR: surface("ailR").axis,
      axL: surface("ailL").axis,
      elevR: elevator.pivot,
      axE: elevator.axis,
    };
    const horn = cat.parts.find((p) => p.name === "Trim tab horn")!;
    const group = new THREE.Group();
    group.position.set(...elevator.pivot);
    const mesh = new THREE.Mesh(horn.geo());
    mesh.position.set(...horn.pos!);
    group.add(mesh);
    const originalTrim = trimState.trim;
    try {
      for (const pitch of [-1, 0, 1]) {
        for (const trim of [-1, 0, 1]) {
          const c = { ...neutral, pitch, trim };
          const pose = rig.pose(c);
          trimState.trim = trim;
          horn.anim!(mesh, 0);
          group.quaternion.setFromAxisAngle(V(...elevator.axis), pose.sa.elevR);
          group.updateMatrixWorld(true);
          const attachment = mesh.localToWorld(V(-0.02, 0.045, 0));
          expect(attachment.distanceTo(rig.links(c, pose, 0, pivots).tabRod[1])).toBeLessThan(1e-8);
        }
      }
    } finally {
      trimState.trim = originalTrim;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
}

it("matches documented discharger and DA40 flap-hinge counts without asserting unsourced stations", () => {
  const count = (cat: typeof c172, name: string) => cat.parts.filter((p) => p.name === name).length;
  expect(count(c172, "Static discharger")).toBe(10); // POH 7-78 / 6-19
  expect(count(c182, "Static discharger")).toBe(10); // POH 6-20
  expect(count(da40, "Static discharger")).toBe(7); // AFMS p. 20
  expect(count(da40, "Flap hinge bracket")).toBe(12); // AFM 7-5: six per flap
});

it("keeps the C182 pedestal rudder-trim mechanism separate from the floor fuel selector (POH Fig. 7-2)", () => {
  const shaft = partBounds(namedPart(c182, "Rudder trim shaft"));
  const wheel = partBounds(
    namedPart(c182, "Rudder trim wheel"),
    new THREE.Matrix4().makeTranslation(...RUD_TRIM.wheel),
  );
  const selector = namedPart(c182, "Fuel selector valve");
  expect(selector.pos).toEqual(FSEL);
  for (const name of ["Fuel selector valve", "Selector valve (supply / return stacks)"])
    expect(shaft.intersectsBox(partBounds(namedPart(c182, name))), name).toBe(false);
  expect(shaft.max.y).toBeCloseTo(RUD_TRIM.wheel[1]);
  // The housing slot exposes the aft rim, with the indicator just above it on the aft face.
  const pedestal = partBounds(namedPart(c182, "Center pedestal"));
  expect(RUD_TRIM.indicator[0]).toBeLessThan(pedestal.min.x);
  const wheelMesh = new THREE.Mesh(
    worldGeometry(namedPart(c182, "Rudder trim wheel"), new THREE.Matrix4().makeTranslation(...RUD_TRIM.wheel)),
  );
  const housingMesh = new THREE.Mesh(worldGeometry(namedPart(c182, "Center pedestal")));
  const accessRay = new THREE.Raycaster(V(pedestal.min.x - 0.1, RUD_TRIM.wheel[1], RUD_TRIM.wheel[2]), V(1, 0, 0));
  expect(accessRay.intersectObjects([housingMesh, wheelMesh])[0]?.object).toBe(wheelMesh);
  for (const mesh of [wheelMesh, housingMesh]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  for (const trim of [-1, 0, 1]) {
    const base = rudTrimLinks(0, trim).rudTrimBungee[0];
    expect(base.x).toBeCloseTo(RUD_TRIM.wheel[0]);
    expect(base.y).toBeCloseTo(y182(RUD_TRIM.shaftBot));
  }
  const handle = c182.parts.find((p) => p.anim && p.pos?.[0] === FSEL[0] && p.pos[1] === FSEL[1] + 0.02)!;
  const mesh = new THREE.Mesh(handle.geo());
  mesh.position.set(...handle.pos!);
  const state = useC182.getState();
  try {
    for (const sel of ["BOTH", "LEFT", "RIGHT", "OFF"] as const) {
      useC182.setState({ s: { ...state.s, fuel: { ...state.s.fuel, sel } } });
      handle.anim!(mesh, 0);
      const bounds = new THREE.Box3().setFromObject(mesh);
      expect(bounds.intersectsBox(wheel), `selector ${sel} / trim wheel`).toBe(false);
      expect(bounds.intersectsBox(shaft), `selector ${sel} / trim shaft`).toBe(false);
    }
    // Check the handle's swept volume between detents as well as its four displayed positions.
    for (let degrees = 0; degrees < 360; degrees += 5) {
      mesh.rotation.y = (degrees * Math.PI) / 180;
      const bounds = new THREE.Box3().setFromObject(mesh);
      expect(bounds.intersectsBox(wheel), `selector ${degrees}° / trim wheel`).toBe(false);
      expect(bounds.intersectsBox(shaft), `selector ${degrees}° / trim shaft`).toBe(false);
    }
  } finally {
    useC182.setState(state);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});
