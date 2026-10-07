/** CAPS: parachute canister and harness straps. */
import type { Vec3 } from "@/lib/math";
import { AB, box, tubeGeo } from "../geometry";
import { part } from "./catalogue";

/* ---------- CAPS ---------- */
export const CAPS_BOX: Vec3 = [-0.76, 0.22, 0];
part(() => box(0.4, 0.18, 0.26), ["caps"], {
  pos: CAPS_BOX,
  name: "CAPS canister",
  note: "Composite box aft of the baggage bulkhead holding the 2,400 ft² canopy and solid-propellant rocket, under a thin composite cover.",
  pin: true,
});
export const HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = {
  fwdL: [2.55, 0.1, -0.4],
  fwdR: [2.55, 0.1, 0.4],
  aft: [AB, 0.2, 0],
};
[-1, 1].forEach((s) =>
  part(
    () =>
      tubeGeo(
        [
          [-0.6, 0.3, s * 0.12],
          [0, 0.5, s * 0.25],
          [1.2, 0.6, s * 0.3],
          [2.0, 0.45, s * 0.35],
          [2.55, 0.1, s * 0.4],
        ],
        0.012,
      ),
    ["caps"],
    {
      name: "Forward harness strap",
      note: "Runs just under the skin to the firewall; tears through the covering during deployment.",
      pin: s > 0,
    },
  ),
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
  { name: "Aft harness strap", note: "Attaches at the aft baggage bulkhead." },
);
