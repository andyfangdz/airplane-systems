import { TAIL_PAINT_BOX, paintTail } from "../geometry";
/**
 * C182T catalogue: control surfaces (flaps, ailerons, elevator, rudder) and the details riding on them: static dischargers,
 * balance weights, flap tracks, aileron hinges and the elevator trim tab.
 */
import { V } from "@/lib/math";
import {
  AIL_C,
  BL,
  EF,
  FLAP_C,
  HF,
  HZ,
  SY,
  Y,
  Z,
  box,
  cyl,
  finCut,
  finSec,
  fLE,
  fC,
  hingeX,
  sC,
  sLE,
  sided,
  stabSec,
  wC,
  wLE,
  wingP,
  wingSec,
  wY,
} from "../geometry";
import { live } from "../model";
import { RIG } from "../rig";
import { PV, onSurf, part, surface } from "./catalogue";

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
/** Hinge point on the wing at BL, chord fraction c, dropped below the mean line by `drop` m. */
const hp = (s: number, bl: number, c: number, drop = 0) => {
  const z = Z(bl);
  return V(wLE(z) - c * wC(z), wY(z) - drop, s * z);
};
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L",
    Side = s > 0 ? "Right" : "Left";
  const fz = [BL.flap0, 40, 60, 80, BL.flap1].map(Z),
    az = [BL.ail0, 130, 160, 185, BL.ail1].map(Z);
  // single-slot flap rides aft and down: the hinge axis sits below the wing so rotation moves it aft as it deflects
  surface(
    "flap" + side,
    () =>
      sided(
        fz.map((z) => wingSec(s * z, FLAP_C, 1)),
        s,
      ),
    hp(s, BL.flap0, FLAP_C - 0.01, 0.075),
    hp(s, BL.flap1, FLAP_C - 0.01, 0.075),
    ["flaps", "controls"],
    Side + " flap",
    "Single-slot flap, built like the ailerons but without balance weights and with a formed leading edge (POH 7-5). UP, 10°, 20°, FULL — 38° per TCDS 3A13 (the POH never gives the FULL angle).",
  );
  surface(
    "ail" + side,
    () =>
      sided(
        az.map((z) => wingSec(s * z, AIL_C, 1)),
        s,
      ),
    hp(s, BL.ail0, AIL_C + 0.02),
    hp(s, BL.ail1, AIL_C + 0.02),
    ["controls"],
    Side + " aileron",
    "Conventional hinged aileron: forward spar with balance weights, formed ribs and “V” corrugated skins (POH 7-5). Travel up 20° / down 15° ±2° (TCDS 3A13).",
  );
  const ez = [2.5, 20, 40, HZ - 0.05].map(Z);
  surface(
    "elev" + side,
    () =>
      sided(
        [
          ...(s > 0 ? RIG.trimTab.notch(ez, () => EF) : ez.map((z) => stabSec(-z, EF, 1))),
          ...[HZ, 64.5, 66.8, 68.4, 69.4, 70].map((b) => stabSec(s * Z(b), HF, 1)),
        ],
        s,
      ),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]),
    V(sLE(Z(HZ)) - EF * sC(Z(HZ)), SY, s * Z(HZ)),
    ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)",
    "Formed leading-edge skins, forward spar, ribs, torque tube and bellcrank, “V” corrugated skins; both tip leading-edge extensions carry balance weights (POH 7-6). Travel up 28° / down 21° ±1° (TCDS 3A13)." +
      (s > 0 ? " The right half's skins have the trim-tab cutout." : ""),
  );
});
surface(
  "rudder",
  () => [46.5, 54, 61.8, 66, 74.2, 85, 95, 100, 106, 108.4].map(Y).map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(Y(46.5)), Y(46.5), 0),
  V(hingeX(Y(106)), Y(106), 0),
  ["controls"],
  "Rudder",
  "Forward and aft spar, formed ribs, a wraparound skin; the top has a leading-edge extension with a balance weight (POH 7-6). Travel 24° each way measured parallel to WL 0 (TCDS 3A13). Rudder trim acts through a bungee on the rudder bars, not a tab.",
  { box: TAIL_PAINT_BOX, skin: paintTail },
);

/* ---------- surface details ---------- */
const WICK =
  "Static discharger: bleeds static charge off the trailing edges to cut radio noise. Set of 10, arm 152.9 (POH 6-20); check them at every annual (POH 7-73). Distribution and stations shown are illustrative, not a maintenance drawing.";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  [195, 175].forEach((bl, i) =>
    onSurf("ail" + side, wingP(s * Z(bl), 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), {
      color: "#2A2F33",
      name: "Static discharger",
      note: WICK,
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  [52, 40].forEach((bl) =>
    onSurf("elev" + side, V(sLE(Z(bl)) - sC(Z(bl)) - 0.05, SY, s * Z(bl)), () => cyl(0.004, 0.11, "x", 6), {
      color: "#2A2F33",
      name: "Static discharger",
      note: WICK,
      ext: true,
    }),
  );
  onSurf("elev" + side, V(sLE(Z(66)) - 0.05, SY, s * Z(66)), () => box(0.08, 0.03, 0.12), {
    color: "#6E7A84",
    name: "Elevator balance weight",
    note: "In each elevator tip leading-edge extension ahead of the hinge (horn balance): reduces control forces and prevents flutter (POH 7-6).",
    pin: s > 0,
  });
  onSurf("ail" + side, wingP(s * Z(150), AIL_C + 0.035, 0), () => box(0.05, 0.025, 0.5), {
    color: "#6E7A84",
    name: "Aileron balance weights",
    note: "Carried in the aileron forward spar (POH 7-5).",
    pin: s > 0,
  });
  [32, 62, 94].forEach((b, i) =>
    part(() => box(0.32, 0.05, 0.03), ["flaps"], {
      pos: PV(wingP(s * Z(b), 0.72, -1).add(V(-0.03, -0.03, 0))),
      color: "#B9C1C7",
      name: "Flap track and rollers",
      note: "The flap rolls aft and down along curved tracks as it extends, opening the slot (single-slot flap, POH 7-20).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  [118, 165, 202].forEach((b) =>
    part(() => box(0.1, 0.03, 0.022), ["controls"], {
      pos: PV(wingP(s * Z(b), 0.78, -1).add(V(-0.01, -0.012, 0))),
      color: "#C9D0D5",
      name: "Aileron hinge",
      note: "Aileron hinge bracket on the rear spar.",
      ext: true,
      chan: ["aileron"],
    }),
  );
});
// elevator trim tab on the right elevator (deflects with trim: tab UP for nose-down trim, DOWN for nose-up — S3-22, S3-23)
{
  const tab = RIG.trimTab,
    axis = V(...tab.axis);
  const animate = (m: import("three").Mesh) => {
    m.quaternion.setFromAxisAngle(axis, RIG.surfaceAngles({ ...live.ctl, trim: live.kap.trim }, 0).tab);
  };
  onSurf("elevR", V(...tab.pivot), tab.geo, {
    color: "#9F85E6",
    name: "Elevator trim tab",
    pin: true,
    ext: true,
    sys: ["controls", "autopilot"],
    note: "In the trailing-edge cutout of the RIGHT elevator: spar, rib and “V” corrugated skins (POH 7-6). Driven by the actuator in the stabilizer through a push-pull rod. Moves UP with nose-down trim and DOWN with nose-up trim (S3-22). Travel 24° up / 15° down (TCDS). Tab span/chord and clearances are illustrative.",
    anim: animate,
  });
  onSurf("elevR", V(...tab.pivot), () => box(0.02, 0.05, 0.01).translate(-0.02, 0.025, 0), {
    color: "#7C57CF",
    name: "Trim tab horn",
    anim: animate,
  });
}
onSurf("rudder", V(fLE(Y(108)) - 0.1, Y(108), 0), () => box(0.12, 0.035, 0.03), {
  color: "#6E7A84",
  name: "Rudder balance weight",
  note: "In the leading-edge extension at the top of the rudder (horn balance, POH 7-6).",
  pin: true,
});
[98, 80].forEach((h) =>
  onSurf("rudder", V(fLE(Y(h)) - fC(Y(h)) - 0.04, Y(h), 0), () => cyl(0.004, 0.11, "x", 6), {
    color: "#2A2F33",
    name: "Static discharger",
    note: WICK,
    ext: true,
  }),
);
