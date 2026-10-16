"use client";
/**
 * The governor cut away on the engine's governor pad, its oil line through the crankshaft to the propeller hub, and
 * the hub with its pitch-change piston and the roots of three blades. Parts follow the FAA handbook's governor figures
 * (FAA-H-8083-32B Figures 7-15 to 7-19) and its non-feathering hub (Figure 7-24); sizes and shapes are schematic, and
 * the pilot valve's movement is drawn four times larger than it is. Everything moves from the simulation in `useFrame`.
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeMats, coil, gear, merge, rod, slab, tube, type Mats } from "../../engine/scene/kit";
import { P } from "../../engine/scene/parts";
import { ComponentStage } from "../ComponentStage";
import { springSet } from "@/engines/components/governor/model";
import { AMT } from "@/engines/components/governor/spec";
import { anim, s, spec, useGov, useGovView } from "./store";

type V3 = [number, number, number];

/** Pilot valve movement is drawn this many times larger. */
const MAGNIFY = 4;
/** Hub: where its axis meets the crankshaft nose, and the pitch-change piston's drawn stroke. */
const HUB: V3 = [0.3, -0.06, 0];
const STROKE = 0.045;
const BLADE_R0 = 0.05,
  BLADE_LEN = 0.22;

const NOTE = {
  body: `Mounts on the engine's governor pad and is driven by an engine gear. An engine rpm-sensing device and high-pressure oil pump (${AMT} pp. 7-8, 7-9).`,
  shaft: `Drive gear shaft: turns at ${spec.engine.driveRatio} × crankshaft speed on the IO-390's front governor drive (IOM Table A-4). Hollow: the pilot valve slides inside it.`,
  pump: `Gear pump: boosts engine oil to the pressure the pitch-change mechanism needs, approximately 300 psi (${AMT} pp. 7-6, 7-9).`,
  relief: `Relief valve: limits the pump's pressure, "set 275 psi" in the handbook's typical governor (${AMT} Figure 7-16). Oil it lets by returns to the pump inlet.`,
  head: `Flyweight head: turns with the drive shaft and carries the flyweights (${AMT} Figure 7-16).`,
  flyweight: `Flyweight: centrifugal force tilts it outward and its toe lifts the pilot valve against the speeder spring. Faster than the set speed they fly out (overspeed); slower they tilt in (underspeed) (${AMT} pp. 7-9 to 7-11).`,
  valve: `Pilot valve plunger: its land covers the metering port when on speed. Raised by the flyweights or lowered by the speeder spring, it opens the propeller line to the pump's oil or to drain (${AMT} pp. 7-9, 7-11). Its movement is drawn ${MAGNIFY} times larger.`,
  spring: `Speeder spring: opposes the flyweights. Its compression, set by the propeller control, sets the speed at which the flyweights centre the pilot valve (${AMT} pp. 7-9, 7-11).`,
  rack: `Adjusting rack and lift rod: the only part moved by hand. The propeller control turns the speed adjusting lever, which raises or lowers it to change the speeder spring's compression (${AMT} p. 7-12, Figure 7-16).`,
  lever: `Speed adjusting control lever, cabled to the propeller control (in the SR20, to the single power lever) (${AMT} Figure 7-16).`,
  engine: "The front of the engine, schematic: the governor pad on top, the crankshaft's nose below.",
  crank: "Crankshaft nose: governor oil reaches the hub through the hollow crankshaft (schematic).",
  line: `Propeller control line: from the governor's metering port to the hub's piston (${AMT} Figure 7-16).`,
  hub: `Propeller hub: carries the blades and the pitch-change mechanism. ${spec.propeller.name}, ${spec.propeller.blades} blades, ${spec.propeller.diameterIn} in (SR20 POH 7-40).`,
  cylinder: `Hydraulic cylinder and piston, on the front of the hub: the piston is linked to the blades, so as it moves they turn in proportion (${AMT} pp. 7-9, 7-14).`,
  springHub: `Return spring: with the blades' centrifugal twisting moment it drives them to low pitch when oil drains (${AMT} Figure 7-24; SR20 AMM 61-10 p. 1).`,
  rod: `Pitch-change rod and fork: carry the piston's movement to pins on the blade roots (${AMT} pp. 7-14, 7-15).`,
  blade: `Blade (drawn shortened). Its angle at 75 % radius runs between the model's ${spec.propeller.fineDeg}° low-pitch stop and ${spec.propeller.coarseDeg}° (not Hartzell data).`,
  counterweight: `Counterweight: on a counterweighted hub it turns the blade toward high pitch, and governor oil drives it to low pitch (${AMT} p. 7-14).`,
};

const BLADE = new THREE.MeshStandardMaterial({ color: "#8a949c", metalness: 0.3, roughness: 0.5 });

const OIL = {
  engine: new THREE.MeshBasicMaterial({ color: "#d9a441" }),
  boost: new THREE.MeshBasicMaterial({ color: "#e0522b" }),
  drain: new THREE.MeshBasicMaterial({ color: "#8a6d4b" }),
};

/** Oil particles running along a path at a signed speed (path lengths per second); none while it is 0. */
function Flow({ points, mat, rate }: { points: V3[]; mat: THREE.Material; rate: () => number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const geo = useMemo(() => new THREE.SphereGeometry(0.0032, 8, 6), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(0);
  const N = 9;
  useFrame((_, dt) => {
    const r = useGovView.getState().paused ? 0 : rate();
    phase.current = (phase.current + r * Math.min(dt, 0.1) + 1) % 1;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = r !== 0;
      if (r !== 0) m.position.copy(curve.getPointAt((phase.current + i / N) % 1));
    });
  });
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={geo}
          material={mat}
          renderOrder={2}
        />
      ))}
    </>
  );
}

/** A geometry made once and disposed with the component. */
function useGeo<T extends THREE.BufferGeometry>(make: () => T) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, []);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

const yAxis = (g: THREE.BufferGeometry) => g.rotateZ(Math.PI / 2); // kit builders run along x; turn them upright

function Governor({ mats }: { mats: Mats }) {
  const body = useGeo(() =>
    merge([
      new THREE.CylinderGeometry(0.042, 0.042, 0.118, 32, 1, true).translate(0, 0.071, 0),
      new THREE.SphereGeometry(0.042, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.13, 0),
    ]),
  );
  const pumpHousing = useGeo(() => slab(-0.03, 0.062, 0.004, 0.042, -0.034, 0.034, 0.012));
  const base = useGeo(() => new THREE.CylinderGeometry(0.058, 0.058, 0.008, 32).translate(0, 0.004, 0));
  const shaft = useGeo(() =>
    merge([
      yAxis(rod(0.009, 0.135, 20)).translate(0, 0.0225, 0),
      yAxis(gear(0.016, 12, 0.012)).translate(0, -0.038, 0),
    ]),
  );
  const pumpGear = useGeo(() => yAxis(gear(0.015, 12, 0.014)));
  const head = useGeo(() => new THREE.CylinderGeometry(0.026, 0.024, 0.008, 28).translate(0, 0.092, 0));
  // L-shaped flyweight about its pivot: an upright arm outboard, the toe reaching in under the valve's bearing
  const flyweight = useGeo(() =>
    merge([
      new THREE.BoxGeometry(0.008, 0.03, 0.012).translate(0.002, 0.016, 0),
      new THREE.BoxGeometry(0.015, 0.004, 0.008).translate(-0.007, 0, 0),
      yAxis(rod(0.0022, 0.014, 10))
        .rotateZ(Math.PI / 2)
        .rotateX(Math.PI / 2),
    ]),
  );
  const valve = useGeo(() =>
    merge([
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.078, 14).translate(0, 0.067, 0),
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.008, 18).translate(0, 0.055, 0), // land
      new THREE.CylinderGeometry(0.0062, 0.0062, 0.005, 18).translate(0, 0.035, 0),
      new THREE.CylinderGeometry(0.008, 0.008, 0.004, 18).translate(0, 0.104, 0), // bearing
    ]),
  );
  const spring = useGeo(() => coil(0.011, 0.0013, 0, 1, 7).rotateX(-Math.PI / 2));
  const rack = useGeo(() =>
    merge([
      new THREE.CylinderGeometry(0.013, 0.013, 0.004, 20).translate(0, 0.002, 0),
      new THREE.CylinderGeometry(0.004, 0.004, 0.034, 12).translate(0, 0.019, 0),
    ]),
  );
  const lever = useGeo(() =>
    merge([
      yAxis(rod(0.004, 0.012, 12)).rotateX(Math.PI / 2),
      new THREE.BoxGeometry(0.06, 0.006, 0.006).translate(0.03, 0, 0),
      new THREE.SphereGeometry(0.006, 12, 8).translate(0.06, 0, 0),
    ]),
  );
  const reliefBody = useGeo(() => rod(0.008, 0.034, 16).translate(-0.059, 0.024, 0));
  const reliefPoppet = useGeo(() => new THREE.SphereGeometry(0.0055, 12, 8));
  const reliefSpring = useGeo(() => coil(0.004, 0.0008, 0, 1, 5).rotateY(-Math.PI / 2));

  const shaftRef = useRef<THREE.Group>(null);
  const pump = useRef<THREE.Mesh>(null),
    idler = useRef<THREE.Mesh>(null);
  // separate hooks, not hooks inside an array literal: React Compiler would memoize the array and skip them
  const fw0 = useRef<THREE.Group>(null),
    fw1 = useRef<THREE.Group>(null);
  const valveRef = useRef<THREE.Group>(null);
  const springRef = useRef<THREE.Mesh>(null);
  const rackRef = useRef<THREE.Group>(null);
  const leverRef = useRef<THREE.Group>(null);
  const poppet = useRef<THREE.Mesh>(null),
    rSpring = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const ui = useGov.getState();
    const a = anim.gov * Math.PI * 2;
    if (shaftRef.current) shaftRef.current.rotation.y = a;
    if (pump.current) pump.current.rotation.y = a;
    if (idler.current) idler.current.rotation.y = -a + Math.PI / 12;
    const lift = (s.x / 1000) * MAGNIFY;
    if (valveRef.current) valveRef.current.position.y = lift;
    // the toes lift the bearing as far as the valve moves
    const tilt = Math.atan2(lift, 0.014);
    for (const r of [fw0, fw1]) if (r.current) r.current.rotation.z = -tilt;
    // rack: the speeder spring's compression (mm) moves it down, drawn at 1.2 times
    const rackY = 0.152 - (springSet(spec, ui.controls.lever) - springSet(spec, 0)) * 0.0012;
    if (rackRef.current) rackRef.current.position.y = rackY;
    if (leverRef.current) leverRef.current.rotation.z = 0.35 - ui.controls.lever * 0.7;
    if (springRef.current) {
      const bottom = 0.106 + lift;
      const broken = ui.failures.brokenSpring;
      springRef.current.position.y = broken ? rackY - 0.015 : bottom;
      springRef.current.scale.y = broken ? 0.015 : Math.max(rackY - bottom, 0.005);
      springRef.current.material = broken ? mats.valveE : mats.spring;
    }
    const open = s.relief ? 1 : 0;
    if (poppet.current) poppet.current.position.x = -0.046 - 0.004 * open;
    if (rSpring.current) rSpring.current.scale.x = 0.022 - 0.004 * open;
  });

  return (
    <group>
      <P name="Governor body" note={NOTE.body} geometry={body} material={mats.case} />
      <P name="Pump body and mounting base" note={NOTE.pump} geometry={pumpHousing} material={mats.acc} />
      <P name="Mounting flange" note={NOTE.body} geometry={base} material={mats.acc} />
      <group ref={shaftRef}>
        <P name="Drive gear shaft" note={NOTE.shaft} geometry={shaft} material={mats.steel} />
        <P name="Flyweight head" note={NOTE.head} geometry={head} material={mats.darkSteel} />
        {[1, -1].map((side, i) => (
          <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <group ref={i ? fw1 : fw0} position={[0.02, 0.098, 0]}>
              <P name="Flyweight" note={NOTE.flyweight} geometry={flyweight} material={mats.gear} />
            </group>
          </group>
        ))}
      </group>
      <P
        name="Pump drive gear"
        note={NOTE.pump}
        geometry={pumpGear}
        material={mats.gear}
        meshRef={pump}
        position={[0, 0.022, 0]}
      />
      <P
        name="Pump idler gear"
        note={NOTE.pump}
        geometry={pumpGear}
        material={mats.gear}
        meshRef={idler}
        position={[0.03, 0.022, 0]}
      />
      <group ref={valveRef}>
        <P name="Pilot valve plunger" note={NOTE.valve} geometry={valve} material={mats.valveI} />
      </group>
      <P name="Speeder spring" note={NOTE.spring} geometry={spring} material={mats.spring} meshRef={springRef} />
      <group ref={rackRef}>
        <P name="Adjusting rack and lift rod" note={NOTE.rack} geometry={rack} material={mats.darkSteel} />
      </group>
      <group ref={leverRef} position={[0, 0.19, 0]}>
        <P name="Speed adjusting control lever" note={NOTE.lever} geometry={lever} material={mats.black} />
      </group>
      <P name="Relief valve" note={NOTE.relief} geometry={reliefBody} material={mats.acc} />
      <P
        name="Relief valve poppet"
        note={NOTE.relief}
        geometry={reliefPoppet}
        material={mats.steel}
        meshRef={poppet}
        position={[-0.046, 0.024, 0]}
      />
      <P
        name="Relief valve spring"
        note={NOTE.relief}
        geometry={reliefSpring}
        material={mats.spring}
        meshRef={rSpring}
        position={[-0.052, 0.024, 0]}
      />
    </group>
  );
}

/** The front of the engine, the crankshaft nose and the line from the governor to the hub. */
function Engine({ mats }: { mats: Mats }) {
  const block = useGeo(() => slab(-0.1, 0.24, -0.12, 0, -0.07, 0.07, 0.03));
  const crank = useGeo(() =>
    merge([rod(0.022, 0.08, 24).translate(0.27, 0, 0), rod(0.045, 0.012, 32).translate(0.296, 0, 0)]),
  );
  const line = useGeo(() =>
    tube(
      [
        [0.042, 0.055, 0],
        [0.09, 0.055, 0],
        [0.14, 0.03, 0],
        [0.17, -0.02, 0],
        [0.21, -0.055, 0],
        [0.25, -0.06, 0],
      ],
      0.0045,
    ),
  );
  const crankRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (crankRef.current) crankRef.current.rotation.x = anim.crank * Math.PI * 2;
  });
  return (
    <group>
      <P name="Engine front, governor pad" note={NOTE.engine} geometry={block} material={mats.sump} />
      <group position={[0, HUB[1], 0]}>
        <P name="Crankshaft nose" note={NOTE.crank} geometry={crank} material={mats.steel} meshRef={crankRef} />
      </group>
      <P name="Propeller control line" note={NOTE.line} geometry={line} material={mats.oil} />
    </group>
  );
}

/** The hub, its piston and the blade roots; the whole turns with the crankshaft. */
function Hub({ mats }: { mats: Mats }) {
  const hubType = useGov((x) => x.hub);
  const hub = useGeo(() =>
    merge([rod(0.05, 0.08, 32).translate(0.04, 0, 0), new THREE.SphereGeometry(0.05, 32, 12).scale(0.5, 1, 1)]),
  );
  const cyl = useGeo(() => merge([rod(0.036, 0.07, 32).translate(0.115, 0, 0)]));
  const piston = useGeo(() => rod(0.033, 0.008, 28));
  const prod = useGeo(() =>
    merge([
      rod(0.005, 0.07, 12).translate(-0.035, 0, 0),
      new THREE.BoxGeometry(0.006, 0.07, 0.006).translate(-0.07, 0, 0),
    ]),
  );
  const spring = useGeo(() => coil(0.024, 0.0018, 0, 1, 5).rotateY(Math.PI / 2));
  const blade = useGeo(() => {
    // a flat, slightly tapered blade along +y; at 0° its chord lies along z, in the plane of rotation (the shaft is x)
    const g = new THREE.BoxGeometry(0.008, BLADE_LEN, 0.06, 1, 6, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + BLADE_LEN / 2) / BLADE_LEN;
      p.setZ(i, p.getZ(i) * (1 - 0.35 * t));
    }
    g.computeVertexNormals();
    return merge([
      g.translate(0, BLADE_R0 + BLADE_LEN / 2 + 0.02, 0),
      new THREE.CylinderGeometry(0.014, 0.014, 0.04, 16).translate(0, BLADE_R0 + 0.01, 0),
    ]);
  });
  const cw = useGeo(() =>
    new THREE.CylinderGeometry(0.009, 0.009, 0.03, 14).rotateZ(Math.PI / 2).translate(0.03, BLADE_R0 + 0.012, 0),
  );

  const turn = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Group>(null);
  const springRef = useRef<THREE.Mesh>(null);
  const b0 = useRef<THREE.Group>(null),
    b1 = useRef<THREE.Group>(null),
    b2 = useRef<THREE.Group>(null);
  useFrame(() => {
    if (turn.current) turn.current.rotation.x = anim.crank * Math.PI * 2;
    const px = 0.09 + s.p * STROKE;
    if (pistonRef.current) pistonRef.current.position.x = px;
    if (springRef.current) {
      springRef.current.position.x = px + 0.004;
      springRef.current.scale.x = Math.max(0.148 - px - 0.004, 0.004);
    }
    // blade angle: chord in the plane of rotation at 0°, turned about the blade's own axis
    for (const r of [b0, b1, b2]) if (r.current) r.current.rotation.y = (s.beta * Math.PI) / 180;
  });
  return (
    <group position={HUB}>
      <group ref={turn}>
        <P name="Propeller hub" note={NOTE.hub} geometry={hub} material={mats.shroud} />
        <P name="Hydraulic cylinder" note={NOTE.cylinder} geometry={cyl} material={mats.cover} />
        <group ref={pistonRef}>
          <P name="Pitch-change piston" note={NOTE.cylinder} geometry={piston} material={mats.piston} />
          <P name="Pitch-change rod and fork" note={NOTE.rod} geometry={prod} material={mats.darkSteel} />
        </group>
        {hubType === "high" && (
          <P name="Return spring" note={NOTE.springHub} geometry={spring} material={mats.spring} meshRef={springRef} />
        )}
        {[b0, b1, b2].map((r, i) => (
          <group key={i} rotation={[(i * 2 * Math.PI) / 3, 0, 0]} position={[0.04, 0, 0]}>
            <group ref={r}>
              <P name="Blade" note={NOTE.blade} geometry={blade} material={BLADE} />
              {hubType === "low" && (
                <P name="Counterweight" note={NOTE.counterweight} geometry={cw} material={mats.black} />
              )}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

const FLOWS: { points: V3[]; mat: THREE.Material; rate: () => number }[] = [
  {
    // engine oil into the gear pump
    points: [
      [-0.12, -0.03, 0.03],
      [-0.04, -0.01, 0.03],
      [-0.012, 0.012, 0.022],
      [-0.004, 0.022, 0.012],
    ],
    mat: OIL.engine,
    rate: () => (s.inletPsi > 1 && s.rpm > 1 ? 0.5 : 0),
  },
  {
    // boosted oil up to the pilot valve
    points: [
      [0.022, 0.03, 0.012],
      [0.016, 0.042, 0.014],
      [0.012, 0.05, 0.012],
      [0.012, 0.055, 0.004],
    ],
    mat: OIL.boost,
    rate: () => (s.pumpPsi > 1 && s.rpm > 1 ? 0.6 : 0),
  },
  {
    // over the relief valve and back to the inlet
    points: [
      [-0.016, 0.03, 0.006],
      [-0.044, 0.026, 0],
      [-0.07, 0.024, 0],
      [-0.06, 0.012, 0.02],
      [-0.03, 0.006, 0.026],
    ],
    mat: OIL.boost,
    rate: () => (s.relief && s.rpm > 1 ? 0.5 : 0),
  },
  {
    // the propeller line: to the hub (+) or back (−)
    points: [
      [0.012, 0.055, 0],
      [0.042, 0.055, 0],
      [0.09, 0.055, 0],
      [0.14, 0.03, 0],
      [0.17, -0.02, 0],
      [0.21, -0.055, 0],
      [0.25, -0.06, 0],
      [0.39, -0.06, 0],
    ],
    mat: OIL.boost,
    rate: () => (Math.abs(s.flow) > 0.004 ? Math.sign(s.flow) * Math.min(0.15 + Math.abs(s.flow) * 2, 0.8) : 0),
  },
  {
    // drain: oil let out of the hub through the governor, back to the engine
    points: [
      [0.008, 0.05, -0.006],
      [0.006, 0.03, -0.012],
      [0.006, 0.0, -0.012],
      [0.01, -0.05, -0.02],
    ],
    mat: OIL.drain,
    rate: () => (s.flow < -0.004 && s.port < 0 ? 0.5 : 0),
  },
];

function Model() {
  const mats = useMemo(makeMats, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame(() => {
    const xray = useGovView.getState().xray;
    for (const k of ["case", "sump", "acc", "shroud", "cover"] as const) {
      mats[k].transparent = true;
      mats[k].opacity = xray ? (k === "shroud" || k === "cover" ? 0.3 : 0.18) : 1;
      mats[k].depthWrite = !xray;
    }
  });
  return (
    <group>
      <Governor mats={mats} />
      <Engine mats={mats} />
      <Hub mats={mats} />
      {FLOWS.map((f, i) => (
        <Flow key={i} {...f} />
      ))}
      <Labels />
    </group>
  );
}

function Labels() {
  const show = useGovView((x) => x.labels);
  const gl = useThree((x) => x.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const items: [string, V3][] = [
    ["Flyweights", [-0.05, 0.11, 0.04]],
    ["Speeder spring", [-0.06, 0.15, 0.03]],
    ["Pilot valve", [0.06, 0.08, 0.04]],
    ["Gear pump", [0.05, 0.0, 0.05]],
    ["Relief valve", [-0.1, 0.04, 0]],
    ["Propeller control", [0.07, 0.21, 0]],
    ["Hub piston", [0.42, 0.0, 0]],
    ["Blades (shortened)", [0.36, -0.3, 0.06]],
  ];
  return (
    <>
      {items.map(([t, p]) => (
        <Html key={t} position={p} portal={portal} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label">{t}</div>
        </Html>
      ))}
    </>
  );
}

export default function GovernorScene() {
  return (
    <ComponentStage
      camera={{ position: [0.5, 0.26, 0.86], fov: 36, near: 0.01, far: 20 }}
      target={[0.16, -0.02, 0]}
      minDistance={0.2}
      maxDistance={3}
    >
      <Model />
    </ComponentStage>
  );
}
