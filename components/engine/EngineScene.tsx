"use client";
/**
 * The engine drawn from its spec: crankcase, four opposed cylinders with pistons, rods and valves, the crankshaft,
 * plugs that flash when they fire, intake runners, exhaust pipes that glow with EGT, heads tinted by CHT, injector
 * lines, magnetos and the propeller. Everything moves from the simulation's mutable state in `useFrame`.
 * Dimensions come from the spec where published (bore, stroke, envelope); the rest is schematic.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CylinderDef, EngineSpec } from "@/engines/types";
import { phaseOf, pistonDistance, valveLift } from "@/engines/model/cycle";
import { sparks } from "@/engines/model/engine";
import type { EngineSim } from "./store";

const IN = 0.0254;
const D2R = Math.PI / 180;

/** Dimensions in metres, from the spec where it publishes them. */
function dims(spec: EngineSpec) {
  const g = spec.geometry;
  const r = (g.strokeIn * IN) / 2,
    l = g.rodIn * IN,
    bore = g.boreIn * IN;
  const pinTdc = r + l; // piston pin from crank axis at top centre
  const crown = 0.045; // pin to crown, schematic
  const deck = pinTdc + crown + 0.004; // head face just past the crown at top centre
  const halfWidth = (g.envelopeIn.width * IN) / 2;
  return { r, l, bore, crown, deck, halfWidth, caseHalf: pinTdc - r - 0.02 };
}

type Mats = ReturnType<typeof makeMats>;
function makeMats() {
  const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra });
  return {
    case: std("#8a949c", { transparent: true }),
    barrel: std("#5e6a73", { transparent: true }),
    head: std("#9aa3aa", { transparent: true }),
    rocker: std("#2f3d49", { transparent: true }),
    piston: std("#c9ced2", { metalness: 0.6 }),
    rod: std("#7d878f", { metalness: 0.7 }),
    crank: std("#a2abb3", { metalness: 0.8, roughness: 0.3 }),
    valveI: std("#2f7fe6"),
    valveE: std("#e0522b"),
    plug: std("#f2f2ee", { roughness: 0.3 }),
    spark: new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0, depthWrite: false }),
    intake: std("#149c94", { transparent: true, opacity: 0.9 }),
    fuel: std("#2f7fe6", { emissive: "#2f7fe6", emissiveIntensity: 0 }),
    mag: std("#d9960f"),
    sump: std("#b85a2a", { transparent: true }),
    prop: std("#4a535c", { metalness: 0.5, roughness: 0.4 }),
    propTip: std("#e7b416"),
    disc: new THREE.MeshBasicMaterial({ color: "#7d8a94", transparent: true, opacity: 0.07, depthWrite: false }),
    spinner: std("#d8dde1", { metalness: 0.6, roughness: 0.25 }),
  };
}

/** Exhaust colour for a gas temperature (°F): steel through dull red to orange. */
function egtColor(f: number, out: THREE.Color) {
  const t = Math.max(0, Math.min(1, (f - 700) / 900));
  return out.setRGB(0.25 + 0.75 * t, 0.12 + 0.35 * t * t, 0.1 + 0.05 * t);
}
/** Head tint for a CHT (°F): grey when cold, warm amber near 400, red past the limit. */
function chtColor(f: number, limit: number, out: THREE.Color) {
  const t = Math.max(0, Math.min(1, (f - 100) / (limit - 100)));
  out.setRGB(0.6 + 0.35 * t, 0.64 - 0.1 * t, 0.67 - 0.45 * t);
  if (f > limit) out.setRGB(0.95, 0.2, 0.15);
  return out;
}

/** A finned tube along +z from z0 to z1. */
function finned(radius: number, fin: number, z0: number, z1: number, n: number) {
  const parts: THREE.BufferGeometry[] = [];
  const core = new THREE.CylinderGeometry(radius, radius, z1 - z0, 24, 1, true);
  core.rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
  parts.push(core);
  for (let i = 0; i < n; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
    const d = new THREE.CylinderGeometry(fin, fin, 0.0035, 28);
    d.rotateX(Math.PI / 2).translate(0, 0, z);
    parts.push(d);
  }
  return parts;
}

const merge = (gs: THREE.BufferGeometry[]) => {
  // small and static: draw them as one group of meshes rather than merging attributes
  return gs;
};

function tube(points: [number, number, number][], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 32, radius, 10, false);
}

interface CylRefs {
  piston: THREE.Mesh;
  rod: THREE.Mesh;
  valves: [THREE.Mesh, THREE.Mesh];
  sparks: [THREE.Mesh, THREE.Mesh];
  head: THREE.MeshStandardMaterial;
  exhaust: THREE.MeshStandardMaterial;
}

function EngineModel({ sim }: { sim: EngineSim }) {
  const spec = sim.spec;
  const d = useMemo(() => dims(spec), [spec]);
  const mats = useMemo(makeMats, []);
  const cyls = useRef<(CylRefs | null)[]>([]);
  const crank = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const blades = useRef<THREE.Group[]>([]);
  const disc = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Color(), []);
  const geo = useMemo(() => buildGeometry(spec, d), [spec, d]);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      geo.dispose();
    },
    [mats, geo],
  );

  useFrame((state) => {
    const s = sim.s,
      ui = sim.useUi.getState();
    const crankDeg = sim.anim.crank;
    const xray = ui.view.xray;
    for (const m of [mats.case, mats.barrel, mats.head, mats.rocker, mats.sump]) {
      m.opacity = xray ? 0.22 : 1;
      m.depthWrite = !xray;
    }
    if (crank.current) crank.current.rotation.x = (crankDeg % 360) * D2R;
    if (prop.current) {
      prop.current.visible = ui.view.prop;
      prop.current.rotation.x = (crankDeg % 360) * D2R;
      const blur = !ui.view.slow && s.rpm > 500;
      blades.current.forEach((b) => {
        b.visible = !blur;
        b.rotation.y = -(s.beta - 10) * D2R * 0.8;
      });
      if (disc.current) disc.current.visible = blur;
    }
    // a rough engine shakes on its mounts
    if (body.current) {
      const a = s.rpm > 50 ? s.rough * 0.006 : 0;
      const t = state.clock.elapsedTime;
      body.current.position.set(0, Math.sin(t * 37) * a, Math.sin(t * 23 + 1) * a);
    }
    const plugs = sparks(spec, ui.controls.mags, ui.failures, s.rpm);
    spec.geometry.cylinders.forEach((c, i) => {
      const refs = cyls.current[i];
      if (!refs) return;
      const ph = phaseOf(spec, c.n, crankDeg);
      const axis = c.side === "R" ? 90 : 270;
      const pinWorld = (c.pin + crankDeg) % 360;
      const alpha = pinWorld - axis;
      const dist = pistonDistance(spec, alpha);
      refs.piston.position.z = dist + d.crown / 2;
      // rod from crankpin (in this cylinder's frame: along +z is the cylinder axis) to the piston pin
      const a = alpha * D2R;
      const py = c.side === "R" ? -Math.sin(a) * d.r : Math.sin(a) * d.r; // pin offset across the axis
      const pz = Math.cos(a) * d.r;
      const mid = new THREE.Vector3(0, py / 2, (pz + dist) / 2);
      refs.rod.position.copy(mid);
      refs.rod.rotation.x = Math.atan2(py, dist - pz);
      const lift = valveLift(spec, ph);
      refs.valves[0].position.z = d.deck + 0.012 - lift.intake * 0.012;
      refs.valves[1].position.z = d.deck + 0.012 - lift.exhaust * 0.012;
      // the plugs flash from the spark through early combustion
      const since = (ph + spec.ignition.advanceBTC + 720) % 720;
      const lit = since < 40 && s.rpm > 30;
      const firing = s.cyl[i]?.work > 0.02;
      const fl = lit ? (firing ? 1 - since / 40 : 0.35) : 0;
      const top = spec.ignition.topPlugMag[c.n];
      const topOn = plugs[i] > 0 && !ui.failures.plugs[i][0] && !(top === "L" ? ui.failures.magL : ui.failures.magR);
      const botOn = plugs[i] > 0 && !ui.failures.plugs[i][1] && !(top === "L" ? ui.failures.magR : ui.failures.magL);
      const magOn = (m: "L" | "R") =>
        ui.controls.mags === "BOTH" ||
        ui.controls.mags === m ||
        (ui.controls.mags === "START" && m === spec.ignition.retardMag);
      const other = top === "L" ? "R" : "L";
      (refs.sparks[0].material as THREE.MeshBasicMaterial).opacity = topOn && magOn(top) ? fl : 0;
      (refs.sparks[1].material as THREE.MeshBasicMaterial).opacity = botOn && magOn(other) ? fl : 0;
      chtColor(s.cyl[i]?.cht ?? 60, spec.limits.chtMax.value, tmp);
      refs.head.color.copy(tmp);
      egtColor(s.cyl[i]?.egt ?? 60, tmp);
      refs.exhaust.color.copy(tmp);
      refs.exhaust.emissive.copy(tmp);
      refs.exhaust.emissiveIntensity = Math.max(0, ((s.cyl[i]?.egt ?? 0) - 900) / 900);
    });
    mats.fuel.emissiveIntensity = Math.min(1, s.fuel / 60);
    tmp.setRGB(0.55 + Math.min(0.35, (s.oilT - 60) / 500), 0.32, 0.17);
    mats.sump.color.copy(tmp);
  });

  return (
    <group ref={body}>
      {/* crankcase and sump */}
      <mesh geometry={geo.case} material={mats.case} />
      <mesh geometry={geo.sump} material={mats.sump} />
      {/* crankshaft: main journal and a throw per cylinder */}
      <group ref={crank}>
        <mesh geometry={geo.shaft} material={mats.crank} />
        {spec.geometry.cylinders.map((c) => (
          <group key={c.n} position={[c.x, 0, 0]} rotation={[(c.pin - 90) * D2R, 0, 0]}>
            <mesh geometry={geo.cheek} material={mats.crank} position={[0.025, 0, d.r / 2]} />
            <mesh geometry={geo.cheek} material={mats.crank} position={[-0.025, 0, d.r / 2]} />
            <mesh geometry={geo.crankpin} material={mats.crank} position={[0, 0, d.r]} />
          </group>
        ))}
      </group>
      {spec.geometry.cylinders.map((c, i) => (
        <Cylinder
          key={c.n}
          c={c}
          d={d}
          geo={geo}
          mats={mats}
          set={(r) => {
            cyls.current[i] = r;
          }}
        />
      ))}
      {/* induction: servo at the rear underside, runners up to the heads */}
      <mesh geometry={geo.servo} material={mats.intake} />
      {geo.runners.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.intake} />
      ))}
      {/* fuel: flow divider on top, a line to each nozzle */}
      <mesh geometry={geo.divider} material={mats.fuel} />
      {geo.fuelLines.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.fuel} />
      ))}
      {/* magnetos at the rear */}
      <mesh geometry={geo.mag} material={mats.mag} position={[-0.36, 0.08, 0.075]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={geo.mag} material={mats.mag} position={[-0.36, 0.08, -0.075]} rotation={[0, 0, Math.PI / 2]} />
      {/* propeller */}
      <group ref={prop} position={[geo.flangeX, 0, 0]}>
        <mesh geometry={geo.spinner} material={mats.spinner} />
        {Array.from({ length: spec.propeller.blades }, (_, k) => (
          <group key={k} rotation={[(k * 2 * Math.PI) / spec.propeller.blades, 0, 0]}>
            <group
              ref={(g) => {
                if (g) blades.current[k] = g;
              }}
            >
              <mesh geometry={geo.blade} material={mats.prop} />
              <mesh geometry={geo.tip} material={mats.propTip} />
            </group>
          </group>
        ))}
        <mesh ref={disc} geometry={geo.disc} material={mats.disc} />
      </group>
      <Labels sim={sim} d={d} flangeX={geo.flangeX} />
    </group>
  );
}

function Cylinder({
  c,
  d,
  geo,
  mats,
  set,
}: {
  c: CylinderDef;
  d: ReturnType<typeof dims>;
  geo: ReturnType<typeof buildGeometry>;
  mats: Mats;
  set: (r: CylRefs | null) => void;
}) {
  const head = useMemo(() => mats.head.clone(), [mats]);
  const exhaust = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#555", roughness: 0.6, metalness: 0.4, emissive: "#000" }),
    [],
  );
  const spark = useMemo(() => [mats.spark.clone(), mats.spark.clone()], [mats]);
  useEffect(
    () => () => {
      head.dispose();
      exhaust.dispose();
      spark.forEach((m) => m.dispose());
    },
    [head, exhaust, spark],
  );
  const piston = useRef<THREE.Mesh>(null),
    rod = useRef<THREE.Mesh>(null),
    vi = useRef<THREE.Mesh>(null),
    ve = useRef<THREE.Mesh>(null),
    s0 = useRef<THREE.Mesh>(null),
    s1 = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (piston.current && rod.current && vi.current && ve.current && s0.current && s1.current)
      set({
        piston: piston.current,
        rod: rod.current,
        valves: [vi.current, ve.current],
        sparks: [s0.current, s1.current],
        head,
        exhaust,
      });
    return () => set(null);
  }, [set, head, exhaust]);
  const flip = c.side === "L";
  return (
    <group position={[c.x, 0, 0]} rotation={[0, flip ? Math.PI : 0, 0]}>
      {geo.barrel.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.barrel} />
      ))}
      {geo.headFins.map((g, i) => (
        <mesh key={i} geometry={g} material={head} />
      ))}
      <mesh geometry={geo.rocker} material={mats.rocker} position={[0, 0.02, d.halfWidth - 0.03]} />
      <mesh ref={piston} geometry={geo.piston} material={mats.piston} />
      <mesh ref={rod} geometry={geo.rod} material={mats.rod} />
      <mesh ref={vi} geometry={geo.valve} material={mats.valveI} position={[0.03, 0.02, d.deck]} />
      <mesh ref={ve} geometry={geo.valve} material={mats.valveE} position={[-0.03, 0.02, d.deck]} />
      {/* plugs: top and bottom of the head */}
      <mesh geometry={geo.plug} material={mats.plug} position={[0, 0.1, d.deck + 0.03]} />
      <mesh geometry={geo.plug} material={mats.plug} position={[0, -0.1, d.deck + 0.03]} />
      <mesh ref={s0} geometry={geo.spark} material={spark[0]} position={[0, 0.1, d.deck + 0.03]} />
      <mesh ref={s1} geometry={geo.spark} material={spark[1]} position={[0, -0.1, d.deck + 0.03]} />
      {/* exhaust out of the bottom of the head, down and aft */}
      <mesh geometry={geo.exhaust} material={exhaust} />
    </group>
  );
}

function buildGeometry(spec: EngineSpec, d: ReturnType<typeof dims>) {
  const g = spec.geometry;
  const xs = g.cylinders.map((c) => c.x);
  const front = Math.max(...xs) + 0.13,
    rear = Math.min(...xs) - 0.2;
  const length = front - rear,
    mid = (front + rear) / 2;
  const caseG = new THREE.BoxGeometry(length, 0.26, d.caseHalf * 2);
  caseG.translate(mid, 0.0, 0);
  const sump = new THREE.BoxGeometry(length * 0.8, 0.1, d.caseHalf * 1.6);
  sump.translate(mid - 0.03, -0.18, 0);
  const shaft = new THREE.CylinderGeometry(0.028, 0.028, front - rear + 0.12, 16);
  shaft.rotateZ(Math.PI / 2).translate(mid + 0.06, 0, 0);
  const cheek = new THREE.BoxGeometry(0.014, 0.05, d.r + 0.05);
  const crankpin = new THREE.CylinderGeometry(0.026, 0.026, 0.064, 14);
  crankpin.rotateZ(Math.PI / 2);
  const barrel = finned(d.bore / 2 + 0.006, d.bore / 2 + 0.03, d.caseHalf, d.deck - 0.01, 12);
  const headFins = finned(d.bore / 2 + 0.02, d.bore / 2 + 0.045, d.deck - 0.01, d.halfWidth - 0.045, 7);
  const rocker = new THREE.BoxGeometry(0.15, 0.1, 0.05);
  const piston = new THREE.CylinderGeometry(d.bore / 2 - 0.002, d.bore / 2 - 0.002, d.crown + 0.02, 24);
  piston.rotateX(Math.PI / 2);
  const rod = new THREE.BoxGeometry(0.022, 0.03, d.l);
  const valve = new THREE.CylinderGeometry(0.021, 0.021, 0.006, 16);
  valve.rotateX(Math.PI / 2);
  const plug = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10);
  plug.rotateX(Math.PI / 2);
  const spark = new THREE.SphereGeometry(0.03, 12, 8);
  const exhaust = tube(
    [
      [-0.02, -0.06, d.deck + 0.04],
      [-0.04, -0.16, d.deck + 0.02],
      [-0.12, -0.26, d.deck - 0.04],
      [-0.3, -0.3, d.deck - 0.08],
    ],
    0.019,
  );
  const servo = new THREE.BoxGeometry(0.12, 0.08, 0.1);
  servo.translate(rear + 0.02, -0.24, 0);
  const runners = g.cylinders.map((c) => {
    const z = c.side === "R" ? 1 : -1;
    return tube(
      [
        [rear + 0.08, -0.24, 0],
        [c.x, -0.22, z * 0.08],
        [c.x + 0.02, -0.16, z * (d.deck - 0.04)],
        [c.x + 0.025, -0.07, z * (d.deck + 0.02)],
      ],
      0.018,
    );
  });
  const divider = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16);
  divider.translate(mid, 0.16, 0);
  const fuelLines = g.cylinders.map((c) => {
    const z = c.side === "R" ? 1 : -1;
    return tube(
      [
        [mid, 0.16, 0],
        [c.x, 0.15, z * 0.12],
        [c.x + 0.03, 0.08, z * (d.deck - 0.02)],
      ],
      0.004,
    );
  });
  const mag = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16);
  const flangeX = front + 0.06;
  const spinner = new THREE.ConeGeometry(0.12, 0.26, 24);
  spinner.rotateZ(-Math.PI / 2).translate(0.13, 0, 0);
  const R = (spec.propeller.diameterIn * IN) / 2;
  const blade = new THREE.BoxGeometry(0.014, R - 0.1, 0.13);
  blade.translate(0.02, (R + 0.1) / 2, 0);
  const tip = new THREE.BoxGeometry(0.0145, 0.08, 0.131);
  tip.translate(0.02, R - 0.04, 0);
  const disc = new THREE.CircleGeometry(R, 48);
  disc.rotateY(Math.PI / 2).translate(0.02, 0, 0);
  const all = [
    caseG,
    sump,
    shaft,
    cheek,
    crankpin,
    ...barrel,
    ...headFins,
    rocker,
    piston,
    rod,
    valve,
    plug,
    spark,
    exhaust,
    servo,
    ...runners,
    divider,
    ...fuelLines,
    mag,
    spinner,
    blade,
    tip,
    disc,
  ];
  return {
    case: caseG,
    sump,
    shaft,
    cheek,
    crankpin,
    barrel: merge(barrel),
    headFins: merge(headFins),
    rocker,
    piston,
    rod,
    valve,
    plug,
    spark,
    exhaust,
    servo,
    runners,
    divider,
    fuelLines,
    mag,
    flangeX,
    spinner,
    blade,
    tip,
    disc,
    dispose: () => all.forEach((x) => x.dispose()),
  };
}

function Labels({ sim, d, flangeX }: { sim: EngineSim; d: ReturnType<typeof dims>; flangeX: number }) {
  const show = sim.useUi((x) => x.view.labels);
  const propOn = sim.useUi((x) => x.view.prop);
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const spec = sim.spec;
  const items: [string, [number, number, number]][] = [
    ...spec.geometry.cylinders.map((c): [string, [number, number, number]] => [
      `Cyl ${c.n}`,
      [c.x, 0.17, (c.side === "R" ? 1 : -1) * (d.halfWidth - 0.02)],
    ]),
    [`Left mag (retard)`, [-0.42, 0.14, -0.075]],
    [`Right mag`, [-0.42, 0.14, 0.075]],
    ["Fuel servo", [-0.33, -0.3, 0]],
    ["Flow divider", [0, 0.22, 0]],
    ["Oil sump", [0, -0.25, 0.12]],
  ];
  if (propOn) items.push(["Propeller", [flangeX + 0.1, 0.55, 0]]);
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

export default function EngineScene({ sim }: { sim: EngineSim }) {
  return (
    <Canvas
      camera={{ position: [1.7, 0.9, 2.0], fov: 38, near: 0.02, far: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 2]} intensity={1.6} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
      <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
      <EngineModel sim={sim} />
      <OrbitControls makeDefault target={[0, -0.02, 0]} enableDamping minDistance={0.6} maxDistance={6} />
    </Canvas>
  );
}
