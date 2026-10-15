"use client";
/**
 * The four cylinders: finned barrel on a base flange held by hold-down nuts, finned head tinted by its CHT, rocker box
 * and cover on the outer end, two spark plugs that flash when they fire, and the injection nozzle. Each cylinder
 * contains "a cylinder head, barrel, piston, angled intake and exhaust valve guides and valve seats, rocker shafts,
 * rocker covers, and fins" (IOM System Description p. 1, Figure 2); the shapes here are schematic.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { phaseOf, sparkBTC } from "@/engines/model/cycle";
import { sparks } from "@/engines/model/engine";
import type { CylinderDef } from "@/engines/types";
import type { EngineSim } from "../store";
import { chtColor, finned, headPoints, merge, slab, zrod, type Dims, type Mats } from "./kit";
import { Group, P } from "./parts";

function cylinderGeometry(d: Dims) {
  const hp = headPoints(d);
  const R = d.bore / 2;
  const nuts = Array.from({ length: 8 }, (_, k) => {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    return zrod(0.0065, d.caseHalf + 0.01, d.caseHalf + 0.02, 6).translate(0.088 * Math.cos(a), 0.088 * Math.sin(a), 0);
  });
  // a spark plug along +y from its seat: hex, insulator, shielded elbow
  const plug = merge([
    new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6).translate(0, 0.006, 0),
    new THREE.CylinderGeometry(0.0065, 0.0075, 0.034, 12).translate(0, 0.029, 0),
  ]);
  const plugShield = new THREE.CylinderGeometry(0.0085, 0.0085, 0.016, 12).translate(0, 0.052, 0);
  const port = (p: [number, number, number]) =>
    merge([
      new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16).translate(p[0], p[1] - 0.004, p[2]),
      new THREE.BoxGeometry(0.07, 0.006, 0.05).translate(p[0], p[1] - 0.003, p[2]),
    ]);
  return {
    barrel: finned(R + 0.006, R + 0.028, d.caseHalf + 0.012, d.headIn, 11),
    flange: merge([zrod(R + 0.03, d.caseHalf, d.caseHalf + 0.01, 32), ...nuts]),
    head: merge([
      finned(R + 0.016, 0.1, d.headIn, d.zPivot + 0.02, 12, false),
      zrod(R + 0.008, d.headIn - 0.004, d.deck + 0.004, 32), // the head's lower skirt over the barrel
    ]),
    rockerBox: slab(-0.048, 0.048, 0.012, 0.15, d.zPivot - 0.075, d.headOut - 0.012, 0.012),
    cover: slab(-0.05, 0.05, 0.008, 0.154, d.headOut - 0.012, d.headOut, 0.014),
    plug,
    plugShield,
    spark: new THREE.SphereGeometry(0.024, 14, 10),
    nozzle: merge([
      new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6).translate(hp.nozzle[0], hp.nozzle[1] + 0.006, hp.nozzle[2]),
      new THREE.CylinderGeometry(0.005, 0.005, 0.02, 10).translate(hp.nozzle[0], hp.nozzle[1] + 0.02, hp.nozzle[2]),
    ]),
    intakePort: port(hp.intakePort),
    exhaustPort: port(hp.exhaustPort),
  };
}
type CylGeo = ReturnType<typeof cylinderGeometry>;

function Cylinder({
  sim,
  c,
  i,
  d,
  mats,
  geo,
}: {
  sim: EngineSim;
  c: CylinderDef;
  i: number;
  d: Dims;
  mats: Mats;
  geo: CylGeo;
}) {
  const hp = useMemo(() => headPoints(d), [d]);
  const head = useMemo(() => mats.head.clone(), [mats]);
  const spark = useMemo(() => [mats.spark.clone(), mats.spark.clone()], [mats]);
  useEffect(
    () => () => {
      head.dispose();
      spark.forEach((m) => m.dispose());
    },
    [head, spark],
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const spec = sim.spec,
      s = sim.s,
      ui = sim.useUi.getState();
    head.opacity = mats.head.opacity;
    head.depthWrite = mats.head.depthWrite;
    chtColor(s.cyl[i]?.cht ?? 60, spec.limits.chtMax.value, tmp);
    head.color.copy(tmp);
    // the plugs flash from the spark through early combustion
    const ph = phaseOf(spec, c.n, sim.anim.crank);
    const since = (ph + sparkBTC(spec, ui.controls.mags) + 720) % 720;
    const lit = since < 40 && s.rpm > 30;
    const fl = lit ? (s.cyl[i]?.work > 0.02 ? 1 - since / 40 : 0.35) : 0;
    const top = spec.ignition.topPlugMag[c.n];
    const firing = sparks(spec, ui.controls.mags, ui.failures, s.rpm)[i] > 0;
    const magOn = (m: "L" | "R") =>
      !(m === "L" ? ui.failures.magL : ui.failures.magR) &&
      (ui.controls.mags === "BOTH" ||
        ui.controls.mags === m ||
        (ui.controls.mags === "START" && m === spec.ignition.retardMag));
    const other = top === "L" ? "R" : "L";
    spark[0].opacity = firing && magOn(top) && !ui.failures.plugs[i][0] ? fl : 0;
    spark[1].opacity = firing && magOn(other) && !ui.failures.plugs[i][1] ? fl : 0;
  });
  const n = c.n;
  return (
    <group position={[c.x, 0, 0]} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
      <P
        name={`Cylinder ${n} barrel`}
        note="Finned barrel; the piston runs inside it."
        geometry={geo.barrel}
        material={mats.barrel}
      />
      <P
        name={`Cylinder ${n} base flange`}
        note="Hold-down nuts on studs clamp the cylinder to the crankcase."
        geometry={geo.flange}
        material={mats.darkSteel}
      />
      <P
        name={`Cylinder ${n} head`}
        note="Finned head with the valve seats and guides; tinted here by its cylinder head temperature."
        geometry={geo.head}
        material={head}
      />
      <P name="Rocker box" note="Houses the rocker shafts and rockers." geometry={geo.rockerBox} material={head} />
      <P
        name="Rocker cover"
        note="Closes the rocker box on the outer end of the head."
        geometry={geo.cover}
        material={mats.cover}
      />
      <P name="Intake port" note="Tuned induction runner flange." geometry={geo.intakePort} material={mats.darkSteel} />
      <P name="Exhaust port" note="Exhaust pipe flange." geometry={geo.exhaustPort} material={mats.darkSteel} />
      {/* the nozzle and plugs sit in the head but hide with their own systems' groups */}
      <Group sim={sim} id="fuel">
        <P
          name={`Fuel injection nozzle, cylinder ${n}`}
          note="Four injection nozzles, one per cylinder, fed from the fuel manifold (IOM p. 4)."
          geometry={geo.nozzle}
          material={mats.gear}
        />
      </Group>
      <Group sim={sim} id="ignition">
        {[
          { at: hp.topPlug, rot: hp.tilt, s: hp.topSpark, which: "top" },
          { at: hp.botPlug, rot: Math.PI - hp.tilt, s: hp.botSpark, which: "bottom" },
        ].map((p, k) => (
          <group key={p.which}>
            <group position={p.at} rotation={[0, 0, p.rot]}>
              <P
                name={`Spark plug, cylinder ${n} ${p.which}`}
                note="Eight spark plugs, two per cylinder (IOM p. 2); each magneto fires one plug in every cylinder."
                geometry={geo.plug}
                material={mats.plug}
              />
              <P name="Shielded lead terminal" geometry={geo.plugShield} material={mats.lead} />
            </group>
            <mesh geometry={geo.spark} material={spark[k]} position={p.s} raycast={() => null} />
          </group>
        ))}
      </Group>
    </group>
  );
}

export function Cylinders({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const geo = useMemo(() => cylinderGeometry(d), [d]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      {sim.spec.geometry.cylinders.map((c, i) => (
        <Cylinder key={c.n} sim={sim} c={c} i={i} d={d} mats={mats} geo={geo} />
      ))}
    </>
  );
}
