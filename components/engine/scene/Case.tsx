"use client";
/**
 * Crankcase, sump and accessory housing, and the lubrication system: two case halves joined at the vertical centre
 * plane, the sump under them, the accessory housing on the rear; wet sump, oil pump and its drive, suction screen, filter,
 * filler and dipstick, drain plug and the oil lines. Shapes are schematic; each engine's notes cite its documents.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EngineSim } from "../store";
import {
  D2R,
  gear,
  gearSpins,
  merge,
  oilFiller,
  oilFilterPose,
  oilPump,
  rod,
  slab,
  toWorld,
  tube,
  zrod,
  type Dims,
  type Mats,
} from "./kit";
import { layoutFor, type EngineLayout } from "./layout";
import { P } from "./parts";

/** The crankcase, accessory housing and sump geometries. */
export function caseGeometry(d: Dims, L: EngineLayout) {
  const bolts: THREE.BufferGeometry[] = [];
  for (let x = d.caseRear + 0.03; x < d.front - 0.01; x += 0.055)
    bolts.push(
      zrod(0.004, -0.02, 0.02, 8).translate(x, d.caseTop + 0.004, 0),
      zrod(0.0075, 0.012, 0.02, 6).translate(x, d.caseTop + 0.004, 0),
    );
  const M = L.mounts(d);
  const mounts = M.bosses.map(([x, y, z]) => rod(0.02, 0.045, 16).translate(x, y, z));
  return {
    right: slab(d.caseRear, d.front, d.caseBottom, d.caseTop, 0.002, d.caseHalf, 0.035),
    left: slab(d.caseRear, d.front, d.caseBottom, d.caseTop, -d.caseHalf, -0.002, 0.035),
    flange: slab(d.caseRear, d.front, d.caseTop - 0.01, d.caseTop + 0.012, -0.01, 0.01, 0.004),
    bolts: merge(bolts),
    nose: rod(0.05, 0.034, 28).translate(d.front + 0.017, 0, 0),
    mounts: merge(mounts),
    ...(M.brackets.length ? { brackets: merge(M.brackets.map(([a, b]) => tube([a, b], 0.009, 4, 8))) } : {}),
    acc: slab(d.accRear, d.caseRear, d.accBottom, d.accTop, -0.125, 0.125, 0.03),
    sump: slab(d.caseRear + 0.005, d.front - 0.04, d.sumpBottom, d.caseBottom + 0.01, -0.12, 0.12, 0.03),
  };
}

export function Crankcase({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const geo = useMemo(() => caseGeometry(d, L), [d, L]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      <P
        name="Crankcase, right half"
        note={
          L.notes.crankcaseRight ??
          "Two cast halves joined at the vertical centreline by thru-studs, bolts and nuts; the crankcase forms the camshaft bearings and holds the main bearing inserts (IOM p. 2)."
        }
        geometry={geo.right}
        material={mats.case}
      />
      <P
        name="Crankcase, left half"
        note={
          L.notes.crankcaseLeft ??
          "Two cast halves joined at the vertical centreline by thru-studs, bolts and nuts (IOM p. 2)."
        }
        geometry={geo.left}
        material={mats.case}
      />
      <P name="Crankcase parting flange" note="Where the two halves meet." geometry={geo.flange} material={mats.case} />
      <P
        name="Crankcase bolts"
        note={L.notes.crankcaseBolts ?? "Bolts and nuts along the parting flange (IOM p. 2)."}
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
        note={L.notes.mounts ?? "Mounting points to the airframe's engine mount."}
        geometry={geo.mounts}
        material={mats.darkSteel}
      />
      {geo.brackets && (
        <P
          name="Engine mount brackets"
          note={L.notes.mounts ?? "Mounting points to the airframe's engine mount."}
          geometry={geo.brackets}
          material={mats.darkSteel}
        />
      )}
      <P
        name="Accessory housing"
        note={
          L.notes.accessoryHousing ??
          "On the rear of the crankcase: carries the magnetos, fuel pump, oil pump and filter, and the gears that drive them (IOM Figures 1B, 5, 7, 8)."
        }
        geometry={geo.acc}
        material={mats.acc}
      />
      <P
        name="Oil sump"
        note={L.notes.sump ?? "Wet sump under the crankcase holding the engine's oil (IOM p. 5)."}
        geometry={geo.sump}
        material={mats.sump}
      />
    </>
  );
}

export function Lubrication({ sim, d, mats }: { sim: EngineSim; d: Dims; mats: Mats }) {
  const L = layoutFor(sim.spec);
  const PUMP = useMemo(() => oilPump(d, L), [d, L]);
  const { spins } = useMemo(() => gearSpins(sim.spec, d, L), [sim, d, L]);
  const geo = useMemo(() => {
    const filler = oilFiller(d, L);
    const F = oilFilterPose(d, L);
    const [fx, fy, fz] = F.centre;
    const vertical = L.oilFilter.mount === "vertical";
    // a vertical filter's adapter: under the canister, reaching forward to the accessory face
    const adapterY = fy - F.len / 2 - 0.015;
    const oilLines = vertical
      ? {
          pressure: tube(
            [
              [d.caseRear + PUMP.x1, PUMP.y + 0.026, PUMP.gearR],
              [d.caseRear + PUMP.x1 - 0.004, PUMP.y + 0.04, fz * 0.4],
              [d.accRear + 0.006, adapterY, fz + 0.012],
              [d.accRear - 0.004, adapterY, fz + 0.012],
            ],
            0.006,
          ),
          supply: tube(
            [
              [d.accRear - 0.004, adapterY, fz - 0.012],
              [d.accRear + 0.012, adapterY + 0.03, fz - 0.012],
              [d.caseRear - 0.004, 0.05, -0.06],
              [d.caseRear + 0.04, 0.05, -0.06],
            ],
            0.006,
          ),
        }
      : {
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
    return {
      oil: new THREE.BoxGeometry(d.front - 0.05 - (d.caseRear + 0.015), 1, 0.22).translate(
        (d.front - 0.05 + d.caseRear + 0.015) / 2,
        0.5,
        0,
      ),
      filter: vertical
        ? merge([
            // the canister and the hex on its top
            new THREE.CylinderGeometry(F.r, F.r, F.len, 28).translate(fx, fy, fz),
            new THREE.CylinderGeometry(0.012, 0.012, 0.014, 6).translate(fx, fy + F.len / 2 + 0.007, fz),
          ])
        : merge([
            rod(0.045, 0.1, 28).translate(d.accRear - 0.05, 0.015, 0),
            rod(0.012, 0.014, 6).translate(d.accRear - 0.107, 0.015, 0),
          ]),
      filterAdapter: vertical
        ? slab(fx - 0.03, d.accRear, adapterY - 0.015, adapterY + 0.015, fz - 0.028, fz + 0.028, 0.006)
        : null,
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
      dipTube: tube(filler.tube, 0.009, 24, 10),
      dipCap: new THREE.CylinderGeometry(0.014, 0.014, 0.018, 14).translate(...filler.cap),
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
      ...oilLines,
    };
  }, [d, L, PUMP]);
  const oilMat = useMemo(() => {
    const m = mats.oil.clone();
    m.transparent = true;
    m.opacity = 0.75;
    return m;
  }, [mats]);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g?.dispose());
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
    // the drive gear turns against the crankshaft gear (or with the camshaft), the second pumping gear against it
    const a = ((sim.anim.crank * spins.oilPump) % 360) * D2R;
    const [drive, pump, idler] = gears.current;
    if (drive) drive.rotation.x = a + Math.PI / 12;
    if (pump) pump.rotation.x = a;
    if (idler) idler.rotation.x = ((sim.anim.crank * spins.oilPumpIdler) % 360) * D2R + Math.PI / 10;
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
      {/* named for its label, which the filter's own parts don't hide (kit.ts labelOccluder) */}
      <group name="Oil filter">
        <P
          name="Oil filter"
          note={L.notes.oilFilter ?? "Full-flow oil filter on the accessory housing (IOM p. 5, Figure 8)."}
          geometry={geo.filter}
          material={mats.filter}
        />
        {geo.filterAdapter && L.oilFilter.mount === "vertical" && (
          <P
            name="Oil filter adapter"
            note={`Bolted to the oil pump housing; the spin-on filter stands on its upward boss (${L.oilFilter.src}). Shape approximate.`}
            geometry={geo.filterAdapter}
            material={mats.acc}
          />
        )}
      </group>
      <P
        name="Oil pump"
        note={
          L.notes.oilPump ??
          "Draws oil from the sump through the suction screen and sends it to the filter (IOM p. 5, Figure 8)."
        }
        geometry={geo.pumpBody}
        material={mats.acc}
      />
      {!PUMP.onCam && (
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
      )}
      {[0, 2 * PUMP.gearR].map((z, k) => (
        <P
          key={z}
          name="Oil pump gears"
          note={
            PUMP.onCam && k === 0
              ? L.notes.oilPumpDrive
              : "Two meshing gears carry oil around the outside of the pump body from the suction side to the pressure side."
          }
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
        note={L.notes.screen ?? "Strains the oil on its way from the sump to the pump (IOM p. 5)."}
        geometry={geo.screen}
        material={mats.steel}
      />
      <P
        name="Suction screen plug"
        note={L.notes.screenPlug ?? "Removed to take out the suction screen (IOM p. 5)."}
        geometry={geo.screenPlug}
        material={mats.darkSteel}
      />
      <P
        name="Oil sump drain plug"
        note={L.notes.drain ?? "Drain plug on the oil sump (IOM p. 5)."}
        geometry={geo.drain}
        material={mats.darkSteel}
      />
      <P
        name="Oil level gage tube"
        note={L.notes.dipTube ?? "Oil fill tube and oil level gage, the dipstick (IOM p. 21)."}
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
        note={
          L.notes.oilSupply ??
          "From the filter into the crankcase, where the oil feeds the engine and the four piston-cooling nozzles."
        }
        geometry={geo.supply}
        material={mats.oil}
      />
      {sim.spec.oil.pistonCoolingJets &&
        sim.spec.geometry.cylinders.map((c) => (
          <group key={c.n} position={toWorld(c, [0, 0, 0])} rotation={[0, c.side === "L" ? Math.PI : 0, 0]}>
            <P
              name="Piston cooling oil nozzle"
              note={L.notes.pistonOil ?? "Four oil nozzles supply oil for internal piston cooling (IOM p. 2)."}
              geometry={geo.nozzle}
              material={mats.oil}
            />
          </group>
        ))}
    </>
  );
}
