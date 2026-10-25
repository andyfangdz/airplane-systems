"use client";
/**
 * The pitot-static system laid out like PHAK Figure 8-1: the heated pitot head under a piece of the left wing, the
 * static port in a piece of the fuselage's left side with its line down to the sump and up to the ALT STATIC AIR
 * selector, and the manifold to the panel. The six-pack panel has the three instruments and the encoder; the G1000
 * panel the PFD, the standby airspeed indicator and altimeter, and the air data computer behind them with a data
 * cable to the PFD. Faces are live and mechanisms show in their cases (X-ray). Sizes and distances are schematic. Air
 * moving through each opening and line is drawn as particles; ice, tape, water, broken glass and the ramp test set
 * appear when they are there.
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { coil, merge, slab, tube, zrod } from "../scene/kit";
import { P } from "../scene/parts";
import { ComponentStage } from "../ComponentStage";
import { inHg, P0, qcFromCas } from "@/engines/components/pitot-static/model";
import { AMT, GPG, IFH, IPC, PHAK, POH } from "@/engines/components/pitot-static/spec";
import { drawAlt, drawAsi, drawPfd, drawVsi, pitchOf } from "./dials";
import { s, spec, usePs, usePsView } from "./store";

type V3 = [number, number, number];

/** Instrument face radius (drawn larger than the 3 1/8 in instrument), the instruments' centres and their cases. */
const R = 0.085;
const ASI: V3 = [-0.2, 0.33, 0],
  ALT: V3 = [0, 0.33, 0],
  VSI: V3 = [0.2, 0.33, 0];
const BACK = -0.1;
/** Pitot head: tip and aft end along x (it points left, into the "ram air"), height, depth, radius; drain hole x. */
const PT = { tip: -0.8, end: -0.6, y: 0.47, z: -0.05, r: 0.011, drain: -0.645, mast: -0.635 };
const PORT: V3 = [-0.66, 0.12, -0.066];
const PORT_R: V3 = [0.32, 0.07, -0.066];
const SUMP: V3 = [-0.56, 0, -0.14];
const VALVE: V3 = [-0.36, 0.2, -0.15];
const KNOB: V3 = [-0.3, 0.235, 0];
const MANIFOLD_Y = 0.22,
  MANIFOLD_Z = -0.15;
const ENCODER: V3 = [0.38, 0.22, -0.15];
/** G1000: the PFD's screen (centre, width, height), the smaller standby instruments, and the air data computer behind
 * the panel where the six-pack has its encoder (schematic: the POH puts it "just forward of the MFD", p. 7-70). */
const PFD: V3 = [-0.17, 0.33, 0],
  PFD_W = 0.3,
  PFD_H = 0.225;
const STBY = 0.62;
const STBY_ASI: V3 = [0.09, 0.36, 0],
  STBY_ALT: V3 = [0.24, 0.36, 0];
const ADC: V3 = ENCODER;
const TEST_SET: V3 = [0.12, 0.03, 0.22];

const NOTE = {
  wing: `Left wing, lower surface (schematic): the 172S's heated pitot head is mounted on the lower surface of the left wing (${POH} p. 7-64).`,
  pitot: `Heated pitot tube: pitot body, tube, nose fitting, heater and stem (${IPC} 34-11-00 Figure 01). Its front opening takes total pressure, static plus dynamic (${PHAK} p. 8-2). Pointed forward, parallel to the line of flight (${AMT} p. 10-13).`,
  ram: `Ram air inlet: total pressure enters here. Blocked by ice or insects, the pitot side can only drain through the drain hole (${PHAK} pp. 8-2, 8-10).`,
  drain: `Drain hole: lets moisture out of the chamber (${PHAK} p. 8-2). With the inlet blocked the pitot side empties through it and the airspeed falls to zero; blocked too, the pressure is trapped (p. 8-10).`,
  baffle: `Baffle plate: protects the system from moisture and dirt entering the tube; the drain is below it (${AMT} p. 10-12).`,
  heater: `Heater element. PITOT HEAT on keeps ice off; check the tube warm to the touch within 30 seconds on preflight (${POH} p. 4-6). It makes the tube too hot to touch without a burn (${AMT} p. 10-13).`,
  mast: `Stem: carries the pitot tube and its line up into the wing (${IPC} 34-11-00 Figure 01).`,
  pitotLine: `Pitot line: 55.0 in of tubing in the 172 (${IPC} 34-11-00 Figure 01), drawn shortened. It carries total pressure to the airspeed indicator alone (${PHAK} p. 8-2).`,
  skin: `Fuselage, left side (schematic): the 172S's static port is on the left side of the forward fuselage (${POH} p. 7-64).`,
  port: `Static port: vented to the undisturbed air at the fuselage side, it feeds the altimeter, the VSI and the airspeed indicator's case (${PHAK} p. 8-2). Check the opening clear on preflight (${POH} p. 4-9).`,
  tape: `Tape over the port, left after washing or painting. Remove every plug, adaptor and piece of tape (${AMT} p. 10-81).`,
  staticLine: `Static line: 16.0 in in the 172 catalogue (${IPC} 34-11-00 Figure 01), drawn schematically.`,
  sump: `Sump at the static line's low point, where water collects (${IPC} 34-11-00 Figure 01). Water in the lines gives inaccurate or intermittent indications, worse if it freezes (${AMT} p. 10-81).`,
  water: `Water in the static line; white when frozen. Frozen, it blocks the line like a blocked port.`,
  valve: `ALT STATIC AIR selector valve: pulled on, the instruments take static pressure from inside the cabin instead of the external port (${POH} p. 7-64; ${IPC} 34-11-00 Figure 01).`,
  cabin: `Cabin air inlet of the alternate source. Cabin pressure is lower than outside, by the venturi effect of the air around the fuselage (${PHAK} p. 8-3), and varies with open heaters, vents and windows (${POH} p. 7-64).`,
  knob: `ALT STATIC AIR control, adjacent to the throttle (${POH} p. 7-12): pull full out for ON, push full in for OFF (pp. 3-15, 4-6).`,
  manifold: `Static manifold: tees to the airspeed indicator's case, the altimeter, the VSI and the encoder (${IPC} 34-11-00 Figure 01).`,
  panel: "Instrument panel (schematic).",
  asi: `Airspeed indicator: a differential pressure gauge, pitot pressure in its diaphragm, static pressure in its case (${PHAK} p. 8-8). Markings white 40–85, green 48–129, yellow 129–163, red line 163 KIAS (${POH} Figure 2-2).`,
  asiCase: `Airspeed indicator case: sealed and connected to the static ports (${IFH} p. 5-8).`,
  asiDia: `Diaphragm: thin corrugated phosphor bronze fed from the pitot tube. It expands as pitot pressure rises or static pressure falls, and a rocking shaft and gears turn the pointer (${IFH} p. 5-8).`,
  alt: `Sensitive altimeter: three pointers and the barometric scale (Kollsman window), 28.00–31.00 inHg (${PHAK} p. 8-3; ${IFH} p. 5-4).`,
  altCase: `Altimeter case: sealed, with static pressure let in at the rear to surround the aneroid wafers (${PHAK} p. 8-3).`,
  wafers: `Aneroid wafers: sealed and evacuated. Lower static pressure lets them expand (higher altitude), higher pressure compresses them (${PHAK} p. 8-3).`,
  vsi: `Vertical speed indicator: the trend at once, the rate after 6–9 seconds (${PHAK} p. 8-8).`,
  vsiCase: `VSI case: airtight, connected to the static line only through the calibrated leak (${PHAK} p. 8-7). Breaking its glass opens it to the cabin (p. 8-3).`,
  vsiDia: `VSI diaphragm: connected directly to the static line; it moves with the difference between the line and the lagging case (${PHAK} p. 8-7).`,
  leak: `Calibrated leak: a restricted orifice that lets the case follow the static line seconds behind (${PHAK} p. 8-7; ${IFH} p. 5-8).`,
  encoder: `Blind encoder: reports pressure altitude to the transponder from 29.92 inHg in 100-ft steps, whatever the altimeter is set to (${IFH} p. 5-7; ${IPC} 34-11-00 Figure 01). It shares the static line: ATC sees what the altimeter sees.`,
  testSet: `Pitot-static test set: connected at the static vent end, it reduces the static pressure to indicate 1,000 ft, then the system is sealed for a minute (${AMT} p. 10-81).`,
  adapter: `Test adapter, sealed over the opening (${AMT} p. 10-81).`,
  hose: "Test set hose.",
  portR: `Right static port, the paired installation: ports on opposite sides joined with Y tubing cancel sideslip error (${IFH} p. 5-2; ${AMT} p. 10-13). Not the 172S's.`,
  ice: `Ice on the pitot head: small objects collect ice fastest (${IFH} p. 4-13).`,
  pfd: `G1000 PFD: airspeed tape with true airspeed below it, altimeter with the BARO setting, and the VSI, all from the air data computer; a red X where it gets no air data (${POH} pp. 7-18, 7-20; ${GPG} pp. 50 to 55, 565). Attitude and heading aren't simulated here.`,
  stbyAsi: `Standby (pneumatic) airspeed indicator on the lower centre panel (${POH} p. 7-18): it shares the pitot head and static port with the air data computer (p. 7-12).`,
  stbyAlt: `Standby (aneroid) sensitive altimeter (${POH} p. 7-18), set separately from the PFD's BARO (p. 4-15). Use it, set to the current pressure, if the PFD's altitude has a red X (p. 3-21).`,
  adc: `GDC 74A air data computer: processes data from the pitot/static system and the OAT probe, giving pressure altitude, airspeed, vertical speed and OAT (${GPG} p. 2); behind the panel, just forward of the MFD (${POH} p. 7-70).`,
  data: `Data from the air data computer to the displays, digital (ARINC 429; ${GPG} p. 2).`,
  debris: `Insects or debris in the opening (${PHAK} p. 8-10).`,
  crack: "A leak in the static line behind the panel: cabin air gets in.",
};

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra });

function makeMats() {
  return {
    // turn see-through in X-ray
    skin: std("#c9d0d6", { transparent: true, side: THREE.DoubleSide, metalness: 0.5 }),
    panel: std("#2b3036", { transparent: true, metalness: 0.2, roughness: 0.7 }),
    caseM: std("#3a4047", { transparent: true, side: THREE.DoubleSide }),
    pitotBody: std("#b8c0c7", {
      transparent: true,
      metalness: 0.8,
      roughness: 0.3,
      emissive: "#ff5a1f",
      emissiveIntensity: 0,
    }),
    // always solid
    steel: std("#a9b2ba", { metalness: 0.85, roughness: 0.3 }),
    dark: std("#15191d", { metalness: 0.2, roughness: 0.8 }),
    bronze: std("#c49a52", { metalness: 0.8, roughness: 0.35 }),
    pitotLine: std("#e0782b", { metalness: 0.4 }),
    staticLine: std("#3b82c4", { metalness: 0.4 }),
    cabinLine: std("#3aa35a", { metalness: 0.4 }),
    heater: std("#7a3a22", { emissive: "#ff4a1a", emissiveIntensity: 0 }),
    valve: std("#8a959c", { metalness: 0.6 }),
    knob: std("#22272c", { metalness: 0.3, roughness: 0.6 }),
    encoder: std("#2c3e50", { metalness: 0.3 }),
    ice: std("#e8f4ff", { transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0 }),
    debris: std("#5b3d22", { roughness: 0.9, metalness: 0 }),
    tape: std("#e3c35a", { roughness: 0.8, metalness: 0 }),
    water: std("#3aa0ff", { transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0 }),
    rubber: std("#1d2125", { roughness: 0.9, metalness: 0 }),
    testSet: std("#c8a227", { metalness: 0.3 }),
    bezel: std("#121518", { metalness: 0.4 }),
  };
}
type Mats = ReturnType<typeof makeMats>;

/** A geometry made once and disposed with the component. */
function useGeo<T extends THREE.BufferGeometry>(make: () => T) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, []);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

const xAxis = (g: THREE.BufferGeometry) => g.rotateZ(Math.PI / 2); // three's cylinders run along y; lay them along x

/** Particle speed (path lengths per second) for a flow (Pa/s, + along the path); none when it is still. */
const flowSpeed = (f: number) =>
  Math.abs(f) < 0.3 ? 0 : Math.sign(f) * Math.min(0.9, 0.12 + 0.2 * Math.log10(1 + Math.abs(f)));

const AIR = {
  pitot: new THREE.MeshBasicMaterial({ color: "#ff9a52" }),
  static: new THREE.MeshBasicMaterial({ color: "#6fb6ff" }),
  cabin: new THREE.MeshBasicMaterial({ color: "#6be675" }),
};

/** Air particles running along a path at the speed a flow gives (+ in the path's direction). */
function Flow({
  points,
  mat,
  rate,
  show = () => true,
}: {
  points: V3[];
  mat: THREE.Material;
  rate: () => number;
  show?: () => boolean;
}) {
  const reducedMotion = useReducedMotion();
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const geo = useMemo(
    () => (reducedMotion ? new THREE.ConeGeometry(0.008, 0.025, 8) : new THREE.SphereGeometry(0.0045, 8, 6)),
    [reducedMotion],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(0);
  const N = 8;
  useFrame((_, dt) => {
    const view = usePsView.getState();
    const r = view.paused || !view.flow || !show() ? 0 : flowSpeed(rate());
    if (!reducedMotion) phase.current = (phase.current + r * Math.min(dt, 0.1) + 1) % 1;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = r !== 0 && (!reducedMotion || i === 0);
      if (m.visible) {
        m.position.copy(curve.getPointAt(reducedMotion ? 0.55 : (phase.current + i / N) % 1));
        if (reducedMotion) m.quaternion.setFromUnitVectors(up, curve.getTangentAt(0.55).multiplyScalar(Math.sign(r)));
      }
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
          userData={{ cameraBounds: false, presentation: true }}
          material={mat}
          renderOrder={3}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- the pitot head and the wing

function Pitot({ m }: { m: Mats }) {
  const len = PT.end - PT.tip;
  const body = useGeo(() =>
    merge([
      xAxis(new THREE.CylinderGeometry(PT.r, PT.r, len * 0.82, 28, 1, true)).translate(PT.tip + len * 0.59, 0, 0),
      // the nose fitting tapers to the inlet
      xAxis(new THREE.CylinderGeometry(PT.r, PT.r * 0.7, len * 0.18, 28, 1, true)).translate(PT.tip + len * 0.09, 0, 0),
      new THREE.CircleGeometry(PT.r, 28).rotateY(Math.PI / 2).translate(PT.end, 0, 0),
    ]),
  );
  const inlet = useGeo(() =>
    new THREE.CircleGeometry(PT.r * 0.45, 20).rotateY(-Math.PI / 2).translate(PT.tip - 0.0005, 0, 0),
  );
  const drain = useGeo(() =>
    new THREE.CircleGeometry(0.0025, 14).rotateX(Math.PI / 2).translate(PT.drain, -PT.r - 0.0004, 0),
  );
  const baffle = useGeo(() =>
    xAxis(new THREE.CylinderGeometry(PT.r * 0.9, PT.r * 0.9, 0.002, 20)).translate(PT.tip + len * 0.35, 0, 0),
  );
  const heater = useGeo(() =>
    coil(PT.r * 0.6, 0.0012, 0, len * 0.7, 9)
      .rotateY(Math.PI / 2)
      .translate(PT.tip + len * 0.15, 0, 0),
  );
  // from the top of the tube up into the wing, narrower where it meets the tube
  const mast = useGeo(() => {
    const g = new THREE.BoxGeometry(0.04, 0.09, 0.008);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.7);
    g.computeVertexNormals();
    return g.translate(PT.mast, 0.045, 0);
  });
  const iceCap = useGeo(() => new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2));
  const blob = useGeo(() => new THREE.SphereGeometry(1, 14, 10));
  const iceRef = useRef<THREE.Mesh>(null),
    drainIce = useRef<THREE.Mesh>(null),
    ramPlug = useRef<THREE.Mesh>(null),
    drainPlug = useRef<THREE.Mesh>(null),
    adapter = useRef<THREE.Group>(null);
  useFrame(() => {
    const u = usePs.getState();
    m.pitotBody.emissiveIntensity = 0.55 * s.heat;
    m.heater.emissiveIntensity = 1.6 * s.heat;
    if (iceRef.current) {
      const k = s.iceRam;
      iceRef.current.visible = k > 0.01;
      iceRef.current.scale.set(0.003 + 0.012 * k, PT.r * (0.6 + 0.9 * k), PT.r * (0.6 + 0.9 * k));
    }
    if (drainIce.current) {
      drainIce.current.visible = s.iceDrain > 0.01;
      drainIce.current.scale.setScalar(0.001 + 0.004 * s.iceDrain);
    }
    if (ramPlug.current) ramPlug.current.visible = u.failures.ram;
    if (drainPlug.current) drainPlug.current.visible = u.failures.drain;
    if (adapter.current) adapter.current.visible = u.mode === "test";
  });
  const tipX = PT.tip - 0.0015;
  return (
    <group position={[0, PT.y, PT.z]}>
      <P name="Pitot tube (heated)" note={NOTE.pitot} geometry={body} material={m.pitotBody} />
      <P name="Ram air inlet" note={NOTE.ram} geometry={inlet} material={m.dark} />
      <P name="Drain hole" note={NOTE.drain} geometry={drain} material={m.dark} />
      <P name="Baffle plate" note={NOTE.baffle} geometry={baffle} material={m.steel} />
      <P name="Heater element" note={NOTE.heater} geometry={heater} material={m.heater} />
      <P name="Pitot stem" note={NOTE.mast} geometry={mast} material={m.steel} />
      <P
        name="Ice on the inlet"
        note={NOTE.ice}
        geometry={iceCap}
        material={m.ice}
        meshRef={iceRef}
        position={[tipX, 0, 0]}
      />
      <P
        name="Ice in the drain hole"
        note={NOTE.ice}
        geometry={blob}
        material={m.ice}
        meshRef={drainIce}
        position={[PT.drain, -PT.r, 0]}
      />
      <P
        name="Debris in the inlet"
        note={NOTE.debris}
        geometry={blob}
        material={m.debris}
        meshRef={ramPlug}
        position={[PT.tip + 0.004, 0, 0]}
        scale={[0.006, 0.006, 0.006]}
      />
      <P
        name="Debris in the drain hole"
        note={NOTE.debris}
        geometry={blob}
        material={m.debris}
        meshRef={drainPlug}
        position={[PT.drain, -PT.r - 0.001, 0]}
        scale={[0.0035, 0.0035, 0.0035]}
      />
      <group ref={adapter}>
        <Adapter m={m} at={[PT.tip + 0.02, 0, 0]} axis="x" />
      </group>
    </group>
  );
}

function Airframe({ m }: { m: Mats }) {
  const ports = usePs((x) => x.ports);
  const wing = useGeo(() => slab(-0.92, -0.4, 0.56, 0.6, -0.22, 0.12, 0.015));
  const skin = useGeo(() => slab(-0.92, -0.42, -0.04, 0.24, -0.082, -0.07, 0.01));
  const skinR = useGeo(() => slab(0.18, 0.48, -0.04, 0.17, -0.082, -0.07, 0.01));
  const button = useGeo(() =>
    merge([zrod(0.014, -0.004, 0.003, 28), new THREE.RingGeometry(0.0035, 0.014, 28).translate(0, 0, 0.0031)]),
  );
  const hole = useGeo(() => new THREE.CircleGeometry(0.0035, 16).translate(0, 0, 0.0032));
  const tapeG = useGeo(() => new THREE.BoxGeometry(0.045, 0.04, 0.0012).translate(0, 0, 0.0045));
  const tapeL = useRef<THREE.Mesh>(null),
    tapeR = useRef<THREE.Mesh>(null),
    adL = useRef<THREE.Group>(null),
    adR = useRef<THREE.Group>(null);
  useFrame(() => {
    const u = usePs.getState();
    if (tapeL.current) tapeL.current.visible = u.failures.portL;
    if (tapeR.current) tapeR.current.visible = u.failures.portR;
    if (adL.current) adL.current.visible = u.mode === "test";
    if (adR.current) adR.current.visible = u.mode === "test";
  });
  return (
    <group>
      <P name="Left wing, lower skin (schematic)" note={NOTE.wing} geometry={wing} material={m.skin} />
      <P name="Fuselage, left side (schematic)" note={NOTE.skin} geometry={skin} material={m.skin} />
      <group position={PORT}>
        <P name="Static port" note={NOTE.port} geometry={button} material={m.steel} />
        <P name="Static port opening" note={NOTE.port} geometry={hole} material={m.dark} />
        <P name="Tape over the static port" note={NOTE.tape} geometry={tapeG} material={m.tape} meshRef={tapeL} />
        <group ref={adL}>
          <Adapter m={m} at={[0, 0, 0.012]} axis="z" />
        </group>
      </group>
      {ports === "paired" && (
        <>
          <P name="Fuselage, right side (schematic)" note={NOTE.portR} geometry={skinR} material={m.skin} />
          <group position={PORT_R}>
            <P name="Right static port" note={NOTE.portR} geometry={button} material={m.steel} />
            <P name="Right static port opening" note={NOTE.portR} geometry={hole} material={m.dark} />
            <P name="Tape over the right port" note={NOTE.tape} geometry={tapeG} material={m.tape} meshRef={tapeR} />
            <group ref={adR}>
              <Adapter m={m} at={[0, 0, 0.012]} axis="z" />
            </group>
          </group>
        </>
      )}
    </group>
  );
}

/** A test adapter cup sealed over an opening. */
function Adapter({ m, at, axis }: { m: Mats; at: V3; axis: "x" | "z" }) {
  const g = useGeo(() => {
    const c = new THREE.CylinderGeometry(0.022, 0.026, 0.03, 24);
    return axis === "x" ? c.rotateZ(Math.PI / 2) : c.rotateX(Math.PI / 2);
  });
  return <P name="Test adapter" note={NOTE.adapter} geometry={g} material={m.rubber} position={at} />;
}

// ---------------------------------------------------------------- lines, sump and the selector

/** The pitot line from the stem through the wing to behind the panel; each panel takes it on from there. */
const PITOT_TRUNK: V3[] = [
  [PT.mast, 0.56, PT.z],
  [PT.mast + 0.035, 0.578, PT.z - 0.01],
  [-0.45, 0.578, -0.09],
  [-0.33, 0.52, -0.14],
  [-0.24, 0.42, -0.15],
];
/** Where an instrument's back fitting ends, for an instrument scaled by `k`. */
const backOf = (at: V3, k = 1, dx = 0, dy = 0): V3 => [at[0] + dx * k, at[1] + dy * k, (BACK - 0.015) * k];
const PORT_LINE: V3[] = [
  [PORT[0], PORT[1], -0.085],
  [PORT[0] + 0.02, 0.08, -0.12],
  [SUMP[0] - 0.02, 0.035, -0.14],
  [SUMP[0], 0.022, SUMP[2]],
];
const PORT_R_LINE: V3[] = [
  [PORT_R[0], PORT_R[1], -0.085],
  [PORT_R[0] - 0.05, 0.02, -0.13],
  [0.05, -0.005, -0.14],
  [-0.4, -0.005, -0.14],
  [SUMP[0] + 0.02, 0.02, SUMP[2]],
];
const SUMP_LINE: V3[] = [
  [SUMP[0], 0.022, SUMP[2]],
  [SUMP[0] + 0.05, 0.09, -0.15],
  [VALVE[0] - 0.06, 0.18, -0.15],
  [VALVE[0] - 0.0225, VALVE[1], VALVE[2]],
];
const CABIN_IN: V3[] = [
  [VALVE[0], 0.29, VALVE[2]],
  [VALVE[0], VALVE[1] + 0.0175, VALVE[2]],
];
const MANIFOLD: V3[] = [
  [VALVE[0] + 0.0225, VALVE[1], VALVE[2]],
  [VALVE[0] + 0.06, MANIFOLD_Y, MANIFOLD_Z],
  [-0.1, MANIFOLD_Y, MANIFOLD_Z],
  [0.1, MANIFOLD_Y, MANIFOLD_Z],
  [ENCODER[0] - 0.035, MANIFOLD_Y, MANIFOLD_Z],
];
/** A branch from the manifold up to a fitting. */
const branch = (to: V3): V3[] => [[to[0], MANIFOLD_Y, MANIFOLD_Z], [to[0], to[1] - 0.05, (MANIFOLD_Z + to[2]) / 2], to];
/** The ASI's static fitting is off centre: its pitot fitting is in the middle. */
const ASI_STATIC_AT = { dx: 0.035, dy: -0.04 };

function Lines({ m }: { m: Mats }) {
  const ports = usePs((x) => x.ports);
  const r = 0.0042;
  const pitot = useGeo(() => tube(PITOT_TRUNK, r));
  const port = useGeo(() => tube(PORT_LINE, r, 30));
  const portR = useGeo(() => tube(PORT_R_LINE, r, 50));
  const sumpLine = useGeo(() => tube(SUMP_LINE, r, 30));
  const manifold = useGeo(() => tube(MANIFOLD, r, 50));
  const cabinIn = useGeo(() =>
    merge([
      tube(CABIN_IN, r, 6),
      new THREE.CylinderGeometry(0.009, 0.005, 0.012, 16, 1, true).translate(VALVE[0], 0.292, VALVE[2]),
    ]),
  );
  const sump = useGeo(() =>
    merge([
      new THREE.CylinderGeometry(0.014, 0.014, 0.045, 20).translate(0, -0.005, 0),
      new THREE.CylinderGeometry(0.005, 0.005, 0.012, 12).translate(0, -0.033, 0),
    ]),
  );
  const water = useGeo(() => new THREE.CylinderGeometry(0.0115, 0.0115, 0.02, 16).translate(0, -0.016, 0));
  const valve = useGeo(() => new THREE.BoxGeometry(0.045, 0.035, 0.035));
  const lever = useGeo(() => new THREE.BoxGeometry(0.006, 0.03, 0.005).translate(0, 0.012, 0));
  const cable = useGeo(() =>
    tube(
      [
        [VALVE[0], VALVE[1] - 0.01, VALVE[2] + 0.02],
        [VALVE[0] + 0.02, 0.215, -0.07],
        [KNOB[0], KNOB[1], -0.02],
      ],
      0.0025,
      20,
      6,
    ),
  );
  const knob = useGeo(() => merge([zrod(0.004, -0.02, 0.012, 12), zrod(0.012, 0.012, 0.026, 20)]));
  const crack = useGeo(() => new THREE.TorusGeometry(0.008, 0.0016, 8, 16));
  const waterRef = useRef<THREE.Mesh>(null),
    leverRef = useRef<THREE.Mesh>(null),
    knobRef = useRef<THREE.Mesh>(null),
    crackRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const u = usePs.getState();
    if (waterRef.current) {
      waterRef.current.visible = u.failures.water;
      waterRef.current.material = s.waterIce > 0.5 ? m.ice : m.water;
      waterRef.current.scale.y = 0.6 + 0.4 * Math.sin(s.t * 1.7) ** 2;
    }
    if (leverRef.current) leverRef.current.rotation.z = u.cockpit.altStatic ? -1.1 : 0;
    if (knobRef.current) knobRef.current.position.z = u.cockpit.altStatic ? 0.025 : 0;
    if (crackRef.current) crackRef.current.visible = u.failures.leak !== "none";
  });
  return (
    <group>
      <P name="Pitot line" note={NOTE.pitotLine} geometry={pitot} material={m.pitotLine} />
      <P name="Static line" note={NOTE.staticLine} geometry={port} material={m.staticLine} />
      {ports === "paired" && (
        <P name="Right static line (Y)" note={NOTE.portR} geometry={portR} material={m.staticLine} />
      )}
      <P name="Static line" note={NOTE.staticLine} geometry={sumpLine} material={m.staticLine} />
      <P name="Static manifold and tees" note={NOTE.manifold} geometry={manifold} material={m.staticLine} />
      <P name="Alternate static: cabin air inlet" note={NOTE.cabin} geometry={cabinIn} material={m.cabinLine} />
      <group position={SUMP}>
        <P name="Static line sump and drain" note={NOTE.sump} geometry={sump} material={m.valve} />
        <P name="Water in the static line" note={NOTE.water} geometry={water} material={m.water} meshRef={waterRef} />
      </group>
      <group position={VALVE}>
        <P name="ALT STATIC AIR selector valve" note={NOTE.valve} geometry={valve} material={m.valve} />
        <P
          name="Selector lever"
          note={NOTE.valve}
          geometry={lever}
          material={m.knob}
          meshRef={leverRef}
          position={[0, 0, 0.019]}
        />
      </group>
      <P name="ALT STATIC AIR control cable" note={NOTE.knob} geometry={cable} material={m.steel} />
      <group position={KNOB}>
        <P name="ALT STATIC AIR knob" note={NOTE.knob} geometry={knob} material={m.knob} meshRef={knobRef} />
      </group>
      <P
        name="Leaking fitting"
        note={NOTE.crack}
        geometry={crack}
        material={m.tape}
        meshRef={crackRef}
        position={[-0.06, MANIFOLD_Y, MANIFOLD_Z]}
      />
    </group>
  );
}

// ---------------------------------------------------------------- the instruments

/** A live face: a round instrument's (radius `r`) or a screen's (`screen`: width, height), redrawn as it changes. */
function Face({
  at,
  paint,
  name,
  note,
  r = R,
  screen,
}: {
  at: V3;
  paint: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  name: string;
  note: string;
  r?: number;
  screen?: [number, number];
}) {
  const [W, H] = screen ? [640, 480] : [256, 256];
  const { ctx, tex } = useMemo(() => {
    const c = document.createElement("canvas");
    [c.width, c.height] = [W, H];
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { ctx: c.getContext("2d"), tex };
  }, [W, H]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex]);
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
  );
  const geo = useGeo(() => (screen ? new THREE.PlaneGeometry(screen[0], screen[1]) : new THREE.CircleGeometry(r, 48)));
  const last = useRef(-1);
  const every = screen ? 1 / 15 : 1 / 30;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ctx || t - last.current < every) return;
    last.current = t;
    paint(ctx, W, H);
    tex.needsUpdate = true;
  });
  return <P name={name} note={note} geometry={geo} material={mat} position={[at[0], at[1], 0.004]} />;
}

type Kind = "asi" | "alt" | "vsi";

/**
 * A round pneumatic instrument with its face, case, fittings and mechanism, `k` times the six-pack's size: the ASI's
 * diaphragm swells with pitot over static, the altimeter's wafers with falling static, the VSI's diaphragm with its
 * case over the line.
 */
function Round({
  kind,
  at,
  k = 1,
  m,
  names,
}: {
  kind: Kind;
  at: V3;
  k?: number;
  m: Mats;
  names: { face: string; note: string };
}) {
  const caseG = useGeo(() =>
    merge([zrod(R * 0.92, BACK, -0.012, 36), new THREE.CircleGeometry(R * 0.92, 36).translate(0, 0, BACK)]),
  );
  const bezel = useGeo(() => new THREE.TorusGeometry(R + 0.003, 0.005, 10, 48).translate(0, 0, 0.003));
  const fitting = useGeo(() => zrod(0.006, BACK - 0.016, BACK, 12));
  const capsule = useGeo(() => new THREE.SphereGeometry(1, 28, 12));
  const feed = useGeo(() => zrod(0.0028, -0.075, BACK, 10));
  const link = useGeo(() => zrod(0.002, -0.045, -0.012, 8));
  const orifice = useGeo(() =>
    merge([zrod(0.005, BACK - 0.004, BACK + 0.012, 12), coil(0.004, 0.0009, BACK + 0.012, -0.075, 4)]),
  );
  const dia = useRef<THREE.Mesh>(null),
    w0 = useRef<THREE.Mesh>(null),
    w1 = useRef<THREE.Mesh>(null),
    w2 = useRef<THREE.Mesh>(null);
  const qcTop = qcFromCas(200);
  useFrame(() => {
    if (kind === "asi") {
      const d = Math.max(0, s.pitot - s.stat) / qcTop;
      dia.current?.scale.set(0.034, 0.034, 0.004 + 0.014 * Math.min(1, d));
    } else if (kind === "alt") {
      const e = Math.min(1, Math.max(0, (P0 - s.stat) / (0.35 * P0)));
      for (const [i, r] of [w0, w1, w2].entries()) {
        if (!r.current) continue;
        r.current.scale.set(0.03, 0.03, 0.003 + 0.005 * e);
        r.current.position.z = -0.085 + i * (0.008 + 0.011 * e);
      }
    } else {
      const v = Math.max(-1, Math.min(1, s.vsi / spec.model.vsiStop));
      dia.current?.scale.set(0.03, 0.03, 0.007 - 0.004 * v);
    }
  });
  const paint = (c: CanvasRenderingContext2D, W: number, H: number) => {
    const u = usePs.getState();
    if (kind === "asi") drawAsi(c, W, H, s.ias);
    else if (kind === "alt") drawAlt(c, W, H, s.alt, u.cockpit.kollsman);
    else drawVsi(c, W, H, s.vsi, u.failures.vsiGlass);
  };
  const line = kind === "asi" ? m.pitotLine : m.staticLine;
  return (
    <>
      <Face at={at} name={names.face} note={names.note} r={R * k} paint={paint} />
      <group position={[at[0], at[1], 0]} scale={[k, k, k]}>
        <P name="Bezel" note={names.note} geometry={bezel} material={m.bezel} />
        <P
          name={`${names.face} case`}
          note={kind === "asi" ? NOTE.asiCase : kind === "alt" ? NOTE.altCase : NOTE.vsiCase}
          geometry={caseG}
          material={m.caseM}
        />
        <P
          name={kind === "asi" ? "Pitot fitting" : "Static fitting"}
          note={names.note}
          geometry={fitting}
          material={line}
        />
        {kind === "asi" && (
          <>
            <P name="Pitot feed to the diaphragm" note={NOTE.asiDia} geometry={feed} material={m.pitotLine} />
            <P
              name="ASI diaphragm"
              note={NOTE.asiDia}
              geometry={capsule}
              material={m.bronze}
              meshRef={dia}
              position={[0, 0, -0.07]}
            />
            <P name="Rocking shaft and sector" note={NOTE.asiDia} geometry={link} material={m.steel} />
            <P
              name="Static fitting (case)"
              note={NOTE.asiCase}
              geometry={fitting}
              material={m.staticLine}
              position={[ASI_STATIC_AT.dx, ASI_STATIC_AT.dy, 0]}
            />
          </>
        )}
        {kind === "alt" && (
          <>
            <P name="Aneroid wafer" note={NOTE.wafers} geometry={capsule} material={m.bronze} meshRef={w0} />
            <P name="Aneroid wafer" note={NOTE.wafers} geometry={capsule} material={m.bronze} meshRef={w1} />
            <P name="Aneroid wafer" note={NOTE.wafers} geometry={capsule} material={m.bronze} meshRef={w2} />
            <P name="Linkage" note={NOTE.wafers} geometry={link} material={m.steel} />
          </>
        )}
        {kind === "vsi" && (
          <>
            <P name="Static feed to the diaphragm" note={NOTE.vsiDia} geometry={feed} material={m.staticLine} />
            <P
              name="VSI diaphragm"
              note={NOTE.vsiDia}
              geometry={capsule}
              material={m.bronze}
              meshRef={dia}
              position={[0, 0, -0.07]}
            />
            <P
              name="Calibrated leak"
              note={NOTE.leak}
              geometry={orifice}
              material={m.dark}
              position={[0.03, 0.03, 0]}
            />
            <P name="Linkage" note={NOTE.vsiDia} geometry={link} material={m.steel} />
          </>
        )}
      </group>
    </>
  );
}

/** The pitot line's end at the six-pack's ASI, and the manifold's branches to each instrument. */
const SIX = {
  pitot: [PITOT_TRUNK[PITOT_TRUNK.length - 1], [ASI[0], ASI[1] + 0.015, -0.14], backOf(ASI)] as V3[],
  asiStatic: branch(backOf(ASI, 1, ASI_STATIC_AT.dx, ASI_STATIC_AT.dy)),
  alt: branch(backOf(ALT)),
  vsi: branch(backOf(VSI)),
};

function SixPackPanel({ m }: { m: Mats }) {
  const r = 0.0042;
  const pitot = useGeo(() => tube(SIX.pitot, r, 16));
  const branches = useGeo(() => merge([tube(SIX.asiStatic, r, 16), tube(SIX.alt, r, 16), tube(SIX.vsi, r, 16)]));
  const encoder = useGeo(() => new THREE.BoxGeometry(0.07, 0.045, 0.06));
  return (
    <group>
      <P name="Pitot line" note={NOTE.pitotLine} geometry={pitot} material={m.pitotLine} />
      <P name="Static manifold and tees" note={NOTE.manifold} geometry={branches} material={m.staticLine} />
      <Round kind="asi" at={ASI} m={m} names={{ face: "Airspeed indicator", note: NOTE.asi }} />
      <Round kind="alt" at={ALT} m={m} names={{ face: "Altimeter", note: NOTE.alt }} />
      <Round kind="vsi" at={VSI} m={m} names={{ face: "Vertical speed indicator", note: NOTE.vsi }} />
      <P name="Blind encoder (Mode C)" note={NOTE.encoder} geometry={encoder} material={m.encoder} position={ENCODER} />
      <Flow points={[...PITOT_TRUNK, ...SIX.pitot.slice(1)]} mat={AIR.pitot} rate={pitotFlow} />
      <Flow points={[...MANIFOLD.slice(0, 3), ...SIX.alt.slice(1)]} mat={AIR.static} rate={staticFlow} />
      {/* into the VSI's case through the calibrated leak, or the broken glass */}
      <Flow
        points={[
          [VSI[0] + 0.03, VSI[1] + 0.03, BACK - 0.01],
          [VSI[0] + 0.03, VSI[1] + 0.03, -0.075],
          [VSI[0] + 0.05, VSI[1] + 0.045, -0.04],
        ]}
        mat={AIR.static}
        rate={() => s.flows.vsi}
      />
      <Flow
        points={[
          [VSI[0] + 0.02, VSI[1] + 0.02, 0.09],
          [VSI[0] + 0.02, VSI[1] + 0.02, -0.04],
        ]}
        mat={AIR.cabin}
        rate={() => s.flows.glass}
      />
    </group>
  );
}

/** The air data computer's pitot fitting; its static fitting is where the manifold ends. */
const ADC_PITOT: V3 = [ADC[0] - 0.035, ADC[1] + 0.016, ADC[2]];
/** The G1000's pitot line to the standby ASI and on to the air data computer, the static branches, the data cable. */
const G1 = {
  pitot: [
    PITOT_TRUNK[PITOT_TRUNK.length - 1],
    [-0.05, 0.44, -0.15],
    [STBY_ASI[0], STBY_ASI[1] + 0.02, -0.12],
    backOf(STBY_ASI, STBY),
  ] as V3[],
  adcPitot: [[-0.05, 0.44, -0.15], [0.25, 0.44, -0.17], [ADC_PITOT[0] - 0.04, ADC_PITOT[1], ADC[2]], ADC_PITOT] as V3[],
  asiStatic: branch(backOf(STBY_ASI, STBY, ASI_STATIC_AT.dx, ASI_STATIC_AT.dy)),
  alt: branch(backOf(STBY_ALT, STBY)),
  // low and behind the standby instruments, to the back of the PFD
  data: [
    [ADC[0], ADC[1] - 0.025, ADC[2]],
    [ADC[0] - 0.08, 0.17, -0.2],
    [PFD[0] + 0.1, 0.2, -0.17],
    [PFD[0], PFD[1] - 0.05, -0.06],
    [PFD[0], PFD[1], -0.03],
  ] as V3[],
};

function G1000Panel({ m }: { m: Mats }) {
  const r = 0.0042;
  const pitot = useGeo(() => merge([tube(G1.pitot, r, 24), tube(G1.adcPitot, r, 24)]));
  const branches = useGeo(() => merge([tube(G1.asiStatic, r, 16), tube(G1.alt, r, 16)]));
  const data = useGeo(() => tube(G1.data, 0.0025, 30, 6));
  const adc = useGeo(() =>
    merge([
      new THREE.BoxGeometry(0.07, 0.05, 0.08),
      zrod(0.006, -0.012, 0.012, 12)
        .rotateY(Math.PI / 2)
        .translate(-0.04, 0.016, 0),
      zrod(0.006, -0.012, 0.012, 12)
        .rotateY(Math.PI / 2)
        .translate(-0.04, 0, 0),
    ]),
  );
  const bezel = useGeo(() =>
    slab(-PFD_W / 2 - 0.012, PFD_W / 2 + 0.012, -PFD_H / 2 - 0.012, PFD_H / 2 + 0.03, -0.03, 0.002, 0.008),
  );
  return (
    <group>
      <P
        name="Pitot line (to the standby ASI and the air data computer)"
        note={NOTE.pitotLine}
        geometry={pitot}
        material={m.pitotLine}
      />
      <P name="Static manifold and tees" note={NOTE.manifold} geometry={branches} material={m.staticLine} />
      <P name="Data cable" note={NOTE.data} geometry={data} material={m.dark} />
      <P name="GDC 74A air data computer" note={NOTE.adc} geometry={adc} material={m.encoder} position={ADC} />
      <group position={[PFD[0], PFD[1], 0]}>
        <P name="PFD bezel" note={NOTE.pfd} geometry={bezel} material={m.bezel} />
      </group>
      <Face
        at={PFD}
        name="Primary flight display"
        note={NOTE.pfd}
        screen={[PFD_W, PFD_H]}
        paint={(c, W, H) => {
          const u = usePs.getState();
          drawPfd(c, W, H, { pfd: s.pfd, baro: u.cockpit.baro, oat: s.oat, pitch: pitchOf(s) });
        }}
      />
      <Round
        kind="asi"
        at={STBY_ASI}
        k={STBY}
        m={m}
        names={{ face: "Standby airspeed indicator", note: NOTE.stbyAsi }}
      />
      <Round kind="alt" at={STBY_ALT} k={STBY} m={m} names={{ face: "Standby altimeter", note: NOTE.stbyAlt }} />
      <Flow points={[...PITOT_TRUNK, ...G1.adcPitot]} mat={AIR.pitot} rate={pitotFlow} />
      <Flow points={[...MANIFOLD]} mat={AIR.static} rate={staticFlow} />
    </group>
  );
}

const sum = (...xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** Air along the pitot line and the static manifold: everything entering those volumes. */
const pitotFlow = () => sum(s.flows.ram, s.flows.drain, s.flows.pitotLeak, s.flows.testPitot);
const staticFlow = () => sum(s.flows.portL, s.flows.portR, s.flows.alt, s.flows.leak, s.flows.testStatic);

// ---------------------------------------------------------------- the ramp test set

function TestSet({ m }: { m: Mats }) {
  const mode = usePs((x) => x.mode),
    ports = usePs((x) => x.ports);
  const box = useGeo(() => new THREE.BoxGeometry(0.2, 0.1, 0.13));
  const hoses = useGeo(() => merge([tube(HOSE_PITOT, 0.004, 40), tube(HOSE_STATIC, 0.004, 40)]));
  const hoseR = useGeo(() => tube(HOSE_STATIC_R, 0.004, 40));
  if (mode !== "test") return null;
  return (
    <group>
      <P name="Pitot-static test set" note={NOTE.testSet} geometry={box} material={m.testSet} position={TEST_SET} />
      <P name="Test set hoses" note={NOTE.hose} geometry={hoses} material={m.rubber} />
      {ports === "paired" && <P name="Test set hose" note={NOTE.hose} geometry={hoseR} material={m.rubber} />}
    </group>
  );
}

const HOSE_PITOT: V3[] = [
  [TEST_SET[0] - 0.1, TEST_SET[1] + 0.03, TEST_SET[2]],
  [-0.3, 0.12, 0.26],
  [-0.78, 0.36, 0.16],
  [PT.tip - 0.06, PT.y, PT.z + 0.02],
  [PT.tip - 0.035, PT.y, PT.z],
];
const HOSE_STATIC: V3[] = [
  [TEST_SET[0] - 0.1, TEST_SET[1] - 0.02, TEST_SET[2]],
  [-0.3, 0.02, 0.2],
  [PORT[0] + 0.05, PORT[1] - 0.02, 0.06],
  [PORT[0], PORT[1], -0.025],
];
const HOSE_STATIC_R: V3[] = [
  [TEST_SET[0] + 0.1, TEST_SET[1] - 0.02, TEST_SET[2]],
  [0.3, 0.0, 0.15],
  [PORT_R[0], PORT_R[1], -0.025],
];

// ---------------------------------------------------------------- air flows

const isTest = () => usePs.getState().mode === "test";

const FLOWS: { points: V3[]; mat: THREE.Material; rate: () => number; show?: () => boolean }[] = [
  // ram air in at the inlet, out at the drain
  {
    points: [
      [PT.tip - 0.09, PT.y, PT.z],
      [PT.tip - 0.03, PT.y, PT.z],
      [PT.tip + 0.04, PT.y, PT.z],
    ],
    mat: AIR.pitot,
    rate: () => s.flows.ram,
    show: () => !isTest(),
  },
  {
    points: [
      [PT.drain, PT.y - 0.07, PT.z],
      [PT.drain, PT.y - 0.012, PT.z],
    ],
    mat: AIR.pitot,
    rate: () => s.flows.drain,
  },
  // the static port, its line and the sump, to the selector
  {
    points: [[PORT[0], PORT[1], 0.05], ...PORT_LINE, ...SUMP_LINE.slice(1)],
    mat: AIR.static,
    rate: () => s.flows.portL,
  },
  {
    points: [[PORT_R[0], PORT_R[1], 0.05], ...PORT_R_LINE, ...SUMP_LINE.slice(1)],
    mat: AIR.static,
    rate: () => s.flows.portR,
    show: () => usePs.getState().ports === "paired",
  },
  // cabin air through the alternate source
  { points: CABIN_IN, mat: AIR.cabin, rate: () => s.flows.alt },
  // cabin air in at a leaking fitting
  {
    points: [
      [-0.06, MANIFOLD_Y - 0.09, MANIFOLD_Z + 0.05],
      [-0.06, MANIFOLD_Y, MANIFOLD_Z],
    ],
    mat: AIR.cabin,
    rate: () => s.flows.leak,
  },
  // the test set's hoses
  { points: HOSE_PITOT, mat: AIR.pitot, rate: () => s.flows.testPitot, show: isTest },
  { points: HOSE_STATIC, mat: AIR.static, rate: () => s.flows.testStatic, show: isTest },
];

// ---------------------------------------------------------------- scene

function PanelSlab({ m }: { m: Mats }) {
  const panel = useGeo(() => slab(-0.33, 0.33, 0.2, 0.46, -0.012, 0, 0.02));
  return <P name="Instrument panel (schematic)" note={NOTE.panel} geometry={panel} material={m.panel} />;
}

function Model() {
  const m = useMemo(makeMats, []);
  const avionics = usePs((x) => x.avionics);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  useFrame(() => {
    const xray = usePsView.getState().xray;
    const set = (mat: THREE.Material, o: number) => {
      mat.opacity = xray ? o : 1;
      mat.depthWrite = !xray;
    };
    set(m.skin, 0.22);
    set(m.panel, 0.3);
    set(m.caseM, 0.2);
    set(m.pitotBody, 0.35);
  });
  return (
    <group>
      <Airframe m={m} />
      <Pitot m={m} />
      <Lines m={m} />
      <PanelSlab m={m} />
      {avionics === "g1000" ? <G1000Panel m={m} /> : <SixPackPanel m={m} />}
      <TestSet m={m} />
      {FLOWS.map((f, i) => (
        <Flow key={i} {...f} />
      ))}
      <Labels />
      <PressureTags />
    </group>
  );
}

function Labels() {
  const show = usePsView((x) => x.labels);
  const ports = usePs((x) => x.ports),
    g1000 = usePs((x) => x.avionics) === "g1000";
  const gl = useThree((x) => x.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const panel: [string, V3][] = g1000
    ? [
        ["PFD", [PFD[0], PFD[1] + PFD_H / 2 + 0.05, 0.02]],
        ["Standby airspeed", [STBY_ASI[0], STBY_ASI[1] + R * STBY + 0.035, 0.02]],
        ["Standby altimeter", [STBY_ALT[0], STBY_ALT[1] + R * STBY + 0.035, 0.02]],
        ["Air data computer", [ADC[0] + 0.02, ADC[1] - 0.07, ADC[2]]],
      ]
    : [
        ["Airspeed", [ASI[0], ASI[1] + R + 0.035, 0.02]],
        ["Altimeter", [ALT[0], ALT[1] + R + 0.035, 0.02]],
        ["Vertical speed", [VSI[0], VSI[1] + R + 0.035, 0.02]],
        ["Encoder", [ENCODER[0] + 0.02, ENCODER[1] - 0.06, ENCODER[2]]],
      ];
  const items: [string, V3][] = [
    ["Pitot tube (heated)", [PT.tip + 0.09, PT.y - 0.05, PT.z + 0.04]],
    ["Ram air", [PT.tip - 0.08, PT.y + 0.03, PT.z]],
    ["Drain hole", [PT.drain + 0.01, PT.y - 0.085, PT.z]],
    ["Static port", [PORT[0], PORT[1] + 0.06, PORT[2] + 0.02]],
    ["Sump", [SUMP[0], SUMP[1] - 0.07, SUMP[2] + 0.03]],
    ["ALT STATIC AIR selector", [VALVE[0] - 0.09, VALVE[1] + 0.1, VALVE[2]]],
    ...panel,
    ...(ports === "paired"
      ? ([["Right static port", [PORT_R[0], PORT_R[1] + 0.06, PORT_R[2] + 0.02]]] as [string, V3][])
      : []),
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

/** The pressure in each volume, as an altitude-like tag beside it: what it would read on an altimeter at 29.92. */
function PressureTags() {
  const show = usePsView((x) => x.labels);
  const gl = useThree((x) => x.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  const pit = useRef<HTMLSpanElement>(null),
    sta = useRef<HTMLSpanElement>(null);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.2) return;
    last.current = clock.elapsedTime;
    if (pit.current) pit.current.textContent = `${inHg(s.pitot).toFixed(3)} inHg`;
    if (sta.current) sta.current.textContent = `${inHg(s.stat).toFixed(3)} inHg`;
  });
  if (!show) return null;
  return (
    <>
      <Html
        position={[-0.4, 0.62, -0.09]}
        portal={portal}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="eng-label ps-tag ps-tag-pitot">
          Pitot side <span ref={pit} />
        </div>
      </Html>
      <Html
        position={[0.12, 0.15, -0.15]}
        portal={portal}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="eng-label ps-tag ps-tag-static">
          Static side <span ref={sta} />
        </div>
      </Html>
    </>
  );
}

/** Where the camera starts and what it orbits; it backs off along that line until the whole layout fits the view. */
const CAMERA: V3 = [-0.2, 0.4, 1.7];
const TARGET: V3 = [-0.26, 0.17, -0.05];

export default function PitotStaticScene() {
  return (
    <ComponentStage
      camera={{ position: CAMERA, fov: 38, near: 0.01, far: 20 }}
      target={TARGET}
      minDistance={0.3}
      maxDistance={5}
    >
      <Model />
    </ComponentStage>
  );
}
