/**
 * Shared pieces for the engine scene: dimensions from the spec and the engine's scene layout (`layout.ts`), the layout
 * of the valve train, crankshaft and accessory drives, materials and geometry builders. Axes as in the airplanes: x
 * forward (propeller end), y up, z right; metres.
 *
 * Published dimensions (bore, stroke, the overall envelope, stations an engine's layout gives) set the scale; where
 * parts sit follows the manufacturer's figures as each engine's layout and notes cite them. Shapes and sizes of
 * individual parts are schematic.
 */
import * as THREE from "three";
import { firingAngle, sideAngle } from "@/engines/model/cycle";
import type { Failures, MagSwitch } from "@/engines/model/engine";
import type { CylinderDef, EngineSpec, Side } from "@/engines/types";
import { IO390_DEFAULTS, layoutFor, type EngineLayout, type ValveDef } from "./layout";

export const IN = 0.0254;
export const D2R = Math.PI / 180;

export type Dims = ReturnType<typeof dims>;

export function dims(spec: EngineSpec, L: EngineLayout = layoutFor(spec)) {
  const g = spec.geometry;
  const r = (g.strokeIn * IN) / 2,
    l = g.rodIn * IN,
    bore = g.boreIn * IN;
  const pinTdc = r + l; // piston pin from the crank axis at top centre
  const crown = 0.045; // pin to crown
  const deck = pinTdc + crown + 0.004; // head face, just past the crown at top centre
  // half the drawn width: the rocker covers' outer faces sit 0.03 m inside it, within the published overall width, or
  // on the layout's measured cover width
  const halfWidth = L.coverWidthIn === null ? (g.envelopeIn.width * IN) / 2 : (L.coverWidthIn * IN) / 2 + 0.03;
  const caseHalf = l - 0.02; // crankcase half-width: the barrel spigots start here
  const xs = g.cylinders.map((c) => c.x);
  // stations the layout gives, or around the cylinders
  const st = L.stationsIn;
  const front = st ? st.front * IN : Math.max(...xs) + 0.12,
    rear = st ? st.caseRear * IN : Math.min(...xs) - 0.13;
  const belt = L.alternators.find((a) => a.drive === "belt");
  return {
    r,
    l,
    bore,
    crown,
    deck,
    halfWidth,
    caseHalf,
    front,
    rear,
    /** Head: from the deck to the rocker-box face. */
    headIn: deck - 0.012,
    headOut: halfWidth - 0.03,
    /** Camshaft axis height (gear centres: crank gear r + cam gear r, 2:1), above or below the crankshaft. */
    camY: L.camBelow ? -0.12 : 0.12,
    crankGearR: 0.04,
    camGearR: 0.08,
    /** Rocker shaft, and the valve-stem tips at rest, along a cylinder's axis. */
    zPivot: halfWidth - 0.065,
    /** Rear face of the crankcase, accessory housing behind it. */
    caseRear: rear,
    accRear: st ? st.accessoryFace * IN : rear - 0.05,
    /** Crankcase top and bottom (sump below), and the accessory housing's height range. */
    caseTop: L.caseY.top,
    caseBottom: L.caseY.bottom,
    sumpBottom: L.caseY.sumpBottom,
    accBottom: L.caseY.accBottom,
    accTop: L.caseY.accTop,
    /** Propeller flange, starter ring gear and alternator pulley. */
    flangeX: st ? st.propFlange * IN : front + 0.1,
    ringR: 0.17,
    // the belt alternator's drive ratio with a 3.10 in alternator pulley (the IO-390's, IOM Table A-4)
    pulleyR: ((3.1 * IN) / 2) * (belt?.ratio ?? spec.accessories.alternatorRatio),
    altPulleyR: (3.1 * IN) / 2,
  };
}

/** Bank sign: +1 right (1, 3), −1 left (2, 4). */
export const bank = (c: CylinderDef) => (c.side === "R" ? 1 : -1);

/** Valve-train layout in a cylinder's own frame (+z outward along its axis, y up, x towards the front for the right
 * bank), camshaft above, valves fore and aft of the axis; `valveLayout` turns it for other layouts. */
export const VT = {
  xOff: 0.022, // intake at +xOff, exhaust at −xOff (local)
  baseR: 0.016, // cam lobe base circle
  lobeW: 0.014, // cam lobe width along the shaft
  tappetLen: 0.045,
  pushY: 0.12, // pushrod line height: the camshaft axis
  pivotY: 0.079, // rocker shaft, halfway between pushrod and valve stem (1:1 rocker)
  tipY: 0.038, // valve stem tips
  maxLift: 0.0095, // drawn lift (not published)
};

/**
 * Each valve's train in the cylinder frame. Camshaft above: both valves above the axis, fore and aft (`VT`). Camshaft
 * below: the pushrods run under the cylinder; with a vertical valve plane the intake stem tip is above the axis and the
 * exhaust's below, each rocker pivot halfway between its pushrod and stem (1:1).
 */
export function valveLayout(L: EngineLayout): { intake: ValveDef; exhaust: ValveDef } {
  if (!L.camBelow && L.valvePlane === "fore-aft") {
    const v = (x: number): ValveDef => ({ x, pushY: VT.pushY, pivotY: VT.pivotY, tipY: VT.tipY });
    return { intake: v(VT.xOff), exhaust: v(-VT.xOff) };
  }
  const k = L.camBelow ? -1 : 1;
  const v = (x: number, tipY: number): ValveDef => ({
    x,
    pushY: k * VT.pushY,
    pivotY: (k * VT.pushY + tipY) / 2,
    tipY,
  });
  return L.valvePlane === "vertical"
    ? { intake: v(VT.xOff, VT.tipY), exhaust: v(-VT.xOff, -VT.tipY) }
    : { intake: v(VT.xOff, k * VT.tipY), exhaust: v(-VT.xOff, k * VT.tipY) };
}

export function makeMats() {
  const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra });
  return {
    // X-ray: these turn translucent
    case: std("#9aa4ab", { transparent: true, side: THREE.DoubleSide }),
    sump: std("#8e9aa2", { transparent: true, side: THREE.DoubleSide }),
    acc: std("#8a959c", { transparent: true }),
    barrel: std("#5b666e", { transparent: true }),
    head: std("#aab2b8", { transparent: true }),
    cover: std("#c9ced2", { transparent: true, metalness: 0.5 }),
    shroud: std("#b9c0c5", { transparent: true, metalness: 0.5 }),
    // internals
    steel: std("#a9b2ba", { metalness: 0.85, roughness: 0.3 }),
    darkSteel: std("#6f7a83", { metalness: 0.8, roughness: 0.35 }),
    piston: std("#d3d7da", { metalness: 0.6, roughness: 0.35 }),
    ring: std("#3b4248", { metalness: 0.7 }),
    bearing: std("#c99a45", { metalness: 0.8, roughness: 0.3 }),
    gear: std("#b6a074", { metalness: 0.8, roughness: 0.35 }),
    spring: std("#3d6fb5", { metalness: 0.5 }),
    valveI: std("#2f7fe6", { metalness: 0.6 }),
    valveE: std("#e0522b", { metalness: 0.6 }),
    // accessories
    mag: std("#2b3138", { metalness: 0.3 }),
    magCap: std("#d9960f"),
    lead: std("#cfd5da", { metalness: 0.6, roughness: 0.4 }),
    plug: std("#f2f2ee", { roughness: 0.3 }),
    spark: new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0, depthWrite: false }),
    black: std("#22272c", { metalness: 0.3, roughness: 0.6 }),
    alt: std("#3d4650", { metalness: 0.4 }),
    belt: std("#1a1d20", { roughness: 0.9, metalness: 0 }),
    filter: std("#2c62a6", { metalness: 0.3 }),
    intake: std("#149c94", { metalness: 0.4 }),
    fuel: std("#2f7fe6", { emissive: "#2f7fe6", emissiveIntensity: 0 }),
    fuelBody: std("#7a8a99", { metalness: 0.5 }),
    oil: std("#b85a2a", { metalness: 0.3 }),
    prop: std("#4a535c", { metalness: 0.5, roughness: 0.4 }),
    propTip: std("#e7b416"),
    disc: new THREE.MeshBasicMaterial({ color: "#7d8a94", transparent: true, opacity: 0.07, depthWrite: false }),
    spinner: std("#d8dde1", { metalness: 0.6, roughness: 0.25 }),
  };
}
export type Mats = ReturnType<typeof makeMats>;

/** Materials that turn translucent in X-ray. */
export const XRAY_MATS = ["case", "sump", "acc", "barrel", "head", "cover", "shroud"] as const;

/** Cylinder along +x (lathe axis), centred. */
export function rod(radius: number, length: number, segs = 16) {
  const g = new THREE.CylinderGeometry(radius, radius, length, segs);
  return g.rotateZ(Math.PI / 2);
}

/** Cylinder along +z, from z0 to z1. */
export function zrod(radius: number, z0: number, z1: number, segs = 16, r1 = radius) {
  const g = new THREE.CylinderGeometry(r1, radius, z1 - z0, segs);
  return g.rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
}

/** A finned tube along +z from z0 to z1. */
export function finned(radius: number, fin: number, z0: number, z1: number, n: number, open = true) {
  const parts: THREE.BufferGeometry[] = [];
  const core = new THREE.CylinderGeometry(radius, radius, z1 - z0, 28, 1, open);
  parts.push(core.rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
    parts.push(new THREE.CylinderGeometry(fin, fin, 0.0028, 32).rotateX(Math.PI / 2).translate(0, 0, z));
  }
  return merge(parts);
}

/** A spur gear in the y–z plane (axis along x), centred. */
export function gear(radius: number, teeth: number, width: number, bore = 0) {
  const s = new THREE.Shape();
  const depth = Math.min(0.006, radius * 0.12);
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2,
      da = (Math.PI * 2) / teeth;
    const pts: [number, number][] = [
      [radius - depth, a0],
      [radius, a0 + da * 0.2],
      [radius, a0 + da * 0.45],
      [radius - depth, a0 + da * 0.65],
    ];
    pts.forEach(([r, a], k) => {
      const x = r * Math.cos(a),
        y = r * Math.sin(a);
      if (i === 0 && k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (bore > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, bore, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 4 });
  // shape in x–y, extruded along z → turn so the axis is x
  return g.translate(0, 0, -width / 2).rotateY(Math.PI / 2);
}

/** A rounded-rectangle slab: cross-section (z from z0 to z1, y from y0 to y1) extruded along x from x0 to x1. */
export function slab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, rad = 0.02) {
  const s = new THREE.Shape();
  const w = z1 - z0,
    h = y1 - y0,
    r = Math.min(rad, w / 2, h / 2);
  s.moveTo(r, 0);
  s.lineTo(w - r, 0);
  s.quadraticCurveTo(w, 0, w, r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(r, h);
  s.quadraticCurveTo(0, h, 0, h - r);
  s.lineTo(0, r);
  s.quadraticCurveTo(0, 0, r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: 6 });
  // shape x→ z, shape y → y, extrude z → x
  g.rotateY(-Math.PI / 2); // extrude now along −x, shape x along +z
  return g.translate(x1, y0, z0);
}

/** A tube along points. */
export function tube(points: [number, number, number][], radius: number, segs = 40, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

/** A coil spring along +z from z0 to z1. */
export function coil(radius: number, wire: number, z0: number, z1: number, turns: number) {
  const pts: THREE.Vector3[] = [];
  const n = turns * 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z0 + ((z1 - z0) * i) / n));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false);
}

/** Merge geometries that share attributes (position, normal, uv); index is dropped. */
export function merge(gs: THREE.BufferGeometry[]) {
  const flat = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = flat.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"] as const) {
    if (!flat.every((g) => g.attributes[name])) continue;
    const size = flat[0].attributes[name].itemSize;
    const arr = new Float32Array(count * size);
    let o = 0;
    for (const g of flat) {
      arr.set(g.attributes[name].array as Float32Array, o);
      o += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  flat.forEach((g, i) => {
    if (g !== gs[i]) g.dispose();
  });
  gs.forEach((g) => g.dispose());
  return out;
}

/** Exhaust colour for a gas temperature (°F): steel through dull red to orange. */
export function egtColor(f: number, out: THREE.Color) {
  const t = Math.max(0, Math.min(1, (f - 700) / 900));
  return out.setRGB(0.3 + 0.7 * t, 0.2 + 0.27 * t * t, 0.16 + 0.03 * t);
}
/** Head tint for a CHT (°F): grey when cold, warm amber near 400, red past the limit. */
export function chtColor(f: number, limit: number, out: THREE.Color) {
  const t = Math.max(0, Math.min(1, (f - 100) / (limit - 100)));
  out.setRGB(0.66 + 0.29 * t, 0.7 - 0.12 * t, 0.72 - 0.4 * t);
  if (f > limit) out.setRGB(0.95, 0.2, 0.15);
  return out;
}

type V3 = [number, number, number];

/** A point in a cylinder's own frame (+z out along its axis) in engine coordinates. */
export const toWorld = (c: CylinderDef, [x, y, z]: V3): V3 => [c.x + bank(c) * x, y, bank(c) * z];

const PLUG_TILT = 0.5; // rad, top and bottom plugs lean towards the exhaust side

/**
 * Fittings on a cylinder head, in the cylinder's frame: plugs top and bottom, nozzle on top, exhaust port underneath,
 * intake port underneath or (downdraft) on top beside the nozzle.
 */
export function headPoints(d: Dims, L: EngineLayout = IO390_DEFAULTS) {
  const z = d.deck + 0.015;
  const s = Math.sin(PLUG_TILT),
    c = Math.cos(PLUG_TILT);
  return {
    tilt: PLUG_TILT,
    // the top plug sits outboard of the rocker box
    topPlug: [-0.06, 0.078, z] as V3,
    topLead: [-0.06 - 0.06 * s, 0.078 + 0.06 * c, z] as V3,
    botPlug: [-0.045, -0.088, z] as V3,
    botLead: [-0.045 - 0.06 * s, -0.088 - 0.06 * c, z] as V3,
    /** Where each spark shows in the combustion chamber. */
    topSpark: [-0.03, 0.04, d.deck - 0.004] as V3,
    botSpark: [-0.03, -0.04, d.deck - 0.004] as V3,
    nozzle: [0.062, 0.078, d.deck + 0.035] as V3,
    nozzleTop: [0.062, 0.105, d.deck + 0.035] as V3,
    intakePort: [0.035, L.ports.intake === "top" ? 0.1 : -0.1, d.deck + 0.07] as V3,
    exhaustPort: [-0.035, -0.1, d.deck + 0.075] as V3,
  };
}

/** Engine crank angle (0 … 720 from cylinder 1's firing top centre, unwrapped) of a valve's peak lift. */
export function peakCrank(spec: EngineSpec, c: CylinderDef, intake: boolean) {
  const v = spec.geometry.valves;
  const phase = intake ? (360 - v.ivo + 540 + v.ivc) / 2 : (180 - v.evo + 360 + v.evc) / 2;
  return firingAngle(spec, c.n) + phase;
}

/**
 * A cam lobe's angle on the camshaft (degrees about x, nose +z at 0). The camshaft turns at −crank/2, so the nose
 * points along the cylinder's axis, at its tappet, exactly at peak lift.
 */
export const lobeAngle = (spec: EngineSpec, c: CylinderDef, intake: boolean) =>
  sideAngle(c) - 90 + peakCrank(spec, c, intake) / 2;

/**
 * The magnetos the switch's START position fires, as drawn: both where the spec says so (`ignition.startMags`),
 * otherwise the retard-breaker magneto alone.
 */
export const magsAtStart = (spec: EngineSpec): Side[] =>
  spec.ignition.startMags === "both" ? ["L", "R"] : [spec.ignition.retardMag];

/**
 * Which plugs flash in each cylinder, [top, bottom], for a switch position and the failures: the model's `sparks` rule
 * (a magneto fires from 60 % of the minimum starting speed unless it or the plug has failed), with the magnetos START
 * fires taken from `magsAtStart`, so the gate and each plug's magneto come from one set.
 */
export function drawnSparks(spec: EngineSpec, mags: MagSwitch, f: Failures, rpm: number): [boolean, boolean][] {
  const ign = spec.ignition;
  const live: Side[] =
    mags === "BOTH" ? ["L", "R"] : mags === "START" ? magsAtStart(spec) : mags === "OFF" ? [] : [mags];
  const on = (m: Side) => rpm >= ign.minStartRpm * 0.6 && !(m === "L" ? f.magL : f.magR) && live.includes(m);
  return spec.geometry.cylinders.map((c, i) => {
    const top = ign.topPlugMag[c.n],
      bottom: Side = top === "L" ? "R" : "L";
    return [on(top) && !f.plugs[i][0], on(bottom) && !f.plugs[i][1]];
  });
}

/** Starter ring gear and pinion teeth: not published, chosen so their ratio is the IO-390's starter drive ratio (16.556:1). */
export const STARTER_TEETH = { ring: 149, pinion: 9 };

/** Teeth on the camshaft gear (twice the crankshaft gear's 24: the camshaft turns at half speed). */
export const GEAR_TEETH = { crank: 24, cam: 48 };

/** An idler gear between the crankshaft gear and the magneto drive gears: drawn the camshaft gear's size. */
export const IDLER = { r: 0.08, teeth: 48 };

/**
 * Magneto drive gears, behind the accessory housing at ±z from the centreline. Each meshes with the camshaft gear, or
 * with the idler gear above the crankshaft gear (the layout's `magDrive`), sized so the magneto turns at the published
 * magneto drive ratio. Through an idler the idler's own size drops out: crankshaft-gear teeth over magneto-gear teeth.
 */
export function magDrive(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const z = 0.1;
  const ratio = spec.accessories.magnetoRatio;
  if (L.magDrive === "idler") {
    const teeth = Math.round(GEAR_TEETH.crank / ratio),
      r = (d.crankGearR * teeth) / GEAR_TEETH.crank;
    const idlerY = d.crankGearR + IDLER.r;
    return {
      r,
      teeth,
      z,
      y: idlerY + Math.sqrt((IDLER.r + r) ** 2 - z * z),
      x: d.caseRear - 0.018,
      idler: { y: idlerY, ...IDLER },
    };
  }
  const r = (d.camGearR * 0.5) / ratio,
    teeth = Math.round((GEAR_TEETH.cam * 0.5) / ratio);
  return { r, teeth, z, y: d.camY + Math.sqrt((d.camGearR + r) ** 2 - z * z), x: d.caseRear - 0.018, idler: null };
}

/**
 * The oil filler tube, out of the sump's rear face and up behind the crankcase, outboard of the accessory housing and
 * mounts on the layout's side, and the filler cap on its top.
 */
export function oilFiller(d: Dims, L: EngineLayout = IO390_DEFAULTS) {
  const k = L.oilFiller.side === "R" ? 1 : -1;
  const top = d.caseRear - 0.025;
  return {
    tube: [
      [d.caseRear + 0.04, d.caseBottom - 0.02, k * 0.1],
      [d.caseRear - 0.025, d.caseBottom - 0.025, k * 0.15],
      [d.caseRear - 0.025, 0.06, k * 0.155],
      [top, 0.2, k * 0.16],
    ] as V3[],
    cap: [top, 0.209, k * 0.16] as V3,
  };
}

/**
 * Oil pump: a drive gear meshing below the crankshaft gear, its shaft running aft to two pumping gears; or (the layout's
 * `oilPumpDrive: "cam"`) the first pumping gear splined into the camshaft gear, turning at camshaft speed. The crank
 * drive's ratio is drawn, not published.
 */
export function oilPump(d: Dims, L: EngineLayout = IO390_DEFAULTS) {
  if (L.oilPumpDrive === "cam")
    return { driveR: 0.018, driveTeeth: 10, y: d.camY, gearR: 0.018, x0: -0.036, x1: -0.036, ratio: 0.5, onCam: true };
  const driveR = d.crankGearR / 2;
  return {
    driveR,
    driveTeeth: GEAR_TEETH.crank / 2,
    y: -(d.crankGearR + driveR),
    gearR: 0.018,
    x0: -0.018, // drive gear, in the crankshaft gear's plane (from the crankcase's rear face)
    x1: -0.042, // pumping gears
    ratio: 2,
    onCam: false,
  };
}

/** A crank cheek's thickness along the shaft, m. */
export const CHEEK_T = 0.014;

/** A throw's turn about the shaft at crank angle 0: its crankpin (drawn at +z) points at `pin` (cycle.ts convention). */
export const throwRotation = (c: CylinderDef) => (c.pin - 90) * D2R;

/**
 * The crankshaft along x: main journals between the throws (none where two throws share a cheek), their bearings, the
 * cheeks either side of each crankpin and the counterweights the layout hangs on them.
 */
export function crankLayout(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const cyls = spec.geometry.cylinders;
  const T = L.throwHalf;
  // main journals only between the throws: at a throw the rod passes the axis between the cheeks
  const throwsAt = cyls.map((c) => c.x).sort((a, b) => b - a);
  const edges = [d.front + 0.02, ...throwsAt.flatMap((x) => [x + T, x - T]), d.caseRear - 0.005];
  const journals: { x: number; len: number }[] = [],
    bearings: { x: number; len: number }[] = [];
  for (let i = 0; i < edges.length; i += 2) {
    const len = edges[i] - edges[i + 1];
    if (len <= 0.002) continue;
    const mid = (edges[i] + edges[i + 1]) / 2;
    journals.push({ x: mid, len });
    if (i === 0 && L.noseMainBearing)
      // a long front journal with a main bearing at each end, the front one at the crankcase nose
      bearings.push({ x: edges[1] + 0.02, len: 0.03 }, { x: d.front - 0.02, len: 0.03 });
    else if (len > 0.02) bearings.push({ x: mid, len: Math.min(len - 0.006, 0.03) });
  }
  const cheek = T - CHEEK_T / 2; // cheek centres either side of the crankpin
  const cheeks = cyls.flatMap((c) => [c.x - cheek, c.x + cheek]);
  const counterweights = L.counterweights.map((w) => {
    const c = cyls.find((k) => k.n === w.cyl);
    if (!c) throw new Error(`Counterweight on cylinder ${w.cyl}, which ${spec.id} doesn't have`);
    return { c, at: w.cheek * cheek, x: c.x + w.cheek * cheek };
  });
  return { journals, bearings, cheek, cheeks, counterweights };
}

/**
 * Where the accessory drives sit: the starter (pinion on a ring gear behind the propeller flange, or a worm in a
 * right-angle adapter on the accessory end turning a shaft gear on the crankshaft gear), the propeller governor (spur
 * gear on the camshaft's front, or a bevel gear there with the governor on the lower left), and the alternators (belt
 * from a crankshaft pulley, or gear from a drive gear on the crankshaft).
 */
export function driveLayout(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const acc = spec.accessories;
  // governor: its gear meshes with the camshaft's, turning at the governor drive ratio
  const camGovR = 0.03,
    govR = (camGovR * 0.5) / acc.governorRatio;
  const gd = camGovR + govR;
  const governor =
    L.governor === "front-top"
      ? {
          at: [d.front - 0.03, d.camY - gd * Math.SQRT1_2, -gd * Math.SQRT1_2] as V3,
          rotation: [0, 0, 0] as V3,
          gearAt: null,
          camGovR,
          govR,
          teeth: 10,
          bevel: false,
        }
      : {
          // the governor body on the left side of the case, its bevel gear beside the camshaft's, a shaft between
          at: [d.front - 0.03 + govR + 0.007, d.camY, -(d.caseHalf - 0.034)] as V3,
          rotation: [0, Math.PI / 2, 0] as V3,
          gearAt: [d.front - 0.03 + govR + 0.007, d.camY, -(camGovR + 0.006)] as V3,
          camGovR,
          govR,
          teeth: Math.round((18 * govR) / camGovR),
          bevel: true,
        };
  let starter;
  if (L.starter === "front-ring") {
    const pinionR = (d.ringR * STARTER_TEETH.pinion) / STARTER_TEETH.ring;
    const sa = 235 * D2R,
      rs = d.ringR + pinionR + 0.001;
    const ringX = d.flangeX - 0.03;
    starter = {
      kind: "front-ring" as const,
      pinionR,
      ringX,
      at: [ringX, rs * Math.cos(sa), rs * Math.sin(sa)] as V3,
    };
  } else {
    const x = d.accRear - (L.starterAftIn ?? 0) * IN;
    // shaft gear on the crankshaft gear, lower right; worm wheel on its shaft behind the accessory face
    const sa = 135 * D2R,
      dist = d.crankGearR * 2;
    const shaft = {
      x: d.caseRear - 0.018,
      y: dist * Math.cos(sa),
      z: dist * Math.sin(sa),
      r: d.crankGearR,
      teeth: GEAR_TEETH.crank,
    };
    const starts = 1;
    const wheel = { x, r: 0.04, teeth: Math.round((acc.starterRatio * shaft.teeth * starts) / GEAR_TEETH.crank) };
    const worm = { r: 0.012, starts, at: [x, shaft.y - wheel.r - 0.012, shaft.z] as V3 };
    starter = {
      kind: "rear-adapter" as const,
      shaft,
      wheel,
      worm,
      // the motor on the worm's axis, across the engine to the right
      at: [x, worm.at[1], shaft.z + 0.08] as V3,
    };
  }
  const alternators = L.alternators.map((a) => {
    const ratio = a.ratio ?? acc.alternatorRatio;
    const ang = a.angleDeg * D2R;
    if (a.drive === "belt") {
      const r = a.r ?? 0.27;
      const x = d.flangeX - (a.pulleyBehindFlange ?? 0.055);
      return { def: a, ratio, x, at: [x, r * Math.cos(ang), r * Math.sin(ang)] as V3, gear: null, transverse: null };
    }
    const driveTeeth = 48,
      driveR = 0.09;
    const drivenTeeth = Math.round(driveTeeth / ratio),
      drivenR = (driveR * drivenTeeth) / driveTeeth;
    const t = a.axis === "transverse" ? a.transverse : undefined;
    if (t) {
      // shaft across the engine in the `angleDeg` direction; its bevel pinion beside the rim of the crankshaft's drive
      // gear, which sits just aft of the pinion
      const x = d.accRear + t.stationIn * IN;
      const axis: V3 = [0, Math.cos(ang), Math.sin(ang)];
      const along = (s: number): V3 => [x, s * axis[1], s * axis[2]];
      return {
        def: a,
        ratio,
        x,
        at: along(driveR + 0.006),
        gear: { driveR, driveTeeth, drivenR, drivenTeeth, driveX: x - drivenR - 0.007, bevel: true },
        transverse: { axis, padAt: along(t.padIn * IN), endAt: along(t.endIn * IN), r: t.r },
      };
    }
    const x = d.front - 0.045,
      dist = driveR + drivenR;
    return {
      def: a,
      ratio,
      x,
      at: [x, dist * Math.cos(ang), dist * Math.sin(ang)] as V3,
      gear: { driveR, driveTeeth, drivenR, drivenTeeth, driveX: x, bevel: false },
      transverse: null,
    };
  });
  return { governor, starter, alternators };
}

/**
 * How fast each drawn gear turns, in turns per crankshaft turn about +x in engine coordinates (+ = with the crankshaft),
 * and which gears drive which: external spur gears in mesh turn opposite ways, pulleys on one belt the same way, and a
 * bevel pair turns about crossed axes. The scene animates the drives from these spins; a gear is drawn in a group that
 * doesn't turn its axis, so its own x rotation is its spin.
 */
export function gearSpins(spec: EngineSpec, d: Dims, L: EngineLayout = layoutFor(spec)) {
  const acc = spec.accessories;
  const D = driveLayout(spec, d, L);
  const mag = magDrive(spec, d, L);
  const pump = oilPump(d, L);
  const spins: Record<string, number> = { crank: 1, cam: -0.5, magneto: acc.magnetoRatio };
  const meshes: { a: string; b: string; kind: "gear" | "belt" | "bevel" }[] = [{ a: "crank", b: "cam", kind: "gear" }];
  if (mag.idler) {
    spins.idler = -GEAR_TEETH.crank / mag.idler.teeth;
    meshes.push({ a: "crank", b: "idler", kind: "gear" }, { a: "idler", b: "magneto", kind: "gear" });
  } else meshes.push({ a: "cam", b: "magneto", kind: "gear" });
  // the first pumping gear turns with its drive gear (on the camshaft or meshing the crankshaft gear); the second meshes
  spins.oilPump = -pump.ratio;
  spins.oilPumpIdler = pump.ratio;
  if (!pump.onCam) {
    spins.oilPumpDrive = -pump.ratio;
    meshes.push({ a: "crank", b: "oilPumpDrive", kind: "gear" });
  }
  meshes.push({ a: "oilPump", b: "oilPumpIdler", kind: "gear" });
  if (D.starter.kind === "front-ring") {
    spins.pinion = -acc.starterRatio;
    meshes.push({ a: "crank", b: "pinion", kind: "gear" });
  } else {
    spins.starterShaft = -GEAR_TEETH.crank / D.starter.shaft.teeth;
    meshes.push({ a: "crank", b: "starterShaft", kind: "gear" });
  }
  spins.governor = acc.governorRatio;
  meshes.push({ a: "cam", b: "governor", kind: D.governor.bevel ? "bevel" : "gear" });
  for (const a of D.alternators) {
    // a bevel pinion beside the drive gear's forward face turns about its own axis with the crankshaft (+ outboard)
    spins[a.def.name] = a.gear && !a.gear.bevel ? -a.ratio : a.ratio;
    meshes.push({ a: "crank", b: a.def.name, kind: !a.gear ? "belt" : a.gear.bevel ? "bevel" : "gear" });
  }
  return { spins, meshes };
}
