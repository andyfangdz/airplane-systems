"use client";
/**
 * Crankcase, sump and accessory housing, and the lubrication system. The crankcase "is made up of two cast halves
 * attached by a series of thru-studs, bolts and nuts" (IOM p. 2, Figure 3); the lubrication system has "a wet sump, oil
 * pump, oil fill/dipstick, oil suction screen, full flow oil filter or pressure screen, and oil lines", a drain plug on
 * the sump and another plug for removing the suction screen (IOM p. 5, Figure 8). Shapes are schematic.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EngineSim } from "../store";
import { D2R, gear, merge, rod, slab, toWorld, tube, zrod, type Dims, type Mats } from "./kit";
import { P } from "./parts";

export function Crankcase({ d, mats }: { d: Dims; mats: Mats }) {
  const geo = useMemo(() => {
    const bolts: THREE.BufferGeometry[] = [];
    for (let x = d.caseRear + 0.03; x < d.front - 0.01; x += 0.055)
      bolts.push(
        zrod(0.004, -0.02, 0.02, 8).translate(x, d.caseTop + 0.004, 0),
        zrod(0.0075, 0.012, 0.02, 6).translate(x, d.caseTop + 0.004, 0),
      );
    const mounts = [1, -1].flatMap((y) =>
      [1, -1].map((z) => rod(0.02, 0.045, 16).translate(d.caseRear + 0.012, y * 0.075, z * (d.caseHalf - 0.025))),
    );
    return {
      right: slab(d.caseRear, d.front, d.caseBottom, d.caseTop, 0.002, d.caseHalf, 0.035),
      left: slab(d.caseRear, d.front, d.caseBottom, d.caseTop, -d.caseHalf, -0.002, 0.035),
      flange: slab(d.caseRear, d.front, d.caseTop - 0.01, d.caseTop + 0.012, -0.01, 0.01, 0.004),
      bolts: merge(bolts),
      nose: rod(0.05, 0.034, 28).translate(d.front + 0.017, 0, 0),
      mounts: merge(mounts),
      acc: slab(d.accRear, d.caseRear, -0.13, 0.205, -0.125, 0.125, 0.03),
      sump: slab(d.caseRear + 0.005, d.front - 0.04, d.sumpBottom, d.caseBottom + 0.01, -0.12, 0.12, 0.03),
    };
  }, [d]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      <P
        name="Crankcase, right half"
        note="Two cast halves joined at the vertical centreline by thru-studs, bolts and nuts; the crankcase forms the camshaft bearings and holds the main bearing inserts (IOM p. 2)."
        geometry={geo.right}
        material={mats.case}
      />
      <P
        name="Crankcase, left half"
        note="Two cast halves joined at the vertical centreline by thru-studs, bolts and nuts (IOM p. 2)."
        geometry={geo.left}
        material={mats.case}
      />
      <P name="Crankcase parting flange" note="Where the two halves meet." geometry={geo.flange} material={mats.case} />
      <P
        name="Crankcase bolts"
        note="Bolts and nuts along the parting flange (IOM p. 2)."
        geometry={geo.bolts}
        material={mats.darkSteel}
      />
      <P
        name="Crankshaft nose housing"
        note="The front main bearing's housing; the crankshaft nose leaves the case here."
        geometry={geo.nose}
        material={mats.case}
      />
      <P
        name="Engine mount bosses"
        note="Mounting points to the airframe's engine mount."
        geometry={geo.mounts}
        material={mats.darkSteel}
      />
      <P
        name="Accessory housing"
        note="On the rear of the crankcase: carries the magnetos, fuel pump, oil pump and filter, and the gears that drive them (IOM Figures 1B, 5, 7, 8)."
        geometry={geo.acc}
        material={mats.acc}
      />
      <P
        name="Oil sump"
        note="Wet sump under the crankcase holding the engine's oil (IOM p. 5)."
        geometry={geo.sump}
        material={mats.sump}
      />
    </>
  );
}

export function Lubrication({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const geo = useMemo(() => {
    const top = d.caseRear - 0.005;
    return {
      oil: new THREE.BoxGeometry(d.front - 0.05 - (d.caseRear + 0.015), 1, 0.22).translate(
        (d.front - 0.05 + d.caseRear + 0.015) / 2,
        0.5,
        0,
      ),
      filter: merge([
        rod(0.045, 0.1, 28).translate(d.accRear - 0.05, 0.015, 0),
        rod(0.012, 0.014, 6).translate(d.accRear - 0.107, 0.015, 0),
      ]),
      pumpGear: gear(0.018, 10, 0.016, 0.004),
      pumpBody: rod(0.04, 0.03, 20).translate(d.caseRear - 0.035, -0.075, 0),
      screen: rod(0.014, 0.075, 14).translate(d.caseRear + 0.05, d.sumpBottom + 0.025, 0),
      screenPlug: rod(0.012, 0.01, 6).translate(d.caseRear, d.sumpBottom + 0.025, 0),
      drain: new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6).translate(-0.04, d.sumpBottom - 0.007, 0.06),
      dipTube: tube(
        [
          [d.caseRear + 0.04, d.caseBottom - 0.02, 0.105],
          [d.caseRear + 0.02, 0.06, 0.13],
          [top, 0.2, 0.13],
        ],
        0.009,
        24,
        10,
      ),
      dipCap: new THREE.CylinderGeometry(0.014, 0.014, 0.018, 14).translate(top, 0.209, 0.13),
      nozzle: zrod(0.0035, d.caseHalf - 0.04, d.caseHalf - 0.008, 8).translate(0, -0.05, 0),
      lines: merge([
        tube(
          [
            [d.accRear - 0.004, -0.06, 0.03],
            [d.accRear - 0.03, -0.11, 0.09],
            [d.accRear - 0.06, -0.05, 0.08],
            [d.accRear - 0.06, 0.0, 0.045],
          ],
          0.006,
        ),
      ]),
    };
  }, [d]);
  const oilMat = useMemo(() => {
    const m = mats.oil.clone();
    m.transparent = true;
    m.opacity = 0.75;
    return m;
  }, [mats]);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      oilMat.dispose();
    },
    [geo, oilMat],
  );
  const level = useRef<THREE.Mesh>(null);
  const gears = useRef<(THREE.Mesh | null)[]>([]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const full = sim.spec.limits.oilSumpQt.value;
  useFrame(() => {
    const qt = sim.useUi.getState().env.oilQt;
    if (level.current)
      level.current.scale.y = Math.max(0.001, Math.min(1.25, qt / full) * (d.caseBottom - d.sumpBottom - 0.01));
    tmp.setRGB(0.55 + Math.min(0.35, (sim.s.oilT - 60) / 500), 0.32, 0.17);
    oilMat.color.copy(tmp);
    const a = (sim.anim.crank % 360) * D2R;
    if (gears.current[0]) gears.current[0].rotation.x = a;
    if (gears.current[1]) gears.current[1].rotation.x = -a + Math.PI / 10;
  });
  return (
    <>
      <mesh
        ref={level}
        geometry={geo.oil}
        material={oilMat}
        position={[0, d.sumpBottom + 0.005, 0]}
        raycast={() => null}
      />
      <P
        name="Oil filter"
        note="Full-flow oil filter on the accessory housing (IOM p. 5, Figure 8)."
        geometry={geo.filter}
        material={mats.filter}
      />
      <P
        name="Oil pump"
        note="Draws oil from the sump through the suction screen and sends it to the filter (IOM Figure 8)."
        geometry={geo.pumpBody}
        material={mats.acc}
      />
      {[0.017, -0.017].map((z, k) => (
        <P
          key={z}
          name="Oil pump gear"
          geometry={geo.pumpGear}
          material={mats.gear}
          position={[d.caseRear - 0.035, -0.075, z]}
          meshRef={(m) => {
            gears.current[k] = m;
          }}
        />
      ))}
      <P
        name="Oil suction screen"
        note="Strains the oil on its way from the sump to the pump (IOM p. 5)."
        geometry={geo.screen}
        material={mats.steel}
      />
      <P
        name="Suction screen plug"
        note="Removed to take out the suction screen (IOM p. 5)."
        geometry={geo.screenPlug}
        material={mats.darkSteel}
      />
      <P
        name="Oil sump drain plug"
        note="Drain plug on the oil sump (IOM p. 5)."
        geometry={geo.drain}
        material={mats.darkSteel}
      />
      <P
        name="Oil level gage tube"
        note="Oil fill tube and oil level gage, the dipstick (IOM p. 21)."
        geometry={geo.dipTube}
        material={mats.acc}
      />
      <P
        name="Oil filler cap and dipstick"
        note="Check the level here; the panel's oil quantity sets the level drawn in the sump."
        geometry={geo.dipCap}
        material={mats.magCap}
      />
      <P name="Oil line" geometry={geo.lines} material={mats.oil} />
      {sim.spec.geometry.cylinders.map((c) => (
        <group key={c.n} position={toWorld(c, [0, 0, 0])} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
          <P
            name="Piston cooling oil nozzle"
            note="Four oil nozzles supply oil for internal piston cooling (IOM p. 2)."
            geometry={geo.nozzle}
            material={mats.oil}
          />
        </group>
      ))}
    </>
  );
}
