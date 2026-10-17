/**
 * The TSIO-550-K in the engine page's 3D model: stations, crankshaft, ports and drives as the Continental M-18 manual,
 * the SR22T POH and AMM give them, and the accessories where the SR22T installs them (engines/tsio550k/layout.ts cites
 * each). The engine is not on the engine pages yet, so its scene is mounted here directly, stopped.
 */
// vitest: isolate (mounts the scene with React Three Fiber)
import { advance } from "@react-three/fiber";
import { createElement as h, type FC } from "react";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { afterAll, describe, expect, test } from "vitest";
import { presetCamera, type CameraPreset } from "@/lib/camera";
import { mod, sideAngle } from "@/engines/model/cycle";
import { noFailures } from "@/engines/model/engine";
import { ACCESSORY_FACE_IN } from "@/engines/tsio550k/layout-turbo";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { simFor } from "@/components/engine/store";
import { caseGeometry, Crankcase, Lubrication } from "@/components/engine/scene/Case";
import {
  crankLayout,
  D2R,
  dims,
  drawnSparks,
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
  rod,
  throwRotation,
  toWorld,
  tube,
  valveLayout,
  VT,
  XRAY_MATS,
} from "@/components/engine/scene/kit";
import { cylinderGeometry, Cylinders } from "@/components/engine/scene/Cylinders";
import { Exhaust, exhaustRuns, runCurve } from "@/components/engine/scene/Exhaust";
import { layoutFor, type V3 } from "@/components/engine/scene/layout";
import { Group, PartNotesProvider, useHover } from "@/components/engine/scene/parts";
import { Crankshaft, RodsAndPistons } from "@/components/engine/scene/Rotating";
import {
  clutchGrip,
  Drives,
  drivesGeometry,
  FuelSystem,
  Ignition,
  ignitionGeometry,
  Induction,
  Propeller,
  starterAdapter,
} from "@/components/engine/scene/Systems";
import {
  actuatorTravel,
  chargeAirColor,
  gatePlateAngle,
  oilInletNote,
  reliefLift,
  Turbo,
  turboGeometries,
  turboGeometry,
  wheelRate,
} from "@/components/engine/scene/Turbo";
import { Camshaft, ValveTrain } from "@/components/engine/scene/Valvetrain";
import { mountScene } from "./engine-mount";
import { obstacle, sampledClearance } from "./sampled-clearance";

const S = TSIO550K;
const L = layoutFor(S);
const d = dims(S, L);
const cyl = (n: number) => S.geometry.cylinders.find((c) => c.n === n)!;
/** Inches forward of the accessory mounting face. */
const station = (x: number) => (x - d.accRear) / IN;
const box3 = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!.clone();
};
/** A mounted mesh's geometry in world space (the caller disposes it). */
const worldGeometry = (m: THREE.Mesh) => (m.geometry as THREE.BufferGeometry).clone().applyMatrix4(m.matrixWorld);

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

describe("TSIO-550-K starting sparks (POH 7-37: START energizes both magnetos)", () => {
  test("with the right magneto failed, START still fires every left-fired plug", () => {
    const f = { ...noFailures(S), magR: true };
    drawnSparks(S, "START", f, 200).forEach(([top, bottom], i) => {
      const left = S.ignition.topPlugMag[S.geometry.cylinders[i].n] === "L";
      expect([top, bottom], `cylinder ${S.geometry.cylinders[i].n}`).toEqual([left, !left]);
    });
  });

  test("the scene flashes the left-fired plugs at START with the right magneto failed", async () => {
    const sim = simFor(S, "tsio550k-start-sparks");
    sim.useUi.setState((u) => ({
      controls: { ...u.controls, mags: "START" },
      failures: { ...u.failures, magR: true },
    }));
    sim.s.rpm = 200;
    const { scene, frame, unmount } = await mountScene(h(Cylinders, { sim, d, mats: makeMats() }));
    // each spark beside its plug: the plug's hover name says which cylinder and which plug
    const sparksAt: { name: string; mat: THREE.Material }[] = [];
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || (o.material as THREE.MeshBasicMaterial).color?.getHex() !== 0x9fd8ff) return;
      const plug = o.parent!.children[0].children[0] as THREE.Object3D & {
        __r3f?: { handlers: Record<string, (e: unknown) => void> };
      };
      useHover.setState({ hover: null });
      plug.__r3f!.handlers.onPointerOver({
        object: plug,
        stopPropagation() {},
        nativeEvent: { clientX: 0, clientY: 0 },
      });
      sparksAt.push({ name: useHover.getState().hover!.name, mat: o.material as THREE.Material });
    });
    useHover.setState({ hover: null });
    expect(sparksAt).toHaveLength(12);
    const lit = new Set<string>();
    // turn the drawn crankshaft through two revolutions, as the flash follows each cylinder's spark
    for (let crank = 0; crank < 720; crank += 2) {
      sim.anim.crank = crank;
      frame();
      for (const s of sparksAt) if (s.mat.opacity > 0) lit.add(s.name);
    }
    const leftFired = S.geometry.cylinders.map((c) =>
      S.ignition.topPlugMag[c.n] === "L" ? `Spark plug, cylinder ${c.n} top` : `Spark plug, cylinder ${c.n} bottom`,
    );
    expect([...lit].sort()).toEqual(leftFired.sort());
    await unmount();
  });
});

describe("TSIO-550-K ALT 1 on its transverse pad (AMM Fig 24-30-3)", () => {
  const a = driveLayout(S, d, L).alternators.find((x) => x.def.name === "ALT 1")!;

  test("the shaft runs across the engine on the right, its pad and end faces where M-18 Figures 5-34 and 5-35 put them", () => {
    const t = a.transverse!;
    expect(t.axis[1]).toBeCloseTo(0, 9);
    expect(t.axis[2]).toBeCloseTo(1, 9);
    expect(station(t.padAt[0])).toBeCloseTo(27.3, 6);
    expect(t.padAt[2] / IN).toBeCloseTo(6.7, 6);
    expect(t.endAt[2] / IN).toBeCloseTo(9.45, 6);
    // turned by a bevel pinion on the crankshaft's drive gear, at the gear-driven alternator's 3:1 (M-18 Table 2-9)
    expect(gearSpins(S, d, L).meshes).toContainEqual({ a: "crank", b: "ALT 1", kind: "bevel" });
    expect(a.gear!.driveTeeth / a.gear!.drivenTeeth).toBe(3);
  });

  test("as drawn, the housing stands outboard of the crankcase on its pad, its axis across the engine", async () => {
    const sim = simFor(S, "tsio550k-alt1");
    const { scene, unmount } = await mountScene(h(Drives, { sim, d, mats: makeMats() }));
    const box = (name: string) => {
      const b = new THREE.Box3();
      scene.traverse((o) => {
        const over = (o as { __r3f?: { handlers: Record<string, (e: unknown) => void> } }).__r3f?.handlers
          .onPointerOver;
        if (!(o instanceof THREE.Mesh) || !over) return;
        useHover.setState({ hover: null });
        over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
        if (useHover.getState().hover?.name === name) b.expandByObject(o);
      });
      useHover.setState({ hover: null });
      return b;
    };
    const body = box("ALT 1"),
      pad = box("ALT 1 drive pad");
    // the housing from the pad face out to the end face: clear of the crankcase half-width, longest across the engine
    expect(body.min.z).toBeGreaterThan(d.caseHalf);
    expect(body.min.z / IN).toBeCloseTo(6.7, 2);
    expect(body.max.z / IN).toBeGreaterThan(9.45);
    const size = body.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2 * a.transverse!.r, 3);
    expect(size.y).toBeGreaterThanOrEqual(2 * a.transverse!.r - 1e-3);
    expect(body.getCenter(new THREE.Vector3()).x).toBeCloseTo(a.x, 3);
    // the pad bridges the case side to the housing
    expect(pad.min.z).toBeCloseTo(d.caseHalf, 3);
    expect(pad.max.z / IN).toBeCloseTo(6.7, 2);
    await unmount();
  });
});

describe("TSIO-550-K oil filler and dipstick", () => {
  test("at the left rear, where POH 7-37 and its hover note put it, behind the crankcase", () => {
    expect(L.oilFiller).toEqual({ side: "L" });
    expect(L.notes.dipTube).toMatch(/left rear/);
    const { cap, tube } = oilFiller(d, L);
    expect(cap[2]).toBeLessThan(0);
    expect(cap[0]).toBeLessThan(d.caseRear);
    for (const p of tube) expect(p[2]).toBeLessThan(0);
  });

  test("as drawn, the tube and its cap stand on the left", async () => {
    const sim = simFor(S, "tsio550k-filler");
    const { scene, unmount } = await mountScene(h(Lubrication, { sim, d, mats: makeMats() }));
    const found: string[] = [];
    scene.traverse((o) => {
      const over = (o as { __r3f?: { handlers: Record<string, (e: unknown) => void> } }).__r3f?.handlers.onPointerOver;
      if (!(o instanceof THREE.Mesh) || !over) return;
      useHover.setState({ hover: null });
      over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
      const name = useHover.getState().hover?.name ?? "";
      if (name !== "Oil level gage tube" && name !== "Oil filler cap and dipstick") return;
      found.push(name);
      expect(new THREE.Box3().setFromObject(o).max.z, name).toBeLessThan(0);
    });
    useHover.setState({ hover: null });
    expect(found.sort()).toEqual(["Oil filler cap and dipstick", "Oil level gage tube"]);
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

  test("the starter motor starts at its right-angle adapter (AMM Fig 71-00-2 sheet 3, Fig 80-10-1)", () => {
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    // the worm is drawn 0.04 m either side of its centre; the motor runs outboard from its end
    expect(st.at[2] - st.worm.at[2]).toBeCloseTo(0.04, 9);
  });

  test("the starter adapter on the accessory face holds the worm wheel and the worm; the motor bolts to its boss (AMM 80-10; M-18 Figs 16-17, D-3)", () => {
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    const a = starterAdapter(st, d);
    const g = drivesGeometry(S, d, L).starter;
    if (g.kind !== "rear-adapter") throw new Error("expected the adapter housing");
    const b = box3(g.adapter);
    // mounted on the accessory face, reaching aft to its cover
    expect(b.max.x).toBeCloseTo(d.accRear, 6);
    expect(b.min.x).toBeCloseTo(Math.min(a.coverX, a.bossX - a.bossR), 6);
    // around the starter shaft and the worm wheel, whose rim it clears
    expect(a.y).toBeCloseTo(st.shaft.y, 9);
    expect(a.z).toBeCloseTo(st.shaft.z, 9);
    expect(st.wheel.x).toBeGreaterThan(a.coverX);
    expect(st.wheel.x).toBeLessThan(d.accRear);
    expect(a.caseR).toBeGreaterThan(st.wheel.r);
    // the worm's boss runs out to the motor's mounting face
    expect(a.bossY).toBeCloseTo(st.worm.at[1], 9);
    expect(a.bossZ0).toBeLessThan(st.worm.at[2] - 0.04);
    expect(a.bossZ1).toBeCloseTo(st.at[2], 9);
    Object.values(g).forEach((x) => x instanceof THREE.BufferGeometry && x.dispose());
  });

  test("the oil pump stays inside the accessory housing, clear of the starter adapter on its rear face; the adapter houses the clutch spring", async () => {
    const g = drivesGeometry(S, d, L).starter;
    if (g.kind !== "rear-adapter") throw new Error("expected the adapter housing");
    const adapter = new MeshBVH(g.adapter);
    const { scene, unmount } = await mountScene(
      h(
        "group",
        null,
        h(Lubrication, { sim: simFor(S), d, mats: makeMats() }),
        h(Drives, { sim: simFor(S), d, mats: makeMats() }),
      ),
    );
    const parts = namedMeshes(scene);
    const pump = parts.filter((p) => p.name === "Oil pump" || p.name === "Oil pump gears");
    expect(pump).toHaveLength(3);
    const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
    const hit2 = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
    for (const { mesh, name } of pump) {
      const w = worldGeometry(mesh);
      // forward of the accessory face (the pump body and its gears sit in the housing; the adapter bolts on behind)
      expect(box3(w).min.x, name).toBeGreaterThan(d.accRear);
      // and clear of the adapter by the housing's rear wall, ≥ 0.05 in as drawn
      const r = adapter.closestPointToGeometry(w, new THREE.Matrix4(), hit, hit2, 0, 0.25 * IN);
      expect(r?.distance ?? Infinity, name).toBeGreaterThanOrEqual(0.05 * IN);
      w.dispose();
    }
    // a joint by design: the clutch spring rides on the worm wheel's hub inside the adapter (M-18 Figure 16-17 item 17)
    const spring = parts.find((p) => p.name === "Starter clutch spring")!;
    const sw = worldGeometry(spring.mesh);
    expect(box3(g.adapter).containsBox(box3(sw))).toBe(true);
    sw.dispose();
    await unmount();
    Object.values(g).forEach((x) => x instanceof THREE.BufferGeometry && x.dispose());
  });

  test("the clutch spring grips while the starter is engaged and lets go after (M-18 2-2.6, Fig 16-17)", async () => {
    expect(clutchGrip(true)).toBeGreaterThan(0);
    expect(clutchGrip(false)).toBe(0);
    const sim = simFor(S, "tsio550k-clutch");
    const { scene, frame, unmount } = await mountScene(h(Drives, { sim, d, mats: makeMats() }));
    const spring = namedMeshes(scene).find((p) => p.name === "Starter clutch spring")!.mesh
      .material as THREE.MeshStandardMaterial;
    sim.s.starterEngaged = true;
    frame();
    expect(spring.emissiveIntensity).toBeGreaterThan(0);
    sim.s.starterEngaged = false;
    frame();
    expect(spring.emissiveIntensity).toBe(0);
    await unmount();
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
    parts.push(Lubrication, Ignition, FuelSystem, Induction, Turbo, Exhaust, Drives);
    return mountScene(
      h(
        "group",
        { name: "engine-model" },
        ...parts.map((C, k) => h(C, { ...p, key: k })),
        h("group", { name: "propeller", key: "prop" }, h(Propeller, p)),
      ),
    );
  }

  test("shows on the canister from the side, top and rear; the magnetos hide it from the default and iso views, the exhaust crossover from below", async () => {
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
    expect(shown).toMatchObject({ default: false, iso: false, side: true, top: true, rear: true, below: false });
    await unmount();
  });
});

describe("TSIO-550-K turbochargers, wastegate and intercoolers", () => {
  const T = L.turbo!;
  const G = turboGeometry(T);
  afterAll(() => turboGeometries(G).forEach((g) => g.dispose()));
  const box = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return g.boundingBox!;
  };
  const inch = (m: number) => m / IN;
  const [tl, tr] = T.sides;
  const near = (a: number[], b: number[], tolIn: number) =>
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / IN).toBeLessThanOrEqual(tolIn);

  test("the turbo stations hang from the layout's accessory mounting face (M-18 Fig 5-33)", () => {
    expect(ACCESSORY_FACE_IN).toBe(L.stationsIn!.accessoryFace);
  });

  test("turbochargers at the dimensioned stations (M-18 Fig 5-33)", () => {
    expect([tl.side, tr.side]).toEqual(["L", "R"]);
    // rear view: shafts 14.82 / 14.81 in below the crankshaft centreline, 12.94 in left and 13.45 in right of it
    expect(inch(tl.y)).toBeCloseTo(-14.82, 6);
    expect(inch(tr.y)).toBeCloseTo(-14.81, 6);
    expect(inch(tl.z)).toBeCloseTo(-12.94, 6);
    expect(inch(tr.z)).toBeCloseTo(13.45, 6);
    G.sides.forEach((g, i) => {
      const t = T.sides[i];
      // side views: the turbine housing's aft face 3.97 in forward of the accessory face
      expect(station(box(g.turbine).min.x)).toBeCloseTo(3.97, 4);
      // compressor forward, turbine aft, on one shaft
      const x = t.x;
      expect(x.turbineAft).toBeLessThan(x.turbineFront);
      expect(x.turbineFront).toBeLessThan(x.centreFront);
      expect(x.centreFront).toBeLessThan(x.compressorFront);
      expect(x.compressorFront).toBeLessThan(x.inletFace);
      // the compressor inlet Ø3.00 in, facing forward
      const inlet = box(g.inletStub);
      expect(inch(inlet.max.z - inlet.min.z)).toBeCloseTo(3.0, 2);
      expect(inlet.max.x).toBeCloseTo(x.inletFace, 6);
      for (const k of ["turbine", "centre", "compressor", "inletStub"] as const) {
        const b = box(g[k]);
        expect((b.min.y + b.max.y) / 2).toBeCloseTo(t.y, 6);
        expect((b.min.z + b.max.z) / 2).toBeCloseTo(t.z, 6);
      }
    });
  });

  test("a TIT probe on each turbine inlet, the oil inlet on top of each centre housing (M-18 Fig 5-33)", () => {
    G.sides.forEach((g, i) => {
      const t = T.sides[i];
      const tit = box(g.tit);
      // 0.4375-20UNF-3B TIT boss: over the turbine housing, on that side's turbine centreline, 9.35 in below the
      // crankshaft centreline
      expect(tit.min.x).toBeGreaterThan(t.x.turbineAft);
      expect(tit.max.x).toBeLessThan(t.x.turbineFront);
      expect((tit.min.z + tit.max.z) / 2).toBeCloseTo(t.z, 6);
      expect(inch(t.tit[1])).toBeCloseTo(-9.35, 6);
      // TURBO OIL INLET: the supply hose ends on top of the centre housing
      const hose = T.oil.lines[t.side === "L" ? "toL" : "toR"];
      const [hx, hy, hz] = hose[hose.length - 1];
      expect(hx).toBeCloseTo(t.x.centre, 6);
      expect(hz).toBeCloseTo(t.z, 6);
      expect(hy).toBeGreaterThan(t.y + t.r.centre);
    });
  });

  test("intercoolers 12.28 / 11.54 in long, outer edges 21.15 / 21.23 in (M-18 Fig 5-34)", () => {
    const [cl, cr] = G.intercoolers.map((g) => box(g.core));
    expect(T.intercoolers.map((ic) => ic.side)).toEqual(["L", "R"]);
    // geometry is float32
    expect(inch(cl.max.x - cl.min.x)).toBeCloseTo(11.54, 3);
    expect(inch(cr.max.x - cr.min.x)).toBeCloseTo(12.28, 3);
    expect(inch(-cl.min.z)).toBeCloseTo(21.23, 3);
    expect(inch(cr.max.z)).toBeCloseTo(21.15, 3);
    // one on each side, over the cylinders
    expect(cl.max.z).toBeLessThan(0);
    expect(cr.min.z).toBeGreaterThan(0);
    expect(cl.min.y).toBeGreaterThan(0);
    expect(cr.min.y).toBeGreaterThan(0);
  });

  test("intercooler cores 6.3 in wide and 3.1 in deep (scaled, M-18 Figs 5-33 to 5-35), the neck on the end face", () => {
    G.intercoolers.forEach((g, i) => {
      const c = box(g.core);
      // geometry is float32
      expect(inch(c.max.z - c.min.z)).toBeCloseTo(6.3, 3);
      expect(inch(c.max.y - c.min.y)).toBeCloseTo(3.1, 3);
      // the outlet neck leaves the forward end face, within its height
      const ic = T.intercoolers[i];
      expect(ic.neck[1]).toBeGreaterThan(c.min.y);
      expect(ic.neck[1]).toBeLessThan(c.max.y);
    });
  });

  test("the intercoolers are solid with X-ray off; in X-ray less see-through than the turbo housings, still under the pointer", async () => {
    const sim = simFor(S, "tsio550k-intercooler-opacity");
    const { scene, frame, unmount } = await mountScene(h(Turbo, { sim, d, mats: makeMats() }));
    const cooler = (n: string) => /intercooler|cabin-heat nozzle/.test(n);
    sim.useUi.setState((u) => ({ view: { ...u.view, xray: false } }));
    frame();
    const parts = namedMeshes(scene);
    const ic = parts.filter(({ name }) => cooler(name)).map(({ mesh }) => mesh.material as THREE.Material);
    // core, fins, outlet transition and neck, aft hood, inlet and nozzle on each side
    expect(ic).toHaveLength(14);
    for (const m of ic) {
      expect(m.opacity).toBe(1);
      expect(m.depthWrite).toBe(true);
    }
    const housing = parts.find(({ name }) => name === "LH turbine housing")!.mesh.material as THREE.Material;
    // X-ray, the page's default: see-through, but well short of the housings X-ray opens up
    sim.useUi.setState((u) => ({ view: { ...u.view, xray: true } }));
    frame();
    expect(housing.opacity).toBeLessThan(1);
    for (const m of ic) {
      expect(m.opacity).toBeLessThan(1);
      expect(m.opacity).toBeGreaterThan(housing.opacity);
    }
    // the pointer passes through parts below 0.5 opacity (parts.tsx): it still stops on every intercooler part
    expect(namedMeshes(scene).filter(({ name }) => cooler(name))).toHaveLength(14);
    await unmount();
  });

  test("aft nozzles 18.13 in out and 3.75 in up (M-18 Fig 5-33), ending 3.87 in aft of the accessory face (Fig 5-34)", () => {
    G.intercoolers.forEach((g, i) => {
      const k = T.intercoolers[i].side === "L" ? -1 : 1;
      const b = box(g.port);
      expect(inch((b.min.z + b.max.z) / 2)).toBeCloseTo(k * 18.13, 3);
      expect(inch((b.min.y + b.max.y) / 2)).toBeCloseTo(3.75, 3);
      expect(station(b.min.x)).toBeCloseTo(-3.87, 3);
    });
  });

  test("one wastegate, on the left, at the LH tailpipe (POH 7-38; AMM 81-20)", () => {
    const W = T.wastegate;
    expect(Array.isArray(W)).toBe(false);
    expect(W.side).toBe("L");
    // on the LH turbine outlet's (and tailpipe's) centreline, aft of the LH turbine's discharge
    expect(W.at[2]).toBeCloseTo(tl.z, 9);
    expect(W.at[0]).toBeLessThan(tl.outlet.x);
    expect(W.at[1]).toBeLessThan(0);
    // its actuator outboard of it (M-18 Fig 5-33 rear view)
    expect(W.actuator.at[2]).toBeLessThan(W.at[2]);
    const g = box(G.wastegate.body);
    expect(g.max.z).toBeLessThan(0);
  });

  test("the wastegate's flanges, where the exhaust transition and the LH tailpipe bolt on, are its drawn faces", () => {
    const F = T.wastegate.flanges;
    const b = box(G.wastegate.body);
    // geometry is float32
    expect(b.max.y).toBeCloseTo(F.top[1], 6);
    expect(b.min.y).toBeCloseTo(F.bottom[1], 6);
    for (const f of [F.top, F.bottom]) {
      expect(f[0]).toBeCloseTo((b.min.x + b.max.x) / 2, 6);
      expect(f[2]).toBeCloseTo((b.min.z + b.max.z) / 2, 6);
    }
    expect((b.max.x - b.min.x) / 2).toBeCloseTo(F.halfWidth, 6);
    expect((b.max.z - b.min.z) / 2).toBeCloseTo(F.halfWidth, 6);
  });

  test("each turbocharger's oil inlet names its own supply hose: 13 to the LH, 14 to the RH (M-18 Fig 12-21)", () => {
    expect(oilInletNote(T, "L")).toContain("LH");
    expect(oilInletNote(T, "L")).toContain("hose 13");
    expect(oilInletNote(T, "R")).toContain("RH");
    expect(oilInletNote(T, "R")).toContain("hose 14");
    expect(oilInletNote(T, "L")).not.toContain("RH");
    expect(oilInletNote(T, "R")).not.toContain("LH");
  });

  test("overboost valve on the LH intercooler outlet (AMM 71-60)", () => {
    const ic = T.intercoolers.find((c) => c.side === "L")!;
    const [x, y, z] = T.overboost.at;
    expect(T.overboost.side).toBe("L");
    expect(x).toBeGreaterThanOrEqual(ic.neck[0]);
    expect(x).toBeLessThanOrEqual(ic.outlet[0]);
    expect(z).toBeCloseTo(ic.neck[2], 9);
    expect(y).toBeCloseTo(ic.neck[1] + ic.neckR, 9);
  });

  test("wastegate controller off the engine, behind the accessory face (M-18 12-4.2; AMM 81-20)", () => {
    expect(station(T.controller.at[0])).toBeLessThan(0);
    expect(station(box(G.controller.body).max.x)).toBeLessThan(0);
    expect(T.notes.controller).toContain("upper firewall in the airplane");
  });

  test("wastegate controller at the left rear, outboard of the oil cooler (AMM Fig 71-00-2 sh 3 item 30)", () => {
    const [, y, z] = T.controller.at;
    expect(z).toBeLessThan(0);
    expect(z).toBeLessThan(T.oil.coolerOutlet[2]);
    // the figure puts it ≈ 14-18 in left of the crankshaft centreline and 3-6 in above it
    expect(inch(z)).toBeGreaterThanOrEqual(-18);
    expect(inch(z)).toBeLessThanOrEqual(-14);
    expect(inch(y)).toBeGreaterThanOrEqual(3);
    expect(inch(y)).toBeLessThanOrEqual(6);
    // its oil and sense lines reach it there
    near(T.oil.lines.toController[T.oil.lines.toController.length - 1], T.controller.at, 2);
    near(T.oil.lines.controllerDrain[0], T.controller.at, 2);
    for (const p of [T.controller.deckPort, T.controller.mapPort]) expect(p[2]).toBeLessThan(0);
  });

  test("turbocharger oil: oil cooler, check valve and tee to both centre housings; reservoirs to the scavenge pump on the starter adapter (POH 7-38; AMM 79-00; M-18 Fig 12-21)", () => {
    const o = T.oil,
      l = o.lines;
    // POH 7-38: "from a source at the bottom of the oil cooler"; Fig 12-21: filter assembly, check valve, tee
    expect(l.supply[0]).toEqual(o.coolerOutlet);
    expect(l.supply[l.supply.length - 1]).toEqual(o.supplyTee);
    for (const f of [o.filter, o.checkValve]) {
      expect(f[1]).toBeLessThan(o.coolerOutlet[1]);
      expect(f[1]).toBeGreaterThan(o.supplyTee[1]);
    }
    expect(o.filter[1]).toBeGreaterThan(o.checkValve[1]);
    expect(l.toL[0]).toEqual(o.supplyTee);
    expect(l.toR[0]).toEqual(o.supplyTee);
    // the reservoirs under each turbocharger drain through hoses to one tee, then to the scavenge pump
    for (const [line, t] of [
      [l.drainL, tl],
      [l.drainR, tr],
    ] as const) {
      expect(line[0][0]).toBeCloseTo(t.x.centre, 9);
      expect(line[0][2]).toBeCloseTo(t.z, 9);
      expect(line[0][1]).toBeLessThan(t.y - t.r.centre);
      near(line[line.length - 1], o.drainTee, 1.5);
    }
    near(l.scavenge[0], o.drainTee, 1.5);
    near(l.scavenge[l.scavenge.length - 1], o.scavengePump, 1.5);
    near(l.pumpReturn[0], o.scavengePump, 1.5);
    expect(l.pumpReturn[l.pumpReturn.length - 1]).toEqual(o.pumpReturn);
    // wastegate oil: the cooler's inboard fitting to the actuator, the wastegate to the controller, the controller's
    // drain to the rear of the crankcase (M-18 12-4.2, Figure 12-6)
    expect(l.toWastegate[0]).toEqual(o.coolerInboard);
    near(l.toWastegate[l.toWastegate.length - 1], T.wastegate.actuator.at, 1.5);
    near(l.toController[0], T.wastegate.actuator.at, 2);
    near(l.toController[l.toController.length - 1], T.controller.at, 2);
    near(l.controllerDrain[0], T.controller.at, 2);
    expect(l.controllerDrain[l.controllerDrain.length - 1]).toEqual(o.controllerReturn);
  });

  test("the scavenge pump on the starter adapter's cover, on the starter shaft's axis (M-18 16-4.1 step 15, Figs 16-17, D-3)", () => {
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    const a = starterAdapter(st, d);
    const [px, py, pz] = T.oil.scavengePump;
    // its driver gear on the end of the starter shaft gear: the pump on that axis, aft of the worm wheel and the cover
    expect(Math.abs(py - st.shaft.y) / IN).toBeLessThanOrEqual(0.01);
    expect(Math.abs(pz - st.shaft.z) / IN).toBeLessThanOrEqual(0.01);
    expect(px).toBeLessThan(a.coverX);
    // its drive stub reaches forward into the cover; the drum itself stands clear of it
    const b = box(G.oil.scavengePump);
    expect(b.max.x).toBeGreaterThan(a.coverX);
    expect(b.max.x).toBeLessThan(a.faceX);
    expect(px + 0.025).toBeLessThan(a.coverX);
  });

  test("the scavenge return ends on the rear of the case, outside the starter adapter (AMM 79-00)", () => {
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    const a = starterAdapter(st, d);
    const [x, y, z] = T.oil.pumpReturn;
    // on the accessory housing's rear face (Case.tsx caseGeometry: 0.125 m either side, accBottom … accTop)
    expect(Math.abs(x - d.accRear) / IN).toBeLessThanOrEqual(0.05);
    expect(Math.abs(z)).toBeLessThan(0.125);
    expect(y).toBeGreaterThan(d.accBottom);
    expect(y).toBeLessThan(d.accTop);
    // outside the adapter's flange on that face, with the hose's radius and the 0.25 in margin to spare
    expect(Math.hypot(y - a.y, z - a.z)).toBeGreaterThan(a.flangeR + 0.005 + 0.25 * IN);
  });

  test("the controller's drain fitting under the LH magneto, on the rear of the case as drawn (M-18 12-4.2; Fig 5-33 C'CASE OIL RETURN CONN.)", () => {
    const [x, y, z] = T.oil.controllerReturn;
    // Figure 5-33 rear view, scaled (± 0.3 in): 2.3 in left of and 3.1 in above the crankshaft centreline
    expect(Math.abs(inch(z) + 2.3)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(inch(y) - 3.1)).toBeLessThanOrEqual(0.3);
    // below the LH magneto, above the oil filter's top
    const mag = magnetoPose(S, d, "L", L);
    expect(y).toBeLessThan(mag.centre[1] - mag.r);
    const F = oilFilterPose(d, L);
    expect(y).toBeGreaterThan(F.centre[1] + F.len / 2);
    // no view gives its station: on the rear face of the magneto drive housing, the case's rear surface as drawn there
    const cover = ignitionGeometry(S, d, L).cover!;
    const c = box(cover);
    cover.dispose();
    expect(Math.abs(x - c.min.x) / IN).toBeLessThanOrEqual(0.1);
    expect(y).toBeGreaterThan(c.min.y);
    expect(y).toBeLessThan(c.max.y);
    expect(z).toBeGreaterThan(c.min.z);
  });

  test("turbocharger oil leaves the bottom of the oil cooler, through a check valve and a tee hung below it (POH 7-38; M-18 Fig 5-33; AMM Fig 79-30-2 sh 3)", () => {
    const o = T.oil;
    // the cooler's centre 1.8 in above and 9.65 in left of the crankshaft centreline (M-18 Figure 5-33 rear view,
    // scaled), its 5.51 in core's bottom below it; its station approximate, 0.41 in aft of the accessory face
    near(o.coolerOutlet, [d.accRear - 0.41 * IN, (1.8 - 5.51 / 2) * IN, -9.65 * IN], 0.05);
    near(o.coolerInboard, o.coolerOutlet, 0.5);
    // the check valve and the tee below it: 20 mm forward, 65 mm outboard, 50 and 85 mm down (approximate)
    const below = (fwd: number, out: number, down: number): V3 => [
      o.coolerOutlet[0] + fwd,
      o.coolerOutlet[1] - down,
      o.coolerOutlet[2] - out,
    ];
    near(o.checkValve, below(0.02, 0.065, 0.05), 0.5);
    near(o.supplyTee, below(0.02, 0.065, 0.085), 0.5);
    // the cooler on the left (M-18 2-1), the wastegate's fitting inboard of the turbocharger outlet
    expect(o.coolerOutlet[2]).toBeLessThan(0);
    expect(o.coolerInboard[2]).toBeGreaterThan(o.coolerOutlet[2]);
  });

  test("the turbo group stays inside the M-18 Fig 5-33 / 5-34 outline", () => {
    const all = new THREE.Box3();
    turboGeometries(G).forEach((g) => all.union(box(g)));
    // the intercoolers are the widest part (42.39 in overall); 17.42 in behind the accessory face is the drawing's
    // aft extent; the tailpipes end lowest, the LH 14.82 + 11.89 = 26.71 in and the RH 14.81 + 11.95 = 26.76 in below
    // the centreline (rear view): the bound takes the LH's, the stricter
    expect(inch(Math.max(-all.min.z, all.max.z))).toBeLessThanOrEqual(21.23 + 1e-3);
    expect(station(all.min.x)).toBeGreaterThanOrEqual(-17.42);
    expect(inch(all.min.y)).toBeGreaterThanOrEqual(-(14.82 + 11.89));
  });

  test("every turbo part, as mounted, clears the magnetos, oil filter and filler, the starter and its worm wheel, the oil suction line, the engine mount fittings, and the cylinder heads and rocker covers by 0.25 in", async () => {
    const MARGIN = 0.25 * IN,
      // how far the starter and cylinder gaps are measured (beyond it a pair is simply clear)
      REACH = 2 * MARGIN;
    // the magnetos as drawn (Systems.tsx ignitionGeometry): mounting flange, body and cap on each pose's axis, enclosed
    // in a capsule as wide as the widest of them
    const ig = ignitionGeometry(S, d, L);
    const mb = [ig.flange, ig.body, ig.cap].map(box);
    Object.values(ig).forEach((g) => g?.dispose());
    const x0 = Math.min(...mb.map((b) => b.min.x)),
      x1 = Math.max(...mb.map((b) => b.max.x)),
      R = Math.max(...mb.map((b) => b.max.y));
    const mags = (["L", "R"] as const).map((side) => {
      const [, y, z] = magnetoPose(S, d, side, L).centre;
      return new THREE.Line3(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z));
    });
    // the canister standing on its adapter (kit.ts oilFilterPose) and the hex on its top (Case.tsx: 12 mm radius,
    // 14 mm high)
    const F = oilFilterPose(d, L);
    expect(F.axis).toEqual([0, 1, 0]);
    const [fx, fy, fz] = F.centre;
    const cylGap = (p: THREE.Vector3, y: number, r: number, half: number) => {
      const radial = Math.hypot(p.x - fx, p.z - fz) - r,
        axial = Math.abs(p.y - y) - half;
      return radial > 0 || axial > 0 ? Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) : Math.max(radial, axial);
    };
    const filterGap = (p: THREE.Vector3) =>
      Math.min(cylGap(p, fy, F.r, F.len / 2), cylGap(p, fy + F.len / 2 + 0.007, 0.012, 0.007));
    // the filler tube along its drawn curve (Case.tsx: kit.ts oilFiller through a 9 mm tube)
    const fill = new THREE.CatmullRomCurve3(oilFiller(d, L).tube.map((p) => new THREE.Vector3(...p))).getPoints(200);
    const fillSegs = fill.slice(1).map((p, i) => new THREE.Line3(fill[i], p));
    // the starter as drawn (Systems.tsx drivesGeometry): the motor and solenoid on their pose, the adapter housing in
    // place; the cylinders' heads, rocker boxes and covers (Cylinders.tsx cylinderGeometry) on each cylinder's frame
    const st = driveLayout(S, d, L).starter;
    if (st.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
    const sg = drivesGeometry(S, d, L).starter;
    if (sg.kind !== "rear-adapter") throw new Error("expected the adapter housing");
    const cg = cylinderGeometry(d, L);
    const atStarter = new THREE.Matrix4().makeTranslation(...st.at);
    const solids: [string, THREE.BufferGeometry][] = [
      ["Starter", sg.motor.clone().applyMatrix4(atStarter)],
      ["Starter solenoid", sg.solenoid.clone().applyMatrix4(atStarter)],
      ["Starter adapter", sg.adapter.clone()],
      ...S.geometry.cylinders.flatMap((c) => {
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(c.x, 0, 0),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.side === "L" ? Math.PI : 0, 0)),
          new THREE.Vector3(1, 1, 1),
        );
        return [
          [`Cylinder ${c.n} head`, cg.head.clone().applyMatrix4(m)],
          [`Cylinder ${c.n} rocker box`, cg.rockerBox.clone().applyMatrix4(m)],
          [`Cylinder ${c.n} rocker cover`, cg.cover.clone().applyMatrix4(m)],
        ] as [string, THREE.BufferGeometry][];
      }),
    ];
    Object.values(sg).forEach((g) => g instanceof THREE.BufferGeometry && g.dispose());
    Object.values(cg).forEach((g) => g?.dispose());
    // the oil suction line rising from the sump to the pump on the accessory face (Case.tsx), the worm wheel inside
    // the adapter, and the engine mount bosses and their brackets (Case.tsx Crankcase), as mounted
    const mounted = new Set(["Oil suction line", "Starter worm wheel", "Engine mount bosses", "Engine mount brackets"]);
    const parts = await mountScene(
      h(
        "group",
        null,
        h(Crankcase, { sim: simFor(S), d, mats: makeMats() }),
        h(Lubrication, { sim: simFor(S), d, mats: makeMats() }),
        h(Drives, { sim: simFor(S), d, mats: makeMats() }),
      ),
    );
    for (const { mesh, name } of namedMeshes(parts.scene))
      if (mounted.has(name)) solids.push([name, worldGeometry(mesh)]);
    await parts.unmount();
    expect(solids.filter(([n]) => mounted.has(n))).toHaveLength(mounted.size);
    // the suction line is an open tube, and the brackets' bars overlap each other and the bosses: measured surface to
    // surface only
    const open = new Set(["Oil suction line", "Engine mount brackets"]);
    const obstacles = solids.map(([name, g]) => ({ name, g, bvh: new MeshBVH(g), box: box(g).clone() }));
    // the scavenge pump bolts to the adapter's cover (M-18 Figure 16-17): its one contact by design
    const pumpBox = box(G.oil.scavengePump).clone();
    const mount = (b: THREE.Box3, o: string) => o === "Starter adapter" && b.equals(pumpBox);
    // odd crossings of a skewed ray: inside a closed solid (a part wholly inside another touches no surface)
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0.137, 0.419, 1).normalize());
    const inside = (bvh: MeshBVH, p: THREE.Vector3) => {
      ray.origin.copy(p);
      const hits = bvh
        .raycast(ray, THREE.DoubleSide)
        .map((x) => x.distance)
        .sort((a, b) => a - b);
      return hits.filter((x, i) => i === 0 || x - hits[i - 1] > 1e-7).length % 2 === 1;
    };
    const { scene, unmount } = await mountScene(h(Turbo, { sim: simFor(S), d, mats: makeMats() }));
    const gap: Record<string, number> = { magneto: Infinity, filter: Infinity, filler: Infinity };
    // every starter, mount and cylinder part is checked; one farther than the margin from a turbo part keeps Infinity
    for (const k of mounted) gap[k] = Infinity;
    for (const k of ["Starter", "Starter solenoid", "Starter adapter"]) gap[k] = Infinity;
    for (const k of ["head", "rocker box", "rocker cover"]) gap[`cylinder ${k}`] = Infinity;
    const worst: Record<string, string> = {};
    const v = new THREE.Vector3(),
      q = new THREE.Vector3();
    const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
    const hit2 = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
    const I = new THREE.Matrix4();
    let meshes = 0;
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        for (const m of mags) gap.magneto = Math.min(gap.magneto, m.closestPointToPoint(v, true, q).distanceTo(v) - R);
        gap.filter = Math.min(gap.filter, filterGap(v));
        for (const s of fillSegs)
          gap.filler = Math.min(gap.filler, s.closestPointToPoint(v, true, q).distanceTo(v) - 0.009);
      }
      // surface to surface against the starter and the cylinders (three-mesh-bvh), negative when inside
      const w = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
      const wb = box(w).clone();
      for (const ob of obstacles) {
        if (mount(wb, ob.name) || !wb.clone().expandByScalar(REACH).intersectsBox(ob.box)) continue;
        // the nearest surfaces within reach (null: farther); a part wholly inside the solid counts negative
        const r = ob.bvh.closestPointToGeometry(w, I, hit, hit2, 0, REACH);
        const within = !open.has(ob.name) && inside(ob.bvh, v.fromBufferAttribute(w.getAttribute("position"), 0));
        if (!r && !within) continue;
        const g = within ? -(r?.distance ?? REACH) : r!.distance;
        const key = ob.name.startsWith("Cylinder") ? ob.name.replace(/^Cylinder \d+ /, "cylinder ") : ob.name;
        if (g < (gap[key] ?? Infinity)) {
          gap[key] = g;
          const at = hit2.point;
          worst[key] =
            `(${ob.name}, nearest at s ${station(at.x).toFixed(2)}, y ${(at.y / IN).toFixed(2)}, ` +
            `z ${(at.z / IN).toFixed(2)} in)`;
        }
      }
      w.dispose();
    });
    await unmount();
    obstacles.forEach((ob) => ob.g.dispose());
    // every part the group draws, wheels and moving parts in their mounted places
    expect(meshes).toBe(turboGeometries(G).length);
    const short = Object.entries(gap)
      .filter(([, g]) => g < MARGIN)
      .map(([k, g]) => `${k} gap ${(g / IN).toFixed(2)} in ${worst[k] ?? ""}`);
    expect(short).toEqual([]);
  });

  test("the intercoolers sit clear above the rocker covers", () => {
    const cover = cylinderGeometry(d, L).cover;
    const cb = box(cover);
    for (const c of S.geometry.cylinders) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, 0, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.side === "L" ? Math.PI : 0, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      const b = cb.clone().applyMatrix4(m);
      for (const g of G.intercoolers) expect(b.intersectsBox(box(g.core))).toBe(false);
    }
    cover.dispose();
  });

  test("animation maps: gate plate, wheels, relief poppet, charge-air tint", () => {
    // gate plate: 0 across the bore when closed, opening monotonically to its full angle; clamped outside 0 … 1
    expect(gatePlateAngle(0)).toBe(0);
    const g = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(gatePlateAngle);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
    expect(gatePlateAngle(-0.2)).toBe(0);
    expect(gatePlateAngle(1.3)).toBe(gatePlateAngle(1));
    expect(actuatorTravel(0)).toBe(0);
    expect(actuatorTravel(1)).toBeGreaterThan(actuatorTravel(0.5));
    // wheels: still when stopped or failed, faster with the shaft speed
    expect(wheelRate(0, true, false)).toBe(0);
    expect(wheelRate(90000, false, false)).toBe(0);
    expect(wheelRate(90000, true, true)).toBe(0);
    const w = [0, 10000, 40000, 80000, 105000, 130000].map((n) => wheelRate(n, true, false));
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
    // overboost poppet lifts iff the relief valve is open
    expect(reliefLift(false)).toBe(0);
    expect(reliefLift(true)).toBeGreaterThan(0);
    // charge air: warmer tint for warmer air
    const red = [-20, 20, 60, 100, 150, 250].map((c) => chargeAirColor(c, new THREE.Color()).r);
    for (let i = 1; i < red.length; i++) expect(red[i]).toBeGreaterThanOrEqual(red[i - 1]);
    expect(red[4]).toBeGreaterThan(red[1]);
  });

  test("hiding the turbo group removes every one of its parts", async () => {
    const sim = simFor(S, "tsio550k-hide-turbo");
    const el = h(Group, { sim, id: "turbo", children: h(Turbo, { sim, d, mats: makeMats() }) });
    const { scene, render, unmount } = await mountScene(el);
    const meshes = () => {
      let n = 0;
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) n++;
      });
      return n;
    };
    expect(meshes()).toBe(turboGeometries(G).length);
    sim.useUi.setState((u) => ({ view: { ...u.view, hidden: ["turbo"] } }));
    await render(el);
    expect(meshes()).toBe(0);
    await unmount();
  });

  test("a failed turbocharger's wheels stand still while the other side's turn", async () => {
    const sim = simFor(S, "tsio550k-failed-wheel");
    sim.s.running = true;
    sim.s.turboRpm = [80000, 80000];
    sim.useUi.setState((u) => ({
      failures: { ...u.failures, turboInternal: [true, false] },
      view: { ...u.view, paused: false },
    }));
    const { scene, unmount } = await mountScene(h(Turbo, { sim, d, mats: makeMats() }));
    // the wheel groups sit on each shaft's axis (layout-turbo.ts sides): read their rotation
    const wheelsOf = (k: number) => {
      const out: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (
          o.type === "Group" &&
          Math.abs(o.position.y - T.sides[k].y) < 1e-9 &&
          Math.abs(o.position.z - T.sides[k].z) < 1e-9
        )
          out.push(o);
      });
      return out;
    };
    const angles = () => [0, 1].map((k) => wheelsOf(k).map((o) => o.rotation.x));
    // two 50 ms steps of the scene's clock (frameloop "never": advance takes the time in seconds)
    advance(1.0);
    const before = angles();
    advance(1.05);
    advance(1.1);
    const after = angles();
    expect(before[0].length).toBeGreaterThan(0);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).not.toEqual(before[1]);
    await unmount();
  });
});

/**
 * The engine's solid parts as drawn, in place, for the clearance tests below: the cylinders (each part tagged with its
 * cylinder), the crankcase, sump and accessory housing, the engine mount fittings, the starter, the magnetos and
 * harness, the oil filter, the fuel manifold valve, and the turbo group's fixed parts (its turning wheels sit inside
 * their housings). Each is a world-space geometry the caller disposes.
 */
function sceneSolids() {
  const out: { name: string; cyl?: number; turbo?: string; g: THREE.BufferGeometry }[] = [];
  const cg = cylinderGeometry(d, L);
  for (const c of S.geometry.cylinders) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(c.x, 0, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.side === "L" ? Math.PI : 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    for (const k of ["barrel", "flange", "head", "rockerBox", "cover", "intakePort", "exhaustPort"] as const)
      out.push({ name: `Cylinder ${c.n} ${k}`, cyl: c.n, g: cg[k].clone().applyMatrix4(m) });
  }
  Object.values(cg).forEach((g) => g.dispose());
  const kg = caseGeometry(d, L);
  for (const k of ["right", "left", "acc", "sump"] as const) out.push({ name: `case ${k}`, g: kg[k].clone() });
  out.push(
    { name: "Engine mount bosses", g: kg.mounts.clone() },
    { name: "Engine mount brackets", g: kg.brackets!.clone() },
  );
  Object.values(kg).forEach((g) => g?.dispose());
  const st = driveLayout(S, d, L).starter;
  const sg = drivesGeometry(S, d, L).starter;
  if (st.kind !== "rear-adapter" || sg.kind !== "rear-adapter") throw new Error("expected the rear starter adapter");
  const atStarter = new THREE.Matrix4().makeTranslation(...st.at);
  out.push(
    { name: "Starter", g: sg.motor.clone().applyMatrix4(atStarter) },
    { name: "Starter solenoid", g: sg.solenoid.clone().applyMatrix4(atStarter) },
    { name: "Starter adapter", g: sg.adapter.clone() },
  );
  Object.values(sg).forEach((g) => g instanceof THREE.BufferGeometry && g.dispose());
  // the magnetos on their poses, the drive housing behind them and the harness (Systems.tsx ignitionGeometry)
  const ig = ignitionGeometry(S, d, L);
  for (const m of ["L", "R"] as const) {
    const at = new THREE.Matrix4().makeTranslation(0, ...(magnetoPose(S, d, m, L).centre.slice(1) as [number, number]));
    for (const k of ["body", "flange", "cap"] as const)
      out.push({ name: `${m} magneto ${k}`, g: ig[k].clone().applyMatrix4(at) });
  }
  out.push({ name: "Magneto drive housing", g: ig.cover!.clone() }, { name: "Ignition harness", g: ig.leads.clone() });
  Object.values(ig).forEach((g) => g?.dispose());
  // the oil filter canister (kit.ts oilFilterPose) and the fuel manifold valve on top (Systems.tsx InjectedFuel)
  const F = oilFilterPose(d, L);
  out.push({ name: "Oil filter", g: new THREE.CylinderGeometry(F.r, F.r, F.len, 24).translate(...F.centre) });
  const xs = S.geometry.cylinders.map((c) => c.x);
  out.push({
    name: "Fuel manifold",
    g: new THREE.CylinderGeometry(0.022, 0.022, 0.03, 20).translate(
      (Math.max(...xs) + Math.min(...xs)) / 2,
      d.caseTop + 0.035,
      0,
    ),
  });
  const G = turboGeometry(L.turbo!);
  const walk = (v: unknown, path: string) => {
    if (v instanceof THREE.BufferGeometry) out.push({ name: `turbo ${path}`, turbo: path, g: v });
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  // the parts drawn in their own frames (wheels, shafts, the gate plate and rod, the poppet) stay out
  const moving = /(Wheel|shaft$|\.plate$|\.rod$|poppet)$/;
  walk(G, "");
  return out.filter((o) => {
    if (o.turbo && moving.test(o.turbo)) {
      o.g.dispose();
      return false;
    }
    return true;
  });
}

/** A run of tube, trimmed by `from`/`to` metres at its ends (where it is joined to another part on purpose). */
function trimmed(curve: THREE.Curve<THREE.Vector3>, from: number, to: number) {
  const len = curve.getLength();
  const n = Math.max(8, Math.ceil((len - from - to) / 0.005));
  return new THREE.CatmullRomCurve3(
    Array.from({ length: n + 1 }, (_, i) => curve.getPointAt(Math.min(1, (from + ((len - from - to) * i) / n) / len))),
  );
}

describe("TSIO-550-K exhaust (M-18 Fig 12-22; POH 7-38)", () => {
  const E = L.exhaust!;
  const T = L.turbo!;
  const runs = exhaustRuns(S, d, L);
  const run = (name: string) => runs.find((r) => r.name === name)!;
  const curveDist = (p: V3, r: { points: V3[] }) => {
    const pts = new THREE.CatmullRomCurve3(r.points.map((q) => new THREE.Vector3(...q))).getPoints(400);
    return Math.min(...pts.map((q) => q.distanceTo(new THREE.Vector3(...p))));
  };
  const same = (a: V3, b: V3) => a.forEach((v, i) => expect(v, `[${i}]`).toBeCloseTo(b[i], 9));

  test("six exhaust runs, each bank to its own turbine inlet; the LH tailpipe carries the wastegate (POH 7-38; M-18 Fig 12-22)", () => {
    const hp = headPoints(d, L);
    const risers = runs.filter((r) => r.name.startsWith("Exhaust riser"));
    expect(risers).toHaveLength(6);
    for (const c of S.geometry.cylinders) {
      const r = run(`Exhaust riser, cylinder ${c.n}`);
      // from the bottom of the cylinder's exhaust outlet, its foot on the port flange (Cylinders.tsx: 0.07 m along the
      // cylinder, 0.05 m across), down to its own bank's collector
      const port = toWorld(c, hp.exhaustPort);
      const [fx, fy, fz] = r.points[0];
      expect(Math.abs(fx - port[0]) + E.r.riser).toBeLessThanOrEqual(0.035);
      expect(Math.abs(fz - port[2]) + E.r.riser).toBeLessThanOrEqual(0.025);
      expect(Math.abs(fy - port[1]) / IN).toBeLessThan(0.2);
      for (let i = 1; i < r.points.length; i++) expect(r.points[i][1]).toBeLessThanOrEqual(r.points[i - 1][1]);
      const bank = run(`${c.side === "L" ? "LH" : "RH"} exhaust collector`);
      expect(curveDist(r.points[r.points.length - 1], bank) / IN).toBeLessThan(0.1);
      const other = run(`${c.side === "L" ? "RH" : "LH"} exhaust collector`);
      expect(curveDist(r.points[r.points.length - 1], other) / IN).toBeGreaterThan(10);
    }
    // each collector ends on its own turbine inlet flange (layout-turbo.ts, the contract)
    same(run("LH exhaust collector").points.at(-1)!, T.sides[0].turbineInlet);
    same(run("RH exhaust collector").points.at(-1)!, T.sides[1].turbineInlet);
    // the wastegate: fed from the left bank and, through the crossover, the right; it empties into the LH tailpipe
    const toGate = run("Wastegate transition");
    same(toGate.points.at(-1)!, T.wastegate.flanges.top);
    expect(curveDist(toGate.points[0], run("LH exhaust collector")) / IN).toBeLessThan(E.r.pipe / IN);
    const cross = run("Exhaust crossover");
    expect(curveDist(cross.points[0], run("RH exhaust collector")) / IN).toBeLessThan(E.r.pipe / IN);
    expect(curveDist(cross.points.at(-1)!, toGate) / IN).toBeLessThan(E.r.pipe / IN);
    // a joint by design: the crossover leaves the RH collector where cylinder 1's riser drops into it, a three-pipe
    // junction (M-18 Figure 12-22)
    const r1 = run("Exhaust riser, cylinder 1").points.at(-1)!;
    expect(Math.hypot(...cross.points[0].map((v, i) => v - r1[i])) / IN).toBeLessThan((E.r.pipe + E.r.riser) / IN);
    const drop = run("Wastegate outlet");
    same(drop.points[0], T.wastegate.flanges.bottom);
    expect(curveDist(drop.points.at(-1)!, run("LH tailpipe")) / IN).toBeLessThan(E.r.tail / IN);
    expect(curveDist(drop.points.at(-1)!, run("RH tailpipe")) / IN).toBeGreaterThan(20);
    // the tailpipes leave the turbines' discharge collars
    for (const [k, t] of T.sides.entries()) same(run(`${k ? "RH" : "LH"} tailpipe`).points[0], [t.outlet.x, t.y, t.z]);
  });

  test("tailpipes end where M-18 Figs 5-33 and 5-35 draw them", () => {
    for (const [k, t] of T.sides.entries()) {
      const g = tube(run(`${k ? "RH" : "LH"} tailpipe`).points, E.r.tail, 64, 14);
      const b = box3(g);
      g.dispose();
      // 17.42 in aft of the accessory face; 11.89 in (LH) and 11.95 in (RH) below the shafts (rear view)
      const below = k ? 11.95 : 11.89;
      expect(station(b.min.x)).toBeGreaterThanOrEqual(-17.42);
      expect(station(b.min.x)).toBeLessThan(-17.42 + 0.5);
      expect(b.min.y / IN).toBeGreaterThanOrEqual(t.y / IN - below);
      expect(b.min.y / IN).toBeLessThan(t.y / IN - below + 0.5);
      // in the turbine's vertical plane (rear view: the tailpipes drop straight down)
      const end = run(`${k ? "RH" : "LH"} tailpipe`).points.at(-1)!;
      expect(Math.abs(end[2] - t.z) / IN).toBeLessThanOrEqual(0.3);
    }
  });

  test("the exhaust clears the cylinders, valve train, case, mount fittings, starter and turbo group by 0.25 in, away from its own joints", async () => {
    const solids = sceneSolids();
    // the pushrods, their shroud tubes and seals as mounted (Valvetrain.tsx); each pushrod both seated and at full lift
    const { scene, unmount } = await mountScene(h(ValveTrain, { sim: simFor(S), d, mats: makeMats() }));
    for (const { mesh, name } of namedMeshes(scene).filter((p) =>
      /^(Pushrod|Pushrod shroud tube|Shroud tube seal)$/.test(p.name),
    ))
      if (name !== "Pushrod") solids.push({ name, g: worldGeometry(mesh) });
      else
        for (const lift of [0, VT.maxLift]) {
          mesh.parent!.position.z = VT.baseR + VT.tappetLen + lift;
          mesh.updateWorldMatrix(true, false);
          solids.push({ name, g: worldGeometry(mesh) });
        }
    await unmount();
    expect(solids.filter((o) => o.name === "Pushrod")).toHaveLength(4 * S.geometry.cylinders.length);
    // the inside test needs one closed solid, or (the mount bosses) disjoint ones; merged and open-ended parts are
    // measured surface to surface, which a run crossing them can't escape
    const closed = /^(case |Engine mount bosses$|Starter$|Starter solenoid$|Pushrod shroud tube$)/;
    const obs = solids.map((o) => ({ ...o, ob: obstacle(o.name, o.g, closed.test(o.name)) }));
    const MARGIN = 0.25 * IN;
    const short: string[] = [];
    for (const r of runs) {
      const riser = r.name.match(/cylinder (\d)/);
      // joined on purpose: a riser to its own cylinder's port flange, and the rocker box the port sits in (Cylinders.tsx
      // draws the port inside it); each run's end on the flange it bolts to (trimmed off); the wastegate outlet to the
      // wastegate body
      const from = /collector|tailpipe|outlet/.test(r.name) ? r.r + 0.6 * IN : 0;
      const to = /collector|Wastegate transition/.test(r.name) ? r.r + 0.6 * IN : 0;
      const against = obs
        .filter((o) => !(riser && o.cyl === Number(riser[1]) && / (rockerBox|exhaustPort)$/.test(o.name)))
        .filter((o) => !(r.name === "Wastegate outlet" && o.turbo?.startsWith("wastegate.body")))
        // the TIT probe stands in its turbine's inlet transition (M-18 Fig 5-33)
        .filter(
          (o) =>
            !(
              r.name === `${o.turbo?.startsWith("sides.0") ? "LH" : "RH"} exhaust collector` &&
              /tit$/.test(o.turbo ?? "")
            ),
        )
        .map((o) => o.ob);
      const w = sampledClearance(trimmed(runCurve(r), from, to), r.r, against, 0.005);
      if (w.gap < MARGIN)
        short.push(`${r.name} → ${w.name}: ${(w.gap / IN).toFixed(2)} in at s ${station(w.at.x).toFixed(1)}`);
    }
    solids.forEach((o) => o.g.dispose());
    expect(short).toEqual([]);
  });
});

describe("TSIO-550-K exhaust group", () => {
  // the panel's part groups unmount what they hide (parts.tsx Group): every exhaust part goes with its group
  test("hiding the exhaust group removes every one of its parts", async () => {
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((x) => {
        if (x instanceof THREE.Mesh) n++;
      });
      return n;
    };
    const cases = [["exhaust", Exhaust, exhaustRuns(S, d, L).length + 1]] as const;
    for (const [id, part, drawn] of cases) {
      const sim = simFor(S, `tsio550k-hide-${id}`);
      const el = h(Group, {
        sim,
        id,
        children: h(part as FC<{ sim: typeof sim; d: typeof d; mats: ReturnType<typeof makeMats> }>, {
          sim,
          d,
          mats: makeMats(),
        }),
      });
      const { scene, render, unmount } = await mountScene(el);
      expect(meshes(scene), id).toBe(drawn);
      sim.useUi.setState((u) => ({ view: { ...u.view, hidden: [id] } }));
      await render(el);
      expect(meshes(scene), id).toBe(0);
      await unmount();
    }
  });
});

/** The scene's meshes with the names the pointer shows for them. */
function namedMeshes(scene: THREE.Object3D) {
  const out: { name: string; mesh: THREE.Mesh }[] = [];
  scene.traverse((o) => {
    const over = (o as { __r3f?: { handlers: Record<string, (e: unknown) => void> } }).__r3f?.handlers.onPointerOver;
    if (!(o instanceof THREE.Mesh) || !over) return;
    useHover.setState({ hover: null });
    over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
    out.push({ name: useHover.getState().hover?.name ?? "", mesh: o });
  });
  useHover.setState({ hover: null });
  return out;
}

/** Each drawn boss's centre in the world: the merged bosses split into their cylinders. */
function bossCentres(mesh: THREE.Mesh) {
  const per = rod(0.02, 0.045, 16).toNonIndexed().attributes.position.count;
  const pos = mesh.geometry.attributes.position;
  expect(pos.count % per).toBe(0);
  return Array.from({ length: pos.count / per }, (_, k) => {
    const box = new THREE.Box3();
    for (let i = k * per; i < (k + 1) * per; i++)
      box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    return box.getCenter(new THREE.Vector3());
  });
}

describe("TSIO-550-K engine mount fittings (AMM 71-20: six)", () => {
  // Inches forward of the accessory mounting face, right (+) of and above (+) the crankshaft centreline. Forward legs:
  // M-18 Figures 5-33, 5-35 (stations) and 5-34 view D-D (15.24 in apart, 8.21 in below). Aft mounts: Figure 5-33 rear
  // view (14.62 in apart, 8.13 in below); the station is approximate, ± 0.5 in.
  const FITTINGS = [
    { at: "left leg, front hole", station: 20.27, out: -7.62, up: -8.21, tol: 0.01 },
    { at: "left leg, rear hole", station: 16.99, out: -7.62, up: -8.21, tol: 0.01 },
    { at: "left aft mount", station: 3.97, out: -7.31, up: -8.13, tol: 0.5 },
    { at: "right leg, front hole", station: 20.19, out: 7.62, up: -8.21, tol: 0.01 },
    { at: "right leg, rear hole", station: 16.91, out: 7.62, up: -8.21, tol: 0.01 },
    { at: "right aft mount", station: 3.97, out: 7.31, up: -8.13, tol: 0.5 },
  ];

  test("the scene draws six bosses at the M-18 positions", async () => {
    const sim = simFor(S, "tsio550k-mounts");
    const { scene, unmount } = await mountScene(h(Crankcase, { sim, d, mats: makeMats() }));
    const bosses = namedMeshes(scene).filter((m) => m.name === "Engine mount bosses");
    expect(bosses).toHaveLength(1);
    const centres = bossCentres(bosses[0].mesh).map((c) => ({ station: station(c.x), out: c.z / IN, up: c.y / IN }));
    expect(centres).toHaveLength(6);
    for (const f of FITTINGS) {
      const near = centres.reduce((a, b) =>
        Math.hypot(b.station - f.station, b.out - f.out, b.up - f.up) <
        Math.hypot(a.station - f.station, a.out - f.out, a.up - f.up)
          ? b
          : a,
      );
      expect(Math.abs(near.station - f.station), f.at).toBeLessThanOrEqual(f.tol);
      expect(near.out, f.at).toBeCloseTo(f.out, 2);
      expect(near.up, f.at).toBeCloseTo(f.up, 2);
    }
    await unmount();
  });

  test("the bosses and their brackets clear the scene's other parts", async () => {
    const sim = simFor(S, "tsio550k-mount-clearance");
    const p = { sim, d, mats: makeMats() };
    const all = [Crankshaft, RodsAndPistons, Camshaft, ValveTrain, Cylinders, Crankcase, Lubrication];
    const more = [Ignition, FuelSystem, Induction, Turbo, Exhaust, Drives, Propeller];
    const { scene, unmount } = await mountScene(
      h(PartNotesProvider, { value: S.parts }, ...[...all, ...more].map((C) => h(C, p))),
    );
    const meshes = namedMeshes(scene);
    const mine = /^Engine mount (bosses|brackets)$/;
    const closed = /^(Crankcase, (right|left) half|Oil sump|Accessory housing)$/;
    const solids = meshes
      .filter((m) => !mine.test(m.name))
      .map((m) => ({
        name: m.name,
        ob: obstacle(m.name, m.mesh.geometry.clone().applyMatrix4(m.mesh.matrixWorld), closed.test(m.name)),
      }));
    const M = L.mounts(d);
    const ends = (c: THREE.Vector3) => new THREE.LineCurve3(c.clone().setX(c.x - 0.0225), c.clone().setX(c.x + 0.0225));
    const worst = { boss: { gap: Infinity, name: "" }, bracket: { gap: Infinity, name: "" } };
    const everything = solids.map((s) => s.ob);
    for (const b of M.bosses) {
      const w = sampledClearance(ends(new THREE.Vector3(...b)), 0.02, everything, 0.004);
      if (w.gap < worst.boss.gap) worst.boss = w;
    }
    // a bracket starts inside the crankcase half that carries it
    const off = solids.filter((s) => !/^Crankcase, (right|left) half$/.test(s.name)).map((s) => s.ob);
    for (const [a, b] of M.brackets) {
      const curve = new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
      const w = sampledClearance(curve, 0.009, off, 0.004);
      if (w.gap < worst.bracket.gap) worst.bracket = w;
    }
    for (const [part, w] of Object.entries(worst)) {
      console.info(`mount clearance, ${part}: ${(w.gap * 1000).toFixed(1)} mm to ${w.name}`);
      expect(w.gap, `${part} to ${w.name}`).toBeGreaterThan(0.002);
    }
    await unmount();
  });

  test("every bracket starts inside the crankcase and ends at a boss", () => {
    const M = L.mounts(d);
    const at = (p: V3) => M.bosses.some((b) => Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) < 1e-9);
    for (const [a, b] of M.brackets) {
      expect(at(b)).toBe(true);
      if (at(a)) continue; // a leg's bar between its two bosses
      expect(a[0]).toBeGreaterThan(d.caseRear);
      expect(a[0]).toBeLessThan(d.front);
      expect(a[1]).toBeGreaterThan(d.caseBottom);
      expect(Math.abs(a[2])).toBeLessThan(d.caseHalf);
    }
  });
});
