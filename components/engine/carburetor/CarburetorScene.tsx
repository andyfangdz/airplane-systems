"use client";
/**
 * The MA-4-5 float carburetor in cutaway, drawn large: the air box with its heat valve, the lower casting with the
 * float chamber, venturis, discharge nozzle, mixture metering valve and accelerating pump, the throttle body with the
 * throttle valve, idle passages, float valve and fuel inlet, and the flange to the engine's intake riser above (the
 * carburetor is an updraft unit under the sump). Air and fuel move through it from the running engine (`live`).
 * Part names follow the overhaul instructions' figures; shapes, sizes and spacing are schematic.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { HoverTip, P, useHover } from "../scene/parts";
import { merge, tube, zrod } from "../scene/kit";
import { MA45 } from "@/engines/components/carburetor/carburetor";
import { carbSim, live, useCarbView } from "./live";

const D2R = Math.PI / 180;
const OI = "MA-4-5 OI";

/** Layout, metres: the bore is vertical along y at x = z = 0, the float chamber on +x. Schematic. */
const L = {
  R: 0.022, // bore radius
  wall: 0.006,
  boxBottom: -0.15,
  boxTop: -0.09,
  bodyBottom: -0.09,
  bodyTop: 0,
  throttleTop: 0.05,
  flangeTop: 0.058,
  riserTop: 0.11,
  bowl: { x0: 0.034, x1: 0.108, z: 0.042 },
  venturi: { y0: -0.085, throat: -0.05, y1: -0.012, r: 0.62 },
  primary: { y0: -0.06, y1: -0.04, r: 0.008 },
  nozzleY: -0.05,
  level: -0.054, // set fuel level, just below the nozzle holes
  jet: { x: 0.064, y: -0.082 },
  butterflyY: 0.026,
  pivot: { x: 0.04, y: -0.008 },
  needleX: 0.05,
  pumpX: 0.08,
  pumpY0: -0.084,
  pumpY1: -0.044,
};

function useMats() {
  const mats = useMemo(() => {
    const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra });
    return {
      casting: std("#a7b0b6", { transparent: true, side: THREE.DoubleSide }),
      throttleBody: std("#b7bfc4", { transparent: true, side: THREE.DoubleSide }),
      box: std("#7f8b93", { transparent: true, side: THREE.DoubleSide }),
      riser: std("#149c94", { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
      venturi: std("#c3c9cd", { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide, transparent: true }),
      brass: std("#c99a45", { metalness: 0.8, roughness: 0.3 }),
      steel: std("#a9b2ba", { metalness: 0.85, roughness: 0.3 }),
      darkSteel: std("#5d6870", { metalness: 0.8, roughness: 0.35 }),
      float: std("#d9b45a", { metalness: 0.7, roughness: 0.35 }),
      leather: std("#8a5a32", { roughness: 0.8, metalness: 0 }),
      filter: std("#2c62a6", { metalness: 0.3 }),
      fuel: std("#2f7fe6", { transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0, depthWrite: false }),
      passage: std("#2f7fe6", { emissive: "#2f7fe6", emissiveIntensity: 0, transparent: true }),
      ice: std("#d4efff", {
        transparent: true,
        opacity: 0.9,
        roughness: 0.15,
        metalness: 0,
        emissive: "#9fd8ff",
        emissiveIntensity: 0.35,
      }),
      flap: std("#b5503a", { metalness: 0.4, side: THREE.DoubleSide }),
    };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}
type Mats = ReturnType<typeof useMats>;

/** A lathe-turned shell around the y axis from (radius, y) points. */
const lathe = (pts: [number, number][], segs = 40) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );

/** A box from corner to corner. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** A cylinder along y from y0 to y1 at (x, z). */
const ycyl = (r: number, y0: number, y1: number, x = 0, z = 0, segs = 20) =>
  new THREE.CylinderGeometry(r, r, y1 - y0, segs).translate(x, (y0 + y1) / 2, z);

/** The main venturi's inner radius at a height (the bore radius outside it). */
function boreRadius(y: number) {
  const { R } = L,
    v = L.venturi;
  if (y < v.y0 || y > v.y1) return R;
  const t = y < v.throat ? (y - v.y0) / (v.throat - v.y0) : (v.y1 - y) / (v.y1 - v.throat);
  return R * (1 - (1 - v.r) * Math.sin((t * Math.PI) / 2));
}

/** The castings: air box, lower body with the float chamber, throttle body, flange; the intake riser above. */
function Castings({ mats }: { mats: Mats }) {
  const g = useMemo(() => {
    const { R, wall, bowl } = L;
    const outer = R + wall;
    // lower body: the bore's wall, and the float chamber's walls and floor (open top, closed by the throttle body)
    const body = merge([
      lathe([
        [outer, L.bodyBottom],
        [outer, L.bodyTop],
        [R, L.bodyTop],
        [R, L.bodyBottom],
        [outer, L.bodyBottom],
      ]),
      box(bowl.x0 - 0.008, bowl.x1, L.bodyBottom, L.bodyBottom + 0.004, -bowl.z, bowl.z),
      box(bowl.x1 - 0.004, bowl.x1, L.bodyBottom, L.bodyTop, -bowl.z, bowl.z),
      box(bowl.x0 - 0.008, bowl.x1, L.bodyBottom, L.bodyTop, bowl.z - 0.004, bowl.z),
      box(bowl.x0 - 0.008, bowl.x1, L.bodyBottom, L.bodyTop, -bowl.z, -bowl.z + 0.004),
    ]);
    const throttle = merge([
      lathe([
        [outer, L.bodyTop],
        [outer, L.throttleTop],
        [R, L.throttleTop],
        [R, L.bodyTop],
        [outer, L.bodyTop],
      ]),
      // the cover over the float chamber, carrying the float bracket and the float valve seat
      box(bowl.x0 - 0.008, bowl.x1, L.bodyTop, L.bodyTop + 0.01, -bowl.z, bowl.z),
    ]);
    const flange = merge([
      box(-0.042, 0.042, L.throttleTop, L.flangeTop, -0.042, -0.026),
      box(-0.042, 0.042, L.throttleTop, L.flangeTop, 0.026, 0.042),
      box(-0.042, -0.026, L.throttleTop, L.flangeTop, -0.026, 0.026),
      box(0.026, 0.042, L.throttleTop, L.flangeTop, -0.026, 0.026),
    ]);
    // the air box: open-topped, ram air in from below through the filter, heated air in from the −x side
    const w = 0.05;
    const airbox = merge([
      box(-w, w, L.boxBottom, L.boxBottom + 0.004, -w, w),
      box(w - 0.004, w, L.boxBottom, L.boxTop, -w, w),
      box(-w, w, L.boxBottom, L.boxTop, w - 0.004, w),
      box(-w, w, L.boxBottom, L.boxTop, -w, -w + 0.004),
      box(-w, -w + 0.004, L.boxBottom, L.boxTop, -w, w),
    ]);
    const riser = lathe([
      [outer, L.flangeTop],
      [outer + 0.002, L.riserTop],
    ]);
    return { body, throttle, flange, airbox, riser };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <>
      <P
        name="Carburetor body and bowl"
        note={`The lower casting: the float chamber, the main venturi and nozzle, the mixture metering valve and the accelerating pump cylinder (${OI} Figure 2-20). The float chamber is vented, so the pressure on the fuel stays near the air's while the venturi lowers it at the nozzle (FAA-H-8083-32B p. 2-10).`}
        geometry={g.body}
        material={mats.casting}
      />
      <P
        name="Throttle body"
        note={`The upper casting: the throttle valve and its shaft, the idle passages and adjusting needle, the float bracket and float valve seat, the fuel inlet and the bowl vent (${OI} Figure 2-19). It bolts to the body and bowl with six bolts (${OI} ¶2-19).`}
        geometry={g.throttle}
        material={mats.throttleBody}
      />
      <P
        name="Mounting flange"
        note="Bolts the carburetor to its pad under the oil sump, which carries the intake riser to the cylinders (OM p. 1-2): air flows up through the carburetor."
        geometry={g.flange}
        material={mats.throttleBody}
      />
      <P
        name="Air box"
        note="Under the carburetor: filtered ram air comes in from below, heated air from a jacket around the exhaust from the side (OM p. 3-9). The heat valve picks one or blends them."
        geometry={g.airbox}
        material={mats.box}
      />
      <P
        name="Intake riser (in the sump)"
        note="Carries the mixture from the carburetor to the intake pipes (OM p. 1-2). Drawn see-through."
        geometry={g.riser}
        material={mats.riser}
      />
    </>
  );
}

/** Ram-air filter below the air box, the heat duct on its side and the heat valve between them. */
function AirBox({ mats }: { mats: Mats }) {
  const flap = useRef<THREE.Group>(null);
  const g = useMemo(
    () => ({
      filter: ycyl(0.036, L.boxBottom - 0.03, L.boxBottom, 0, 0, 28),
      duct: tube(
        [
          [-0.05, -0.12, 0],
          [-0.08, -0.12, 0],
          [-0.1, -0.12, 0.02],
        ],
        0.016,
      ),
      flap: box(0, 0.003, 0, 0.056, -0.046, 0.046),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    // cold: the valve lies over the heat duct's opening; full hot: it swings down over the ram-air opening
    if (flap.current) flap.current.rotation.z = -live.heat * 90 * D2R;
  });
  return (
    <>
      <P
        name="Induction air filter"
        note="Filters the ram air. Carburetor heat air bypasses it and is unfiltered on some installations (OM p. 3-9)."
        geometry={g.filter}
        material={mats.filter}
      />
      <P
        name="Heat air duct"
        note="Air warmed in a jacket around the exhaust (OM p. 3-9). Heat melts ice and keeps it from forming, but the warmer, thinner air costs power."
        geometry={g.duct}
        material={mats.darkSteel}
      />
      <group ref={flap} position={[-0.046, L.boxBottom + 0.004, 0]}>
        <P
          name="Carburetor heat valve"
          note="Follows the carburetor heat control: cold takes filtered ram air, hot takes air from the exhaust jacket (OM pp. 3-8–3-9)."
          geometry={g.flap}
          material={mats.flap}
        />
      </group>
    </>
  );
}

/** Main and primary venturis, the discharge nozzle, the main jet and the mixture metering valve. */
function MainMetering({ mats }: { mats: Mats }) {
  const valve = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const g = useMemo(() => {
    const v = L.venturi;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const y = v.y0 + ((v.y1 - v.y0) * i) / 24;
      pts.push([boreRadius(y), y]);
    }
    pts.push([L.R, v.y1], [L.R, v.y0], [boreRadius(v.y0), v.y0]);
    const p = L.primary;
    const primary = lathe([
      [p.r + 0.0015, p.y0],
      [p.r * 0.75, (p.y0 + p.y1) / 2],
      [p.r + 0.0015, p.y1],
      [p.r + 0.0025, p.y1],
      [p.r + 0.0025, p.y0],
      [p.r + 0.0015, p.y0],
    ]);
    const arm = box(p.r + 0.002, boreRadius(L.nozzleY), L.nozzleY - 0.002, L.nozzleY + 0.002, -0.0015, 0.0015);
    // the nozzle: from the main jet across under the bore, then up into the primary venturi's throat
    const nozzle = tube(
      [
        [L.jet.x - 0.006, L.jet.y, 0],
        [0.02, L.jet.y, 0],
        [0.004, L.jet.y + 0.004, 0],
        [0, L.jet.y + 0.012, 0],
        [0, L.nozzleY, 0],
      ],
      0.0028,
      40,
      12,
    );
    return {
      venturi: lathe(pts),
      primary: merge([primary, arm.rotateY(Math.PI)]),
      nozzle,
      jet: ycyl(0.004, L.jet.y - 0.004, L.jet.y + 0.004, L.jet.x, 0),
      sleeve: zrod(0.0055, -0.012, L.bowl.z, 20),
      valve: merge([zrod(0.0038, -0.011, L.bowl.z + 0.004, 16), box(-0.0012, 0.0012, 0, 0.004, -0.008, 0.008)]),
      lever: box(-0.003, 0.003, -0.002, 0.024, 0, 0.003),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    // the metering valve turns in its sleeve: full rich lines the slots up, idle cut-off closes them
    const a = (live.mixture - 1) * 80 * D2R;
    if (valve.current) valve.current.rotation.z = a;
    if (lever.current) lever.current.rotation.z = a;
  });
  return (
    <>
      <P
        name="Main venturi"
        note="Speeds the air up so its pressure drops at the nozzle. The venturi proportions the mixture, lowers the pressure at the discharge nozzle and limits the air flow at full throttle (FAA-H-8083-32B p. 2-10)."
        geometry={g.venturi}
        material={mats.venturi}
      />
      <P
        name="Primary venturi"
        note={`A small venturi in the main venturi's throat, around the nozzle's tip, held by its supporting arms (${OI} ¶2-27 b): it deepens the suction at the nozzle.`}
        geometry={g.primary}
        material={mats.venturi}
      />
      <P
        name="Discharge nozzle"
        note={`Its open end is in the venturi's throat. The vented float chamber's pressure, higher than the throat's, pushes fuel out in a fine spray (FAA-H-8083-32B p. 2-11); the fuel stands ${MA45.fuelBelowNozzle.value} (p. 2-10), and about ${MA45.liftToNozzle.value} of venturi suction lifts it to the discharge level (p. 2-11). Below that the main system doesn't flow and the idle system carries the engine.`}
        geometry={g.nozzle}
        material={mats.brass}
      />
      <P
        name="Main metering jet"
        note="The orifice between the float chamber and the nozzle that limits the fuel flow with the throttle wide open (FAA-H-8083-32B p. 2-11)."
        geometry={g.jet}
        material={mats.brass}
      />
      <group position={[L.jet.x, L.jet.y + 0.006, 0]}>
        <P
          name="Mixture metering sleeve"
          note="Stationary sleeve with a slot; fuel for the main and idle systems enters through it (FAA-H-8083-32B p. 2-14)."
          geometry={g.sleeve}
          material={mats.darkSteel}
        />
        <group ref={valve}>
          <P
            name="Mixture metering valve"
            note="A hollow valve that turns in the sleeve: the overlap of its slot with the sleeve's meters the fuel, smaller for a leaner mixture (FAA-H-8083-32B p. 2-14). Idle cut-off shuts the fuel off (OM p. 1-2)."
            geometry={g.valve}
            material={mats.steel}
          />
        </group>
        <group ref={lever} position={[0, 0, L.bowl.z + 0.004]}>
          <P
            name="Mixture control lever"
            note="Turned by the cockpit mixture control: full rich forward, idle cut-off fully back."
            geometry={g.lever}
            material={mats.darkSteel}
          />
        </group>
      </group>
    </>
  );
}

/** The throttle valve on its shaft, the throttle lever, and the idle tube, discharge ports and adjusting needle. */
function ThrottleAndIdle({ mats }: { mats: Mats }) {
  const blade = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const g = useMemo(() => {
    const x = L.R + 0.0035;
    return {
      blade: new THREE.CylinderGeometry(L.R - 0.0004, L.R - 0.0004, 0.0016, 40),
      shaft: zrod(0.0028, -L.R - 0.02, L.R + 0.012, 14),
      lever: box(-0.003, 0.003, 0, 0.034, -0.0015, 0.0015),
      idleTube: tube(
        [
          [L.jet.x - 0.012, L.jet.y + 0.004, 0.012],
          [x + 0.004, L.jet.y + 0.01, 0.012],
          [x, -0.02, 0.012],
          [x, L.butterflyY + 0.006, 0.012],
          [L.R - 0.001, L.butterflyY + 0.006, 0.012],
        ],
        0.0018,
        40,
        8,
      ),
      ports: merge(
        [0.003, 0.009].map((dy) => zrod(0.0013, 0.008, 0.016, 8).translate(L.R - 0.001, L.butterflyY + dy - 0.005, 0)),
      ),
      needle: merge([zrod(0.0016, 0.012, 0.04, 10), zrod(0.004, 0.036, 0.042, 12)]).translate(
        x,
        L.butterflyY + 0.014,
        0,
      ),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    // closed, the blade lies across the bore (drawn cracked a few degrees, as the idle stop leaves it); open, edge-on
    if (blade.current) blade.current.rotation.z = Math.max(live.throttleDeg, 6) * D2R;
    if (lever.current) lever.current.rotation.z = (live.throttleDeg - 45) * D2R;
  });
  return (
    <>
      <group ref={blade} position={[0, L.butterflyY, 0]}>
        <P
          name="Throttle valve"
          note="A disc on a shaft across the bore: it sets the air flow, and so the power (FAA-H-8083-32B p. 2-11). Air rushing past a partly closed valve cools on its engine side, where throttle ice collects (p. 2-9)."
          geometry={g.blade}
          material={mats.steel}
        />
      </group>
      <P
        name="Throttle shaft"
        note={`Turns the throttle valve; its lever also works the accelerating pump (${OI} ¶2-19 d).`}
        geometry={g.shaft}
        material={mats.darkSteel}
        position={[0, L.butterflyY, 0]}
      />
      <group ref={lever} position={[0, L.butterflyY, -L.R - 0.018]}>
        <P
          name="Throttle lever"
          note={`Linked to the cockpit throttle. Its stop bolt is set so the throttle valve is cracked slightly for the engine to idle (${OI} ¶2-27 n).`}
          geometry={g.lever}
          material={mats.darkSteel}
        />
      </group>
      <P
        name="Idle tube"
        note="Fuel for the idle system, from the float chamber up to the throttle valve's edge. With the throttle closed the venturi can't draw from the main nozzle; the low pressure on the engine side of the throttle draws fuel here instead (FAA-H-8083-32B p. 2-12)."
        geometry={g.idleTube}
        material={mats.brass}
      />
      <P
        name="Idle discharge ports"
        note="Openings in the bore at the throttle valve's edge (the idling jet). Once the throttle is open far enough for the main nozzle to flow, fuel stops coming out here (FAA-H-8083-32B p. 2-12)."
        geometry={g.ports}
        material={mats.darkSteel}
      />
      <P
        name="Idle adjusting needle"
        note={`Sets the idle mixture, adjusted on a warm engine (${OI} ¶3-1). Check: leaning slowly to idle cut-off should give a momentary rise of about 50 rpm; more is too rich (OM pp. 5-4–5-5).`}
        geometry={g.needle}
        material={mats.steel}
      />
    </>
  );
}

/** The float chamber: fuel, the float and lever, the float valve and seat, the fuel inlet and strainer, the vent. */
function FloatChamber({ mats }: { mats: Mats }) {
  const fuel = useRef<THREE.Mesh>(null);
  const float = useRef<THREE.Group>(null);
  const needle = useRef<THREE.Group>(null);
  const g = useMemo(() => {
    const { bowl, pivot, needleX } = L;
    const pontoon = (z: number) =>
      new THREE.CapsuleGeometry(0.0075, 0.03, 6, 14)
        .rotateZ(Math.PI / 2)
        .translate(0.082 - pivot.x, L.level - pivot.y + 0.002, z);
    const arm = (z: number) =>
      tube(
        [
          [0, 0, z],
          [0.008, -0.03, z],
          [0.03, L.level - pivot.y + 0.004, z],
        ],
        0.0012,
        20,
        6,
      );
    return {
      fuel: box(bowl.x0 - 0.004, bowl.x1 - 0.004, 0, 1, -bowl.z + 0.004, bowl.z - 0.004),
      float: merge([pontoon(0.02), pontoon(-0.02), arm(0.02), arm(-0.02), zrod(0.0016, -0.022, 0.022, 10)]),
      tab: box(needleX - pivot.x - 0.004, needleX - pivot.x + 0.004, -0.015, -0.013, -0.004, 0.004),
      needle: merge([
        ycyl(0.0016, -0.019, -0.006, 0, 0, 10),
        new THREE.ConeGeometry(0.0016, 0.004, 10).translate(0, -0.004, 0),
      ]),
      seat: ycyl(0.0035, -0.005, L.bodyTop + 0.004, needleX, 0),
      inlet: merge([
        tube(
          [
            [needleX, L.bodyTop + 0.004, 0],
            [needleX + 0.01, L.bodyTop + 0.007, 0],
            [L.bowl.x1 + 0.02, L.bodyTop + 0.007, 0],
          ],
          0.003,
          20,
          10,
        ),
      ]),
      fitting: new THREE.CylinderGeometry(0.0065, 0.0065, 0.016, 6)
        .rotateZ(Math.PI / 2)
        .translate(L.bowl.x1 + 0.016, L.bodyTop + 0.007, 0),
      strainer: new THREE.CylinderGeometry(0.004, 0.004, 0.014, 12)
        .rotateZ(Math.PI / 2)
        .translate(L.bowl.x1 + 0.002, L.bodyTop + 0.007, 0),
      vent: ycyl(0.006, L.bodyTop + 0.01, L.bodyTop + 0.016, 0.096, -0.026, 16),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    const bottom = L.bodyBottom + 0.004;
    const top = bottom + (L.level - bottom) * live.bowl;
    if (fuel.current) {
      fuel.current.position.y = bottom;
      fuel.current.scale.y = Math.max(top - bottom, 1e-4);
      fuel.current.visible = live.bowl > 0.005;
    }
    // the float rides the fuel; the drawing's float pivots so its pontoons follow the level
    const drop = Math.atan2(L.level - top, 0.042);
    if (float.current) float.current.rotation.z = -drop;
    // the needle rests on the float's tab: off its seat by as much as the inflow needs (lift exaggerated)
    if (needle.current) needle.current.position.y = -0.002 - live.needle * 0.004;
  });
  return (
    <>
      <mesh ref={fuel} geometry={g.fuel} material={mats.fuel} />
      <group ref={float} position={[L.pivot.x, L.pivot.y, 0]}>
        <P
          name="Float and lever assembly"
          note={`Two floats on a lever hinged on the float shaft. As fuel comes in the floats rise and close the float valve at the set level; running, the valve sits partly open, just enough to keep the level constant (FAA-H-8083-32B p. 2-10). Setting: ${MA45.floatSetting.value} at the float toes (${OI} ¶2-27 y), never changed to cure flooding (¶3-2).`}
          geometry={g.float}
          material={mats.float}
        />
        <P name="Float lever tab" note="Bears on the float valve." geometry={g.tab} material={mats.float} />
      </group>
      <group ref={needle} position={[L.needleX, -0.002, 0]}>
        <P
          name="Float valve"
          note={`The needle the float lifts into its seat. A leaking valve and seat floods the carburetor: fuel runs out of the nozzle with the engine stopped (FAA-H-8083-32B p. 2-10). Test: ${MA45.floatValveTest.value} (${OI} ¶3-2).`}
          geometry={g.needle}
          material={mats.steel}
        />
      </group>
      <P
        name="Float valve seat"
        note={`Screwed into the throttle body and soldered to the float bracket bolts (${OI} ¶2-20 e).`}
        geometry={g.seat}
        material={mats.brass}
      />
      <P
        name="Fuel inlet"
        note="From the engine-driven pump (or the boost pump): the OM wants 0.5 to 8.0 psi at the carburetor inlet, 3.0 desired (OM p. 3-10)."
        geometry={g.inlet}
        material={mats.passage}
      />
      <P
        name="Fuel inlet connection"
        note={`${OI} Figure 2-19, item 27.`}
        geometry={g.fitting}
        material={mats.darkSteel}
      />
      <P
        name="Fuel inlet strainer"
        note={`Screens the fuel coming in (${OI} Figure 2-19, item 31).`}
        geometry={g.strainer}
        material={mats.steel}
      />
      <P
        name="Bowl vent"
        note={`Lets air in and out of the float chamber as the level rises and falls (FAA-H-8083-32B p. 2-10), through a strainer screen (${OI} ¶2-27 r).`}
        geometry={g.vent}
        material={mats.darkSteel}
      />
    </>
  );
}

/** The accelerating pump: cylinder, plunger with its leather, linkage to the throttle, discharge passage. */
function AcceleratingPump({ mats }: { mats: Mats }) {
  const plunger = useRef<THREE.Group>(null);
  const g = useMemo(() => {
    const x = L.pumpX;
    return {
      cylinder: lathe(
        [
          [0.0065, L.pumpY0],
          [0.0065, L.pumpY1],
          [0.0058, L.pumpY1],
          [0.0058, L.pumpY0 + 0.002],
          [0, L.pumpY0 + 0.002],
        ],
        24,
      ).translate(x, 0, 0),
      plunger: merge([
        ycyl(0.0055, 0, 0.004, 0, 0, 18),
        ycyl(0.0012, 0.004, L.bodyTop + 0.01 - L.pumpY1 + 0.03, 0, 0, 8),
      ]),
      leather: ycyl(0.0057, -0.0015, 0, 0, 0, 18),
      discharge: tube(
        [
          [x, L.pumpY0 + 0.001, 0.008],
          [x - 0.02, L.pumpY0 + 0.003, 0.016],
          [L.R + 0.004, -0.03, 0.016],
          [L.R + 0.002, -0.012, 0.012],
          [L.R - 0.006, -0.008, 0.006],
        ],
        0.0015,
        40,
        8,
      ),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    if (plunger.current) plunger.current.position.y = L.pumpY1 - 0.006 - live.plunger * 0.026;
  });
  return (
    <>
      <P
        name="Accelerating pump cylinder"
        note={`In the float chamber; it fills through an inlet check valve as the throttle closes and discharges past a discharge check valve (${OI} Figure 2-20).`}
        geometry={g.cylinder}
        material={mats.darkSteel}
      />
      <group ref={plunger} position={[L.pumpX, 0, 0]}>
        <P
          name="Pump plunger"
          note={`Worked by the throttle through the pump lever and a spring on the plunger rod (${OI} ¶2-19 d–f). Opening the throttle quickly sprays fuel into the bore so the mixture doesn't lean out while the main system catches up; pushed slowly, the fuel seeps back past the plunger (FAA-H-8083-32B p. 2-13).`}
          geometry={g.plunger}
          material={mats.steel}
        />
        <P
          name="Pump leather"
          note={`Seals the plunger in its cylinder (${OI} ¶2-19).`}
          geometry={g.leather}
          material={mats.leather}
        />
      </group>
      <P
        name="Pump discharge passage and jet"
        note={`Carries the pump's stream into the bore. Test: ${MA45.pumpTest.value} (${OI} ¶3-3 b); tube position ${MA45.pumpTube.value} (${OI} Figure 3-2).`}
        geometry={g.discharge}
        material={mats.passage}
      />
    </>
  );
}

/** Ice in the venturi and on the throttle valve, growing with the engine model's ice fraction. */
function Ice({ mats }: { mats: Mats }) {
  const ring = useRef<THREE.Mesh>(null);
  const plate = useRef<THREE.Mesh>(null);
  const g = useMemo(
    () => ({
      ring: new THREE.TorusGeometry(boreRadius(L.venturi.throat + 0.004), 0.004, 10, 40).rotateX(Math.PI / 2),
      plate: new THREE.TorusGeometry(L.R - 0.002, 0.003, 8, 40).rotateX(Math.PI / 2),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useFrame(() => {
    const k = live.ice;
    for (const m of [ring.current, plate.current])
      if (m) {
        m.visible = k > 0.01;
        // drawn after the see-through venturi, so it shows inside it
        m.renderOrder = 3;
      }
    if (ring.current) ring.current.scale.set(1 - 0.35 * k, 0.6 + 3 * k, 1 - 0.35 * k);
    if (plate.current) plate.current.scale.set(1 - 0.5 * k, 0.4 + 2 * k, 1 - 0.5 * k);
  });
  const note =
    "Fuel evaporation and the pressure drop cool the mixture as much as 70 °F below the incoming air (OM p. 3-8); with moist air, ice forms in the venturi and on the throttle valve (FAA-H-8083-32B p. 2-8). It narrows the bore: with a constant-speed propeller manifold pressure falls (OM p. 3-8). How fast it builds is illustrative.";
  return (
    <>
      <P
        name="Carburetor ice"
        note={note}
        geometry={g.ring}
        material={mats.ice}
        position={[0, L.venturi.throat + 0.008, 0]}
        meshRef={ring}
      />
      <P
        name="Throttle ice"
        note={note}
        geometry={g.plate}
        material={mats.ice}
        position={[0, L.butterflyY - 0.004, 0]}
        meshRef={plate}
      />
    </>
  );
}

/** Droplet pools: where each kind of fuel comes from, how many droplets, and the flow (lb/h) that shows them all. */
const POOLS = [
  { id: "main", n: 110, full: 80 },
  { id: "idle", n: 36, full: 12 },
  { id: "pump", n: 36, full: 1 },
] as const;

/** Moving air and fuel: air up the bore, spray from the nozzle, the idle ports and the pump jet. */
function Flow() {
  const on = useCarbView((x) => x.flow);
  const air = useRef<THREE.InstancedMesh>(null);
  const fuel = useRef<THREE.InstancedMesh>(null);
  const N_AIR = 220,
    N_FUEL = POOLS.reduce((n, p) => n + p.n, 0);
  const seeds = useMemo(() => {
    // a fixed scatter, so screenshots repeat
    let x = 12345;
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    return {
      air: Array.from({ length: N_AIR }, () => [rnd(), rnd(), rnd()] as const),
      fuel: Array.from({ length: N_FUEL }, () => [rnd(), rnd(), rnd()] as const),
    };
  }, [N_FUEL]);
  const t = useRef(0);
  const g = useMemo(
    () => ({
      air: new THREE.SphereGeometry(0.0011, 6, 4),
      fuel: new THREE.SphereGeometry(0.0009, 6, 4),
      airMat: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthWrite: false }),
      fuelMat: new THREE.MeshBasicMaterial({ color: "#2f7fe6" }),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const cold = useMemo(() => new THREE.Color("#3b8cff"), []);
  const warm = useMemo(() => new THREE.Color("#ff8a4c"), []);
  const plain = useMemo(() => new THREE.Color("#b8c7d3"), []);
  useFrame((_, dt) => {
    const a = air.current,
      f = fuel.current;
    if (!a || !f) return;
    const turning = live.rpm > 30;
    // drawing speed: a gentle function of the air flow (lb/h), not to scale
    if (!carbSim().useUi.getState().view.paused && turning)
      t.current += Math.min(dt, 0.1) * (0.04 + 0.5 * Math.min(1, live.air / 1100));
    const y0 = L.boxBottom + 0.01,
      span = L.riserTop - y0;
    for (let i = 0; i < N_AIR; i++) {
      const [u, r, th] = seeds.air[i];
      const y = y0 + ((u + t.current / span) % 1) * span;
      const rad = (y < L.boxTop ? 0.04 : boreRadius(y) - 0.002) * Math.sqrt(r);
      const ang = th * Math.PI * 2;
      const k = turning ? 1 : 0;
      m.makeScale(k, k, k);
      m.setPosition(rad * Math.cos(ang), y, rad * Math.sin(ang));
      a.setMatrixAt(i, m);
      // inlet air: warmer with carburetor heat; past the nozzle: the mixture's temperature (blue below freezing)
      if (y < L.nozzleY) col.copy(plain).lerp(warm, Math.min(1, Math.max(0, (live.inletC - 15) / 50)));
      else col.copy(plain).lerp(cold, Math.min(1, Math.max(0, (5 - live.chamberC) / 15)));
      a.setColorAt(i, col);
    }
    a.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    let i = 0;
    for (const pool of POOLS) {
      const rate = pool.id === "main" ? live.main : pool.id === "idle" ? live.idle : live.squirt;
      const shown = rate > 0.02 ? Math.ceil(pool.n * Math.min(1, 0.15 + rate / pool.full)) : 0;
      for (let j = 0; j < pool.n; j++, i++) {
        const [u, r, th] = seeds.fuel[i];
        const k = (u + t.current * 30) % 1;
        let x: number, y: number, z: number;
        if (pool.id === "main") {
          // spray from the nozzle's tip, widening as it rises with the air
          y = L.nozzleY + k * (L.riserTop - L.nozzleY);
          const rad = Math.min(boreRadius(y) - 0.002, 0.002 + k * 0.03) * Math.sqrt(r);
          x = rad * Math.cos(th * 6.283);
          z = rad * Math.sin(th * 6.283);
        } else if (pool.id === "idle") {
          // from the ports at the throttle valve's edge, swept up past it
          y = L.butterflyY + k * (L.riserTop - L.butterflyY);
          x = L.R - 0.002 - k * 0.012 * r;
          z = (th - 0.5) * 0.012;
        } else {
          // the pump's stream from its jet up into the bore
          const kk = (u + t.current * 60) % 1;
          y = -0.008 + kk * 0.04;
          x = L.R - 0.006 - kk * 0.016;
          z = 0.006 - kk * 0.006 + (r - 0.5) * 0.003;
        }
        const vis = j < shown && turning ? 1 : 0;
        m.makeScale(vis, vis, vis);
        m.setPosition(x, y, z);
        f.setMatrixAt(i, m);
      }
    }
    f.instanceMatrix.needsUpdate = true;
  });
  if (!on) return null;
  return (
    <>
      <instancedMesh ref={air} args={[g.air, g.airMat, N_AIR]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={fuel} args={[g.fuel, g.fuelMat, N_FUEL]} frustumCulled={false} raycast={() => null} />
    </>
  );
}

/** Fuel passages glow while fuel moves through them. */
function useFuelGlow(mats: Mats) {
  useFrame(() => {
    mats.passage.emissiveIntensity = live.inflow ? 0.5 : 0;
    mats.passage.opacity = live.inflow || live.bowl > 0.01 ? 1 : 0.4;
  });
}

function Labels() {
  const show = useCarbView((x) => x.labels);
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  if (!show) return null;
  const items: [string, [number, number, number]][] = [
    ["Throttle valve", [-0.04, L.butterflyY, 0.03]],
    ["Venturi and nozzle", [-0.05, L.venturi.throat, 0.03]],
    ["Float chamber", [0.08, -0.02, 0.05]],
    ["Fuel inlet", [L.bowl.x1 + 0.03, L.bodyTop + 0.016, 0]],
    ["Accelerating pump", [L.pumpX + 0.01, L.pumpY0 - 0.008, 0.05]],
    ["Mixture valve", [L.jet.x, L.jet.y - 0.012, L.bowl.z + 0.02]],
    ["Idle needle", [L.R + 0.01, L.butterflyY + 0.024, 0.05]],
    ["Heat valve", [-0.07, L.boxBottom + 0.02, 0.05]],
    ["To the cylinders", [0, L.riserTop + 0.008, 0]],
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

function Carburetor() {
  const mats = useMats();
  useFuelGlow(mats);
  useFrame(() => {
    const xray = useCarbView.getState().xray;
    for (const k of ["casting", "throttleBody", "box"] as const) {
      mats[k].opacity = xray ? 0.16 : 1;
      mats[k].depthWrite = !xray;
    }
    // the venturi stays visible but lets the nozzle and its spray show through
    mats.venturi.opacity = xray ? 0.45 : 1;
    mats.venturi.depthWrite = !xray;
  });
  return (
    <group>
      <Castings mats={mats} />
      <AirBox mats={mats} />
      <MainMetering mats={mats} />
      <ThrottleAndIdle mats={mats} />
      <FloatChamber mats={mats} />
      <AcceleratingPump mats={mats} />
      <Ice mats={mats} />
      <Flow />
      <Labels />
    </group>
  );
}

export default function CarburetorScene() {
  useEffect(() => () => useHover.setState({ hover: null }), []);
  return (
    <>
      <Canvas
        camera={{ position: [0.3, 0.03, 0.46], fov: 38, near: 0.005, far: 10 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => useHover.setState({ hover: null })}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 2]} intensity={1.6} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <Carburetor />
        <OrbitControls makeDefault target={[0.035, -0.055, 0]} enableDamping minDistance={0.12} maxDistance={1.2} />
      </Canvas>
      <HoverTip />
    </>
  );
}
