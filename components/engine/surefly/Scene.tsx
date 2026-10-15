"use client";
/**
 * The SIM4P on a bench: the module with its terminals, ports and harness cap, its drive gear meshing with an engine
 * gear, the harness to four spark plugs, and the power wire, p-lead and manifold pressure hose. X-ray shows what the
 * tech page lists inside (shaft, two sealed bearings, oil seal, Hall-effect sensors) with a schematic trigger wheel,
 * coils and circuit board. Axes: x along the shaft towards the engine, y up, z right; metres. SureFly publishes no
 * dimensions or internal layout, so shapes and sizes are schematic.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { D2R, gear, makeMats, merge, rod, slab, tube } from "@/components/engine/scene/kit";
import { P, useHover } from "@/components/engine/scene/parts";
import { bench, useUi } from "./store";

type V3 = [number, number, number];

/** Body: flange face at x = 0, body back to the cap. */
const R = 0.042,
  BODY0 = -0.105,
  CAP0 = -0.127,
  GEAR_R = 0.026;
/** Plugs, one per cylinder, in a row behind the SIM. */
const PLUG_X = -0.24;
const PLUGS: Record<number, V3> = {
  1: [PLUG_X, -0.05, 0.105],
  3: [PLUG_X, -0.05, 0.035],
  2: [PLUG_X, -0.05, -0.035],
  4: [PLUG_X, -0.05, -0.105],
};
/** Harness cap towers (rear face), one per plug; which tower feeds which cylinder is schematic. */
const TOWER: Record<number, V3> = {
  1: [CAP0 - 0.012, 0.016, 0.016],
  3: [CAP0 - 0.012, -0.016, 0.016],
  2: [CAP0 - 0.012, 0.016, -0.016],
  4: [CAP0 - 0.012, -0.016, -0.016],
};
/** Terminals on top of the body (SF1001 §2.3 figure, front to back). */
const TOP = R + 0.004;
const T = {
  power: [-0.022, TOP, 0.012] as V3,
  map: [-0.034, TOP, -0.012] as V3,
  led: [-0.05, TOP, 0] as V3,
  timing: [-0.066, TOP, 0.012] as V3,
  plead: [-0.082, TOP, -0.006] as V3,
  shield: [-0.096, TOP, 0.012] as V3,
};
const DIP: V3 = [-0.06, -0.006, R + 0.004];

function useGeo() {
  return useMemo(() => {
    const flange = merge([
      slab(-0.008, 0, -0.05, 0.05, -0.034, 0.034, 0.012),
      // the two slotted mounting ears
      slab(-0.008, 0, -0.012, 0.012, -0.072, -0.034, 0.008),
      slab(-0.008, 0, -0.012, 0.012, 0.034, 0.072, 0.008),
    ]);
    const body = rod(R, -0.008 - BODY0, 40).translate((BODY0 - 0.008) / 2, 0, 0);
    const cap = rod(R - 0.002, BODY0 - CAP0, 40).translate((BODY0 + CAP0) / 2, 0, 0);
    const towers = merge(Object.values(TOWER).map(([x, y, z]) => rod(0.0065, 0.026, 14).translate(x + 0.005, y, z)));
    const stud = new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 12).translate(0, 0.006, 0);
    const boss = new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 6).translate(0, 0.002, 0);
    const terminal = merge([stud, boss]);
    const barb = merge([
      new THREE.CylinderGeometry(0.0028, 0.0028, 0.018, 12).translate(0, 0.009, 0),
      new THREE.CylinderGeometry(0.0022, 0.0042, 0.005, 12).translate(0, 0.014, 0),
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 6).translate(0, 0.002, 0),
    ]);
    const portCap = new THREE.CylinderGeometry(0.0045, 0.0045, 0.01, 12).translate(0, 0.016, 0);
    const led = new THREE.SphereGeometry(0.0045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const plead = merge([
      new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 12).translate(0, 0.007, 0),
      new THREE.CylinderGeometry(0.006, 0.006, 0.005, 6).translate(0, 0.012, 0),
    ]);
    const dipPlug = new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6).rotateX(Math.PI / 2);
    const dipBlock = new THREE.BoxGeometry(0.012, 0.004, 0.003);
    const dipLever = new THREE.BoxGeometry(0.0018, 0.002, 0.002);
    // internals
    const shaft = rod(0.0075, 0.14, 20).translate(-0.04, 0, 0);
    const bearing = new THREE.TorusGeometry(0.013, 0.0045, 10, 28).rotateY(Math.PI / 2);
    const seal = new THREE.TorusGeometry(0.0105, 0.0025, 8, 28).rotateY(Math.PI / 2);
    const wheel = merge([
      rod(0.024, 0.003, 32).translate(-0.078, 0, 0),
      // one vane: the trigger the Hall-effect sensors see (schematic)
      slab(-0.08, -0.071, 0.02, 0.031, -0.006, 0.006, 0.002),
    ]);
    const hall = new THREE.BoxGeometry(0.006, 0.006, 0.01);
    const board = new THREE.BoxGeometry(0.08, 0.002, 0.05);
    const coil = rod(0.011, 0.04, 20);
    const drive = gear(GEAR_R, 22, 0.012, 0.004).translate(0.026, 0, 0);
    const dot = new THREE.SphereGeometry(0.0018, 8, 6);
    const nut = new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 6).rotateZ(Math.PI / 2);
    const engineGear = gear(GEAR_R, 22, 0.012, 0.004);
    const hub = rod(0.009, 0.05, 16).translate(0.01, 0, 0);
    const pad = slab(0.001, 0.009, -0.095, 0.05, -0.075, 0.075, 0.01);
    const plug = merge([
      new THREE.CylinderGeometry(0.008, 0.008, 0.016, 6),
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.028, 14).translate(0, 0.022, 0),
      new THREE.CylinderGeometry(0.005, 0.005, 0.012, 14).translate(0, -0.014, 0),
    ]);
    const head = slab(-0.02, 0.02, -0.06, -0.022, -0.026, 0.026, 0.005);
    const leads = Object.entries(TOWER).map(([cyl, [x, y, z]]) => {
      const [px, py, pz] = PLUGS[+cyl];
      return tube(
        [
          [x + 0.008, y, z],
          [x - 0.03, y * 1.4, z * 1.6],
          [px + 0.02, py + 0.07, pz],
          [px, py + 0.038, pz],
        ],
        0.003,
      );
    });
    const flash = new THREE.SphereGeometry(0.01, 14, 10);
    const battery = slab(-0.05, 0.0, 0.1, 0.145, -0.2, -0.14, 0.005);
    const power = tube(
      [
        [T.power[0], T.power[1] + 0.012, T.power[2]],
        [T.power[0], 0.09, T.power[2] - 0.05],
        [-0.025, 0.145, -0.15],
      ],
      0.002,
    );
    const pleadWire = tube(
      [
        [T.plead[0], T.plead[1] + 0.014, T.plead[2]],
        [T.plead[0] - 0.02, 0.1, -0.03],
        [-0.15, 0.11, -0.05],
      ],
      0.002,
    );
    const switchBox = slab(-0.175, -0.15, 0.095, 0.125, -0.065, -0.035, 0.004);
    const manifold = rod(0.012, 0.1, 24).translate(-0.03, 0.12, 0.11);
    const hose = tube(
      [
        [T.map[0], T.map[1] + 0.018, T.map[2]],
        [T.map[0], 0.09, 0.04],
        [-0.03, 0.12, 0.098],
      ],
      0.003,
    );
    return {
      flange,
      body,
      cap,
      towers,
      terminal,
      barb,
      portCap,
      led,
      plead,
      dipPlug,
      dipBlock,
      dipLever,
      shaft,
      bearing,
      seal,
      wheel,
      hall,
      board,
      coil,
      drive,
      dot,
      nut,
      engineGear,
      hub,
      pad,
      plug,
      head,
      leads,
      flash,
      battery,
      power,
      pleadWire,
      switchBox,
      manifold,
      hose,
    };
  }, []);
}

function useMats() {
  const mats = useMemo(() => {
    const m = makeMats();
    return {
      ...m,
      body: new THREE.MeshStandardMaterial({ color: "#3a4048", roughness: 0.5, metalness: 0.35, transparent: true }),
      capMat: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.6, metalness: 0.1, transparent: true }),
      brass: new THREE.MeshStandardMaterial({ color: "#c9a34a", roughness: 0.35, metalness: 0.8 }),
      board: new THREE.MeshStandardMaterial({ color: "#2f7a45", roughness: 0.7, metalness: 0.1 }),
      copper: new THREE.MeshStandardMaterial({ color: "#b8693a", roughness: 0.4, metalness: 0.7 }),
      ledMat: new THREE.MeshStandardMaterial({ color: "#244a2a", emissive: "#3dff6a", emissiveIntensity: 0 }),
      red: new THREE.MeshStandardMaterial({ color: "#c0392b", roughness: 0.6 }),
      hoseMat: new THREE.MeshStandardMaterial({ color: "#2d2f33", roughness: 0.9 }),
      flashes: [0, 1, 2, 3, 4].map(
        () => new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0, depthWrite: false }),
      ),
    };
  }, []);
  useEffect(
    () => () =>
      Object.values(mats).forEach((m) =>
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : (m as THREE.Material).dispose(),
      ),
    [mats],
  );
  return mats;
}

function Dip({ g, mats }: { g: ReturnType<typeof useGeo>; mats: ReturnType<typeof useMats> }) {
  const dip = useUi((x) => x.dip);
  return (
    <group position={DIP}>
      <P
        name="Dip switch"
        note="Four switches set the engine timing and the mode; ON is up toward the shaft (SF1001 §2.7)."
        geometry={g.dipBlock}
        material={mats.red}
      />
      {dip.map((on, i) => (
        <P
          key={i}
          name={`Dip switch ${i + 1}: ${on ? "ON" : "OFF"}`}
          note={
            i === 0
              ? "Switch 1 selects the mode: OFF advance, ON fixed (SF1001 §2.7)."
              : "Switches 2–4 select the data-plate timing (SF1001 §2.7)."
          }
          geometry={g.dipLever}
          material={mats.plug}
          // ON is up toward the shaft (+x), OFF away from it
          position={[on ? 0.0018 : -0.0018, 0.0025, -0.0045 + i * 0.003]}
        />
      ))}
    </group>
  );
}

function Sim() {
  const g = useGeo();
  const mats = useMats();
  const hose = useUi((x) => x.hose);
  const mounted = useUi((x) => x.mounted);
  const stage = useUi((x) => x.stage);
  const timingPower = useUi((x) => x.timingPower);
  const body = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const engine = useRef<THREE.Group>(null);
  useFrame(() => {
    const u = useUi.getState(),
      xray = u.view.xray;
    for (const m of [mats.body, mats.capMat, mats.acc]) {
      m.opacity = xray ? 0.22 : 1;
      m.depthWrite = !xray;
    }
    // the body turns in its ear slots; the shaft turns with the engine
    const clock = u.mounted ? u.clock : 0;
    if (body.current) body.current.rotation.x = -clock * D2R;
    if (spin.current) spin.current.rotation.x = -(bench.shaft + clock) * D2R;
    if (engine.current) engine.current.rotation.x = bench.crank * D2R;
    mats.ledMat.emissiveIntensity = bench.led ? 2.2 : 0;
    mats.ledMat.color.set(bench.led ? "#3dff6a" : "#244a2a");
    for (const cyl of [1, 2, 3, 4]) {
      const m = mats.flashes[cyl];
      const age = bench.spark[cyl];
      const slow = u.view.slow;
      const life = slow ? 0.35 : 0.08;
      m.opacity = age < life ? (bench.live[cyl] ? 0.95 : 0.4) * (1 - age / life) : 0;
      m.color.set(bench.live[cyl] ? "#9fd8ff" : "#d0d8e0");
    }
  });
  const shaftNote =
    "Turns at crankshaft speed (the magneto drive is 1.000:1 on a four-cylinder Lycoming, O-360 OM p. 2-7) in two sealed bearings behind an oil seal (tech page).";
  return (
    <>
      <group ref={body}>
        <P
          name="Mounting flange and ears"
          note="Sealed to the engine with an o-ring, no gasket; the slotted ears let the SIM be clocked to keep its timing light out (SF1001 §2.4, §2.10)."
          geometry={g.flange}
          material={mats.body}
        />
        <P
          name="SureFly SIM4P"
          note="Four-cylinder impulse-coupled magneto replacement, 4.4 lb (tech page). Needs a constant 8.5–30 VDC supply (SF1001 §1.1)."
          geometry={g.body}
          material={mats.body}
        />
        <P
          name="Harness cap"
          note="Takes a “Slick” style shielded harness; Bendix-style harnesses don't fit (SF1001 §2.13, tech page)."
          geometry={g.cap}
          material={mats.capMat}
        />
        <P
          name="Harness outlets"
          note="One lead per cylinder. A wasted-spark system: each spark fires two plugs at once (tech page)."
          geometry={g.towers}
          material={mats.capMat}
        />
        <P
          name="Power terminal"
          note="Permanent 8.5–30 VDC: 14 AWG minimum, 10 A circuit protection, as short as possible. The SIM grounds through the engine (SF1001 §2.12)."
          geometry={g.terminal}
          material={mats.brass}
          position={T.power}
        />
        <P
          name={hose ? "Manifold pressure port" : "Manifold pressure port (capped)"}
          note="Needed only in advance mode; cap it for fixed timing (SF1001 §2.14). The sensor reads 5–45 inHg (tech page)."
          geometry={g.barb}
          material={mats.brass}
          position={T.map}
        />
        {!hose && (
          <P
            name="Port cap"
            note="Fixed timing mode needs no manifold pressure (SF1001 §2.14 a)."
            geometry={g.portCap}
            material={mats.red}
            position={T.map}
          />
        )}
        <P
          name="LED"
          note="Green on the TIMING terminal, out at internal TDC (SF1001 §2.9). Blinks the dip switch code when switched on (§3.3)."
          geometry={g.led}
          material={mats.ledMat}
          position={T.led}
        />
        <P
          name="Timing terminal"
          note="Temporary 8.5–30 VDC here lights the LED to find the SIM's internal TDC before mounting (SF1001 §2.9)."
          geometry={g.terminal}
          material={mats.brass}
          position={T.timing}
        />
        <P
          name="P-lead terminal"
          note="To the ignition switch. Grounding it (switch OFF) stops the spark as on a magneto, and keeps the LED off (SF1001 §2.9 e, §2.15)."
          geometry={g.plead}
          material={mats.brass}
          position={T.plead}
        />
        <P
          name="P-lead shield (ground)"
          note="The p-lead's shield, 15 ± 2 in-lb (SF1001 §2.15 c)."
          geometry={g.terminal}
          material={mats.steel}
          position={T.shield}
        />
        <P
          name="Dip switch port plug"
          note="Thread locker, 20 ± 2 in-lb (SF1001 §2.7 j). The dip switch is behind it."
          geometry={g.dipPlug}
          material={mats.steel}
          position={[DIP[0], DIP[1], DIP[2] + 0.004]}
        />
        <Dip g={g} mats={mats} />
        {/* inside: seen in X-ray */}
        <P
          name="Hall-effect sensor"
          note="Hall-effect sensors give the SIM shaft speed and position (tech page); where they sit inside is schematic."
          geometry={g.hall}
          material={mats.black}
          position={[-0.0755, 0.033, 0]}
        />
        <P
          name="Hall-effect sensor"
          note="Hall-effect sensors give the SIM shaft speed and position (tech page); where they sit inside is schematic."
          geometry={g.hall}
          material={mats.black}
          position={[-0.0755, -0.033, 0]}
        />
        <P
          name="Circuit board"
          note="Reads speed, position and manifold pressure and times each spark (schematic)."
          geometry={g.board}
          material={mats.board}
          position={[-0.055, 0.032, 0]}
        />
        <P
          name="Ignition coil (cylinders 1 and 2)"
          note="One spark fires a cylinder on compression and its partner on exhaust; with the 1-3-2-4 order the pairs are 1 & 2 and 3 & 4 (inferred). Coil count and layout are schematic; 45 mJ per spark (tech page)."
          geometry={g.coil}
          material={mats.copper}
          position={[-0.05, -0.018, 0.02]}
        />
        <P
          name="Ignition coil (cylinders 3 and 4)"
          note="One spark fires a cylinder on compression and its partner on exhaust (inferred pairs). Coil count and layout are schematic; 45 mJ per spark (tech page)."
          geometry={g.coil}
          material={mats.copper}
          position={[-0.05, -0.018, -0.02]}
        />
      </group>
      <group ref={spin}>
        <P name="SIM shaft" note={shaftNote} geometry={g.shaft} material={mats.steel} />
        <P
          name="Sealed bearing"
          note="Two sealed bearings carry the shaft (tech page)."
          geometry={g.bearing}
          material={mats.bearing}
          position={[-0.014, 0, 0]}
        />
        <P
          name="Sealed bearing"
          note="Two sealed bearings carry the shaft (tech page)."
          geometry={g.bearing}
          material={mats.bearing}
          position={[-0.095, 0, 0]}
        />
        <P
          name="Oil seal"
          note="Keeps engine oil out of the module (tech page)."
          geometry={g.seal}
          material={mats.black}
          position={[-0.004, 0, 0]}
        />
        <P
          name="Trigger wheel"
          note="Turns past the Hall-effect sensors so the SIM knows shaft position and speed (schematic)."
          geometry={g.wheel}
          material={mats.darkSteel}
        />
        <P
          name="Drive gear"
          note="The magneto's own drive gear, re-used: castellated nut 120–180 in-lb, not over 250, and a cotter pin (SF1001 §2.6)."
          geometry={g.drive}
          material={mats.gear}
        />
        <P
          name="Machined dot"
          note="A normal install puts a gear tooth valley on this dot; turn the gear 180° on the shaft if the SIM can't be timed (SF1001 §2.6)."
          geometry={g.dot}
          material={mats.red}
          position={[0.033, GEAR_R * 0.55, 0]}
        />
        <P
          name="Castellated nut"
          note="120–180 in-lb, locked with a cotter pin (SF1001 §2.6)."
          geometry={g.nut}
          material={mats.steel}
          position={[0.036, 0, 0]}
        />
      </group>
      {(mounted || stage === "run") && (
        <>
          <P
            name="Engine accessory housing (schematic)"
            note="The magneto pad: the SIM mounts where the magneto was, on the same studs (SF1001 §2.10)."
            geometry={g.pad}
            material={mats.acc}
          />
          <group ref={engine} position={[0.026, -2 * GEAR_R - 0.002, 0]}>
            <P
              name="Engine drive gear"
              note="Drives the SIM at crankshaft speed (1.000:1)."
              geometry={g.engineGear}
              material={mats.gear}
            />
            <P name="Engine gear shaft" note="" geometry={g.hub} material={mats.steel} />
          </group>
        </>
      )}
      {[1, 2, 3, 4].map((cyl) => (
        <group key={cyl} position={PLUGS[cyl]}>
          <P name={`Cylinder ${cyl} head (schematic)`} note="" geometry={g.head} material={mats.head} />
          <P
            name={`Cylinder ${cyl} spark plug`}
            note="Aviation plugs gapped .022–.035 (tech page), to the engine maker's gap (SF1001 §1.1). Bright: fires on compression; dim: the wasted spark on exhaust."
            geometry={g.plug}
            material={mats.plug}
          />
          <mesh geometry={g.flash} material={mats.flashes[cyl]} position={[0, -0.022, 0]} />
        </group>
      ))}
      {g.leads.map((geo, i) => (
        <P
          key={i}
          name="Ignition harness"
          note="“Slick” style shielded harness (SF1001 §2.13)."
          geometry={geo}
          material={mats.lead}
        />
      ))}
      <P
        name="Battery (supply)"
        note="A permanent 8.5–30 VDC source; SureFly's airframe STC covers the power wire (SF1001 §1.1, §2.12)."
        geometry={g.battery}
        material={mats.alt}
      />
      <P
        name={stage === "time" && timingPower ? "Power wire (disconnected while timing)" : "Power wire"}
        note="14 AWG minimum, protected at 10 A (SF1001 §2.12 d)."
        geometry={g.power}
        material={mats.red}
      />
      <P
        name="P-lead"
        note="From the ignition switch: grounded is OFF (SF1001 §2.15)."
        geometry={g.pleadWire}
        material={mats.lead}
      />
      <P
        name="Ignition switch"
        note="OFF grounds the p-lead; ON lets the SIM fire and blink its code (SF1001 §3.3)."
        geometry={g.switchBox}
        material={mats.black}
      />
      {hose && (
        <>
          <P
            name="Manifold pressure hose"
            note="From the SIM's port to the intake port, existing MAP plumbing or the plenum; don't pinch or kink it (SF1001 §2.14)."
            geometry={g.hose}
            material={mats.hoseMat}
          />
          <P
            name="Intake manifold (schematic)"
            note="A manifold pressure source (SF1001 §2.14 c)."
            geometry={g.manifold}
            material={mats.intake}
          />
        </>
      )}
    </>
  );
}

function Labels() {
  const show = useUi((x) => x.view.labels);
  const hose = useUi((x) => x.hose);
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const items: [string, V3][] = [
    ["SureFly SIM", [-0.07, -0.07, 0.05]],
    ["LED", [T.led[0], T.led[1] + 0.03, 0.03]],
    ["Drive gear", [0.03, 0.055, 0.02]],
    ["Battery", [-0.025, 0.17, -0.17]],
    ["Ignition switch", [-0.162, 0.145, -0.05]],
    ...[1, 2, 3, 4].map((c): [string, V3] => [`Cyl ${c}`, [PLUG_X, -0.125, PLUGS[c][2]]]),
  ];
  if (hose) items.push(["Manifold", [-0.03, 0.15, 0.11]]);
  return (
    <>
      {items.map(([t, p]) => (
        <Html key={t} position={p} portal={portal} center zIndexRange={[0, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label">{t}</div>
        </Html>
      ))}
    </>
  );
}

function HoverTip() {
  const h = useHover((x) => x.hover);
  if (!h) return null;
  return (
    <div className="eng-tip" style={{ left: h.x + 14, top: h.y + 14 }}>
      <b>{h.name}</b>
      {h.note && <span>{h.note}</span>}
    </div>
  );
}

export default function SureFlyScene() {
  useEffect(() => () => useHover.setState({ hover: null }), []);
  return (
    <>
      <Canvas
        camera={{ position: [-0.36, 0.24, 0.62], fov: 38, near: 0.01, far: 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => useHover.setState({ hover: null })}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 2]} intensity={1.6} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <Sim />
        <Labels />
        <OrbitControls makeDefault target={[-0.13, -0.045, 0]} enableDamping minDistance={0.15} maxDistance={2} />
      </Canvas>
      <HoverTip />
    </>
  );
}
