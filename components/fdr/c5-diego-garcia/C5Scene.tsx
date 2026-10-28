"use client";
/**
 * The C-5 flying the replay. The airplane stays at the centre of the view, pitched and banked as the animation's
 * attitude indicator shows. Following the heading, the world turns about it, so the view keeps the airplane's nose
 * ahead; otherwise the world stays lined up with runway 31 and the airplane turns in it:
 * Diego Garcia below at its altitude (Google's 3D tiles; the sea without them), the cloud down to its base at 1,500 ft
 * and the path flown, traced off the animation's top view against its runway, with runway 31's localizer and 3°
 * glideslope. Above the base the view fades into the cloud just past the airplane, and wisps stream by. The slats, the flaps, the gear and the engines' fans
 * move with the data. Length, span, height, wing area, sweep and wing sections are the
 * C-5's (Wikipedia); the rest is schematic.
 */
import { Html } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { af, cyl, finSurface, fuselage, liftingSurface, loft, mergeGeos, type Ring } from "@/lib/geometry";
import { V, type Vec3 } from "@/lib/math";
import { dotTex } from "@/lib/materials";
import { FDR_DT, FDR_T0 } from "@/fdr/c5-diego-garcia/fdr";
import { GEAR_TRANSIT_S, TRACK, VARIATION_DEG, glideslopeFt, onRunway31, trackAt } from "@/fdr/c5-diego-garcia/model";
import { AFMAN, C5_DIEGO_GARCIA, LACKLEN, WIKI } from "@/fdr/c5-diego-garcia/spec";
import { ComponentStage } from "@/components/engine/ComponentStage";
import { P } from "@/components/engine/scene/parts";
import { replay, spec, TILES_KEY, useC5View, useTerrain } from "./store";
import { Terrain } from "./Terrain";

const D2R = Math.PI / 180,
  FT = 0.3048;
const A = spec.airplane;
const LEN = A.lengthFt * FT,
  SEMI = (A.spanFt * FT) / 2,
  HEIGHT = A.heightFt * FT,
  AREA = A.wingAreaSqFt * FT * FT,
  SWEEP = A.sweepDeg * D2R;

// ---------------------------------------------------------------- the airframe (x forward, y up, z right; metres)

/** Wheels on the ground with the gear down; the top of the T-tail is the C-5's height above it. */
const GROUND = -5;
const WING_Y = 4.5;
/** Root chord (schematic); the tip chord makes the trapezoid's area the wing's. */
const ROOT_C = 12.5,
  TIP_C = (2 * AREA) / (2 * SEMI) - ROOT_C;
/** Where the quarter-chord line, swept 25°, crosses the centreline. */
const QC0 = 2;
const span01 = (z: number) => Math.min(Math.abs(z) / SEMI, 1);
const chord = (z: number) => ROOT_C + (TIP_C - ROOT_C) * span01(z);
const wingLe = (z: number) => QC0 - Math.abs(z) * Math.tan(SWEEP) + chord(z) / 4;
/** NACA 0012.41 mod at the root to NACA 0011 mod at the tip (Wikipedia): symmetric sections. */
const tc = (z: number) => 0.1241 + (0.11 - 0.1241) * span01(z);
const WING = liftingSurface({ le: wingLe, chord, y: () => WING_Y, t: tc, m: 0 });

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** Chord fractions: slats ahead of SLAT_C, flaps behind FLAP_C. */
const SLAT_C = 0.12,
  FLAP_C = 0.7;
/** The slats per wing: the AFMAN's 14, half a side. */
const SLATS_PER_WING = C5_DIEGO_GARCIA.airplane.slats / 2;
/** Spanwise breaks (each side): the slats, equal widths, and the flap segments, schematic. */
const SLAT_Z = range(3.8, SEMI - 0.8, SLATS_PER_WING);
/** Half the drawn gap between neighbouring slats, m, so each of them can be told apart. */
const SLAT_GAP = 0.12;
/** The outboard end of the slats; the leading edge beyond it is fixed. */
const SLAT_TIP = SLAT_Z[SLAT_Z.length - 1];
const FLAP_Z = [3.8, 13.5, 23.5];
/** The drawn slat and full-flap motions: schematic. */
const SLAT_DROOP = 22 * D2R,
  FLAP_DROOP = 35 * D2R;

/** A wing piece between chord fractions c0..c1 over the span stations `zs`. */
const piece = (zs: number[], c0: number, c1: number): Ring[] => zs.map((z) => WING.sec(z, c0, c1));

/** Slat out: drooped about its trailing edge, forward and down, opening a slot. */
function slatOut(p: THREE.Vector3) {
  const c = chord(p.z),
    x0 = wingLe(p.z) - SLAT_C * c,
    y0 = WING_Y + af(SLAT_C, tc(p.z), 0)[1] * c;
  const dx = p.x - x0,
    dy = p.y - y0,
    cs = Math.cos(SLAT_DROOP),
    sn = Math.sin(SLAT_DROOP);
  return V(x0 + dx * cs + dy * sn + 0.07 * c, y0 - dx * sn + dy * cs - 0.035 * c, p.z);
}
/** Flap at full travel: aft and down about its leading edge. */
function flapOut(p: THREE.Vector3) {
  const c = chord(p.z),
    x0 = wingLe(p.z) - FLAP_C * c,
    y0 = WING_Y + af(FLAP_C, tc(p.z), 0)[0] * c;
  const dx = p.x - x0,
    dy = p.y - y0,
    cs = Math.cos(FLAP_DROOP),
    sn = Math.sin(FLAP_DROOP);
  return V(x0 + dx * cs - dy * sn - 0.12 * c, y0 + dx * sn + dy * cs - 0.03 * c, p.z);
}

/** A loft with one morph target: the same rings moved by `out`. */
function morphLoft(rings: Ring[], out: (p: THREE.Vector3) => THREE.Vector3) {
  const g = loft(rings),
    e = loft(rings.map((r) => r.map(out)));
  g.morphAttributes.position = [e.getAttribute("position") as THREE.BufferAttribute];
  g.morphAttributes.normal = [e.getAttribute("normal") as THREE.BufferAttribute];
  return g;
}

/** Fuselage stations [x, half width, half height, centre]: the upper deck forward, the aft body sweeping up. */
const FUSE = fuselage({
  table: [
    [LEN / 2, 0.15, 0.15, 0.6],
    [LEN / 2 - 0.7, 1.5, 1.7, 0.5],
    [LEN / 2 - 2.2, 2.6, 2.9, 0.5],
    [LEN / 2 - 4.6, 3.2, 3.6, 0.4],
    [LEN / 2 - 8.6, 3.5, 4.0, 0.2],
    [24, 3.6, 4.1, 0.1],
    [-12, 3.6, 4.1, 0.1],
    [-18, 3.4, 3.8, 0.5],
    [-24, 2.8, 3.1, 1.3],
    [-30, 2.0, 2.3, 2.2],
    [-35, 1.2, 1.5, 2.9],
    [-LEN / 2, 0.5, 0.7, 3.3],
  ],
  nTop: 2.3,
  nBot: 2.5,
  tumble: 0,
});

/** The fin and, on top of it, the stabilizer: the top of the T-tail at the C-5's height above the ground. */
const TAIL_Y = GROUND + HEIGHT - 0.35;
const FIN = finSurface({ le: (h) => -21 - (h - 3.5) * 0.82, chord: (h) => 13 - (h - 3.5) * 0.5, t: () => 0.11 });
const STAB_SEMI = 10.5;
const STAB = liftingSurface({
  le: (z) => -30 - Math.abs(z) * 0.58,
  chord: (z) => 7.5 - Math.abs(z) * 0.3,
  y: () => TAIL_Y,
  t: () => 0.1,
  m: 0,
});

/** Engines 1 to 4, left outboard to right outboard: spanwise station (schematic). */
const ENGINE_Z = [-20.5, -11, 11, 20.5];
const POD_LEN = 8;
const podAt = (z: number): Vec3 => {
  const c = chord(z);
  return [wingLe(z) + 4, WING_Y - 0.5 * tc(z) * c - 0.7 - 1.55, z];
};

/** Main gear trucks [x, z] and how far they rise into the pods; nose gear the same. */
const MAIN_TRUCKS: [number, number][] = [
  [4.2, -3.1],
  [-4.2, -3.1],
  [4.2, 3.1],
  [-4.2, 3.1],
];
const MAIN_UP = 1.55;
const NOSE_X = 29.5,
  NOSE_UP = 1.6;
const WHEEL_R = 0.6;

function airframeGeos() {
  const centre = [...range(-SEMI, 0, 14), ...range(0, SEMI, 14).slice(1)];
  const fixed = mergeGeos([
    loft(piece(centre, SLAT_C, FLAP_C)),
    loft(piece(range(-SLAT_Z[0], SLAT_Z[0], 4), 0, SLAT_C)),
    loft(piece(range(SLAT_TIP, SEMI, 2), 0, SLAT_C)),
    loft(piece(range(-SEMI, -SLAT_TIP, 2), 0, SLAT_C)),
    loft(piece(range(-FLAP_Z[0], FLAP_Z[0], 4), FLAP_C, 1)),
    loft(piece(range(FLAP_Z[2], SEMI, 6), FLAP_C, 1)),
    loft(piece(range(-SEMI, -FLAP_Z[2], 6), FLAP_C, 1)),
  ]);
  const slats: THREE.BufferGeometry[] = [],
    flaps: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < SLAT_Z.length - 1; k++)
      slats.push(
        morphLoft(piece(range(s * (SLAT_Z[k] + SLAT_GAP), s * (SLAT_Z[k + 1] - SLAT_GAP), 2), 0, SLAT_C), slatOut),
      );
    for (let k = 0; k < FLAP_Z.length - 1; k++)
      flaps.push(morphLoft(piece(range(s * FLAP_Z[k], s * FLAP_Z[k + 1], 4), FLAP_C, 1), flapOut));
  }
  const fin = loft(range(3.5, TAIL_Y, 6).map((h) => FIN.sec(h, 0, 1)));
  const stab = loft(range(-STAB_SEMI, STAB_SEMI, 8).map((z) => STAB.sec(z, 0, 1)));

  // a TF39's pod: the fan cowl, the core cowl behind it, an open inlet
  const pod = new THREE.LatheGeometry(
    [
      [1.3, 0],
      [1.5, -0.4],
      [1.56, -1.5],
      [1.46, -3.5],
      [1.15, -5],
      [0.85, -5.6],
      [0.6, -7.2],
      [0.25, -POD_LEN],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    32,
  );
  pod.rotateZ(-Math.PI / 2);
  const blade = new THREE.BoxGeometry(0.05, 1.05, 0.28);
  const fan = mergeGeos(
    Array.from({ length: 16 }, (_, k) =>
      blade
        .clone()
        .rotateY(0.6)
        .translate(0, 0.72, 0)
        .rotateX((k * Math.PI * 2) / 16),
    ),
  );
  const spinner = new THREE.ConeGeometry(0.42, 0.9, 20).rotateZ(-Math.PI / 2).translate(0.2, 0, 0);
  const hub = cyl(1.25, 0.06, "x", 32).translate(-0.6, 0, 0);
  const pylon = new THREE.BoxGeometry(5.5, 1.6, 0.45);

  const gearPod = new THREE.CapsuleGeometry(1.2, 15.6, 8, 20).rotateZ(Math.PI / 2);
  const wheel = cyl(WHEEL_R, 0.38, "z", 24);
  const truck = mergeGeos([
    ...[-1.2, 0, 1.2].flatMap((x) => [-0.38, 0.38].map((z) => wheel.clone().translate(x, GROUND + WHEEL_R, z))),
    new THREE.BoxGeometry(3.2, 0.25, 0.3).translate(0, GROUND + WHEEL_R + 0.1, 0),
    cyl(0.24, 1.6, "y").translate(0, GROUND + WHEEL_R + 0.9, 0),
  ]);
  const noseGear = mergeGeos([
    ...[-1.2, -0.4, 0.4, 1.2].map((z) => cyl(0.55, 0.36, "z", 24).translate(0, GROUND + 0.55, z)),
    cyl(0.22, 1.7, "y").translate(0, GROUND + 0.55 + 0.9, 0),
  ]);
  return {
    fuse: FUSE.geo({ step: 0.6, N: 40 }),
    fixed,
    slats,
    flaps,
    fin,
    stab,
    pod,
    fan,
    spinner,
    hub,
    pylon,
    gearPod,
    truck,
    noseGear,
  };
}

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...extra });

const NOTE = {
  fuse: `Lockheed C-5 Galaxy, ${Math.floor(A.lengthFt)} ft ${Math.round((A.lengthFt % 1) * 12)} in long (${WIKI}). Its length, span, height, wing area, sweep and wing sections are the C-5's; the rest is drawn schematically.`,
  wing: `High wing, ${A.sweepDeg}° of sweep, ${A.wingAreaSqFt.toLocaleString("en-US")} sq ft; NACA 0012.41 mod at the root to NACA 0011 mod at the tip (${WIKI}). Drawn flat.`,
  slats: `Leading-edge slats, ${C5_DIEGO_GARCIA.airplane.slats} of them (${AFMAN}), drawn ${SLATS_PER_WING} a wing. Their “target” pads didn't seat as they extended; the slat annunciator came on, and the malfunction disabled the stick-shaker stall warning (${LACKLEN}). Amber while the animation shows neither lock LOCKED; the shortfall is exaggerated to be seen.`,
  flaps: `Trailing-edge flaps, at the animation's “% FLAP”: 40% from about 52 s (“Flaps 40”). Their angle at each percent isn't in these sources: drawn schematically.`,
  tail: `T-tail (${WIKI}): the stabilizer on top of the fin.`,
  engine: (k: number) =>
    `Engine ${k}: ${A.engines.replace(/s$/, "")}. Its fan turns here in proportion to the animation's N1, slowed down to be seen.`,
  pylon: "Engine pylon (schematic).",
  gearPod: "Main landing gear pod (schematic).",
  main: `Main landing gear: “its high-flotation main landing gear provides ${A.wheels} wheels” (${WIKI}). Drawn schematically, following the gear handle over ${GEAR_TRANSIT_S} s (the travel time isn't in these sources). It was up as they recovered over the lagoon (${LACKLEN}).`,
  nose: `Nose landing gear (schematic), following the gear handle over ${GEAR_TRANSIT_S} s.`,
  lights: `Wingtip lights: the tower saw the two vertically aligned, like a weather balloon rising (${LACKLEN}).`,
  path: `Which way the airplane is moving: the climb angle through the air, from the altitude's rate and the true airspeed (approximate). Wings level, its angle from the nose is about the angle of attack. Below the 50 kt floor the airplane was slower, so its path steeper than drawn.`,
  sea: `Sea level: the animation's altitude is above it. ${LACKLEN}: the recovery came at 733 ft above the lagoon.`,
  cloud: `Cloud base, 1,500 ft: passing it the crew regained visual conditions (${LACKLEN}). The tops aren't known.`,
};

/** A mesh moved between its two shapes by `get` (0 to 1), each frame. */
function Morph({
  name,
  note,
  geometry,
  material,
  get,
}: {
  name: string;
  note: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  get: () => number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    if (!m.morphTargetInfluences) m.updateMorphTargets();
    if (m.morphTargetInfluences) m.morphTargetInfluences[0] = get();
  });
  return <P name={name} note={note} geometry={geometry} material={material} meshRef={ref} />;
}

const slatsOut = () => replay.f.slats;
const flapsOut = () => replay.f.flaps / 100;

function Airplane() {
  const g = useMemo(airframeGeos, []);
  const m = useMemo(
    () => ({
      skin: mat("#8f979e"),
      slat: mat("#8f979e", { emissive: "#e09a1a", emissiveIntensity: 0 }),
      pod: mat("#a4abb1", { side: THREE.DoubleSide }),
      fan: mat("#2a2f34", { metalness: 0.6 }),
      dark: mat("#1f2326", { roughness: 0.9, metalness: 0 }),
      strut: mat("#6b7378", { metalness: 0.6 }),
      red: new THREE.MeshBasicMaterial({ color: "#ff3b30" }),
      green: new THREE.MeshBasicMaterial({ color: "#34c759" }),
    }),
    [],
  );
  const tip = useMemo(() => new THREE.SphereGeometry(0.3, 12, 8), []);
  const body = useRef<THREE.Group>(null);
  const fans = useRef<(THREE.Group | null)[]>([]);
  const trucks = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef({ t: replay.t, a: [0, 0, 0, 0] });
  useFrame(() => {
    const f = replay.f;
    body.current?.rotation.set(f.bank * D2R, 0, f.pitch * D2R, "ZYX");
    m.slat.emissiveIntensity = !f.slatExtLocked && !f.slatRetLocked ? 0.75 : 0;
    // the fans turn only as the replay moves: still when paused, and not in a seek
    const dt = replay.t - spin.current.t;
    spin.current.t = replay.t;
    const step = dt > 0 && dt < 0.2 ? dt : 0;
    fans.current.forEach((fan, k) => {
      spin.current.a[k] += (f.n1[k] / 100) * 9 * step;
      fan?.rotation.set(spin.current.a[k], 0, 0);
    });
    const down = f.gearTravel;
    trucks.current.forEach((tr, k) => tr?.position.setY((1 - down) * (k < 4 ? MAIN_UP : NOSE_UP)));
  });
  const tipX = wingLe(SEMI) - 0.4 * TIP_C;
  return (
    <group ref={body}>
      <P name="Fuselage" note={NOTE.fuse} geometry={g.fuse} material={m.skin} />
      <P name="Wing" note={NOTE.wing} geometry={g.fixed} material={m.skin} />
      {g.slats.map((geo, k) => (
        <Morph key={`s${k}`} name="Slat" note={NOTE.slats} geometry={geo} material={m.slat} get={slatsOut} />
      ))}
      {g.flaps.map((geo, k) => (
        <Morph key={`f${k}`} name="Flap" note={NOTE.flaps} geometry={geo} material={m.skin} get={flapsOut} />
      ))}
      <P name="Fin" note={NOTE.tail} geometry={g.fin} material={m.skin} />
      <P name="Horizontal stabilizer" note={NOTE.tail} geometry={g.stab} material={m.skin} />
      {ENGINE_Z.map((z, k) => {
        const [x, y] = podAt(z);
        return (
          <group key={z} position={[x, y, z]}>
            <P name={`Engine ${k + 1}`} note={NOTE.engine(k + 1)} geometry={g.pod} material={m.pod} />
            <P
              name="Pylon"
              note={NOTE.pylon}
              geometry={g.pylon}
              material={m.skin}
              position={[-POD_LEN / 2 + 1.5, 1.95, 0]}
            />
            <group ref={(el) => void (fans.current[k] = el)} position={[-0.5, 0, 0]}>
              <P name={`Engine ${k + 1} fan`} note={NOTE.engine(k + 1)} geometry={g.fan} material={m.fan} />
              <P name={`Engine ${k + 1} fan`} note={NOTE.engine(k + 1)} geometry={g.spinner} material={m.fan} />
            </group>
            <P name={`Engine ${k + 1} fan`} note={NOTE.engine(k + 1)} geometry={g.hub} material={m.dark} />
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <P
          key={s}
          name="Main gear pod"
          note={NOTE.gearPod}
          geometry={g.gearPod}
          material={m.skin}
          position={[0, -2.9, s * 3.0]}
        />
      ))}
      {MAIN_TRUCKS.map(([x, z], k) => (
        <group key={k} ref={(el) => void (trucks.current[k] = el)}>
          <P name="Main landing gear" note={NOTE.main} geometry={g.truck} material={m.dark} position={[x, 0, z]} />
        </group>
      ))}
      <group ref={(el) => void (trucks.current[4] = el)}>
        <P
          name="Nose landing gear"
          note={NOTE.nose}
          geometry={g.noseGear}
          material={m.dark}
          position={[NOSE_X, 0, 0]}
        />
      </group>
      <P
        name="Left wingtip light"
        note={NOTE.lights}
        geometry={tip}
        material={m.red}
        position={[tipX, WING_Y, -SEMI]}
      />
      <P
        name="Right wingtip light"
        note={NOTE.lights}
        geometry={tip}
        material={m.green}
        position={[tipX, WING_Y, SEMI]}
      />
      <PartLabels />
    </group>
  );
}

// ---------------------------------------------------------------- labels

function usePortal() {
  const gl = useThree((x) => x.gl);
  return useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
}

function Label({ at, children }: { at: Vec3; children: React.ReactNode }) {
  const portal = usePortal();
  return (
    <Html position={at} portal={portal} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="eng-label">{children}</div>
    </Html>
  );
}

function PartLabels() {
  const show = useC5View((x) => x.labels);
  const n1 = useRef<(HTMLSpanElement | null)[]>([]);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.2) return;
    last.current = clock.elapsedTime;
    n1.current.forEach((el, k) => {
      if (el) el.textContent = `${Math.round(replay.f.n1[k])}%`;
    });
  });
  if (!show) return null;
  return (
    <>
      <Label at={[wingLe(17) + 0.5, WING_Y + 1.2, -17]}>Slats</Label>
      <Label at={[wingLe(9) - chord(9) - 1.5, WING_Y, -9]}>Flaps</Label>
      <Label at={[0, GROUND - 1, -5.5]}>Main gear</Label>
      <Label at={[NOSE_X, GROUND - 1, 0]}>Nose gear</Label>
      <Label at={[-33, TAIL_Y + 2.2, 0]}>T-tail</Label>
      {ENGINE_Z.map((z, k) => {
        const [x, y] = podAt(z);
        return (
          <Label key={z} at={[x + 0.5, y - 2.6, z]}>
            Engine {k + 1} <span ref={(el) => void (n1.current[k] = el)} className="n" />
          </Label>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- the world around it

const CLOUD_M = spec.cloudBaseFt * FT;
const N = TRACK.east.length;
/** The track in the world's frame: east x, up y, south z. */
const trackPositions = (y?: number) => {
  const p = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) p.set([TRACK.east[k], y ?? TRACK.up[k], -TRACK.north[k]], k * 3);
  return new THREE.BufferAttribute(p, 3);
};
const CENTRE = (() => {
  let e = 0,
    n = 0;
  for (let k = 0; k < N; k++) [e, n] = [e + TRACK.east[k] / N, n + TRACK.north[k] / N];
  return [e, -n] as const;
})();
const SEA = 60_000;

function World() {
  const view = useC5View();
  const terrain = view.terrain && TILES_KEY !== "";
  const island = useTerrain((x) => x.state === "shown") && terrain;
  const turn = useRef<THREE.Group>(null),
    shift = useRef<THREE.Group>(null),
    under = useRef<THREE.Group>(null);
  const w = useMemo(() => {
    const pos = trackPositions();
    const past = new THREE.BufferGeometry().setAttribute("position", pos);
    const ahead = new THREE.BufferGeometry().setAttribute("position", pos);
    const shadow = new THREE.BufferGeometry().setAttribute("position", trackPositions(2));
    // a line down to the sea every 10 s, to read the path's height
    const drops: number[] = [];
    for (let k = 0; k < N; k += Math.round(10 / FDR_DT))
      drops.push(TRACK.east[k], TRACK.up[k], -TRACK.north[k], TRACK.east[k], 2, -TRACK.north[k]);
    const dropGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(drops, 3));
    const grid = new THREE.GridHelper(SEA, SEA / 500, "#4f86a8", "#2f6385");
    grid.position.set(CENTRE[0], 1, CENTRE[1]);
    const faint = new THREE.LineBasicMaterial({ color: "#9fc3da", transparent: true, opacity: 0.45 });
    // built here, not as <threeLine>: R3F checks the prefixed name on every prop update and throws
    const line = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Line(geo, mat);
    return {
      past,
      ahead,
      dropGeo,
      grid,
      faint,
      pastLine: line(past, new THREE.LineBasicMaterial({ color: "#e8573f" })),
      aheadLine: line(ahead, new THREE.LineBasicMaterial({ color: "#e8573f", transparent: true, opacity: 0.3 })),
      shadowLine: line(shadow, faint),
      sea: new THREE.MeshStandardMaterial({ color: "#174a6b", roughness: 1, metalness: 0 }),
      cloud: new THREE.MeshBasicMaterial({
        color: CLOUD_COLOUR,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      plane: new THREE.PlaneGeometry(SEA, SEA).rotateX(-Math.PI / 2).translate(CENTRE[0], 0, CENTRE[1]),
    };
  }, []);
  useFrame(() => {
    const [e, n, u] = trackAt(replay.t);
    // the track is in true axes: the view looks along the heading, or along runway 31 when it doesn't follow it
    turn.current?.rotation.set(0, (view.follow ? trueHeading() : RUNWAY_31) * D2R - Math.PI / 2, 0);
    shift.current?.position.set(-e, -u, n);
    under.current?.position.set(0, -u, 0);
    const i = Math.min(Math.max(Math.floor((replay.t - FDR_T0) / FDR_DT), 0), N - 1);
    w.past.setDrawRange(0, i + 1);
    w.ahead.setDrawRange(i, N - i);
  });
  // the camera frames the airplane, not the world
  return (
    <group userData={{ cameraBounds: false }}>
      <group ref={turn}>
        {view.cloud && <InCloud />}
        <group ref={shift}>
          {terrain && <Terrain />}
          {!island && <P name="Sea" note={NOTE.sea} geometry={w.plane} material={w.sea} />}
          {!island && <primitive object={w.grid} />}
          {view.trail && (
            <>
              <lineSegments geometry={w.dropGeo} material={w.faint} />
              {/* the ground track would come and go through the island's surface as its tiles sharpen */}
              {!island && <primitive object={w.shadowLine} />}
              <primitive object={w.pastLine} />
              <primitive object={w.aheadLine} />
            </>
          )}
          {view.ils && <Ils labels={view.labels} />}
          {view.cloud && (
            <mesh
              geometry={w.plane}
              material={w.cloud}
              position={[0, CLOUD_M, 0]}
              renderOrder={1}
              raycast={() => null}
            />
          )}
        </group>
      </group>
      <group ref={under}>
        {view.labels && <Label at={[160, 0, 0]}>Sea level</Label>}
        {view.labels && view.cloud && <Label at={[160, CLOUD_M, 0]}>Cloud base, 1,500 ft</Label>}
      </group>
      {view.path && (
        <Yaw>
          <PathArrow />
        </Yaw>
      )}
    </group>
  );
}

const CLOUD_COLOUR = "#e9eef2";
/** The cloud thickens over this much height above its base, so the view clears as the airplane comes out of it, ft. */
const CLOUD_DEEP_FT = 300;
/** How far past the airplane the view has faded into the cloud once it is deep in it, m: the sea is out of sight. */
const CLOUD_SEEN_M = 400;
const WISPS = 320;
/** Half the size of the box of air around the airplane the wisps fill: east, up, south, m. */
const WISP_BOX: Vec3 = [450, 160, 450];
/** Most wisps are brighter than the cloud around them, every third darker: denser and thinner patches. */
const WISP_COLOURS = ["#ffffff", "#ffffff", "#c9d3db"];
/** An even spread of points in the unit cube (Roberts' R3 sequence), so the wisps are the same on every load. */
const R3 = [0.8191725134, 0.6710436067, 0.5497004779];
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return k * k * (3 - 2 * k);
};
/** Into [-half, half), wrapping round: the wisps the airplane leaves behind come back ahead of it. */
const wrap = (x: number, half: number) => ((((x + half) % (2 * half)) + 2 * half) % (2 * half)) - half;

/**
 * In the cloud, above its base: past the airplane the view fades into it, its colour fills the sky and wisps, still in
 * the air, stream past as the airplane flies through them. Below the base none of this shows.
 */
function InCloud() {
  const scene = useThree((s) => s.scene);
  const fog = useRef<THREE.Fog>(null),
    sky = useRef<THREE.Mesh>(null),
    wisps = useRef<THREE.Points>(null);
  const c = useMemo(() => {
    const colour = new THREE.Color(CLOUD_COLOUR);
    const seeds = new Float32Array(WISPS * 3);
    for (let k = 0; k < WISPS; k++)
      for (let j = 0; j < 3; j++) seeds[k * 3 + j] = (((0.5 + R3[j] * (k + 1)) % 1) * 2 - 1) * WISP_BOX[j];
    const tint = new THREE.BufferAttribute(new Float32Array(WISPS * 4), 4);
    const shade = new THREE.Color();
    for (let k = 0; k < WISPS; k++) {
      shade.set(WISP_COLOURS[k % WISP_COLOURS.length]);
      tint.setXYZW(k, shade.r, shade.g, shade.b, 0);
    }
    return {
      seeds,
      wisp: new THREE.BufferGeometry()
        .setAttribute("position", new THREE.BufferAttribute(new Float32Array(WISPS * 3), 3))
        .setAttribute("color", tint),
      // not tone mapped, like the fog's colour, which is added after it: the cloud is one colour wherever it shows
      wispMat: new THREE.PointsMaterial({
        size: 110,
        map: dotTex(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      shell: new THREE.SphereGeometry(30_000, 32, 16),
      skyMat: new THREE.MeshBasicMaterial({
        color: colour,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
      eye: new THREE.Vector3(),
    };
  }, []);
  useFrame(({ camera }) => {
    const deep = smooth(0, 1, (replay.f.alt - spec.cloudBaseFt) / CLOUD_DEEP_FT);
    // the airplane is at the centre: the fog starts just past it, so it stays clear however far the camera is
    const away = camera.position.length();
    if (fog.current) {
      fog.current.near = away + 40;
      fog.current.far = deep > 0.01 ? away + 40 + CLOUD_SEEN_M / deep : 1e9;
    }
    if (sky.current) {
      sky.current.visible = deep > 0;
      (sky.current.material as THREE.MeshBasicMaterial).opacity = deep;
    }
    const points = wisps.current;
    if (!points) return;
    points.visible = deep > 0;
    if (!points.visible) return;
    const [e, n, u] = trackAt(replay.t);
    // the camera in the wisps' frame, which turns with the world
    const eye = points.parent ? points.parent.worldToLocal(c.eye.copy(camera.position)) : c.eye.set(0, 0, 0);
    const position = points.geometry.attributes.position as THREE.BufferAttribute,
      tint = points.geometry.attributes.color as THREE.BufferAttribute;
    for (let k = 0; k < WISPS; k++) {
      const x = wrap(c.seeds[k * 3] - e, WISP_BOX[0]),
        y = wrap(c.seeds[k * 3 + 1] - u, WISP_BOX[1]),
        z = wrap(c.seeds[k * 3 + 2] + n, WISP_BOX[2]);
      position.setXYZ(k, x, y, z);
      const edge = Math.max(Math.abs(x) / WISP_BOX[0], Math.abs(y) / WISP_BOX[1], Math.abs(z) / WISP_BOX[2]);
      // faded at the box's edges, where they wrap round, clear of the airplane and the camera, and only in the cloud
      tint.setW(
        k,
        0.7 *
          deep *
          (1 - smooth(0.7, 1, edge)) *
          smooth(60, 140, Math.hypot(x, y, z)) *
          smooth(80, 220, Math.hypot(x - eye.x, y - eye.y, z - eye.z)) *
          smooth(0, 40, u + y - CLOUD_M),
      );
    }
    position.needsUpdate = true;
    tint.needsUpdate = true;
  });
  return (
    <>
      {/* the scene's fog, while this is shown */}
      {createPortal(<fog ref={fog} attach="fog" args={[CLOUD_COLOUR, 1e8, 1e9]} />, scene)}
      {/* drawn first, behind everything: only the empty sky takes its colour */}
      <mesh ref={sky} geometry={c.shell} material={c.skyMat} renderOrder={-1} raycast={() => null} />
      <points ref={wisps} geometry={c.wisp} material={c.wispMat} frustumCulled={false} raycast={() => null} />
    </>
  );
}

const ILS = spec.airport.ils;
const NM_M = 1852;
const ILS_COLOUR = "#d24fd2";
/** On runway 31's extended centreline, `along` metres from its threshold (negative short of it), `y` up: the track's
 * frame, east x, up y, south z. */
const onCentreline = (along: number, y: number) => {
  const rw = C5_DIEGO_GARCIA.airport.runway.heading31T * D2R;
  return new THREE.Vector3(along * Math.sin(rw), y, -along * Math.cos(rw));
};
const glideslopeAt = (along: number) => onCentreline(along, glideslopeFt(along) * FT);

/**
 * Runway 31's ILS, out to the glideslope's range: the localizer's course along the extended centreline on the sea, the
 * glideslope dashed over it with a line down every nautical mile, and a line from the airplane to the glideslope abeam
 * it. They show through the cloud.
 */
function Ils({ labels }: { labels: boolean }) {
  const abeam = useRef<THREE.Group>(null),
    sea = useRef<THREE.Group>(null);
  const g = useMemo(() => {
    const far = -ILS.glideslopeRangeNm * NM_M;
    const solid = new THREE.LineBasicMaterial({ color: ILS_COLOUR, fog: false });
    const faint = new THREE.LineBasicMaterial({ color: ILS_COLOUR, fog: false, transparent: true, opacity: 0.35 });
    const dashed = new THREE.LineDashedMaterial({ color: ILS_COLOUR, fog: false, dashSize: 150, gapSize: 90 });
    const line = (points: THREE.Vector3[], material: THREE.Material) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    const glideslope = line([glideslopeAt(0), glideslopeAt(far)], dashed).computeLineDistances();
    const drops: THREE.Vector3[] = [];
    for (let k = 1; k <= ILS.glideslopeRangeNm; k++) drops.push(glideslopeAt(-k * NM_M), onCentreline(-k * NM_M, 3));
    const height = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    const heightLine = new THREE.Line(height, faint);
    // its ends move every frame: never culled by the bounds of where they started
    heightLine.frustumCulled = false;
    return {
      localizer: line([onCentreline(0, 3), onCentreline(far, 3)], solid),
      glideslope,
      drops: new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(drops), faint),
      height: heightLine,
      far,
    };
  }, []);
  useFrame(() => {
    const [e, n, u] = trackAt(replay.t);
    // abeam the airplane, while it is over the drawn part of the extended centreline
    const along = Math.min(Math.max(onRunway31(replay.t)[0], g.far), 0);
    const p = glideslopeAt(along);
    const position = g.height.geometry.attributes.position as THREE.BufferAttribute;
    position.setXYZ(0, e, u, -n);
    position.setXYZ(1, p.x, p.y, p.z);
    position.needsUpdate = true;
    g.height.visible = along < 0;
    abeam.current?.position.copy(p);
    // a mile on towards the runway, so the glideslope's label, straight above, doesn't hide it
    sea.current?.position.copy(onCentreline(Math.min(along + NM_M, 0), 3));
  });
  return (
    <group>
      <primitive object={g.localizer} />
      <primitive object={g.glideslope} />
      <primitive object={g.drops} />
      <primitive object={g.height} />
      {labels && (
        <>
          <group ref={abeam}>
            <Label at={[0, 0, 0]}>Glideslope, {ILS.glideslopeDeg}°</Label>
          </group>
          <group ref={sea}>
            <Label at={[0, 0, 0]}>Localizer</Label>
          </group>
        </>
      )}
    </group>
  );
}

/** The airplane's heading, true: the heading window's, turned by the variation. */
const trueHeading = () => replay.f.hdg + VARIATION_DEG;
const RUNWAY_31 = C5_DIEGO_GARCIA.airport.runway.heading31T;

/** Not following the heading, the airplane turns from runway 31's direction by its own heading's difference. */
function Yaw({ children }: { children: React.ReactNode }) {
  const follow = useC5View((x) => x.follow);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => ref.current?.rotation.set(0, follow ? 0 : (RUNWAY_31 - trueHeading()) * D2R, 0));
  return <group ref={ref}>{children}</group>;
}

/** The flight path: from the airplane's centre, in the vertical plane of its heading. */
function PathArrow() {
  const ref = useRef<THREE.Group>(null);
  const g = useMemo(
    () => ({
      shaft: cyl(0.35, 64, "x", 12).translate(32, 0, 0),
      head: new THREE.ConeGeometry(1.4, 5, 16).rotateZ(-Math.PI / 2).translate(66, 0, 0),
      mat: new THREE.MeshStandardMaterial({ color: "#2f9bd8", emissive: "#2f9bd8", emissiveIntensity: 0.4 }),
    }),
    [],
  );
  useFrame(() => ref.current?.rotation.set(0, 0, replay.f.path * D2R));
  return (
    <group ref={ref}>
      <P name="Flight path" note={NOTE.path} geometry={g.shaft} material={g.mat} />
      <P name="Flight path" note={NOTE.path} geometry={g.head} material={g.mat} />
    </group>
  );
}

// ---------------------------------------------------------------- the view

/** Behind and to the left, a little above; the stage backs off until the airplane fits the view. */
const CAMERA: Vec3 = [-100, 78, -115];

export default function C5Scene() {
  return (
    <ComponentStage
      camera={{ position: CAMERA, fov: 40, near: 1, far: 90_000 }}
      logarithmicDepth
      target={[0, 0, 0]}
      minDistance={25}
      maxDistance={12_000}
      keyLight={{ position: [40, 80, 30], intensity: 1.5 }}
    >
      <Yaw>
        <Airplane />
      </Yaw>
      <World />
    </ComponentStage>
  );
}
