"use client";
/**
 * The systems hung on the engine: ignition (two magnetos and the harness to every plug), fuel injection (pump,
 * metering, manifold, lines to the nozzles), induction and exhaust, and the drives (starter, alternators, propeller
 * governor), plus the propeller. Where each sits and how it is driven come from the engine's layout; shapes are
 * schematic.
 */
import { useFrame } from "@react-three/fiber";
import { Fragment, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CylinderDef, EngineSpec } from "@/engines/types";
import type { EngineSim } from "../store";
import {
  bank,
  coil,
  D2R,
  driveLayout,
  gearSpins,
  egtColor,
  gear,
  headPoints,
  IN,
  magDrive,
  magnetoPose,
  magsAtStart,
  merge,
  rod,
  slab,
  STARTER_TEETH,
  toWorld,
  tube,
  zrod,
  type Dims,
  type Mats,
} from "./kit";
import { layoutFor, type EngineLayout } from "./layout";
import { P } from "./parts";

type V3 = [number, number, number];

/** The ignition's geometries: magneto bodies and drive gears in their magneto's frame, the harness in engine coordinates. */
export function ignitionGeometry(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const M = L.magnetos;
  const drive = magDrive(spec, d, L);
  const magZ = (side: "L" | "R") => (side === "R" ? drive.z : -drive.z);
  const hp = headPoints(d, L);
  const leads: THREE.BufferGeometry[] = [];
  if (M.mount === "forward") {
    // out of the cap's forward face: over the magnetos to the top plugs, and outboard, down behind the rear cylinders
    // and forward under them to the bottom plugs
    const capFront = d.accRear + M.len + 0.022;
    const cap = (m: "L" | "R", dy: number): V3 => [capFront, drive.y + dy, magZ(m)];
    spec.geometry.cylinders.forEach((c) => {
      const k = bank(c);
      const topMag = spec.ignition.topPlugMag[c.n];
      const botMag = topMag === "L" ? "R" : "L";
      const top = toWorld(c, hp.topLead),
        bot = toWorld(c, hp.botLead);
      leads.push(
        tube(
          [
            cap(topMag, 0.02),
            [capFront + 0.03, drive.y + M.r, magZ(topMag)],
            [top[0], drive.y + M.r + 0.015, k * 0.17],
            top,
          ],
          0.0042,
          40,
          8,
        ),
        tube(
          [
            cap(botMag, -0.02),
            [capFront + 0.025, drive.y - M.r + 0.01, k * 0.125],
            [d.caseRear - 0.01, 0.05, k * 0.175],
            [d.caseRear - 0.01, -0.13, k * 0.18],
            [bot[0], -0.16, k * 0.23],
            bot,
          ],
          0.0042,
          48,
          8,
        ),
      );
    });
    const p = magnetoPose(spec, d, "R", L);
    const I = drive.idler;
    return {
      body: rod(p.r, p.len, 24).translate(p.centre[0], 0, 0),
      flange: rod(p.r + 0.008, 0.008, 24).translate(p.driveEnd[0] + 0.004, 0, 0),
      cap: rod(p.r + 0.003, 0.022, 24).translate(p.capEnd[0] + 0.011, 0, 0),
      // drive gear behind the accessory face on the magneto's own axis, its coupling forward into the drive end
      gear: merge([
        gear(drive.r, drive.teeth, 0.01, 0.006).translate(drive.x, 0, 0),
        rod(0.007, p.driveEnd[0] - drive.x, 10).translate((drive.x + p.driveEnd[0]) / 2, 0, 0),
      ]),
      leads: merge(leads),
      // front gear on the crankshaft gear, rear gear on the magneto gears, one shaft through the accessory face
      idler: I
        ? merge([
            gear(I.r, I.teeth, 0.012, 0.01).translate(I.x, 0, 0),
            gear(I.rearR, I.rearTeeth, 0.012, 0.01).translate(I.rearX, 0, 0),
            rod(0.008, I.x - I.rearX, 10).translate((I.x + I.rearX) / 2, 0, 0),
          ])
        : null,
      // the accessory case over the gears behind the face, from the idler's rear gear to the magneto gears' tops
      cover: slab(
        drive.x - 0.012,
        d.accRear,
        (I ? I.y - I.rearR : drive.y - drive.r) - 0.008,
        drive.y + drive.r + 0.008,
        -(drive.z + drive.r + 0.008),
        drive.z + drive.r + 0.008,
        0.02,
      ),
    };
  }
  spec.geometry.cylinders.forEach((c) => {
    const k = bank(c);
    const topMag = spec.ignition.topPlugMag[c.n];
    const botMag = topMag === "L" ? "R" : "L";
    const cap = (m: "L" | "R", dy: number): V3 => [d.accRear - M.len - 0.02, drive.y + dy, magZ(m)];
    const top = toWorld(c, hp.topLead),
      bot = toWorld(c, hp.botLead);
    leads.push(
      tube(
        // up off the cap and forward over the magneto and the accessory housing
        [
          cap(topMag, 0.02),
          [d.accRear - M.len - 0.025, drive.y + 0.055, magZ(topMag)],
          [d.accRear - 0.04, 0.26, magZ(topMag)],
          [d.caseRear + 0.02, 0.25, k * 0.12],
          [top[0], 0.2, k * 0.17],
          top,
        ],
        0.0042,
        40,
        8,
      ),
      tube(
        [
          cap(botMag, -0.02),
          [d.accRear - 0.03, 0.04, k * 0.175],
          [d.caseRear + 0.03, -0.135, k * 0.18],
          [bot[0], -0.16, k * 0.23],
          bot,
        ],
        0.0042,
        48,
        8,
      ),
    );
  });
  return {
    body: rod(M.r, M.len, 24).translate(d.accRear - M.len / 2, 0, 0),
    flange: rod(M.r + 0.008, 0.008, 24).translate(d.accRear - 0.004, 0, 0),
    cap: rod(M.r + 0.003, 0.022, 24).translate(d.accRear - M.len - 0.009, 0, 0),
    // drive gear in the camshaft gear's plane, its shaft running aft to the magneto
    gear: merge([
      gear(drive.r, drive.teeth, 0.01, 0.006).translate(drive.x, 0, 0),
      rod(0.007, drive.x - d.accRear, 10).translate((drive.x + d.accRear) / 2, 0, 0),
    ]),
    leads: merge(leads),
    idler: drive.idler ? gear(drive.idler.r, drive.idler.teeth, 0.012, 0.01).translate(drive.x, 0, 0) : null,
    cover: null,
  };
}

/**
 * The magnetos, top left and right on their drive gears (`magDrive`, `magnetoPose`): on the rear of the accessory housing
 * with the caps aft, or (`magnetos.mount: "forward"`) lying forward over the crankcase with the caps and leads forward.
 */
export function Ignition({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const drive = useMemo(() => magDrive(spec, d, L), [spec, d, L]);
  const geo = useMemo(() => ignitionGeometry(spec, d, L), [spec, d, L]);
  useEffect(
    () => () =>
      Object.values(geo).forEach((g) => {
        if (g) g.dispose();
      }),
    [geo],
  );
  const gears = useRef<(THREE.Mesh | null)[]>([]);
  const idler = useRef<THREE.Mesh>(null);
  const { spins } = useMemo(() => gearSpins(spec, d, L), [spec, d, L]);
  useFrame(() => {
    // geared to the camshaft gear (−crank/2) or the idler, so with the crankshaft at the magneto drive ratio
    const a = ((sim.anim.crank * spins.magneto) % 360) * D2R;
    gears.current.forEach((g) => {
      if (!g) return;
      g.rotation.x = a + Math.PI / drive.teeth;
    });
    // the idler turns against the crankshaft gear, slower by their tooth ratio
    if (idler.current && drive.idler) idler.current.rotation.x = ((sim.anim.crank * spins.idler) % 360) * D2R;
  });
  const mags = spec.accessories.magnetos;
  // a retard-breaker magneto fires alone at START; with START firing both, neither is one
  const startMags = magsAtStart(spec);
  return (
    <>
      {(["L", "R"] as const).map((m, k) => {
        const retard = startMags.length === 1 && m === startMags[0];
        return (
          <group key={m} position={[0, ...magnetoPose(spec, d, m, L).centre.slice(1)] as V3}>
            <P
              name={`${m === "L" ? "Left" : "Right"} magneto${retard ? " (retard breaker)" : ""}`}
              note={
                L.notes.magneto
                  ? `${L.notes.magneto} ${mags}.`
                  : retard
                    ? `The retard-breaker magneto fires alone, late, during the start cycle (IOM p. 2). ${mags} (Table A-1).`
                    : `The plain magneto is grounded during the start cycle (IOM p. 2). ${mags} (Table A-1).`
              }
              geometry={geo.body}
              material={mats.mag}
            />
            <P name="Magneto mounting flange" geometry={geo.flange} material={mats.mag} />
            <P
              name="Magneto distributor cap"
              note={L.notes.magCap ?? "Leads to four plugs leave here: one in every cylinder."}
              geometry={geo.cap}
              material={mats.magCap}
            />
            <P
              name="Magneto drive gear"
              note={
                L.notes.magGear ??
                `Meshes with the camshaft gear: half as many teeth, so the magneto turns at crankshaft speed (magneto drive ratio ${spec.accessories.magnetoRatio}:1, Table A-1).`
              }
              geometry={geo.gear}
              material={mats.gear}
              meshRef={(g) => {
                gears.current[k] = g;
              }}
            />
          </group>
        );
      })}
      {geo.idler && (
        <group position={[0, drive.idler?.y ?? 0, 0]}>
          <P name="Idler gear" note={L.notes.idler} geometry={geo.idler} material={mats.gear} meshRef={idler} />
        </group>
      )}
      {geo.cover && (
        <P name="Magneto drive housing" note={L.notes.magDriveHousing} geometry={geo.cover} material={mats.acc} />
      )}
      <P
        name="Ignition harness"
        note={
          L.notes.harness ?? "All-weather shielded leads from each magneto to one plug in every cylinder (IOM p. 2)."
        }
        geometry={geo.leads}
        material={mats.lead}
      />
    </>
  );
}

/** Fuel injector: under the front of the sump, with the throttle body facing forward. */
const injectorAt = (d: Dims): V3 => [d.front - 0.03, d.sumpBottom - 0.035, 0];
const manifoldAt = (sim: EngineSim, d: Dims): V3 => {
  const xs = sim.spec.geometry.cylinders.map((c) => c.x);
  return [(Math.max(...xs) + Math.min(...xs)) / 2, d.caseTop + 0.035, 0];
};
const PUMP: V3 = [0, -0.06, -0.09]; // x from the accessory housing

/** Fuel metering, by the spec's `fuelSystem.kind`: the float carburetor, or injection. */
export function FuelSystem(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  if (p.sim.spec.fuelSystem.kind === "carburetor") return <CarburetorSystem {...p} />;
  return (
    <>
      <InjectedFuel {...p} />
      {layoutFor(p.sim.spec).fuel && <ContinentalFuel {...p} />}
    </>
  );
}

/**
 * Continental continuous-flow injection's parts outside the manifold valve and the nozzle lines: the engine-driven pump
 * on the crankshaft's axis at the rear with its mixture lever, the throttle and metering assembly on the throttle body,
 * the lines between them and on to the manifold valve, the vapour return, and the nozzles' air reference sleeves.
 */
export interface ContinentalFuelLayout {
  /** Pump body on the crankshaft axis: its forward and aft stations, radius. */
  pump: { x0: number; x1: number; r: number };
  /** Mixture lever on the pump's aft face: its length (m). */
  armLen: number;
  /** Throttle and metering assembly: centre and half sizes. */
  metering: { at: V3; half: V3 };
  /** Pump to metering assembly, metering assembly to the manifold valve, and the vapour return stub. */
  pumpLine: V3[];
  meteringLine: V3[];
  vaporReturn: V3[];
  notes: Record<"pump" | "mixtureArm" | "metering" | "pumpLine" | "meteringLine" | "vaporReturn" | "sleeve", string>;
}

/**
 * Mixture lever angle (rad) on the pump: 0 at idle cut-off to 90° at full rich (M-18 Figure 5-35 detail A); clamped to
 * the lever's travel.
 */
export const mixtureArmAngle = (mixture: number) => Math.min(1, Math.max(0, mixture)) * 90 * D2R;

/** The Continental fuel parts' geometries in engine coordinates (pure: tests measure them). */
export function continentalFuelGeometry(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const F = L.fuel!;
  const hp = headPoints(d, L);
  const [mx, my, mz] = F.metering.at;
  const [hx, hy, hz] = F.metering.half;
  return {
    pump: merge([
      rod(F.pump.r, F.pump.x0 - F.pump.x1, 24).translate((F.pump.x0 + F.pump.x1) / 2, 0, 0),
      // its mounting flange on the accessory case
      rod(F.pump.r + 0.0025, 0.006, 24).translate(F.pump.x0 - 0.003, 0, 0),
    ]),
    // the lever in its pivot's frame on the pump's aft face, along +y at cut-off
    arm: new THREE.BoxGeometry(0.006, F.armLen, 0.008).translate(0, F.armLen / 2, 0),
    armAt: [F.pump.x1 - 0.004, 0, 0] as V3,
    metering: slab(mx - hx, mx + hx, my - hy, my + hy, mz - hz, mz + hz, 0.006),
    lines: merge([tube(F.pumpLine, 0.0032, 96, 8), tube(F.meteringLine, 0.0032, 64, 8)]),
    vapor: tube(F.vaporReturn, 0.0032, 24, 8),
    // a sleeve round each nozzle, its air reference from the upper deck (M-18 12-5.3)
    sleeves: merge(
      spec.geometry.cylinders.map((c) => {
        const p = toWorld(c, [hp.nozzle[0], hp.nozzle[1] + 0.016, hp.nozzle[2]]);
        return new THREE.CylinderGeometry(0.0105, 0.0105, 0.006, 14).translate(...p);
      }),
    ),
  };
}

function ContinentalFuel({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const F = L.fuel!;
  const geo = useMemo(() => continentalFuelGeometry(spec, d, L), [spec, d, L]);
  useEffect(() => () => Object.values(geo).forEach((g) => g instanceof THREE.BufferGeometry && g.dispose()), [geo]);
  const arm = useRef<THREE.Group>(null);
  useFrame(() => {
    const ui = sim.useUi.getState();
    if (arm.current) arm.current.rotation.x = mixtureArmAngle(ui.controls.mixture);
  });
  const n = F.notes;
  return (
    <>
      <P name="Engine-driven fuel pump" note={n.pump} geometry={geo.pump} material={mats.fuelBody} />
      <group ref={arm} position={geo.armAt}>
        <P name="Mixture control lever" note={n.mixtureArm} geometry={geo.arm} material={mats.darkSteel} />
      </group>
      <P name="Throttle and metering assembly" note={n.metering} geometry={geo.metering} material={mats.fuelBody} />
      <P
        name="Fuel pump and metering lines"
        note={`${n.pumpLine} ${n.meteringLine}`}
        geometry={geo.lines}
        material={mats.fuel}
      />
      <P name="Fuel vapor return" note={n.vaporReturn} geometry={geo.vapor} material={mats.fuel} />
      <P name="Nozzle air reference sleeves" note={n.sleeve} geometry={geo.sleeves} material={mats.steel} />
    </>
  );
}

/**
 * Fuel injection. A servo injector draws the pump on the accessory housing, the injector and throttle body under the
 * sump, and the lines up to the manifold; every injected engine draws the manifold on top and a line to each nozzle
 * (a Continental engine's pump and metering parts are drawn by ContinentalFuel, for a layout with a fuel block).
 */
function InjectedFuel({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const unit = spec.fuelSystem.unit;
  const servo = spec.fuelSystem.kind === "injected";
  const geo = useMemo(() => {
    const hp = headPoints(d, L);
    const [ix, iy] = injectorAt(d);
    const m = manifoldAt(sim, d);
    const px = d.accRear - 0.03;
    const feed = !servo
      ? []
      : [
          // pump to injector
          tube(
            [
              [px, PUMP[1] - 0.035, PUMP[2]],
              [px + 0.005, -0.155, -0.11],
              [d.caseRear - 0.01, -0.17, -0.125],
              // under the intake runners
              [d.caseRear + 0.06, iy - 0.035, -0.11],
              [ix - 0.12, iy - 0.035, -0.09],
              [ix - 0.04, iy, -0.055],
            ],
            0.005,
          ),
          // injector to manifold, up the front right of the crankcase
          tube(
            [
              [ix, iy + 0.03, 0.04],
              [d.front + 0.012, -0.05, 0.11],
              [d.front + 0.006, 0.15, 0.07],
              // over the top of the case to the manifold
              [d.front - 0.03, 0.2, 0.03],
              [m[0] + 0.03, m[1] + 0.005, 0.015],
            ],
            0.005,
          ),
        ];
    const lines = [
      ...feed,
      // manifold to each nozzle
      ...spec.geometry.cylinders.map((c) => {
        const n = toWorld(c, hp.nozzleTop);
        return tube(
          [[m[0], m[1] + 0.01, 0], [n[0], m[1] + 0.005, bank(c) * 0.13], [n[0], n[1] + 0.03, n[2] * 0.92], n],
          0.0032,
          32,
          8,
        );
      }),
    ];
    return {
      injector: new THREE.BoxGeometry(0.09, 0.06, 0.1).translate(...injectorAt(d)),
      throttleBody: merge([
        new THREE.CylinderGeometry(0.036, 0.036, 0.06, 24, 1, true).rotateZ(Math.PI / 2).translate(ix + 0.075, iy, 0),
        rod(0.044, 0.006, 24).translate(ix + 0.105, iy, 0),
      ]),
      throttlePlate: rod(0.034, 0.003, 24),
      throttleArm: new THREE.BoxGeometry(0.008, 0.04, 0.006).translate(0, 0.02, 0.045),
      pump: merge([
        rod(0.036, 0.055, 24).translate(px, PUMP[1], PUMP[2]),
        rod(0.02, 0.02, 12).translate(px - 0.035, PUMP[1], PUMP[2]),
      ]),
      manifold: merge([
        new THREE.CylinderGeometry(0.022, 0.022, 0.03, 20).translate(...m),
        new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8).translate(m[0], m[1] - 0.03, m[2]),
      ]),
      lines: merge(lines),
    };
  }, [spec, sim, d, L, servo]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const plate = useRef<THREE.Group>(null);
  useFrame(() => {
    const ui = sim.useUi.getState();
    // the butterfly turns from nearly closed at idle to wide open
    if (plate.current) plate.current.rotation.z = (8 + 77 * ui.controls.throttle) * D2R;
    mats.fuel.emissiveIntensity = Math.min(1, sim.s.fuel / 60);
  });
  const [ix, iy] = injectorAt(d);
  return (
    <>
      {servo && (
        <>
          <P
            name="Fuel injector"
            note={`Meters fuel in proportion to the air through the throttle body: ${unit} (IOM p. 4, Table A-1).`}
            geometry={geo.injector}
            material={mats.fuelBody}
          />
          <P
            name="Throttle body"
            note="Air enters here; the throttle valve inside follows the throttle lever."
            geometry={geo.throttleBody}
            material={mats.fuelBody}
          />
          <group ref={plate} position={[ix + 0.075, iy, 0]}>
            <P
              name="Throttle valve"
              note="Butterfly valve: its angle follows the panel's throttle."
              geometry={geo.throttlePlate}
              material={mats.steel}
            />
            <P name="Throttle arm" geometry={geo.throttleArm} material={mats.darkSteel} />
          </group>
          <P
            name="Engine-driven fuel pump"
            note="Diaphragm-type pump on the accessory housing; feeds the fuel injector (IOM p. 4)."
            geometry={geo.pump}
            material={mats.fuelBody}
          />
        </>
      )}
      <P
        name="Fuel manifold"
        note={L.notes.fuelManifold ?? "Divides the injector's metered fuel among the four nozzle lines (IOM p. 4)."}
        geometry={geo.manifold}
        material={mats.fuelBody}
      />
      <P
        name="Fuel lines"
        note={
          L.notes.fuelLines ??
          "Pump to injector, injector to manifold, manifold to the four nozzles (IOM p. 4). They glow with fuel flow."
        }
        geometry={geo.lines}
        material={mats.fuel}
      />
    </>
  );
}

/**
 * Float carburetor on its pad under the sump (OM p. 1-2): the float bowl, an updraft bore with the throttle valve, the
 * mixture arm, and below it the air box whose valve picks filtered ram air or heated air (carburetor heat). The
 * engine-driven pump feeds the bowl. Shapes and sizes are schematic.
 */
function CarburetorSystem({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const carb = spec.fuelSystem.kind === "carburetor" ? spec.fuelSystem : null;
  const [ix, iy] = injectorAt(d);
  const bowlX = ix + 0.07;
  const geo = useMemo(() => {
    const px = d.accRear - 0.03;
    return {
      bore: merge([
        new THREE.CylinderGeometry(0.032, 0.032, 0.06, 24, 1, true).translate(ix, iy - 0.005, 0),
        new THREE.CylinderGeometry(0.044, 0.044, 0.006, 24).translate(ix, iy + 0.025, 0),
      ]),
      bowl: new THREE.BoxGeometry(0.08, 0.075, 0.085).translate(bowlX, iy - 0.012, 0),
      throttlePlate: rod(0.03, 0.003, 24).rotateZ(Math.PI / 2),
      arm: new THREE.BoxGeometry(0.008, 0.006, 0.04).translate(0, 0, 0.02),
      airbox: merge([
        new THREE.BoxGeometry(0.1, 0.05, 0.1).translate(ix, iy - 0.06, 0),
        rod(0.028, 0.06, 20).translate(ix + 0.08, iy - 0.06, 0),
        new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16).rotateX(Math.PI / 2).translate(ix - 0.02, iy - 0.06, 0.07),
      ]),
      flapper: new THREE.BoxGeometry(0.003, 0.044, 0.09),
      pump: merge([
        rod(0.036, 0.055, 24).translate(px, PUMP[1], PUMP[2]),
        rod(0.02, 0.02, 12).translate(px - 0.035, PUMP[1], PUMP[2]),
      ]),
      lines: tube(
        [
          [px, PUMP[1] - 0.035, PUMP[2]],
          [px + 0.005, -0.155, -0.11],
          [d.caseRear - 0.01, -0.17, -0.125],
          // under the intake pipes
          [d.caseRear + 0.06, iy - 0.035, -0.11],
          [bowlX - 0.08, iy - 0.035, -0.09],
          [bowlX, iy, -0.045],
        ],
        0.005,
      ),
    };
  }, [d, ix, iy, bowlX]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const plate = useRef<THREE.Group>(null),
    mix = useRef<THREE.Group>(null),
    flap = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = sim.useUi.getState().controls;
    if (plate.current) plate.current.rotation.z = (8 + 77 * c.throttle) * D2R;
    if (mix.current) mix.current.rotation.y = (-40 + 80 * c.mixture) * D2R;
    // the valve swings from closing the hot-air duct (cold) to closing the ram-air inlet (hot)
    if (flap.current) flap.current.rotation.z = (-35 + 70 * c.carbHeat) * D2R;
    mats.fuel.emissiveIntensity = Math.min(1, sim.s.fuel / 60);
  });
  const psi = carb ? `${carb.inletPsi.min}–${carb.inletPsi.max} psi` : "";
  return (
    <>
      <P
        name="Carburetor float bowl"
        note={`${spec.fuelSystem.unit}: single-barrel float type with manual mixture control and idle cut-off (OM p. 1-2). A float valve keeps the bowl full; the venturi's suction draws fuel through the main jet in proportion to the air.`}
        geometry={geo.bowl}
        material={mats.fuelBody}
      />
      <P
        name="Carburetor throttle body"
        note="Updraft bore: air enters from below, through the venturi and past the throttle valve, into the intake riser in the sump (OM p. 1-2)."
        geometry={geo.bore}
        material={mats.fuelBody}
      />
      <group ref={plate} position={[ix, iy - 0.005, 0]}>
        <P
          name="Throttle valve"
          note="Butterfly valve: its angle follows the panel's throttle. Ice forms around it first (OM p. 3-8)."
          geometry={geo.throttlePlate}
          material={mats.steel}
        />
      </group>
      <group ref={mix} position={[bowlX + 0.04, iy - 0.03, 0.03]}>
        <P
          name="Mixture control arm"
          note="Manual mixture: full rich to idle cut-off, which stops all fuel (OM p. 1-2)."
          geometry={geo.arm}
          material={mats.darkSteel}
        />
      </group>
      <P
        name="Air box"
        note="Part of the airframe: filtered ram air comes in at the front, air heated by a jacket around the exhaust at the side (OM p. 3-9). On some installations the heated air bypasses the filter (p. 3-9), as it does in this model."
        geometry={geo.airbox}
        material={mats.intake}
      />
      <group ref={flap} position={[ix, iy - 0.06, 0]}>
        <P
          name="Carburetor heat valve"
          note="Follows the panel's carburetor heat: cold takes filtered ram air, hot takes air warmed around the exhaust (OM pp. 3-8–3-9)."
          geometry={geo.flapper}
          material={mats.steel}
        />
      </group>
      <P
        name="Engine-driven fuel pump"
        note={`On the accessory housing; feeds the carburetor's float bowl, which wants ${psi} at its inlet (OM p. 3-10).`}
        geometry={geo.pump}
        material={mats.fuelBody}
      />
      <P
        name="Fuel line"
        note="Pump to the carburetor's float bowl. It glows with fuel flow."
        geometry={geo.lines}
        material={mats.fuel}
      />
    </>
  );
}

/**
 * Induction and exhaust under the engine; or, for a layout with its intake ports on top, the downdraft induction its
 * layout's `induction` block lays out (the exhaust is then its own group, scene/Exhaust.tsx).
 */
export function Induction(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(p.sim.spec);
  if (L.ports.intake !== "top") return <UnderInduction {...p} />;
  return L.induction ? <TopInduction {...p} /> : null;
}

/** Downdraft induction: from the air boxes through the turbochargers and intercoolers to the runners on the heads. */
export interface TopInductionLayout {
  /** Air box with its filter on each compressor inlet: its length forward of the inlet face and half its height, width. */
  airBox: { len: number; halfY: number; halfZ: number };
  /** Alternate air assembly: an inlet tube across the front (its axis fore and aft), the door at its forward mouth. */
  altAir: { at: V3; len: number; r: number };
  /** Tubes from the alternate air assembly to each air box. Left, then right. */
  altTubes: [V3[], V3[]];
  /** Ducts from each compressor outlet up to its intercooler's inlet. Left, then right. */
  compressorDucts: [V3[], V3[]];
  /** Ducts from each intercooler outlet to the Y junction. Left, then right. */
  outletDucts: [V3[], V3[]];
  /** Duct and runner radii. */
  r: { duct: number; altTube: number; runner: number };
  /** Y junction: a cross tube centred here, across the engine. */
  y: { at: V3; halfZ: number; r: number };
  /** Throttle body behind the Y (its aft and forward ends along x, on the Y's axis) and the butterfly's station. */
  throttle: { x0: number; x1: number; r: number; plateX: number };
  /** Induction manifold (plenum) along the top centre: aft end to the throttle body, axis height, radius. */
  plenum: { x0: number; y: number; r: number };
  /** Each runner's waypoints between the plenum and its intake port: heights and side offsets (|z|), plenum first. */
  runnerVia: { y: number; z: number }[];
  /** Upper-deck pressure fitting on the throttle body inlet, MAP port on the manifold, and their lines aft to the
   * wastegate controller's bulkhead fittings. */
  deck: V3;
  map: V3;
  deckLine: V3[];
  mapLine: V3[];
  notes: Record<
    | "airBox"
    | "filter"
    | "altAir"
    | "altDoor"
    | "altTube"
    | "compressorDuct"
    | "outletDuct"
    | "y"
    | "throttleBody"
    | "throttlePlate"
    | "deck"
    | "map"
    | "deckLine"
    | "mapLine"
    | "plenum"
    | "runner",
    string
  >;
}

/** Alternate air door angle (rad) for the model's `altAirOpen`: shut, or swung in by suction (illustrative, 70°). */
export const altAirDoorAngle = (open: boolean) => (open ? 70 * D2R : 0);

/** One cylinder's runner: from the plenum out along the layout's waypoints and down onto its intake port. */
export function runnerPoints(c: CylinderDef, d: Dims, L: EngineLayout, I: TopInductionLayout): V3[] {
  const p = toWorld(c, headPoints(d, L).intakePort);
  const k = bank(c);
  return [...I.runnerVia.map((v): V3 => [p[0], v.y, k * v.z]), [p[0], p[1] + 0.03, p[2]], [p[0], p[1] + 0.008, p[2]]];
}

/** The downdraft induction's geometries in engine coordinates (pure: tests measure them). */
export function inductionGeometry(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const I = L.induction!;
  const T = L.turbo!;
  const xrod = (r: number, x0: number, x1: number, y: number, z: number, segs = 24) =>
    rod(r, Math.abs(x1 - x0), segs).translate((x0 + x1) / 2, y, z);
  const boxes = T.sides.map((t) => {
    const x0 = t.x.inletFace + 0.004,
      x1 = x0 + I.airBox.len;
    return {
      box: slab(
        x0,
        x1 - 0.008,
        t.y - I.airBox.halfY,
        t.y + I.airBox.halfY,
        t.z - I.airBox.halfZ,
        t.z + I.airBox.halfZ,
        0.01,
      ),
      // the filter element across the box's forward face, where the cowl's inlet air arrives
      filter: slab(
        x1 - 0.008,
        x1,
        t.y - I.airBox.halfY + 0.006,
        t.y + I.airBox.halfY - 0.006,
        t.z - I.airBox.halfZ + 0.006,
        t.z + I.airBox.halfZ - 0.006,
        0.004,
      ),
    };
  });
  const A = I.altAir;
  const [ax, ay, az] = A.at;
  const yA = I.y;
  const th = I.throttle;
  return {
    airBoxes: merge(boxes.map((b) => b.box)),
    filters: merge(boxes.map((b) => b.filter)),
    altAir: new THREE.CylinderGeometry(A.r, A.r, A.len, 24, 1, true)
      .rotateZ(Math.PI / 2)
      .translate(ax - A.len / 2, ay, az),
    // the door across the mouth, drawn in its hinge's frame (the hinge along its top edge)
    altDoor: rod(A.r * 0.95, 0.003, 24).translate(0, -A.r * 0.95, 0),
    altDoorHinge: [ax + 0.002, ay + A.r * 0.95, az] as V3,
    altTubes: merge(I.altTubes.map((pts) => tube(pts, I.r.altTube, 32, 10))),
    compressorDucts: merge(I.compressorDucts.map((pts) => tube(pts, I.r.duct, 48, 12))),
    outletDucts: merge(I.outletDucts.map((pts) => tube(pts, I.r.duct, 48, 12))),
    y: zrod(yA.r, -yA.halfZ, yA.halfZ, 24).translate(yA.at[0], yA.at[1], yA.at[2]),
    throttleBody: merge([
      xrod(th.r, th.x0, th.x1, yA.at[1], yA.at[2]),
      xrod(th.r + 0.004, th.x1 - 0.006, th.x1, yA.at[1], yA.at[2]),
    ]),
    throttlePlate: rod(th.r * 0.92, 0.003, 24),
    throttlePlateAt: [th.plateX, yA.at[1], yA.at[2]] as V3,
    plenum: xrod(I.plenum.r, I.plenum.x0, th.x0, I.plenum.y, 0),
    runners: merge(spec.geometry.cylinders.map((c) => tube(runnerPoints(c, d, L, I), I.r.runner, 40, 12))),
    fittings: merge(
      [I.deck, I.map].map(([x, y, z]) => new THREE.CylinderGeometry(0.005, 0.006, 0.014, 10).translate(x, y, z)),
    ),
    deckLine: tube(I.deckLine, 0.003, 96, 8),
    mapLine: tube(I.mapLine, 0.003, 96, 8),
  };
}

function TopInduction({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const I = L.induction!;
  const geo = useMemo(() => inductionGeometry(spec, d, L), [spec, d, L]);
  useEffect(() => () => Object.values(geo).forEach((g) => g instanceof THREE.BufferGeometry && g.dispose()), [geo]);
  const plate = useRef<THREE.Group>(null),
    door = useRef<THREE.Group>(null);
  useFrame(() => {
    const ui = sim.useUi.getState();
    // the butterfly turns from nearly closed at idle to wide open
    if (plate.current) plate.current.rotation.z = (8 + 77 * ui.controls.throttle) * D2R;
    // suction swings the door in (aft) about its top hinge
    if (door.current) door.current.rotation.z = -altAirDoorAngle(!!sim.s.altAirOpen);
  });
  const n = I.notes;
  return (
    <>
      <P name="Air box" note={n.airBox} geometry={geo.airBoxes} material={mats.intake} />
      <P name="Induction air filter" note={n.filter} geometry={geo.filters} material={mats.filter} />
      <P name="Alternate air assembly" note={n.altAir} geometry={geo.altAir} material={mats.intake} />
      <group ref={door} position={geo.altDoorHinge}>
        <P name="Alternate air door" note={n.altDoor} geometry={geo.altDoor} material={mats.darkSteel} />
      </group>
      <P name="Alternate air tube" note={n.altTube} geometry={geo.altTubes} material={mats.intake} />
      <P
        name="Compressor discharge duct"
        note={n.compressorDuct}
        geometry={geo.compressorDucts}
        material={mats.intake}
      />
      <P name="Intercooler outlet duct" note={n.outletDuct} geometry={geo.outletDucts} material={mats.intake} />
      <P name="Y junction" note={n.y} geometry={geo.y} material={mats.intake} />
      <P name="Throttle body" note={n.throttleBody} geometry={geo.throttleBody} material={mats.fuelBody} />
      <group ref={plate} position={geo.throttlePlateAt}>
        <P name="Throttle valve" note={n.throttlePlate} geometry={geo.throttlePlate} material={mats.steel} />
      </group>
      <P name="Induction manifold" note={n.plenum} geometry={geo.plenum} material={mats.intake} />
      <P name="Intake pipes" note={n.runner} geometry={geo.runners} material={mats.intake} />
      <P
        name="Deck pressure and MAP fittings"
        note={`${n.deck} ${n.map}`}
        geometry={geo.fittings}
        material={mats.steel}
      />
      <P name="Deck pressure line" note={n.deckLine} geometry={geo.deckLine} material={mats.darkSteel} />
      <P name="Manifold pressure line" note={n.mapLine} geometry={geo.mapLine} material={mats.darkSteel} />
    </>
  );
}

/** Tuned induction: a plenum under the sump from the throttle body, a runner up to each intake port; down exhaust. */
function UnderInduction({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const cyls = spec.geometry.cylinders;
  const geo = useMemo(() => {
    const hp = headPoints(d);
    const [ix, iy] = injectorAt(d);
    const x0 = ix - 0.045,
      x1 = d.caseRear + 0.04;
    const runners = cyls.map((c) => {
      const k = bank(c);
      const p = toWorld(c, hp.intakePort);
      return tube(
        [
          [p[0], iy, 0],
          [p[0], iy + 0.01, k * 0.11],
          [p[0], -0.19, k * (Math.abs(p[2]) - 0.05)],
          [p[0], -0.13, p[2]],
          [p[0], p[1] - 0.006, p[2]],
        ],
        0.016,
        40,
        12,
      );
    });
    const sideY = -0.3,
      sideZ = 0.24;
    const pipes = cyls.map((c) => {
      const k = bank(c);
      const p = toWorld(c, hp.exhaustPort);
      return tube(
        [
          [p[0], p[1] - 0.006, p[2]],
          [p[0], -0.17, p[2] - k * 0.005],
          [p[0] - 0.02, -0.26, k * (sideZ + 0.04)],
          [p[0] - 0.06, sideY, k * sideZ],
        ],
        0.017,
        32,
        12,
      );
    });
    const xs = cyls.map((c) => c.x);
    const collectors = ([1, -1] as const).map((k) =>
      tube(
        [
          [Math.max(...xs) + 0.0, sideY, k * sideZ],
          [Math.min(...xs) - 0.06, sideY - 0.005, k * sideZ],
          [d.rear - 0.1, sideY - 0.03, k * (sideZ - 0.03)],
          [d.rear - 0.18, sideY - 0.1, k * (sideZ - 0.05)],
        ],
        0.024,
        40,
        14,
      ),
    );
    return {
      plenum: rod(0.03, x0 - x1, 24).translate((x0 + x1) / 2, iy, 0),
      runners: merge(runners),
      pipes,
      collectors,
    };
  }, [cyls, d]);
  const exMats = useMemo(
    () =>
      cyls.map(
        () => new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.55, metalness: 0.5, emissive: "#000" }),
      ),
    [cyls],
  );
  const colMats = useMemo(
    () =>
      [0, 1].map(
        () => new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.55, metalness: 0.5, emissive: "#000" }),
      ),
    [],
  );
  useEffect(
    () => () => {
      geo.plenum.dispose();
      geo.runners.dispose();
      [...geo.pipes, ...geo.collectors].forEach((g) => g.dispose());
      [...exMats, ...colMats].forEach((m) => m.dispose());
    },
    [geo, exMats, colMats],
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const paint = (m: THREE.MeshStandardMaterial, egt: number) => {
      egtColor(egt, tmp);
      m.color.copy(tmp);
      m.emissive.copy(tmp);
      m.emissiveIntensity = Math.max(0, (egt - 900) / 900);
    };
    const egt = (i: number) => sim.s.cyl[i]?.egt ?? 60;
    cyls.forEach((_, i) => paint(exMats[i], egt(i)));
    ([1, -1] as const).forEach((k, j) => {
      const on = cyls.map((c, i) => [c, i] as [CylinderDef, number]).filter(([c]) => bank(c) === k);
      paint(colMats[j], on.reduce((a, [, i]) => a + egt(i), 0) / Math.max(1, on.length));
    });
  });
  return (
    <>
      <P
        name="Induction plenum"
        note="Carries air from the throttle body to the runners."
        geometry={geo.plenum}
        material={mats.intake}
      />
      <P
        name="Tuned induction runners"
        note="One runner to each cylinder's intake port (IOM p. 1: tuned induction)."
        geometry={geo.runners}
        material={mats.intake}
      />
      {geo.pipes.map((g, i) => (
        <P
          key={i}
          name={`Exhaust pipe, cylinder ${cyls[i].n}`}
          note="Down exhaust (IOM p. 1); the pipe glows with this cylinder's exhaust gas temperature."
          geometry={g}
          material={exMats[i]}
        />
      ))}
      {geo.collectors.map((g, j) => (
        <P
          key={j}
          name="Exhaust collector"
          note="Airframe exhaust: drawn to show where the gas goes."
          geometry={g}
          material={colMats[j]}
        />
      ))}
    </>
  );
}

/** How far the starter pinion slides to mesh, and how far in it starts to engage the ring gear's teeth (m). */
const PINION_TRAVEL = 0.022,
  PINION_MESH = 0.012;

type RearStarter = Extract<ReturnType<typeof driveLayout>["starter"], { kind: "rear-adapter" }>;

/**
 * The right-angle starter adapter's housing (AMM 80-10; M-18 Figure 16-17 item 1), in engine coordinates: a mounting
 * flange on the accessory face, the wheel case around the starter shaft back to the cover the scavenge pump bolts to,
 * and the boss around the worm out to the motor's face. Its shape follows M-18 Figures D-3 and D-18; the sizes are
 * drawn (FIT): the case 0.28 in outside the worm wheel, the cover 2.30 in aft of the accessory face.
 */
export function starterAdapter(st: RearStarter, d: Dims) {
  return {
    /** Starter shaft axis (y, z): the wheel case's and the cover's axis. */
    y: st.shaft.y,
    z: st.shaft.z,
    flangeR: 1.9 * IN,
    flangeX: d.accRear - 0.25 * IN,
    caseR: 1.85 * IN,
    /** The cover's aft face. */
    coverX: d.accRear - 2.3 * IN,
    /** Worm boss: its axis height and station, radius, and inboard end (just past the worm's bearing). */
    bossY: st.worm.at[1],
    bossX: st.wheel.x,
    bossR: 0.75 * IN,
    bossZ0: st.worm.at[2] - 0.046,
    /** The motor's mounting face, where the boss ends. */
    bossZ1: st.at[2],
    faceX: d.accRear,
  };
}

const starterAdapterGeometry = (a: ReturnType<typeof starterAdapter>) =>
  merge([
    rod(a.flangeR, a.faceX - a.flangeX, 32).translate((a.faceX + a.flangeX) / 2, a.y, a.z),
    rod(a.caseR, a.faceX - a.coverX, 32).translate((a.faceX + a.coverX) / 2, a.y, a.z),
    zrod(a.bossR, a.bossZ0, a.bossZ1, 20).translate(a.bossX, a.bossY, 0),
  ]);

/** The clutch spring's tint while it grips the starter shaft gear (engaged) and when it lets go: illustrative. */
export const clutchGrip = (engaged: boolean) => (engaged ? 0.9 : 0);

/** The drives' geometries, each in its part's own frame (`driveLayout` places them). */
export function drivesGeometry(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const D = driveLayout(spec, d, L);
  // belt: the hull of the two pulleys, in the plane of the crankshaft pulley
  const beltGeometry = (x: number, ay: number, az: number) => {
    const beltShape = (r1: number, r2: number) => {
      // shape coordinates: x = −z, y = y (the extrusion is turned to run along +x)
      const cx = -az,
        cy = ay;
      const D = Math.hypot(cx, cy),
        phi = Math.atan2(cy, cx),
        beta = Math.acos((r1 - r2) / D);
      const p = new THREE.Path();
      p.absarc(0, 0, r1, phi + beta, phi - beta + Math.PI * 2, false);
      p.absarc(cx, cy, r2, phi - beta, phi + beta, false);
      p.closePath();
      return p;
    };
    const outer = new THREE.Shape(beltShape(d.pulleyR + 0.005, d.altPulleyR + 0.005).getPoints(48));
    outer.holes.push(beltShape(d.pulleyR - 0.001, d.altPulleyR - 0.001));
    return new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: false, curveSegments: 24 })
      .translate(0, 0, -0.006)
      .rotateY(Math.PI / 2)
      .translate(x, 0, 0);
  };
  const st = D.starter;
  const starter =
    st.kind === "front-ring"
      ? {
          kind: st.kind,
          // ends just forward of the crankcase
          motor: rod(0.04, 0.045, 24).translate(-0.0425, 0, 0),
          solenoid: rod(0.017, 0.045, 14).translate(-0.04, 0.045, 0),
          drive: rod(0.022, 0.025, 16).translate(-0.016, 0, 0),
          pinion: gear(st.pinionR, STARTER_TEETH.pinion, 0.012, 0),
        }
      : {
          // motor across the engine on the worm's axis; the worm, the wheel and the shaft down to the shaft gear
          kind: st.kind,
          motor: zrod(0.04, 0, 0.1, 24),
          solenoid: zrod(0.017, 0.01, 0.055, 14).translate(0, 0.045, 0),
          worm: merge([zrod(st.worm.r, -0.03, 0.03, 12), ...[-1, 1].map((k) => zrod(0.007, k * 0.04, k * 0.03, 8))]),
          wheel: gear(st.wheel.r, st.wheel.teeth, 0.01, 0.008),
          shaftGear: gear(st.shaft.r, st.shaft.teeth, 0.012, 0.008),
          shaft: rod(0.008, st.shaft.x - st.wheel.x, 10).translate((st.shaft.x + st.wheel.x) / 2, 0, 0),
          // the clutch spring on the worm wheel's hub, forward of the wheel (M-18 Figure 16-17 item 17), in the
          // shaft's frame
          clutch: coil(0.014, 0.0016, st.wheel.x + 0.006, st.wheel.x + 0.03, 7).rotateY(Math.PI / 2),
          adapter: starterAdapterGeometry(starterAdapter(st, d)),
        };
  const alternators = D.alternators.map((a) => {
    // the default is short enough to stay forward of the IO-390's cylinder 1 intake pipe
    const len = a.def.bodyLen ?? 0.08;
    const t = a.transverse;
    if (t && a.gear) {
      // across the engine, in its own frame (+z outboard along the shaft): the housing from the pad face to the end
      // face, the drive pad on the crankcase side, the shaft in to the bevel pinion (drawn in the pinion's frame) and
      // the terminal block on the end face
      const [pad, end] = [t.padAt, t.endAt].map((p) => Math.hypot(p[1], p[2]));
      const pin = Math.hypot(a.at[1], a.at[2]);
      return {
        body: merge([
          zrod(t.r, pad, end, 32),
          new THREE.BoxGeometry(0.035, 0.035, 0.012).translate(0, 0.03, end + 0.006),
        ]),
        pad: zrod(0.04, d.caseHalf, pad, 24),
        shaft: zrod(0.008, pin + 0.006, pad, 10),
        wheel: gear(a.gear.drivenR, a.gear.drivenTeeth, 0.012, 0),
        belt: null,
      };
    }
    return a.gear
      ? {
          // the body runs forward of its gear, on the front of the crankcase
          body: merge([
            rod(0.055, len, 28).translate(len / 2 + 0.02, 0, 0),
            rod(0.045, 0.012, 28).translate(0.016, 0, 0),
          ]),
          wheel: gear(a.gear.drivenR, a.gear.drivenTeeth, 0.012, 0),
          belt: null,
          pad: null,
          shaft: null,
        }
      : {
          body: merge([
            rod(0.06, len, 28).translate(-(len / 2 + 0.02), 0, 0),
            rod(0.05, 0.012, 28).translate(-0.016, 0, 0),
          ]),
          wheel: merge([gear(d.altPulleyR, 16, 0.016, 0), rod(0.012, 0.03, 10).translate(-0.012, 0, 0)]),
          belt: beltGeometry(a.x, a.at[1], a.at[2]),
          pad: null,
          shaft: null,
        };
  });
  const gv = D.governor;
  return {
    starter,
    alternators,
    gov: merge([
      rod(0.032, 0.035, 22).translate(0.0475, 0, 0),
      rod(0.04, 0.008, 22).translate(0.034, 0, 0),
      rod(0.012, 0.03, 10).translate(0.079, 0, 0),
    ]),
    govGear: gear(gv.govR, gv.teeth, 0.012, 0.004),
    govShaft: gv.gearAt ? zrod(0.006, gv.at[2], gv.gearAt[2], 10).translate(gv.at[0], gv.at[1], 0) : null,
  };
}

/**
 * The drives, placed by `driveLayout`: the starter (front lower left, its pinion on the ring gear; or on a right-angle
 * adapter at the rear, a worm turning the shaft gear on the crankshaft gear), the alternators (on a belt from the
 * crankshaft pulley, or geared to a drive gear on the crankshaft) and the propeller governor (front top on the
 * camshaft's spur gear, or lower left on its bevel gear).
 */
export function Drives({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const acc = spec.accessories;
  const L = layoutFor(spec);
  const D = useMemo(() => driveLayout(spec, d, L), [spec, d, L]);
  const { spins } = useMemo(() => gearSpins(spec, d, L), [spec, d, L]);
  const geo = useMemo(() => drivesGeometry(spec, d, L), [spec, d, L]);
  useEffect(
    () => () => {
      const all = [
        ...Object.values(geo.starter).filter((g) => g instanceof THREE.BufferGeometry),
        ...geo.alternators.flatMap((a) => [a.body, a.wheel, a.belt, a.pad, a.shaft]),
        geo.gov,
        geo.govGear,
        geo.govShaft,
      ];
      all.forEach((g) => g?.dispose());
    },
    [geo],
  );
  // the clutch spring glows while it grips (its own material, so the tint stays on it)
  const clutchMat = useMemo(() => {
    const m = mats.spring.clone();
    m.emissive.set("#ffb347");
    m.emissiveIntensity = 0;
    return m;
  }, [mats]);
  useEffect(() => () => clutchMat.dispose(), [clutchMat]);
  const pinion = useRef<THREE.Group>(null),
    worm = useRef<THREE.Mesh>(null),
    wheel = useRef<THREE.Mesh>(null),
    shaftGear = useRef<THREE.Mesh>(null),
    altRot = useRef<(THREE.Mesh | null)[]>([]),
    govRot = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const crank = sim.anim.crank;
    const p = pinion.current;
    if (p) {
      // the solenoid slides the pinion forward into the ring gear while the starter is engaged, and back out of mesh
      // when it lets go; only in mesh does it turn, geared to the crankshaft
      const target = sim.s.starterEngaged ? 0 : -PINION_TRAVEL;
      p.position.x += (target - p.position.x) * 0.3;
      if (Math.abs(p.position.x - target) < 1e-4) p.position.x = target;
      if (p.position.x > -PINION_MESH) p.rotation.x = ((crank * spins.pinion) % 360) * D2R;
    }
    // the shaft gear turns against the crankshaft gear; the spring clutch couples the wheel (and the worm) only while
    // the starter is engaged
    const shaftA = ((crank * (spins.starterShaft ?? 0)) % 360) * D2R;
    if (shaftGear.current) shaftGear.current.rotation.x = shaftA;
    clutchMat.emissiveIntensity = clutchGrip(sim.s.starterEngaged);
    if (sim.s.starterEngaged) {
      if (wheel.current) wheel.current.rotation.x = shaftA;
      if (worm.current) worm.current.rotation.z = ((crank * acc.starterRatio) % 360) * D2R;
    }
    D.alternators.forEach((a, k) => {
      const m = altRot.current[k];
      // a belt turns the pulley with the crankshaft; meshed gears turn it the other way
      if (m) m.rotation.x = ((crank * spins[a.def.name]) % 360) * D2R;
    });
    if (govRot.current) govRot.current.rotation.x = ((crank * spins.governor) % 360) * D2R;
  });
  const st = D.starter,
    gv = D.governor;
  const sg = geo.starter;
  return (
    <>
      {st.kind === "front-ring" && sg.kind === "front-ring" ? (
        <group position={st.at}>
          <P
            name="Starter"
            note={`12 V or 24 V starter (IOM p. 3); drive ratio ${acc.starterRatio}:1 (Table A-1). Engaged while the switch is held at START.`}
            geometry={sg.motor}
            material={mats.black}
          />
          <P name="Starter solenoid" geometry={sg.solenoid} material={mats.black} />
          <P name="Starter drive housing" geometry={sg.drive} material={mats.alt} />
          <group ref={pinion} position={[-PINION_TRAVEL, 0, 0]}>
            <P
              name="Starter pinion"
              note="The solenoid slides it into mesh with the ring gear while the starter is engaged and withdraws it on release; out of mesh it stands still while the ring gear turns."
              geometry={sg.pinion}
              material={mats.gear}
            />
          </group>
        </group>
      ) : st.kind === "rear-adapter" && sg.kind === "rear-adapter" ? (
        <>
          <group position={st.at}>
            <P name="Starter" note={L.notes.starter} geometry={sg.motor} material={mats.black} />
            <P name="Starter solenoid" geometry={sg.solenoid} material={mats.black} />
          </group>
          <P name="Starter adapter" note={L.notes.starterAdapter} geometry={sg.adapter} material={mats.acc} />
          <P
            name="Starter worm"
            note={L.notes.starterWorm}
            geometry={sg.worm}
            material={mats.steel}
            position={st.worm.at}
            meshRef={worm}
          />
          <group position={[0, st.shaft.y, st.shaft.z]}>
            <P
              name="Starter worm wheel"
              note={L.notes.starterWorm}
              geometry={sg.wheel}
              material={mats.gear}
              position={[st.wheel.x, 0, 0]}
              meshRef={wheel}
            />
            <P name="Starter shaft" geometry={sg.shaft} material={mats.steel} />
            <P name="Starter clutch spring" note={L.notes.clutchSpring} geometry={sg.clutch} material={clutchMat} />
            <P
              name="Starter shaft gear"
              note={L.notes.starterShaftGear}
              geometry={sg.shaftGear}
              material={mats.gear}
              position={[st.shaft.x, 0, 0]}
              meshRef={shaftGear}
            />
          </group>
        </>
      ) : null}
      {D.alternators.map((a, k) => {
        const g = geo.alternators[k];
        if (a.transverse)
          // turned about the crankshaft so its +z runs out along the shaft; the pinion's frame turns +x onto it
          return (
            <group key={a.def.name} position={[a.x, 0, 0]} rotation={[a.def.angleDeg * D2R - Math.PI / 2, 0, 0]}>
              <P name={a.def.name} note={a.def.note} geometry={g.body} material={mats.alt} />
              {g.pad && (
                <P
                  name={`${a.def.name} drive pad`}
                  note={`${a.def.name} bolts to the drive pad on the crankcase, its face outboard (${a.def.src}).`}
                  geometry={g.pad}
                  material={mats.case}
                />
              )}
              {g.shaft && <P name={`${a.def.name} shaft`} geometry={g.shaft} material={mats.steel} />}
              <group position={[0, 0, Math.hypot(a.at[1], a.at[2])]} rotation={[0, -Math.PI / 2, 0]}>
                <P
                  name={`${a.def.name} drive pinion`}
                  note={`Bevel pinion on ${a.def.name}'s shaft, turned by the alternator drive gear on the crankshaft at ${a.ratio}:1.`}
                  geometry={g.wheel}
                  material={mats.gear}
                  meshRef={(m) => {
                    altRot.current[k] = m;
                  }}
                />
              </group>
            </group>
          );
        return (
          <Fragment key={a.def.name}>
            <group position={a.at}>
              <P
                name={a.def.name}
                note={a.def.note ?? "Belt-driven from the pulley behind the starter ring gear (IOM Table A-4)."}
                geometry={g.body}
                material={mats.alt}
              />
              <mesh
                ref={(m) => {
                  altRot.current[k] = m;
                }}
                geometry={g.wheel}
                material={a.gear ? mats.gear : mats.darkSteel}
              />
            </group>
            {g.belt && (
              <P
                name={`${a.def.name} belt`}
                note={
                  L.notes.altBelt ??
                  `${acc.alternatorRatio}:1 drive ratio with a 3.10 in alternator pulley (IOM Table A-4).`
                }
                geometry={g.belt}
                material={mats.belt}
              />
            )}
          </Fragment>
        );
      })}
      <group position={gv.at} rotation={gv.rotation}>
        <P
          name="Propeller governor"
          note={
            L.notes.governor ??
            `On the front of the crankcase on C1B6 and C3B6 engines (IOM p. 1), driven from the camshaft's spur gear at ${acc.governorRatio}:1 (Table A-4). Sets propeller pitch to hold the selected rpm.`
          }
          geometry={geo.gov}
          material={mats.black}
        />
        {!gv.gearAt && <mesh ref={govRot} geometry={geo.govGear} material={mats.gear} />}
      </group>
      {gv.gearAt && (
        <>
          <group position={gv.gearAt} rotation={gv.rotation}>
            <mesh ref={govRot} geometry={geo.govGear} material={mats.gear} />
          </group>
          {geo.govShaft && <P name="Governor drive shaft" geometry={geo.govShaft} material={mats.steel} />}
        </>
      )}
    </>
  );
}

export function Propeller({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const geo = useMemo(() => {
    const R = (spec.propeller.diameterIn * IN) / 2;
    return {
      spinner: new THREE.ConeGeometry(0.12, 0.26, 32).rotateZ(-Math.PI / 2).translate(0.13, 0, 0),
      bulkhead: rod(0.122, 0.01, 32).translate(0.005, 0, 0),
      blade: new THREE.BoxGeometry(0.014, R - 0.1, 0.13).translate(0.04, (R + 0.1) / 2, 0),
      tip: new THREE.BoxGeometry(0.0145, 0.08, 0.131).translate(0.04, R - 0.04, 0),
      disc: new THREE.CircleGeometry(R, 64).rotateY(Math.PI / 2).translate(0.04, 0, 0),
    };
  }, [spec]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const prop = useRef<THREE.Group>(null),
    disc = useRef<THREE.Mesh>(null);
  const blades = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const s = sim.s,
      ui = sim.useUi.getState();
    if (!prop.current) return;
    prop.current.visible = ui.view.prop;
    prop.current.rotation.x = (sim.anim.crank % 360) * D2R;
    const blur = !ui.view.slow && s.rpm > 500;
    blades.current.forEach((b) => {
      if (!b) return;
      b.visible = !blur;
      b.rotation.y = -(s.beta - 10) * D2R * 0.8;
    });
    if (disc.current) disc.current.visible = blur;
  });
  // Let the pointer reach parts behind a switched-off propeller without unmounting its meshes.
  useEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Mesh["raycast"]>();
    prop.current?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const original = o.raycast;
      originals.set(o, original);
      o.raycast = (raycaster, intersections) => {
        if (sim.useUi.getState().view.prop) original.call(o, raycaster, intersections);
      };
    });
    return () => originals.forEach((raycast, mesh) => (mesh.raycast = raycast));
  }, [sim]);
  const n = spec.propeller.blades;
  return (
    <group ref={prop} position={[d.flangeX + 0.008 + layoutFor(spec).propSpacer, 0, 0]}>
      <P name="Spinner" geometry={geo.spinner} material={mats.spinner} />
      <P name="Spinner bulkhead" geometry={geo.bulkhead} material={mats.spinner} />
      {Array.from({ length: n }, (_, k) => (
        <group key={k} rotation={[(k * 2 * Math.PI) / n, 0, 0]}>
          <group
            ref={(g) => {
              blades.current[k] = g;
            }}
          >
            <P
              name="Propeller blade"
              note={`${spec.propeller.name}, ${spec.propeller.src}.`}
              geometry={geo.blade}
              material={mats.prop}
            />
            <P name="Propeller blade" geometry={geo.tip} material={mats.propTip} />
          </group>
        </group>
      ))}
      <mesh ref={disc} geometry={geo.disc} material={mats.disc} raycast={() => null} />
    </group>
  );
}
