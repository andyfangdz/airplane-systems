"use client";
/**
 * The turbocharger group, for an engine whose scene layout has a turbo block (`EngineLayout.turbo`): a turbocharger on
 * each side (compressor forward, turbine aft, on one shaft), the exhaust wastegate with its oil-pressure actuator, the
 * wastegate controller, the intercoolers with the overboost valve, and the turbocharger oil lines. Where everything
 * sits, and the notes citing the engine's documents, come from the layout (`engines/<id>/layout-turbo.ts`); shapes are
 * schematic. The parts move with the model's turbo state (engines/model/engine.ts, the `EngineState` turbo members):
 * the wastegate plate with `gate`, the wheels with `turboRpm`, the overboost poppet with `reliefOpen`, the turbine
 * housings with `tit` and the intercoolers with `compressorOutC` / `matC`.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EngineSim } from "../store";
import { egtColor, gear, merge, rod, slab, tube, zrod, type Dims, type Mats } from "./kit";
import { layoutFor, type V3 } from "./layout";
import { P } from "./parts";

/** One turbocharger, its shaft fore and aft (along x). Scene metres. */
export interface TurboSideDef {
  side: "L" | "R";
  /** Shaft axis height and side offset. */
  y: number;
  z: number;
  /**
   * Stations along x: the turbine housing's aft face, the turbine / centre-housing joint, the centre housing's oil
   * inlet, the centre / compressor joint, the compressor housing's front and the compressor inlet's face.
   */
  x: {
    turbineAft: number;
    turbineFront: number;
    centre: number;
    centreFront: number;
    compressorFront: number;
    inletFace: number;
  };
  /** Housing radii, and the compressor inlet's. */
  r: { turbine: number; centre: number; compressor: number; inlet: number };
  /** Discharge collar aft of the turbine housing, to the tailpipe joint: its aft end and radius. */
  outlet: { x: number; r: number };
  /** Turbine inlet flange on top of the turbine housing (centre of the flange face). */
  turbineInlet: V3;
  /** Compressor outlet on top of the compressor housing, where the duct to the intercooler starts. */
  compressorOutlet: V3;
  /** Turbine inlet temperature probe boss. */
  tit: V3;
}

/** One intercooler: a long box fore and aft, a tapered neck forward, a hood with the cabin-heat nozzle aft. */
export interface IntercoolerDef {
  side: "L" | "R";
  /** Core: aft and forward ends (x), outer and inner edges (|z| as signed z), base and top (y). */
  core: { x0: number; x1: number; zOut: number; zIn: number; y0: number; y1: number };
  /** Charge-air inlet under the aft end of the core (the compressor duct comes up into it). */
  inlet: V3;
  /** Forward neck face and radius; the outlet spigot runs on forward to `outlet`. */
  neck: V3;
  neckR: number;
  outlet: V3;
  /** Cabin-heat nozzle on the aft hood: its axis height and side offset, its base and aft end stations, radius. */
  aftPort: { y: number; z: number; x0: number; x1: number; r: number };
}

/** The oil lines the group draws, each a polyline from one fitting to the next. */
export type TurboOilLine =
  | "supply"
  | "toL"
  | "toR"
  | "drainL"
  | "drainR"
  | "scavenge"
  | "pumpReturn"
  | "toWastegate"
  | "toController"
  | "controllerDrain";

export type TurboNote =
  | "compressor"
  | "compressorWheel"
  | "inlet"
  | "centre"
  | "shaft"
  | "turbine"
  | "turbineWheel"
  | "turbineInlet"
  | "outlet"
  | "tit"
  | "reservoir"
  | "wastegate"
  | "wastegatePlate"
  | "actuator"
  | "actuatorRod"
  | "controller"
  | "controllerLines"
  | "intercooler"
  | "intercoolerNeck"
  | "intercoolerHood"
  | "aftPort"
  | "overboost"
  | "overboostPoppet"
  | TurboOilLine
  | "filter"
  | "checkValve"
  | "supplyTee"
  | "drainTee"
  | "scavengePump";

/** An engine's turbocharger layout (scene metres; `engines/<id>/layout-turbo.ts`). */
export interface TurboLayout {
  /** Left, then right. */
  sides: [TurboSideDef, TurboSideDef];
  /**
   * The single wastegate: its valve body (bore vertical), its flanges (the centres of the top flange's upper face and
   * the bottom flange's lower face, where the exhaust transition and the tailpipe bolt on; square, `halfWidth` across
   * and `thickness` deep) and its actuator (axis across the engine, outboard).
   */
  wastegate: {
    side: "L" | "R";
    at: V3;
    r: number;
    flanges: { top: V3; bottom: V3; halfWidth: number; thickness: number };
    actuator: { at: V3; r: number; len: number };
  };
  /** The wastegate controller, drawn free-standing, and the bulkhead fittings its deck and manifold lines run to. */
  controller: { at: V3; deckPort: V3; mapPort: V3 };
  /** Left, then right. */
  intercoolers: [IntercoolerDef, IntercoolerDef];
  /** Overboost valve: the side whose intercooler outlet carries it, and its seat. */
  overboost: { side: "L" | "R"; at: V3 };
  /** Oil fittings and the lines between them. */
  oil: {
    coolerOutlet: V3;
    coolerInboard: V3;
    filter: V3;
    checkValve: V3;
    supplyTee: V3;
    drainTee: V3;
    scavengePump: V3;
    pumpReturn: V3;
    controllerReturn: V3;
    lines: Record<TurboOilLine, V3[]>;
  };
  notes: Record<TurboNote, string>;
  /** Label pins. */
  labels: [string, V3][];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Wastegate butterfly angle (rad) for the model's `gate` (0 closed … 1 open): 0 across the bore, 75° fully open. */
export const gatePlateAngle = (gate: number) => clamp01(gate) * 75 * (Math.PI / 180);

/** How far the actuator rod has moved (m) at a gate position: illustrative, 15 mm over the full travel. */
export const actuatorTravel = (gate: number) => clamp01(gate) * 0.015;

/** Drawn rpm per turbocharger rpm: the wheels turn far too fast to draw, so they are shown slowed (illustrative). */
export const DRAWN_PER_RPM = 1 / 30000;

/**
 * Drawn wheel speed (rad/s): still when the engine isn't running or that turbocharger has failed, otherwise
 * proportional to its shaft speed, slowed (`DRAWN_PER_RPM`).
 */
export function wheelRate(turboRpm: number, running: boolean, failed: boolean) {
  if (!running || failed) return 0;
  return Math.max(0, turboRpm) * DRAWN_PER_RPM * 2 * Math.PI;
}

/** Overboost poppet lift (m): up while the relief valve is open, seated otherwise. Illustrative. */
export const reliefLift = (reliefOpen: boolean) => (reliefOpen ? 0.008 : 0);

/**
 * The intercoolers' opacity: solid like the engine's other parts; X-ray turns them see-through, but far less than the
 * case, cylinders and turbo housings it opens up, so the cores still read over the heads and the pointer still stops on
 * them (parts.tsx lets it through below 0.5). Illustrative.
 */
export const intercoolerOpacity = (xray: boolean) => (xray ? 0.6 : 1);

/** Charge-air tint for a temperature (°C): grey-blue when cool, warm orange towards 150 °C. Illustrative. */
export function chargeAirColor(c: number, out: THREE.Color) {
  const t = clamp01((c - 20) / 130);
  return out.setRGB(0.45 + 0.5 * t, 0.55 - 0.1 * t, 0.65 - 0.45 * t);
}

/** A cylinder along +y from y0 to y1. */
const yrod = (r: number, y0: number, y1: number, segs = 16) =>
  new THREE.CylinderGeometry(r, r, y1 - y0, segs).translate(0, (y0 + y1) / 2, 0);

/** A truncated cone from p0 (radius r0) to p1 (radius r1); its cross-sections stay square to x. */
function frustum(p0: V3, r0: number, p1: V3, r1: number, segs = 20) {
  const h = 1;
  const g = new THREE.CylinderGeometry(r1, r0, h, segs, 1, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h + 0.5;
    pos.setXYZ(
      i,
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t + pos.getX(i),
      p0[2] + (p1[2] - p0[2]) * t + pos.getZ(i),
    );
  }
  // the cylinder's x goes to y and its axis to p1 - p0: a mirror image when that axis runs forward (+x), which turns its
  // triangles inside out, so they are rewound to face outward again
  if (p1[0] > p0[0]) {
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A cylinder along x between two stations, on an axis at (y, z). */
const xrod = (r: number, x0: number, x1: number, y: number, z: number, segs = 24) =>
  rod(r, Math.abs(x1 - x0), segs).translate((x0 + x1) / 2, y, z);

/** Every geometry the turbo group draws, from its layout (pure: tests measure it without rendering). */
export function turboGeometry(T: TurboLayout) {
  const sides = T.sides.map((t) => {
    const { x, r, y, z } = t;
    const tMid = (x.turbineAft + x.turbineFront) / 2,
      cMid = (x.centreFront + x.compressorFront) / 2;
    const [ix, iy, iz] = t.turbineInlet;
    const [ox, oy, oz] = t.compressorOutlet;
    return {
      turbine: xrod(r.turbine, x.turbineAft, x.turbineFront, y, z, 32),
      collar: xrod(t.outlet.r, t.outlet.x, x.turbineAft, y, z),
      inletNeck: merge([
        yrod(r.turbine * 0.42, y + r.turbine * 0.6, iy - 0.006).translate(ix, 0, iz),
        slab(ix - 0.03, ix + 0.03, iy - 0.006, iy, iz - 0.035, iz + 0.035, 0.006),
      ]),
      centre: xrod(r.centre, x.turbineFront, x.centreFront, y, z),
      compressor: xrod(r.compressor, x.centreFront, x.compressorFront, y, z, 32),
      inletStub: xrod(r.inlet, x.compressorFront, x.inletFace, y, z),
      outletStub: yrod(r.inlet * 0.72, y + r.compressor * 0.6, oy).translate(ox, 0, oz),
      oilFitting: yrod(0.006, y + r.centre - 0.004, y + r.centre + 0.014).translate(x.centre, 0, z),
      reservoir: slab(
        x.centre - 0.028,
        x.centre + 0.028,
        y - r.centre - 0.03,
        y - r.centre + 0.004,
        z - 0.022,
        z + 0.022,
        0.006,
      ),
      tit: merge([
        yrod(0.008, t.tit[1] - 0.008, t.tit[1] + 0.006, 6).translate(t.tit[0], 0, t.tit[2]),
        yrod(0.0025, iy - 0.02, t.tit[1], 8).translate(t.tit[0], 0, t.tit[2]),
      ]),
      shaft: rod(0.006, cMid - tMid, 10),
      shaftX: (tMid + cMid) / 2,
      turbineWheel: gear(r.turbine * 0.62, 11, 0.022, 0.006),
      turbineWheelX: tMid,
      compressorWheel: gear(r.compressor * 0.68, 12, 0.026, 0.006),
      compressorWheelX: cMid,
    };
  });

  const W = T.wastegate;
  const [wx, , wz] = W.at;
  const F = W.flanges;
  const fTop = F.top[1],
    fBot = F.bottom[1],
    fh = F.halfWidth;
  const A = W.actuator;
  // the actuator's inboard end faces the valve body; its rod runs from there towards the body
  const inward = Math.sign(wz - A.at[2]) || 1;
  const aIn = A.at[2] + (inward * A.len) / 2;
  const wastegate = {
    body: merge([
      yrod(W.r, fBot + F.thickness, fTop - F.thickness, 24).translate(wx, 0, wz),
      slab(wx - fh, wx + fh, fTop - F.thickness, fTop, wz - fh, wz + fh, 0.006),
      slab(wx - fh, wx + fh, fBot, fBot + F.thickness, wz - fh, wz + fh, 0.006),
    ]),
    // the butterfly at the origin: a disc across the bore, turned about its shaft (z) by the gate angle
    plate: new THREE.CylinderGeometry(W.r * 0.88, W.r * 0.88, 0.003, 24),
    plateShaft: zrod(0.004, Math.min(wz, aIn), Math.max(wz, aIn), 8).translate(wx, W.at[1], 0),
    actuator: zrod(A.r, A.at[2] - A.len / 2, A.at[2] + A.len / 2, 24).translate(A.at[0], A.at[1], 0),
    // the rod at rest: from the actuator's inboard end, a third of the way to the valve body
    rod: zrod(0.004, Math.min(aIn, aIn + inward * 0.03), Math.max(aIn, aIn + inward * 0.03), 8).translate(
      A.at[0],
      A.at[1],
      0,
    ),
    rodSign: inward,
  };

  const C = T.controller;
  const [cx, cy, cz] = C.at;
  const controller = {
    body: merge([
      yrod(0.034, cy - 0.012, cy + 0.03, 24).translate(cx, 0, cz),
      yrod(0.04, cy - 0.024, cy - 0.012, 24).translate(cx, 0, cz),
      slab(cx - 0.02, cx + 0.02, cy - 0.05, cy - 0.024, cz - 0.03, cz + 0.03, 0.006),
    ]),
    ports: merge([C.deckPort, C.mapPort].map(([x, y, z]) => rod(0.009, 0.02, 12).translate(x, y, z))),
    lines: merge(
      [C.deckPort, C.mapPort].map(([x, y, z], k) =>
        tube(
          [
            [cx + 0.01, cy + 0.02, cz + (k ? -0.02 : 0.02)],
            [(cx + x) / 2, Math.max(cy, y) + 0.03, (cz + z) / 2],
            [x - 0.01, y, z],
          ],
          0.004,
          20,
          8,
        ),
      ),
    ),
  };

  const intercoolers = T.intercoolers.map((ic) => {
    const c = ic.core;
    const zLo = Math.min(c.zOut, c.zIn),
      zHi = Math.max(c.zOut, c.zIn),
      ym = (c.y0 + c.y1) / 2,
      zm = (zLo + zHi) / 2;
    const fins: THREE.BufferGeometry[] = [];
    const n = Math.max(2, Math.round((c.x1 - c.x0) / 0.02));
    for (let i = 1; i < n; i++) {
      const fx = c.x0 + ((c.x1 - c.x0) * i) / n;
      fins.push(slab(fx - 0.001, fx + 0.001, c.y1, c.y1 + 0.004, zLo + 0.008, zHi - 0.008, 0.001));
    }
    const p = ic.aftPort;
    // the neck and the hood start no larger than the core's end face (up to 50 mm), so a shallow core keeps them on it
    const endR = Math.min(0.05, (c.y1 - c.y0) / 2, (zHi - zLo) / 2);
    return {
      core: slab(c.x0, c.x1, c.y0, c.y1, zLo, zHi, 0.008),
      fins: merge(fins),
      front: frustum([c.x1, ym, zm], endR, ic.neck, ic.neckR),
      neck: xrod(ic.neckR, ic.neck[0], ic.outlet[0], ic.neck[1], ic.neck[2]),
      hood: frustum([c.x0, ym, zm], endR, [p.x0, p.y, p.z], p.r * 1.25),
      port: xrod(p.r, p.x1, p.x0, p.y, p.z),
      inlet: yrod(0.026, ic.inlet[1] - 0.02, ic.inlet[1] + 0.002, 20).translate(ic.inlet[0], 0, ic.inlet[2]),
    };
  });

  const [bx, by, bz] = T.overboost.at;
  const overboost = {
    body: yrod(0.018, by - 0.004, by + 0.03, 20).translate(bx, 0, bz),
    // the poppet at its seat; it lifts by `reliefLift`
    poppet: yrod(0.022, 0, 0.006, 20),
    seatY: by + 0.03,
  };

  const o = T.oil;
  const lines = {} as Record<TurboOilLine, THREE.BufferGeometry>;
  for (const k of Object.keys(o.lines) as TurboOilLine[]) lines[k] = tube(o.lines[k], 0.005, 48, 8);
  const oil = {
    lines,
    filter: rod(0.014, 0.03, 16)
      .rotateZ(Math.PI / 2)
      .translate(...o.filter),
    checkValve: rod(0.009, 0.028, 12)
      .rotateZ(Math.PI / 2)
      .translate(...o.checkValve),
    supplyTee: merge([
      rod(0.008, 0.03, 10).translate(...o.supplyTee),
      yrod(0.008, 0, 0.018, 10).translate(...o.supplyTee),
    ]),
    drainTee: merge([
      zrod(0.008, -0.015, 0.015, 10).translate(...o.drainTee),
      yrod(0.008, 0, 0.018, 10).translate(...o.drainTee),
    ]),
    // the drum on the starter shaft's fore-aft axis, its drive stub forward into the starter adapter's cover, short of
    // the worm wheel inside it
    scavengePump: merge([
      xrod(0.028, o.scavengePump[0] - 0.025, o.scavengePump[0] + 0.025, o.scavengePump[1], o.scavengePump[2], 20),
      xrod(0.012, o.scavengePump[0] + 0.025, o.scavengePump[0] + 0.036, o.scavengePump[1], o.scavengePump[2], 12),
    ]),
  };

  return { sides, wastegate, controller, intercoolers, overboost, oil };
}
export type TurboGeometry = ReturnType<typeof turboGeometry>;

/** The hover note on a turbocharger's oil inlet fitting: that side's supply hose. */
export const oilInletNote = (T: TurboLayout, side: "L" | "R") => T.notes[side === "L" ? "toL" : "toR"];

/** Every BufferGeometry in a built turbo group (for dispose and for tests). */
export function turboGeometries(G: TurboGeometry): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const walk = (v: unknown) => {
    if (v instanceof THREE.BufferGeometry) out.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(G);
  return out;
}

/** The turbocharger group, drawn when the engine's layout has a turbo block. */
export function Turbo(p: { sim: EngineSim; d: Dims; mats: Mats }) {
  const T = layoutFor(p.sim.spec).turbo;
  return T ? <TurboParts {...p} T={T} /> : null;
}

const SIDE = { L: "LH", R: "RH" } as const;

function TurboParts({ sim, mats, T }: { sim: EngineSim; d: Dims; mats: Mats; T: TurboLayout }) {
  const G = useMemo(() => turboGeometry(T), [T]);
  const M = useMemo(() => {
    const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.5, transparent: true, ...extra });
    return {
      turbine: [0, 1].map(() => std("#6b625c", { emissive: "#000" })),
      centre: std("#8a9198"),
      compressor: std("#b8bec4", { metalness: 0.6 }),
      intercooler: std("#9aa3aa"),
      fins: std("#9aa3aa"),
      hood: std("#9aa3aa"),
      neck: std("#9aa3aa"),
      wastegate: std("#5d6670"),
      actuator: std("#41607e"),
      controller: std("#3f4a55"),
      oilSupply: new THREE.MeshStandardMaterial({ color: "#b85a2a", metalness: 0.3, emissive: "#ff8a3d" }),
      oilDrain: new THREE.MeshStandardMaterial({ color: "#8a4a2a", metalness: 0.3, emissive: "#ff8a3d" }),
      oilGate: new THREE.MeshStandardMaterial({ color: "#b85a2a", metalness: 0.3, emissive: "#ff8a3d" }),
    };
  }, []);
  const see = useMemo(() => [...M.turbine, M.centre, M.compressor, M.wastegate, M.actuator], [M]);
  const cooler = useMemo(() => [M.intercooler, M.fins, M.hood, M.neck], [M]);
  useEffect(
    () => () => {
      turboGeometries(G).forEach((g) => g.dispose());
      Object.values(M)
        .flat()
        .forEach((m) => m.dispose());
    },
    [G, M],
  );

  const wheels = useRef<(THREE.Object3D | null)[]>([]),
    angle = useRef([0, 0]),
    plate = useRef<THREE.Mesh>(null),
    rodRef = useRef<THREE.Group>(null),
    poppet = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const s = sim.s,
      ui = sim.useUi.getState();
    const xray = ui.view.xray;
    for (const m of see) {
      m.opacity = xray ? 0.22 : 1;
      m.depthWrite = !xray;
    }
    for (const m of cooler) {
      m.opacity = intercoolerOpacity(xray);
      m.depthWrite = !xray;
    }
    const gate = s.gate ?? 1;
    if (plate.current) plate.current.rotation.z = gatePlateAngle(gate);
    if (rodRef.current) rodRef.current.position.z = G.wastegate.rodSign * actuatorTravel(gate);
    if (!ui.view.paused) {
      const step = Math.min(Math.max(dt, 0), 0.1) * (ui.view.slow ? 0.2 : 1);
      T.sides.forEach((_, i) => {
        const failed = !!ui.failures.turboInternal?.[i];
        angle.current[i] =
          (angle.current[i] + wheelRate(s.turboRpm?.[i] ?? 0, s.running, failed) * step) % (2 * Math.PI);
        const w = wheels.current[i];
        if (w) w.rotation.x = angle.current[i];
      });
    }
    if (poppet.current) poppet.current.position.y = G.overboost.seatY + reliefLift(!!s.reliefOpen);
    T.sides.forEach((_, i) => {
      const m = M.turbine[i];
      egtColor(s.tit?.[i] ?? 60, tmp);
      m.color.copy(tmp);
      m.emissive.copy(tmp);
      m.emissiveIntensity = Math.max(0, ((s.tit?.[i] ?? 60) - 900) / 900);
    });
    chargeAirColor(s.compressorOutC ?? 15, M.hood.color);
    chargeAirColor(s.matC ?? 15, M.intercooler.color);
    // the fins a shade darker than the core, so the finned top reads against it
    M.fins.color.copy(M.intercooler.color).multiplyScalar(0.72);
    chargeAirColor(s.matC ?? 15, M.neck.color);
    const flow = s.running ? clamp01(s.oilP / 60) : 0;
    M.oilSupply.emissiveIntensity = 0.5 * flow;
    M.oilDrain.emissiveIntensity = 0.3 * flow;
    M.oilGate.emissiveIntensity = ui.failures.wastegateOil ? 0 : 0.5 * flow;
  });

  const n = T.notes;
  return (
    <>
      {G.sides.map((g, i) => {
        const t = T.sides[i],
          S = SIDE[t.side];
        return (
          <group key={t.side}>
            <P name={`${S} turbine housing`} note={n.turbine} geometry={g.turbine} material={M.turbine[i]} />
            <P name={`${S} turbine discharge`} note={n.outlet} geometry={g.collar} material={M.turbine[i]} />
            <P
              name={`${S} turbine inlet flange`}
              note={n.turbineInlet}
              geometry={g.inletNeck}
              material={M.turbine[i]}
            />
            <P name={`${S} centre housing`} note={n.centre} geometry={g.centre} material={M.centre} />
            <P name={`${S} compressor housing`} note={n.compressor} geometry={g.compressor} material={M.compressor} />
            <P name={`${S} compressor inlet`} note={n.inlet} geometry={g.inletStub} material={M.compressor} />
            <P name={`${S} compressor outlet`} note={n.compressor} geometry={g.outletStub} material={M.compressor} />
            <P
              name={`${S} turbocharger oil inlet`}
              note={oilInletNote(T, t.side)}
              geometry={g.oilFitting}
              material={mats.steel}
            />
            <P name={`${S} turbocharger oil reservoir`} note={n.reservoir} geometry={g.reservoir} material={M.centre} />
            <P name={`${S} TIT probe`} note={n.tit} geometry={g.tit} material={mats.steel} />
            <group
              ref={(el) => {
                wheels.current[i] = el;
              }}
              position={[0, t.y, t.z]}
            >
              <P
                name={`${S} turbine wheel`}
                note={n.turbineWheel}
                geometry={g.turbineWheel}
                material={mats.darkSteel}
                position={[g.turbineWheelX, 0, 0]}
              />
              <P
                name={`${S} compressor wheel`}
                note={n.compressorWheel}
                geometry={g.compressorWheel}
                material={mats.steel}
                position={[g.compressorWheelX, 0, 0]}
              />
              <P
                name={`${S} turbocharger shaft`}
                note={n.shaft}
                geometry={g.shaft}
                material={mats.steel}
                position={[g.shaftX, 0, 0]}
              />
            </group>
          </group>
        );
      })}
      <P name="Wastegate" note={n.wastegate} geometry={G.wastegate.body} material={M.wastegate} />
      <P
        name="Wastegate butterfly"
        note={n.wastegatePlate}
        geometry={G.wastegate.plate}
        material={mats.darkSteel}
        position={T.wastegate.at}
        meshRef={plate}
      />
      <P name="Wastegate shaft" note={n.wastegatePlate} geometry={G.wastegate.plateShaft} material={mats.steel} />
      <P name="Wastegate actuator" note={n.actuator} geometry={G.wastegate.actuator} material={M.actuator} />
      <group ref={rodRef}>
        <P name="Wastegate actuator rod" note={n.actuatorRod} geometry={G.wastegate.rod} material={mats.steel} />
      </group>
      <P name="Wastegate controller" note={n.controller} geometry={G.controller.body} material={M.controller} />
      <P name="Controller pressure lines" note={n.controllerLines} geometry={G.controller.lines} material={mats.lead} />
      <P
        name="Controller bulkhead fittings"
        note={n.controllerLines}
        geometry={G.controller.ports}
        material={mats.steel}
      />
      {G.intercoolers.map((g, i) => {
        const S = SIDE[T.intercoolers[i].side];
        return (
          <group key={S}>
            <P name={`${S} intercooler`} note={n.intercooler} geometry={g.core} material={M.intercooler} />
            <P name={`${S} intercooler fins`} note={n.intercooler} geometry={g.fins} material={M.fins} />
            <P name={`${S} intercooler outlet`} note={n.intercoolerNeck} geometry={g.front} material={M.neck} />
            <P name={`${S} intercooler outlet`} note={n.intercoolerNeck} geometry={g.neck} material={M.neck} />
            <P name={`${S} intercooler aft hood`} note={n.intercoolerHood} geometry={g.hood} material={M.hood} />
            <P name={`${S} intercooler inlet`} note={n.intercoolerHood} geometry={g.inlet} material={M.hood} />
            <P name={`${S} cabin-heat nozzle`} note={n.aftPort} geometry={g.port} material={M.hood} />
          </group>
        );
      })}
      <P name="Overboost valve" note={n.overboost} geometry={G.overboost.body} material={mats.fuelBody} />
      <P
        name="Overboost valve poppet"
        note={n.overboostPoppet}
        geometry={G.overboost.poppet}
        material={mats.steel}
        position={[T.overboost.at[0], G.overboost.seatY, T.overboost.at[2]]}
        meshRef={poppet}
      />
      {(Object.keys(G.oil.lines) as TurboOilLine[]).map((k) => (
        <P
          key={k}
          name={OIL_NAMES[k]}
          note={n[k]}
          geometry={G.oil.lines[k]}
          material={{ supply: M.oilSupply, drain: M.oilDrain, gate: M.oilGate }[OIL_KIND[k]]}
        />
      ))}
      <P name="Turbocharger oil filter" note={n.filter} geometry={G.oil.filter} material={mats.filter} />
      <P name="Turbocharger oil check valve" note={n.checkValve} geometry={G.oil.checkValve} material={mats.steel} />
      <P name="Turbocharger oil supply tee" note={n.supplyTee} geometry={G.oil.supplyTee} material={mats.steel} />
      <P name="Turbocharger oil drain tee" note={n.drainTee} geometry={G.oil.drainTee} material={mats.steel} />
      <P name="Scavenge pump" note={n.scavengePump} geometry={G.oil.scavengePump} material={mats.alt} />
    </>
  );
}

/** Oil line names, and which lines glow as supply, drain or wastegate oil. */
const OIL_NAMES: Record<TurboOilLine, string> = {
  supply: "Turbocharger oil supply",
  toL: "LH turbocharger oil supply hose",
  toR: "RH turbocharger oil supply hose",
  drainL: "LH turbocharger oil drain hose",
  drainR: "RH turbocharger oil drain hose",
  scavenge: "Scavenge pump suction hose",
  pumpReturn: "Scavenge oil return",
  toWastegate: "Wastegate oil supply hose",
  toController: "Wastegate oil return to the controller",
  controllerDrain: "Controller oil drain",
};
const OIL_KIND: Record<TurboOilLine, "supply" | "drain" | "gate"> = {
  supply: "supply",
  toL: "supply",
  toR: "supply",
  drainL: "drain",
  drainR: "drain",
  scavenge: "drain",
  pumpReturn: "drain",
  toWastegate: "gate",
  toController: "gate",
  controllerDrain: "gate",
};
