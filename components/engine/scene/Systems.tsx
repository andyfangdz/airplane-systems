"use client";
/**
 * The systems hung on the engine: ignition (two magnetos and the harness to all eight plugs, IOM p. 2, Figure 5), fuel
 * injection (diaphragm-type engine-driven pump, fuel injector, fuel manifold, lines to the four nozzles, IOM p. 4,
 * Figure 7), tuned induction and down exhaust (IOM p. 1), and the drives: starter, alternator and front propeller
 * governor (IOM pp. 1–3, Table A-4), plus the propeller. Positions follow the IOM figures; shapes are schematic.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CylinderDef } from "@/engines/types";
import type { EngineSim } from "../store";
import {
  bank,
  D2R,
  egtColor,
  gear,
  headPoints,
  IN,
  magDrive,
  merge,
  rod,
  STARTER_TEETH,
  toWorld,
  tube,
  type Dims,
  type Mats,
} from "./kit";
import { P } from "./parts";

type V3 = [number, number, number];

/** Magneto bodies: on the rear of the accessory housing, top left and right, above their drive gears (`magDrive`). */
const MAG = { r: 0.04, len: 0.1 };

export function Ignition({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const drive = useMemo(() => magDrive(spec, d), [spec, d]);
  const magZ = (side: "L" | "R") => (side === "R" ? drive.z : -drive.z);
  const geo = useMemo(() => {
    const hp = headPoints(d);
    const leads: THREE.BufferGeometry[] = [];
    spec.geometry.cylinders.forEach((c) => {
      const k = bank(c);
      const topMag = spec.ignition.topPlugMag[c.n];
      const botMag = topMag === "L" ? "R" : "L";
      const cap = (m: "L" | "R", dy: number): V3 => [d.accRear - MAG.len - 0.02, drive.y + dy, magZ(m)];
      const top = toWorld(c, hp.topLead),
        bot = toWorld(c, hp.botLead);
      leads.push(
        tube(
          // up off the cap and forward over the magneto and the accessory housing
          [
            cap(topMag, 0.02),
            [d.accRear - MAG.len - 0.025, drive.y + 0.055, magZ(topMag)],
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
      body: rod(MAG.r, MAG.len, 24).translate(d.accRear - MAG.len / 2, 0, 0),
      flange: rod(MAG.r + 0.008, 0.008, 24).translate(d.accRear - 0.004, 0, 0),
      cap: rod(MAG.r + 0.003, 0.022, 24).translate(d.accRear - MAG.len - 0.009, 0, 0),
      // drive gear in the camshaft gear's plane, its shaft running aft to the magneto
      gear: merge([
        gear(drive.r, drive.teeth, 0.01, 0.006).translate(drive.x, 0, 0),
        rod(0.007, drive.x - d.accRear, 10).translate((drive.x + d.accRear) / 2, 0, 0),
      ]),
      leads: merge(leads),
    };
  }, [spec, d, drive]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const gears = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    // geared to the camshaft gear (which turns at −crank/2), so the other way at the Table A-1 magneto drive ratio
    const a = ((sim.anim.crank * spec.accessories.magnetoRatio) % 360) * D2R;
    gears.current.forEach((g) => {
      if (!g) return;
      g.rotation.x = a + Math.PI / drive.teeth;
    });
  });
  const mags = spec.accessories.magnetos;
  return (
    <>
      {(["L", "R"] as const).map((m, k) => {
        const retard = m === spec.ignition.retardMag;
        return (
          <group key={m} position={[0, drive.y, magZ(m)]}>
            <P
              name={`${m === "L" ? "Left" : "Right"} magneto${retard ? " (retard breaker)" : ""}`}
              note={
                retard
                  ? `The retard-breaker magneto fires alone, late, during the start cycle (IOM p. 2). ${mags} (Table A-1).`
                  : `The plain magneto is grounded during the start cycle (IOM p. 2). ${mags} (Table A-1).`
              }
              geometry={geo.body}
              material={mats.mag}
            />
            <P name="Magneto mounting flange" geometry={geo.flange} material={mats.mag} />
            <P
              name="Magneto distributor cap"
              note="Leads to four plugs leave here: one in every cylinder."
              geometry={geo.cap}
              material={mats.magCap}
            />
            <P
              name="Magneto drive gear"
              note={`Meshes with the camshaft gear: half as many teeth, so the magneto turns at crankshaft speed (magneto drive ratio ${spec.accessories.magnetoRatio}:1, Table A-1).`}
              geometry={geo.gear}
              material={mats.gear}
              meshRef={(g) => {
                gears.current[k] = g;
              }}
            />
          </group>
        );
      })}
      <P
        name="Ignition harness"
        note="All-weather shielded leads from each magneto to one plug in every cylinder (IOM p. 2)."
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

export function FuelSystem(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  return p.sim.spec.fuelSystem.kind === "carburetor" ? <CarburetorSystem {...p} /> : <InjectedFuel {...p} />;
}

function InjectedFuel({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const unit = spec.fuelSystem.unit;
  const geo = useMemo(() => {
    const hp = headPoints(d);
    const [ix, iy] = injectorAt(d);
    const m = manifoldAt(sim, d);
    const px = d.accRear - 0.03;
    const lines = [
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
  }, [spec, sim, d]);
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
      <P
        name="Fuel manifold"
        note="Divides the injector's metered fuel among the four nozzle lines (IOM p. 4)."
        geometry={geo.manifold}
        material={mats.fuelBody}
      />
      <P
        name="Fuel lines"
        note="Pump to injector, injector to manifold, manifold to the four nozzles (IOM p. 4). They glow with fuel flow."
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

/** Tuned induction: a plenum under the sump from the throttle body, a runner up to each intake port; down exhaust. */
export function Induction({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
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

/** Starter at the front lower left, its pinion on the ring gear; alternator lower right on a belt; governor up front. */
export function Drives({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const acc = spec.accessories;
  const L = useMemo(() => {
    const pinionR = (d.ringR * STARTER_TEETH.pinion) / STARTER_TEETH.ring;
    const sa = 235 * D2R,
      rs = d.ringR + pinionR + 0.001;
    const aa = 135 * D2R,
      ra = 0.27;
    const ringX = d.flangeX - 0.03,
      pulleyX = d.flangeX - 0.055;
    // governor shaft: its gear meshes with the camshaft's spur gear, turning at the governor drive ratio
    const camGovR = 0.03,
      govR = (camGovR * 0.5) / acc.governorRatio;
    const gd = camGovR + govR;
    return {
      pinionR,
      starter: [ringX, rs * Math.cos(sa), rs * Math.sin(sa)] as V3,
      alt: [pulleyX, ra * Math.cos(aa), ra * Math.sin(aa)] as V3,
      ringX,
      pulleyX,
      govR,
      gov: [d.front - 0.03, d.camY - gd * Math.SQRT1_2, -gd * Math.SQRT1_2] as V3,
    };
  }, [d, acc]);
  const geo = useMemo(() => {
    const [, ay, az] = L.alt;
    // belt: the hull of the two pulleys, in the plane of the crankshaft pulley
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
    const belt = new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: false, curveSegments: 24 })
      .translate(0, 0, -0.006)
      .rotateY(Math.PI / 2)
      .translate(L.pulleyX, 0, 0);
    return {
      // ends just forward of the crankcase
      motor: rod(0.04, 0.045, 24).translate(-0.0425, 0, 0),
      solenoid: rod(0.017, 0.045, 14).translate(-0.04, 0.045, 0),
      drive: rod(0.022, 0.025, 16).translate(-0.016, 0, 0),
      pinion: gear(L.pinionR, STARTER_TEETH.pinion, 0.012, 0),
      // short enough to stay forward of cylinder 1's intake pipe
      alt: merge([rod(0.06, 0.08, 28).translate(-0.06, 0, 0), rod(0.05, 0.012, 28).translate(-0.016, 0, 0)]),
      altPulley: merge([gear(d.altPulleyR, 16, 0.016, 0), rod(0.012, 0.03, 10).translate(-0.012, 0, 0)]),
      belt,
      gov: merge([
        rod(0.032, 0.035, 22).translate(0.0475, 0, 0),
        rod(0.04, 0.008, 22).translate(0.034, 0, 0),
        rod(0.012, 0.03, 10).translate(0.079, 0, 0),
      ]),
      govGear: gear(L.govR, 10, 0.012, 0.004),
    };
  }, [d, L]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const pinion = useRef<THREE.Group>(null),
    altRot = useRef<THREE.Mesh>(null),
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
      if (p.position.x > -PINION_MESH) p.rotation.x = (-(crank * acc.starterRatio) % 360) * D2R;
    }
    if (altRot.current) altRot.current.rotation.x = ((crank * acc.alternatorRatio) % 360) * D2R;
    if (govRot.current) govRot.current.rotation.x = ((crank * acc.governorRatio) % 360) * D2R;
  });
  return (
    <>
      <group position={L.starter}>
        <P
          name="Starter"
          note={`12 V or 24 V starter (IOM p. 3); drive ratio ${acc.starterRatio}:1 (Table A-1). Engaged while the switch is held at START.`}
          geometry={geo.motor}
          material={mats.black}
        />
        <P name="Starter solenoid" geometry={geo.solenoid} material={mats.black} />
        <P name="Starter drive housing" geometry={geo.drive} material={mats.alt} />
        <group ref={pinion} position={[-PINION_TRAVEL, 0, 0]}>
          <P
            name="Starter pinion"
            note="The solenoid slides it into mesh with the ring gear while the starter is engaged and withdraws it on release; out of mesh it stands still while the ring gear turns."
            geometry={geo.pinion}
            material={mats.gear}
          />
        </group>
      </group>
      <group position={L.alt}>
        <P
          name="Alternator"
          note="Belt-driven from the pulley behind the starter ring gear (IOM Table A-4)."
          geometry={geo.alt}
          material={mats.alt}
        />
        <mesh ref={altRot} geometry={geo.altPulley} material={mats.darkSteel} />
      </group>
      <P
        name="Alternator belt"
        note={`${acc.alternatorRatio}:1 drive ratio with a 3.10 in alternator pulley (IOM Table A-4).`}
        geometry={geo.belt}
        material={mats.belt}
      />
      <group position={L.gov}>
        <P
          name="Propeller governor"
          note={`On the front of the crankcase on C1B6 and C3B6 engines (IOM p. 1), driven from the camshaft's spur gear at ${acc.governorRatio}:1 (Table A-4). Sets propeller pitch to hold the selected rpm.`}
          geometry={geo.gov}
          material={mats.black}
        />
        <mesh ref={govRot} geometry={geo.govGear} material={mats.gear} />
      </group>
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
  const n = spec.propeller.blades;
  return (
    <group ref={prop} position={[d.flangeX + 0.008, 0, 0]}>
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
