"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { ControlSurface } from "@/components/scene/ControlSurface";
import { Flows } from "@/components/scene/Flows";
import { LightFX, type BeamSpec, type GlowSpec } from "@/components/scene/LightFX";
import { Parts, Shell, Shells } from "@/components/scene/Part";
import { Screens, type ScreenSpec } from "@/components/scene/Screens";
import { Tanks, type TankSpec } from "@/components/scene/Tanks";
import { WindowOutlines } from "@/components/scene/WindowOutlines";
import { D2R, lerp, type Vec3 } from "@/lib/math";
import { useView } from "@/lib/view";
import { ControlRig } from "./ControlRig";
import { drawBreakerCover, drawPanel } from "./displays";
import { FLOWS, cabinAirColor, flowRates, isCabinAir } from "./flows";
import { PANEL_X, TAIL_PIVOT, windowOutlines } from "./geometry";
import { bladeAngle, extLit, live } from "./model";
import { CAT, CYLS, LIGHTS, MG, NG, PROP, TAIL_SHELLS, TAIL_SURFACE_KEYS } from "./parts";
import { FLAP_PUMP, JBAR, deflections, johnsonAngle, tailAngle } from "./rig";
import { fuelBayGeo, mainAngle, noseAngle, noseDoorAngle, noseDoorAxis, noseDoorHinge } from "./placement";
import { useM20C } from "./store";

const P = ({ parent }: { parent?: string }) => <Parts cat={CAT} parent={parent} />;

/** Control-surface deflections (radians about each hinge axis) from the effective controls and the flap angle. */
const ang: Record<string, number> = {};
let angFor: { eff: typeof live.eff | null; flap: number } = { eff: null, flap: NaN };
function surfaceAngle(key: string) {
  if (angFor.eff !== live.eff || angFor.flap !== live.flapAng) {
    const c = live.eff,
      d = deflections(c.pitch, c.roll, c.yaw),
      fl = live.flapAng * D2R;
    ang.flapR = fl;
    ang.flapL = -fl;
    ang.ailR = -d.ailR * D2R;
    ang.ailL = d.ailL * D2R;
    ang.elev = -d.elev * D2R;
    ang.rudder = d.rud * D2R;
    angFor = { eff: live.eff, flap: live.flapAng };
  }
  return ang[key] ?? 0;
}

/** The empennage pivots as one about the tail-cone attachment points when the trim wheel is turned. */
function Tail() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    ref.current.rotation.z = tailAngle(useM20C.getState().s.ctrl.trim);
  });
  return (
    <group ref={ref} position={TAIL_PIVOT}>
      {TAIL_SHELLS.map((s) => (
        <Shell key={s.id} spec={s} />
      ))}
      {CAT.surfaces
        .filter((s) => TAIL_SURFACE_KEYS.includes(s.key))
        .map((s) => (
          <ControlSurface key={s.key} spec={s} cat={CAT} angle={surfaceAngle} />
        ))}
      <P parent="tail" />
    </group>
  );
}

/** Manual gear: the mains swing inboard about fore-aft trunnions, the nose gear aft; the Johnson bar follows. */
function Gear() {
  const doorAxis = useMemo(noseDoorAxis, []);
  const mL = useRef<THREE.Group>(null!),
    mR = useRef<THREE.Group>(null!),
    nose = useRef<THREE.Group>(null!),
    bar = useRef<THREE.Group>(null!),
    steer = useRef<THREE.Group>(null!),
    doorL = useRef<THREE.Group>(null!),
    doorR = useRef<THREE.Group>(null!);
  useFrame(() => {
    const f = live.gearFrac;
    // mains swing inboard and up about their fore-aft trunnions until the wheel lies in the root well beside the fuselage
    mR.current.rotation.x = mainAngle(f, 1);
    mL.current.rotation.x = mainAngle(f, -1);
    nose.current.rotation.z = noseAngle(f);
    bar.current.rotation.z = johnsonAngle(f);
    doorL.current.quaternion.setFromAxisAngle(doorAxis, noseDoorAngle(f, -1));
    doorR.current.quaternion.setFromAxisAngle(doorAxis, noseDoorAngle(f, 1));
    // nose-wheel steering follows the pedals while the gear is down
    steer.current.rotation.y = lerp(steer.current.rotation.y, (1 - f) * -live.eff.yaw * 20 * D2R, 0.15);
  });
  return (
    <>
      <group ref={mR} position={MG.trunnion}>
        <P parent="mainR" />
      </group>
      <group ref={mL} position={[MG.trunnion[0], MG.trunnion[1], -MG.trunnion[2]]}>
        <P parent="mainL" />
      </group>
      <group ref={nose} position={NG.top}>
        <group ref={steer}>
          <P parent="nose" />
        </group>
      </group>
      <group ref={bar} position={JBAR.pivot}>
        <P parent="jbar" />
      </group>
      <group ref={doorL} position={noseDoorHinge(-1)}>
        <P parent="noseDoorL" />
      </group>
      <group ref={doorR} position={noseDoorHinge(1)}>
        <P parent="noseDoorR" />
      </group>
    </>
  );
}

/** Flap pump handle: a stroke swings it forward and back. */
function FlapPump() {
  const ref = useRef<THREE.Group>(null!);
  // the handle lies aft at rest; a stroke lifts its aft end and pushes it back down
  useFrame(() => {
    ref.current.rotation.z = -Math.sin(live.pumpAnim * Math.PI) * 0.6;
  });
  return (
    <group ref={ref} position={FLAP_PUMP.pivot}>
      <P parent="pump" />
    </group>
  );
}

function Propeller() {
  const prop = useRef<THREE.Group>(null!);
  const blades = useRef<THREE.Group[]>([]);
  const reduce = useMemo(
    () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame((_, dt) => {
    prop.current.rotation.x -= (live.rpm / 60) * Math.PI * 2 * dt * (reduce ? 0.02 : 0.12);
    const ba = bladeAngle(useM20C.getState().s, live.rpm) * D2R;
    blades.current.forEach((b) => b && (b.rotation.y = ba));
  });
  return (
    <group ref={prop} position={PROP}>
      {[0, 1].map((i) => (
        <group key={i} rotation-x={i * Math.PI}>
          <group
            ref={(g) => {
              if (g) blades.current[i] = g;
            }}
          >
            <P parent={"blade:" + i} />
          </group>
        </group>
      ))}
    </group>
  );
}

const Cylinders = () => (
  <>
    {CYLS.map((c) => (
      <group key={c.n} position={[c.x, -0.05, c.s * 0.18]}>
        <P parent={"cyl:" + c.n} />
      </group>
    ))}
  </>
);

/* ---------- integral wing tanks: 26 gal each in the forward inboard bays (OM p. 3) ---------- */
const TANKS: TankSpec[] = (
  [
    ["L", -1],
    ["R", 1],
  ] as const
).map(([k, s]) => ({
  key: k,
  geo: () => fuelBayGeo(s),
  level: () => {
    const f = useM20C.getState().s.fuel;
    return (k === "L" ? f.qL : f.qR) / 26;
  },
  name: (s > 0 ? "Right" : "Left") + " fuel tank (integral)",
  note: "Integral sealed bay ahead of the main spar: 26 gal, all usable per the performance charts (OM p. 3, 30). The displayed fluid envelope is calibrated to that usable volume; detailed bay shape and internal structure are approximate. Sealant ages — weeping tanks are the classic Mooney reseal job.",
}));

/* ---------- the instrument panel, drawn live on a canvas ---------- */
const SCREENS: ScreenSpec[] = [
  {
    key: "panel",
    px: [1024, 400],
    size: [0.92, 0.36],
    pos: [PANEL_X - 0.025, -0.03, 0],
    sys: ["cabin", "vacuum", "pitot", "engine", "electrical", "gear"],
    name: "Instrument panel",
    pinAt: [0, 0.17, 0],
    pin: () => useView.getState().sys === "cabin",
    note: "Live panel: flight instruments on the shock-mounted left panel, engine cluster, tach and manifold pressure, gear and vacuum lights, switch-breakers and the centre radios. Layout is approximate — the 1968 book's panel photo is not available.",
    draw: (ctx, W, H) => {
      const { s, E } = useM20C.getState();
      drawPanel(ctx, W, H, s, E);
    },
  },
  {
    key: "cbc",
    px: [160, 120],
    size: [0.12, 0.09],
    pos: [PANEL_X - 0.04, -0.15, 0.45],
    sys: ["electrical"],
    name: "Push-to-reset breaker cover",
    pin: false,
    note: "The special breaker-switch cover on the lower right of the co-pilot's panel (OM p. 4); a tripped or pulled breaker shows its button out.",
    draw: (ctx, W, H) => drawBreakerCover(ctx, W, H, useM20C.getState().s),
  },
];

/* ---------- exterior + interior light glows ---------- */
const extOn = (k: "nav" | "beacon" | "landing") => () => {
  const sys = useView.getState().sys,
    { s, E } = useM20C.getState();
  return (sys === "overview" || sys === "lighting") && extLit(s, E)[k];
};
const beaconOn = extOn("beacon");
const beacon = (t: number) => beaconOn() && t % 1.0 < 0.5; // rotating beacon: a sweep roughly once a second (rate not in the manual)
const aim = (p: Vec3, dx: number, dy: number, dz = 0): Vec3 => [p[0] + dx, p[1] + dy, p[2] + dz];
const inside = (k: "spot" | "instr" | "dome") => () => {
  const sys = useView.getState().sys,
    { s, E } = useM20C.getState();
  if (!(sys === "lighting" || sys === "cabin" || sys === "electrical")) return false;
  return k === "spot"
    ? E.bus > 0 && s.lights.spot > 0
    : k === "dome"
      ? E.bus > 0 && s.lights.cabin
      : E.instLts && s.lights.instr > 0;
};
const GLOWS: GlowSpec[] = [
  { key: "navL", pos: LIGHTS.tipL, color: "#FF2A2A", size: 0.3, on: extOn("nav") },
  { key: "navR", pos: LIGHTS.tipR, color: "#22FF66", size: 0.3, on: extOn("nav") },
  { key: "navT", pos: LIGHTS.tail, color: "#FFFFFF", size: 0.22, on: extOn("nav") },
  { key: "beacon", pos: LIGHTS.beacon, color: "#FF3A2A", size: 0.42, on: beacon },
  { key: "land", pos: LIGHTS.landing, color: "#FFF6DD", size: 0.45, on: extOn("landing") },
  { key: "spotL", pos: LIGHTS.spotL, color: "#FFE7B0", size: 0.35, on: inside("spot") },
  { key: "spotR", pos: LIGHTS.spotR, color: "#FFE7B0", size: 0.35, on: inside("spot") },
  { key: "dome", pos: LIGHTS.dome, color: "#FFE7B0", size: 0.4, on: inside("dome") },
  { key: "instr", pos: LIGHTS.instr, color: "#FFD8A0", size: 0.3, on: inside("instr") },
];
const BEAMS: BeamSpec[] = [
  { key: "land", from: LIGHTS.landing, to: aim(LIGHTS.landing, 3.2, -0.5), r: 0.5, opacity: 0.1, on: extOn("landing") },
];

const rates = () => {
  const { s, E } = useM20C.getState();
  return flowRates(s, E);
};
const flowColor = (k: string, out: THREE.Color) => {
  if (!isCabinAir(k)) return false;
  cabinAirColor(useM20C.getState().s, out);
  return true;
};

/** The M20C scene: airframe shells, wing control surfaces, the pivoting tail, gear, propeller, tanks, panel and lights. */
export function Model() {
  return (
    <>
      <Shells cat={CAT} />
      {CAT.surfaces
        .filter((s) => !TAIL_SURFACE_KEYS.includes(s.key))
        .map((s) => (
          <ControlSurface key={s.key} spec={s} cat={CAT} angle={surfaceAngle} />
        ))}
      <P />
      <Tail />
      <Gear />
      <FlapPump />
      <Propeller />
      <Cylinders />
      <ControlRig />
      <Tanks tanks={TANKS} />
      <Flows flows={FLOWS} rates={rates} color={flowColor} />
      <Screens screens={SCREENS} />
      <LightFX glows={GLOWS} beams={BEAMS} />
      <WindowOutlines loops={windowOutlines} />
    </>
  );
}
