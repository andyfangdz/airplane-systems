/** CAPS: parachute canister and harness straps. */
import type * as THREE from "three";
import { curveOf, densify } from "@/lib/geometry";
import type { PartAnim } from "@/lib/catalogue";
import { clamp, ease, type Vec3 } from "@/lib/math";
import { AB, FW, box, onSkin, tubeGeo } from "../geometry";
import { live } from "../model";
import { part } from "./catalogue";

/* ---------- CAPS ---------- */
export const CAPS_BOX: Vec3 = [-0.76, 0.22, 0];
part(() => box(0.4, 0.18, 0.26), ["caps"], {
  pos: CAPS_BOX,
  name: "CAPS canister",
  note: "Composite box aft of the baggage bulkhead holding the 2,400 ft² canopy and solid-propellant rocket, under a thin composite cover.",
  pin: true,
});

/**
 * Forward strap path (x, y), canister to firewall: down behind the rear window, then low along the side below the door
 * and above the wing root, then up to the firewall fitting. The SR20 POH (7-94) says only that the straps run just under
 * the fuselage skin to firewall attach points; this side-path shape is illustrative, after the SR22/SR22T AMM
 * Figure 95-00-1. Fitting heights are not surveyed.
 */
const FWD_PATH = [
  [-0.6, 0.3],
  [-0.3, 0.18],
  [0, 0.04],
  [0.35, -0.2],
  [0.7, -0.36],
  [2.05, -0.36],
  [2.3, -0.15],
  [FW, 0.1],
];
/** Strap centre as a fraction of the skin half-width: just inside the skin. */
const UNDER_SKIN = 0.97;
/** Forward strap centreline on side s (-1 left, +1 right): out of the canister, then under the skin to the firewall. */
export const fwdStrap = (s: number): Vec3[] => [
  [-0.6, 0.3, s * 0.12],
  ...densify(FWD_PATH, 0.03, false).map(([x, y]) => onSkin(x, y, s, UNDER_SKIN).toArray() as Vec3),
];
/** Deployment times (s): the rocket fires and starts pulling the bag out, and the lines come taut (`CAPS_PHASES`). */
export const ROCKET_T = 0.3,
  TAUT_T = 1.6;
/**
 * Fraction of each forward strap pulled out through the skin covering at deployment time t, from the canister end toward
 * the firewall (POH 7-94): 0 stowed, 1 fully out when the lines are taut. The POH gives the order, not a rate; this follows
 * the bag's rise, before the canopy starts to inflate at about two seconds (POH 7-95).
 */
export const strapOut = (t: number) => (t < ROCKET_T ? 0 : ease(clamp((t - ROCKET_T) / (TAUT_T - ROCKET_T), 0, 1)));
const strapCurves = new Map<number, THREE.Curve<THREE.Vector3>>();
/** Point (airplane coordinates) where the forward strap on side s leaves the skin when a fraction `out` is pulled out. */
export const strapPeel = (s: number, out: number) => {
  let c = strapCurves.get(s);
  if (!c) strapCurves.set(s, (c = curveOf(fwdStrap(s))));
  return c.getPointAt(out);
};
/** Stowed forward strap: the part still under the skin, ahead of the peel point; gone once the lines are taut. */
const tearOut: PartAnim = (m) => {
  const out = strapOut(live.capsT),
    g = m.geometry as THREE.TubeGeometry,
    { tubularSegments, radialSegments } = g.parameters;
  m.visible = out < 1;
  g.setDrawRange(Math.round(out * tubularSegments) * radialSegments * 6, Infinity);
};
export const HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = {
  fwdL: fwdStrap(-1).at(-1)!,
  fwdR: fwdStrap(1).at(-1)!,
  aft: [AB, 0.2, 0],
};
[-1, 1].forEach((s) =>
  part(() => tubeGeo(fwdStrap(s), 0.012), ["caps"], {
    anim: tearOut,
    name: "Forward harness strap",
    note: "Runs from the canister just under the fuselage skin to a firewall attach point, and pulls through the skin covering when the parachute deploys (POH 7-94). The path along the side, below the door, and the fitting height are illustrative.",
    pin: s > 0,
  }),
);
part(
  () =>
    tubeGeo(
      [
        [-0.62, 0.24, 0],
        [AB, 0.2, 0],
      ],
      0.014,
    ),
  ["caps"],
  {
    // stowed in the canister, so it leaves with the bag
    anim: (m) => {
      m.visible = live.capsT < ROCKET_T;
    },
    name: "Aft harness strap",
    note: "Stowed in the parachute canister; attached to structure at the aft baggage compartment bulkhead (POH 7-94). Snubbed short at first; the snub line is cut eight seconds after deployment (POH 7-95).",
  },
);
