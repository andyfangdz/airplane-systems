"use client";
/**
 * The crankshaft (main journals, cheeks, one crankpin per cylinder, the counterweights the layout hangs on the cheeks,
 * crankshaft gear, nose, propeller flange with the starter ring gear and alternator drives the layout has) and, for each
 * cylinder, its connecting rod and piston.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { rodEnds } from "@/engines/model/cycle";
import type { EngineSpec } from "@/engines/types";
import type { EngineSim } from "../store";
import {
  CHEEK_T,
  crankLayout,
  D2R,
  driveLayout,
  gear,
  GEAR_TEETH,
  merge,
  rod,
  STARTER_TEETH,
  throwRotation,
  zrod,
  type Dims,
  type Mats,
} from "./kit";
import { layoutFor } from "./layout";
import { P } from "./parts";

/** The crankshaft's geometries, in the crankshaft's frame (axis along x; a throw's parts before its turn). */
export function crankGeometry(spec: EngineSpec, d: Dims) {
  const L = layoutFor(spec);
  const cl = crankLayout(spec, d, L);
  const drives = driveLayout(spec, d, L);
  const journals = cl.journals.map((j) => rod(0.028, j.len, 20).translate(j.x, 0, 0));
  const bearings = cl.bearings.map((b) => rod(0.0305, b.len, 20).translate(b.x, 0, 0));
  const nose = rod(0.034, d.flangeX - d.front, 20).translate((d.flangeX + d.front) / 2, 0, 0);
  const cheek = new THREE.BoxGeometry(CHEEK_T, 0.062, d.r + 0.062).translate(0, 0, d.r / 2);
  const pin = rod(0.026, 0.05, 18);
  // a counterweight hangs opposite its crankpin: a half disc on the cheek
  const cw = new THREE.Shape();
  cw.absarc(0, 0, 0.074, -Math.PI / 2, Math.PI / 2, false);
  cw.lineTo(0, -0.074);
  const counterweight = new THREE.ExtrudeGeometry(cw, { depth: 0.016, bevelEnabled: false, curveSegments: 16 })
    .translate(0, 0, -0.008)
    .rotateY(Math.PI / 2);
  const crankGear = gear(d.crankGearR, GEAR_TEETH.crank, 0.014, 0.01).translate(d.caseRear - 0.018, 0, 0);
  // propeller flange with its drive bushings, the starter ring gear and the alternator pulley behind it
  const flange = merge([
    rod(0.088, 0.014, 32).translate(d.flangeX, 0, 0),
    ...Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2;
      return rod(0.007, 0.03, 10).translate(d.flangeX + 0.015, 0.068 * Math.cos(a), 0.068 * Math.sin(a));
    }),
  ]);
  // starter ring gear behind the flange (a front starter)
  const ring =
    L.starter === "front-ring"
      ? merge([
          gear(d.ringR, STARTER_TEETH.ring, 0.012, d.ringR - 0.02).translate(d.flangeX - 0.03, 0, 0),
          rod(d.ringR - 0.018, 0.006, 48).translate(d.flangeX - 0.03, 0, 0),
        ])
      : null;
  // belt alternator pulley (with a propeller standoff, the sheave adapter it sits on, from the flange to the
  // propeller); drive gear for a gear-driven alternator
  const belt = drives.alternators.find((a) => !a.gear);
  const pulley = belt
    ? merge([
        rod(d.pulleyR, 0.004, 48).translate(belt.x + 0.009, 0, 0),
        rod(d.pulleyR - 0.008, 0.016, 48).translate(belt.x, 0, 0),
        rod(d.pulleyR, 0.004, 48).translate(belt.x - 0.009, 0, 0),
        ...(L.propSpacer > 0
          ? [rod(0.06, L.propSpacer + 0.001, 32).translate(d.flangeX + 0.0075 + L.propSpacer / 2, 0, 0)]
          : []),
      ])
    : null;
  const geared = drives.alternators.find((a) => a.gear);
  const altGear = geared?.gear
    ? gear(geared.gear.driveR, geared.gear.driveTeeth, 0.012, 0.03).translate(geared.gear.driveX, 0, 0)
    : null;
  return {
    journals: merge(journals),
    bearings: merge(bearings),
    nose,
    cheek,
    pin,
    counterweight,
    crankGear,
    flange,
    ring,
    pulley,
    altGear,
  };
}

export function Crankshaft({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const geo = useMemo(() => crankGeometry(sim.spec, d), [sim, d]);
  useEffect(
    () => () =>
      Object.values(geo).forEach((g) => {
        if (g) g.dispose();
      }),
    [geo],
  );
  const crank = useRef<THREE.Group>(null);
  useFrame(() => {
    if (crank.current) crank.current.rotation.x = (sim.anim.crank % 360) * D2R;
  });
  const cyls = sim.spec.geometry.cylinders;
  const cl = useMemo(() => crankLayout(sim.spec, d, L), [sim, d, L]);
  const cwAt = (n: number) => cl.counterweights.filter((w) => w.c.n === n).map((w) => w.at);
  return (
    <>
      <P
        name="Main bearings"
        note={
          L.notes.mainBearings ??
          "Pairs of precision-type inserts installed in the crankcase at each journal (IOM p. 2)."
        }
        geometry={geo.bearings}
        material={mats.bearing}
      />
      <group ref={crank}>
        <P
          name="Crankshaft"
          note={
            L.notes.crankshaft ??
            "Forged crankshaft: main journals, cheeks and four crankpins, one per cylinder (IOM Figure 4)."
          }
          geometry={geo.journals}
          material={mats.steel}
        />
        <P
          name="Crankshaft"
          note="The nose runs forward to the propeller flange."
          geometry={geo.nose}
          material={mats.steel}
        />
        <P
          name="Crankshaft gear"
          note="Drives the camshaft gear at half speed, and the accessories, from the rear of the crankshaft."
          geometry={geo.crankGear}
          material={mats.gear}
        />
        <P
          name="Propeller flange"
          note={
            L.notes.propFlange ??
            "Bolts the propeller to the crankshaft; oil for the controllable-pitch propeller is supplied through it (IOM p. 2)."
          }
          geometry={geo.flange}
          material={mats.steel}
        />
        {geo.ring && (
          <P
            name="Starter ring gear"
            note="The starter's pinion engages it to crank the engine. Drawn with 149 teeth against a 9-tooth pinion, which gives the 16.556:1 starter drive ratio (IOM Table A-4); the tooth counts themselves are inferred."
            geometry={geo.ring}
            material={mats.darkSteel}
          />
        )}
        {geo.pulley && (
          <P
            name="Alternator drive pulley"
            note={
              L.notes.altPulley ??
              "Belt drive to the alternator: 3.2 alternator turns per crankshaft turn (IOM Table A-4)."
            }
            geometry={geo.pulley}
            material={mats.darkSteel}
          />
        )}
        {geo.altGear && (
          <P name="Alternator drive gear" note={L.notes.altDriveGear} geometry={geo.altGear} material={mats.gear} />
        )}
        {cyls.map((c) => (
          <group key={c.n} position={[c.x, 0, 0]} rotation={[throwRotation(c), 0, 0]}>
            <P name="Crankshaft cheek" geometry={geo.cheek} material={mats.steel} position={[cl.cheek, 0, 0]} />
            <P name="Crankshaft cheek" geometry={geo.cheek} material={mats.steel} position={[-cl.cheek, 0, 0]} />
            <P
              name="Crankpin"
              note={`Cylinder ${c.n}'s connecting rod runs on this pin.`}
              geometry={geo.pin}
              material={mats.steel}
              position={[0, 0, d.r]}
            />
            {sim.spec.geometry.pendulumCounterweights &&
              cwAt(c.n).map((at) => (
                <P
                  key={at}
                  name="Dynamic counterweight"
                  note={
                    L.notes.counterweight ??
                    "Counterweights decrease torsional vibrations as the crankshaft turns the propeller (IOM p. 2, Figure 4)."
                  }
                  geometry={geo.counterweight}
                  material={mats.darkSteel}
                  position={[at, 0, 0]}
                />
              ))}
          </group>
        ))}
      </group>
    </>
  );
}

function rodGeometry(d: Dims) {
  const big = merge([rod(0.031, 0.022, 20), rod(0.006, 0.05, 8).translate(0, 0, -0.026)]); // big end and cap bolts
  const beam = new THREE.BoxGeometry(0.012, 0.024, d.l - 0.06).translate(0, 0, d.l / 2);
  const flangeA = new THREE.BoxGeometry(0.02, 0.006, d.l - 0.06).translate(0, 0.011, d.l / 2);
  const flangeB = flangeA.clone().translate(0, -0.022, 0);
  const small = rod(0.018, 0.02, 16).translate(0, 0, d.l);
  return merge([big, beam, flangeA, flangeB, small]);
}

function pistonGeometry(d: Dims) {
  const R = d.bore / 2 - 0.0012;
  const body = zrod(R, -0.034, d.crown, 32);
  const grooves = merge(
    [0, 1, 2].map((k) => zrod(R + 0.0006, d.crown - 0.008 - k * 0.008, d.crown - 0.004 - k * 0.008, 32)),
  );
  const wrist = rod(0.011, d.bore * 0.86, 14);
  return { body, grooves, wrist };
}

/** Connecting rods and pistons: each follows its crankpin through `rodEnds`. */
export function RodsAndPistons({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const rodGeo = useMemo(() => rodGeometry(d), [d]);
  const pg = useMemo(() => pistonGeometry(d), [d]);
  useEffect(
    () => () => {
      rodGeo.dispose();
      Object.values(pg).forEach((g) => g.dispose());
    },
    [rodGeo, pg],
  );
  const rods = useRef<(THREE.Mesh | null)[]>([]),
    pistons = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    sim.spec.geometry.cylinders.forEach((c, i) => {
      const { pin, piston } = rodEnds(sim.spec, c, sim.anim.crank);
      const k = c.side === "R" ? 1 : -1;
      const dist = piston.z * k,
        py = pin.y,
        pz = pin.z * k;
      const r = rods.current[i],
        p = pistons.current[i];
      if (r) {
        r.position.set(0, py, pz);
        r.rotation.x = Math.atan2(py, dist - pz);
      }
      if (p) p.position.z = dist;
    });
  });
  return (
    <>
      {sim.spec.geometry.cylinders.map((c, i) => (
        <group key={c.n} position={[c.x, 0, 0]} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
          <P
            name={`Connecting rod, cylinder ${c.n}`}
            note="H-section steel rod: big end with a bolted cap on the crankpin, small end on the piston pin."
            geometry={rodGeo}
            material={mats.darkSteel}
            meshRef={(m) => {
              rods.current[i] = m;
            }}
          />
          <group
            ref={(g) => {
              pistons.current[i] = g;
            }}
          >
            <P
              name={`Piston, cylinder ${c.n}`}
              note={
                L.notes.pistonOil ??
                "Four oil nozzles in the crankcase supply oil to cool the pistons from inside (IOM p. 2)."
              }
              geometry={pg.body}
              material={mats.piston}
            />
            <P
              name="Piston rings"
              note="Compression and oil-control rings seal the piston in the barrel."
              geometry={pg.grooves}
              material={mats.ring}
            />
            <P
              name="Piston pin"
              note="Floating pin joining the piston to the rod's small end."
              geometry={pg.wrist}
              material={mats.steel}
            />
          </group>
        </group>
      ))}
    </>
  );
}
