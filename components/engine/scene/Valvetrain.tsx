"use client";
/**
 * Camshaft and valve train. The camshaft runs above or below the crankshaft (the engine's layout) at half its speed,
 * driven by the crankshaft gear; each lobe lifts a tappet, which pushes a pushrod out through its shroud tube to a rocker
 * in the head, which opens the valve against its spring. Lift follows the model's valve events (`valveLift`). The drawn
 * lift and lobe shapes are schematic, and the valves are drawn parallel to the cylinder axis.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { phaseOf, valveLift } from "@/engines/model/cycle";
import type { CylinderDef } from "@/engines/types";
import type { EngineSim } from "../store";
import {
  bank,
  coil,
  D2R,
  GEAR_TEETH,
  lobeAngle,
  gear,
  merge,
  rod,
  valveLayout,
  VT,
  zrod,
  type Dims,
  type Mats,
} from "./kit";
import { layoutFor, type ValveDef } from "./layout";
import { P } from "./parts";

/** A cam lobe, nose along +z, axis along x: base circle plus a cos² nose as wide as the valve's open window. */
function lobeGeometry(halfWindowCamDeg: number) {
  const s = new THREE.Shape();
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2 - Math.PI;
    const u = Math.abs(th) / (halfWindowCamDeg * D2R);
    const r = VT.baseR + (u < 1 ? VT.maxLift * Math.cos((u * Math.PI) / 2) ** 2 : 0);
    const x = r * Math.sin(th),
      y = r * Math.cos(th);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: VT.lobeW, bevelEnabled: false, curveSegments: 4 });
  // shape nose +y, extrusion z → extrusion along x, nose along +z
  return g
    .translate(0, 0, -VT.lobeW / 2)
    .rotateY(Math.PI / 2)
    .rotateX(Math.PI / 2);
}

export function Camshaft({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const spec = sim.spec;
  const L = layoutFor(spec);
  const V = valveLayout(L);
  const geo = useMemo(() => {
    const v = spec.geometry.valves;
    return {
      shaft: rod(0.012, d.front - 0.02 - (d.caseRear - 0.01), 16).translate(
        (d.front - 0.02 + d.caseRear - 0.01) / 2,
        0,
        0,
      ),
      lobeI: lobeGeometry((180 + v.ivo + v.ivc) / 4),
      lobeE: lobeGeometry((180 + v.evo + v.evc) / 4),
      gear: merge([
        gear(d.camGearR, GEAR_TEETH.cam, 0.014, 0.012).translate(d.caseRear - 0.018, 0, 0),
        rod(0.025, 0.02, 20).translate(d.caseRear - 0.008, 0, 0),
      ]),
      govGear: gear(0.03, 18, 0.012, 0.01).translate(d.front - 0.03, 0, 0),
    };
  }, [spec, d]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const cam = useRef<THREE.Group>(null);
  useFrame(() => {
    // geared to the crankshaft: half speed, the other way
    if (cam.current) cam.current.rotation.x = (-(sim.anim.crank % 720) / 2) * D2R;
  });
  return (
    <group ref={cam} position={[0, d.camY, 0]}>
      <P
        name="Camshaft"
        note={
          L.notes.camshaft ??
          "Runs in bearings the crankcase forms and operates the tappets (IOM p. 2); one lobe per valve, at half crankshaft speed."
        }
        geometry={geo.shaft}
        material={mats.steel}
      />
      <P
        name="Camshaft gear"
        note="Twice the crankshaft gear's teeth, so the camshaft turns once every two crankshaft turns: one four-stroke cycle."
        geometry={geo.gear}
        material={mats.gear}
      />
      <P
        name="Governor drive gear"
        note={
          L.notes.govDriveGear ??
          "On front-governor models (C1B6, C3B6) the camshaft has an integral spur gear that drives the propeller governor (IOM p. 2)."
        }
        geometry={geo.govGear}
        material={mats.gear}
      />
      {spec.geometry.cylinders.flatMap((c) =>
        [true, false].map((intake) => {
          const k = bank(c);
          return (
            <P
              key={`${c.n}${intake}`}
              name={`Cam lobe, cylinder ${c.n} ${intake ? "intake" : "exhaust"}`}
              note="The lobe's nose lifts the tappet; between noses the tappet rests on the base circle and the valve is closed."
              geometry={intake ? geo.lobeI : geo.lobeE}
              material={mats.steel}
              position={[c.x + k * (intake ? V.intake : V.exhaust).x, 0, 0]}
              rotation={[lobeAngle(spec, c, intake) * D2R, 0, 0]}
            />
          );
        }),
      )}
    </group>
  );
}

/** One valve's train geometries; the rocker runs from its pushrod cup (+a from the pivot) to the valve pad (−b). */
function valveGeometry(d: Dims, v: ValveDef) {
  const a = v.pushY - v.pivotY,
    b = v.pivotY - v.tipY;
  const springLen = 0.05;
  return {
    tappet: merge([zrod(0.0085, 0, VT.tappetLen, 16), zrod(0.0095, 0, 0.004, 16)]),
    pushrod: merge([
      zrod(0.0042, 0, d.zPivot - VT.baseR - VT.tappetLen, 8),
      zrod(0.0055, 0, 0.006, 8),
      zrod(0.0055, d.zPivot - VT.baseR - VT.tappetLen - 0.006, d.zPivot - VT.baseR - VT.tappetLen, 8),
    ]),
    shroud: zrod(0.011, d.caseHalf - 0.01, d.zPivot - 0.06, 14),
    shroudSeal: merge([
      zrod(0.014, d.caseHalf - 0.012, d.caseHalf + 0.006, 14),
      zrod(0.014, d.zPivot - 0.075, d.zPivot - 0.06, 14),
    ]),
    // rocker, origin at its pivot: arm from the pushrod cup (+a) to the valve pad (−b)
    rocker: merge([
      new THREE.BoxGeometry(0.009, Math.abs(a + b), 0.012).translate(0, (a - b) / 2, 0),
      rod(0.009, 0.016, 14),
      zrod(0.0065, -0.008, 0.004, 10).translate(0, a, 0),
      new THREE.BoxGeometry(0.012, 0.008, 0.01).translate(0, -b, 0.002),
    ]),
    valve: merge([
      zrod(0.0035, d.deck + 0.003, d.zPivot, 8),
      zrod(0.0035, d.deck - 0.001, d.deck + 0.012, 20, 0.019),
      zrod(0.019, d.deck - 0.003, d.deck - 0.001, 20),
    ]),
    spring: coil(0.011, 0.0014, 0, springLen, 6),
    springLen,
    retainer: zrod(0.0125, -0.004, 0, 14, 0.008),
  };
}

type ValveGeo = ReturnType<typeof valveGeometry>;

/** One cylinder's valve train in its own frame. */
function CylinderValves({
  sim,
  c,
  d,
  mats,
  geo,
  valves,
  shafts,
}: {
  sim: EngineSim;
  c: CylinderDef;
  d: Dims;
  mats: Mats;
  geo: [ValveGeo, ValveGeo];
  valves: [ValveDef, ValveDef];
  shafts: THREE.BufferGeometry[];
}) {
  const moving = useRef<(THREE.Object3D | null)[]>([]);
  const set = (i: number) => (o: THREE.Object3D | null) => {
    moving.current[i] = o;
  };
  const seat = d.zPivot - 0.008 - geo[0].springLen;
  useFrame(() => {
    const lift = valveLift(sim.spec, phaseOf(sim.spec, c.n, sim.anim.crank));
    [lift.intake, lift.exhaust].forEach((l, v) => {
      const m = l * VT.maxLift;
      // the pushrod end swings out and the valve end in, whichever side of the pivot the pushrod is
      const a = valves[v].pushY - valves[v].pivotY;
      const [tappet, pushrod, rocker, valve, spring] = moving.current.slice(v * 5, v * 5 + 5);
      if (tappet) tappet.position.z = VT.baseR + m;
      if (pushrod) pushrod.position.z = VT.baseR + VT.tappetLen + m;
      if (rocker) rocker.rotation.x = Math.asin(Math.max(-1, Math.min(1, m / a)));
      if (valve) valve.position.z = -m;
      if (spring) spring.scale.z = (geo[v].springLen - m) / geo[v].springLen;
    });
  });
  return (
    <group position={[c.x, 0, 0]} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
      {shafts.map((g, k) => (
        <P
          key={k}
          name="Rocker shaft"
          note="The rockers pivot on it inside the rocker box."
          geometry={g}
          material={mats.darkSteel}
        />
      ))}
      {valves.map((vd, v) => {
        const what = v === 0 ? "intake" : "exhaust";
        const g = geo[v];
        return (
          <group key={what} position={[vd.x, 0, 0]}>
            <group ref={set(v * 5)} position={[0, vd.pushY, 0]}>
              <P
                name="Tappet"
                note={`Rides on its cam lobe and lifts the pushrod (cylinder ${c.n} ${what}).`}
                geometry={g.tappet}
                material={mats.darkSteel}
              />
            </group>
            <group ref={set(v * 5 + 1)} position={[0, vd.pushY, 0]}>
              <P
                name="Pushrod"
                note={`Carries the tappet's lift out to the rocker (cylinder ${c.n} ${what}).`}
                geometry={g.pushrod}
                material={mats.steel}
              />
            </group>
            <P
              name="Pushrod shroud tube"
              note="Encloses the pushrod between the crankcase and the rocker box."
              geometry={g.shroud}
              material={mats.shroud}
              position={[0, vd.pushY, 0]}
            />
            <P name="Shroud tube seal" geometry={g.shroudSeal} material={mats.black} position={[0, vd.pushY, 0]} />
            <group ref={set(v * 5 + 2)} position={[0, vd.pivotY, d.zPivot]}>
              <P
                name={`Rocker, ${what}`}
                note="Turns the pushrod's outward push into an inward push on the valve stem."
                geometry={g.rocker}
                material={mats.steel}
              />
            </group>
            <group ref={set(v * 5 + 3)} position={[0, vd.tipY, 0]}>
              <P
                name={v === 0 ? "Intake valve" : "Exhaust valve"}
                note={
                  v === 0
                    ? "Opens to let the fuel–air charge in on the intake stroke."
                    : "Opens to let the burnt gas out on the exhaust stroke."
                }
                geometry={g.valve}
                material={v === 0 ? mats.valveI : mats.valveE}
              />
              <P
                name="Valve spring retainer"
                geometry={g.retainer}
                material={mats.darkSteel}
                position={[0, 0, d.zPivot - 0.008]}
              />
            </group>
            <group ref={set(v * 5 + 4)} position={[0, vd.tipY, seat]}>
              <P
                name="Valve spring"
                note="Closes the valve and keeps the train in contact with the cam."
                geometry={g.spring}
                material={mats.spring}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}

export function ValveTrain({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const { valves, geo, shafts } = useMemo(() => {
    const V = valveLayout(L);
    const valves: [ValveDef, ValveDef] = [V.intake, V.exhaust];
    // one rocker shaft across both rockers when they pivot at one height, else a short one for each
    const shafts =
      V.intake.pivotY === V.exhaust.pivotY
        ? [rod(0.0055, 2 * VT.xOff + 0.03, 10).translate(0, V.intake.pivotY, d.zPivot)]
        : valves.map((v) => rod(0.0055, 0.03, 10).translate(v.x, v.pivotY, d.zPivot));
    return { valves, geo: valves.map((v) => valveGeometry(d, v)) as [ValveGeo, ValveGeo], shafts };
  }, [d, L]);
  useEffect(
    () => () => {
      geo.forEach((vg) =>
        Object.values(vg).forEach((g) => {
          if (g instanceof THREE.BufferGeometry) g.dispose();
        }),
      );
      shafts.forEach((g) => g.dispose());
    },
    [geo, shafts],
  );
  return (
    <>
      {sim.spec.geometry.cylinders.map((c) => (
        <CylinderValves key={c.n} sim={sim} c={c} d={d} mats={mats} geo={geo} valves={valves} shafts={shafts} />
      ))}
    </>
  );
}
