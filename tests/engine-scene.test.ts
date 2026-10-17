/**
 * The engine page's 3D model for every engine (components/engine/scene/): the drawing keeps time with the cycle model,
 * its gears mesh at the spec's drive ratios, and the parts fit the published envelope. Each engine's layout
 * (scene/layout.ts) places them; the IO-390's defaults are the constants the scene was first drawn with.
 */
import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { mod, phaseOf, rodEnds, sideAngle, valveLift } from "@/engines/model/cycle";
import { noFailures, sparks, type MagSwitch } from "@/engines/model/engine";
import { O360 } from "@/engines/o360/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";
import type { EngineSpec } from "@/engines/types";
import { caseGeometry } from "@/components/engine/scene/Case";
import { cylinderGeometry } from "@/components/engine/scene/Cylinders";
import {
  bank,
  CHEEK_T,
  crankLayout,
  D2R,
  dims,
  drawnSparks,
  driveLayout,
  GEAR_TEETH,
  gearSpins,
  headPoints,
  IN,
  lobeAngle,
  magDrive,
  oilFiller,
  oilPump,
  peakCrank,
  STARTER_TEETH,
  throwRotation,
  valveLayout,
  VT,
} from "@/components/engine/scene/kit";
import { IO390_DEFAULTS, layoutFor, type V3 } from "@/components/engine/scene/layout";
import { crankGeometry } from "@/components/engine/scene/Rotating";

const ENGINES: [string, EngineSpec][] = [
  ["IO-390", IO390],
  ["O-360", O360],
  ["TSIO-550-K", TSIO550K],
];

/** The drawn crankcase, cylinders and crankshaft (to the propeller flange) in engine coordinates. */
function coreBounds(spec: EngineSpec) {
  const L = layoutFor(spec),
    d = dims(spec, L);
  const box = new THREE.Box3();
  const add = (g: THREE.BufferGeometry, m = new THREE.Matrix4()) => {
    g.computeBoundingBox();
    box.union(g.boundingBox!.clone().applyMatrix4(m));
    g.dispose();
  };
  Object.values(caseGeometry(d)).forEach((g) => add(g));
  const crank = crankGeometry(spec, d);
  [crank.journals, crank.nose, crank.flange, crank.crankGear].forEach((g) => add(g));
  const cyl = cylinderGeometry(d, L);
  for (const c of spec.geometry.cylinders) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(c.x, 0, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.side === "L" ? Math.PI : 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    Object.values(cyl).forEach((g) => {
      g.computeBoundingBox();
      box.union(g.boundingBox!.clone().applyMatrix4(m));
    });
  }
  Object.values(cyl).forEach((g) => g.dispose());
  return box;
}

describe.each(ENGINES)("%s 3D model", (_, S) => {
  const L = layoutFor(S);
  const d = dims(S, L);

  test("each cam lobe faces its tappet at that valve's peak lift", () => {
    for (const c of S.geometry.cylinders)
      for (const intake of [true, false]) {
        const crank = peakCrank(S, c, intake);
        // nose direction (0 up, 90 right) of a lobe on a camshaft turned −crank/2
        const nose = mod(90 + lobeAngle(S, c, intake) - crank / 2, 360);
        expect(nose).toBeCloseTo(sideAngle(c), 6);
        const lift = valveLift(S, phaseOf(S, c.n, crank));
        expect(intake ? lift.intake : lift.exhaust).toBeCloseTo(1, 6);
      }
  });

  test("no two cam lobes overlap along the camshaft", () => {
    const V = valveLayout(L);
    const at = S.geometry.cylinders
      .flatMap((c) => [c.x + bank(c) * V.intake.x, c.x + bank(c) * V.exhaust.x])
      .sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThan(VT.lobeW);
  });

  test("the rockers are drawn 1:1, pivoting between the pushrod and the valve stem", () => {
    const V = valveLayout(L);
    for (const v of [V.intake, V.exhaust]) {
      expect(Math.abs(v.pushY - v.pivotY)).toBeCloseTo(Math.abs(v.pivotY - v.tipY), 6);
      expect((v.pivotY - v.pushY) * (v.tipY - v.pivotY)).toBeGreaterThan(0);
      // the pushrod runs on the camshaft's axis
      expect(v.pushY).toBeCloseTo(d.camY, 6);
    }
  });

  test("the piston crown stays below the head at top centre", () => {
    expect(d.r + d.l + d.crown).toBeLessThan(d.deck);
  });

  test("the rocker covers fit the cover width", () => {
    const half = ((L.coverWidthIn ?? S.geometry.envelopeIn.width) * IN) / 2;
    expect(d.headOut).toBeLessThanOrEqual(half + 1e-9);
    const g = cylinderGeometry(d, L).cover;
    g.computeBoundingBox();
    expect(g.boundingBox!.max.z).toBeLessThanOrEqual(half + 1e-9);
    g.dispose();
  });

  test("every gear meshes with the one that drives it, at the spec's drive ratio", () => {
    const acc = S.accessories;
    // camshaft gear on the crankshaft gear, twice the teeth: half speed
    expect(Math.abs(d.camY)).toBeCloseTo(d.crankGearR + d.camGearR, 6);
    expect(GEAR_TEETH.cam / GEAR_TEETH.crank).toBeCloseTo(d.camGearR / d.crankGearR, 6);
    // magneto gears on the camshaft gear, or on the idler the crankshaft gear drives
    const m = magDrive(S, d, L);
    if (m.idler) {
      expect(m.idler.y).toBeCloseTo(d.crankGearR + m.idler.r, 6);
      expect(Math.hypot(m.y - m.idler.y, m.z)).toBeCloseTo(m.idler.r + m.r, 6);
      expect(GEAR_TEETH.crank / m.teeth).toBeCloseTo(acc.magnetoRatio, 6);
      expect(m.r / d.crankGearR).toBeCloseTo(m.teeth / GEAR_TEETH.crank, 6);
    } else {
      expect(Math.hypot(m.y - d.camY, m.z)).toBeCloseTo(d.camGearR + m.r, 6);
      expect((0.5 * GEAR_TEETH.cam) / m.teeth).toBeCloseTo(acc.magnetoRatio, 6);
    }
    // oil pump drive: under the crankshaft gear, or turning with the camshaft gear
    const p = oilPump(d, L);
    if (p.onCam) {
      expect(p.y).toBeCloseTo(d.camY, 6);
      expect(p.ratio).toBe(0.5);
    } else {
      expect(-p.y).toBeCloseTo(d.crankGearR + p.driveR, 6);
      expect(GEAR_TEETH.crank / p.driveTeeth).toBeCloseTo(p.ratio, 6);
    }
    const D = driveLayout(S, d, L);
    // governor: half (camshaft) times the camshaft-to-governor gear ratio
    expect((0.5 * D.governor.camGovR) / D.governor.govR).toBeCloseTo(acc.governorRatio, 6);
    // starter
    const st = D.starter;
    if (st.kind === "front-ring") expect(STARTER_TEETH.ring / STARTER_TEETH.pinion).toBeCloseTo(acc.starterRatio, 3);
    else {
      expect(Math.hypot(st.shaft.y, st.shaft.z)).toBeCloseTo(d.crankGearR + st.shaft.r, 6);
      expect(((st.wheel.teeth / st.worm.starts) * GEAR_TEETH.crank) / st.shaft.teeth).toBeCloseTo(acc.starterRatio, 6);
    }
    // alternators: geared to a drive gear on the crankshaft, or on a belt
    for (const a of D.alternators) {
      if (a.gear) {
        expect(a.gear.driveTeeth / a.gear.drivenTeeth).toBeCloseTo(a.ratio, 6);
        expect(a.gear.driveR / a.gear.drivenR).toBeCloseTo(a.ratio, 6);
        if (a.gear.bevel) {
          // a bevel pinion across the shaft: beside the drive gear's rim, its aft face just forward of the drive gear
          expect(Math.hypot(a.at[1], a.at[2])).toBeCloseTo(a.gear.driveR + 0.006, 6);
          expect(a.x - a.gear.drivenR - a.gear.driveX).toBeCloseTo(0.007, 6);
        } else expect(Math.hypot(a.at[1], a.at[2])).toBeCloseTo(a.gear.driveR + a.gear.drivenR, 6);
      } else expect(d.pulleyR / d.altPulleyR).toBeCloseTo(a.ratio, 6);
    }
  });

  test("meshed gears turn in opposite directions and belted pulleys the same way", () => {
    const { spins, meshes } = gearSpins(S, d, L);
    for (const m of meshes) {
      const pair = `${m.a}–${m.b}`;
      expect(spins[m.a], pair).toBeDefined();
      expect(spins[m.b], pair).toBeDefined();
      if (m.kind === "gear") expect(Math.sign(spins[m.a]) * Math.sign(spins[m.b]), pair).toBe(-1);
      if (m.kind === "belt") expect(Math.sign(spins[m.a]) * Math.sign(spins[m.b]), pair).toBe(1);
    }
    // each drive turns at its spec ratio, in the sense its drawn axis needs: a spur gear against the gear driving it, a
    // bevel gear with its axis turned across the shaft as that turn gives
    const D = driveLayout(S, d, L);
    expect(spins.magneto).toBe(S.accessories.magnetoRatio);
    expect(spins.governor).toBe((D.governor.bevel ? -1 : 1) * S.accessories.governorRatio);
    for (const a of D.alternators) expect(spins[a.def.name]).toBe((a.gear && !a.gear.bevel ? -1 : 1) * a.ratio);
  });

  test("at every meshing pair, gear or bevel, both rims move the same way at the same speed where they meet", () => {
    const { spins, meshes } = gearSpins(S, d, L);
    const D = driveLayout(S, d, L),
      mag = magDrive(S, d, L),
      pump = oilPump(d, L);
    const X: V3 = [1, 0, 0];
    type Rim = { c: V3; axis: V3; r: number };
    const at = (x: number, y = 0, z = 0): V3 => [x, y, z];
    const crank = (r: number, x = 0): Rim => ({ c: at(x), axis: X, r });
    const cam = (r: number, x = 0): Rim => ({ c: at(x, d.camY), axis: X, r });
    // each pair's two rims as the scene draws them: centre, the axis a positive spin turns about, and radius
    const rims = (a: string, b: string): [Rim, Rim] | null => {
      const gv = D.governor;
      const govAxis = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(...gv.rotation));
      const magnetoRim: Rim = { c: at(mag.x, mag.y, mag.z), axis: X, r: mag.r };
      switch (`${a}–${b}`) {
        case "crank–cam":
          return [crank(d.crankGearR), cam(d.camGearR)];
        case "crank–idler":
          return [crank(d.crankGearR), { c: at(0, mag.idler!.y), axis: X, r: mag.idler!.r }];
        case "idler–magneto":
          return [{ c: at(mag.x, mag.idler!.y), axis: X, r: mag.idler!.r }, magnetoRim];
        case "cam–magneto":
          return [cam(d.camGearR), magnetoRim];
        case "crank–oilPumpDrive":
          return [crank(d.crankGearR), { c: at(0, pump.y), axis: X, r: pump.driveR }];
        case "oilPump–oilPumpIdler":
          return [
            { c: at(0, pump.y), axis: X, r: pump.gearR },
            { c: at(0, pump.y, 2 * pump.gearR), axis: X, r: pump.gearR },
          ];
        case "crank–pinion":
          if (D.starter.kind !== "front-ring") return null;
          return [crank(d.ringR), { c: D.starter.at, axis: X, r: D.starter.pinionR }];
        case "crank–starterShaft":
          if (D.starter.kind !== "rear-adapter") return null;
          return [
            crank(d.crankGearR),
            { c: at(0, D.starter.shaft.y, D.starter.shaft.z), axis: X, r: D.starter.shaft.r },
          ];
        case "cam–governor":
          return [
            cam(gv.camGovR, d.front - 0.03),
            { c: gv.gearAt ?? gv.at, axis: [govAxis.x, govAxis.y, govAxis.z], r: gv.govR },
          ];
      }
      const alt = D.alternators.find((x) => a === "crank" && x.def.name === b);
      if (!alt?.gear) return null;
      return [
        crank(alt.gear.driveR, alt.gear.driveX),
        { c: alt.at, axis: alt.transverse?.axis ?? X, r: alt.gear.drivenR },
      ];
    };
    const v3 = (p: V3) => new THREE.Vector3(...p);
    // the rim point facing the other gear, in the plane the gear turns in
    const rimPoint = (g: Rim, towards: V3) => {
      const axis = v3(g.axis),
        to = v3(towards).sub(v3(g.c));
      return to
        .sub(axis.multiplyScalar(to.dot(axis)))
        .setLength(g.r)
        .add(v3(g.c));
    };
    let checked = 0;
    for (const m of meshes) {
      if (m.kind === "belt") continue;
      const pair = `${m.a}–${m.b}`;
      const g = rims(m.a, m.b);
      expect(g, `${pair}: rims known`).not.toBeNull();
      const [ga, gb] = g!;
      // each gear's rim speed where it meets the other, per radian of the crankshaft
      const va = v3(ga.axis)
        .multiplyScalar(spins[m.a])
        .cross(rimPoint(ga, gb.c).sub(v3(ga.c)));
      const vb = v3(gb.axis)
        .multiplyScalar(spins[m.b])
        .cross(rimPoint(gb, ga.c).sub(v3(gb.c)));
      expect(va.length(), pair).toBeGreaterThan(0);
      expect(va.dot(vb) / (va.length() * vb.length()), `${pair}: same direction`).toBeGreaterThan(0.95);
      expect(vb.length() / va.length(), `${pair}: same speed`).toBeCloseTo(1, 1);
      checked++;
    }
    expect(checked).toBe(meshes.filter((m) => m.kind !== "belt").length);
  });

  test("no two crankshaft cheeks overlap", () => {
    const cl = crankLayout(S, d, L);
    const at = [...cl.cheeks].sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(CHEEK_T);
  });

  test("the crankcase, cylinders and crankshaft fit the published envelope", () => {
    const size = coreBounds(S).getSize(new THREE.Vector3());
    // margin: the shapes are schematic, so allow an inch past the published envelope at each face; the propeller,
    // accessories, induction, exhaust and (on a turbocharged engine) the turbochargers are not part of this box.
    // Drawn: IO-390 26.4 × 17.1 × 32.0 in (envelope 32.56 × 22.19 × 34.37); TSIO-550-K 33.7 × 20.8 × 33.8 in
    // (envelope 39.2 × 34.0 × 42.4)
    const margin = 2 * IN;
    const e = S.geometry.envelopeIn;
    expect(size.x).toBeLessThanOrEqual(e.length * IN + margin);
    expect(size.y).toBeLessThanOrEqual(e.height * IN + margin);
    expect(size.z).toBeLessThanOrEqual(e.width * IN + margin);
  });

  test("the drawn crankpins follow the cycle model", () => {
    const crank = new THREE.Object3D(),
      throwG = new THREE.Object3D();
    crank.add(throwG);
    for (const c of S.geometry.cylinders)
      for (const a of [0, 37, 120, 400, 719]) {
        crank.rotation.x = (a % 360) * D2R;
        throwG.rotation.x = throwRotation(c);
        crank.updateMatrixWorld(true);
        const p = new THREE.Vector3(0, 0, d.r).applyMatrix4(throwG.matrixWorld);
        const want = rodEnds(S, c, a).pin;
        expect(p.y).toBeCloseTo(want.y, 9);
        expect(p.z).toBeCloseTo(want.z, 9);
      }
  });
});

describe("IO-390 scene layout defaults", () => {
  test("the IO-390 draws with today's constants", () => {
    expect(layoutFor(IO390)).toBe(IO390_DEFAULTS);
    const d = dims(IO390);
    expect({
      front: d.front,
      rear: d.rear,
      caseRear: d.caseRear,
      accRear: d.accRear,
      flangeX: d.flangeX,
      camY: d.camY,
      halfWidth: d.halfWidth,
      caseTop: d.caseTop,
      caseBottom: d.caseBottom,
      sumpBottom: d.sumpBottom,
      accBottom: d.accBottom,
      accTop: d.accTop,
      pulleyR: d.pulleyR,
    }).toEqual({
      front: 0.1 + 0.12,
      rear: -0.14 - 0.13,
      caseRear: -0.14 - 0.13,
      accRear: -0.14 - 0.13 - 0.05,
      flangeX: 0.1 + 0.12 + 0.1,
      camY: 0.12,
      halfWidth: (34.37 * IN) / 2,
      caseTop: 0.16,
      caseBottom: -0.11,
      sumpBottom: -0.2,
      accBottom: -0.13,
      accTop: 0.235,
      pulleyR: ((3.1 * IN) / 2) * 3.2,
    });
    const hp = headPoints(d, IO390_DEFAULTS);
    expect(hp.intakePort).toEqual([0.035, -0.1, d.deck + 0.07]);
    expect(hp.exhaustPort).toEqual([-0.035, -0.1, d.deck + 0.075]);
    expect(valveLayout(IO390_DEFAULTS)).toEqual({
      intake: { x: VT.xOff, pushY: VT.pushY, pivotY: VT.pivotY, tipY: VT.tipY },
      exhaust: { x: -VT.xOff, pushY: VT.pushY, pivotY: VT.pivotY, tipY: VT.tipY },
    });
    // counterweights on the cheeks either side of the centre main journal: cylinder 2's rear, cylinder 3's front
    const cl = crankLayout(IO390, d);
    expect(cl.cheek).toBe(0.025);
    expect(cl.counterweights.map((w) => [w.c.n, w.at])).toEqual([
      [2, -0.025],
      [3, 0.025],
    ]);
    expect(cl.bearings).toHaveLength(3);
    expect(IO390_DEFAULTS.camera).toEqual({ position: [1.15, 0.62, 1.35], target: [0, -0.02, 0], maxDistance: 6 });
    // the oil filler tube and cap on the right, where the scene drew them
    expect(IO390_DEFAULTS.oilFiller).toEqual({ side: "R" });
    expect(oilFiller(d).cap).toEqual([d.caseRear - 0.025, 0.209, 0.16]);
    // the label pins EngineScene placed before the layouts
    expect(IO390_DEFAULTS.labels(d, IO390)).toEqual([
      ["Magnetos", [d.accRear - 0.08, 0.22, 0]],
      ["Oil filter", [d.accRear - 0.12, -0.04, 0]],
      ["Fuel injector", [d.front + 0.02, d.sumpBottom - 0.1, 0]],
      ["Fuel manifold", [0, d.caseTop + 0.09, 0]],
      ["Starter", [d.flangeX - 0.02, -0.17, -0.22]],
      ["Alternator", [d.flangeX - 0.1, -0.27, 0.25]],
      ["Governor", [d.front + 0.04, 0.16, -0.07]],
    ]);
  });

  test("an engine without a layout draws on the defaults and labels its own fuel system (the O-360's carburetor)", () => {
    expect(layoutFor(O360)).toBe(IO390_DEFAULTS);
    const d = dims(O360);
    expect(IO390_DEFAULTS.labels(d, O360)).toEqual([
      ["Magnetos", [d.accRear - 0.08, 0.22, 0]],
      ["Oil filter", [d.accRear - 0.12, -0.04, 0]],
      ["Carburetor", [d.front + 0.02, d.sumpBottom - 0.13, 0]],
      ["Starter", [d.flangeX - 0.02, -0.17, -0.22]],
      ["Alternator", [d.flangeX - 0.1, -0.27, 0.25]],
      ["Governor", [d.front + 0.04, 0.16, -0.07]],
    ]);
  });
});

describe("the drawn sparks", () => {
  test.each([
    ["IO-390", IO390],
    ["O-360", O360],
  ] as const)("on the %s, where START fires the retard magneto alone, flash the plugs the model fires", (_, S) => {
    const switches: MagSwitch[] = ["OFF", "L", "R", "BOTH", "START"];
    for (const mags of switches)
      for (const [magL, magR, plug] of [
        [false, false, false],
        [true, false, false],
        [false, true, false],
        [false, false, true],
      ])
        for (const rpm of [0, 29, 30, 200, 2400]) {
          const f = { ...noFailures(S), magL, magR };
          f.plugs = f.plugs.map((p, i) => (i === 0 && plug ? [true, p[1]] : p));
          const drawn = drawnSparks(S, mags, f, rpm).map(([a, b]) => +a + +b);
          expect(drawn, `${mags} L${+magL} R${+magR} plug${+plug} ${rpm} rpm`).toEqual(sparks(S, mags, f, rpm));
        }
  });
});
