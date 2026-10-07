/** CAPS: parachute canister and harness straps. */
import { densify } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import { AB, FW, box, onSkin, tubeGeo } from "../geometry";
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
 * Forward strap path (x, y), canister to firewall, down the side under the windows. The SR20 POH (7-94) says only that
 * the straps run just under the fuselage skin to firewall attach points; this side-path shape is illustrative, after the
 * SR22/SR22T AMM Figure 95-00-1. Fitting heights are not surveyed.
 */
const FWD_PATH = [
  [-0.6, 0.3],
  [-0.3, 0.17],
  [0, 0.08],
  [0.6, 0.06],
  [1.2, 0.06],
  [2.0, 0.06],
  [FW, 0.1],
];
/** Strap centre as a fraction of the skin half-width: just inside the skin. */
const UNDER_SKIN = 0.97;
/** Forward strap centreline on side s (-1 left, +1 right): out of the canister, then under the skin to the firewall. */
export const fwdStrap = (s: number): Vec3[] => [
  [-0.6, 0.3, s * 0.12],
  ...densify(FWD_PATH, 0.03, false).map(([x, y]) => onSkin(x, y, s, UNDER_SKIN).toArray() as Vec3),
];
export const HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = {
  fwdL: fwdStrap(-1).at(-1)!,
  fwdR: fwdStrap(1).at(-1)!,
  aft: [AB, 0.2, 0],
};
[-1, 1].forEach((s) =>
  part(() => tubeGeo(fwdStrap(s), 0.012), ["caps"], {
    name: "Forward harness strap",
    note: "Runs from the canister just under the fuselage skin to a firewall attach point, and pulls through the skin covering when the parachute deploys (POH 7-94). The path along the side and the fitting height are illustrative.",
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
    name: "Aft harness strap",
    note: "Stowed in the parachute canister; attached to structure at the aft baggage compartment bulkhead (POH 7-94). Snubbed short at first; the snub line is cut eight seconds after deployment (POH 7-95).",
  },
);
