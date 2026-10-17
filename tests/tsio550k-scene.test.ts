/**
 * The TSIO-550-K in the engine page's 3D model: stations, crankshaft, ports and drives as the Continental M-18 manual,
 * the SR22T POH and AMM give them (engines/tsio550k/layout.ts cites each). The engine is not on the engine pages yet,
 * so its scene is mounted here directly, stopped.
 */
// vitest: isolate (mounts the scene with React Three Fiber)
import { createElement as h } from "react";
import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { mod, sideAngle } from "@/engines/model/cycle";
import { noFailures } from "@/engines/model/engine";
import { TSIO550K } from "@/engines/tsio550k/spec";
import { simFor } from "@/components/engine/store";
import { Crankcase, Lubrication } from "@/components/engine/scene/Case";
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
  magDrive,
  makeMats,
  oilFiller,
  oilPump,
  rod,
  throwRotation,
  valveLayout,
} from "@/components/engine/scene/kit";
import { cylinderGeometry, Cylinders } from "@/components/engine/scene/Cylinders";
import { layoutFor, type V3 } from "@/components/engine/scene/layout";
import { PartNotesProvider, useHover } from "@/components/engine/scene/parts";
import { Crankshaft, RodsAndPistons } from "@/components/engine/scene/Rotating";
import { Drives, FuelSystem, Ignition, Induction, Propeller } from "@/components/engine/scene/Systems";
import { Camshaft, ValveTrain } from "@/components/engine/scene/Valvetrain";
import { mountScene } from "./engine-mount";
import { obstacle, sampledClearance } from "./sampled-clearance";

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
    // magneto 1.5: through the idler, 24 crankshaft-gear teeth to 16
    const m = magDrive(S, d, L);
    expect(m.idler).not.toBeNull();
    expect(GEAR_TEETH.crank / m.teeth).toBe(1.5);
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
    const more = [Ignition, FuelSystem, Induction, Drives, Propeller];
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
