"use client";
/**
 * The RSA fuel injection system, cut away and laid out flat the way the FAA handbook draws it (FAA-H-8083-32B,
 * Figures 2-31, 2-34 and 2-36): the throttle body with its venturi, impact tubes and throttle valve; the regulator's
 * four chambers with the air and fuel diaphragms, the stem and ball valve and the constant-head idle spring; the fuel
 * metering section below it (strainer, mixture rotary plate, main jet, idle valve linked to the throttle); the flow
 * divider with its nozzle-pressure gauge; and four air-bleed nozzles in their intake ports. Pressures are coloured as
 * the handbook colours them, fuel and air move at the engine's flows, and every part names itself on hover.
 * Proportions are schematic: the units are drawn several times their size and spread out so each part shows.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import type { EngineSim } from "../store";
import { coil, D2R, makeMats, merge, rod, tube, XRAY_MATS } from "../scene/kit";
import { P, useHover } from "../scene/parts";
import { injectorView, type InjectorView } from "@/engines/components/fuel-injector/model";
import { PRESSURE } from "./colors";

type V3 = [number, number, number];

// ---- layout (metres, schematic)
/** Throttle body: vertical bore, air in at the bottom. */
const TB = { R: 0.07, y0: -0.17, y1: 0.17, throat: -0.045, rThroat: 0.046, valveY: 0.1 };
/** Venturi liner profile [radius, y], inlet to outlet. */
const VENTURI: [number, number][] = [
  [0.069, -0.17],
  [0.066, -0.13],
  [0.052, -0.075],
  [TB.rThroat, TB.throat],
  [0.05, -0.015],
  [0.06, 0.03],
  [0.068, 0.07],
];
/**
 * Regulator: housing along x, its four chambers from the air end (left) to the ball valve (right, by the throttle
 * body). The stem moves left (−x) as the ball valve opens.
 */
const REG = {
  r: 0.085,
  x0: -0.372,
  x1: -0.132,
  airDia: -0.314,
  wall: -0.264,
  fuelDia: -0.214,
  chambers: {
    venturi: [-0.367, -0.317],
    inletAir: [-0.311, -0.267],
    unmetered: [-0.261, -0.217],
    metered: [-0.211, -0.138],
  } as Record<"metered" | "unmetered" | "inletAir" | "venturi", [number, number]>,
  ballX: -0.153,
  seatX: -0.138,
};
/** Fuel metering section: along x under the regulator, fuel in at the left end and metered at the right. */
const MET = {
  y: -0.2,
  r: 0.04,
  x0: -0.4,
  x1: -0.1,
  strainer: [-0.385, -0.33],
  tapX: -0.24,
  mixX: -0.205,
  jetX: -0.172,
  idleX: -0.13,
};
/** Flow divider, nozzle-pressure gauge, nozzles (in a row over their intake ports), pumps. */
const DIV: V3 = [-0.18, 0.44, 0];
const GAUGE: V3 = [-0.4, 0.36, 0.02];
const NOZZLE_Y = 0.27;
const nozzleX = (i: number) => 0.19 + 0.13 * i;
const SUPPLY_Y = -0.27;
const PUMP_X = 0.2,
  BOOST_X = 0.44;
/** Gauge: 0 … 12 psig over 270° (Figure C-2's range). */
const GAUGE_MAX = 12;
const gaugeAngle = (psi: number) => (135 - (Math.min(Math.max(psi, 0), GAUGE_MAX) / GAUGE_MAX) * 270) * D2R;

const OUTLET_ANG = [-60, -20, 20, 60].map((a) => a * D2R);
const outlet = (i: number): V3 => [
  DIV[0] + 0.06 * Math.cos(OUTLET_ANG[i]),
  DIV[1] - 0.005,
  0.06 * Math.sin(OUTLET_ANG[i]),
];

/** Fuel paths, for the lines and the moving fuel. */
const PATHS = {
  supply: [
    [0.62, SUPPLY_Y, 0],
    [BOOST_X, SUPPLY_Y, 0],
    [PUMP_X, SUPPLY_Y, 0],
    [-0.2, SUPPLY_Y, 0],
    [-0.4, SUPPLY_Y, 0],
    [-0.45, SUPPLY_Y + 0.03, 0],
    [-0.45, MET.y - 0.02, 0],
    [MET.x0 - 0.015, MET.y, 0],
  ] as V3[],
  metering: [
    [MET.x0, MET.y, 0],
    [MET.idleX, MET.y, 0],
  ] as V3[],
  meteredUp: [
    [MET.idleX + 0.012, MET.y + 0.03, 0],
    [-0.12, -0.13, 0],
    [-0.155, -0.065, 0],
  ] as V3[],
  unmetered: [
    [MET.tapX, MET.y + 0.035, 0],
    [MET.tapX, -0.13, 0.01],
    [MET.tapX, -0.07, 0.02],
  ] as V3[],
  outlet: [
    [REG.x1 + 0.002, 0, 0],
    [-0.108, 0.03, 0],
    [-0.112, 0.22, 0],
    [-0.15, 0.34, 0],
    [DIV[0], DIV[1] - 0.04, 0],
  ] as V3[],
  impact: [
    [-TB.R + 0.002, -0.115, 0],
    [-0.12, -0.12, -0.05],
    [-0.289, -0.12, -0.05],
    [-0.289, -0.07, -0.03],
  ] as V3[],
  suction: [
    [-TB.rThroat, TB.throat, -0.02],
    [-0.09, TB.throat, -0.1],
    [-0.342, TB.throat, -0.1],
    [-0.342, -0.03, -0.07],
  ] as V3[],
  gauge: [
    [DIV[0] - 0.06, DIV[1] + 0.005, 0],
    [-0.3, DIV[1] - 0.01, -0.02],
    [GAUGE[0] + 0.02, GAUGE[1] + 0.01, GAUGE[2] - 0.035],
  ] as V3[],
  nozzle: (i: number): V3[] => {
    const o = outlet(i);
    const zl = (i - 1.5) * 0.025;
    return [
      o,
      [o[0] + 0.03 * Math.cos(OUTLET_ANG[i]), DIV[1] - 0.005, o[2] + 0.02 * Math.sin(OUTLET_ANG[i])],
      [0.0, 0.47 - i * 0.008, zl],
      [nozzleX(i) - 0.05, 0.42, zl * 0.5],
      [nozzleX(i), 0.38, 0],
      [nozzleX(i), NOZZLE_Y + 0.07, 0],
    ];
  },
};

function makeMaterials() {
  const m = makeMats();
  const glass = (color: string) =>
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.4 });
  return {
    ...m,
    venturi: new THREE.MeshStandardMaterial({
      color: "#9aa4ab",
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      metalness: 0.4,
      roughness: 0.5,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: "#7a3b2e", roughness: 0.85, metalness: 0 }),
    screen: new THREE.MeshStandardMaterial({ color: "#c9ced2", wireframe: true }),
    brass: new THREE.MeshStandardMaterial({ color: "#c99a45", metalness: 0.8, roughness: 0.3 }),
    face: new THREE.MeshStandardMaterial({ color: "#1d2329", roughness: 0.7 }),
    tick: new THREE.MeshBasicMaterial({ color: "#e8edf1" }),
    needle: new THREE.MeshBasicMaterial({ color: "#f5a623" }),
    chamber: {
      metered: glass(PRESSURE.metered),
      unmetered: glass(PRESSURE.unmetered),
      inletAir: glass(PRESSURE.inletAir),
      venturi: glass(PRESSURE.venturi),
    },
    line: {
      inlet: new THREE.MeshStandardMaterial({ color: PRESSURE.unmetered, roughness: 0.5, metalness: 0.2 }),
      metered: new THREE.MeshStandardMaterial({ color: PRESSURE.metered, roughness: 0.5, metalness: 0.2 }),
      nozzle: new THREE.MeshStandardMaterial({ color: PRESSURE.nozzle, roughness: 0.5, metalness: 0.2 }),
      impact: new THREE.MeshStandardMaterial({ color: PRESSURE.inletAir, roughness: 0.5, metalness: 0.2 }),
      suction: new THREE.MeshStandardMaterial({ color: PRESSURE.venturi, roughness: 0.5, metalness: 0.2 }),
    },
    pumpGlow: new THREE.MeshStandardMaterial({
      color: "#7a8a99",
      metalness: 0.5,
      emissive: "#2f7fe6",
      emissiveIntensity: 0,
    }),
    boostGlow: new THREE.MeshStandardMaterial({
      color: "#3d4650",
      metalness: 0.4,
      emissive: "#2f7fe6",
      emissiveIntensity: 0,
    }),
  };
}
type Mats = ReturnType<typeof makeMaterials>;

/** Things that move each frame read this: the injector's state, computed once per frame, and whether the page is paused
 * (the flows' particles stand still then). */
type Frame = InjectorView & { paused: boolean };
type ViewRef = { current: Frame | null };

function useInjectorFrame(sim: EngineSim) {
  const view = useRef<Frame | null>(null);
  // runs before the parts' own frame callbacks (lower priority numbers run first)
  useFrame(() => {
    const ui = sim.useUi.getState();
    view.current = { ...injectorView(sim.spec, sim.s, ui.controls, ui.failures), paused: !!ui.view.paused };
  }, -1);
  return view;
}

// ---------------------------------------------------------------------------------------------------------------- air

function ThrottleBody({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(() => {
    const shell = new THREE.CylinderGeometry(TB.R + 0.008, TB.R + 0.008, TB.y1 - TB.y0, 40, 1, true);
    const flange = (y: number) => new THREE.CylinderGeometry(TB.R + 0.03, TB.R + 0.03, 0.012, 40).translate(0, y, 0);
    const impact = merge(
      [0, 1, 2].map((k) => {
        const a = (k * 2 * Math.PI) / 3 + Math.PI / 2;
        const x = 0.035 * Math.cos(a),
          z = 0.035 * Math.sin(a);
        return merge([
          new THREE.CylinderGeometry(0.0045, 0.0045, 0.035, 10, 1, true).translate(x, -0.125, z),
          tube(
            [
              [x, -0.108, z],
              [x * 1.5, -0.112, z * 1.5],
              [(TB.R * x) / 0.035, -0.115, (TB.R * z) / 0.035],
            ],
            0.003,
            12,
            6,
          ),
        ]);
      }),
    );
    return {
      shell,
      flanges: merge([flange(TB.y0), flange(TB.y1)]),
      venturi: new THREE.LatheGeometry(
        VENTURI.map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
      impact,
      plate: new THREE.CylinderGeometry(TB.R - 0.004, TB.R - 0.004, 0.004, 40),
      shaft: new THREE.CylinderGeometry(0.005, 0.005, 2 * TB.R + 0.05, 10).rotateX(Math.PI / 2),
      lever: new THREE.BoxGeometry(0.06, 0.012, 0.008).translate(-0.03, 0, 0),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const valve = useRef<THREE.Group>(null);
  useFrame(() => {
    if (valve.current && v.current) valve.current.rotation.z = v.current.throttleDeg * D2R;
  });
  return (
    <>
      <P
        name="Throttle body"
        note="The airflow section: all the engine's air comes in here (bottom) and past the throttle valve to the intake (FAA-H-8083-32B p. 2-21)."
        geometry={geo.shell}
        material={mats.case}
      />
      <P name="Throttle body flanges" geometry={geo.flanges} material={mats.acc} />
      <P
        name="Venturi"
        note="Air speeds up through the narrow throat and its pressure drops: venturi suction. The faster the air, the lower the throat pressure (FAA-H-8083-32B p. 2-21)."
        geometry={geo.venturi}
        material={mats.venturi}
      />
      <P
        name="Impact tubes"
        note="Open ends face the incoming air and sense its impact (inlet air) pressure, piped to one side of the air diaphragm (FAA-H-8083-32B Figure 2-32)."
        geometry={geo.impact}
        material={mats.line.impact}
      />
      <group ref={valve} position={[0, TB.valveY, 0]}>
        <P
          name="Throttle valve"
          note="Butterfly valve on the throttle lever. It sets the air flow; the injector then meters fuel to match that air."
          geometry={geo.plate}
          material={mats.steel}
        />
        <P name="Throttle shaft" geometry={geo.shaft} material={mats.darkSteel} />
        <group position={[0, 0, -TB.R - 0.022]}>
          <P
            name="Throttle lever"
            note="Turns the throttle valve; an adjustable link from it also turns the idle valve in the fuel metering section (FAA-H-8083-32B p. 2-23)."
            geometry={geo.lever}
            material={mats.darkSteel}
          />
        </group>
      </group>
      <AirFlow v={v} />
    </>
  );
}

/** Air moving up the bore: faster as the flow rises, and faster still through the throat. */
function AirFlow({ v }: { v: ViewRef }) {
  const N = 90;
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        a: (i * 137.5 * Math.PI) / 180,
        r: Math.sqrt(((i * 0.618) % 1) * 0.85),
        y: (i / N) % 1,
      })),
    [],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.0035, 6, 4), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PRESSURE.air, transparent: true, opacity: 0.75, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    const x = mesh.current,
      s = v.current;
    if (!x || !s) return;
    // drawn speed: the bore's height in ~0.6 s at rated air flow, slower below (not to scale)
    const rate = Math.min(1.6, Math.sqrt(s.air / 900)) * 1.6;
    x.visible = s.air > 2;
    seeds.forEach((p) => {
      const rr = radiusAt(TB.y0 + p.y * (TB.y1 - TB.y0));
      // continuity: speed ∝ 1 / area
      p.y = (p.y + (rate * (s.paused ? 0 : dt) * (TB.R / rr) ** 2) / 4.5) % 1;
      const y = TB.y0 + p.y * (TB.y1 - TB.y0);
      const r = radiusAt(y) * p.r;
      m.makeTranslation(r * Math.cos(p.a), y, r * Math.sin(p.a));
      x.setMatrixAt(seeds.indexOf(p), m);
    });
    x.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />;
}

function radiusAt(y: number) {
  for (let i = 1; i < VENTURI.length; i++)
    if (y <= VENTURI[i][1]) {
      const [r0, y0] = VENTURI[i - 1],
        [r1, y1] = VENTURI[i];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  return VENTURI[VENTURI.length - 1][0];
}

// ------------------------------------------------------------------------------------------------------- regulator

function Regulator({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(() => {
    const len = REG.x1 - REG.x0;
    const chamber = (k: keyof typeof REG.chambers) => {
      const [a, b] = REG.chambers[k];
      return rod(REG.r - 0.006, b - a, 32).translate((a + b) / 2, 0, 0);
    };
    return {
      housing: merge([
        new THREE.CylinderGeometry(REG.r, REG.r, len, 40, 1, true)
          .rotateZ(Math.PI / 2)
          .translate((REG.x0 + REG.x1) / 2, 0, 0),
        rod(REG.r + 0.012, 0.01, 40).translate(REG.fuelDia, 0, 0),
        rod(REG.r + 0.012, 0.01, 40).translate(REG.airDia, 0, 0),
      ]),
      ends: merge([rod(REG.r, 0.006, 40).translate(REG.x0, 0, 0), rod(REG.r, 0.006, 40).translate(REG.x1, 0, 0)]),
      wall: rod(REG.r - 0.002, 0.008, 40).translate(REG.wall, 0, 0),
      metered: chamber("metered"),
      unmetered: chamber("unmetered"),
      inletAir: chamber("inletAir"),
      venturi: chamber("venturi"),
      diaphragm: rod(REG.r - 0.004, 0.004, 40),
      plate: rod(0.035, 0.006, 24),
      stem: rod(0.005, REG.ballX - REG.airDia + 0.01, 10).translate((REG.airDia + REG.ballX) / 2, 0, 0),
      ball: new THREE.SphereGeometry(0.012, 20, 14).translate(REG.ballX, 0, 0),
      seat: new THREE.TorusGeometry(0.011, 0.004, 8, 24).rotateY(Math.PI / 2).translate(REG.seatX, 0, 0),
      spring: coil(0.026, 0.0022, 0, 0.042, 6).rotateY(Math.PI / 2),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const moving = useRef<THREE.Group>(null);
  const spring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = v.current;
    if (!s) return;
    // the stem moves towards the throttle body as the ball valve opens (drawn travel)
    const dx = -0.012 * Math.sqrt(s.ball);
    if (moving.current) moving.current.position.x = dx;
    // the spring sits in the metered chamber, between the fuel diaphragm and the centre of the end cover
    if (spring.current) {
      spring.current.position.x = REG.fuelDia + 0.004 + dx;
      spring.current.scale.x = (REG.x1 - REG.fuelDia - 0.03 - dx) / 0.042;
    }
    // chamber tints: the air chambers part as the air metering force grows, the fuel chambers likewise
    const f = Math.min(1, Math.sqrt(s.airForce));
    const ff = Math.min(1, Math.sqrt(s.fuelForce));
    mats.chamber.inletAir.opacity = 0.18 + 0.2 * f;
    mats.chamber.venturi.opacity = 0.32 - 0.2 * f;
    mats.chamber.unmetered.opacity = s.inletPsi > 0 ? 0.22 + 0.15 * ff : 0.06;
    mats.chamber.metered.opacity = s.metered > 0 ? 0.3 : 0.06;
  });
  return (
    <>
      <P
        name="Regulator housing"
        note="The regulator section: the air diaphragm (right) and fuel diaphragm (left) on one stem, which carries the ball valve (FAA-H-8083-32B pp. 2-21–2-22)."
        geometry={geo.housing}
        material={mats.case}
      />
      <P name="Regulator end covers" geometry={geo.ends} material={mats.case} />
      <P
        name="Centre body"
        note="Separates the air side from the fuel side; the stem passes through it on a seal."
        geometry={geo.wall}
        material={mats.acc}
      />
      <P
        name="Venturi suction chamber"
        note="Piped to the venturi throat: its pressure falls as the air flow rises, so the air diaphragm is pulled towards it (FAA-H-8083-32B Figure 2-31)."
        geometry={geo.venturi}
        material={mats.chamber.venturi}
      />
      <P
        name="Inlet air chamber"
        note="Piped to the impact tubes: inlet air pressure. Inlet minus venturi suction, times the diaphragm area, is the air metering force (FAA-H-8083-32B p. 2-21)."
        geometry={geo.inletAir}
        material={mats.chamber.inletAir}
      />
      <P
        name="Unmetered fuel chamber"
        note="Fuel inlet pressure, from upstream of the mixture valve and metering jet, on one side of the fuel diaphragm (FAA-H-8083-32B p. 2-22)."
        geometry={geo.unmetered}
        material={mats.chamber.unmetered}
      />
      <P
        name="Metered fuel chamber"
        note="Fuel that has passed the mixture valve, main jet and idle valve: metered fuel pressure. Unmetered minus metered is the fuel metering force (FAA-H-8083-32B p. 2-22)."
        geometry={geo.metered}
        material={mats.chamber.metered}
      />
      <P
        name="Ball valve seat"
        note="The metered fuel leaves here for the flow divider, past the ball valve."
        geometry={geo.seat}
        material={mats.brass}
      />
      <group ref={moving}>
        <group position={[REG.airDia, 0, 0]}>
          <P
            name="Air diaphragm"
            note="Inlet air pressure on one side, venturi suction on the other: the air metering force pushes it, and the stem, to open the ball valve (FAA-H-8083-32B p. 2-21)."
            geometry={geo.diaphragm}
            material={mats.rubber}
          />
          <P name="Air diaphragm plate" geometry={geo.plate} material={mats.steel} />
        </group>
        <group position={[REG.fuelDia, 0, 0]}>
          <P
            name="Fuel diaphragm"
            note="Unmetered fuel on one side, metered on the other: the fuel metering force pushes back against the air force. The ball valve opens until the two balance (FAA-H-8083-32B p. 2-22, Figure 2-33)."
            geometry={geo.diaphragm}
            material={mats.rubber}
          />
          <P name="Fuel diaphragm plate" geometry={geo.plate} material={mats.steel} />
        </group>
        <P
          name="Regulator stem"
          note="Joins the two diaphragms and the ball valve."
          geometry={geo.stem}
          material={mats.steel}
        />
        <P
          name="Ball valve"
          note="On the fuel diaphragm's stem: it opens as far as the forces put it, and so lets through the fuel the air flow calls for (FAA-H-8083-32B p. 2-22)."
          geometry={geo.ball}
          material={mats.steel}
        />
      </group>
      <P
        name="Constant-head idle spring"
        note="At low power the venturi's pressure difference is too small to regulate consistently; this spring adds a constant fuel differential so there is enough flow at idle (FAA-H-8083-32B pp. 2-22–2-23)."
        geometry={geo.spring}
        material={mats.spring}
        meshRef={spring}
      />
    </>
  );
}

// --------------------------------------------------------------------------------------------------- fuel metering

function Metering({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(() => {
    const len = MET.x1 - MET.x0;
    return {
      housing: merge([
        new THREE.CylinderGeometry(MET.r, MET.r, len, 32, 1, true)
          .rotateZ(Math.PI / 2)
          .translate((MET.x0 + MET.x1) / 2, MET.y, 0),
        rod(MET.r, 0.006, 32).translate(MET.x1, MET.y, 0),
      ]),
      inlet: rod(0.014, 0.03, 12).translate(MET.x0 - 0.012, MET.y, 0),
      strainer: new THREE.CylinderGeometry(0.024, 0.024, MET.strainer[1] - MET.strainer[0], 16, 4, true)
        .rotateZ(Math.PI / 2)
        .translate((MET.strainer[0] + MET.strainer[1]) / 2, MET.y, 0),
      // a fixed port plate with a quarter opening, and the rotary plate: a quarter sector that covers the opening at
      // idle cut-off and turns off it towards full rich
      port: new THREE.CylinderGeometry(MET.r - 0.006, MET.r - 0.006, 0.005, 32, 1, false, Math.PI / 2, Math.PI * 1.5)
        .rotateZ(Math.PI / 2)
        .translate(MET.mixX + 0.005, MET.y, 0),
      plate: new THREE.CylinderGeometry(MET.r - 0.006, MET.r - 0.006, 0.005, 16, 1, false, 0, Math.PI / 2).rotateZ(
        Math.PI / 2,
      ),
      mixLever: new THREE.BoxGeometry(0.008, 0.07, 0.008).translate(0, -0.035, 0),
      mixShaft: new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8).rotateX(Math.PI / 2).translate(0, 0, 0.035),
      jet: new THREE.TorusGeometry(0.02, 0.007, 10, 28).rotateY(Math.PI / 2).translate(MET.jetX, MET.y, 0),
      idle: new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12).rotateX(Math.PI / 2),
      // the idle valve's lever, up from the plunger's outer end to the throttle link
      idleArm: new THREE.BoxGeometry(0.006, 0.075, 0.006).translate(0, 0.0375, -0.025),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const plate = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const idle = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = v.current;
    if (!s) return;
    // idle cut-off covers the passage; full rich turns the plate a quarter turn to uncover it (drawn)
    const a = s.mixture * 90 * D2R;
    if (plate.current) plate.current.rotation.x = a;
    if (lever.current) lever.current.rotation.z = (-30 + 60 * s.mixture) * D2R;
    if (idle.current) idle.current.position.z = -0.01 - 0.02 * s.idleValve;
  });
  return (
    <>
      <P
        name="Fuel metering section"
        note="Inlet fuel strainer, manual mixture control valve, idle valve and main metering jet (FAA-H-8083-32B p. 2-23, Figure 2-34)."
        geometry={geo.housing}
        material={mats.case}
      />
      <P name="Fuel inlet" note="From the engine-driven fuel pump." geometry={geo.inlet} material={mats.brass} />
      <P
        name="Fuel inlet strainer"
        note="Screens the fuel as it enters. The IOM has it removed, cleaned in solvent and reinstalled when a new engine is prepared for service (IOM pp. 11, 13)."
        geometry={geo.strainer}
        material={mats.screen}
      />
      <P
        name="Mixture port plate"
        note="The fixed plate the rotary plate turns against: the passage through it is open only where the rotary plate does not cover it."
        geometry={geo.port}
        material={mats.steel}
      />
      <group ref={plate} position={[MET.mixX, MET.y, 0]}>
        <P
          name="Mixture rotary plate"
          note="The manual mixture control: full rich against the rich stop, progressively leaner towards idle cut-off, where it shuts the fuel off (FAA-H-8083-32B p. 2-23)."
          geometry={geo.plate}
          material={mats.brass}
        />
      </group>
      <group ref={lever} position={[MET.mixX, MET.y, MET.r + 0.03]}>
        <P
          name="Mixture lever"
          note="Manual mixture control and idle cut-off lever, to the cockpit mixture control."
          geometry={geo.mixLever}
          material={mats.darkSteel}
        />
        <P name="Mixture shaft" geometry={geo.mixShaft} material={mats.darkSteel} />
      </group>
      <P
        name="Main metering jet"
        note="The fixed orifice the metering pressure drop acts across: unmetered minus metered pressure sets the flow through it (FAA-H-8083-32B p. 2-22)."
        geometry={geo.jet}
        material={mats.brass}
      />
      <group ref={idle} position={[MET.idleX, MET.y, 0]}>
        <P
          name="Idle valve"
          note="Linked to the throttle by an external adjustable link, so it opens with the throttle; idle speed and idle mixture are set externally (FAA-H-8083-32B p. 2-23)."
          geometry={geo.idle}
          material={mats.steel}
        />
        <P name="Idle valve lever" geometry={geo.idleArm} material={mats.darkSteel} />
      </group>
      <IdleLink v={v} mats={mats} />
    </>
  );
}

/** The adjustable link from the throttle lever to the idle valve lever: a rod stretched between the two each frame. */
function IdleLink({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.0022, 0.0022, 1, 8), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const rodRef = useRef<THREE.Mesh>(null);
  const [a, b, up, dir] = useMemo(
    () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3()],
    [],
  );
  useFrame(() => {
    const s = v.current,
      r = rodRef.current;
    if (!s || !r) return;
    const t = s.throttleDeg * D2R;
    // throttle lever tip (the lever turns with the valve), idle valve lever tip below
    // both on the back of the injector, out of the way of the cut-away bore
    a.set(-0.055 * Math.cos(t), TB.valveY - 0.055 * Math.sin(t), -TB.R - 0.022);
    b.set(MET.idleX, MET.y + 0.075, -0.035 - 0.02 * s.idleValve);
    dir.subVectors(a, b);
    r.position.addVectors(a, b).multiplyScalar(0.5);
    r.scale.set(1, dir.length(), 1);
    r.quaternion.setFromUnitVectors(up, dir.normalize());
  });
  return (
    <P
      name="Idle valve link"
      note="External adjustable link from the throttle lever to the idle valve (FAA-H-8083-32B p. 2-23)."
      geometry={geo}
      material={mats.darkSteel}
      meshRef={rodRef}
    />
  );
}

// ------------------------------------------------------------------------------------------- divider and nozzles

function Divider({ v, mats, sim }: { v: ViewRef; mats: Mats; sim: EngineSim }) {
  const geo = useMemo(() => {
    const [x, y, z] = DIV;
    return {
      body: merge([
        new THREE.CylinderGeometry(0.06, 0.06, 0.05, 36, 1, true).translate(x, y, z),
        new THREE.CylinderGeometry(0.06, 0.06, 0.006, 36).translate(x, y - 0.025, z),
      ]),
      cap: new THREE.SphereGeometry(0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 0.025, z),
      fittings: merge([
        ...[0, 1, 2, 3].map((i) => {
          const o = outlet(i);
          return new THREE.CylinderGeometry(0.008, 0.008, 0.022, 8)
            .rotateZ(Math.PI / 2)
            .rotateY(-OUTLET_ANG[i])
            .translate(o[0], o[1], o[2]);
        }),
        rod(0.008, 0.022, 8).translate(x - 0.065, y + 0.005, z),
        new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8).translate(x, y - 0.035, z),
      ]),
      diaphragm: new THREE.CylinderGeometry(0.055, 0.055, 0.004, 32),
      spring: coil(0.018, 0.002, 0, 0.04, 5).rotateX(-Math.PI / 2),
      needle: merge([
        new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10).translate(0, -0.02, 0),
        new THREE.ConeGeometry(0.01, 0.014, 12).rotateX(Math.PI).translate(0, -0.05, 0),
      ]),
      seat: new THREE.TorusGeometry(0.009, 0.003, 8, 20).rotateX(Math.PI / 2).translate(x, y - 0.03, z),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const moving = useRef<THREE.Group>(null);
  const spring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = v.current;
    if (!s) return;
    const lift = 0.012 * s.divider;
    if (moving.current) moving.current.position.y = DIV[1] + lift;
    if (spring.current) {
      spring.current.position.set(DIV[0], DIV[1] + 0.004 + lift, DIV[2]);
      spring.current.scale.y = (0.04 - lift) / 0.04;
    }
  });
  return (
    <>
      <P
        name="Flow divider"
        note="Keeps the metered fuel under pressure, divides it among the cylinders at all speeds, and shuts off every nozzle line at idle cut-off. The IO-390's manual calls it the fuel manifold (FAA-H-8083-32B p. 2-23; IOM p. 4)."
        geometry={geo.body}
        material={mats.case}
      />
      <P name="Flow divider cover" geometry={geo.cap} material={mats.case} />
      <P
        name="Flow divider fittings"
        note="Metered fuel in at the bottom; four nozzle lines out around the side; a nipple for the pressure gauge (IOM Figure 7)."
        geometry={geo.fittings}
        material={mats.brass}
      />
      <P name="Flow divider seat" geometry={geo.seat} material={mats.brass} />
      <group ref={moving} position={DIV}>
        <P
          name="Flow divider diaphragm"
          note="At idle the metered fuel's pressure must overcome the spring on this diaphragm to lift the valve; the valve opens only as far as it must to pass the fuel (FAA-H-8083-32B p. 2-23)."
          geometry={geo.diaphragm}
          material={mats.rubber}
        />
        <P
          name="Flow divider valve"
          note="Lifts off its seat to let fuel through its annulus to the nozzle lines. Above idle, the pressure in the nozzle lines opens it fully and the nozzles set the distribution (FAA-H-8083-32B p. 2-23)."
          geometry={geo.needle}
          material={mats.steel}
        />
      </group>
      <P name="Flow divider spring" geometry={geo.spring} material={mats.spring} meshRef={spring} />
      <Gauge v={v} mats={mats} />
      {[0, 1, 2, 3].map((i) => (
        <Nozzle key={i} i={i} n={sim.spec.geometry.cylinders[i].n} v={v} mats={mats} />
      ))}
    </>
  );
}

function Gauge({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(() => {
    const ticks: THREE.BufferGeometry[] = [];
    for (let p = 0; p <= GAUGE_MAX; p++) {
      const a = gaugeAngle(p),
        big = p % 2 === 0;
      ticks.push(
        new THREE.BoxGeometry(big ? 0.012 : 0.007, 0.0025, 0.002)
          .translate(0.052 - (big ? 0.006 : 0.0035), 0, 0)
          .rotateZ(a),
      );
    }
    return {
      body: rod(0.072, 0.03, 40)
        .rotateY(Math.PI / 2)
        .translate(0, 0, -0.016),
      face: new THREE.CircleGeometry(0.064, 40).translate(0, 0, 0.0005),
      ticks: merge(ticks).translate(0, 0, 0.002),
      needle: new THREE.BoxGeometry(0.052, 0.004, 0.002).translate(0.022, 0, 0.004),
      hub: new THREE.CylinderGeometry(0.005, 0.005, 0.006, 12).rotateX(Math.PI / 2).translate(0, 0, 0.004),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const needle = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (needle.current && v.current) needle.current.rotation.z = gaugeAngle(v.current.nozzlePsi);
  });
  const note =
    "Senses the pressure applied to the nozzles, which is in direct proportion to fuel flow, so it can be calibrated as a fuel flow meter (FAA-H-8083-32B p. 2-24). Its scale here is 0–12 psig, Figure C-2's range; the panel converts it on the nominal curve.";
  return (
    <group position={GAUGE}>
      <P name="Nozzle-pressure gauge" note={note} geometry={geo.body} material={mats.black} />
      <P name="Gauge face" note={note} geometry={geo.face} material={mats.face} />
      <P name="Gauge scale" geometry={geo.ticks} material={mats.tick} />
      <P name="Gauge needle" geometry={geo.needle} material={mats.needle} meshRef={needle} />
      <P name="Gauge hub" geometry={geo.hub} material={mats.needle} />
    </group>
  );
}

function Nozzle({ i, n, v, mats }: { i: number; n: number; v: ViewRef; mats: Mats }) {
  const x = nozzleX(i);
  const geo = useMemo(
    () => ({
      body: merge([
        new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6).translate(x, NOZZLE_Y + 0.035, 0),
        new THREE.CylinderGeometry(0.008, 0.006, 0.03, 12).translate(x, NOZZLE_Y - 0.005, 0),
      ]),
      bleed: new THREE.TorusGeometry(0.0105, 0.0025, 6, 16).rotateX(Math.PI / 2).translate(x, NOZZLE_Y + 0.02, 0),
      port: new THREE.CylinderGeometry(0.04, 0.04, 0.13, 28, 1, true)
        .rotateX(Math.PI / 2)
        .translate(x, NOZZLE_Y - 0.06, 0),
    }),
    [x],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      <P
        name={`Cylinder ${n} nozzle`}
        note="Air-bleed nozzle in the cylinder head: a calibrated jet discharges into a chamber at ambient air pressure, where air mixes in to help atomize the fuel before it enters the intake port (FAA-H-8083-32B p. 2-24)."
        geometry={geo.body}
        material={mats.brass}
      />
      <P
        name={`Cylinder ${n} nozzle air bleed`}
        note="The air bleed: openings to ambient air. On turbocharged engines a clogged air bleed makes the engine rough and cut-off poor (Precision Form 15-901C)."
        geometry={geo.bleed}
        material={mats.black}
      />
      <P
        name={`Cylinder ${n} intake port`}
        note="The nozzle sprays continuously into the intake port, towards the intake valve (FAA-H-8083-32B p. 2-24)."
        geometry={geo.port}
        material={mats.head}
      />
      <Spray x={x} i={i} v={v} />
    </>
  );
}

/** Fuel leaving a nozzle: as many drops as its share of the flow, falling into the port. */
function Spray({ x, i, v }: { x: number; i: number; v: ViewRef }) {
  const N = 40;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.0028, 6, 4), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PRESSURE.nozzle, transparent: true, opacity: 0.9 }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const seeds = useMemo(
    () => Array.from({ length: N }, (_, k) => ({ t: k / N, a: k * 2.4, s: 0.4 + ((k * 0.37) % 0.6) })),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    const s = v.current,
      me = mesh.current;
    if (!s || !me) return;
    const flow = s.nozzles[i] ?? 0;
    // visible drops ∝ flow (a quarter of rated flow per nozzle shows all of them)
    const shown = Math.round(Math.min(1, flow / 25) * N);
    seeds.forEach((p, k) => {
      p.t = (p.t + (s.paused ? 0 : dt) * (1.2 + flow / 15)) % 1;
      if (k >= shown) {
        m.makeScale(0, 0, 0);
      } else {
        const d = p.t * 0.07,
          r = p.t * 0.022 * p.s;
        m.makeTranslation(x + r * Math.cos(p.a), NOZZLE_Y - 0.02 - d, r * Math.sin(p.a));
      }
      me.setMatrixAt(k, m);
    });
    me.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />;
}

// --------------------------------------------------------------------------------------------- lines and pumps

function Lines({ v, mats }: { v: ViewRef; mats: Mats }) {
  const geo = useMemo(
    () => ({
      supply: tube(PATHS.supply, 0.008, 60, 10),
      unmetered: tube(PATHS.unmetered, 0.005, 24, 8),
      meteredUp: tube(PATHS.meteredUp, 0.006, 12, 8),
      outlet: tube(PATHS.outlet, 0.007, 60, 10),
      impact: tube(PATHS.impact, 0.005, 24, 8),
      suction: tube(PATHS.suction, 0.005, 24, 8),
      gauge: tube(PATHS.gauge, 0.004, 24, 8),
      nozzles: merge([0, 1, 2, 3].map((i) => tube(PATHS.nozzle(i), 0.0045, 50, 8))),
      pump: merge([
        new THREE.BoxGeometry(0.09, 0.07, 0.08).translate(PUMP_X, SUPPLY_Y, 0),
        rod(0.045, 0.012, 24).translate(PUMP_X + 0.05, SUPPLY_Y, 0),
      ]),
      boost: rod(0.035, 0.1, 24).translate(BOOST_X, SUPPLY_Y, 0),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useFrame(() => {
    const s = v.current;
    if (!s) return;
    mats.pumpGlow.emissiveIntensity = s.inletPsi > 1 ? 0.25 : 0;
  });
  return (
    <>
      <P
        name="Fuel supply line"
        note="Boost pump and engine-driven pump to the injector inlet. The IO-390-C's limits at the injector inlet are 14–45 psi with a parallel boost pump, 14–35 psi with a series one (IOM Table A-2, p. 53)."
        geometry={geo.supply}
        material={mats.line.inlet}
      />
      <P
        name="Unmetered fuel passage"
        note="Fuel inlet pressure, taken after the strainer, to the unmetered side of the fuel diaphragm."
        geometry={geo.unmetered}
        material={mats.line.inlet}
      />
      <P
        name="Metered fuel passage"
        note="From the jets to the metered side of the fuel diaphragm and the ball valve."
        geometry={geo.meteredUp}
        material={mats.line.metered}
      />
      <P
        name="Line to flow divider"
        note="Metered fuel from the injector to the flow divider (the IOM's fuel manifold), over the top of the crankcase on the engine (IOM p. 4)."
        geometry={geo.outlet}
        material={mats.line.metered}
      />
      <P
        name="Impact pressure passage"
        note="Inlet air pressure from the impact tubes to the inlet air chamber."
        geometry={geo.impact}
        material={mats.line.impact}
      />
      <P
        name="Venturi suction passage"
        note="Venturi throat pressure to the venturi suction chamber."
        geometry={geo.suction}
        material={mats.line.suction}
      />
      <P
        name="Gauge line"
        note="Nozzle pressure from the flow divider to the gauge."
        geometry={geo.gauge}
        material={mats.line.nozzle}
      />
      <P
        name="Nozzle lines"
        note="One line from the flow divider to each nozzle (IOM p. 4). They all see one pressure, so each nozzle's flow follows its own open area."
        geometry={geo.nozzles}
        material={mats.line.nozzle}
      />
      <P
        name="Engine-driven fuel pump"
        note="Diaphragm-type pump on the accessory housing, feeding the fuel injector (IOM p. 4)."
        geometry={geo.pump}
        material={mats.pumpGlow}
      />
      <P
        name="Boost pump"
        note="Electric boost pump: pressure for starting, and a backup for the engine-driven pump. Its outlet limits at the injector inlet are in IOM Table A-2 (p. 53)."
        geometry={geo.boost}
        material={mats.alt}
      />
      <Stream points={PATHS.supply} color={PRESSURE.unmetered} count={22} rate={(s) => s.metered} v={v} />
      <Stream points={PATHS.metering} color={PRESSURE.unmetered} count={10} rate={(s) => s.metered} v={v} />
      <Stream points={PATHS.meteredUp} color={PRESSURE.metered} count={4} rate={(s) => s.metered} v={v} />
      <Stream points={PATHS.outlet} color={PRESSURE.metered} count={20} rate={(s) => s.metered} v={v} />
      {[0, 1, 2, 3].map((i) => (
        <Stream
          key={i}
          points={PATHS.nozzle(i)}
          color={PRESSURE.nozzle}
          count={14}
          rate={(s) => s.nozzles[i] * 4}
          v={v}
        />
      ))}
    </>
  );
}

/** Drops moving along a fuel path at a speed set by a flow (lb/h). Drawn speed, not to scale. */
function Stream({
  points,
  color,
  count,
  rate,
  v,
}: {
  points: V3[];
  color: string;
  count: number;
  rate: (s: InjectorView) => number;
  v: ViewRef;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const geo = useMemo(() => new THREE.SphereGeometry(0.0075, 8, 6), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  const phase = useRef(0);
  const [m, p] = useMemo(() => [new THREE.Matrix4(), new THREE.Vector3()], []);
  const len = useMemo(() => curve.getLength(), [curve]);
  useFrame((_, dt) => {
    const s = v.current,
      me = mesh.current;
    if (!s || !me) return;
    const flow = rate(s);
    me.visible = flow > 0.3;
    // ~0.12 m/s at idle flows to ~0.5 m/s at rated (drawn)
    phase.current = (phase.current + ((s.paused ? 0 : dt) * (0.08 + Math.sqrt(flow) * 0.045)) / len) % 1;
    for (let k = 0; k < count; k++) {
      curve.getPointAt((k / count + phase.current) % 1, p);
      m.makeTranslation(p.x, p.y, p.z);
      me.setMatrixAt(k, m);
    }
    me.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}

// ------------------------------------------------------------------------------------------------------ assembly

function Labels({ sim, v }: { sim: EngineSim; v: ViewRef }) {
  const show = sim.useUi((x) => x.view.labels);
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  const gaugeText = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const s = v.current,
      el = gaugeText.current;
    if (s && el) el.textContent = `${s.nozzlePsi.toFixed(1)} psi = ${(s.indicated / AVGAS_LB_GAL).toFixed(1)} gph`;
  });
  if (!show) return null;
  const items: [string, V3][] = [
    ["Air in", [0, TB.y0 - 0.04, 0]],
    ["Throttle body", [0.11, TB.y1 + 0.01, 0]],
    ["Regulator", [-0.25, REG.r + 0.035, 0]],
    ["Fuel metering", [-0.26, MET.y - 0.065, 0]],
    ["Flow divider", [DIV[0] + 0.02, DIV[1] + 0.085, 0]],
    ["Engine-driven pump", [PUMP_X, SUPPLY_Y - 0.07, 0]],
    ["Boost pump", [BOOST_X, SUPPLY_Y - 0.06, 0]],
    ...sim.spec.geometry.cylinders.map((c, i): [string, V3] => [`Cyl ${c.n}`, [nozzleX(i), NOZZLE_Y - 0.13, 0]]),
  ];
  return (
    <>
      {items.map(([t, p]) => (
        <Html key={t} position={p} portal={portal} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="eng-label">{t}</div>
        </Html>
      ))}
      <Html
        position={[GAUGE[0], GAUGE[1] - 0.105, GAUGE[2]]}
        portal={portal}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="eng-label">
          Gauge <span ref={gaugeText} />
        </div>
      </Html>
    </>
  );
}

function InjectorModel({ sim }: { sim: EngineSim }) {
  const mats = useMemo(makeMaterials, []);
  useEffect(
    () => () =>
      Object.values(mats).forEach((m) => {
        if (m instanceof THREE.Material) m.dispose();
        else Object.values(m).forEach((x) => x.dispose());
      }),
    [mats],
  );
  const v = useInjectorFrame(sim);
  useFrame(() => {
    const xray = sim.useUi.getState().view.xray;
    for (const k of XRAY_MATS) {
      mats[k].opacity = xray ? 0.16 : 1;
      mats[k].depthWrite = !xray;
    }
    mats.head.opacity = xray ? 0.16 : 1;
    mats.venturi.opacity = xray ? 0.3 : 0.85;
  });
  return (
    <group position={[-0.04, -0.04, 0]}>
      <ThrottleBody v={v} mats={mats} />
      <Regulator v={v} mats={mats} />
      <Metering v={v} mats={mats} />
      <Divider v={v} mats={mats} sim={sim} />
      <Lines v={v} mats={mats} />
      <Labels sim={sim} v={v} />
    </group>
  );
}

/** The hovered part's name and note, next to the pointer. */
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

export default function InjectorScene({ sim }: { sim: EngineSim }) {
  useEffect(() => () => useHover.setState({ hover: null }), []);
  return (
    <>
      <Canvas
        camera={{ position: [0.2, 0.3, 1.55], fov: 40, near: 0.02, far: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => useHover.setState({ hover: null })}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.5} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <InjectorModel sim={sim} />
        <OrbitControls makeDefault target={[0.04, 0.02, 0]} enableDamping minDistance={0.4} maxDistance={4} />
      </Canvas>
      <HoverTip />
    </>
  );
}
