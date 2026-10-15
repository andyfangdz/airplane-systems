/**
 * Shared pieces for the engine scene: dimensions from the spec, the layout of the accessories, materials and
 * geometry builders. Axes as in the airplanes: x forward (propeller end), y up, z right; metres.
 *
 * Published dimensions (bore, stroke, rod-free ones from IOM Table A-1, the overall envelope) set the scale. Where parts
 * sit follows the IOM's System Description figures (Figures 1B–9): camshaft above the crankshaft with the pushrod
 * tubes over the cylinders, rocker covers on the outer end of each head, spark plugs top and bottom, magnetos and fuel
 * pump on the rear accessory housing, oil filter at the back, fuel injector under the front of the sump, fuel manifold
 * on top, starter ring gear and alternator pulley on the propeller hub, governor pad on the front of the crankcase.
 * Shapes and sizes of individual parts are schematic.
 */
import * as THREE from "three";
import { firingAngle, sideAngle } from "@/engines/model/cycle";
import type { CylinderDef, EngineSpec } from "@/engines/types";

export const IN = 0.0254;
export const D2R = Math.PI / 180;

export type Dims = ReturnType<typeof dims>;

export function dims(spec: EngineSpec) {
  const g = spec.geometry;
  const r = (g.strokeIn * IN) / 2,
    l = g.rodIn * IN,
    bore = g.boreIn * IN;
  const pinTdc = r + l; // piston pin from the crank axis at top centre
  const crown = 0.045; // pin to crown
  const deck = pinTdc + crown + 0.004; // head face, just past the crown at top centre
  const halfWidth = (g.envelopeIn.width * IN) / 2; // outer face of the rocker covers
  const caseHalf = l - 0.02; // crankcase half-width: the barrel spigots start here
  const xs = g.cylinders.map((c) => c.x);
  const front = Math.max(...xs) + 0.12,
    rear = Math.min(...xs) - 0.13;
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
    /** Camshaft axis height (gear centres: crank gear r + cam gear r, 2:1). */
    camY: 0.12,
    crankGearR: 0.04,
    camGearR: 0.08,
    /** Rocker shaft, and the valve-stem tips at rest, along a cylinder's axis. */
    zPivot: halfWidth - 0.065,
    /** Rear face of the crankcase, accessory housing behind it. */
    caseRear: rear,
    accRear: rear - 0.05,
    /** Crankcase top and bottom (sump below). */
    caseTop: 0.16,
    caseBottom: -0.11,
    sumpBottom: -0.2,
    /** Propeller flange, starter ring gear and alternator pulley. */
    flangeX: front + 0.1,
    ringR: 0.17,
    // the alternator drive ratio with the 3.10 in alternator pulley it assumes (IOM Table A-4)
    pulleyR: ((3.1 * IN) / 2) * spec.accessories.alternatorRatio,
    altPulleyR: (3.1 * IN) / 2,
  };
}

/** Bank sign: +1 right (1, 3), −1 left (2, 4). */
export const bank = (c: CylinderDef) => (c.side === "R" ? 1 : -1);

/** Valve-train layout in a cylinder's own frame (+z outward along its axis, y up, x towards the front for the right
 * bank). Intake and exhaust sit fore and aft of the axis. */
export const VT = {
  xOff: 0.022, // intake at +xOff, exhaust at −xOff (local)
  baseR: 0.016, // cam lobe base circle
  lobeW: 0.014, // cam lobe width along the shaft
  tappetLen: 0.045,
  pushY: 0.12, // pushrod line height: the camshaft axis
  pivotY: 0.079, // rocker shaft, halfway between pushrod and valve stem (1:1 rocker)
  tipY: 0.038, // valve stem tips
  maxLift: 0.0095, // drawn lift (the IOM doesn't give one)
};

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

/** Fittings on a cylinder head, in the cylinder's frame: plugs top and bottom, nozzle on top, ports underneath. */
export function headPoints(d: Dims) {
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
    intakePort: [0.035, -0.1, d.deck + 0.07] as V3,
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

/** Starter ring gear and pinion teeth: not published, chosen so their ratio is the starter drive ratio (16.556:1). */
export const STARTER_TEETH = { ring: 149, pinion: 9 };

/** Teeth on the camshaft gear (twice the crankshaft gear's 24: the camshaft turns at half speed). */
export const GEAR_TEETH = { crank: 24, cam: 48 };

/**
 * Magneto drive gears: each meshes with the camshaft gear, sized so the magneto turns at the published magneto drive
 * ratio (Table A-1), and sits behind the accessory housing at ±z from the centreline.
 */
export function magDrive(spec: EngineSpec, d: Dims) {
  const z = 0.1;
  const ratio = spec.accessories.magnetoRatio;
  const r = (d.camGearR * 0.5) / ratio,
    teeth = Math.round((GEAR_TEETH.cam * 0.5) / ratio);
  return { r, teeth, z, y: d.camY + Math.sqrt((d.camGearR + r) ** 2 - z * z), x: d.caseRear - 0.018 };
}

/** Oil pump: a drive gear meshing below the crankshaft gear, its shaft running aft to two pumping gears. */
export function oilPump(d: Dims) {
  const driveR = d.crankGearR / 2;
  return {
    driveR,
    driveTeeth: GEAR_TEETH.crank / 2,
    y: -(d.crankGearR + driveR),
    gearR: 0.018,
    x0: -0.018, // drive gear, in the crankshaft gear's plane (from the crankcase's rear face)
    x1: -0.042, // pumping gears
    ratio: 2,
  };
}
