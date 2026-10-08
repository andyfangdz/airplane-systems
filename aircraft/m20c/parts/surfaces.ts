/** M20C control surfaces: flaps, ailerons, and the elevator and rudder that ride in the tail group. */

import { sided } from "@/lib/geometry";

import { V } from "@/lib/math";

import {
  AIL,
  EF,
  FIN_TOP,
  FLAP,
  RUD_BOT,
  SSPAN,
  SY,
  af,
  finCut,
  finSec,
  flatPaint,
  NAVY,
  hingeX,
  rudHs,
  sC,
  sLE,
  stabSec,
  wC,
  wLE,
  wT,
  wY,
  wingSec,
} from "../geometry";

import { surface } from "./catalogue";

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
const hp = (s: number, z: number, xc: number) => {
  const c = wC(z),
    [u, l] = af(xc, wT(z), 0.015);
  return V(wLE(z) - xc * c, wY(z) + ((u + l) / 2) * c, s * z);
};
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L",
    nm = s > 0 ? "Right" : "Left";
  const fz = [FLAP.z0, 1.2, 1.8, 2.4, FLAP.z1],
    az = [AIL.z0, 3.6, 4.2, 4.8, AIL.z1];
  surface(
    "flap" + side,
    () =>
      sided(
        fz.map((z) => wingSec(s * z, FLAP.hinge, 1)),
        s,
      ),
    hp(s, fz[0], FLAP.hinge),
    hp(s, fz[4], FLAP.hinge),
    ["flaps", "controls"],
    nm + " flap",
    "Wide-span flap, hydraulically lowered by the hand pump: two strokes for take-off (15°), four and a half for full deflection (33°) (OM p. 9). Max flap speed 125 mph (white arc 63–125) for this 1968 airplane; 100 mph on 1967 and earlier models (TCDS 2A3).",
  );
  surface(
    "ail" + side,
    () =>
      sided(
        az.map((z) => wingSec(s * z, AIL.hinge, 1)),
        s,
      ),
    hp(s, az[0], AIL.hinge),
    hp(s, az[4], AIL.hinge),
    ["controls"],
    nm + " aileron",
    "Push-pull tube actuated, differential linkage (up travel greater than down) to minimise adverse yaw; gap strips on the hinge line; bevelled trailing edge to lower control force (OM p. 8).",
  );
});
export const TAIL_SURFACE_KEYS = ["elev", "rudder"];
{
  const ez = [-SSPAN, -1.2, -0.6, 0, 0.6, 1.2, SSPAN];
  surface(
    "elev",
    () => ez.map((z) => stabSec(z, EF, 1)),
    V(sLE() - EF * sC(-SSPAN), SY, -SSPAN),
    V(sLE() - EF * sC(SSPAN), SY, SSPAN),
    ["controls"],
    "Elevator",
    "One-piece elevator on the trailing edge of the pivoting stabilizer; push-pull tube driven. Trim bungees on the elevator horns give trim assist as the stabilizer moves (OM p. 9).",
    true,
  );
  surface(
    "rudder",
    () => rudHs.map((h) => finSec(h, finCut(h), 1)),
    V(hingeX(RUD_BOT), RUD_BOT, 0),
    V(hingeX(FIN_TOP), FIN_TOP, 0),
    ["controls"],
    "Rudder",
    "Large rudder, its trailing edge sweeping aft toward the bottom; push-pull tube driven. On the ground its travel is limited by the nose-wheel steering linkage (OM p. 15). Navy on N6947N.",
    true,
    flatPaint(NAVY),
  );
}
