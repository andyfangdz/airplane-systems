"use client";
/**
 * The cylinders: finned barrel on a base flange held by its fasteners, finned head tinted by its CHT, rocker box and
 * cover(s) on the outer end, two spark plugs that flash when they fire, the injection nozzle and the intake and exhaust
 * ports where the engine's layout puts them. The shapes are schematic.
 */
import { studyCrank } from "../assembly-study";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { phaseOf, sparkBTC } from "@/engines/model/cycle";
import type { CylinderDef } from "@/engines/types";
import type { EngineSim } from "../store";
import { chtColor, drawnSparks, finned, headPoints, merge, slab, zrod, type Dims, type Mats } from "./kit";
import { layoutFor, type EngineLayout } from "./layout";
import { coolingBaffles } from "./io390/accessories";
import { cylinderBarrel, cylinderHardware, lycomingHead } from "./io390/cylinder";
import { Details, useDetailDisposal } from "./io390/Details";
import type { Detail } from "./io390/shapes";
import { Assembly, cylinderSpread, Spread } from "./Separation";
import { Group, P } from "./parts";

/** One cylinder's geometries, in its own frame (+z out along the axis). */
export function cylinderGeometry(d: Dims, L: EngineLayout) {
  const hp = headPoints(d, L);
  const R = d.bore / 2;
  const n = L.detailed ? 0 : L.baseFasteners;
  const nuts = Array.from({ length: n }, (_, k) => {
    const a = ((k + 0.5) / n) * Math.PI * 2;
    return zrod(0.0065, d.caseHalf + 0.01, d.caseHalf + 0.02, 6).translate(0.088 * Math.cos(a), 0.088 * Math.sin(a), 0);
  });
  // a spark plug along +y from its seat: hex, insulator, shielded elbow
  const plug = merge([
    new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6).translate(0, 0.006, 0),
    new THREE.CylinderGeometry(0.0065, 0.0075, 0.034, 12).translate(0, 0.029, 0),
  ]);
  const plugShield = new THREE.CylinderGeometry(0.0085, 0.0085, 0.016, 12).translate(0, 0.052, 0);
  // a port flange facing down (under the head) or up (on top)
  const port = (p: [number, number, number]) => {
    const k = p[1] < 0 ? 1 : -1;
    return merge([
      new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16).translate(p[0], p[1] - k * 0.004, p[2]),
      new THREE.BoxGeometry(0.07, 0.006, 0.05).translate(p[0], p[1] - k * 0.003, p[2]),
    ]);
  };
  const [y0, y1] = L.rockerBoxY;
  const castings = L.detailed ? cylinderBarrel(d) : undefined;
  const head =
    L.coversPerCylinder === 1
      ? lycomingHead(d, L)
      : {
          head: merge([
            finned(R + 0.016, 0.1, d.headIn, d.zPivot + 0.02, 12, false),
            zrod(R + 0.008, d.headIn - 0.004, d.deck + 0.004, 32),
          ]),
          rockerBox: slab(-0.048, 0.048, y0, y1, d.zPivot - 0.075, d.headOut - 0.012, 0.012),
          cover: merge([
            slab(-0.05, -0.002, y0 - 0.004, y1 + 0.004, d.headOut - 0.012, d.headOut, 0.014),
            slab(0.002, 0.05, y0 - 0.004, y1 + 0.004, d.headOut - 0.012, d.headOut, 0.014),
          ]),
        };
  return {
    barrel: castings?.barrel ?? finned(R + 0.006, R + 0.028, d.caseHalf + 0.012, d.headIn, 11),
    flange: castings?.flange ?? merge([zrod(R + 0.03, d.caseHalf, d.caseHalf + 0.01, 32), ...nuts]),
    ...head,
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
  hardware,
}: {
  sim: EngineSim;
  c: CylinderDef;
  i: number;
  d: Dims;
  mats: Mats;
  geo: CylGeo;
  hardware: Detail[];
}) {
  const L = layoutFor(sim.spec);
  const hp = useMemo(() => headPoints(d, L), [d, L]);
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
    if (mats.head.map) {
      // Keep a subtle temperature cue in the metal; the study palette carries the full CHT range.
      tmp.setRGB(tmp.r / 0.66, tmp.g / 0.7, tmp.b / 0.72);
      head.color.copy(mats.head.color).multiply(tmp).lerp(mats.head.color, 0.85);
    } else {
      head.color.copy(tmp);
      if (L.detailed) head.color.multiplyScalar(0.74);
    }
    // the plugs flash from the spark through early combustion
    const ph = phaseOf(spec, c.n, studyCrank(sim));
    const since = (ph + sparkBTC(spec, ui.controls.mags) + 720) % 720;
    const lit = since < 40 && s.rpm > 30;
    const fl = lit ? (s.cyl[i]?.work > 0.02 ? 1 - since / 40 : 0.35) : 0;
    const [top, bottom] = drawnSparks(spec, ui.controls.mags, ui.failures, s.rpm)[i];
    spark[0].opacity = top ? fl : 0;
    spark[1].opacity = bottom ? fl : 0;
  });
  const n = c.n;
  return (
    <group position={[c.x, 0, 0]} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
      <Details parts={hardware} mats={mats} suffix={`, cylinder ${n}`} />
      <P
        name={`Cylinder ${n} barrel`}
        spread={[0, 0, 0.05]}
        note="Finned barrel; the piston runs inside it."
        geometry={geo.barrel}
        material={mats.barrel}
      />
      <P
        name={`Cylinder ${n} base flange`}
        note={L.notes.baseFlange ?? "Hold-down nuts on studs clamp the cylinder to the crankcase."}
        geometry={geo.flange}
        material={mats.darkSteel}
      />
      <P
        name={`Cylinder ${n} head`}
        spread={[0, 0, 0.15]}
        note="Finned head with the valve seats and guides; tinted here by its cylinder head temperature."
        geometry={geo.head}
        material={head}
      />
      <P
        name={L.detailed ? `Rocker box, cylinder ${n}` : "Rocker box"}
        spread={[0, 0, 0.15]}
        note="Houses the rocker shafts and rockers."
        geometry={geo.rockerBox}
        material={head}
      />
      <P
        name={L.detailed ? `Rocker cover, cylinder ${n}` : "Rocker cover"}
        spread={[0, 0, 0.3]}
        note={L.notes.rockerCover ?? "Closes the rocker box on the outer end of the head."}
        geometry={geo.cover}
        material={mats.cover}
      />
      <P
        name={L.detailed ? `Intake port, cylinder ${n}` : "Intake port"}
        spread={[0, -0.06, 0.15]}
        note={L.notes.intakePort ?? "Tuned induction runner flange."}
        geometry={geo.intakePort}
        material={mats.darkSteel}
      />
      <P
        name={L.detailed ? `Exhaust port, cylinder ${n}` : "Exhaust port"}
        spread={[0, -0.06, 0.15]}
        note={L.notes.exhaustPort ?? "Exhaust pipe flange."}
        geometry={geo.exhaustPort}
        material={mats.darkSteel}
      />
      {/* the nozzle and plugs sit in the head but hide with their own systems' groups */}
      {sim.spec.fuelSystem.kind !== "carburetor" && (
        <Group sim={sim} id="fuel">
          <P
            name={`Fuel injection nozzle, cylinder ${n}`}
            spread={[0, 0.14, 0.15]}
            note={L.notes.nozzle ?? "Four injection nozzles, one per cylinder, fed from the fuel manifold (IOM p. 4)."}
            geometry={geo.nozzle}
            material={mats.nozzle}
          />
        </Group>
      )}
      <Group sim={sim} id="ignition">
        {[
          { at: hp.topPlug, rot: hp.tilt, s: hp.topSpark, which: "top" },
          { at: hp.botPlug, rot: Math.PI - hp.tilt, s: hp.botSpark, which: "bottom" },
        ].map((p, k) => (
          <Spread key={p.which} by={[0, p.which === "top" ? 0.12 : -0.12, 0.15]}>
            <group>
              <group position={p.at} rotation={[0, 0, p.rot]}>
                <P
                  name={`Spark plug, cylinder ${n} ${p.which}`}
                  note={
                    L.notes.plug ??
                    "Eight spark plugs, two per cylinder (IOM p. 2); each magneto fires one plug in every cylinder."
                  }
                  geometry={geo.plug}
                  material={mats.plug}
                />
                <P
                  name={L.detailed ? `Shielded lead terminal, cylinder ${n} ${p.which}` : "Shielded lead terminal"}
                  spread={[0, 0.04, 0]}
                  geometry={geo.plugShield}
                  material={mats.plugShield}
                />
              </group>
              <mesh geometry={geo.spark} material={spark[k]} position={p.s} raycast={() => null} />
            </group>
          </Spread>
        ))}
      </Group>
    </group>
  );
}

export function Cylinders({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const geo = useMemo(() => cylinderGeometry(d, L), [d, L]);
  const hardware = useMemo(() => cylinderHardware(d, L), [L, d]);
  useDetailDisposal(hardware);
  const baffles = useMemo(() => (L.detailed ? coolingBaffles(d, !L.parallelValve) : []), [L, d]);
  useDetailDisposal(baffles);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      <Assembly id="installation">
        <Details parts={baffles} mats={mats} />
      </Assembly>
      {sim.spec.geometry.cylinders.map((c, i) => (
        <Assembly key={c.n} id={`cylinder-${c.n}`}>
          <Spread by={cylinderSpread(c, 0.29)}>
            <Cylinder sim={sim} c={c} i={i} d={d} mats={mats} geo={geo} hardware={hardware} />
          </Spread>
        </Assembly>
      ))}
    </>
  );
}
