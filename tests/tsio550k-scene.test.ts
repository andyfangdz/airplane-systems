/**
 * The TSIO-550-K in the engine page's 3D model: stations, crankshaft, ports and drives as the Continental M-18 manual,
 * the SR22T POH and AMM give them, and the accessories where the SR22T installs them (engines/tsio550k/layout.ts cites
 * each). The engine is not on the engine pages yet, so its scene is mounted here directly, stopped.
 */
// vitest: isolate (mounts the scene with React Three Fiber)
import { createElement as h, type FC } from "react";
import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { presetCamera, type CameraPreset } from "@/lib/camera";
import { mod, sideAngle } from "@/engines/model/cycle";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { simFor } from "@/components/engine/store";
import { Crankcase, Lubrication } from "@/components/engine/scene/Case";
import { cylinderGeometry, Cylinders } from "@/components/engine/scene/Cylinders";
import {
  crankLayout,
  D2R,
  dims,
  driveLayout,
  GEAR_TEETH,
  gearSpins,
  headPoints,
  IN,
  labelOccluder,
  magDrive,
  magnetoPose,
  makeMats,
  oilFiller,
  oilFilterPose,
  oilPump,
  throwRotation,
  valveLayout,
  XRAY_MATS,
} from "@/components/engine/scene/kit";
import { layoutFor, type V3 } from "@/components/engine/scene/layout";
import { PartNotesProvider, useHover } from "@/components/engine/scene/parts";
import { Crankshaft, RodsAndPistons } from "@/components/engine/scene/Rotating";
import {
  Drives,
  drivesGeometry,
  FuelSystem,
  Ignition,
  ignitionGeometry,
  Induction,
  Propeller,
} from "@/components/engine/scene/Systems";
import { Camshaft, ValveTrain } from "@/components/engine/scene/Valvetrain";
import { mountScene } from "./engine-mount";

const S = TSIO550K;
const L = layoutFor(S);
const d = dims(S, L);
const cyl = (n: number) => S.geometry.cylinders.find((c) => c.n === n)!;
/** Inches forward of the accessory mounting face. */
const station = (x: number) => (x - d.accRear) / IN;

describe("TSIO-550-K 3D model", () => {
  test("cylinders at the M-18 Fig 5-34 stations", () => {
    expect(station(cyl(1).x)).toBeCloseTo(5.42, 2);
    expect(station(cyl(2).x)).toBeCloseTo(7.89, 2);
    // 7.31 in pitch on each bank
    for (const [a, b] of [
      [1, 3],
      [3, 5],
      [2, 4],
      [4, 6],
    ])
      expect(station(cyl(b).x) - station(cyl(a).x)).toBeCloseTo(7.31, 2);
    // M-18 2-1.2: viewed from the rear, right 1-3-5 and left 2-4-6; No. 1 and No. 2 nearest the rear
    for (const n of [1, 3, 5]) expect(cyl(n).side).toBe("R");
    for (const n of [2, 4, 6]) expect(cyl(n).side).toBe("L");
    for (const side of ["R", "L"]) {
      const bank = S.geometry.cylinders.filter((c) => c.side === side).sort((a, b) => a.x - b.x);
      expect(bank[0].n).toBe(side === "R" ? 1 : 2);
    }
  });

  test("rocker covers 33.8 in across, scaled from M-18 Fig 5-34 view D-D", () => {
    const g = cylinderGeometry(d, L).cover;
    g.computeBoundingBox();
    expect((2 * g.boundingBox!.max.z) / IN).toBeCloseTo(33.8, 4); // geometry is float32
    g.dispose();
  });

  test("propeller flange 32.50 in forward of the accessory mounting face (M-18 Fig 5-33)", () => {
    expect(station(d.flangeX)).toBeCloseTo(32.5, 6);
  });

  test("counterweights on the No. 2 and No. 5 cheeks (M-18 2-2.2.1, Fig 2-6)", () => {
    const cl = crankLayout(S, d, L);
    // M-18 Figure 2-6 numbers the cheeks from the rear: No. 2 is between rod journals 1 and 2, No. 5 between 3 and 4
    const between = (a: number, b: number) =>
      cl.counterweights.filter((w) => w.x > Math.min(cyl(a).x, cyl(b).x) && w.x < Math.max(cyl(a).x, cyl(b).x));
    expect(cl.counterweights).toHaveLength(4);
    expect(between(1, 2)).toHaveLength(2);
    expect(between(3, 4)).toHaveLength(2);
    expect(cl.counterweights.some((w) => w.c.n === 5 || w.c.n === 6)).toBe(false);
  });

  test("five main journals (M-18 2-2.2.1)", () => {
    expect(crankLayout(S, d, L).bearings).toHaveLength(5);
  });

  test("drawn ratios equal M-18 Table 2-9", () => {
    // magneto 1.5: through the idler, 24 crankshaft-gear teeth to its 16, then its rear gear to the magneto gear
    const m = magDrive(S, d, L);
    expect(m.idler).not.toBeNull();
    expect((GEAR_TEETH.crank / m.idler!.teeth) * (m.idler!.rearTeeth / m.teeth)).toBe(1.5);
    const D = driveLayout(S, d, L);
    // gear-driven alternator 3
    const alt1 = D.alternators.find((a) => a.def.name === "ALT 1")!;
    expect(alt1.gear!.driveTeeth / alt1.gear!.drivenTeeth).toBe(3);
    // governor 1: the camshaft at half speed, its bevel gear twice the governor's
    expect((0.5 * D.governor.camGovR) / D.governor.govR).toBe(1);
    expect(D.governor.bevel).toBe(true);
    // starter 48: one-start worm, 48-tooth wheel, shaft gear on the crankshaft gear tooth for tooth
    const st = D.starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    expect(((st.wheel.teeth / st.worm.starts) * GEAR_TEETH.crank) / st.shaft.teeth).toBe(48);
  });

  test("intake on top, exhaust at the bottom (M-18 2-1)", () => {
    const hp = headPoints(d, L);
    expect(hp.intakePort[1]).toBeGreaterThan(0);
    expect(hp.nozzle[1]).toBeGreaterThan(0);
    expect(hp.exhaustPort[1]).toBeLessThan(0);
    const V = valveLayout(L);
    expect(V.intake.tipY).toBeGreaterThan(0);
    expect(V.exhaust.tipY).toBeLessThan(0);
  });

  test("camshaft below the crankshaft (M-18 Fig 2-5), the oil pump turning with its gear (M-18 2-2.2)", () => {
    expect(d.camY).toBeLessThan(0);
    const p = oilPump(d, L);
    expect(p.onCam).toBe(true);
    expect(p.y).toBe(d.camY);
    // the pushrods run under the cylinders, on the camshaft's axis
    expect(valveLayout(L).intake.pushY).toBe(d.camY);
  });

  test("governor front lower left, starter at the rear (AMM 61-20, 80-10)", () => {
    const D = driveLayout(S, d, L);
    const [gx, gy, gz] = D.governor.at;
    expect(gx).toBeGreaterThan(0);
    expect(gy).toBeLessThan(0);
    expect(gz).toBeLessThan(0);
    // M-18 Figure 5-34: the starter's centreline 1.78 in aft of the accessory face, on the 1-3-5 (right) side
    expect(station(D.starter.at[0])).toBeCloseTo(-1.78, 6);
    expect(D.starter.at[2]).toBeGreaterThan(0);
  });

  test("drawn crankpins agree with CylinderDef.pin: 1-6-3-2-5-4 at 120° (M-18 Table 2-1)", () => {
    // each drawn crankpin points at its cylinder (top centre) 120° of crank after the one before it in the firing order
    const crank = new THREE.Object3D(),
      throwG = new THREE.Object3D();
    crank.add(throwG);
    [1, 6, 3, 2, 5, 4].forEach((n, k) => {
      const c = cyl(n);
      crank.rotation.x = ((k * 120) % 360) * D2R;
      throwG.rotation.x = throwRotation(c);
      crank.updateMatrixWorld(true);
      const p = new THREE.Vector3(0, 0, d.r).applyMatrix4(throwG.matrixWorld);
      // direction in the plane normal to the crank: 0 up, 90 right (cycle.ts)
      const dir = mod(Math.atan2(p.z, p.y) / D2R, 360);
      expect(dir).toBeCloseTo(sideAngle(c), 6);
    });
  });

  test("the scene mounts stopped: six cylinders, twelve plugs, two alternators and the starter on its rear adapter", async () => {
    const sim = simFor(S, "tsio550k-scene");
    const p = { sim, d, mats: makeMats() };
    const parts = [Crankshaft, RodsAndPistons, Camshaft, ValveTrain, Cylinders, Crankcase, Lubrication];
    const more = [Ignition, FuelSystem, Induction, Drives, Propeller];
    const { scene, unmount } = await mountScene(
      h(PartNotesProvider, { value: S.parts }, ...[...parts, ...more].map((C) => h(C, p))),
    );
    const names: string[] = [];
    scene.traverse((o) => {
      const over = (o as { __r3f?: { handlers: Record<string, (e: unknown) => void> } }).__r3f?.handlers.onPointerOver;
      if (!(o instanceof THREE.Mesh) || !over) return;
      useHover.setState({ hover: null });
      over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
      names.push(useHover.getState().hover?.name ?? "");
    });
    useHover.setState({ hover: null });
    const count = (re: RegExp) => names.filter((n) => re.test(n)).length;
    expect(count(/^Cylinder \d barrel$/)).toBe(6);
    expect(count(/^Spark plug, cylinder \d (top|bottom)$/)).toBe(12);
    expect(count(/^Fuel injection nozzle, cylinder \d$/)).toBe(6);
    expect(count(/^Cam lobe, cylinder \d (intake|exhaust)$/)).toBe(12);
    expect(count(/^Dynamic counterweight$/)).toBe(4);
    for (const n of ["ALT 1", "ALT 2", "Idler gear", "Starter worm", "Starter worm wheel", "Propeller governor"])
      expect(names, n).toContain(n);
    // START fires both magnetos (POH 7-37), so neither is the retard-breaker magneto
    expect(names).toEqual(expect.arrayContaining(["Left magneto", "Right magneto"]));
    expect(count(/retard breaker/)).toBe(0);
    await unmount();
  });
});

describe("TSIO-550-K accessories as the SR22T installs them (AMM, POH, M-18)", () => {
  /** Inches forward of the accessory face, above the crankshaft axis and right of the centreline, in scene metres. */
  const at = (s: number, y: number, z: number): V3 => [d.accRear + s * IN, y * IN, z * IN];
  /** Within half a millimetre. */
  const near = (got: V3, want: V3) => got.forEach((v, i) => expect(v, `[${i}]`).toBeCloseTo(want[i], 3));

  test("magnetos forward of the accessory face, drive aft and caps forward (AMM Fig 74-20-1 detail A)", () => {
    for (const m of ["R", "L"] as const) {
      const p = magnetoPose(S, d, m, L);
      const k = m === "R" ? 1 : -1;
      expect(p.capEnd[0]).toBeGreaterThan(p.driveEnd[0]);
      // the drive end on the accessory face, the pads 2.7 in either side of the centreline (M-18 Fig 5-33, scaled)
      near(p.driveEnd, [d.accRear, 0.16, k * 2.7 * IN]);
      near(p.capEnd, [d.accRear + 0.09, 0.16, k * 2.7 * IN]);
      expect(p.r).toBeCloseTo(0.05, 6);
      // the magneto drive gear turns on the magneto's own axis
      const g = magDrive(S, d, L);
      expect(g.y).toBeCloseTo(p.centre[1], 9);
      expect(g.z).toBeCloseTo(Math.abs(p.centre[2]), 9);
    }
    // the accessory housing stops under them
    expect(d.accTop).toBeLessThanOrEqual(magnetoPose(S, d, "R", L).centre[1] - 0.05 + 1e-9);
  });

  test("ALT 1 across the engine on the right crankcase-nose pad, terminal end outboard (AMM Fig 24-30-3)", () => {
    const a = driveLayout(S, d, L).alternators.find((x) => x.def.name === "ALT 1")!;
    const t = a.transverse!;
    expect(t).not.toBeNull();
    near(t.axis, [0, 0, 1]);
    // scaled from M-18 Figures 5-35 and 5-34 view D-D: station 27.3 in, pad 6.7 in and end 9.45 in from the centreline
    expect(station(t.padAt[0])).toBeCloseTo(27.3, 6);
    near(t.padAt, at(27.3, 0, 6.7));
    near(t.endAt, at(27.3, 0, 9.45));
    expect(t.r).toBeCloseTo((5.75 / 2) * IN, 6);
    // turned by a bevel pinion on the crankshaft's drive gear, at the gear-driven alternator's 3:1 (M-18 Table 2-9)
    expect(gearSpins(S, d, L).meshes).toContainEqual({ a: "crank", b: "ALT 1", kind: "bevel" });
    expect(a.gear!.driveTeeth / a.gear!.drivenTeeth).toBe(3);
  });

  test("ALT 2 below and outboard of the crankshaft on the left, its pulley forward (AMM Fig 24-30-4)", () => {
    const a = driveLayout(S, d, L).alternators.find((x) => x.def.name === "ALT 2")!;
    expect(a.def.drive).toBe("belt");
    // the pulley centre 2.95 in below and 8.46 in left of the crankshaft centreline
    expect(a.at[1] / IN).toBeCloseTo(-2.95, 1);
    expect(a.at[2] / IN).toBeCloseTo(-8.46, 1);
    // the drive sheave on its adapter at the propeller flange, under the propeller (items 5, 6)
    expect(a.x).toBeGreaterThan(d.flangeX);
    expect(a.x).toBeLessThan(d.flangeX + L.propSpacer);
  });

  // ALT 2 lower down sits beside the governor: its body stays forward of it
  test("ALT 2's body clears the propeller governor", () => {
    const D = driveLayout(S, d, L);
    const geo = drivesGeometry(S, d, L);
    const k = D.alternators.findIndex((x) => x.def.name === "ALT 2");
    const bounds = (g: THREE.BufferGeometry, m: THREE.Matrix4) => {
      g.computeBoundingBox();
      return g.boundingBox!.clone().applyMatrix4(m);
    };
    const alt = bounds(geo.alternators[k].body, new THREE.Matrix4().makeTranslation(...D.alternators[k].at));
    const gv = D.governor;
    const gov = bounds(
      geo.gov,
      new THREE.Matrix4().compose(
        new THREE.Vector3(...gv.at),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...gv.rotation)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    expect(alt.intersectsBox(gov)).toBe(false);
  });

  test("oil filter standing vertically at the left rear (M-18 Figs 5-33, 13-10; AMM Fig 71-00-2 sheet 3)", () => {
    const f = oilFilterPose(d, L);
    near(f.axis, [0, 1, 0]);
    // 4.0 in left, Ø 3.65 in, its bottom ≈ 2.1 in below the crankshaft; the station is approximate
    near(f.centre, at(-2.96, 0.16, -4.0));
    expect(f.r).toBeCloseTo((3.65 / 2) * IN, 6);
    expect(f.len).toBeCloseTo((2.42 + 2.1) * IN, 6);
    // top 2.42 in above the crankshaft (M-18 Fig 5-33, dimensioned)
    expect((f.centre[1] + f.len / 2) / IN).toBeCloseTo(2.42, 6);
  });

  test("oil filler and dipstick at the left rear (POH 7-37)", () => {
    const { cap, tube } = oilFiller(d, L);
    expect(cap[2]).toBeLessThan(0);
    expect(cap[0]).toBeLessThan(d.caseRear);
    for (const p of tube) expect(p[2]).toBeLessThan(0);
  });

  test("the starter motor starts at its right-angle adapter (AMM Fig 71-00-2 sheet 3, Fig 80-10-1)", () => {
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    // the worm is drawn 0.04 m either side of its centre; the motor runs outboard from its end
    expect(st.at[2] - st.worm.at[2]).toBeCloseTo(0.04, 9);
  });

  test("labels sit on their parts", () => {
    const at = Object.fromEntries(L.labels(d, S));
    const mag = magnetoPose(S, d, "R", L);
    expect(at.Magnetos[0]).toBeGreaterThan(mag.driveEnd[0]);
    expect(at.Magnetos[0]).toBeLessThan(mag.capEnd[0]);
    const alt1 = driveLayout(S, d, L).alternators.find((x) => x.def.name === "ALT 1")!;
    expect(at["ALT 1"][0]).toBeCloseTo(alt1.x, 6);
    expect(at["ALT 1"][2]).toBeGreaterThan(alt1.transverse!.padAt[2]);
    const f = oilFilterPose(d, L);
    expect(at["Oil filter"][0]).toBeCloseTo(f.centre[0], 6);
    expect(at["Oil filter"][2]).toBeCloseTo(f.centre[2], 6);
    expect(at["ALT 2"][2]).toBeLessThan(0);
  });

  test("the oil filter's label sits over the canister and hides while the canister is out of view", () => {
    const [, at, opts] = L.labels(d, S).find(([t]) => t === "Oil filter")!;
    const f = oilFilterPose(d, L);
    expect(at[1]).toBeGreaterThan(f.centre[1] + f.len / 2);
    expect(Math.hypot(at[0] - f.centre[0], at[2] - f.centre[2])).toBeLessThan(f.r);
    expect(opts).toEqual({ occlude: true });
  });
});

describe("TSIO-550-K magneto drive train (M-18 2-2.2; AMM Fig 74-20-1 detail A)", () => {
  const m = magDrive(S, d, L);
  const I = m.idler!;
  const mag = (side: "L" | "R") => magnetoPose(S, d, side, L);

  test("the idler's front gear meshes the crankshaft gear inside the accessory housing, clear of the magnetos", () => {
    expect(I.x).toBeCloseTo(d.caseRear - 0.018, 9); // the crankshaft gear's plane
    expect(I.y).toBeCloseTo(d.crankGearR + I.r, 9);
    expect(I.y + I.r).toBeLessThanOrEqual(d.accTop);
    const p = mag("R");
    expect(Math.hypot(p.centre[1] - I.y, p.centre[2])).toBeGreaterThan(I.r + p.r);
  });

  test("the magneto gears and the idler's rear gear sit behind the accessory face, under its drive housing", () => {
    const cover = ignitionGeometry(S, d, L).cover!;
    cover.computeBoundingBox();
    const box = cover.boundingBox!;
    for (const side of ["R", "L"] as const) {
      const [, y, z] = mag(side).centre;
      expect(m.y).toBeCloseTo(y, 9);
      expect(Math.sign(z) * m.z).toBeCloseTo(z, 9);
      expect(m.x + 0.005).toBeLessThan(d.accRear); // half the gear's width
      expect(
        box.containsBox(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(m.x, y, z),
            new THREE.Vector3(0.01, 2 * m.r, 2 * m.r),
          ),
        ),
      ).toBe(true);
    }
    expect(I.rearX).toBe(m.x);
    expect(Math.hypot(m.y - I.y, m.z)).toBeCloseTo(I.rearR + m.r, 9);
    expect(box.containsPoint(new THREE.Vector3(I.rearX, I.y - I.rearR, 0))).toBe(true);
    expect(box.max.x).toBeCloseTo(d.accRear, 6); // geometry is float32
  });

  test("each magneto drive gear can be seen and hovered from the iso and rear cameras", () => {
    // the ignition's opaque parts; the drive housing is see-through in X-ray and lets the pointer through (parts.tsx)
    const geo = ignitionGeometry(S, d, L);
    const solid = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const root = new THREE.Group();
    const gears: Record<string, THREE.Mesh> = {};
    for (const side of ["R", "L"] as const) {
      const g = new THREE.Group();
      g.position.set(0, mag(side).centre[1], mag(side).centre[2]);
      for (const k of ["body", "flange", "cap"] as const) g.add(new THREE.Mesh(geo[k], solid));
      gears[side] = new THREE.Mesh(geo.gear, solid);
      g.add(gears[side]);
      root.add(g);
    }
    root.add(new THREE.Mesh(geo.leads, solid));
    const idler = new THREE.Mesh(geo.idler!, solid);
    idler.position.y = I.y;
    root.add(idler);
    root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    // looking from each preset's side (lib/camera.ts directions; the engine page's rear is the front's mirror)
    for (const [cam, dir, need] of [
      ["iso", new THREE.Vector3(1, 0.65, 1).normalize(), 3],
      ["rear", new THREE.Vector3(-1, 0, 0), 28],
    ] as const)
      for (const side of ["R", "L"] as const) {
        const others = root.children
          .flatMap((o) => (o.children.length ? o.children : [o]))
          .filter((o) => o !== gears[side]);
        let seen = 0;
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * 2 * Math.PI;
          const p = gears[side].localToWorld(
            new THREE.Vector3(m.x, 0.95 * m.r * Math.cos(a), 0.95 * m.r * Math.sin(a)),
          );
          ray.set(p, dir);
          if (!ray.intersectObjects(others, false).length) seen++;
        }
        expect(seen, `${side} magneto gear from ${cam}`).toBeGreaterThanOrEqual(need);
      }
  });
});

describe("TSIO-550-K oil filter label, seen from each side", () => {
  // the page's model (EngineScene.tsx EngineModel) as it opens: X-ray on, every group shown, propeller on
  async function model() {
    const sim = simFor(S);
    expect(sim.useUi.getState().view).toMatchObject({ xray: true, prop: true, hidden: [] });
    const mats = makeMats();
    for (const k of XRAY_MATS) mats[k].opacity = k === "barrel" || k === "head" ? 0.28 : 0.16;
    const p = { sim, d, mats };
    const parts: FC<typeof p>[] = [Crankshaft, RodsAndPistons, Camshaft, ValveTrain, Cylinders, Crankcase];
    parts.push(Lubrication, Ignition, FuelSystem, Induction, Drives);
    return mountScene(
      h(
        "group",
        { name: "engine-model" },
        ...parts.map((C, k) => h(C, { ...p, key: k })),
        h("group", { name: "propeller", key: "prop" }, h(Propeller, p)),
      ),
    );
  }

  test("shows on the canister from the side, top, rear and below; the magnetos hide it from the default and iso views", async () => {
    const { scene, unmount } = await model();
    const [, at, opts] = L.labels(d, S).find(([t]) => t === "Oil filter")!;
    expect(opts).toEqual({ occlude: true });
    const anchor = new THREE.Vector3(...at);
    // every mesh but the propeller, framed from each side as lib/camera.ts frames the airplanes' views; the rear is the
    // front view mirrored through the box centre it aims at
    const bounds = new THREE.Box3();
    const fit = (o: THREE.Object3D) => {
      if (o.name === "propeller") return;
      if (o instanceof THREE.Mesh) bounds.expandByObject(o);
      o.children.forEach(fit);
    };
    fit(scene.getObjectByName("engine-model")!);
    const pose = (c: CameraPreset) => new THREE.Vector3(...presetCamera(c, bounds, 38, 1440 / 900)[0]);
    const [front, centre] = presetCamera("front", bounds, 38, 1440 / 900);
    const cams: [string, THREE.Vector3][] = [
      ["default", new THREE.Vector3(...L.camera.position)],
      ...(["iso", "side", "top", "front", "below"] as const).map((c): [string, THREE.Vector3] => [c, pose(c)]),
      ["rear", new THREE.Vector3(2 * centre[0] - front[0], front[1], front[2])],
    ];
    // drei Html occlude: a ray from the camera through the anchor; shown when nothing is hit before the anchor
    const occluder = labelOccluder(scene, "Oil filter");
    const ray = new THREE.Raycaster();
    const shown = Object.fromEntries(
      cams.map(([c, eye]) => {
        ray.set(eye, anchor.clone().sub(eye).normalize());
        const hits = ray.intersectObjects([occluder.current], true);
        return [c, !hits.length || eye.distanceTo(anchor) < hits[0].distance];
      }),
    );
    expect(shown).toMatchObject({ default: false, iso: false, side: true, top: true, rear: true, below: true });
    await unmount();
  });
});
