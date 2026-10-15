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
import { D2R, gear, merge, oilPump, rod, slab, toWorld, tube, zrod, type Dims, type Mats } from "./kit";
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
      acc: slab(d.accRear, d.caseRear, -0.13, 0.235, -0.125, 0.125, 0.03),
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
  const PUMP = useMemo(() => oilPump(d), [d]);
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
      // driven off the crankshaft gear: a drive gear meshing below it, its shaft running aft to the pumping gears
      pumpDrive: merge([
        gear(PUMP.driveR, PUMP.driveTeeth, 0.014, 0.004),
        rod(0.006, PUMP.x0 - PUMP.x1 + 0.012, 10).translate((PUMP.x1 - PUMP.x0) / 2, 0, 0),
      ]),
      pumpGear: gear(PUMP.gearR, 10, 0.012, 0.004),
      pumpBody: slab(
        PUMP.x1 - 0.01,
        PUMP.x1 + 0.01,
        PUMP.y - 0.026,
        PUMP.y + 0.026,
        -0.024,
        2 * PUMP.gearR + 0.024,
        0.012,
      ).translate(d.caseRear, 0, 0),
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
      suction: tube(
        [
          [d.caseRear + 0.012, d.sumpBottom + 0.025, 0],
          [d.caseRear - 0.004, d.sumpBottom + 0.03, 0.01],
          [d.caseRear + PUMP.x1 - 0.004, PUMP.y - 0.05, PUMP.gearR],
          [d.caseRear + PUMP.x1, PUMP.y - 0.026, PUMP.gearR],
        ],
        0.007,
      ),
      pressure: tube(
        [
          [d.caseRear + PUMP.x1, PUMP.y + 0.026, PUMP.gearR],
          [d.caseRear + PUMP.x1 - 0.004, PUMP.y + 0.05, 0.05],
          [d.accRear + 0.006, 0.0, 0.05],
          [d.accRear - 0.004, 0.015, 0.03],
        ],
        0.006,
      ),
      supply: tube(
        [
          [d.accRear - 0.004, 0.015, -0.03],
          [d.accRear + 0.012, 0.035, -0.05],
          [d.caseRear - 0.004, 0.05, -0.06],
          [d.caseRear + 0.04, 0.05, -0.06],
        ],
        0.006,
      ),
    };
  }, [d, PUMP]);
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
  const gears = useRef<(THREE.Mesh | null)[]>([]); // drive, pumping gear on its shaft, idler
  const tmp = useMemo(() => new THREE.Color(), []);
  const full = sim.spec.limits.oilSumpQt.value;
  useFrame(() => {
    const qt = sim.useUi.getState().env.oilQt;
    if (level.current)
      level.current.scale.y = Math.max(0.001, Math.min(1.25, qt / full) * (d.caseBottom - d.sumpBottom - 0.01));
    tmp.setRGB(0.55 + Math.min(0.35, (sim.s.oilT - 60) / 500), 0.32, 0.17);
    oilMat.color.copy(tmp);
    // the drive gear turns the other way from the crankshaft gear, faster by their tooth ratio
    const a = -((sim.anim.crank * PUMP.ratio) % 360) * D2R;
    const [drive, pump, idler] = gears.current;
    if (drive) drive.rotation.x = a + Math.PI / 12;
    if (pump) pump.rotation.x = a;
    if (idler) idler.rotation.x = -a + Math.PI / 10;
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
        note="Draws oil from the sump through the suction screen and sends it to the filter (IOM p. 5, Figure 8)."
        geometry={geo.pumpBody}
        material={mats.acc}
      />
      <P
        name="Oil pump drive gear"
        note="Meshes with the crankshaft gear and turns the pump through its shaft. Drawn at twice crankshaft speed: the IOM doesn't give the oil pump's drive ratio."
        geometry={geo.pumpDrive}
        material={mats.gear}
        position={[d.caseRear - 0.018, PUMP.y, 0]}
        meshRef={(m) => {
          gears.current[0] = m;
        }}
      />
      {[0, 2 * PUMP.gearR].map((z, k) => (
        <P
          key={z}
          name="Oil pump gears"
          note="Two meshing gears carry oil around the outside of the pump body from the suction side to the pressure side."
          geometry={geo.pumpGear}
          material={mats.gear}
          position={[d.caseRear + PUMP.x1, PUMP.y, z]}
          meshRef={(m) => {
            gears.current[k + 1] = m;
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
      <P
        name="Oil suction line"
        note="From the suction screen in the sump to the pump."
        geometry={geo.suction}
        material={mats.oil}
      />
      <P name="Oil pressure line" note="From the pump to the oil filter." geometry={geo.pressure} material={mats.oil} />
      <P
        name="Filtered oil line"
        note="From the filter into the crankcase, where the oil feeds the engine and the four piston-cooling nozzles."
        geometry={geo.supply}
        material={mats.oil}
      />
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
